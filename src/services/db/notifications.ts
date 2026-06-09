import type { NotificationItem } from "@/types/domain";

export async function listNotifications(_companyId: string, _userId: string): Promise<NotificationItem[]> {
  void _companyId;
  void _userId;
  return [];
}
