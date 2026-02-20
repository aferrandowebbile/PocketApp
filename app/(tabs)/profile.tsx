import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { listNotifications } from "@/services/db/notifications";
import { listArrivalsToday } from "@/services/db/commerce";
import { zendeskClient } from "@/services/zendeskClient";
import { supabase } from "@/lib/supabase";

type ProfileStats = {
  unreadNotifications: number;
  ticketsCount: number;
  arrivalsToday: number;
  validationsToday: number;
};

const initialStats: ProfileStats = {
  unreadNotifications: 0,
  ticketsCount: 0,
  arrivalsToday: 0,
  validationsToday: 0
};

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function ProfileScreen() {
  const { profile, user, signOut } = useAuth();
  const [stats, setStats] = useState<ProfileStats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fullName = useMemo(() => {
    if (!profile) return "Spotlio User";
    return `${profile.first_name} ${profile.last_name}`.trim();
  }, [profile]);

  const avatarUri = useMemo(() => {
    const fromMetadata = user?.user_metadata?.avatar_url as string | undefined;
    if (fromMetadata && fromMetadata.length > 0) return fromMetadata;
    const encoded = encodeURIComponent(fullName || "Spotlio User");
    return `https://ui-avatars.com/api/?name=${encoded}&background=fcb4e0&color=3d0f35&size=256`;
  }, [fullName, user?.user_metadata]);

  const loadProfileStats = useCallback(async () => {
    if (!profile?.company_id) return;
    const todayIso = new Date().toISOString().slice(0, 10);
    const startOfDay = `${todayIso}T00:00:00.000Z`;

    const [notificationsResult, ticketsResult, arrivalsResult, validationsResult] = await Promise.all([
      listNotifications(profile.company_id, profile.id).catch(() => []),
      zendeskClient.getTickets(profile.company_id).catch(() => []),
      listArrivalsToday(profile.company_id, todayIso).catch(() => []),
      supabase
        .from("validations")
        .select("id", { count: "exact", head: true })
        .eq("company_id", profile.company_id)
        .eq("validated_by", profile.id)
        .gte("validated_at", startOfDay)
    ]);

    const unreadNotifications = notificationsResult.filter((item) => !item.read_at).length;
    const validationsToday = validationsResult.count ?? 0;

    setStats({
      unreadNotifications,
      ticketsCount: ticketsResult.length,
      arrivalsToday: arrivalsResult.length,
      validationsToday
    });
  }, [profile?.company_id, profile?.id]);

  useEffect(() => {
    setLoading(true);
    loadProfileStats()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [loadProfileStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfileStats().catch(() => undefined);
    setRefreshing(false);
  }, [loadProfileStats]);

  return (
    <AppShell title="Profile">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accentDark} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroGlowLarge} />
          <View style={styles.heroGlowSmall} />
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.username}>@{profile?.email?.split("@")[0] ?? "spotlio-user"}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{titleCase(profile?.role ?? "viewer")}</Text>
          </View>
          <Text style={styles.company}>Company {profile?.company_id ?? "-"}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Unread</Text>
            <Text style={styles.statValue}>{loading ? "-" : stats.unreadNotifications}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Tickets</Text>
            <Text style={styles.statValue}>{loading ? "-" : stats.ticketsCount}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Arrivals</Text>
            <Text style={styles.statValue}>{loading ? "-" : stats.arrivalsToday}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Checks</Text>
            <Text style={styles.statValue}>{loading ? "-" : stats.validationsToday}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Full name</Text>
            <Text style={styles.value}>{fullName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{profile?.email ?? "-"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Role</Text>
            <Text style={styles.value}>{titleCase(profile?.role ?? "-")}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Member since</Text>
            <Text style={styles.value}>
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Pressable style={styles.action}>
            <Text style={styles.actionTitle}>Profile settings</Text>
            <Text style={styles.actionSubtitle}>Update personal details and preferences</Text>
          </Pressable>
          <Pressable style={styles.action}>
            <Text style={styles.actionTitle}>Notifications</Text>
            <Text style={styles.actionSubtitle}>Review unread alerts and ticket updates</Text>
          </Pressable>
          <Pressable style={styles.action}>
            <Text style={styles.actionTitle}>Support access</Text>
            <Text style={styles.actionSubtitle}>Role-based permissions: {titleCase(profile?.role ?? "viewer")}</Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color={theme.colors.accentDark} style={styles.loader} /> : null}
        <PrimaryButton label="Sign out" onPress={() => signOut().catch(() => undefined)} />
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderWidth: 1,
    borderColor: "#ffd7ef",
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    alignItems: "center",
    backgroundColor: "#fff8fc",
    overflow: "hidden"
  },
  heroGlowLarge: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "#fbd3ea",
    top: -120,
    right: -80
  },
  heroGlowSmall: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "#ffe7f5",
    bottom: -70,
    left: -50
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: "#fff"
  },
  name: {
    marginTop: 10,
    fontSize: 26,
    fontWeight: "800",
    color: theme.colors.text
  },
  username: {
    marginTop: 2,
    color: "#7b869a",
    fontWeight: "600"
  },
  badge: {
    marginTop: 10,
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  badgeText: {
    color: "#3e1240",
    fontWeight: "700",
    fontSize: 12
  },
  company: {
    marginTop: 10,
    color: theme.colors.mutedText
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12
  },
  statCard: {
    width: "48.5%",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#fff"
  },
  statLabel: {
    color: theme.colors.mutedText,
    fontSize: 12
  },
  statValue: {
    marginTop: 6,
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "800"
  },
  section: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10
  },
  row: {
    marginTop: 8
  },
  label: {
    color: theme.colors.mutedText,
    fontSize: 12
  },
  value: {
    marginTop: 2,
    color: theme.colors.text,
    fontWeight: "600"
  },
  action: {
    borderWidth: 1,
    borderColor: "#f2e4ee",
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    backgroundColor: "#fffafc"
  },
  actionTitle: {
    color: theme.colors.text,
    fontWeight: "700"
  },
  actionSubtitle: {
    marginTop: 3,
    color: theme.colors.mutedText,
    fontSize: 12
  },
  loader: {
    marginBottom: 12
  }
});
