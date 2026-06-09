import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Profile, Role } from "@/types/domain";

const directusBaseUrl = (process.env.EXPO_PUBLIC_DIRECTUS_BASE_URL ?? "https://suite-console.spotliowebsites.com").replace(/\/$/, "");
const tenantIdDefault = process.env.EXPO_PUBLIC_TENANT_ID ?? "1";

const SESSION_KEY = "directus_auth_session_v1";
const meFields = encodeURIComponent("*,sites.*,sites.site_id.*");

export type DirectusSession = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  selectedSiteAlias: string | null;
  selectedSiteApiToken: string | null;
  user: {
    id: string;
    email: string;
    created_at: string | null;
    user_metadata?: Record<string, unknown>;
  };
};

export type DirectusSite = {
  id: string;
  name: string;
  alias: string;
  apiToken: string | null;
  iconUrl: string | null;
};

type DirectusAuthResponse = {
  data?: {
    access_token?: string;
    refresh_token?: string;
    expires?: number;
    expires_at?: string;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function toRole(value: string | null): Role {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "admin" || normalized === "operator" || normalized === "viewer") return normalized;
  return "operator";
}

function pickString(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function resolveAssetUrl(value: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${directusBaseUrl}/assets/${value}`;
}

function extractSites(payload: unknown): DirectusSite[] {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? root;
  const rawSites = Array.isArray(data?.sites) ? data.sites : [];
  const result: DirectusSite[] = [];

  rawSites.forEach((entry, index) => {
    const row = asRecord(entry);
    const site = asRecord(row?.site_id) ?? row;
    const name = pickString(site, ["name", "title"]) ?? `Site ${index + 1}`;
    const alias =
      pickString(site, ["alias", "client", "client_id", "site_alias", "slug", "code"]) ??
      pickString(row, ["alias", "client", "client_id", "site_alias", "slug", "code"]) ??
      null;
    const apiToken =
      pickString(site, ["api_token", "apiToken", "token"]) ??
      pickString(row, ["api_token", "apiToken", "token"]) ??
      null;
    const iconAsset =
      pickString(site, ["logo", "icon", "favicon"]) ??
      pickString(row, ["logo", "icon", "favicon"]) ??
      null;
    const id = pickString(site, ["id"]) ?? pickString(row, ["id"]) ?? `${index + 1}`;

    const resolvedAlias = alias ?? name.toLowerCase().replace(/\s+/g, "-");
    result.push({ id, name, alias: resolvedAlias, apiToken, iconUrl: resolveAssetUrl(iconAsset) });
  });

  return result;
}

function buildProfileFromMe(payload: unknown, fallbackEmail: string): Profile {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? root;
  const roleRecord = asRecord(data?.role);
  const roleName = asString(roleRecord?.name) ?? asString(data?.role);
  const id = asString(data?.id) ?? fallbackEmail;

  return {
    id,
    company_id: asString(data?.company_id) ?? "spotlio",
    tenant_id: asString(data?.tenant_id) ?? tenantIdDefault,
    connect_client_id: asString(data?.connect_client_id),
    role: toRole(roleName),
    first_name: asString(data?.first_name) ?? "Spotlio",
    last_name: asString(data?.last_name) ?? "Operator",
    email: asString(data?.email) ?? fallbackEmail
  };
}

function buildFallbackProfile(email: string): Profile {
  return {
    id: email,
    company_id: "spotlio",
    tenant_id: tenantIdDefault,
    connect_client_id: null,
    role: "operator",
    first_name: "Spotlio",
    last_name: "Operator",
    email
  };
}

export const isDirectusConfigured = Boolean(directusBaseUrl);
export const directusConfigError = isDirectusConfigured ? null : "Missing EXPO_PUBLIC_DIRECTUS_BASE_URL";

function applySelectedSite(profile: Profile, site: DirectusSite | null): Profile {
  if (!site) return profile;
  return {
    ...profile,
    connect_client_id: site.alias
  };
}

function resolveSelectedSite(sites: DirectusSite[], selectedSiteAlias: string | null | undefined): DirectusSite | null {
  if (selectedSiteAlias) {
    return sites.find((site) => site.alias === selectedSiteAlias) ?? null;
  }
  return sites.length === 1 ? sites[0] : null;
}

export async function signInDirectus(email: string, password: string): Promise<{
  session: DirectusSession;
  profile: Profile;
  sites: DirectusSite[];
}> {
  const restored = await restoreDirectusSession();
  const previousSiteAlias = restored?.session.selectedSiteAlias ?? null;
  await AsyncStorage.removeItem(SESSION_KEY);
  const response = await fetch(`${directusBaseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      email,
      password,
      mode: "json"
    })
  });

  const payload = (await response.json().catch(() => ({}))) as DirectusAuthResponse;
  if (!response.ok) {
    const message = asString(asRecord(payload)?.errors) ?? `Login failed (${response.status})`;
    throw new Error(message);
  }

  const data = payload.data ?? {};
  const accessToken = asString(data.access_token);
  if (!accessToken) throw new Error("Directus login did not return an access token.");

  const refreshToken = asString(data.refresh_token);
  const expiresSeconds = typeof data.expires === "number" && Number.isFinite(data.expires) ? data.expires : null;
  const expiresAtFromField = asString(data.expires_at);
  const expiresAt =
    expiresAtFromField ? new Date(expiresAtFromField).getTime() :
    expiresSeconds ? Date.now() + expiresSeconds * 1000 :
    null;

  const meResponse = await fetch(`${directusBaseUrl}/users/me?fields=${meFields}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`
    }
  });
  const mePayload = await meResponse.json().catch(() => ({}));

  const baseProfile = meResponse.ok ? buildProfileFromMe(mePayload, email) : buildFallbackProfile(email);
  const sites = meResponse.ok ? extractSites(mePayload) : [];
  const selectedSite = resolveSelectedSite(sites, previousSiteAlias);
  const profile = applySelectedSite(baseProfile, selectedSite);
  const session: DirectusSession = {
    accessToken,
    refreshToken,
    expiresAt,
    selectedSiteAlias: selectedSite?.alias ?? null,
    selectedSiteApiToken: selectedSite?.apiToken ?? null,
    user: {
      id: profile.id,
      email: profile.email,
      created_at: null,
      user_metadata: {}
    }
  };

  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ session, profile, sites }));
  return { session, profile, sites };
}

