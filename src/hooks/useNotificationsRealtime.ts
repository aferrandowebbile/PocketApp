import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { NotificationItem } from "@/types/domain";

export function useNotificationsRealtime(params: {
  companyId?: string;
  userId?: string;
  onInsert: (notification: NotificationItem) => void;
}) {
  const { companyId, userId, onInsert } = params;

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`notifications-${userId ?? "company"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          const next = payload.new as NotificationItem;
          if (!next.user_id || next.user_id === userId) {
            onInsert(next);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => undefined);
    };
  }, [companyId, userId, onInsert]);
}
