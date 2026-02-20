import { supabaseClient } from "@/config/supabaseClient";

export type GuestNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

const fallbackNotifications: GuestNotification[] = [];

export async function getNotifications(tenantId: string): Promise<GuestNotification[]> {
  if (!supabaseClient) return fallbackNotifications;

  const { data, error } = await supabaseClient
    .from("notifications")
    .select("id, title, body, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return fallbackNotifications;
  return (data as GuestNotification[]) ?? fallbackNotifications;
}
