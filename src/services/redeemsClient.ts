import { getSelectedSiteApiToken } from "@/lib/directusAuth";

type RedeemResponse = {
  status: number;
  message: string;
  result?: Record<string, unknown>;
};

const connectBaseUrl = (process.env.EXPO_PUBLIC_ORDERS_DIRECT_BASE_URL ?? "https://connect.spotlio.com").replace(/\/$/, "");

function resolveOrderId(orderId: string): string | number {
  const numeric = Number(orderId);
  return Number.isFinite(numeric) && orderId.trim() ? numeric : orderId;
}

async function requestRedeem(path: string, body: Record<string, unknown>): Promise<RedeemResponse> {
  const apiToken = await getSelectedSiteApiToken();
  if (!apiToken) {
    throw new Error("Missing selected site API token. Please select a site before redeeming.");
  }

  const response = await fetch(`${connectBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      api_token: apiToken,
      ...body
    })
  });

  const payload = (await response.json().catch(() => null)) as RedeemResponse | null;
  if (!response.ok || !payload || payload.status >= 400) {
    throw new Error(payload?.message ?? `Redeem API error (${response.status})`);
  }

  return payload;
}

export const redeemsClient = {
  redeemOrder: (orderId: string) => requestRedeem("/console/redeems/order", { order: resolveOrderId(orderId) }),
  revokeOrder: (orderId: string) => requestRedeem("/console/redeems/order/revoke", { order: resolveOrderId(orderId) }),
  redeemProduct: (orderId: string, lineNumber: number) =>
    requestRedeem("/console/redeems/order/product", { order: resolveOrderId(orderId), line_number: lineNumber }),
  revokeProduct: (orderId: string, lineNumber: number) =>
    requestRedeem("/console/redeems/order/product/revoke", { order: resolveOrderId(orderId), line_number: lineNumber })
};
