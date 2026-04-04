import { GoogleGenAI } from "@google/genai";
import { supabase } from "../utils/supabase";

const HYBRID_AUDIT_PROMPT = `
### ROLE:
You are the "HIB Medical Automator," a Senior Medical Auditor and Data Extraction Engine for HIB Nepal.
Your task is to extract data from HIB-04 Electronic Claim Summary Reports AND audit the items against HIB rules and the provided diagnosis.

### STEP 1: EXTRACTION PROTOCOL:
1. **VERBATIM EXTRACTION**: Extract text EXACTLY as it appears on the page. Do NOT correct spelling, do NOT normalize names, and do NOT infer missing data (EXCEPT for ICD-10 codes).
2. **GROUNDING RULE**: Every item in the "items" array MUST be physically present in the "ITEMIZED CLAIM DETAILS" table of the provided image.
3. **NO HALLUCINATIONS**: If an item is NOT explicitly listed in the table, it is FORBIDDEN to include it.
4. **TABLE EXTRACTION**: 
   - Extract EVERY row from the "ITEMIZED CLAIM DETAILS" table.
   - Map "Category" to one of: Medicine, Lab, Radiology, Surgical, General.
   - Extract "Item/Service Name", "Qty", "Unit Price", and "Total (NPR)".
5. **CORE VALIDATION**:
   - Look for: HIB Insuree ID, Patient Name, Hospital Name, Claim ID, NMC No.
   - If any are missing, set "is_valid_claim": false.

### STEP 2: AUDIT PROTOCOL:
1. **DIAGNOSIS CONSISTENCY**: Check if the items are medically necessary for the extracted diagnosis.
2. **NLEM CHECK**: Verify if medicines are on the National List of Essential Medicines (NLEM).
3. **ICD-10 MAPPING**: If a diagnosis name is extracted but the ICD-10 code is missing or illegible on the document, you MUST use Google Search to assign the most specific and standard ICD-10 CM code possible.
4. **CLEANED VERSION LOGIC**:
   - For every item, provide a "cleaned" version that is optimized for HIB approval.
   - **Medicine Mapping**: If an item is a brand name, the "cleaned_name" MUST be the generic equivalent.
   - **Goal**: The cleaned version should have zero flags and 100% compliance.

### JSON STRUCTURE:
Return ONLY a valid JSON object.
{
  "is_valid_claim": true,
  "missing_items": [],
  "patient": { "name": "", "age": "", "sex": "", "health_insurance_number": "", "visit_type": "IPD/OPD" },
  "hospital": { "name": "", "registration_no": "" },
  "doctor": { "name": "", "nmc_number": "" },
  "diagnosis": [{"name": "", "icd10_code": ""}],
  "total_bill_amount": 0,
  "ai_insights": {
    "fraud_flags": [],
    "medical_consistency": "",
    "savings_opportunity": "",
    "rejection_risk_score": 0,
    "is_bhs_eligible": true
  },
  "audited_items": [
    {
      "name": "",
      "original_name": "",
      "category": "medicine/lab/radiology/surgical/general",
      "quantity": 1,
      "bill_rate": 0,
      "status": "exact/brand/not_found",
      "is_nlem_listed": true,
      "flag": "UNNECESSARY_INVESTIGATION/UPCODING/UNBUNDLING/NONE",
      "notes": "",
      "cleaned_version": {
        "name": "Generic Name or Original",
        "rate": 0,
        "code": "HIB_CODE"
      }
    }
  ],
  "total_hib_amount": 0,
  "overcharge": 0,
  "notes": "",
  "hash_payload": "string_representation_of_cleaned_data_for_sealing"
}`;

