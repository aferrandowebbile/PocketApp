import AsyncStorage from "@react-native-async-storage/async-storage";
import mockTenantConfig from "@/config/mockTenantConfig.json";
import { supabaseClient } from "@/config/supabaseClient";
import { TenantConfigSchema, type TenantConfig } from "@/config/types";

const CACHE_KEY_PREFIX = "tenant-config";

type TenantConfigRow = {
  tenant_id: string;
  config: unknown;
};

const getCacheKey = (tenantId: string) => `${CACHE_KEY_PREFIX}:${tenantId}`;

async function readCachedConfig(tenantId: string): Promise<TenantConfig | null> {
  const cached = await AsyncStorage.getItem(getCacheKey(tenantId));
  if (!cached) return null;

  try {
    const parsed = JSON.parse(cached);
    return TenantConfigSchema.parse(parsed);
  } catch {
    return null;
  }
}

async function writeCachedConfig(config: TenantConfig) {
  await AsyncStorage.setItem(getCacheKey(config.tenantId), JSON.stringify(config));
}

async function fetchTenantConfigFromSupabase(tenantId: string) {
  if (!supabaseClient) throw new Error("Supabase is not configured");

  const { data, error } = await supabaseClient
    .from("tenant_configs")
    .select("tenant_id, config")
    .eq("tenant_id", tenantId)
    .single<TenantConfigRow>();

  if (error || !data) {
    throw new Error(error?.message ?? "Tenant config not found");
  }

  const validated = TenantConfigSchema.parse({
    tenantId: data.tenant_id,
    ...(data.config as Record<string, unknown>)
  });

  await writeCachedConfig(validated);
  return validated;
}

export async function getTenantConfig(tenantId: string): Promise<TenantConfig> {
  const cached = await readCachedConfig(tenantId);

  try {
    return await fetchTenantConfigFromSupabase(tenantId);
  } catch {
    if (cached) return cached;

    // Local fallback keeps the app runnable before Supabase seed is done.
    const fallback = TenantConfigSchema.parse(mockTenantConfig);
    await writeCachedConfig(fallback);
    return fallback;
  }
}
