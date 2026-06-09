import { getSelectedSiteApiToken } from "@/lib/directusAuth";

export type RemoteOrder = {
  id: string;
  guestName: string;
  product: string;
  quantity: number;
  productCount: number;
  totalPrice: number | null;
  currency: string | null;
  status: string;
  redemption: "none" | "partial" | "full" | "error" | null;
  date: string;
  startDate: string | null;
  raw: Record<string, unknown>;
};

export type ListOrdersParams = {
  limit: number;
  offset: number;
  sort?: string;
  statuses?: string[];
  mode?: string;
  tenantId?: string;
  redemption?: "none" | "partial" | "full" | "error";
};

export type PagingInfo = {
  total: number | null;
  start: number;
  limit: number;
};

export type OrdersPage = {
  items: RemoteOrder[];
  paging: PagingInfo;
};

export type CustomerOrdersDebugResult = {
  items: RemoteOrder[];
  payload: unknown;
};

export type OrderLookupDebugResult = {
  item: RemoteOrder | null;
  payload: unknown;
};

const ordersDirectBaseUrl = (process.env.EXPO_PUBLIC_ORDERS_DIRECT_BASE_URL ?? "https://connect.spotlio.com").replace(/\/$/, "");
const defaultSort = process.env.EXPO_PUBLIC_ORDERS_API_SORT ?? "completed_at_day:desc";
const defaultMode = process.env.EXPO_PUBLIC_ORDERS_API_MODE ?? "partial";
const ordersDebugEnabled = process.env.EXPO_PUBLIC_DEBUG_ORDERS_CALLS === "1";
const defaultStatuses = (process.env.EXPO_PUBLIC_ORDERS_API_STATUS ?? "completed,canceled")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function normalizeToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const token = value.trim();
  return token.length ? token : null;
}

async function requireApiToken(): Promise<string> {
  const apiToken = normalizeToken(await getSelectedSiteApiToken());
  if (!apiToken) {
    throw new Error("Missing selected site API token. Please select a site before loading orders.");
  }
  return apiToken;
}

function withApiToken(url: string, apiToken: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("api_token", apiToken);
  return parsed.toString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  }
  return null;
}

function collectCandidateArrays(value: unknown, depth = 0): unknown[][] {
  if (depth > 5) return [];
  if (Array.isArray(value)) {
    if (!value.length) return [];
    if (typeof value[0] === "object") return [value];
    return [];
  }

  const record = asRecord(value);
  if (!record) return [];

  const arrays: unknown[][] = [];
  for (const child of Object.values(record)) {
    if (Array.isArray(child) && child.length && typeof child[0] === "object") {
      arrays.push(child);
      continue;
    }
    arrays.push(...collectCandidateArrays(child, depth + 1));
  }
  return arrays;
}

function pickStringFromNested(record: Record<string, unknown>, paths: string[][]): string | null {
  for (const path of paths) {
    let current: unknown = record;
    for (const key of path) {
      const next = asRecord(current);
      if (!next) {
        current = null;
        break;
      }
      current = next[key];
    }
    if (typeof current === "string" && current.trim()) return current;
  }
  return null;
}

function pickNumberFromNested(record: Record<string, unknown>, paths: string[][]): number | null {
  for (const path of paths) {
    let current: unknown = record;
    for (const key of path) {
      const next = asRecord(current);
      if (!next) {
        current = null;
        break;
      }
      current = next[key];
    }
    if (typeof current === "number" && Number.isFinite(current)) return current;
    if (typeof current === "string" && current.trim() && !Number.isNaN(Number(current))) return Number(current);
  }
  return null;
}

function asIsoDate(value: unknown): string | null {
  const objectValue = asRecord(value);
  if (objectValue) {
    const day =
      pickString(objectValue, ["day", "date"]) ??
      null;
    const hour =
      pickString(objectValue, ["hour", "time"]) ??
      "00:00:00";

    if (day) {
      const normalizedHour = /^\d{2}:\d{2}$/.test(hour) ? `${hour}:00` : hour;
      const combined = `${day}T${normalizedHour}`;
      const parsedCombined = new Date(combined);
      if (!Number.isNaN(parsedCombined.getTime())) return parsedCombined.toISOString();

      const parsedDay = new Date(day);
      if (!Number.isNaN(parsedDay.getTime())) return parsedDay.toISOString();
    }
  }

  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    // Handle seconds or milliseconds epoch.
    const millis = value < 1_000_000_000_000 ? value * 1000 : value;
    const date = new Date(millis);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return null;
}

function normalizeAttrKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pickDateFromRecord(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const iso = asIsoDate(record[key]);
    if (iso) return iso;
  }
  return null;
}

