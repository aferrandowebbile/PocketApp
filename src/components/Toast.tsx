import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

export function Toast({ message }: { message: string }) {
  const { theme } = useTheme();

  return (
    <View className="rounded-2xl px-4 py-3" style={{ backgroundColor: theme.colors.text }}>
      <Text className="font-inter-medium text-[14px] text-white">{message}</Text>
    </View>
  );
}
