import { FULL_DB, BRAND_TO_GENERIC, ALIASES } from '../data/hibDatabase';
import Fuse from 'fuse.js';

export interface AuditedItem {
  name: string;
  original_name: string;
  quantity: number;
  bill_rate: number;
  hib_rate: number;
  hib_code: string;
  status: 'exact' | 'brand' | 'not_found';
  total_hib: number;
  total_bill: number;
  type: string;
  flag?: string;
}

/**
 * Expert Normalization:
 * 1. Uppercase
 * 2. Remove all non-alphanumeric chars
 * 3. Remove common medical suffixes that interfere with matching
 */
const expertNormalize = (s: string, preserveSpaces = false) => {
  if (!s) return '';
  let n = s.toUpperCase();
  
  // Remove common suffixes/forms
  const suffixes = [
    'TAB', 'CAP', 'INJ', 'SYP', 'SUSP', 'VIAL', 'AMP', 'MG', 'ML', 'GM', 'MCG', 'IU', 'DRY', 'POWDER', 'GEL', 'CREAM', 'OINT', 'SOLUTION', 'DROP', 'EYE', 'EAR'
  ];
  
  suffixes.forEach(suffix => {
    const regex = new RegExp(`\\b${suffix}\\b`, 'g');
    n = n.replace(regex, '');
  });

  if (preserveSpaces) {
    return n.replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  }
  return n.replace(/[^A-Z0-9]/g, '').trim();
};

export function crossReference(raw: any) {
  try {
    if (!raw) throw new Error("Input data is null or undefined");

    // Pre-normalize DB for expert matching
    const dbArray = Object.entries(FULL_DB).map(([key, value]) => ({
      key,
      normKey: expertNormalize(key),
      normWords: expertNormalize(key, true).split(' '),
      value
    }));

    // Initialize Fuse.js for fuzzy matching
    const fuse = new Fuse(dbArray, {
      keys: ['key', 'normKey'],
      threshold: 0.3,
      distance: 100,
      minMatchCharLength: 3
    });

    const auditItems = (items: any[], type: string) => {
      return (items || []).map(item => {
        try {
          const originalName = item.name || "";
          const normInput = expertNormalize(originalName);
          const inputWords = expertNormalize(originalName, true).split(' ').filter(w => w.length > 2);
          
          // 1. Check Aliases first
          const aliasedName = ALIASES[originalName.toLowerCase()] || originalName;
          const normAliased = expertNormalize(aliasedName);

          // 2. Try Exact Match (on normalized keys)
          let hit = dbArray.find(d => d.normKey === normAliased || d.normKey === normInput);
          let status: 'exact' | 'brand' | 'not_found' = hit ? 'exact' : 'not_found';

          // 3. Brand Mapping (Double Cross Check)
          if (!hit) {
            const brandMatch = Object.keys(BRAND_TO_GENERIC).find(brand => 
              normInput.includes(expertNormalize(brand)) || expertNormalize(brand).includes(normInput)
            );
            
            if (brandMatch) {
              const generic = BRAND_TO_GENERIC[brandMatch];
              const normGeneric = expertNormalize(generic);
              hit = dbArray.find(d => d.normKey.includes(normGeneric) || normGeneric.includes(d.normKey));
              if (hit) status = 'brand';
            }
          }

          // 4. Substring Fallback (Expert Level)
          if (!hit && normInput.length > 3) {
            hit = dbArray.find(d => d.normKey.includes(normInput) || normInput.includes(d.normKey));
            if (hit) status = 'exact';
          }

          // 5. Word Overlap Fallback (Expert Level)
          if (!hit && inputWords.length > 0) {
            hit = dbArray.find(d => {
              return inputWords.every(w => d.normWords.some(dw => dw.includes(w) || w.includes(dw)));
            });
            if (hit) status = 'exact';
          }

          // 6. Specific X-Ray Mapping (Expert Level)
          if (!hit && (normInput.includes('XRAY') || normInput.includes('XRAY'))) {
            if (normInput.includes('KNEE')) {
              hit = dbArray.find(d => d.key === 'SINGLE SITE AP/PA VIEW');
              if (hit) status = 'exact';
            }
          }

          // 7. Fuse.js Fuzzy Match (Last Resort)
          if (!hit) {
            const fuzzyResults = fuse.search(originalName);
            if (fuzzyResults.length > 0) {
              hit = fuzzyResults[0].item;
              status = 'exact';
            }
          }

          const qty = item.quantity || 1;
          const billRate = item.bill_rate || 0;
          const hibRate = hit ? hit.value.rate : 0;
          const hibCode = hit ? hit.value.code : 'N/A';
          const matchedName = hit ? hit.key : originalName;

          return {
            ...item,
            name: matchedName,
            original_name: originalName,
            status,
            hib_rate: hibRate,
            hib_code: hibCode,
            total_hib: hibRate * qty,
            total_bill: billRate * qty,
            type,
            flag: item.flag || ""
          };
        } catch (itemError) {
          console.error("Error auditing item:", item, itemError);
          return {
            ...item,
            original_name: item.name || "Unknown",
            status: 'not_found',
            hib_rate: 0,
            hib_code: 'ERR',
            total_hib: 0,
            total_bill: (item.bill_rate || 0) * (item.quantity || 1),
            type
          };
        }
      });
    };

    const audited_medicines = auditItems(raw.medicines, 'MED');
    const audited_labs = auditItems(raw.lab_tests, 'LAB');
    const audited_radiology = auditItems(raw.radiology, 'RAD');
    const audited_surgery = auditItems(raw.surgery, 'SURG');
    const audited_general = auditItems(raw.general, 'GEN');

    const allAudited = [
      ...audited_medicines,
      ...audited_labs,
      ...audited_radiology,
      ...audited_surgery,
      ...audited_general
    ];

    const totalHIB = allAudited.reduce((sum, item) => sum + item.total_hib, 0);
    const totalBill = raw.total_bill_amount || 0;

    return {
      ...raw,
      audited_medicines,
      audited_labs,
      audited_radiology,
      audited_surgery,
      audited_general,
      total_hib_amount: totalHIB,
      overcharge: Math.max(0, totalBill - totalHIB),
      match_status: totalBill === totalHIB ? 'match' : 'mismatch'
    };
  } catch (globalError) {
    console.error("Critical error in crossReference:", globalError);
    return {
      ...raw,
      audited_medicines: [],
      audited_labs: [],
      audited_radiology: [],
      audited_surgery: [],
      audited_general: [],
      total_hib_amount: 0,
      overcharge: raw.total_bill_amount || 0,
      match_status: 'error',
      error: globalError instanceof Error ? globalError.message : "Unknown error"
    };
  }
}
