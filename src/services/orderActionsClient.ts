type ActionResult = {
  success: boolean;
  message?: string;
};

const baseUrl = process.env.EXPO_PUBLIC_ORDER_ACTIONS_API_BASE_URL;

async function request(path: string, body: Record<string, unknown>): Promise<ActionResult> {
  if (!baseUrl) {
    throw new Error("Order actions API is not configured yet (missing EXPO_PUBLIC_ORDER_ACTIONS_API_BASE_URL).");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new Error(`Order actions API error (${response.status})${payload ? `: ${payload.slice(0, 140)}` : ""}`);
  }

  return (await response.json()) as ActionResult;
}

export const orderActionsClient = {
  validateOrder: (orderId: string) => request(`/orders/${orderId}/validate`, { orderId }),
  refundOrder: (orderId: string) => request(`/orders/${orderId}/refund`, { orderId }),
  validateOrderItem: (orderId: string, payload: { itemIndex: number; itemName: string }) =>
    request(`/orders/${orderId}/items/validate`, { orderId, ...payload }),
  refundOrderItem: (orderId: string, payload: { itemIndex: number; itemName: string }) =>
    request(`/orders/${orderId}/items/refund`, { orderId, ...payload })
};
