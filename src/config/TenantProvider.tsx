import React, { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTenantConfig } from "@/config/tenantConfig";
import type { TenantConfig } from "@/config/types";

const DEFAULT_TENANT_ID = process.env.EXPO_PUBLIC_TENANT_ID ?? "alpine-demo";

type TenantContextValue = {
  tenantId: string;
  config?: TenantConfig;
  isLoading: boolean;
  refetch: () => Promise<void>;
};

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const query = useQuery({
    queryKey: ["tenant-config", DEFAULT_TENANT_ID],
    queryFn: () => getTenantConfig(DEFAULT_TENANT_ID)
  });

  const value = useMemo<TenantContextValue>(
    () => ({
      tenantId: DEFAULT_TENANT_ID,
      config: query.data,
      isLoading: query.isLoading,
      refetch: async () => {
        await query.refetch();
      }
    }),
    [query.data, query.isLoading, query]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error("useTenant must be used within TenantProvider");
  return context;
}
