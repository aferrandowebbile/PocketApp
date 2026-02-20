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
          role: "admin" | "operator" | "viewer";
          first_name: string;
          last_name: string;
          email: string;
          created_at: string;
        },
        {
          id: string;
          company_id: string;
          role?: "admin" | "operator" | "viewer";
          first_name: string;
          last_name: string;
          email: string;
          created_at?: string;
        },
        {
          id?: string;
          company_id?: string;
          role?: "admin" | "operator" | "viewer";
          first_name?: string;
          last_name?: string;
          email?: string;
          created_at?: string;
        }
      >;
      tickets: TableDef<
        {
          id: string;
          company_id: string;
          subject: string;
          status: string;
          priority: string | null;
          assignee_user_id: string | null;
          updated_at: string;
          created_at: string;
        },
        {
          id: string;
          company_id: string;
          subject: string;
          status: string;
          priority?: string | null;
          assignee_user_id?: string | null;
          updated_at?: string;
          created_at?: string;
        },
        {
          id?: string;
          company_id?: string;
          subject?: string;
          status?: string;
          priority?: string | null;
          assignee_user_id?: string | null;
          updated_at?: string;
          created_at?: string;
        }
      >;
      ticket_messages: TableDef<
        {
          id: string;
          ticket_id: string;
          company_id: string;
          created_at: string;
          direction: "customer" | "spotlio";
          type: "text" | "audio";
          body_text: string | null;
          audio_storage_path: string | null;
          audio_duration_ms: number | null;
        },
        {
          id?: string;
          ticket_id: string;
          company_id: string;
          created_at?: string;
          direction: "customer" | "spotlio";
          type: "text" | "audio";
          body_text?: string | null;
          audio_storage_path?: string | null;
          audio_duration_ms?: number | null;
        },
        {
          id?: string;
          ticket_id?: string;
          company_id?: string;
          created_at?: string;
          direction?: "customer" | "spotlio";
          type?: "text" | "audio";
          body_text?: string | null;
          audio_storage_path?: string | null;
          audio_duration_ms?: number | null;
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
          ticket_id: string | null;
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
          ticket_id?: string | null;
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
          ticket_id?: string | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_role: "admin" | "operator" | "viewer";
      purchase_status: "valid" | "refunded" | "void";
      arrival_status: "expected" | "arrived" | "no_show";
      ticket_direction: "customer" | "spotlio";
      ticket_message_type: "text" | "audio";
    };
    CompositeTypes: Record<string, never>;
  };
}
