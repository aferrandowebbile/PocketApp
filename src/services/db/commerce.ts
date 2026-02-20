import { supabase } from "@/lib/supabase";
import { canCreateValidation } from "@/lib/validation";
import type { Arrival, Customer } from "@/types/domain";

const cooldownMinutes = Number(process.env.EXPO_PUBLIC_VALIDATION_COOLDOWN_MINUTES ?? "5");

type CustomerRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  external_ref: string | null;
};

type PurchaseRow = {
  id: string;
  status: "valid" | "refunded" | "void";
  purchased_at: string;
  product_id: string;
};

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

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    external_ref: row.external_ref
  };
}

export async function listArrivalsToday(companyId: string, dateIso: string): Promise<Arrival[]> {
  const { data, error } = await supabase
    .from("arrivals")
    .select("id,date,status,notes,purchase_id,customer:customers(id,first_name,last_name)")
    .eq("company_id", companyId)
    .eq("date", dateIso)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const customerRaw = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    const customer = customerRaw as Record<string, unknown>;

    return {
      id: String(row.id),
      date: String(row.date),
      status: row.status as Arrival["status"],
      notes: (row.notes as string | null) ?? null,
      purchase_id: (row.purchase_id as string | null) ?? null,
      customer: {
        id: String(customer.id ?? ""),
        first_name: String(customer.first_name ?? ""),
        last_name: String(customer.last_name ?? "")
      }
    };
  });
}

export async function markArrivalArrived(params: {
  arrivalId: string;
  companyId: string;
  userId: string;
  purchaseId: string | null;
}): Promise<void> {
  const { error: updateError } = await supabase.from("arrivals").update({ status: "arrived" }).eq("id", params.arrivalId);
  if (updateError) throw updateError;

  if (params.purchaseId) {
    const { error: validationError } = await supabase.from("validations").insert({
      company_id: params.companyId,
      purchase_id: params.purchaseId,
      validated_by: params.userId,
      validated_at: new Date().toISOString(),
      location: "arrivals-screen"
    });
    if (validationError) throw validationError;
  }
}

export async function searchCustomers(companyId: string, query: string): Promise<Customer[]> {
  const normalized = query.trim();
  if (!normalized) return [];

  const { data, error } = await supabase
    .from("customers")
    .select("id,first_name,last_name,email,phone,external_ref")
    .eq("company_id", companyId)
    .or(
      `first_name.ilike.%${normalized}%,last_name.ilike.%${normalized}%,email.ilike.%${normalized}%,phone.ilike.%${normalized}%,external_ref.ilike.%${normalized}%`
    )
    .limit(30);

  if (error) throw error;
  return ((data ?? []) as CustomerRow[]).map(mapCustomer);
}

export async function getCustomerDetails(companyId: string, customerId: string): Promise<CustomerDetails> {
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id,first_name,last_name,email,phone,external_ref")
    .eq("company_id", companyId)
    .eq("id", customerId)
    .single();

  if (customerError) throw customerError;

  const { data: purchases, error: purchasesError } = await supabase
    .from("purchases")
    .select("id,status,purchased_at,product_id")
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .order("purchased_at", { ascending: false })
    .limit(5);

  if (purchasesError) throw purchasesError;

  const productIds = ((purchases ?? []) as PurchaseRow[]).map((p) => p.product_id);
  let productMap = new Map<string, string>();

  if (productIds.length) {
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id,name")
      .eq("company_id", companyId)
      .in("id", productIds);

    if (productsError) throw productsError;
    productMap = new Map((products ?? []).map((p) => [p.id, p.name]));
  }

  return {
    customer: mapCustomer(customer as CustomerRow),
    purchases: ((purchases ?? []) as PurchaseRow[]).map((purchase) => ({
      id: purchase.id,
      status: purchase.status,
      purchased_at: purchase.purchased_at,
      product_name: productMap.get(purchase.product_id) ?? "Product"
    }))
  };
}

export async function getPurchaseSummary(companyId: string, purchaseId: string): Promise<PurchaseSummary> {
  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .select("id,status,purchased_at,customer_id,product_id")
    .eq("company_id", companyId)
    .eq("id", purchaseId)
    .single();

  if (purchaseError) throw purchaseError;

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("first_name,last_name")
    .eq("company_id", companyId)
    .eq("id", purchase.customer_id)
    .single();

  if (customerError) throw customerError;

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("name")
    .eq("company_id", companyId)
    .eq("id", purchase.product_id)
    .single();

  if (productError) throw productError;

  return {
    id: purchase.id,
    status: purchase.status,
    purchased_at: purchase.purchased_at,
    customer_name: `${customer.first_name} ${customer.last_name}`,
    product_name: product.name
  };
}

export async function validatePurchaseTokenInDb(params: {
  token: string;
  companyId: string;
  userId: string;
  deviceId?: string;
  location?: string;
}): Promise<PurchaseTokenLookup> {
  const { data: tokenData } = await supabase
    .from("purchase_tokens")
    .select("purchase_id,expires_at")
    .eq("company_id", params.companyId)
    .eq("token", params.token)
    .maybeSingle();

  if (!tokenData) return { status: "invalid_code" };

  if (tokenData.expires_at && new Date(tokenData.expires_at).getTime() < Date.now()) {
    return { status: "not_valid", reason: "Token expired" };
  }

  const { data: purchaseData } = await supabase
    .from("purchases")
    .select("id,status,purchased_at,customer_id,product_id")
    .eq("company_id", params.companyId)
    .eq("id", tokenData.purchase_id)
    .maybeSingle();

  if (!purchaseData) return { status: "invalid_code" };

  if (purchaseData.status !== "valid") {
    return { status: "not_valid", reason: `Purchase is ${purchaseData.status}` };
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id,first_name,last_name,email,phone,external_ref")
    .eq("company_id", params.companyId)
    .eq("id", purchaseData.customer_id)
    .single();

  const { data: product } = await supabase
    .from("products")
    .select("id,name,sku")
    .eq("company_id", params.companyId)
    .eq("id", purchaseData.product_id)
    .single();

  if (!customer || !product) return { status: "invalid_code" };

  const { data: lastValidation } = await supabase
    .from("validations")
    .select("validated_at")
    .eq("company_id", params.companyId)
    .eq("purchase_id", purchaseData.id)
    .order("validated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!canCreateValidation(lastValidation?.validated_at ?? null, new Date(), cooldownMinutes)) {
    return {
      status: "already_validated",
      reason: `Already validated in the last ${cooldownMinutes} minute(s)`
    };
  }

  const validatedAt = new Date().toISOString();
  const { error } = await supabase.from("validations").insert({
    company_id: params.companyId,
    purchase_id: purchaseData.id,
    validated_by: params.userId,
    validated_at: validatedAt,
    device_id: params.deviceId ?? null,
    location: params.location ?? null
  });

  if (error) throw error;

  return {
    status: "success",
    purchase: {
      id: purchaseData.id,
      status: purchaseData.status,
      purchased_at: purchaseData.purchased_at
    },
    customer: mapCustomer(customer as CustomerRow),
    product,
    validated_at: validatedAt
  };
}
