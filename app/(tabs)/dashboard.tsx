import React, { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { ActivityIndicator, Animated, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { theme } from "@/constants/theme";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useAuth } from "@/lib/auth";
import { canAccessCommerce } from "@/lib/permissions";
import { getOperatorDashboard, type OperatorDashboard } from "@/services/db/dashboard";

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function fromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameDate(a: Date, b: Date): boolean {
  return toIsoDate(a) === toIsoDate(b);
}

function isBetween(date: Date, start: Date, end: Date): boolean {
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

type RangePreset = "today" | "yesterday" | "week" | "month" | "total" | "custom";
type DateRange = { startDateIso: string; endDateIso: string };
const TOTAL_RANGE_START = "2000-01-01";

function getPresetRange(preset: Exclude<RangePreset, "custom">): DateRange {
  const today = new Date();
  if (preset === "today") {
    const iso = toIsoDate(today);
    return { startDateIso: iso, endDateIso: iso };
  }

  if (preset === "yesterday") {
    const iso = toIsoDate(addDays(today, -1));
    return { startDateIso: iso, endDateIso: iso };
  }

  if (preset === "month") {
    return { startDateIso: toIsoDate(addDays(today, -30)), endDateIso: toIsoDate(today) };
  }

  if (preset === "total") {
    return { startDateIso: TOTAL_RANGE_START, endDateIso: toIsoDate(today) };
  }

  return { startDateIso: toIsoDate(addDays(today, -7)), endDateIso: toIsoDate(today) };
}

function formatDateRange(range: DateRange): string {
  const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const start = formatter.format(fromIsoDate(range.startDateIso));
  const end = formatter.format(fromIsoDate(range.endDateIso));
  return range.startDateIso === range.endDateIso ? start : `${start} - ${end}`;
}

function formatCurrency(value: number, currency: string | null): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: 0
    }).format(value);
  } catch {
    return `${Math.round(value).toLocaleString()} ${currency ?? ""}`.trim();
  }
}

function formatCompactCurrency(value: number, currency: string | null): string {
  const rounded = Math.round(value);
  const compact = rounded >= 1000 ? `${(rounded / 1000).toFixed(1)}K` : String(rounded);
  return `${compact} ${currency ?? ""}`.trim();
}

