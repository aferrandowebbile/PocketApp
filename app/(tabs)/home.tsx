import React, { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { canAccessCommerce } from "@/lib/permissions";
import { listArrivalsToday } from "@/services/db/commerce";
import type { Arrival } from "@/types/domain";

export default function HomeScreen() {
  const { profile } = useAuth();
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commerceEnabled = canAccessCommerce(profile);

  const loadHome = useCallback(async () => {
    if (!profile?.company_id || !commerceEnabled) return;
    setError(null);
    const today = new Date().toISOString().slice(0, 10);
    try {
      const data = await listArrivalsToday(profile.company_id, today);
      setArrivals(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard");
    }
  }, [profile?.company_id, commerceEnabled]);

  useEffect(() => {
    loadHome().catch(() => undefined);
  }, [loadHome]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHome();
    setRefreshing(false);
  }, [loadHome]);

  const summary = useMemo(() => {
    const expected = arrivals.filter((item) => item.status === "expected").length;
    const arrived = arrivals.filter((item) => item.status === "arrived").length;
    const noShow = arrivals.filter((item) => item.status === "no_show").length;
    return { expected, arrived, noShow };
  }, [arrivals]);

  return (
    <AppShell title="Home">
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accentDark} />}>
        <Card title="Spotlio Pocket Dashboard" subtitle="Pull down to refresh arrivals, visitors, and validation flow." />
        <View style={styles.scanCta}>
          <PrimaryButton label="Scan Ticket (QR)" onPress={() => router.push("/scan-ticket")} />
        </View>

        <View style={styles.tileGrid}>
          <Pressable style={styles.tile} onPress={() => router.push("/commerce/arrivals")} disabled={!commerceEnabled}>
            <Text style={styles.tileLabel}>Arrivals Today</Text>
            <Text style={styles.tileValue}>{commerceEnabled ? arrivals.length : "-"}</Text>
            <Text style={styles.tileHint}>{commerceEnabled ? "Tap to open list" : "Operator access required"}</Text>
          </Pressable>
          <Pressable style={styles.tile} onPress={() => router.push("/commerce/scan-qr")} disabled={!commerceEnabled}>
            <Text style={styles.tileLabel}>Scan & Validate</Text>
            <Text style={styles.tileValue}>QR</Text>
            <Text style={styles.tileHint}>Guest, product, quantity, status</Text>
          </Pressable>
        </View>

        <View style={styles.tileGrid}>
          <View style={styles.smallTile}>
            <Text style={styles.smallTileLabel}>Expected</Text>
            <Text style={styles.smallTileValue}>{summary.expected}</Text>
          </View>
          <View style={styles.smallTile}>
            <Text style={styles.smallTileLabel}>Arrived</Text>
            <Text style={styles.smallTileValue}>{summary.arrived}</Text>
          </View>
          <View style={styles.smallTile}>
            <Text style={styles.smallTileLabel}>No-show</Text>
            <Text style={styles.smallTileValue}>{summary.noShow}</Text>
          </View>
        </View>

        <Card
          title="Validation Checklist"
          subtitle="On QR scan, confirm: Guest Name, Product, Quantity, Purchase Date, Ticket Status, Validation Timestamp."
        />

        <Card
          title="Visitors Coming Today"
          subtitle={
            arrivals.length
              ? arrivals
                  .slice(0, 6)
                  .map((item) => `${item.customer.first_name} ${item.customer.last_name} • ${item.status}`)
                  .join("\n")
              : "No visitors scheduled yet."
          }
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.meta}>Company: {profile?.company_id ?? "-"}</Text>
        <Text style={styles.meta}>Role: {profile?.role ?? "-"}</Text>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scanCta: {
    marginBottom: 12
  },
  tileGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12
  },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: "#fff7fb",
    padding: 14
  },
  tileLabel: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 13
  },
  tileValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.accentDark
  },
  tileHint: {
    marginTop: 8,
    color: theme.colors.mutedText,
    fontSize: 12
  },
  smallTile: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 12,
    backgroundColor: "#ffffff"
  },
  smallTileLabel: {
    color: theme.colors.mutedText,
    fontSize: 12
  },
  smallTileValue: {
    marginTop: 6,
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 20
  },
  error: {
    color: theme.colors.danger,
    marginBottom: 10
  },
  meta: {
    color: theme.colors.mutedText,
    marginBottom: 6
  }
});
