import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

export function Badge({ label }: { label: string }) {
  const { theme } = useTheme();
  return (
    <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${theme.colors.primary}15` }}>
      <Text className="font-inter-medium text-[13px]" style={{ color: theme.colors.primary }}>
        {label}
      </Text>
    </View>
  );
}
