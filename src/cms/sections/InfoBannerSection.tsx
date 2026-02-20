import React from "react";
import { Text, View } from "react-native";
import type { SectionComponentProps } from "@/cms/types";
import { Badge, Card } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";

export function InfoBannerSection({ section, context }: SectionComponentProps<any>) {
  const { theme } = useTheme();

  const dynamicMessage =
    section.props.variant === "moduleHighlights"
      ? context.highlightMode === "ski"
        ? "Ski update: 22/24 lifts open, powder depth 38cm, peak wind low."
        : "Park update: Avg wait 14 min, 3 shows running in the next 2 hours."
      : section.props.message;

  return (
    <Card>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="font-inter-semibold text-[20px]" style={{ color: theme.colors.text }}>
          {section.props.title}
        </Text>
        <Badge label={context.highlightMode === "ski" ? "Ski" : "Park"} />
      </View>
      <Text className="font-inter text-[16px]" style={{ color: theme.colors.muted }}>
        {dynamicMessage}
      </Text>
    </Card>
  );
}
