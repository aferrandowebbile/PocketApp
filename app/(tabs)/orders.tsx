import React, { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { theme } from "@/constants/theme";
import { listOrdersPage, type PagingInfo, type RemoteOrder } from "@/services/ordersClient";
import { cacheOrder } from "@/lib/orderStore";

const pageSize = 10;
const sortByPurchaseDateDesc = "completed_at_day:desc";
type DateField = "purchase" | "start";
type DateRangeFilter = "all" | "today" | "tomorrow" | "weekend";
type OrderTotals = { numProducts: number | null; amount: number | null; currency: string | null };

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
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

export default function OrdersScreen() {
  const [orders, setOrders] = useState<RemoteOrder[]>([]);
  const [offset, setOffset] = useState(0);
  const [paging, setPaging] = useState<PagingInfo>({ total: null, start: 0, limit: pageSize });
  const [dateField, setDateField] = useState<DateField>("purchase");
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>("all");
  const [searchApplied, setSearchApplied] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchModalVisible, setSearchModalVisible] = useState(false);
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
        sort: sortByPurchaseDateDesc
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
  }, []);

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
      return isInThisWeekend(parsedDate, now);
    });
  }, [dateField, dateFilter, orders]);

  const isDateFilterActive = dateFilter !== "all";
  const dateFilterLabel =
    dateFilter === "today"
      ? "Today"
      : dateFilter === "tomorrow"
        ? "Tomorrow"
        : dateFilter === "weekend"
          ? "This Weekend"
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

  const ordersTitleChip = paging.total === null ? "-" : String(paging.total);

  return (
    <AppShell title="Orders" titleChip={ordersTitleChip}>
      <View style={styles.screen}>
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(offset, "refresh")} />}
          stickyHeaderIndices={[0]}
          contentContainerStyle={styles.scrollContent}
          scrollEventThrottle={16}
          onScroll={({ nativeEvent }) => {
            const nearBottom =
              nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 280;
            if (!nearBottom || loading || loadingMore || refreshing || !canLoadMore) return;
            load(offset + paging.limit, "loading", true).catch(() => undefined);
          }}
        >
          <View style={styles.filterSection}>
            <View style={styles.filterRow}>
              <Pressable
                style={[styles.filterButton, dateField === "purchase" ? styles.filterButtonActive : null]}
                onPress={() => setDateField("purchase")}
              >
                <Text style={styles.filterLabel}>Purchase Date</Text>
              </Pressable>
              <Pressable
                style={[styles.filterButton, dateField === "start" ? styles.filterButtonActive : null]}
                onPress={() => setDateField("start")}
              >
                <Text style={styles.filterLabel}>Start Date</Text>
              </Pressable>
            </View>
            <View style={styles.filterRow}>
              {(["all", "today", "tomorrow", "weekend"] as DateRangeFilter[]).map((filter) => (
                <Pressable
                  key={filter}
                  style={[styles.chip, dateFilter === filter ? styles.chipActive : null]}
                  onPress={() => setDateFilter(filter)}
                >
                  <Text style={styles.chipLabel}>
                    {filter === "all"
                      ? "All"
                      : filter === "today"
                        ? "Today"
                        : filter === "tomorrow"
                          ? "Tomorrow"
                          : "This Weekend"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {searchApplied ? <Text style={styles.searchActive}>Active search: {searchApplied}</Text> : null}
            <View style={styles.paginationBar}>
              <View>
                <Text style={styles.paginationTotal}>{totalLabel}</Text>
                <Text style={styles.paginationMeta}>
                  {loadedLabel} • Page {currentPage}
                </Text>
                <Text style={styles.paginationMeta}>
                  Showing {pageLabel}
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

          {filteredOrders.map((order) => {
            const totals = extractOrderTotals(order);
            const cardNumProducts = totals.numProducts ?? order.productCount;
            const cardPrice = formatPrice(totals.amount ?? order.totalPrice, totals.currency ?? order.currency);
            return (
              <Pressable
                key={order.id}
                style={styles.heroCard}
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
                      startDate: order.startDate ?? ""
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
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>{order.status.toUpperCase()}</Text>
                </View>
              </Pressable>
            );
          })}
          {loadingMore ? <Text style={styles.meta}>Loading more orders...</Text> : null}
        </ScrollView>

        <View style={styles.actionsBar}>
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
            <Text style={styles.actionsButtonLabel}>{searchApplied ? "Clear Search" : "Search"}</Text>
          </Pressable>
          <Pressable style={styles.actionsButton} onPress={() => router.push("/scan-ticket")}>
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
          <View style={styles.modalCard}>
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
    </AppShell>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 108
  },
  filterSection: {
    marginBottom: 12,
    backgroundColor: theme.colors.background,
    paddingTop: 4,
    paddingBottom: 4
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap"
  },
  actionsBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: "row",
    gap: 8
  },
  actionsButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#f4bde0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  actionsButtonLabel: {
    color: "#a72678",
    fontWeight: "800"
  },
  filterButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff"
  },
  filterButtonActive: {
    backgroundColor: "#fff2fb",
    borderColor: "#f4bde0"
  },
  filterLabel: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 12
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff"
  },
  chipActive: {
    backgroundColor: theme.colors.accent,
    borderColor: "#f4bde0"
  },
  chipLabel: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 12
  },
  searchActive: {
    marginBottom: 6,
    color: theme.colors.mutedText,
    fontWeight: "600",
    fontSize: 12
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
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 3,
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  paginationTotal: {
    color: theme.colors.text,
    fontWeight: "800"
  },
  paginationMeta: {
    marginTop: 2,
    color: theme.colors.mutedText,
    fontSize: 11,
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
    backgroundColor: "#fff8fc",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ffd7ef",
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1
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
  }
});
