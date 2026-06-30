import React from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { theme } from "@/constants/theme";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useAuth } from "@/lib/auth";
import { getCachedGuest } from "@/lib/guestStore";
import { cacheOrder } from "@/lib/orderStore";
import { getOrderByIdMinimal, listCustomerOrdersWithDebug, listOrdersByCustomerSearchWithDebug, type RemoteOrder } from "@/services/ordersClient";

type GuestDetailParams = {
  id?: string | string[];
  fullName?: string | string[];
  email?: string | string[];
  phone?: string | string[];
  externalRef?: string | string[];
  completedAt?: string | string[];
  createdAt?: string | string[];
};

function asParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

export default function GuestDetailScreen() {
  const params = useLocalSearchParams<GuestDetailParams>();
  const layout = useResponsiveLayout();
  const { profile } = useAuth();
  const tenantId = profile?.connect_client_id ?? undefined;
  const id = asParam(params.id);
  const cached = id ? getCachedGuest(id) : null;

  const fullName = cached?.fullName ?? (asParam(params.fullName) || "Unknown guest");
  const email = cached?.email ?? (asParam(params.email) || "-");
  const phone = cached?.phone ?? (asParam(params.phone) || "-");
  const externalRef = cached?.externalRef ?? (asParam(params.externalRef) || "-");
  const completedAt = cached?.completedAt ?? (asParam(params.completedAt) || null);
  const createdAt = cached?.createdAt ?? (asParam(params.createdAt) || null);

  const [orders, setOrders] = React.useState<RemoteOrder[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [openingOrderId, setOpeningOrderId] = React.useState<string | null>(null);
  const orderCardWidth = layout.cardColumns === 3 ? "31.5%" : layout.cardColumns === 2 ? "48.5%" : "100%";

  const loadOrders = React.useCallback(async () => {
    if (!id) {
      setError("Missing guest id.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const queryCustomer = (cached?.email ?? asParam(params.email)).trim();
      const result = queryCustomer
        ? await listOrdersByCustomerSearchWithDebug(queryCustomer, "partial")
        : await listCustomerOrdersWithDebug(id, tenantId);
      setOrders(result.items);
    } catch (loadError) {
      setOrders([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load guest orders.");
    } finally {
      setLoading(false);
    }
  }, [id, tenantId]);

  React.useEffect(() => {
    loadOrders().catch(() => undefined);
  }, [loadOrders]);

  return (
    <AppShell title="Guest Detail">
      <ScrollView contentContainerStyle={[styles.content, layout.isTablet ? styles.contentTablet : null]} showsVerticalScrollIndicator={false}>
        <Pressable
          style={styles.back}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace("/(tabs)/guests");
          }}
        >
          <Text style={styles.backLabel}>Back to guests</Text>
        </Pressable>

        <View style={[styles.topGrid, layout.isTablet ? styles.topGridTablet : null]}>
          <View style={[styles.hero, layout.isTablet ? styles.heroTablet : null]}>
            <Text style={styles.id}>#{id || "N/A"}</Text>
            <Text style={styles.name}>{fullName}</Text>
            <Text style={styles.meta}>Purchase: {formatDate(completedAt)}</Text>
            <Text style={styles.meta}>Created: {formatDate(createdAt)}</Text>
          </View>

          <View style={[styles.infoCard, layout.isTablet ? styles.infoCardTablet : null]}>
            <Text style={styles.infoLine}>Email: {email}</Text>
            <Text style={styles.infoLine}>Phone: {phone}</Text>
            <Text style={styles.infoLine}>External Ref: {externalRef}</Text>
          </View>
        </View>

        <View style={styles.ordersHeader}>
          <Text style={styles.ordersTitle}>Orders ({loading ? "..." : orders.length})</Text>
          <Pressable style={styles.refreshButton} onPress={() => loadOrders().catch(() => undefined)} disabled={loading}>
            <Text style={styles.refreshLabel}>{loading ? "Refreshing..." : "Refresh"}</Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color={theme.colors.accentDark} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !error && orders.length === 0 ? <Text style={styles.empty}>No orders for this guest.</Text> : null}

        <View style={styles.ordersGrid}>
          {orders.map((order) => (
            <Pressable
              key={order.id}
              style={[styles.orderCard, { width: orderCardWidth }]}
              onPress={async () => {
                setOpeningOrderId(order.id);
                let resolved = order;
                try {
                  const fetched = await getOrderByIdMinimal(order.id, tenantId);
                  if (fetched) resolved = fetched;
                } catch {
                  // Keep list row payload as fallback.
                } finally {
                  setOpeningOrderId(null);
                }

                cacheOrder(resolved);
                router.push({
                  pathname: "/order/[id]",
                  params: {
                    id: resolved.id,
                    guestName: resolved.guestName,
                    product: resolved.product,
                    quantity: String(resolved.quantity),
                    totalPrice: resolved.totalPrice === null ? "" : String(resolved.totalPrice),
                    currency: resolved.currency ?? "",
                    status: resolved.status,
                    date: resolved.date,
                    startDate: resolved.startDate ?? "",
                    tenantId: tenantId ?? "",
                    lookupMode: "minimal"
                  }
                });
              }}
            >
              <Text style={styles.orderId}>#{order.id}</Text>
              <Text style={styles.orderMeta}>Purchase: {formatDate(order.date)}</Text>
              {order.startDate ? <Text style={styles.orderMeta}>Start: {formatDate(order.startDate)}</Text> : null}
              <Text style={styles.orderMeta}>Qty: {order.productCount}</Text>
              <Text style={styles.orderMeta}>
                Price: {order.totalPrice !== null ? `${order.totalPrice}${order.currency ? ` ${order.currency}` : ""}` : "-"}
              </Text>
              {openingOrderId === order.id ? <Text style={styles.opening}>Opening order...</Text> : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 16
  },
  contentTablet: {
    paddingBottom: 24
  },
  topGrid: {
    gap: 10
  },
  topGridTablet: {
    flexDirection: "row",
    alignItems: "stretch"
  },
  back: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 10
  },
  backLabel: {
    color: "#374151",
    fontWeight: "700"
  },
  hero: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    marginBottom: 10
  },
  heroTablet: {
    flex: 1.1,
    marginBottom: 0
  },
  id: {
    color: "#cc3f97",
    fontWeight: "700",
    fontSize: 12
  },
  name: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 24,
    marginTop: 2
  },
  meta: {
    color: theme.colors.mutedText,
    marginTop: 4
  },
  infoCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#fff"
  },
  infoCardTablet: {
    flex: 0.9,
    marginBottom: 0
  },
  infoLine: {
    color: theme.colors.text,
    marginBottom: 4
  },
  ordersHeader: {
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  ordersTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 18
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: "#f4bde0",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  refreshLabel: {
    color: "#a72678",
    fontWeight: "700",
    fontSize: 12
  },
  loader: {
    marginBottom: 8
  },
  error: {
    color: theme.colors.danger,
    marginBottom: 8
  },
  empty: {
    color: theme.colors.mutedText,
    marginBottom: 8
  },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    marginBottom: 8
  },
  ordersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  orderId: {
    color: "#cc3f97",
    fontWeight: "700",
    marginBottom: 3
  },
  orderMeta: {
    color: theme.colors.text,
    fontSize: 12,
    marginTop: 2
  },
  opening: {
    marginTop: 6,
    color: theme.colors.mutedText,
    fontSize: 12
  }
});
