import { validatePurchaseTokenInDb } from "@/services/db/commerce";
import type { PurchaseValidationResult } from "@/types/domain";

export async function validatePurchaseToken(params: {
  token: string;
  companyId: string;
  userId: string;
  deviceId?: string;
  location?: string;
}): Promise<PurchaseValidationResult> {
  return validatePurchaseTokenInDb(params);
}
