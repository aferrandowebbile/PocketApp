import React from "react";
import { Pressable } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

type IconButtonProps = {
  icon: React.ReactNode;
  onPress?: () => void;
};

export function IconButton({ icon, onPress }: IconButtonProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      className="h-10 w-10 items-center justify-center rounded-full border"
      style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}
    >
      {icon}
    </Pressable>
  );
}
