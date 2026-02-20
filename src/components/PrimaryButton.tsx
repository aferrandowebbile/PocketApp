import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { theme } from "@/constants/theme";

export function PrimaryButton({
  label,
  onPress,
  disabled
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled ? styles.disabled : null]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  disabled: {
    opacity: 0.55
  },
  label: {
    color: "#111827",
    fontWeight: "700"
  }
});
