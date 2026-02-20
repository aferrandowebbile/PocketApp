import React from "react";
import type { KnownSection } from "@/cms/schema";
import type { SectionComponentProps } from "@/cms/types";
import { CardCarouselSection } from "@/cms/sections/CardCarouselSection";
import { HeroSection } from "@/cms/sections/HeroSection";
import { InfoBannerSection } from "@/cms/sections/InfoBannerSection";
import { ListSection } from "@/cms/sections/ListSection";
import { QuickActionsSection } from "@/cms/sections/QuickActionsSection";
import { UnsupportedSection } from "@/cms/sections/UnsupportedSection";
import { WebEmbedSection } from "@/cms/sections/WebEmbedSection";

type SectionRenderer = React.ComponentType<SectionComponentProps<any>>;

const registry: Record<KnownSection["type"], SectionRenderer> = {
  hero: HeroSection,
  quickActions: QuickActionsSection,
  cardCarousel: CardCarouselSection,
  list: ListSection,
  infoBanner: InfoBannerSection,
  webEmbed: WebEmbedSection
};

export function resolveSection(type: string): SectionRenderer {
  return (registry as Record<string, SectionRenderer>)[type] ?? UnsupportedSection;
}
