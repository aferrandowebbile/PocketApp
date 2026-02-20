import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

export function Avatar({ label = "GA" }: { label?: string }) {
  const { theme } = useTheme();

  return (
    <View
      className="h-10 w-10 items-center justify-center rounded-full"
      style={{ backgroundColor: `${theme.colors.primary}22` }}
    >
      <Text className="font-inter-semibold text-[14px]" style={{ color: theme.colors.primary }}>
        {label.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}
