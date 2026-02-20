import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text } from "react-native";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { theme } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { useNotificationsRealtime } from "@/hooks/useNotificationsRealtime";
import { listNotifications } from "@/services/db/notifications";
import type { NotificationItem } from "@/types/domain";

export default function NotificationsScreen() {
  const { profile } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!profile?.company_id) return;
      setLoading(true);
      setError(null);
      const data = await listNotifications(profile.company_id, profile.id);
      setItems(data);
      setLoading(false);
    };
    load().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load notifications");
      setLoading(false);
    });
  }, [profile?.company_id, profile?.id]);

  useNotificationsRealtime({
    companyId: profile?.company_id,
    userId: profile?.id,
    onInsert: (notification) => {
      setItems((prev) => [notification, ...prev]);
    }
  });

  return (
    <AppShell title="Notifications">
      <ScrollView>
        {loading ? <ActivityIndicator color={theme.colors.accentDark} style={styles.loading} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !error && items.length === 0 ? <Text style={styles.empty}>No notifications yet.</Text> : null}
        {items.map((item) => (
          <Card
            key={item.id}
            title={item.title}
            subtitle={`${item.body}\n${new Date(item.created_at).toLocaleString()}`}
          />
        ))}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginTop: 8
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
