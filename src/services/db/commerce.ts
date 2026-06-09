import type { Arrival, Customer } from "@/types/domain";

export type CustomerPurchaseLine = {
  id: string;
  status: "valid" | "refunded" | "void";
  purchased_at: string;
  product_name: string;
};

export type CustomerDetails = {
  customer: Customer;
  purchases: CustomerPurchaseLine[];
};

export type PurchaseSummary = {
  id: string;
  status: "valid" | "refunded" | "void";
  purchased_at: string;
  customer_name: string;
  product_name: string;
};

export type PurchaseTokenLookup =
  | { status: "invalid_code" }
  | { status: "not_valid"; reason: string }
  | { status: "already_validated"; reason: string }
  | {
      status: "success";
      purchase: {
        id: string;
        status: "valid" | "refunded" | "void";
        purchased_at: string;
      };
      customer: Customer;
      product: {
        id: string;
        name: string;
        sku: string | null;
      };
      validated_at: string;
    };

export async function listArrivalsToday(_companyId: string, dateIso: string): Promise<Arrival[]> {
  return [
    {
      id: "mock-arrival-1",
      date: dateIso,
      status: "expected",
      notes: null,
      purchase_id: "mock-purchase-1",
      customer: {
        id: "mock-customer-1",
        first_name: "Demo",
        last_name: "Guest"
      }
    }
  ];
}

export async function markArrivalArrived(_params: {
  arrivalId: string;
  companyId: string;
  userId: string;
  purchaseId: string | null;
}): Promise<void> {
  void _params;
  return;
}

export async function searchCustomers(_companyId: string, query: string): Promise<Customer[]> {
  const normalized = query.trim();
  if (!normalized) return [];
  return [
    {
      id: "mock-customer-1",
      first_name: "Demo",
      last_name: "Guest",
      email: "demo@spotlio.com",
      phone: "+34999999999",
      external_ref: "MOCK-1"
    }
  ];
}

export async function getCustomerDetails(_companyId: string, customerId: string): Promise<CustomerDetails> {
  return {
    customer: {
      id: customerId,
      first_name: "Demo",
      last_name: "Guest",
      email: "demo@spotlio.com",
      phone: "+34999999999",
      external_ref: "MOCK-1"
    },
    purchases: [
      {
        id: "mock-purchase-1",
        status: "valid",
        purchased_at: new Date().toISOString(),
        product_name: "Day Pass"
      }
    ]
  };
}

export async function getPurchaseSummary(_companyId: string, purchaseId: string): Promise<PurchaseSummary> {
  return {
    id: purchaseId,
    status: "valid",
    purchased_at: new Date().toISOString(),
    customer_name: "Demo Guest",
    product_name: "Day Pass"
  };
}

export async function validatePurchaseTokenInDb(params: {
  token: string;
  companyId: string;
  userId: string;
  deviceId?: string;
  location?: string;
}): Promise<PurchaseTokenLookup> {
  void params.companyId;
  void params.userId;
  void params.deviceId;
  void params.location;
  if (!params.token.trim()) return { status: "invalid_code" };
  return {
    status: "not_valid",
    reason: "Supabase validation removed. Pending Directus validation endpoint integration."
  };
}
