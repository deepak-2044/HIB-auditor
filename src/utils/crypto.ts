/**
 * Utility for generating secure hashes for medical claims.
 * Used for the "Digital Notary" system.
 */

/**
 * Generates a SHA-256 hash of a string.
 */
export async function generateHash(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Creates a standard payload string for hashing from cleaned audit data.
 * This ensures consistency between hospital and HIB sides.
 */
export function createHashPayload(auditData: any): string {
  if (!auditData.audited_items) return "";

  // Sort items by name to ensure deterministic hashing regardless of order
  const sortedItems = [...auditData.audited_items].sort((a, b) => 
    (a.cleaned_version?.name || "").localeCompare(b.cleaned_version?.name || "")
  );

  const payload = sortedItems.map(item => {
    const clean = item.cleaned_version || {};
    return `${clean.name}|${item.quantity}|${clean.rate}|${clean.code}`;
  }).join(';');

  return `${auditData.patient?.health_insurance_number || ""}:${payload}`;
}