function pickDateFromNested(record: Record<string, unknown>, paths: string[][]): string | null {
  for (const path of paths) {
    let current: unknown = record;
    for (const key of path) {
      const next = asRecord(current);
      if (!next) {
        current = null;
        break;
      }
      current = next[key];
    }
    const iso = asIsoDate(current);
    if (iso) return iso;
  }
  return null;
}

function pickDateFromAttributes(attributes: unknown, wantedKeys: string[]): string | null {
  if (!Array.isArray(attributes)) return null;
  const targets = new Set(wantedKeys.map((key) => normalizeAttrKey(key)));

  for (const item of attributes) {
    const row = asRecord(item);
    if (!row) continue;
    const key = normalizeAttrKey(pickString(row, ["name", "key", "label", "field"]) ?? "");
    if (!targets.has(key)) continue;

    const valueObj = asRecord(row.value);
    const direct =
      asIsoDate(row.value) ??
      asIsoDate(row.text) ??
      asIsoDate(row.answer) ??
      (valueObj ? asIsoDate(valueObj.value) : null) ??
      (valueObj ? asIsoDate(valueObj.date) : null) ??
      (valueObj ? asIsoDate(valueObj.datetime) : null) ??
      (valueObj ? asIsoDate(valueObj.completed_at) : null);

    if (direct) return direct;
  }

  return null;
}

function mapOrder(item: unknown): RemoteOrder | null {
  const row = asRecord(item);
  if (!row) return null;

  const id =
    pickString(row, ["id", "order_id", "orderId", "uuid", "reference", "external_ref", "externalRef"]) ??
    `order_${Math.random().toString(36).slice(2, 10)}`;
  const firstName =
    pickString(row, ["first_name", "firstName", "customer_first_name", "guest_first_name"]) ??
    pickStringFromNested(row, [
      ["customer", "first_name"],
      ["customer", "firstName"],
      ["guest", "first_name"],
      ["guest", "firstName"],
      ["buyer", "first_name"],
      ["buyer", "firstName"]
    ]) ??
    "";
  const lastName =
    pickString(row, ["last_name", "lastName", "customer_last_name", "guest_last_name"]) ??
    pickStringFromNested(row, [
      ["customer", "last_name"],
      ["customer", "lastName"],
      ["guest", "last_name"],
      ["guest", "lastName"],
      ["buyer", "last_name"],
      ["buyer", "lastName"]
    ]) ??
    "";
  const fallbackName = `${firstName} ${lastName}`.trim();
  const guestName =
    pickString(row, ["customer_name", "customerName", "guest_name", "guestName", "name"]) ??
    pickStringFromNested(row, [["customer", "name"], ["guest", "name"], ["buyer", "name"], ["customer", "fullName"]]) ??
    (fallbackName || "Unknown guest");
  const product =
    pickString(row, ["product_name", "productName", "product", "item_name", "ticket_name", "title"]) ??
    pickStringFromNested(row, [
      ["product", "name"],
      ["item", "name"],
      ["ticket", "name"],
      ["line_item", "name"],
      ["lineItem", "name"]
    ]) ??
    "Unknown product";
  const quantity =
    pickNumber(row, ["num_products", "numProducts"]) ??
    pickNumber(row, ["quantity", "qty", "units", "count", "total_quantity", "totalQuantity"]) ??
    pickNumberFromNested(row, [["product", "quantity"], ["line_item", "quantity"], ["lineItem", "quantity"], ["item", "quantity"]]) ??
    1;
  const lineItems = (row.line_items as unknown[]) ?? (row.lineItems as unknown[]) ?? null;
  const productCount =
    pickNumber(row, ["num_products", "numProducts"]) ??
    pickNumber(row, ["product_count", "productCount", "items_count", "itemsCount", "lines_count", "linesCount"]) ??
    (Array.isArray(lineItems) ? lineItems.length : null) ??
    quantity;
  const totalPrice =
    pickNumber(row, ["amount", "total_price", "totalPrice", "price", "total_amount", "totalAmount", "grand_total", "grandTotal"]) ??
    pickNumberFromNested(row, [
      ["order", "amount"],
      ["order", "total"],
      ["payment", "amount"],
      ["payment", "total"],
      ["totals", "amount"],
      ["totals", "total_price"],
      ["pricing", "total"],
      ["price", "amount"]
    ]);
  const currency =
    pickString(row, ["currency", "currency_code", "currencyCode"]) ??
    pickStringFromNested(row, [["payment", "currency"], ["totals", "currency"], ["pricing", "currency"], ["price", "currency"]]);
  const status = pickString(row, ["status", "state", "order_status", "orderStatus"]) ?? "unknown";
  const redemptionRaw = pickString(row, ["redemption", "redeem_status", "redeemStatus"])?.toLowerCase() ?? null;
  const redemption: RemoteOrder["redemption"] =
    redemptionRaw === "none" || redemptionRaw === "partial" || redemptionRaw === "full" || redemptionRaw === "error"
      ? redemptionRaw
      : null;
  const date =
    pickDateFromRecord(row, ["completed_at", "completedAt"]) ??
    pickDateFromAttributes(row.attributes, ["completed_at", "completedAt"]) ??
    pickDateFromRecord(row, ["completed_at_day", "completedAtDay"]) ??
    pickDateFromAttributes(row.attributes, ["completed_at_day", "completedAtDay"]) ??
    pickDateFromNested(row, [
      ["purchase", "completed_at"],
      ["purchase", "completedAt"],
      ["purchase", "completed_at_day"],
      ["purchase", "completedAtDay"]
    ]) ??
    "";
  const startDate =
    pickString(row, ["start_date", "startDate"]) ??
    pickStringFromNested(row, [["event", "start_date"], ["event", "startDate"], ["product", "start_date"], ["product", "startDate"]]);

  return { id, guestName, product, quantity, productCount, totalPrice, currency, status, redemption, date, startDate, raw: row };
}

