import React, { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { theme } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { canAccessCommerce } from "@/lib/permissions";
import { getOperatorDashboard, type DashboardAlert, type DashboardSource, type OperatorDashboard } from "@/services/db/dashboard";

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function TrendBars({ values, color }: { values: number[]; color: string }) {
  const safeValues = values.length ? values : [0, 0, 0, 0, 0, 0];
  const max = Math.max(...safeValues, 1);

  return (
    <View style={styles.trendRow}>
      {safeValues.map((value, index) => (
        <View key={`${value}-${index}`} style={styles.trendTrack}>
          <View style={[styles.trendBar, { backgroundColor: color, height: `${Math.max(8, (value / max) * 100)}%` }]} />
        </View>
      ))}
    </View>
  );
}

function AlertCard({ alert }: { alert: DashboardAlert }) {
  const severityColor = alert.severity === "critical" ? "#dc2626" : alert.severity === "warning" ? "#d97706" : "#2563eb";
  return (
    <View style={styles.alertCard}>
      <View style={[styles.alertDot, { backgroundColor: severityColor }]} />
      <View style={styles.alertBody}>
        <Text style={styles.alertTitle}>{alert.title}</Text>
        <Text style={styles.alertText}>{alert.body}</Text>
        <Text style={styles.alertTime}>{new Date(alert.event_time).toLocaleTimeString()}</Text>
      </View>
      {alert.action_route ? (
        <Pressable style={styles.alertAction} onPress={() => router.push(alert.action_route as never)}>
          <Text style={styles.alertActionLabel}>{alert.action_label ?? "Open"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function defaultDashboard(): OperatorDashboard {
  return {
    status: "on_track",
    arrivalsExpected: 0,
    arrivalsArrived: 0,
    arrivalsNoShow: 0,
    pendingCheckins2h: 0,
    checkinsLast60m: 0,
    validationSuccessRate: 0,
    invalidScans: 0,
    rejectedScans: 0,
    topProductName: "Top product",
    topProductCount: 0,
    openIncidents: 0,
    staffLoadHint: "No forecast available yet.",
    checkinsByHour: [],
    invalidScansByHour: [],
    noShowByHour: [],
    alerts: [],
    source: "mock"
  };
}

export default function HomeScreen() {
  const { profile } = useAuth();
  const [dashboard, setDashboard] = useState<OperatorDashboard>(defaultDashboard);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleCanOperate = canAccessCommerce(profile);
  const dashboardSource = (process.env.EXPO_PUBLIC_DASHBOARD_SOURCE as DashboardSource | undefined) ?? "mock";
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric"
      }).format(new Date()),
    []
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const companyId = profile?.company_id ?? "11111111-1111-1111-1111-111111111111";
      const data = await getOperatorDashboard({
        companyId,
        dateIso: todayIso,
        source: dashboardSource
      });
      setDashboard(data);
    } catch (loadError) {
      // Keep the dashboard usable in dev by falling back to local mock values.
      const fallback = await getOperatorDashboard({
        companyId: "11111111-1111-1111-1111-111111111111",
        dateIso: todayIso,
        source: "mock"
      });
      setDashboard(fallback);
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard KPIs.");
    } finally {
      setLoading(false);
    }
  }, [dashboardSource, profile?.company_id, todayIso]);

  useEffect(() => {
    loadDashboard().catch(() => undefined);
  }, [loadDashboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  }, [loadDashboard]);

  const arrivalsProgress = dashboard.arrivalsExpected
    ? Math.min(1, dashboard.arrivalsArrived / dashboard.arrivalsExpected)
    : 0;
  const statusLabel = dashboard.status === "on_track" ? "On Track" : "At Risk";
  const titleChip = dashboard.arrivalsExpected ? `${dashboard.arrivalsArrived}/${dashboard.arrivalsExpected}` : "0/0";

  return (
    <AppShell title="Dashboard" titleChip={titleChip}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accentDark} />}>
        <View style={styles.topStrip}>
          <View>
            <Text style={styles.topStripDate}>{dateLabel}</Text>
            <Text style={styles.topStripCompany}>Company {profile?.company_id?.slice(0, 8) ?? "-"}</Text>
          </View>
          <View style={[styles.statusPill, dashboard.status === "at_risk" ? styles.statusPillRisk : null]}>
            <Text style={styles.statusPillText}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.progressWrap}>
          <Text style={styles.progressLabel}>Arrivals Today Progress</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(arrivalsProgress * 100)}%` }]} />
          </View>
        </View>

        <View style={styles.heroGrid}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Arrivals Today</Text>
            <Text style={styles.heroValue}>{dashboard.arrivalsArrived}/{dashboard.arrivalsExpected}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Pending Next 2h</Text>
            <Text style={styles.heroValue}>{dashboard.pendingCheckins2h}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Check-ins (60m)</Text>
            <Text style={styles.heroValue}>{dashboard.checkinsLast60m}</Text>
          </View>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Validation Success</Text>
            <Text style={styles.heroValue}>{formatPercent(dashboard.validationSuccessRate)}</Text>
          </View>
        </View>

        <View style={styles.actionsPanel}>
          <Pressable style={styles.actionButton} onPress={() => router.push("/scan-ticket")} disabled={!roleCanOperate}>
            <Text style={styles.actionTitle}>Scan Ticket</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => router.push("/scan-nfc")} disabled={!roleCanOperate}>
            <Text style={styles.actionTitle}>Scan NFC</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => router.push("/commerce/arrivals")} disabled={!roleCanOperate}>
            <Text style={styles.actionTitle}>Arrivals</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => router.push("/(tabs)/guests")}>
            <Text style={styles.actionTitle}>Search Guest</Text>
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Invalid / Rejected</Text>
            <Text style={styles.summaryValue}>{dashboard.invalidScans} / {dashboard.rejectedScans}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>No-shows</Text>
            <Text style={styles.summaryValue}>{dashboard.arrivalsNoShow}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Open Incidents</Text>
            <Text style={styles.summaryValue}>{dashboard.openIncidents}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Operational Alerts</Text>
        {dashboard.alerts.length ? dashboard.alerts.map((alert) => <AlertCard key={alert.id} alert={alert} />) : <Text style={styles.empty}>No alerts right now.</Text>}

        <Text style={styles.sectionTitle}>Live Trends</Text>
        <View style={styles.trendCard}>
          <Text style={styles.trendTitle}>Check-ins by hour</Text>
          <TrendBars values={dashboard.checkinsByHour} color="#10b981" />
        </View>
        <View style={styles.trendCard}>
          <Text style={styles.trendTitle}>Invalid scans by hour</Text>
          <TrendBars values={dashboard.invalidScansByHour} color="#f59e0b" />
        </View>
        <View style={styles.trendCard}>
          <Text style={styles.trendTitle}>No-shows by hour</Text>
          <TrendBars values={dashboard.noShowByHour} color="#ef4444" />
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.bottomCard}>
            <Text style={styles.bottomLabel}>Top Product</Text>
            <Text style={styles.bottomValue}>{dashboard.topProductName}</Text>
            <Text style={styles.bottomHint}>{dashboard.topProductCount} scans today</Text>
          </View>
          <View style={styles.bottomCard}>
            <Text style={styles.bottomLabel}>Staff Load Hint</Text>
            <Text style={styles.bottomValue}>{dashboard.staffLoadHint}</Text>
          </View>
        </View>

        {loading ? <Text style={styles.meta}>Refreshing dashboard...</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.meta}>Source: {dashboard.source} ({dashboardSource})</Text>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  topStrip: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },
  topStripDate: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 16
  },
  topStripCompany: {
    color: theme.colors.mutedText,
    marginTop: 4,
    fontSize: 12
  },
  statusPill: {
    backgroundColor: "#dcfce7",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  statusPillRisk: {
    backgroundColor: "#fee2e2"
  },
  statusPillText: {
    color: "#14532d",
    fontWeight: "800",
    fontSize: 12
  },
  progressWrap: {
    marginBottom: 10
  },
  progressLabel: {
    color: theme.colors.mutedText,
    fontSize: 12,
    marginBottom: 4
  },
  progressTrack: {
    height: 10,
    backgroundColor: "#f3f4f6",
    borderRadius: 999,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fcb4e0"
  },
  heroGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10
  },
  heroCard: {
    width: "48%",
    backgroundColor: "#fff7fb",
    borderWidth: 1,
    borderColor: "#ffd7ef",
    borderRadius: 14,
    padding: 12
  },
  heroLabel: {
    color: theme.colors.mutedText,
    fontSize: 12
  },
  heroValue: {
    marginTop: 6,
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 20
  },
  actionsPanel: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  actionButton: {
    width: "48%",
    backgroundColor: "#fdf2f8",
    borderWidth: 1,
    borderColor: "#fbcfe8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  actionTitle: {
    color: "#831843",
    fontWeight: "800",
    fontSize: 12
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 10
  },
  summaryLabel: {
    color: theme.colors.mutedText,
    fontSize: 11
  },
  summaryValue: {
    marginTop: 4,
    color: theme.colors.text,
    fontWeight: "800"
  },
  sectionTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    marginBottom: 6
  },
  alertCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start"
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 6
  },
  alertBody: {
    flex: 1
  },
  alertTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 13
  },
  alertText: {
    marginTop: 2,
    color: theme.colors.mutedText,
    fontSize: 12
  },
  alertTime: {
    marginTop: 4,
    color: theme.colors.mutedText,
    fontSize: 11
  },
  alertAction: {
    backgroundColor: "#fce7f3",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  alertActionLabel: {
    color: "#9d174d",
    fontSize: 11,
    fontWeight: "700"
  },
  trendCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8
  },
  trendTitle: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 12,
    marginBottom: 8
  },
  trendRow: {
    height: 52,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4
  },
  trendTrack: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
    overflow: "hidden"
  },
  trendBar: {
    width: "100%"
  },
  bottomRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
    marginBottom: 8
  },
  bottomCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 10
  },
  bottomLabel: {
    color: theme.colors.mutedText,
    fontSize: 11
  },
  bottomValue: {
    marginTop: 4,
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 13
  },
  bottomHint: {
    marginTop: 4,
    color: theme.colors.mutedText,
    fontSize: 11
  },
  error: {
    color: theme.colors.danger,
    marginTop: 4
  },
  meta: {
    color: theme.colors.mutedText,
    fontSize: 11,
    marginBottom: 8
  },
  empty: {
    color: theme.colors.mutedText,
    marginBottom: 8
  }
});
