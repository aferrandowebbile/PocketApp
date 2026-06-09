import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";

export function AppShell({
  title,
  titleChip,
  hideHeader,
  children
}: {
  title: string;
  titleChip?: string;
  hideHeader?: boolean;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style="light" backgroundColor="#000000" />
      <View style={styles.container}>
        {!hideHeader ? (
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            {titleChip ? (
              <View style={styles.chip}>
                <Text style={styles.chipLabel}>{titleChip}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000"
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: theme.colors.background
  },
  titleRow: {
    marginHorizontal: -16,
    marginTop: -12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    backgroundColor: "#000000"
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f3f6fb"
  },
  chip: {
    borderRadius: 999,
    backgroundColor: "#0f0f10",
    borderWidth: 1,
    borderColor: "#2a2a2e",
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  chipLabel: {
    color: "#ff4fbe",
    fontSize: 12,
    fontWeight: "800"
  }
});
