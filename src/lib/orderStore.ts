import type { RemoteOrder } from "@/services/ordersClient";

const ordersMap = new Map<string, RemoteOrder>();

export function cacheOrder(order: RemoteOrder): void {
  ordersMap.set(order.id, order);
}

export function getCachedOrder(orderId: string): RemoteOrder | null {
  return ordersMap.get(orderId) ?? null;
}
