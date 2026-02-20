import React from "react";
import { Pressable, Text } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary";
};

export function Button({ label, onPress, variant = "primary" }: ButtonProps) {
  const { theme } = useTheme();
  const isPrimary = variant === "primary";

  return (
    <Pressable
      onPress={onPress}
      className="items-center rounded-2xl px-4 py-3"
      style={{ backgroundColor: isPrimary ? theme.colors.primary : `${theme.colors.text}10` }}
    >
      <Text className="font-inter-semibold text-[16px]" style={{ color: isPrimary ? "#fff" : theme.colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}
