import { useEffect } from "react";
import type { NotificationItem } from "@/types/domain";

export function useNotificationsRealtime(params: {
  companyId?: string;
  userId?: string;
  onInsert: (notification: NotificationItem) => void;
}) {
  const { companyId, userId, onInsert } = params;
  useEffect(() => {
    void companyId;
    void userId;
    void onInsert;
  }, [companyId, userId, onInsert]);
}
