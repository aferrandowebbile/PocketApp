import React, { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { theme } from "@/constants/theme";
import { listOrders, type RemoteOrder } from "@/services/ordersClient";
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
  const [dateField, setDateField] = useState<DateField>("purchase");
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>("all");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (nextOffset: number, mode: "loading" | "refresh" = "loading") => {
    if (mode === "loading") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    setError(null);

    try {
      const data = await listOrders({
        limit: pageSize,
        offset: nextOffset,
        sort: sortByPurchaseDateDesc
      });
      setOrders(data);
      setOffset(nextOffset);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load orders");
    } finally {
      if (mode === "loading") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  };

  useEffect(() => {
    load(0).catch(() => undefined);
  }, []);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    return orders.filter((order) => {
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

  return (
    <AppShell title="Orders">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(offset, "refresh")} />}
        stickyHeaderIndices={[0]}
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

        <View style={styles.pagination}>
          <Pressable
            style={[styles.pageButton, offset === 0 ? styles.pageButtonDisabled : null]}
            disabled={offset === 0 || loading}
            onPress={() => load(Math.max(offset - pageSize, 0))}
          >
            <Text style={styles.pageButtonLabel}>Previous</Text>
          </Pressable>
          <Text style={styles.meta}>Offset {offset}</Text>
          <Pressable style={styles.pageButton} disabled={loading} onPress={() => load(offset + pageSize)}>
            <Text style={styles.pageButtonLabel}>Next</Text>
          </Pressable>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
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
  error: {
    color: theme.colors.danger,
    marginBottom: 10
  },
  meta: {
    color: theme.colors.mutedText,
    marginBottom: 10
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20
  },
  pageButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  pageButtonDisabled: {
    opacity: 0.5
  },
  pageButtonLabel: {
    fontWeight: "700",
    color: "#3e1240"
  },
  heroCard: {
    backgroundColor: "#fff8fc",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ffd7ef",
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  heroOrderId: {
    color: "#cc3f97",
    fontWeight: "700",
    marginBottom: 4
  },
  heroGuest: {
    color: theme.colors.text,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800"
  },
  heroDate: {
    marginTop: 6,
    color: theme.colors.mutedText
  },
  heroMeta: {
    marginTop: 6,
    color: theme.colors.text,
    fontWeight: "600"
  },
  heroBadge: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  heroBadgeText: {
    color: "#3e1240",
    fontWeight: "700",
    fontSize: 12
  }
});