async function searchHIBDatabase(items: any[]) {
  const auditedItems = [];
  
  for (const item of items) {
    let dbMatch = null;
    
    // Clean item name for better matching (remove strengths, parentheses, etc.)
    const cleanName = item.name.replace(/\(.*\)/g, '').replace(/\d+(mg|ml|g|mcg|iu)/gi, '').trim();
    const firstWord = cleanName.split(/\s+/)[0];
    
    // Search across multiple possible table names and naming variations
    const tables = ['hib_items', 'health_insurance_benefits', 'health_insurance_benefit'];
    
    for (const table of tables) {
      try {
        // 1. Try exact or partial match with clean name
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .or(`name.ilike.%${cleanName}%,name.ilike.%${item.name}%`)
          .limit(5);
          
        if (!error && data && data.length > 0) {
          // Find the best match in the results
          dbMatch = data.find((d: any) => 
            item.name.toLowerCase().includes(d.name.toLowerCase()) || 
            d.name.toLowerCase().includes(item.name.toLowerCase()) ||
            d.name.toLowerCase().includes(cleanName.toLowerCase())
          ) || data[0];
          break; 
        }

        // 2. Special case for CBC and other common abbreviations
        if (item.name.toUpperCase().includes('CBC') || item.name.toUpperCase().includes('COMPLETE BLOOD COUNT')) {
          const { data: cbcData, error: cbcError } = await supabase
            .from(table)
            .select('*')
            .or('name.ilike.%CBC%,name.ilike.%Complete Blood Count%,name.ilike.%TC/DC%')
            .limit(1);
            
          if (!cbcError && cbcData && cbcData.length > 0) {
            dbMatch = cbcData[0];
            break;
          }
        }

        // 3. Fallback to first word if still no match
        if (firstWord && firstWord.length > 3) {
          const { data: fwData, error: fwError } = await supabase
            .from(table)
            .select('*')
            .ilike('name', `%${firstWord}%`)
            .limit(1);
            
          if (!fwError && fwData && fwData.length > 0) {
            dbMatch = fwData[0];
            break;
          }
        }
      } catch (e) {
        // Table might not exist, skip silently
      }
    }

    auditedItems.push({
      ...item,
      hib_rate: dbMatch?.rate || 0,
      hib_code: dbMatch?.code || dbMatch?.item_code || 'N/A',
      status: dbMatch ? 'found' : 'not_found',
      db_rules: dbMatch?.rules || dbMatch?.description || '' 
    });
  }
  
  return auditedItems;
}

export function getApiKey() {
  // 1. Try to get from localStorage
  const localKey = localStorage.getItem('HIB_GEMINI_API_KEY');
  
  // 2. Try to get from environment
  const envKey = (typeof process !== 'undefined' && process.env?.API_KEY) ||
    import.meta.env.VITE_GEMINI_API_KEY || 
    (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY);
    
  // If we have a local key, use it (unless it's a placeholder)
  if (localKey && localKey.trim() && !localKey.includes('TODO')) return localKey.trim();
  
  // Otherwise use env key
  if (envKey && envKey.trim() && !envKey.includes('TODO') && envKey.length > 10) {
    return envKey.trim();
  }
  
  return undefined;
}

export function clearApiKey() {
  localStorage.removeItem('HIB_GEMINI_API_KEY');
}

export async function hasValidApiKey() {
  const key = getApiKey();
  if (key) return true;

  // Check AI Studio platform key with timeout
  if (typeof window !== 'undefined' && (window as any).aistudio?.hasSelectedApiKey) {
    try {
      // Add a timeout to the platform check
      const platformCheck = (window as any).aistudio.hasSelectedApiKey();
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
      
      const result = await Promise.race([platformCheck, timeout]);
      return !!result;
    } catch (e) {
      console.warn("Platform API key check failed or timed out:", e);
      return false;
    }
  }
  
  return false;
}

