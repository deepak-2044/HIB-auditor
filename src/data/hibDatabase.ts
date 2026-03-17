import { MEDICINES_DB } from './hibMedicines';
import { SERVICES_DB } from './hibServices';
import { BRAND_TO_GENERIC, ALIASES } from './hibAliases';

export { MEDICINES_DB, SERVICES_DB, BRAND_TO_GENERIC, ALIASES };

export const FULL_DB = {
  ...MEDICINES_DB,
  ...SERVICES_DB
};
