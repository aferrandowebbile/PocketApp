import React, { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { listNotifications } from "@/services/db/notifications";
import { listArrivalsToday } from "@/services/db/commerce";

type ProfileStats = {
  unreadNotifications: number;
  arrivalsToday: number;
  validationsToday: number;
};

const initialStats: ProfileStats = {
  unreadNotifications: 0,
  arrivalsToday: 0,
  validationsToday: 0
};

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function ProfileScreen() {
  const { profile, user, signOut, sites, selectedSiteAlias, selectSite } = useAuth();
  const [stats, setStats] = useState<ProfileStats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [siteBusy, setSiteBusy] = useState(false);

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

    const [notificationsResult, arrivalsResult] = await Promise.all([
      listNotifications(profile.company_id, profile.id).catch(() => []),
      listArrivalsToday(profile.company_id, todayIso).catch(() => [])
    ]);

    const unreadNotifications = notificationsResult.filter((item) => !item.read_at).length;
    const validationsToday = 0;

    setStats({
      unreadNotifications,
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
            <Text style={styles.statLabel}>Arrivals</Text>
            <Text style={styles.statValue}>{loading ? "-" : stats.arrivalsToday}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Checks</Text>
            <Text style={styles.statValue}>{loading ? "-" : stats.validationsToday}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Role</Text>
            <Text style={styles.statValue}>{titleCase(profile?.role ?? "viewer")}</Text>
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
            <Text style={styles.actionSubtitle}>Review unread alerts and operation updates</Text>
          </Pressable>
          <Pressable style={styles.action}>
            <Text style={styles.actionTitle}>Access level</Text>
            <Text style={styles.actionSubtitle}>Role-based permissions: {titleCase(profile?.role ?? "viewer")}</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Site</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Selected alias</Text>
            <Text style={styles.value}>{selectedSiteAlias ?? "-"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Selected name</Text>
            <Text style={styles.value}>{sites.find((site) => site.alias === selectedSiteAlias)?.name ?? "-"}</Text>
          </View>
          <Pressable style={styles.action} onPress={() => setSiteModalOpen(true)} disabled={!sites.length || siteBusy}>
            <Text style={styles.actionTitle}>Change site</Text>
            <Text style={styles.actionSubtitle}>
              {sites.length ? "Choose by site name. Alias will be used as API client." : "No sites found in /users/me response."}
            </Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color={theme.colors.accentDark} style={styles.loader} /> : null}
        <PrimaryButton label="Sign out" onPress={() => signOut().catch(() => undefined)} />
      </ScrollView>
      <Modal visible={siteModalOpen} transparent animationType="fade" onRequestClose={() => setSiteModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.siteKicker}>Site Access</Text>
            <Text style={styles.modalTitle}>Choose a site</Text>
            <Text style={styles.modalSubtitle}>This site will be used as the Connect API client for orders, guests, commerce, and scans.</Text>

            <ScrollView contentContainerStyle={styles.siteList}>
              {sites.map((site) => {
                const isActive = site.alias === selectedSiteAlias;
                return (
                  <Pressable
                    key={site.id}
                    style={[styles.siteOption, isActive ? styles.siteOptionActive : null]}
                    disabled={siteBusy}
                    onPress={async () => {
                      try {
                        setSiteBusy(true);
                        await selectSite(site.alias);
                        setSiteModalOpen(false);
                        router.replace("/(tabs)/dashboard");
                      } finally {
                        setSiteBusy(false);
                      }
                    }}
                  >
                    <View style={styles.siteOptionText}>
                      <Text style={styles.siteName}>{site.name}</Text>
                      <Text style={styles.siteAlias}>{site.alias}</Text>
                    </View>
                    <Text style={styles.siteAction}>{siteBusy ? "Selecting..." : isActive ? "Active" : "Use"}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {!sites.length ? <Text style={styles.siteError}>No sites found for this Directus user.</Text> : null}
            <Pressable style={styles.secondaryAction} onPress={() => setSiteModalOpen(false)} disabled={siteBusy}>
              <Text style={styles.secondaryActionLabel}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    alignItems: "center",
    backgroundColor: "#ffffff",
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
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 24, 40, 0.35)",
    justifyContent: "center",
    padding: 20
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f4bde0",
    maxHeight: "82%"
  },
  siteKicker: {
    color: "#a72678",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7
  },
  modalTitle: {
    marginTop: 6,
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 28,
    lineHeight: 32
  },
  modalSubtitle: {
    marginTop: 8,
    marginBottom: 12,
    color: "#6b7280",
    lineHeight: 20
  },
  siteList: {
    gap: 10,
    paddingBottom: 12
  },
  siteOption: {
    borderWidth: 1,
    borderColor: "#e8dce5",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  siteOptionActive: {
    borderColor: "#f9a8d4",
    backgroundColor: "#ffffff"
  },
  siteOptionText: {
    flex: 1
  },
  siteName: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 16
  },
  siteAlias: {
    marginTop: 3,
    color: "#6b7280"
  },
  siteAction: {
    color: "#a72678",
    fontWeight: "800"
  },
  siteError: {
    color: theme.colors.danger,
    marginBottom: 6
  },
  secondaryAction: {
    alignSelf: "flex-start",
    paddingVertical: 8
  },
  secondaryActionLabel: {
    color: "#6b7280",
    fontWeight: "700"
  }
});