export async function hydrateDirectusSessionFromMe(input: {
  session: DirectusSession;
  profile: Profile;
  sites: DirectusSite[];
}): Promise<{ session: DirectusSession; profile: Profile; sites: DirectusSite[] }> {
  const meResponse = await fetch(`${directusBaseUrl}/users/me?fields=${meFields}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.session.accessToken}`
    }
  });
  if (!meResponse.ok) return input;
  const mePayload = await meResponse.json().catch(() => ({}));
  const sites = extractSites(mePayload);
  const baseProfile = buildProfileFromMe(mePayload, input.profile.email);
  const selectedSite = resolveSelectedSite(sites, input.session.selectedSiteAlias);
  const profile = applySelectedSite(baseProfile, selectedSite);
  const session: DirectusSession = {
    ...input.session,
    selectedSiteAlias: selectedSite?.alias ?? null,
    selectedSiteApiToken: selectedSite?.apiToken ?? null,
    user: {
      ...input.session.user,
      id: profile.id,
      email: profile.email
    }
  };
  const next = { session, profile, sites };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
  return next;
}

export async function restoreDirectusSession(): Promise<{ session: DirectusSession; profile: Profile; sites: DirectusSite[] } | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { session?: DirectusSession; profile?: Profile; sites?: DirectusSite[] };
    if (!parsed.session || !parsed.profile || !parsed.session.accessToken) return null;
    return { session: parsed.session, profile: parsed.profile, sites: Array.isArray(parsed.sites) ? parsed.sites : [] };
  } catch {
    return null;
  }
}

export async function updateSelectedSite(site: DirectusSite): Promise<{ session: DirectusSession; profile: Profile; sites: DirectusSite[] } | null> {
  const restored = await restoreDirectusSession();
  if (!restored) return null;
  const nextSession: DirectusSession = {
    ...restored.session,
    selectedSiteAlias: site.alias,
    selectedSiteApiToken: site.apiToken
  };
  const nextProfile = applySelectedSite(restored.profile, site);
  const next = { session: nextSession, profile: nextProfile, sites: restored.sites };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
  return next;
}

export async function getSelectedSiteApiToken(): Promise<string | null> {
  const restored = await restoreDirectusSession();
  if (!restored) return null;
  return restored.session.selectedSiteApiToken ?? null;
}

export async function signOutDirectus(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
