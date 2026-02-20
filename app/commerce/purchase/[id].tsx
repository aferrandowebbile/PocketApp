import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text } from "react-native";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { theme } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { canAccessCommerce } from "@/lib/permissions";
import { getCustomerDetails, getPurchaseSummary } from "@/services/db/commerce";

export default function PurchaseResultScreen() {
  const params = useLocalSearchParams<{ id: string; entity?: string; status?: string }>();
  const { profile } = useAuth();
  const [title, setTitle] = useState("Purchase");
  const [rows, setRows] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!canAccessCommerce(profile)) {
    router.replace("/(tabs)/home");
    return null;
  }

  useEffect(() => {
    const load = async () => {
      if (!profile?.company_id || !canAccessCommerce(profile)) return;
      setLoading(true);
      setError(null);

      if (params.entity === "customer") {
        const details = await getCustomerDetails(profile.company_id, params.id);

        setTitle("Customer Details");
        setRows([
          `${details.customer.first_name} ${details.customer.last_name}`,
          details.customer.email ?? "No email",
          details.customer.phone ?? "No phone",
          ...details.purchases.map(
            (purchase) =>
              `${purchase.product_name} • ${purchase.status} • ${new Date(purchase.purchased_at).toLocaleDateString()}`
          )
        ]);
        setLoading(false);
        return;
      }

      const purchase = await getPurchaseSummary(profile.company_id, params.id);

      setTitle(params.status === "success" ? "Validation Success" : "Purchase");
      setRows([
        `Purchase ID: ${purchase.id}`,
        `Status: ${purchase.status}`,
        `Customer: ${purchase.customer_name}`,
        `Product: ${purchase.product_name}`,
        `Time: ${new Date().toLocaleString()}`
      ]);
      setLoading(false);
    };

    load().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load details");
      setLoading(false);
    });
  }, [params, profile]);

  return (
    <AppShell title={title}>
      <ScrollView>
        {loading ? <ActivityIndicator color={theme.colors.accentDark} style={styles.loading} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {rows.map((line) => (
          <Card key={line} title={line} />
        ))}
        {!loading && !error && !rows.length ? <Text style={styles.empty}>No details available.</Text> : null}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginTop: 12
  },
  error: {
    color: theme.colors.danger,
    marginTop: 8
  },
  empty: {
    color: theme.colors.mutedText,
    marginTop: 8
  }
});
