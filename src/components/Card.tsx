import React from "react";
import { View, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

type CardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export function Card({ children, style }: CardProps) {
  const { theme } = useTheme();

  return (
    <View
      className="rounded-3xl border px-4 py-4 shadow-card"
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border
        },
        style
      ]}
    >
      {children}
    </View>
  );
}
