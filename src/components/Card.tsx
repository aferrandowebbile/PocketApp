import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/constants/theme";

export function Card({
  title,
  subtitle,
  onPress
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text
  },
  subtitle: {
    marginTop: 6,
    color: theme.colors.mutedText
  }
});
