import type { TenantConfig } from "@/config/types";

export function isModuleEnabled(config: TenantConfig | undefined, moduleKey: keyof TenantConfig["enabledModules"]) {
  if (!config) return false;
  return Boolean(config.enabledModules[moduleKey]);
}

export function getActiveHighlightModes(config: TenantConfig | undefined) {
  const ski = isModuleEnabled(config, "ski");
  const park = isModuleEnabled(config, "park");
  return { ski, park, both: ski && park };
}
