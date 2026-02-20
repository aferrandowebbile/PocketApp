import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";

export function AppShell({ title, titleChip, children }: { title: string; titleChip?: string; children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {titleChip ? (
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>{titleChip}</Text>
            </View>
          ) : null}
        </View>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: theme.colors.background
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text
  },
  chip: {
    borderRadius: 999,
    backgroundColor: "#fff2fb",
    borderWidth: 1,
    borderColor: "#f4bde0",
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  chipLabel: {
    color: "#a72678",
    fontSize: 12,
    fontWeight: "800"
  }
});