function titleCaseSite(value: string | null): string {
  if (!value) return "Site";
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildMockDashboard(): OperatorDashboard {
  return {
    status: "on_track",
    totalRevenue: 76614,
    currency: "USD",
    totalGuests: 857,
    totalProductsSold: 1322,
    mobileRevenue: 55752,
    desktopRevenue: 20862,
    arrivalsExpected: 1322,
    arrivalsArrived: 493,
    arrivalsNoShow: 829,
    pendingCheckins2h: 387,
    checkinsLast60m: 106,
    validationSuccessRate: 72.8,
    invalidScans: 8,
    rejectedScans: 3,
    topProductName: "1 Day Admission - 48\" & over",
    topProductCount: 525,
    openIncidents: 0,
    staffLoadHint: "Mobile leads revenue. Mobile share: 73%.",
    checkinsByHour: [4600, 7350, 15300, 20600, 16750, 8520, 3430, 0],
    invalidScansByHour: [2680, 4930, 8485, 14848, 15517, 7156, 2133, 0],
    noShowByHour: [1963, 2425, 6817, 5763, 1234, 1363, 1297, 0],
    alerts: [],
    source: "mock"
  };
}

function SparkBars({ values, color = "#ff4fbe", soft = false }: { values: number[]; color?: string; soft?: boolean }) {
  const safeValues = values.length ? values : [0, 0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(...safeValues, 1);
  return (
    <View style={styles.sparkBars}>
      {safeValues.map((value, index) => (
        <View
          key={`${value}-${index}`}
          style={[
            styles.sparkBar,
            {
              height: Math.max(5, (value / max) * (soft ? 36 : 54)),
              backgroundColor: color,
              opacity: soft ? 0.34 + index / (safeValues.length * 1.8) : 1
            }
          ]}
        />
      ))}
    </View>
  );
}

function MiniMetric({
  icon,
  label,
  value
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.miniMetric}>
      <View style={styles.miniMetricIconWrap}>
        <Feather name={icon} size={18} color="#ff4fbe" />
      </View>
      <View style={styles.miniMetricText}>
        <Text style={styles.miniLabel}>{label}</Text>
        <Text style={styles.miniValue}>{value}</Text>
      </View>
    </View>
  );
}

function CalendarRangePicker({
  visible,
  range,
  onClose,
  onApply
}: {
  visible: boolean;
  range: DateRange;
  onClose: () => void;
  onApply: (range: DateRange) => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(fromIsoDate(range.endDateIso)));
  const [draftStart, setDraftStart] = useState(() => fromIsoDate(range.startDateIso));
  const [draftEnd, setDraftEnd] = useState(() => fromIsoDate(range.endDateIso));

  useEffect(() => {
    if (!visible) return;
    setVisibleMonth(monthStart(fromIsoDate(range.endDateIso)));
    setDraftStart(fromIsoDate(range.startDateIso));
    setDraftEnd(fromIsoDate(range.endDateIso));
  }, [range.endDateIso, range.startDateIso, visible]);

  const days = useMemo(() => {
    const first = monthStart(visibleMonth);
    const startOffset = first.getDay();
    const gridStart = addDays(first, -startOffset);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [visibleMonth]);

  const title = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(visibleMonth);
  const orderedStart = draftStart <= draftEnd ? draftStart : draftEnd;
  const orderedEnd = draftStart <= draftEnd ? draftEnd : draftStart;

  const onPickDay = (day: Date) => {
    if (!sameDate(draftStart, draftEnd)) {
      setDraftStart(day);
      setDraftEnd(day);
      return;
    }

    if (day < draftStart) {
      setDraftStart(day);
      return;
    }

    setDraftEnd(day);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.calendarBackdrop}>
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Pressable style={styles.calendarNav} onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>
              <Feather name="chevron-left" size={20} color="#0b1220" />
            </Pressable>
            <Text style={styles.calendarTitle}>{title}</Text>
            <Pressable style={styles.calendarNav} onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>
              <Feather name="chevron-right" size={20} color="#0b1220" />
            </Pressable>
          </View>

          <Text style={styles.calendarRangeLabel}>{formatDateRange({ startDateIso: toIsoDate(orderedStart), endDateIso: toIsoDate(orderedEnd) })}</Text>

          <View style={styles.weekRow}>
            {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
              <Text key={`${label}-${index}`} style={styles.weekDay}>{label}</Text>
            ))}
          </View>
          <View style={styles.daysGrid}>
            {days.map((day) => {
              const inMonth = day.getMonth() === visibleMonth.getMonth();
              const selectedEdge = sameDate(day, orderedStart) || sameDate(day, orderedEnd);
              const selectedRange = isBetween(day, orderedStart, orderedEnd);
              return (
                <Pressable
                  key={toIsoDate(day)}
                  style={[
                    styles.dayCell,
                    selectedRange ? styles.dayCellInRange : null,
                    selectedEdge ? styles.dayCellSelected : null
                  ]}
                  onPress={() => onPickDay(day)}
                >
                  <Text style={[styles.dayText, !inMonth ? styles.dayTextMuted : null, selectedEdge ? styles.dayTextSelected : null]}>
                    {day.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.calendarActions}>
            <Pressable style={styles.calendarCancel} onPress={onClose}>
              <Text style={styles.calendarCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.calendarApply}
              onPress={() => onApply({ startDateIso: toIsoDate(orderedStart), endDateIso: toIsoDate(orderedEnd) })}
            >
              <Text style={styles.calendarApplyText}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const { profile, selectedSite, selectedSiteApiToken, selectedSiteAlias, sites, selectSite } = useAuth();
  const layout = useResponsiveLayout();
  const [dashboard, setDashboard] = useState<OperatorDashboard>(buildMockDashboard);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangePreset, setRangePreset] = useState<RangePreset>("week");
  const [dateRange, setDateRange] = useState<DateRange>(() => getPresetRange("week"));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [siteBusy, setSiteBusy] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const livePulse = React.useRef(new Animated.Value(1)).current;

  const roleCanOperate = canAccessCommerce(profile);
  const dateRangeLabel = useMemo(() => (rangePreset === "total" ? "Total" : formatDateRange(dateRange)), [dateRange, rangePreset]);
  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdatedAt) return "Last updated -";
    return `Last updated ${new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(lastUpdatedAt)}`;
  }, [lastUpdatedAt]);
  const mobileShare = dashboard.totalRevenue ? (dashboard.mobileRevenue / dashboard.totalRevenue) * 100 : 0;
  const siteName = titleCaseSite(selectedSiteAlias);
  const quickActionWidth = layout.cardColumns >= 2 ? "48.5%" : "100%";
  const applyPreset = (preset: Exclude<RangePreset, "custom">) => {
    setRangePreset(preset);
    setDateRange(getPresetRange(preset));
  };

  const loadDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    setError(null);
    try {
      const data = await getOperatorDashboard({
        companyId: profile?.company_id ?? "spotlio",
        dateIso: dateRange.endDateIso,
        startDateIso: dateRange.startDateIso,
        endDateIso: dateRange.endDateIso,
        apiToken: selectedSiteApiToken
      });
      setDashboard(data);
      setLastUpdatedAt(new Date());
    } catch (loadError) {
      setDashboard(buildMockDashboard());
      setLastUpdatedAt(new Date());
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard.");
    } finally {
      setLoadingDashboard(false);
    }
  }, [dateRange.endDateIso, dateRange.startDateIso, profile?.company_id, selectedSiteApiToken]);

  useEffect(() => {
    loadDashboard().catch(() => undefined);
  }, [loadDashboard]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 0.25,
          duration: 650,
          useNativeDriver: true
        }),
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true
        })
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [livePulse]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  }, [loadDashboard]);

  return (
    <AppShell title="Home" hideHeader>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, layout.isTablet ? styles.contentTablet : null]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff4fbe" />}
      >
        <View style={styles.header}>
          <View>
            <View style={styles.liveRow}>
              <Animated.View style={[styles.liveDot, { opacity: livePulse }]} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <Text style={styles.lastUpdatedText}>{lastUpdatedLabel}</Text>
            <Pressable style={styles.siteRow} onPress={() => setSiteModalOpen(true)} disabled={!sites.length || siteBusy}>
              <View style={styles.siteIconWrap}>
                {selectedSite?.iconUrl ? (
                  <Image source={{ uri: selectedSite.iconUrl }} style={styles.siteIcon} resizeMode="cover" />
                ) : (
                  <Feather name="map-pin" size={16} color="#ff4fbe" />
                )}
              </View>
              <Text style={styles.siteTitle}>{siteName}</Text>
              <Feather name="chevron-down" size={20} color="#0b1220" />
            </Pressable>
          </View>
          <Pressable style={styles.bellButton} onPress={() => router.push("/(tabs)/notifications")}>
            <Feather name="bell" size={25} color="#0b1220" />
          </Pressable>
        </View>

        <View style={styles.rangeBar}>
          {([
            ["today", "Today"],
            ["yesterday", "Yesterday"],
            ["week", "Last week"],
            ["month", "Last month"]
          ] as Array<[Exclude<RangePreset, "custom">, string]>).map(([preset, label]) => (
            <Pressable
              key={preset}
              style={[styles.rangeChip, rangePreset === preset ? styles.rangeChipActive : null]}
              onPress={() => applyPreset(preset)}
            >
              <Text style={[styles.rangeChipText, rangePreset === preset ? styles.rangeChipTextActive : null]}>{label}</Text>
            </Pressable>
          ))}
          <Pressable style={[styles.calendarChip, rangePreset === "custom" ? styles.rangeChipActive : null]} onPress={() => setCalendarOpen(true)}>
            <Feather name="calendar" size={16} color={rangePreset === "custom" ? "#fff" : "#ff4fbe"} />
          </Pressable>
          <Pressable style={[styles.rangeChip, rangePreset === "total" ? styles.rangeChipActive : null]} onPress={() => applyPreset("total")}>
            <Text style={[styles.rangeChipText, rangePreset === "total" ? styles.rangeChipTextActive : null]}>Total</Text>
          </Pressable>
        </View>

        <View style={styles.revenueCard}>
          <View style={styles.cardTopRow}>
            <View style={styles.mountainBadge}>
              <Feather name="trending-up" size={23} color="#ff4fbe" />
            </View>
            <View>
              <Text style={styles.dateText}>{dateRangeLabel}</Text>
              <Text style={styles.revenueValue}>{formatCurrency(dashboard.totalRevenue, dashboard.currency)}</Text>
              <Text style={styles.revenueDelta}>↑ {Math.max(1, Math.round(mobileShare / 4))}% vs yesterday</Text>
            </View>
            <View style={styles.livePill}>
              <View style={styles.livePillDot} />
              <Text style={styles.livePillText}>Live</Text>
            </View>
          </View>
          <SparkBars values={dashboard.checkinsByHour} />
          <View style={styles.metricsGrid}>
            <View style={styles.metricCellThird}>
              <MiniMetric icon="shopping-bag" label="Orders" value={String(dashboard.arrivalsArrived)} />
            </View>
            <View style={styles.metricCellThird}>
              <MiniMetric icon="smartphone" label="Mobile" value={String(dashboard.pendingCheckins2h)} />
            </View>
            <View style={styles.metricCellThird}>
              <MiniMetric icon="monitor" label="Desktop" value={String(dashboard.checkinsLast60m)} />
            </View>
            <View style={styles.metricCellHalf}>
              <MiniMetric icon="users" label="Guests" value={String(dashboard.totalGuests)} />
            </View>
            <View style={styles.metricCellHalf}>
              <MiniMetric icon="package" label="Products Sold" value={String(dashboard.totalProductsSold)} />
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={[styles.quickActions, layout.isTablet ? styles.quickActionsTablet : null]}>
          <Pressable
            style={[styles.quickAction, styles.quickActionPrimary, { width: quickActionWidth }]}
            onPress={() => router.push("/(tabs)/scans")}
            disabled={!roleCanOperate}
          >
            <Feather name="maximize" size={21} color="#fff" />
            <Text style={styles.quickActionPrimaryText}>Scan Ticket</Text>
          </Pressable>
          <Pressable style={[styles.quickAction, { width: quickActionWidth }]} onPress={() => router.push("/(tabs)/guests")}>
            <Feather name="search" size={22} color="#ff4fbe" />
            <Text style={styles.quickActionText}>Search Guest</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Revenue by hour</Text>
        <View style={styles.chartCard}>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={styles.legendToday} />
              <Text style={styles.legendText}>Today</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendYesterday} />
              <Text style={styles.legendText}>Yesterday</Text>
            </View>
            <View style={styles.chartPeak}>
              <Text style={styles.chartPeakText}>{formatCompactCurrency(Math.max(...dashboard.checkinsByHour, 0), dashboard.currency)}</Text>
            </View>
          </View>
          <View style={styles.chartArea}>
            <SparkBars values={dashboard.checkinsByHour} />
            <SparkBars values={dashboard.noShowByHour} color="#9ca3af" soft />
          </View>
          <View style={styles.chartLabels}>
            <Text style={styles.chartLabel}>6AM</Text>
            <Text style={styles.chartLabel}>9AM</Text>
            <Text style={[styles.chartLabel, styles.chartLabelActive]}>12PM</Text>
            <Text style={styles.chartLabel}>3PM</Text>
            <Text style={styles.chartLabel}>6PM</Text>
            <Text style={styles.chartLabel}>9PM</Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <CalendarRangePicker
        visible={calendarOpen}
        range={dateRange}
        onClose={() => setCalendarOpen(false)}
        onApply={(nextRange) => {
          setRangePreset("custom");
          setDateRange(nextRange);
          setCalendarOpen(false);
        }}
      />
      <Modal visible={loadingDashboard} transparent animationType="fade">
        <View style={styles.loadingBackdrop}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#ff4fbe" />
            <Text style={styles.loadingTitle}>Loading Home</Text>
            <Text style={styles.loadingText}>Refreshing totals and charts for the selected filter.</Text>
          </View>
        </View>
      </Modal>
      <Modal visible={siteModalOpen} transparent animationType="fade" onRequestClose={() => setSiteModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: layout.modalMaxWidth, alignSelf: "center", width: "100%" }]}>
            <Text style={styles.siteKicker}>Site Access</Text>
            <Text style={styles.modalTitle}>Choose a site</Text>
            <Text style={styles.modalSubtitle}>This site will be used as the Connect API client for orders, guests, dashboard and scans.</Text>
            <ScrollView contentContainerStyle={styles.siteList}>
              {sites.map((site) => {
                const isActive = site.alias === selectedSiteAlias;
                return (
                  <Pressable
                    key={site.id}
                    style={[styles.siteOption, isActive ? styles.siteOptionActive : null]}
                    disabled={siteBusy}
                    onPress={async () => {
                      try {
                        setSiteBusy(true);
                        await selectSite(site.alias);
                        setSiteModalOpen(false);
                        await loadDashboard();
                      } finally {
                        setSiteBusy(false);
                      }
                    }}
                  >
                    <View style={styles.siteOptionText}>
                      <Text style={styles.siteName}>{site.name}</Text>
                      <Text style={styles.siteAlias}>{site.alias}</Text>
                    </View>
                    <Text style={styles.siteAction}>{siteBusy ? "Selecting..." : isActive ? "Active" : "Use"}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {!sites.length ? <Text style={styles.siteError}>No sites found for this Directus user.</Text> : null}
            <Pressable style={styles.secondaryAction} onPress={() => setSiteModalOpen(false)} disabled={siteBusy}>
              <Text style={styles.secondaryActionLabel}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 18
  },
  contentTablet: {
    paddingBottom: 28
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 2
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#ff4fbe"
  },
  liveText: {
    color: "#ff4fbe",
    fontWeight: "800",
    letterSpacing: 0.2
  },
  lastUpdatedText: {
    color: "#7c8492",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 5
  },
  siteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  siteIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#fff5fb",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  siteIcon: {
    width: "100%",
    height: "100%"
  },
  siteTitle: {
    color: "#0b1220",
    fontSize: 24,
    fontWeight: "700"
  },
  bellButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  rangeBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14
  },
  rangeChip: {
    borderWidth: 1,
    borderColor: "#ffd2ee",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "#fff"
  },
  rangeChipActive: {
    borderColor: "#ff4fbe",
    backgroundColor: "#ff4fbe"
  },
  rangeChipText: {
    color: "#9f5b86",
    fontWeight: "700",
    fontSize: 12
  },
  rangeChipTextActive: {
    color: "#fff"
  },
  calendarChip: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ffd2ee",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff"
  },
  revenueCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 22,
    backgroundColor: "#fff",
    padding: 18,
    marginBottom: 26,
    shadowColor: "#132033",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
    marginBottom: 12
  },
  mountainBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff5fb"
  },
  dateText: {
    color: "#7c8492",
    fontSize: 14,
    fontWeight: "600"
  },
  revenueValue: {
    marginTop: 4,
    color: "#0b1220",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800"
  },
  revenueDelta: {
    marginTop: 4,
    color: "#15b979",
    fontWeight: "700"
  },
  livePill: {
    marginLeft: "auto",
    backgroundColor: "#ff4fbe",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  livePillDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#fff"
  },
  livePillText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12
  },
  sparkBars: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6
  },
  sparkBar: {
    flex: 1,
    borderRadius: 999
  },
  metricsGrid: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metricCellThird: {
    width: "30.5%",
    minWidth: 0
  },
  metricCellHalf: {
    width: "47.5%",
    minWidth: 0
  },
  miniMetric: {
    width: "100%",
    minHeight: 110,
    borderWidth: 1,
    borderColor: "#f0d8e8",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#fff8fc"
  },
  miniMetricIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff"
  },
  miniMetricText: {
    flex: 1,
    marginTop: 10
  },
  miniLabel: {
    color: "#2d3440",
    fontSize: 12,
    fontWeight: "600"
  },
  miniValue: {
    marginTop: 3,
    color: "#0b1220",
    fontSize: 18,
    fontWeight: "800"
  },
  sectionTitle: {
    color: "#0b1220",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 28
  },
  quickActionsTablet: {
    alignItems: "stretch"
  },
  quickAction: {
    minHeight: 72,
    borderRadius: 13,
    backgroundColor: "#fff5fb",
    alignItems: "center",
    justifyContent: "center",
    gap: 7
  },
  quickActionPrimary: {
    backgroundColor: "#ff4fbe",
    shadowColor: "#ff4fbe",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  quickActionText: {
    color: "#a2176a",
    fontWeight: "800"
  },
  quickActionPrimaryText: {
    color: "#fff",
    fontWeight: "800"
  },
  chartCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 18,
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 12
  },
  chartLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  legendToday: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#ff4fbe"
  },
  legendYesterday: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#cdd3dd"
  },
  legendText: {
    color: "#8991a0",
    fontWeight: "700"
  },
  chartPeak: {
    marginLeft: "auto",
    backgroundColor: "#ff4fbe",
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  chartPeakText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800"
  },
  chartArea: {
    minHeight: 130,
    justifyContent: "flex-end",
    gap: 8
  },
  chartLabels: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  chartLabel: {
    color: "#8991a0",
    fontWeight: "700",
    fontSize: 12
  },
  chartLabelActive: {
    overflow: "hidden",
    backgroundColor: "#ff9bd8",
    color: "#fff",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  error: {
    color: theme.colors.danger,
    marginBottom: 10
  },
  calendarBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 24, 40, 0.35)",
    justifyContent: "center",
    padding: 20
  },
  calendarCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ffd2ee"
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  calendarNav: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#fff5fb",
    alignItems: "center",
    justifyContent: "center"
  },
  calendarTitle: {
    color: "#0b1220",
    fontSize: 16,
    fontWeight: "800"
  },
  calendarRangeLabel: {
    marginTop: 10,
    marginBottom: 12,
    color: "#ff4fbe",
    fontWeight: "800",
    textAlign: "center"
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 6
  },
  weekDay: {
    flex: 1,
    textAlign: "center",
    color: "#8a93a1",
    fontWeight: "800",
    fontSize: 12
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10
  },
  dayCellInRange: {
    backgroundColor: "#fff5fb"
  },
  dayCellSelected: {
    backgroundColor: "#ff4fbe"
  },
  dayText: {
    color: "#0b1220",
    fontWeight: "700"
  },
  dayTextMuted: {
    color: "#b7bfcb"
  },
  dayTextSelected: {
    color: "#fff"
  },
  calendarActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16
  },
  calendarCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  calendarApply: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#ff4fbe"
  },
  calendarCancelText: {
    color: "#6b7280",
    fontWeight: "800"
  },
  calendarApplyText: {
    color: "#fff",
    fontWeight: "800"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 24, 40, 0.35)",
    justifyContent: "center",
    padding: 20
  },
  loadingBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 24, 40, 0.32)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  loadingCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#f4bde0",
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: "center"
  },
  loadingTitle: {
    marginTop: 14,
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 18
  },
  loadingText: {
    marginTop: 8,
    color: theme.colors.mutedText,
    textAlign: "center",
    lineHeight: 20
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f4bde0",
    maxHeight: "82%"
  },
  siteKicker: {
    color: "#a72678",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7
  },
  modalTitle: {
    marginTop: 6,
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 28,
    lineHeight: 32
  },
  modalSubtitle: {
    marginTop: 8,
    marginBottom: 12,
    color: "#6b7280",
    lineHeight: 20
  },
  siteList: {
    gap: 10,
    paddingBottom: 12
  },
  siteOption: {
    borderWidth: 1,
    borderColor: "#e8dce5",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  siteOptionActive: {
    borderColor: "#f9a8d4",
    backgroundColor: "#ffffff"
  },
  siteOptionText: {
    flex: 1
  },
  siteName: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 16
  },
  siteAlias: {
    marginTop: 3,
    color: "#6b7280"
  },
  siteAction: {
    color: "#a72678",
    fontWeight: "800"
  },
  siteError: {
    color: theme.colors.danger,
    marginBottom: 6
  },
  secondaryAction: {
    alignSelf: "flex-start",
    paddingVertical: 8
  },
  secondaryActionLabel: {
    color: "#6b7280",
    fontWeight: "700"
  }
});
