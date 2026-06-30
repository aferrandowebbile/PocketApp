import React, { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { theme } from "@/constants/theme";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useAuth } from "@/lib/auth";
import { listOrdersPage, type PagingInfo, type RemoteOrder } from "@/services/ordersClient";
import { cacheOrder } from "@/lib/orderStore";

const pageSize = 10;
const sortByPurchaseDateDesc = "completed_at_day:desc";
type DateField = "purchase" | "start";
type DateRangeFilter = "all" | "today" | "tomorrow" | "weekend" | "custom";
type OrderTotals = { numProducts: number | null; amount: number | null; currency: string | null };
type OrderTimeState = "past" | "today" | "tomorrow" | "later";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function fromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function isInToday(target: Date, now: Date) {
  return target >= startOfDay(now) && target <= endOfDay(now);
}

function isInTomorrow(target: Date, now: Date) {
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return target >= startOfDay(tomorrow) && target <= endOfDay(tomorrow);
}

function isInThisWeekend(target: Date, now: Date) {
  const todayDay = now.getDay();
  const daysUntilSaturday = (6 - todayDay + 7) % 7;
  const saturday = new Date(now);
  saturday.setDate(now.getDate() + daysUntilSaturday);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  return target >= startOfDay(saturday) && target <= endOfDay(sunday);
}

function isSameCalendarDay(target: Date, dateIso: string) {
  const day = fromIsoDate(dateIso);
  return target >= startOfDay(day) && target <= endOfDay(day);
}

function getOrderTimeState(value: string | null | undefined): OrderTimeState {
  if (!value) return "later";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "later";

  const todayStart = startOfDay(new Date());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  const dayAfterTomorrowStart = new Date(todayStart);
  dayAfterTomorrowStart.setDate(todayStart.getDate() + 2);
  const targetStart = startOfDay(parsed);

  if (targetStart.getTime() < todayStart.getTime()) return "past";
  if (targetStart.getTime() === todayStart.getTime()) return "today";
  if (targetStart.getTime() === tomorrowStart.getTime()) return "tomorrow";
  if (targetStart.getTime() >= dayAfterTomorrowStart.getTime()) return "later";
  return "later";
}