export async function analyzeMedicalDocument(base64Image: string, mimeType: string) {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please set it in the App Settings (gear icon) or AI Studio.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const callWithRetry = async (fn: () => Promise<any>, retries = 3, delay = 2000) => {
    try {
      return await fn();
    } catch (err: any) {
      const isQuotaError = 
        err.message?.includes('429') || 
        err.message?.includes('RESOURCE_EXHAUSTED') ||
        err.status === 429 ||
        (err.response && err.response.status === 429);

      const isExpiredError = 
        err.message?.includes('API key expired') || 
        err.message?.includes('expired') ||
        err.status === 400;

      if (isExpiredError) {
        clearApiKey(); // Clear the bad key so user can re-connect
        throw new Error("Your API key has expired. Please refresh the page or re-connect your Gemini key in Settings.");
      }

      if (isQuotaError && retries > 0) {
        console.warn(`Quota exceeded (429). Retrying in ${delay}ms... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return callWithRetry(fn, retries - 1, delay * 2);
      }
      throw err;
    }
  };

  // COMBINED STEP: Extraction + Audit
  const response = await callWithRetry(() => ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { text: HYBRID_AUDIT_PROMPT },
          {
            inlineData: {
              data: base64Image.split(',')[1] || base64Image,
              mimeType: mimeType
            }
          }
        ]
      }
    ],
    config: { 
      responseMimeType: "application/json",
      temperature: 0, 
      topP: 0.1,
      topK: 1,
      tools: [{ googleSearch: {} }]
    }
  }));

  const data = JSON.parse(response.text || "{}");
  
  if (!data.is_valid_claim) {
    return { ...data, audited_medicines: [], audited_labs: [], audited_radiology: [], audited_surgery: [], audited_general: [], total_hib_amount: 0, overcharge: 0 };
  }

  // Database Lookup for Rates (Deterministic)
  const itemsWithRates = await searchHIBDatabase(data.audited_items || []);
  
  // Merge DB rates back into the AI data
  const finalAuditedItems = data.audited_items.map((item: any, idx: number) => {
    const dbInfo = itemsWithRates[idx];
    const hib_rate = dbInfo?.hib_rate || 0;
    
    // The HIB approved rate is the MINIMUM of the bill rate and the HIB ceiling rate.
    // If hib_rate is 0 (not found), we assume HIB pays 0 for this item (strict audit).
    const approvedRate = hib_rate > 0 ? Math.min(item.bill_rate, hib_rate) : 0;
    
    return {
      ...item,
      hib_rate,
      hib_code: dbInfo?.hib_code || 'N/A',
      approved_rate: approvedRate,
      cleaned_version: {
        ...item.cleaned_version,
        rate: approvedRate,
        code: dbInfo?.hib_code || 'N/A'
      }
    };
  });

  // Calculate totals based on the audited items
  const calculatedTotalBill = finalAuditedItems.reduce((sum: number, item: any) => sum + (item.bill_rate * item.quantity), 0);
  const total_hib_amount = finalAuditedItems.reduce((sum: number, item: any) => sum + (item.approved_rate * item.quantity), 0);
  
  // Use the larger of extracted total or calculated total to ensure we don't miss anything
  const total_bill_amount = Math.max(data.total_bill_amount || 0, calculatedTotalBill);
  const overcharge = total_bill_amount - total_hib_amount;

  // Format final response to match existing UI expectations
  return {
    ...data,
    total_bill_amount,
    audited_items: finalAuditedItems,
    audited_medicines: finalAuditedItems.filter((i: any) => i.category?.toLowerCase().includes('med')),
    audited_labs: finalAuditedItems.filter((i: any) => i.category?.toLowerCase().includes('lab')),
    audited_radiology: finalAuditedItems.filter((i: any) => i.category?.toLowerCase().includes('rad')),
    audited_surgery: finalAuditedItems.filter((i: any) => i.category?.toLowerCase().includes('surg')),
    audited_general: finalAuditedItems.filter((i: any) => {
      const cat = i.category?.toLowerCase() || '';
      return !cat.includes('med') && !cat.includes('lab') && !cat.includes('rad') && !cat.includes('surg');
    }),
    total_hib_amount,
    overcharge: overcharge > 0 ? overcharge : 0,
    id: Date.now().toString() 
  };
}

export async function chatWithAuditor(history: any[], message: string, auditData: any) {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please set it in the App Settings (gear icon) or AI Studio.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: `You are the HIB Smart Assistant. You have access to the following audit results: ${JSON.stringify(auditData)}. 
      Your goal is to help the user understand the audit, explain HIB rules, and provide clinical context. 
      Be professional, accurate, and concise. If the user asks about a specific item, refer to the audit notes.`,
      tools: [{ googleSearch: {} }]
    },
  });

  const response = await chat.sendMessage({ message });
  return response.text;
}
