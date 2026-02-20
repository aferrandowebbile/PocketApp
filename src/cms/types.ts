import type { KnownSection } from "@/cms/schema";
import type { TenantConfig } from "@/config/types";

export type HighlightMode = "ski" | "park";

export type CMSRenderContext = {
  tenant?: TenantConfig;
  highlightMode: HighlightMode;
};

export type SectionComponentProps<T extends KnownSection = KnownSection> = {
  section: T;
  context: CMSRenderContext;
};
