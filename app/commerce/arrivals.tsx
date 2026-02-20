import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { theme } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { canAccessCommerce } from "@/lib/permissions";
import { listArrivalsToday, markArrivalArrived } from "@/services/db/commerce";
import { listOrders, type RemoteOrder } from "@/services/ordersClient";
import type { Arrival } from "@/types/domain";

export default function ArrivalsScreen() {
  const { profile } = useAuth();
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [orders, setOrders] = useState<RemoteOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [busyArrivalId, setBusyArrivalId] = useState<string | null>(null);
  const [ordersOffset, setOrdersOffset] = useState(0);
  const ordersLimit = 10;

  useEffect(() => {
    const load = async () => {
      if (!profile?.company_id || !canAccessCommerce(profile)) return;
      setLoading(true);
      setError(null);
      const today = new Date().toISOString().slice(0, 10);
      const data = await listArrivalsToday(profile.company_id, today);
      setArrivals(data);
      setLoading(false);
    };

    load().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load arrivals");
      setLoading(false);
    });
  }, [profile]);

  useEffect(() => {
    if (!canAccessCommerce(profile)) return;
    setOrdersLoading(true);
    setOrdersError(null);

    listOrders({
      limit: ordersLimit,
      offset: ordersOffset
    })
      .then((data) => {
        setOrders(data);
      })
      .catch((loadError: unknown) => {
        setOrdersError(loadError instanceof Error ? loadError.message : "Failed to load orders");
      })
      .finally(() => {
        setOrdersLoading(false);
      });
  }, [ordersOffset, profile]);

  const markArrived = async (arrival: Arrival) => {
    if (!profile?.company_id) return;
    setBusyArrivalId(arrival.id);
    setError(null);

    try {
      await markArrivalArrived({
        arrivalId: arrival.id,
        companyId: profile.company_id,
        userId: profile.id,
        purchaseId: arrival.purchase_id
      });
      setArrivals((prev) => prev.map((item) => (item.id === arrival.id ? { ...item, status: "arrived" } : item)));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update arrival");
    } finally {
      setBusyArrivalId(null);
    }
  };

  if (!canAccessCommerce(profile)) {
    router.replace("/(tabs)/home");
    return null;
  }

  return (
    <AppShell title="Arrivals Today">
      <ScrollView>
        {loading ? <ActivityIndicator color={theme.colors.accentDark} style={styles.loading} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !arrivals.length ? <Text style={styles.empty}>No arrivals scheduled for today.</Text> : null}
        {arrivals.map((arrival) => (
          <View key={arrival.id}>
            <Card
              title={`${arrival.customer.first_name} ${arrival.customer.last_name}`}
              subtitle={`Status: ${arrival.status}`}
              onPress={() => {
                if (arrival.purchase_id) {
                  router.push(`/commerce/purchase/${arrival.purchase_id}`);
                }
              }}
            />
            <Pressable
              style={[styles.action, arrival.status === "arrived" ? styles.actionDone : null]}
              onPress={() => markArrived(arrival)}
              disabled={arrival.status === "arrived" || busyArrivalId === arrival.id}
            >
              <Text style={styles.actionLabel}>
                {busyArrivalId === arrival.id
                  ? "Saving..."
                  : arrival.status === "arrived"
                    ? "Already arrived"
                    : `Mark arrived: ${arrival.customer.first_name} ${arrival.customer.last_name}`}
              </Text>
            </Pressable>
          </View>
        ))}

        <Card title="Orders (Connect API)" subtitle={`client=tlml • limit=${ordersLimit} • offset=${ordersOffset}`} />
        {ordersLoading ? <ActivityIndicator color={theme.colors.accentDark} style={styles.loading} /> : null}
        {ordersError ? <Text style={styles.error}>{ordersError}</Text> : null}
        {!ordersLoading && !ordersError && !orders.length ? <Text style={styles.empty}>No orders found for this page.</Text> : null}
        {orders.map((order) => (
          <Card
            key={order.id}
            title={order.guestName}
            subtitle={`Product: ${order.product}\nQty: ${order.quantity}\nStatus: ${order.status}\nDate: ${order.date}`}
          />
        ))}

        <View style={styles.pagination}>
          <Pressable
            style={[styles.pageButton, ordersOffset === 0 ? styles.pageButtonDisabled : null]}
            disabled={ordersOffset === 0 || ordersLoading}
            onPress={() => setOrdersOffset((prev) => Math.max(prev - ordersLimit, 0))}
          >
            <Text style={styles.pageButtonLabel}>Previous</Text>
          </Pressable>
          <Text style={styles.pageInfo}>Offset {ordersOffset}</Text>
          <Pressable style={styles.pageButton} disabled={ordersLoading} onPress={() => setOrdersOffset((prev) => prev + ordersLimit)}>
            <Text style={styles.pageButtonLabel}>Next</Text>
          </Pressable>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  action: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 10
  },
  actionDone: {
    opacity: 0.6
  },
  actionLabel: {
    fontWeight: "700"
  },
  loading: {
    marginTop: 12
  },
  error: {
    marginTop: 8,
    color: theme.colors.danger
  },
  empty: {
    marginTop: 8,
    color: theme.colors.mutedText
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
  pageInfo: {
    color: theme.colors.mutedText,
    fontWeight: "600"
  }
});
