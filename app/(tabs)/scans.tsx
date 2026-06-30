import React from "react";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { theme } from "@/constants/theme";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clearScanHistory, getScanHistory, subscribeToScanHistory, type LocalScanRecord } from "@/lib/scanStore";

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

function toneForStatus(status: LocalScanRecord["validationStatus"]) {
  if (status === "redeemed") {
    return {
      card: styles.scanCardRedeemed,
      chip: styles.scanChipRedeemed,
      chipLabel: styles.scanChipLabelRedeemed,
      label: "Redeemed"
    };
  }

  if (status === "validated") {
    return {
      card: styles.scanCardValidated,
      chip: styles.scanChipValidated,
      chipLabel: styles.scanChipLabelValidated,
      label: "Validated"
    };
  }

  return {
    card: styles.scanCardError,
    chip: styles.scanChipError,
    chipLabel: styles.scanChipLabelError,
    label: "Error"
  };
}

export default function ScansTabScreen() {
  const layout = useResponsiveLayout();
  const [records, setRecords] = React.useState<LocalScanRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);

  const loadRecords = React.useCallback(async (mode: "load" | "refresh" = "load") => {
    if (mode === "load") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    try {
      const next = await getScanHistory();
      setRecords(next);
    } finally {
      if (mode === "load") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    loadRecords().catch(() => undefined);
    return subscribeToScanHistory(() => {
      loadRecords().catch(() => undefined);
    });
  }, [loadRecords]);

  useFocusEffect(
    React.useCallback(() => {
      loadRecords().catch(() => undefined);
    }, [loadRecords])
  );

  const cardWidth = layout.cardColumns === 3 ? "31.5%" : layout.cardColumns === 2 ? "48.5%" : "100%";
  const validatedCount = records.filter((item) => item.validationStatus === "validated" || item.validationStatus === "redeemed").length;
  const errorCount = records.filter((item) => item.validationStatus === "error").length;
  const lastScan = records[0]?.scannedAt ?? null;

  return (
    <AppShell title="Scans" titleChip={String(records.length)}>
      <View style={styles.screen}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, layout.isTablet ? styles.contentTablet : null]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRecords("refresh")} tintColor="#ff4fbe" />}
        >
          <View style={[styles.summaryGrid, layout.isTablet ? styles.summaryGridTablet : null]}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Local scans</Text>
              <Text style={styles.summaryValue}>{loading ? "-" : records.length}</Text>
              <Text style={styles.summaryMeta}>{lastScan ? `Last scan ${formatDate(lastScan)}` : "No scans yet"}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Validated</Text>
              <Text style={styles.summaryValue}>{loading ? "-" : validatedCount}</Text>
              <Text style={styles.summaryMeta}>Successful validations and redeems</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Errors</Text>
              <Text style={styles.summaryValue}>{loading ? "-" : errorCount}</Text>
              <Text style={styles.summaryMeta}>Failed or unmatched scans</Text>
            </View>
          </View>

          <View style={styles.toolbar}>
            <Text style={styles.sectionTitle}>Recent scans</Text>
            {records.length ? (
              <Pressable
                style={[styles.clearButton, clearing ? styles.disabledButton : null]}
                disabled={clearing}
                onPress={async () => {
                  try {
                    setClearing(true);
                    await clearScanHistory();
                  } finally {
                    setClearing(false);
                  }
                }}
              >
                <Text style={styles.clearButtonLabel}>{clearing ? "Clearing..." : "Clear"}</Text>
              </Pressable>
            ) : null}
          </View>

          {loading ? <Text style={styles.meta}>Loading scans...</Text> : null}
          {!loading && !records.length ? (
            <View style={styles.emptyState}>
              <Feather name="maximize" size={28} color="#ff4fbe" />
              <Text style={styles.emptyTitle}>No scans yet</Text>
              <Text style={styles.emptyText}>Your local scan history appears here until the API-backed history is ready.</Text>
            </View>
          ) : null}

          <View style={styles.cardsGrid}>
            {records.map((record) => {
              const tone = toneForStatus(record.validationStatus);
              const hasKnownProduct = Boolean(record.product && record.product.toLowerCase() !== "unknown product");
              return (
                <View key={record.id} style={[styles.scanCard, tone.card, { width: cardWidth }]}>
                  <View style={styles.scanCardTop}>
                    <Text style={styles.scanId}>{record.orderId ? `#${record.orderId}` : record.rawValue.slice(0, 24)}</Text>
                    <View style={[styles.scanChip, tone.chip]}>
                      <Text style={[styles.scanChipLabel, tone.chipLabel]}>{tone.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.scanDate}>{formatDate(record.scannedAt)}</Text>
                  {record.guestName ? <Text style={styles.scanGuest}>{record.guestName}</Text> : null}
                  {hasKnownProduct ? <Text style={styles.scanMeta}>Product: {record.product}</Text> : null}
                  {!hasKnownProduct && record.ticketCount !== null ? <Text style={styles.scanMeta}>Items: {record.ticketCount}</Text> : null}
                  {record.orderStatus ? <Text style={styles.scanMeta}>Order status: {record.orderStatus}</Text> : null}
                  {hasKnownProduct && record.ticketCount !== null ? <Text style={styles.scanMeta}>Items: {record.ticketCount}</Text> : null}
                  <Text style={styles.scanMeta}>Format: {record.parsedType.toUpperCase()}</Text>
                  {record.scanTypeLabel ? <Text style={styles.scanMeta}>Scanner: {record.scanTypeLabel}</Text> : null}
                  <Text style={styles.scanMessage}>{record.validationMessage}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.actionsBar, { left: -layout.screenPadding, right: -layout.screenPadding }]}>
          <Pressable style={styles.primaryAction} onPress={() => router.push("/scan-ticket")}>
            <Feather name="camera" size={16} color="#fff" />
            <Text style={styles.primaryActionLabel}>Scan code</Text>
          </Pressable>
        </View>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    paddingBottom: 108
  },
  contentTablet: {
    paddingBottom: 120
  },
  summaryGrid: {
    gap: 10,
    marginBottom: 18
  },
  summaryGridTablet: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  summaryCard: {
    flex: 1,
    minWidth: 180,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    backgroundColor: "#fff",
    padding: 16
  },
  summaryLabel: {
    color: theme.colors.mutedText,
    fontSize: 12,
    fontWeight: "700"
  },
  summaryValue: {
    marginTop: 8,
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 28
  },
  summaryMeta: {
    marginTop: 8,
    color: theme.colors.mutedText,
    lineHeight: 18
  },
  toolbar: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 18
  },
  clearButton: {
    borderWidth: 1,
    borderColor: "#f4bde0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff"
  },
  clearButtonLabel: {
    color: "#a72678",
    fontWeight: "700",
    fontSize: 12
  },
  disabledButton: {
    opacity: 0.55
  },
  meta: {
    color: theme.colors.mutedText,
    marginBottom: 10
  },
  emptyState: {
    borderWidth: 1,
    borderColor: "#ffd7ef",
    borderRadius: 18,
    backgroundColor: "#fff8fc",
    padding: 18,
    alignItems: "center",
    marginBottom: 12
  },
  emptyTitle: {
    marginTop: 10,
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 18
  },
  emptyText: {
    marginTop: 6,
    color: theme.colors.mutedText,
    textAlign: "center",
    lineHeight: 20
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  scanCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#fff"
  },
  scanCardValidated: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4"
  },
  scanCardRedeemed: {
    borderColor: "#86efac",
    backgroundColor: "#ecfdf5"
  },
  scanCardError: {
    borderColor: "#fecaca",
    backgroundColor: "#fff7f7"
  },
  scanCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  scanId: {
    color: "#cc3f97",
    fontWeight: "800",
    flex: 1
  },
  scanChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  scanChipValidated: {
    backgroundColor: "#dcfce7"
  },
  scanChipRedeemed: {
    backgroundColor: "#bbf7d0"
  },
  scanChipError: {
    backgroundColor: "#fee2e2"
  },
  scanChipLabel: {
    fontSize: 11,
    fontWeight: "800"
  },
  scanChipLabelValidated: {
    color: "#166534"
  },
  scanChipLabelRedeemed: {
    color: "#166534"
  },
  scanChipLabelError: {
    color: "#991b1b"
  },
  scanDate: {
    marginTop: 8,
    color: theme.colors.mutedText,
    fontSize: 12
  },
  scanGuest: {
    marginTop: 8,
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 17
  },
  scanMeta: {
    marginTop: 5,
    color: theme.colors.text,
    fontSize: 12
  },
  scanMessage: {
    marginTop: 10,
    color: theme.colors.mutedText,
    lineHeight: 18
  },
  actionsBar: {
    position: "absolute",
    bottom: 0,
    backgroundColor: "#14161b",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10
  },
  primaryAction: {
    borderRadius: 12,
    backgroundColor: "#ff4fbe",
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  primaryActionLabel: {
    color: "#fff",
    fontWeight: "800"
  }
});
