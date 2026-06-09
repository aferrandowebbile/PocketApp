import { getSelectedSiteApiToken } from "@/lib/directusAuth";

export type RemoteGuest = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  externalRef: string | null;
  createdAt: string | null;
  completedAt: string | null;
  raw: Record<string, unknown>;
};

export type ListGuestsParams = {
  limit: number;
  offset: number;
  sort?: string;
  searchCustomer?: string;
  tenantId?: string;
};

export type GuestsPagingInfo = {
  total: number | null;
  start: number;
  limit: number;
};

export type GuestsPage = {
  items: RemoteGuest[];
  paging: GuestsPagingInfo;
};

const guestsDirectBaseUrl = (process.env.EXPO_PUBLIC_ORDERS_DIRECT_BASE_URL ?? "https://connect.spotlio.com").replace(/\/$/, "");
const defaultSort = process.env.EXPO_PUBLIC_GUESTS_API_SORT ?? "completed_at_day:desc";

function resolveTenantId(tenantId?: string | null): string {
  const explicit = tenantId?.trim();
  if (explicit && explicit.length > 0) return explicit;
  throw new Error("Missing selected site alias. Please select a site in Profile before loading guests.");
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

function asIsoDate(value: unknown): string | null {
  const objectValue = asRecord(value);
  if (objectValue) {
    const day = pickString(objectValue, ["day", "date"]) ?? null;
    const hour = pickString(objectValue, ["hour", "time"]) ?? "00:00:00";
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
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value < 1_000_000_000_000 ? value * 1000 : value;
    const parsed = new Date(millis);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
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

function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  }
  return null;
}

function extractPagingInfo(payload: unknown, fallbackOffset: number, fallbackLimit: number): GuestsPagingInfo {
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

function mapGuest(value: unknown): RemoteGuest | null {
  const row = asRecord(value);
  if (!row) return null;

  const id =
    pickString(row, ["id", "customer_id", "customerId", "uuid", "reference", "external_ref", "externalRef"]) ??
    `guest_${Math.random().toString(36).slice(2, 10)}`;
  const firstName =
    pickString(row, ["first_name", "firstName"]) ??
    pickStringFromNested(row, [["customer", "first_name"], ["customer", "firstName"], ["profile", "first_name"]]);
  const lastName =
    pickString(row, ["last_name", "lastName"]) ??
    pickStringFromNested(row, [["customer", "last_name"], ["customer", "lastName"], ["profile", "last_name"]]);
  const fallbackFullName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  const fullName =
    pickString(row, ["name", "full_name", "fullName", "customer_name", "customerName"]) ??
    pickStringFromNested(row, [["customer", "name"], ["customer", "full_name"], ["profile", "name"]]) ??
    (fallbackFullName || "Unknown guest");
  const email =
    pickString(row, ["email", "mail"]) ??
    pickStringFromNested(row, [["customer", "email"], ["profile", "email"], ["contact", "email"]]);
  const phone =
    pickString(row, ["phone", "mobile", "phone_number", "phoneNumber"]) ??
    pickStringFromNested(row, [["customer", "phone"], ["profile", "phone"], ["contact", "phone"]]);
  const externalRef =
    pickString(row, ["external_ref", "externalRef", "reference", "ref"]) ??
    pickStringFromNested(row, [["customer", "external_ref"], ["customer", "externalRef"]]);
  const createdAt =
    asIsoDate(row.created_at) ??
    asIsoDate(row.createdAt) ??
    asIsoDate(row.inserted_at) ??
    asIsoDate(row.date);
  const completedAt =
    asIsoDate(row.completed_at) ??
    asIsoDate(row.completedAt) ??
    asIsoDate(row.completed_at_day) ??
    asIsoDate(asRecord(row.completed_at_day) ?? null) ??
    asIsoDate(row.updated_at) ??
    asIsoDate(row.updatedAt);

  return { id, firstName, lastName, fullName, email, phone, externalRef, createdAt, completedAt, raw: row };
}

export function parseGuestsResponse(payload: unknown): RemoteGuest[] {
  const candidates = collectCandidateArrays(payload);
  for (const candidate of candidates) {
    const parsed = candidate.map(mapGuest).filter((row): row is RemoteGuest => Boolean(row));
    if (parsed.length > 0) {
      const deduped = new Map<string, RemoteGuest>();
      parsed.forEach((guest) => deduped.set(guest.id, guest));
      return [...deduped.values()];
    }
  }
  const single = mapGuest(payload);
  if (single) return [single];
  return [];
}

async function requestGuests(url: string, fallbackOffset: number, fallbackLimit: number): Promise<GuestsPage> {
  const apiToken = await getSelectedSiteApiToken();
  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*"
  };
  if (apiToken) {
    headers.Authorization = `Bearer ${apiToken}`;
    headers["X-API-Key"] = apiToken;
  }

  const response = await fetch(url, {
    method: "GET",
    headers
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Guests error (${response.status})${body ? `: ${body.slice(0, 120)}` : ""}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (typeof payload === "string") {
    const lower = payload.toLowerCase();
    if (lower.includes("<html") || lower.includes("<!doctype html")) {
      throw new Error("Guests endpoint returned HTML. You are likely not authenticated on connect.spotlio.com.");
    }
  }

  const parsed = parseGuestsResponse(payload);
  if (!parsed.length) {
    const sample = typeof payload === "string" ? payload.slice(0, 160) : JSON.stringify(payload).slice(0, 240);
    throw new Error(`Guests response contained no parsable items. Sample: ${sample}`);
  }
  return {
    items: parsed,
    paging: extractPagingInfo(payload, fallbackOffset, fallbackLimit)
  };
}

export async function listGuests(params: ListGuestsParams): Promise<RemoteGuest[]> {
  const page = await listGuestsPage(params);
  return page.items;
}

export async function listGuestsPage(params: ListGuestsParams): Promise<GuestsPage> {
  const query = new URLSearchParams();
  query.set("client", resolveTenantId(params.tenantId));
  query.set("limit", String(params.limit));
  query.set("offset", String(params.offset));
  query.set("sort", params.sort ?? defaultSort);
  if (params.searchCustomer?.trim()) {
    query.set("search[customer]", params.searchCustomer.trim());
  }
  const url = `${guestsDirectBaseUrl}/console/customers?${query.toString()}`;
  return requestGuests(url, params.offset, params.limit);
}
