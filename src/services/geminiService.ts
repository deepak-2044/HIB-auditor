import { GoogleGenAI } from "@google/genai";
import { supabase } from "../utils/supabase";

const EXTRACTION_PROMPT = `
You are an expert Medical Data Extractor for the Health Insurance Board (HIB) Nepal. 
Your task is to convert handwritten or printed hospital prescriptions, lab orders, and pharmacy bills into structured JSON data.

### CORE VALIDATION:
You MUST look for these 6 core elements:
1. HIB Insurance Number (Health Insurance Number)
2. Patient's Name
3. Doctor's Name
4. National Medical Council (NMC) ID Number
5. Hospital Name
6. Unique Bill ID / Registration No.

If ANY of these 6 items are missing, set "is_valid_claim": false and list the missing items in "missing_items".
If all are present, set "is_valid_claim": true.

### EXTRACTION RULES:
1. MEDICINES: 
   - Extract the FULL name, including brand names and strengths (e.g., "Tab. Napa 500mg").
   - Strip out dosing instructions like "1-0-1", "TDS", "BID", or "Pc/Ac" from the 'name' field.
   - Extract "bill_rate" (unit price) and "quantity".

2. LABS, RADIOLOGY & SURGERY:
   - Extract ONLY the actual test or procedure names.
   - Extract "bill_rate" (unit price) and "quantity".

### JSON STRUCTURE:
Return ONLY a valid JSON object.
{
  "is_valid_claim": true,
  "missing_items": [],
  "patient": { "name": "", "age": "", "sex": "", "health_insurance_number": "" },
  "hospital": { "name": "", "registration_no": "" },
  "doctor": { "name": "", "nmc_number": "" },
  "diagnosis": [{"name": "", "icd10_code": ""}],
  "items": [
    { "name": "", "category": "Medicine/Lab/Radiology/Surgery/General", "quantity": 1, "bill_rate": 0 }
  ],
  "total_bill_amount": 0
}`;

const AUDIT_PROMPT = `
You are a Senior Medical Auditor for HIB Nepal. 
You are given a list of extracted items from a hospital bill and their corresponding official HIB rates and rules retrieved from our database.

### TASK:
1. Compare the hospital's "bill_rate" with the official "hib_rate".
2. Check for "UNNECESSARY_INVESTIGATION": Is the test/medicine medically indicated for the diagnosis?
3. Check for "UPCODING" or "UNBUNDLING".
4. If an item is "not_found" in the HIB database, explain WHY in the "notes" field for that item (e.g., "Item not in HIB 2081 Formulary", "Requires prior authorization", or "Possible naming mismatch").
5. Specifically for "Complete Blood Count (CBC)": If it is not covered, check if it was billed under a different name like "TC/DC/Hb" or if it's simply missing from the provided HIB list.

### INPUT DATA:
Diagnosis: {{DIAGNOSIS}}
Extracted Items & DB Rules: {{ITEMS_WITH_RULES}}

### JSON STRUCTURE:
Return ONLY a valid JSON object.
{
  "ai_insights": {
    "fraud_flags": [],
    "medical_consistency": "",
    "savings_opportunity": ""
  },
  "audited_items": [
    {
      "name": "",
      "original_name": "",
      "category": "",
      "quantity": 1,
      "bill_rate": 0,
      "hib_rate": 0,
      "hib_code": "",
      "status": "exact/brand/not_found",
      "flag": "UNNECESSARY_INVESTIGATION/UPCODING/UNBUNDLING/NONE",
      "notes": ""
    }
  ],
  "total_hib_amount": 0,
  "overcharge": 0,
  "notes": ""
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

  // STEP 1: Extraction
  const extractionResponse = await callWithRetry(() => ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: [
      {
        parts: [
          { text: EXTRACTION_PROMPT },
          {
            inlineData: {
              data: base64Image.split(',')[1] || base64Image,
              mimeType: mimeType
            }
          }
        ]
      }
    ],
    config: { responseMimeType: "application/json" }
  }));

  const extractedData = JSON.parse(extractionResponse.text || "{}");
  
  if (!extractedData.is_valid_claim) {
    return { ...extractedData, audited_medicines: [], audited_labs: [], audited_radiology: [], audited_surgery: [], audited_general: [], total_hib_amount: 0, overcharge: 0 };
  }

  // STEP 2: Database Lookup
  const itemsWithRules = await searchHIBDatabase(extractedData.items || []);

  // STEP 3: Clinical Auditing
  const auditResponse = await callWithRetry(() => ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: [
      {
        parts: [
          { 
            text: AUDIT_PROMPT
              .replace('{{DIAGNOSIS}}', JSON.stringify(extractedData.diagnosis))
              .replace('{{ITEMS_WITH_RULES}}', JSON.stringify(itemsWithRules))
          }
        ]
      }
    ],
    config: { 
      responseMimeType: "application/json"
    }
  }));

  const auditData = JSON.parse(auditResponse.text || "{}");

  // Format final response to match existing UI expectations
  return {
    ...extractedData,
    ...auditData,
    audited_medicines: auditData.audited_items.filter((i: any) => i.category === 'Medicine'),
    audited_labs: auditData.audited_items.filter((i: any) => i.category === 'Lab'),
    audited_radiology: auditData.audited_items.filter((i: any) => i.category === 'Radiology'),
    audited_surgery: auditData.audited_items.filter((i: any) => i.category === 'Surgery'),
    audited_general: auditData.audited_items.filter((i: any) => i.category === 'General'),
    id: Date.now().toString() // For history manager
  };
}

export async function chatWithAuditor(history: any[], message: string, auditData: any) {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please set it in the App Settings (gear icon) or AI Studio.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const chat = ai.chats.create({
    model: "gemini-flash-latest",
    config: {
      systemInstruction: `You are the HIB Smart Assistant. You have access to the following audit results: ${JSON.stringify(auditData)}. 
      Your goal is to help the user understand the audit, explain HIB rules, and provide clinical context. 
      Be professional, accurate, and concise. If the user asks about a specific item, refer to the audit notes.`,
    },
  });

  const response = await chat.sendMessage({ message });
  return response.text;
}