function extractOrderArrays(value: unknown): unknown[][] {
  return collectCandidateArrays(value);
}

function extractPagingInfo(payload: unknown, fallbackOffset: number, fallbackLimit: number): PagingInfo {
  const payloadRecord = asRecord(payload);
  const paging =
    (payloadRecord ? asRecord(payloadRecord.paging) : null) ??
    (payloadRecord ? asRecord(asRecord(payloadRecord.meta)?.paging) : null) ??
    null;

  const total = paging ? pickNumber(paging, ["total", "count", "total_count", "totalCount"]) : null;
  const start = paging ? pickNumber(paging, ["start", "offset"]) ?? fallbackOffset : fallbackOffset;
  const limit = paging ? pickNumber(paging, ["limit", "page_size", "pageSize"]) ?? fallbackLimit : fallbackLimit;
  return {
    total,
    start: Math.max(0, Math.trunc(start)),
    limit: Math.max(1, Math.trunc(limit))
  };
}

export function parseOrdersResponse(payload: unknown): RemoteOrder[] {
  const candidates = extractOrderArrays(payload);
  for (const candidate of candidates) {
    const parsed = candidate.map(mapOrder).filter((row): row is RemoteOrder => Boolean(row));
    if (parsed.length > 0) {
      const deduped = new Map<string, RemoteOrder>();
      parsed.forEach((order) => deduped.set(order.id, order));
      return [...deduped.values()];
    }
  }

  // Last-resort: payload itself may be a single order object.
  const single = mapOrder(payload);
  if (single) return [single];

  return [];
}

async function requestOrders(url: string, fallbackOffset: number, fallbackLimit: number): Promise<OrdersPage> {
  const result = await requestOrdersWithPayload(url, fallbackOffset, fallbackLimit);
  return {
    items: result.items,
    paging: result.paging
  };
}

