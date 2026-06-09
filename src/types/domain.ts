export type Role = "admin" | "operator" | "viewer";

export type Profile = {
  id: string;
  company_id: string;
  tenant_id: string;
  connect_client_id?: string | null;
  role: Role;
  first_name: string;
  last_name: string;
  email: string;
};

export type NotificationItem = {
  id: string;
  user_id?: string | null;
  type: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export type Arrival = {
  id: string;
  date: string;
  status: "expected" | "arrived" | "no_show";
  notes: string | null;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
  };
  purchase_id: string | null;
};

export type Customer = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  external_ref: string | null;
};

export type PurchaseValidationResult =
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
