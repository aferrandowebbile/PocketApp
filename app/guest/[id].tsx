import React from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { theme } from "@/constants/theme";
import { getCachedGuest } from "@/lib/guestStore";
import { cacheOrder } from "@/lib/orderStore";
import { listCustomerOrders, type RemoteOrder } from "@/services/ordersClient";

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

export default function GuestDetailScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    externalRef?: string;
    completedAt?: string;
    createdAt?: string;
  }>();

  const id = typeof params.id === "string" ? params.id : "";
  const cached = id ? getCachedGuest(id) : null;
  const fullName = cached?.fullName ?? (typeof params.fullName === "string" ? params.fullName : "Unknown guest");
  const email = cached?.email ?? (typeof params.email === "string" ? params.email : null);
  const phone = cached?.phone ?? (typeof params.phone === "string" ? params.phone : null);
  const externalRef = cached?.externalRef ?? (typeof params.externalRef === "string" ? params.externalRef : null);
  const completedAt = cached?.completedAt ?? (typeof params.completedAt === "string" ? params.completedAt : null);
  const createdAt = cached?.createdAt ?? (typeof params.createdAt === "string" ? params.createdAt : null);
  const [rawOpen, setRawOpen] = React.useState(false);
  const [orders, setOrders] = React.useState<RemoteOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = React.useState(false);
  const [ordersError, setOrdersError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;

    setOrdersLoading(true);
    setOrdersError(null);

    listCustomerOrders(id)
      .then((data) => {
        setOrders(data);
      })
      .catch((error: unknown) => {
        setOrdersError(error instanceof Error ? error.message : "Failed to load guest orders.");
      })
      .finally(() => {
        setOrdersLoading(false);
      });
  }, [id]);

  return (
    <AppShell title="Guest Detail">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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

        <View style={styles.hero}>
          <Text style={styles.guestId}>#{id || "N/A"}</Text>
          <Text style={styles.guest}>{fullName}</Text>
          <Text style={styles.date}>Purchase: {formatDate(completedAt)}</Text>
          <Text style={styles.date}>Created: {formatDate(createdAt)}</Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>GUEST</Text>
            </View>
            <View style={styles.orderCountBadge}>
              <Text style={styles.orderCountText}>Orders: {ordersLoading ? "..." : orders.length}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Guest Information</Text>
        <Card
          title={fullName}
          subtitle={`Email: ${email || "-"}\nPhone: ${phone || "-"}\nExternal Ref: ${externalRef || "-"}`}
        />

        <Text style={styles.sectionTitle}>Orders ({ordersLoading ? "..." : orders.length})</Text>
        {ordersLoading ? <ActivityIndicator color={theme.colors.accentDark} style={styles.loader} /> : null}
        {ordersError ? <Text style={styles.error}>{ordersError}</Text> : null}
        {!ordersLoading && !ordersError && !orders.length ? <Text style={styles.empty}>No orders for this guest.</Text> : null}
        {orders.map((order) => (
          <Pressable
            key={order.id}
            style={styles.orderCard}
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
            <Text style={styles.orderId}>#{order.id}</Text>
            <Text style={styles.orderGuest}>{order.product}</Text>
            <Text style={styles.orderMeta}>Purchase: {formatDate(order.date)}</Text>
            {order.startDate ? <Text style={styles.orderMeta}>Start date: {formatDate(order.startDate)}</Text> : null}
            <Text style={styles.orderMeta}>{`Quantity: ${order.productCount}`}</Text>
            <Text style={styles.orderMeta}>
              Price:{" "}
              {order.totalPrice !== null
                ? `${order.totalPrice}${order.currency ? ` ${order.currency}` : ""}`
                : "-"}
            </Text>
            <View style={styles.orderBadge}>
              <Text style={styles.orderBadgeText}>{order.status.toUpperCase()}</Text>
            </View>
          </Pressable>
        ))}

        {cached?.raw ? (
          <View style={styles.accordionWrap}>
            <Pressable style={styles.accordionHeader} onPress={() => setRawOpen((prev) => !prev)}>
              <Text style={styles.accordionTitle}>Raw Payload (Debug)</Text>
              <Text style={styles.accordionChevron}>{rawOpen ? "▲" : "▼"}</Text>
            </Pressable>
            {rawOpen ? <Card title="Payload" subtitle={JSON.stringify(cached.raw, null, 2)} /> : null}
          </View>
        ) : null}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 16
  },
  back: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff5fb",
    borderWidth: 1,
    borderColor: "#ffd7ef",
    marginBottom: 10
  },
  backLabel: {
    color: "#a72678",
    fontWeight: "700"
  },
  hero: {
    backgroundColor: "#fff8fc",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ffd7ef",
    padding: 16,
    marginBottom: 12
  },
  guestId: {
    color: "#cc3f97",
    fontWeight: "700",
    marginBottom: 4
  },
  guest: {
    color: theme.colors.text,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800"
  },
  date: {
    marginTop: 6,
    color: theme.colors.mutedText
  },
  heroMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  orderCountBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ffd7ef",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  orderCountText: {
    color: "#a72678",
    fontWeight: "700",
    fontSize: 12
  },
  badgeText: {
    color: "#3e1240",
    fontWeight: "700",
    fontSize: 12
  },
  sectionTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 18,
    marginBottom: 8
  },
  accordionWrap: {
    marginBottom: 12
  },
  accordionHeader: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  accordionTitle: {
    color: theme.colors.text,
    fontWeight: "700"
  },
  accordionChevron: {
    color: theme.colors.mutedText,
    fontWeight: "700"
  },
  loader: {
    marginTop: 4,
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
  orderId: {
    color: "#cc3f97",
    fontWeight: "700",
    marginBottom: 2,
    fontSize: 12
  },
  orderGuest: {
    color: theme.colors.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800"
  },
  orderMeta: {
    marginTop: 4,
    color: theme.colors.text,
    fontWeight: "600",
    fontSize: 12
  },
  orderBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  orderBadgeText: {
    color: "#3e1240",
    fontWeight: "700",
    fontSize: 11
  }
});