function formatPrice(value: number | null, currency: string | null): string {
  if (value === null) return "-";
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency}`;
    }
  }
  return value.toFixed(2);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function getNum(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  }
  return null;
}

function getStr(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function hasRedeemFields(record: Record<string, unknown> | null): boolean {
  if (!record) return false;
  const redemption = getStr(record, ["redemption", "redeem_status", "redeemStatus"])?.toLowerCase() ?? null;
  if (redemption === "full") return true;
  const redeemedAt =
    getStr(record, ["redeemed_at", "redeemedAt"]) ??
    getStr(record, ["redeemed_at_day", "redeemedAtDay"]) ??
    getStr(record, ["redeemed_at_hour", "redeemedAtHour"]) ??
    null;
  const redeemedAtObject =
    asRecord(record.redeemed_at) ??
    asRecord(record.redeemedAt) ??
    null;
  const redeemedAtObjectDay = redeemedAtObject ? getStr(redeemedAtObject, ["day", "date"]) : null;
  const redeemedAtObjectHour = redeemedAtObject ? getStr(redeemedAtObject, ["hour", "time"]) : null;
  if (redeemedAtObjectDay || redeemedAtObjectHour) return true;
  if (redeemedAt) return true;
  return record.redeemed === true || record.is_redeemed === true || record.isRedeemed === true;
}

function isOrderRedeemed(order: RemoteOrder): boolean {
  return hasRedeemFields(order.raw) || hasRedeemFields(asRecord(order.raw.order));
}

function getOrderRedeemState(order: RemoteOrder): "none" | "partial" | "full" {
  if (order.redemption === "full" || order.redemption === "partial" || order.redemption === "none" || order.redemption === "error") {
    if (order.redemption === "full") return "full";
    if (order.redemption === "partial") return "partial";
    return "none";
  }
  if (isOrderRedeemed(order)) return "full";
  const raw = order.raw;
  const arrays: unknown[] = [
    raw.products,
    raw.line_items,
    raw.lineItems,
    raw.items,
    asRecord(raw.order)?.products,
    asRecord(raw.order)?.line_items,
    asRecord(raw.order)?.lineItems,
    asRecord(raw.order)?.items
  ];
  for (const candidate of arrays) {
    if (!Array.isArray(candidate) || !candidate.length) continue;
    const redeemedCount = candidate.filter((item) => hasRedeemFields(asRecord(item))).length;
    if (redeemedCount === 0) return "none";
    if (redeemedCount === candidate.length) return "full";
    return "partial";
  }
  return "none";
}

function extractOrderTotals(order: RemoteOrder): OrderTotals {
  const raw = order.raw;
  const totalObj = asRecord(raw.total) ?? asRecord(asRecord(raw.order)?.total) ?? null;
  const numProducts =
    (totalObj ? getNum(totalObj, ["num_products", "numProducts"]) : null) ??
    getNum(raw, ["num_products", "numProducts"]) ??
    null;
  const amount =
    (totalObj ? getNum(totalObj, ["amount", "total_amount", "totalAmount", "price"]) : null) ??
    getNum(raw, ["amount", "total_amount", "totalAmount", "price"]) ??
    null;
  const currency =
    (totalObj ? getStr(totalObj, ["currency", "currency_code", "currencyCode"]) : null) ??
    getStr(raw, ["currency", "currency_code", "currencyCode"]) ??
    null;
  return { numProducts, amount, currency };
}

function CustomDatePicker({
  visible,
  value,
  onClose,
  onSelect
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onSelect: (dateIso: string) => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(fromIsoDate(value)));

  useEffect(() => {
    if (visible) setVisibleMonth(monthStart(fromIsoDate(value)));
  }, [value, visible]);

  const days = useMemo(() => {
    const first = monthStart(visibleMonth);
    const gridStart = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [visibleMonth]);
  const monthTitle = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(visibleMonth);
  const selectedDate = fromIsoDate(value);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Pressable style={styles.calendarNav} onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>
              <Feather name="chevron-left" size={20} color={theme.colors.text} />
            </Pressable>
            <Text style={styles.calendarTitle}>{monthTitle}</Text>
            <Pressable style={styles.calendarNav} onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>
              <Feather name="chevron-right" size={20} color={theme.colors.text} />
            </Pressable>
          </View>
          <Text style={styles.calendarSubtitle}>Choose one day</Text>
          <View style={styles.weekRow}>
            {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
              <Text key={`${label}-${index}`} style={styles.weekDay}>{label}</Text>
            ))}
          </View>
          <View style={styles.daysGrid}>
            {days.map((day) => {
              const inMonth = day.getMonth() === visibleMonth.getMonth();
              const selected = toIsoDate(day) === toIsoDate(selectedDate);
              return (
                <Pressable
                  key={toIsoDate(day)}
                  style={[styles.dayCell, selected ? styles.dayCellSelected : null]}
                  onPress={() => onSelect(toIsoDate(day))}
                >
                  <Text style={[styles.dayText, !inMonth ? styles.dayTextMuted : null, selected ? styles.dayTextSelected : null]}>
                    {day.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.calendarClose} onPress={onClose}>
            <Text style={styles.calendarCloseLabel}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function OrdersScreen() {
  const { profile } = useAuth();
  const layout = useResponsiveLayout();
  const tenantId = profile?.connect_client_id ?? undefined;
  const [orders, setOrders] = useState<RemoteOrder[]>([]);
  const [offset, setOffset] = useState(0);
  const [paging, setPaging] = useState<PagingInfo>({ total: null, start: 0, limit: pageSize });
  const [dateField, setDateField] = useState<DateField>("purchase");
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>("all");
  const [customDateIso, setCustomDateIso] = useState(toIsoDate(new Date()));
  const [customDateModalVisible, setCustomDateModalVisible] = useState(false);
  const [searchApplied, setSearchApplied] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (
    nextOffset: number,
    mode: "loading" | "refresh" = "loading",
    append = false
  ) => {
    if (mode === "loading") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    if (append) setLoadingMore(true);
    setError(null);

    try {
      const page = await listOrdersPage({
        limit: pageSize,
        offset: nextOffset,
        sort: sortByPurchaseDateDesc,
        tenantId
      });
      if (append) {
        setOrders((prev) => {
          const byId = new Map<string, RemoteOrder>();
          [...prev, ...page.items].forEach((item) => byId.set(item.id, item));
          return [...byId.values()];
        });
      } else {
        setOrders(page.items);
      }
      setPaging(page.paging);
      setOffset(page.paging.start);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load orders");
    } finally {
      if (mode === "loading") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
      if (append) setLoadingMore(false);
    }
  };

  useEffect(() => {
    load(0).catch(() => undefined);
  }, [tenantId]);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const query = searchApplied.trim().toLowerCase();
    return orders.filter((order) => {
      if (query) {
        const haystack = [order.id, order.guestName, order.product, order.status].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (dateFilter === "all") return true;
      const sourceDate = dateField === "start" ? order.startDate : order.date;
      if (!sourceDate) return false;
      const parsedDate = new Date(sourceDate);
      if (Number.isNaN(parsedDate.getTime())) return false;
      if (dateFilter === "today") return isInToday(parsedDate, now);
      if (dateFilter === "tomorrow") return isInTomorrow(parsedDate, now);
      if (dateFilter === "weekend") return isInThisWeekend(parsedDate, now);
      return isSameCalendarDay(parsedDate, customDateIso);
    });
  }, [customDateIso, dateField, dateFilter, orders, searchApplied]);

  const isDateFilterActive = dateFilter !== "all";
  const dateFilterLabel =
    dateFilter === "today"
      ? "Today"
      : dateFilter === "tomorrow"
        ? "Tomorrow"
        : dateFilter === "weekend"
          ? "This Weekend"
          : dateFilter === "custom"
            ? new Date(`${customDateIso}T00:00:00`).toLocaleDateString()
            : "All";
  const pageStart = paging.start + 1;
  const pageEnd = paging.start + Math.min(paging.limit, orders.length);
  const loadedCount = orders.length;
  const filteredCount = filteredOrders.length;
  const totalLabel = isDateFilterActive
    ? `${dateFilterLabel}: ${filteredCount}`
    : paging.total === null
      ? "Total: -"
      : `Total: ${paging.total.toLocaleString()}`;
  const loadedLabel = isDateFilterActive
    ? `Visible: ${filteredCount}/${loadedCount}`
    : paging.total === null
      ? `Loaded: ${loadedCount}`
      : `Loaded: ${loadedCount}/${paging.total}`;
  const pageLabel = isDateFilterActive
    ? `${filteredCount} visible`
    : orders.length
      ? `${pageStart}-${pageEnd}`
      : "0-0";
  const pageCount = paging.total && paging.limit ? Math.max(1, Math.ceil(paging.total / paging.limit)) : null;
  const currentPage = paging.limit ? Math.floor(paging.start / paging.limit) + 1 : 1;
  const canPrev = paging.start > 0 && !loading && !loadingMore;
  const canNext = !loading && !loadingMore && (paging.total === null ? orders.length >= paging.limit : paging.start + paging.limit < paging.total);
  const canLoadMore = paging.total === null ? orders.length >= paging.limit : orders.length < paging.total;
  const listCardWidth = layout.cardColumns === 3 ? "31.5%" : layout.cardColumns === 2 ? "48.5%" : "100%";

  const ordersTitleChip = paging.total === null ? "-" : String(paging.total);

  return (
    <AppShell title="Orders" titleChip={ordersTitleChip}>
      <View style={styles.screen}>
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(offset, "refresh")} />}
          stickyHeaderIndices={[0]}
          contentContainerStyle={[styles.scrollContent, layout.isTablet ? styles.scrollContentTablet : null]}
          scrollEventThrottle={16}
          onScroll={({ nativeEvent }) => {
            const nearBottom =
              nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 280;
            if (!nearBottom || loading || loadingMore || refreshing || !canLoadMore) return;
            load(offset + paging.limit, "loading", true).catch(() => undefined);
          }}
        >
          <View style={styles.filterSection}>
            {searchApplied ? <Text style={styles.searchActive}>Active search: {searchApplied}</Text> : null}
            <View style={styles.paginationBar}>
              <View style={styles.paginationInfo}>
                <Text style={styles.paginationTotal}>{totalLabel}</Text>
                <Text style={styles.paginationMeta}>
                  {loadedLabel}
                  {" • "}
                  {pageLabel}
                  {pageCount ? ` • Page ${currentPage}/${pageCount}` : ""}
                </Text>
              </View>
              <View style={styles.paginationActions}>
                <Pressable
                  style={[styles.pageButton, !canPrev ? styles.pageButtonDisabled : null]}
                  disabled={!canPrev}
                  accessibilityLabel="Previous page"
                  onPress={() => load(Math.max(offset - paging.limit, 0))}
                >
                  <Feather name="chevron-left" size={16} color="#3e1240" />
                </Pressable>
                <Pressable
                  style={[styles.pageButton, !canNext ? styles.pageButtonDisabled : null]}
                  disabled={!canNext}
                  accessibilityLabel="Next page"
                  onPress={() => load(offset + paging.limit)}
                >
                  <Feather name="chevron-right" size={16} color="#3e1240" />
                </Pressable>
              </View>
            </View>
          </View>

          {loading ? <Text style={styles.meta}>Loading orders...</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!loading && !error && !filteredOrders.length ? <Text style={styles.meta}>No orders found for these filters.</Text> : null}

          <View style={styles.cardsGrid}>
            {filteredOrders.map((order) => {
              const totals = extractOrderTotals(order);
              const cardNumProducts = totals.numProducts ?? order.productCount;
              const cardPrice = formatPrice(totals.amount ?? order.totalPrice, totals.currency ?? order.currency);
              const stateDate = dateField === "start" ? order.startDate ?? order.date : order.date ?? order.startDate;
              const state = getOrderTimeState(stateDate);
              const stateLabel = state === "today" ? "Today" : state === "tomorrow" ? "Tomorrow" : state === "past" ? "Past" : "Later";
              const redeemState = getOrderRedeemState(order);
              return (
                <Pressable
                  key={order.id}
                  style={[
                    styles.heroCard,
                    { width: listCardWidth },
                    redeemState === "full"
                      ? styles.heroCardRedeemed
                      : redeemState === "partial"
                        ? styles.heroCardPartiallyRedeemed
                        : state === "past"
                          ? styles.heroCardPast
                          : state === "today"
                            ? styles.heroCardToday
                            : state === "tomorrow"
                              ? styles.heroCardTomorrow
                              : styles.heroCardLater
                  ]}
                  onPress={() => {
                    cacheOrder(order);
                    router.push({
                      pathname: "/order/[id]",
                      params: {
                        id: order.id,
                        guestName: order.guestName,
                        product: order.product,
                        quantity: String(order.quantity),
                        totalPrice: order.totalPrice === null ? "" : String(order.totalPrice),
                        currency: order.currency ?? "",
                        status: order.status,
                        date: order.date,
                        startDate: order.startDate ?? "",
                        tenantId: tenantId ?? ""
                      }
                    });
                  }}
                >
                  <Text style={styles.heroOrderId}>#{order.id}</Text>
                  <Text style={styles.heroGuest}>{order.guestName}</Text>
                  <Text style={styles.heroDate}>Purchase: {formatDate(order.date)}</Text>
                  <Text style={styles.heroDate}>Start date: {formatDate(order.startDate)}</Text>
                  <Text style={styles.heroMeta}>{`Quantity: ${cardNumProducts}`}</Text>
                  <Text style={styles.heroMeta}>{`Price: ${cardPrice}`}</Text>
                  <View
                    style={[
                      styles.heroDateStateChip,
                      redeemState === "full"
                        ? styles.heroDateStateChipRedeemed
                        : redeemState === "partial"
                          ? styles.heroDateStateChipPartiallyRedeemed
                          : state === "past"
                            ? styles.heroDateStateChipPast
                            : state === "today"
                              ? styles.heroDateStateChipToday
                              : state === "tomorrow"
                                ? styles.heroDateStateChipTomorrow
                                : styles.heroDateStateChipLater
                    ]}
                  >
                    <View style={styles.chipContent}>
                      {redeemState === "full" ? (
                        <Feather name="check-circle" size={12} color="#166534" />
                      ) : redeemState === "partial" ? (
                        <Feather name="clock" size={12} color="#92400e" />
                      ) : (
                        <Feather name="clock" size={12} color="#374151" />
                      )}
                      <Text
                        style={[
                          styles.heroDateStateChipLabel,
                          redeemState === "full"
                            ? styles.heroDateStateChipLabelRedeemed
                            : redeemState === "partial"
                              ? styles.heroDateStateChipLabelPartiallyRedeemed
                              : null
                        ]}
                      >
                        {redeemState === "full" ? "Redeemed" : redeemState === "partial" ? "Partially Redeemed" : stateLabel}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>{order.status.toUpperCase()}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {loadingMore ? <Text style={styles.meta}>Loading more orders...</Text> : null}
        </ScrollView>

        {filtersOpen ? (
          <View style={[styles.floatingFilterDock, { left: -layout.screenPadding, right: -layout.screenPadding }]}>
            <View style={styles.filtersGrid}>
              <View style={styles.filterRowGrid}>
                <Pressable
                  style={[styles.filterButton, dateField === "purchase" ? styles.filterButtonActive : null]}
                  onPress={() => setDateField("purchase")}
                >
                  <Text style={[styles.filterLabel, dateField === "purchase" ? styles.chipLabelActive : null]}>Purchase</Text>
                </Pressable>
                <Pressable
                  style={[styles.filterButton, dateField === "start" ? styles.filterButtonActive : null]}
                  onPress={() => setDateField("start")}
                >
                  <Text style={[styles.filterLabel, dateField === "start" ? styles.chipLabelActive : null]}>Start</Text>
                </Pressable>
              </View>
              <View style={styles.filterRowGrid}>
                {(["all", "today", "tomorrow", "weekend", "custom"] as DateRangeFilter[]).map((filter) => (
                  <Pressable
                    key={filter}
                    style={[styles.chip, dateFilter === filter ? styles.chipActive : null]}
                    onPress={() => {
                      if (filter === "custom") {
                        setCustomDateModalVisible(true);
                        return;
                      }
                      setDateFilter(filter);
                    }}
                  >
                    <Text style={[styles.chipLabel, dateFilter === filter ? styles.chipLabelActive : null]}>
                      {filter === "all"
                        ? "All"
                        : filter === "today"
                          ? "Today"
                          : filter === "tomorrow"
                            ? "Tomorrow"
                            : filter === "weekend"
                              ? "Weekend"
                              : `Custom${dateFilter === "custom" ? `: ${new Date(`${customDateIso}T00:00:00`).toLocaleDateString()}` : ""}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : null}
        <View style={[styles.actionsBar, { left: -layout.screenPadding, right: -layout.screenPadding }]}>
          <Pressable style={styles.actionsButton} onPress={() => setFiltersOpen((prev) => !prev)}>
            <Feather name="sliders" size={16} color="#ff4fbe" />
            <Text style={styles.actionsButtonLabel}>{filtersOpen ? "Hide Filters" : "Filters"}</Text>
          </Pressable>
          <Pressable
            style={styles.actionsButton}
            onPress={
              searchApplied
                ? () => {
                    setSearchApplied("");
                    setSearchDraft("");
                  }
                : () => {
                    setSearchDraft(searchApplied);
                    setSearchModalVisible(true);
                  }
            }
          >
            <Feather name={searchApplied ? "x-circle" : "search"} size={16} color="#ff4fbe" />
            <Text style={styles.actionsButtonLabel}>{searchApplied ? "Clear Search" : "Search"}</Text>
          </Pressable>
          <Pressable style={styles.actionsButton} onPress={() => router.push("/(tabs)/scans")}>
            <Ionicons name="qr-code-outline" size={16} color="#ff4fbe" />
            <Text style={styles.actionsButtonLabel}>Scan</Text>
          </Pressable>
        </View>

      </View>
      <Modal
        visible={searchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSearchModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: layout.modalMaxWidth, alignSelf: "center", width: "100%" }]}>
            <Text style={styles.modalTitle}>Search Orders</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Order id, guest, product, status"
              placeholderTextColor="#9ca3af"
              value={searchDraft}
              onChangeText={setSearchDraft}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={() => setSearchModalVisible(false)}>
                <Text style={styles.modalSecondaryLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalSecondary}
                onPress={() => {
                  setSearchApplied("");
                  setSearchDraft("");
                  setSearchModalVisible(false);
                }}
              >
                <Text style={styles.modalSecondaryLabel}>Clear</Text>
              </Pressable>
              <Pressable
                style={styles.modalPrimary}
                onPress={() => {
                  setSearchApplied(searchDraft.trim());
                  setSearchModalVisible(false);
                }}
              >
                <Text style={styles.modalPrimaryLabel}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <CustomDatePicker
        visible={customDateModalVisible}
        value={customDateIso}
        onClose={() => setCustomDateModalVisible(false)}
        onSelect={(dateIso) => {
          setCustomDateIso(dateIso);
          setDateFilter("custom");
          setCustomDateModalVisible(false);
        }}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  scrollContent: {
    paddingBottom: 118
  },
  scrollContentTablet: {
    paddingBottom: 128
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  filterSection: {
    marginBottom: 12,
    backgroundColor: theme.colors.background,
    paddingTop: 2,
    paddingBottom: 2,
    zIndex: 5
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
    flexWrap: "wrap"
  },
  actionsBar: {
    position: "absolute",
    left: -16,
    right: -16,
    bottom: 0,
    backgroundColor: "#14161b",
    borderTopWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: "row",
    gap: 10,
    zIndex: 20,
    elevation: 20
  },
  floatingFilterDock: {
    position: "absolute",
    left: -16,
    right: -16,
    bottom: 50,
    backgroundColor: "#14161b",
    borderTopWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
    zIndex: 19,
    elevation: 19
  },
  filtersGrid: {
    gap: 8
  },
  filterRowGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  actionsButton: {
    flex: 1,
    backgroundColor: "#101217",
    borderWidth: 1,
    borderColor: "#2d3138",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  actionsButtonLabel: {
    color: "#ff4fbe",
    fontWeight: "800"
  },
  filterButton: {
    borderWidth: 1,
    borderColor: "#2d3138",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#101217"
  },
  filterButtonActive: {
    backgroundColor: "#ff4fbe",
    borderColor: "#ff4fbe"
  },
  filterLabel: {
    color: "#ff4fbe",
    fontWeight: "700",
    fontSize: 12
  },
  chip: {
    borderWidth: 1,
    borderColor: "#2d3138",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#101217"
  },
  chipActive: {
    backgroundColor: "#ff4fbe",
    borderColor: "#ff4fbe"
  },
  chipLabel: {
    color: "#ff4fbe",
    fontWeight: "700",
    fontSize: 12
  },
  chipLabelActive: {
    color: "#0b1220"
  },
  searchActive: {
    marginBottom: 4,
    color: theme.colors.mutedText,
    fontWeight: "600",
    fontSize: 11
  },
  error: {
    color: theme.colors.danger,
    marginBottom: 10
  },
  meta: {
    color: theme.colors.mutedText,
    marginBottom: 10
  },
  paginationBar: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  paginationInfo: {
    flexShrink: 1,
    paddingRight: 8
  },
  paginationTotal: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 12
  },
  paginationMeta: {
    marginTop: 1,
    color: theme.colors.mutedText,
    fontSize: 10,
    fontWeight: "600"
  },
  paginationActions: {
    flexDirection: "row",
    gap: 6
  },
  pageButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    width: 34,
    height: 30,
    justifyContent: "center",
    alignItems: "center"
  },
  pageButtonDisabled: {
    opacity: 0.5
  },
  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1
  },
  heroCardPast: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb"
  },
  heroCardToday: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1"
  },
  heroCardTomorrow: {
    backgroundColor: "#ffffff",
    borderColor: "#bfdbfe"
  },
  heroCardLater: {
    backgroundColor: "#ffffff",
    borderColor: "#fed7aa"
  },
  heroCardRedeemed: {
    backgroundColor: "#ecfdf3",
    borderColor: "#86efac"
  },
  heroCardPartiallyRedeemed: {
    backgroundColor: "#fffbeb",
    borderColor: "#fcd34d"
  },
  heroOrderId: {
    color: "#cc3f97",
    fontWeight: "700",
    marginBottom: 2,
    fontSize: 12
  },
  heroGuest: {
    color: theme.colors.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800"
  },
  heroDate: {
    marginTop: 4,
    color: theme.colors.mutedText,
    fontSize: 12
  },
  heroMeta: {
    marginTop: 4,
    color: theme.colors.text,
    fontWeight: "600",
    fontSize: 12
  },
  heroBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  heroBadgeText: {
    color: "#3e1240",
    fontWeight: "700",
    fontSize: 11
  },
  heroDateStateChip: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  chipContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  heroDateStateChipPast: {
    backgroundColor: "#f3f4f6"
  },
  heroDateStateChipToday: {
    backgroundColor: "#dcfce7"
  },
  heroDateStateChipTomorrow: {
    backgroundColor: "#dbeafe"
  },
  heroDateStateChipLater: {
    backgroundColor: "#fef3c7"
  },
  heroDateStateChipRedeemed: {
    backgroundColor: "#bbf7d0"
  },
  heroDateStateChipPartiallyRedeemed: {
    backgroundColor: "#fde68a"
  },
  heroDateStateChipLabel: {
    color: "#374151",
    fontWeight: "700",
    fontSize: 11
  },
  heroDateStateChipLabelRedeemed: {
    color: "#166534"
  },
  heroDateStateChipLabelPartiallyRedeemed: {
    color: "#92400e"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 24, 40, 0.35)",
    justifyContent: "center",
    padding: 20
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f4bde0"
  },
  modalTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 18,
    marginBottom: 10
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#fff",
    color: theme.colors.text
  },
  modalActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8
  },
  modalPrimary: {
    flex: 1,
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center"
  },
  modalPrimaryLabel: {
    color: "#3e1240",
    fontWeight: "800"
  },
  modalSecondary: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center"
  },
  modalSecondaryLabel: {
    color: "#111827",
    fontWeight: "700"
  },
  calendarCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f4bde0"
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
    backgroundColor: "#fff2fb",
    alignItems: "center",
    justifyContent: "center"
  },
  calendarTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  calendarSubtitle: {
    marginTop: 10,
    marginBottom: 12,
    color: theme.colors.mutedText,
    fontWeight: "600",
    textAlign: "center"
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 6
  },
  weekDay: {
    flex: 1,
    color: theme.colors.mutedText,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  dayCellSelected: {
    backgroundColor: theme.colors.accent
  },
  dayText: {
    color: theme.colors.text,
    fontWeight: "700"
  },
  dayTextMuted: {
    color: "#b7bfcb"
  },
  dayTextSelected: {
    color: "#3e1240",
    fontWeight: "800"
  },
  calendarClose: {
    marginTop: 14,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center"
  },
  calendarCloseLabel: {
    color: "#111827",
    fontWeight: "700"
  }
});
