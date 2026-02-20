import { z } from "zod";

export const SectionStyleOverridesSchema = z
  .object({
    paddingTop: z.number().min(0).max(64).optional(),
    paddingBottom: z.number().min(0).max(64).optional(),
    background: z.string().optional()
  })
  .optional();

const HeroSectionSchema = z.object({
  id: z.string(),
  type: z.literal("hero"),
  props: z.object({
    title: z.string(),
    subtitle: z.string(),
    ctaLabel: z.string().optional(),
    ctaRoute: z.string().optional(),
    gradient: z.array(z.string()).length(2).optional()
  }),
  style: SectionStyleOverridesSchema
});

const QuickActionItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string(),
  route: z.string().optional(),
  module: z.enum(["ski", "park"]).optional()
});

const QuickActionsSectionSchema = z.object({
  id: z.string(),
  type: z.literal("quickActions"),
  props: z.object({
    title: z.string().optional(),
    actions: z.array(QuickActionItemSchema).min(1)
  }),
  style: SectionStyleOverridesSchema
});

const CarouselItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  image: z.string().optional(),
  route: z.string()
});

const CardCarouselSectionSchema = z.object({
  id: z.string(),
  type: z.literal("cardCarousel"),
  props: z.object({
    title: z.string(),
    items: z.array(CarouselItemSchema)
  }),
  style: SectionStyleOverridesSchema
});

const ListSectionSchema = z.object({
  id: z.string(),
  type: z.literal("list"),
  props: z.object({
    title: z.string(),
    items: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        subtitle: z.string().optional(),
        route: z.string()
      })
    )
  }),
  style: SectionStyleOverridesSchema
});

const InfoBannerSectionSchema = z.object({
  id: z.string(),
  type: z.literal("infoBanner"),
  props: z.object({
    title: z.string(),
    message: z.string(),
    variant: z.enum(["default", "moduleHighlights"]).optional(),
    module: z.enum(["ski", "park"]).optional()
  }),
  style: SectionStyleOverridesSchema
});

const WebEmbedSectionSchema = z.object({
  id: z.string(),
  type: z.literal("webEmbed"),
  props: z.object({
    title: z.string(),
    url: z.string().url(),
    buttonLabel: z.string().optional()
  }),
  style: SectionStyleOverridesSchema
});

export const KnownSectionSchema = z.discriminatedUnion("type", [
  HeroSectionSchema,
  QuickActionsSectionSchema,
  CardCarouselSectionSchema,
  ListSectionSchema,
  InfoBannerSectionSchema,
  WebEmbedSectionSchema
]);

const UnsupportedSectionSchema = z.object({
  id: z.string().default("unknown"),
  type: z.string(),
  props: z.record(z.any()).optional(),
  style: SectionStyleOverridesSchema
});

export const PageSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string(),
  sections: z.array(z.union([KnownSectionSchema, UnsupportedSectionSchema]))
});

export type PageSchemaType = z.infer<typeof PageSchema>;
export type KnownSection = z.infer<typeof KnownSectionSchema>;
export type QuickActionItem = z.infer<typeof QuickActionItemSchema>;
