import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { theme } = useTheme();

  return (
    <View className="mb-3 flex-row items-end justify-between">
      <View className="flex-1">
        <Text className="font-inter-semibold text-[20px]" style={{ color: theme.colors.text }}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-1 font-inter text-[14px]" style={{ color: theme.colors.muted }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
