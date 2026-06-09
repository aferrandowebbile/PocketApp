export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type TableDef<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<
        {
          id: string;
          company_id: string;
          tenant_id: string;
          role: "admin" | "operator" | "viewer";
          first_name: string;
          last_name: string;
          email: string;
          created_at: string;
        },
        {
          id: string;
          company_id: string;
          tenant_id: string;
          role?: "admin" | "operator" | "viewer";
          first_name: string;
          last_name: string;
          email: string;
          created_at?: string;
        },
        {
          id?: string;
          company_id?: string;
          tenant_id?: string;
          role?: "admin" | "operator" | "viewer";
          first_name?: string;
          last_name?: string;
          email?: string;
          created_at?: string;
        }
      >;
      tenant_client_mappings: TableDef<
        {
          tenant_id: string;
          connect_client_id: string;
          created_at: string;
          updated_at: string;
        },
        {
          tenant_id: string;
          connect_client_id: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          tenant_id?: string;
          connect_client_id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      notifications: TableDef<
        {
          id: string;
          company_id: string;
          user_id: string | null;
          type: string;
          title: string;
          body: string;
          created_at: string;
          read_at: string | null;
        },
        {
          id?: string;
          company_id: string;
          user_id?: string | null;
          type: string;
          title: string;
          body: string;
          created_at?: string;
          read_at?: string | null;
        },
        {
          id?: string;
          company_id?: string;
          user_id?: string | null;
          type?: string;
          title?: string;
          body?: string;
          created_at?: string;
          read_at?: string | null;
        }
      >;
      customers: TableDef<
        {
          id: string;
          company_id: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          external_ref: string | null;
          created_at: string;
        },
        {
          id?: string;
          company_id: string;
          first_name: string;
          last_name: string;
          email?: string | null;
          phone?: string | null;
          external_ref?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          company_id?: string;
          first_name?: string;
          last_name?: string;
          email?: string | null;
          phone?: string | null;
          external_ref?: string | null;
          created_at?: string;
        }
      >;
      products: TableDef<
        {
          id: string;
          company_id: string;
          name: string;
          sku: string | null;
          created_at: string;
        },
        {
          id?: string;
          company_id: string;
          name: string;
          sku?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          company_id?: string;
          name?: string;
          sku?: string | null;
          created_at?: string;
        }
      >;
      purchases: TableDef<
        {
          id: string;
          company_id: string;
          customer_id: string;
          product_id: string;
          status: "valid" | "refunded" | "void";
          purchased_at: string;
          external_ref: string | null;
        },
        {
          id?: string;
          company_id: string;
          customer_id: string;
          product_id: string;
          status: "valid" | "refunded" | "void";
          purchased_at: string;
          external_ref?: string | null;
        },
        {
          id?: string;
          company_id?: string;
          customer_id?: string;
          product_id?: string;
          status?: "valid" | "refunded" | "void";
          purchased_at?: string;
          external_ref?: string | null;
        }
      >;
      purchase_tokens: TableDef<
        {
          id: string;
          company_id: string;
          purchase_id: string;
          token: string;
          created_at: string;
          expires_at: string | null;
        },
        {
          id?: string;
          company_id: string;
          purchase_id: string;
          token: string;
          created_at?: string;
          expires_at?: string | null;
        },
        {
          id?: string;
          company_id?: string;
          purchase_id?: string;
          token?: string;
          created_at?: string;
          expires_at?: string | null;
        }
      >;
      validations: TableDef<
        {
          id: string;
          company_id: string;
          purchase_id: string;
          validated_by: string;
          validated_at: string;
          location: string | null;
          device_id: string | null;
        },
        {
          id?: string;
          company_id: string;
          purchase_id: string;
          validated_by: string;
          validated_at?: string;
          location?: string | null;
          device_id?: string | null;
        },
        {
          id?: string;
          company_id?: string;
          purchase_id?: string;
          validated_by?: string;
          validated_at?: string;
          location?: string | null;
          device_id?: string | null;
        }
      >;
      arrivals: TableDef<
        {
          id: string;
          company_id: string;
          date: string;
          customer_id: string;
          purchase_id: string | null;
          status: "expected" | "arrived" | "no_show";
          notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          company_id: string;
          date: string;
          customer_id: string;
          purchase_id?: string | null;
          status?: "expected" | "arrived" | "no_show";
          notes?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          company_id?: string;
          date?: string;
          customer_id?: string;
          purchase_id?: string | null;
          status?: "expected" | "arrived" | "no_show";
          notes?: string | null;
          created_at?: string;
        }
      >;
      operator_dashboard_snapshots: TableDef<
        {
          id: string;
          company_id: string;
          snapshot_date: string;
          status: "on_track" | "at_risk";
          arrivals_expected: number;
          arrivals_arrived: number;
          arrivals_no_show: number;
          pending_checkins_2h: number;
          checkins_last_60m: number;
          validation_success_rate: number;
          invalid_scans: number;
          rejected_scans: number;
          top_product_name: string | null;
          top_product_count: number;
          open_incidents: number;
          staff_load_hint: string | null;
          checkins_by_hour: Json;
          invalid_scans_by_hour: Json;
          no_show_by_hour: Json;
          updated_at: string;
        },
        {
          id?: string;
          company_id: string;
          snapshot_date: string;
          status?: "on_track" | "at_risk";
          arrivals_expected?: number;
          arrivals_arrived?: number;
          arrivals_no_show?: number;
          pending_checkins_2h?: number;
          checkins_last_60m?: number;
          validation_success_rate?: number;
          invalid_scans?: number;
          rejected_scans?: number;
          top_product_name?: string | null;
          top_product_count?: number;
          open_incidents?: number;
          staff_load_hint?: string | null;
          checkins_by_hour?: Json;
          invalid_scans_by_hour?: Json;
          no_show_by_hour?: Json;
          updated_at?: string;
        },
        {
          id?: string;
          company_id?: string;
          snapshot_date?: string;
          status?: "on_track" | "at_risk";
          arrivals_expected?: number;
          arrivals_arrived?: number;
          arrivals_no_show?: number;
          pending_checkins_2h?: number;
          checkins_last_60m?: number;
          validation_success_rate?: number;
          invalid_scans?: number;
          rejected_scans?: number;
          top_product_name?: string | null;
          top_product_count?: number;
          open_incidents?: number;
          staff_load_hint?: string | null;
          checkins_by_hour?: Json;
          invalid_scans_by_hour?: Json;
          no_show_by_hour?: Json;
          updated_at?: string;
        }
      >;
      operator_dashboard_alerts: TableDef<
        {
          id: string;
          company_id: string;
          snapshot_date: string;
          severity: "info" | "warning" | "critical";
          title: string;
          body: string;
          event_time: string;
          action_label: string | null;
          action_route: string | null;
          created_at: string;
        },
        {
          id?: string;
          company_id: string;
          snapshot_date: string;
          severity?: "info" | "warning" | "critical";
          title: string;
          body: string;
          event_time?: string;
          action_label?: string | null;
          action_route?: string | null;
          created_at?: string;
        },
        {
          id?: string;
          company_id?: string;
          snapshot_date?: string;
          severity?: "info" | "warning" | "critical";
          title?: string;
          body?: string;
          event_time?: string;
          action_label?: string | null;
          action_route?: string | null;
          created_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_role: "admin" | "operator" | "viewer";
      purchase_status: "valid" | "refunded" | "void";
      arrival_status: "expected" | "arrived" | "no_show";
    };
    CompositeTypes: Record<string, never>;
  };
}
