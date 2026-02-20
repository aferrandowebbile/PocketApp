import React, { memo, useMemo } from "react";
import { View } from "react-native";
import { PageSchema, type PageSchemaType } from "@/cms/schema";
import { resolveSection } from "@/cms/registry";
import type { CMSRenderContext } from "@/cms/types";

type CMSRendererProps = {
  page: unknown;
  context: CMSRenderContext;
};

function CMSRendererComponent({ page, context }: CMSRendererProps) {
  const parsed = useMemo(() => PageSchema.safeParse(page), [page]);

  const data: PageSchemaType | undefined = parsed.success ? parsed.data : undefined;

  if (!data) return null;

  return (
    <View className="gap-5">
      {data.sections.map((section) => {
        const Section = resolveSection(section.type);
        return <Section key={section.id} section={section as never} context={context} />;
      })}
    </View>
  );
}

export const CMSRenderer = memo(CMSRendererComponent);