async function requestOrdersWithPayload(
  url: string,
  fallbackOffset: number,
  fallbackLimit: number,
  context = "orders"
): Promise<OrdersPage & { payload: unknown }> {
  const apiToken = await requireApiToken();
  const finalUrl = withApiToken(url, apiToken);
  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*"
  };

  const startedAt = Date.now();
  if (ordersDebugEnabled) {
    console.info(`[orders-api] request`, { context, method: "GET", url: finalUrl });
  }
  const response = await fetch(finalUrl, {
    method: "GET",
    headers
  });

  if (ordersDebugEnabled) {
    console.info(`[orders-api] response`, {
      context,
      status: response.status,
      ok: response.ok,
      elapsedMs: Date.now() - startedAt
    });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (ordersDebugEnabled) {
      console.info(`[orders-api] error-body`, {
        context,
        status: response.status,
        bodyPreview: body.slice(0, 200)
      });
    }
    throw new Error(`Orders error (${response.status})${body ? `: ${body.slice(0, 120)}` : ""}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (ordersDebugEnabled) {
    console.info(`[orders-api] payload-type`, { context, contentType });
  }
  if (typeof payload === "string") {
    const lower = payload.toLowerCase();
    if (lower.includes("<html") || lower.includes("<!doctype html")) {
      throw new Error("Orders endpoint returned HTML. You are likely not authenticated on connect.spotlio.com.");
    }
  }
  const parsed = parseOrdersResponse(payload);
  if (!parsed.length) {
    const sample =
      typeof payload === "string"
        ? payload.slice(0, 160)
        : JSON.stringify(payload).slice(0, 240);
    throw new Error(`Orders response contained no parsable items. Sample: ${sample}`);
  }
  return {
    items: parsed,
    paging: extractPagingInfo(payload, fallbackOffset, fallbackLimit),
    payload
  };
}

export async function listOrders(params: ListOrdersParams): Promise<RemoteOrder[]> {
  const page = await listOrdersPage(params);
  return page.items;
}

export async function listOrdersPage(params: ListOrdersParams): Promise<OrdersPage> {
  const query = new URLSearchParams();
  query.set("limit", String(params.limit));
  query.set("offset", String(params.offset));
  query.set("sort", params.sort ?? defaultSort);

  const statuses = params.statuses?.length ? params.statuses : defaultStatuses;
  statuses.forEach((status) => query.append("status[]", status));
  query.set("mode", params.mode ?? defaultMode);
  if (params.redemption) query.set("search[redemption]", params.redemption);

  const directUrl = `${ordersDirectBaseUrl}/console/orders?${query.toString()}`;
  return requestOrders(directUrl, params.offset, params.limit);
}

export async function listCustomerOrders(customerId: string, tenantId?: string): Promise<RemoteOrder[]> {
  const result = await listCustomerOrdersWithDebug(customerId, tenantId);
  return result.items;
}

export async function listOrdersByCustomerSearchWithDebug(
  searchCustomer: string,
  mode: "simple" | "partial" | "complete" = "partial"
): Promise<CustomerOrdersDebugResult> {
  const normalized = searchCustomer.trim();
  if (!normalized) return { items: [], payload: { result: [], paging: { total: 0, start: 0, limit: 0 } } };

  const query = new URLSearchParams();
  query.set("limit", "100");
  query.set("offset", "0");
  query.set("sort", defaultSort);
  query.set("mode", mode);
  query.append("status[]", "completed");
  query.append("status[]", "canceled");
  query.append("status[]", "canceled_refunded");
  query.set("search[customer]", normalized);

  const url = `${ordersDirectBaseUrl}/console/orders?${query.toString()}`;
  const page = await requestOrdersWithPayload(url, 0, 100, "listOrdersByCustomerSearchWithDebug");
  return { items: page.items, payload: page.payload };
}

export async function listCustomerOrdersWithDebug(customerId: string, tenantId?: string): Promise<CustomerOrdersDebugResult> {
  const safeCustomerId = encodeURIComponent(customerId);
  const fallbackQuery = new URLSearchParams();
  fallbackQuery.set("mode", "complete");
  const fallbackUrl = `${ordersDirectBaseUrl}/console/customers/${safeCustomerId}/orders?${fallbackQuery.toString()}`;
  try {
    const page = await requestOrdersWithPayload(fallbackUrl, 0, 50, "listCustomerOrdersWithDebug");
    return { items: page.items, payload: page.payload };
  } catch {
    // Secondary fallback via generic orders search when customer endpoint is unavailable.
    const query = new URLSearchParams();
    query.set("limit", "100");
    query.set("offset", "0");
    query.set("sort", defaultSort);
    query.set("mode", "complete");
    defaultStatuses.forEach((status) => query.append("status[]", status));
    query.set("search[customer]", customerId);
    const url = `${ordersDirectBaseUrl}/console/orders?${query.toString()}`;
    const page = await requestOrdersWithPayload(url, 0, 100, "listCustomerOrdersWithDebug-fallback");
    return { items: page.items, payload: page.payload };
  }
}

export async function getOrderById(orderId: string, tenantId?: string): Promise<RemoteOrder | null> {
  const result = await getOrderByIdWithDebug(orderId, tenantId);
  return result.item;
}

export async function getOrderByIdWithDebug(orderId: string, tenantId?: string): Promise<OrderLookupDebugResult> {
  const query = new URLSearchParams();
  query.set("limit", "1");
  query.set("offset", "0");
  query.set("sort", defaultSort);
  query.set("mode", "complete");
  defaultStatuses.forEach((status) => query.append("status[]", status));
  query.set("search[id]", orderId);

  const url = `${ordersDirectBaseUrl}/console/orders?${query.toString()}`;
  const page = await requestOrdersWithPayload(url, 0, 1, "getOrderByIdWithDebug");
  return { item: page.items[0] ?? null, payload: page.payload };
}

export async function getOrderByIdMinimal(orderId: string, tenantId?: string): Promise<RemoteOrder | null> {
  const result = await getOrderByIdMinimalWithDebug(orderId, tenantId);
  return result.item;
}

export async function getOrderByIdMinimalWithDebug(orderId: string, tenantId?: string): Promise<OrderLookupDebugResult> {
  const query = new URLSearchParams();
  query.set("mode", "complete");
  query.set("search[id]", orderId);

  const url = `${ordersDirectBaseUrl}/console/orders?${query.toString()}`;
  const page = await requestOrdersWithPayload(url, 0, 1, "getOrderByIdMinimalWithDebug");
  return { item: page.items[0] ?? null, payload: page.payload };
}
