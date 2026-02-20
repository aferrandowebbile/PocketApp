import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

export function Skeleton({ height = 80 }: { height?: number }) {
  const { theme } = useTheme();
  return <View className="mb-3 rounded-3xl" style={{ height, backgroundColor: `${theme.colors.muted}22` }} />;
}
