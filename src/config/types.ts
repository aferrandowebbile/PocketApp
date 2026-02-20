import { z } from "zod";
import { PageSchema } from "@/cms/schema";

export const EnabledModulesSchema = z.object({
  ski: z.boolean().default(false),
  park: z.boolean().default(false),
  offers: z.boolean().default(true),
  events: z.boolean().default(true),
  commerce: z.boolean().default(false)
});

const ThemeOverrideSchema = z
  .object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    background: z.string().optional(),
    surface: z.string().optional(),
    text: z.string().optional(),
    muted: z.string().optional(),
    border: z.string().optional(),
    success: z.string().optional(),
    warning: z.string().optional(),
    danger: z.string().optional()
  })
  .default({});

export const TenantConfigSchema = z.object({
  tenantId: z.string(),
  name: z.string(),
  theme: ThemeOverrideSchema,
  enabledModules: EnabledModulesSchema,
  supportedLanguages: z.array(z.string()).default(["en"]),
  homePage: PageSchema
});

export type TenantConfig = z.infer<typeof TenantConfigSchema>;
