import { supabase } from "@/lib/supabase";
import type { NotificationItem } from "@/types/domain";

type NotificationRow = {
  id: string;
  user_id: string | null;
  type: string;
  title: string;
  body: string;
  ticket_id: string | null;
  created_at: string;
  read_at: string | null;
};

export async function listNotifications(companyId: string, userId: string): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id,type,title,body,ticket_id,created_at,read_at,user_id")
    .eq("company_id", companyId)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return ((data ?? []) as NotificationRow[]).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    ticket_id: row.ticket_id,
    created_at: row.created_at,
    read_at: row.read_at
  }));
}
