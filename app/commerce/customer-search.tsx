import React, { useMemo, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { theme } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { canAccessCommerce } from "@/lib/permissions";
import { searchCustomers } from "@/services/db/commerce";
import type { Customer } from "@/types/domain";

export default function CustomerSearchScreen() {
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSearch = useMemo(() => canAccessCommerce(profile), [profile]);

  const runSearch = async (value: string) => {
    if (!profile?.company_id || !canSearch) return;
    const normalized = value.trim();
    setQuery(value);
    setError(null);
    if (!normalized) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await searchCustomers(profile.company_id, normalized);
      setResults(data);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed");
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  if (!canSearch) {
    router.replace("/(tabs)/home");
    return null;
  }

  return (
    <AppShell title="Customer Search">
      <TextInput
        style={styles.input}
        placeholder="Name, email, phone, external ref"
        value={query}
        onChangeText={(v) => runSearch(v).catch(() => undefined)}
      />
      {loading ? <ActivityIndicator color={theme.colors.accentDark} style={styles.loading} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ScrollView>
        {results.map((customer) => (
          <Card
            key={customer.id}
            title={`${customer.first_name} ${customer.last_name}`}
            subtitle={`${customer.email ?? "No email"} • ${customer.phone ?? "No phone"}`}
            onPress={() => router.push(`/commerce/purchase/${customer.id}?entity=customer`)}
          />
        ))}
        {!loading && !results.length && query.trim() ? <Text style={styles.empty}>No matching customers.</Text> : null}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12
  },
  empty: {
    color: theme.colors.mutedText
  },
  loading: {
    marginBottom: 10
  },
  error: {
    marginBottom: 8,
    color: theme.colors.danger
  }
});
