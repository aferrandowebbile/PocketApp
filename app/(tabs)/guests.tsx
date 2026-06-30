import React, { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { theme } from "@/constants/theme";
import { cacheGuest } from "@/lib/guestStore";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useAuth } from "@/lib/auth";
import { listGuestsPage, type GuestsPagingInfo, type RemoteGuest } from "@/services/guestsClient";

const pageSize = 10;
const defaultSort = "completed_at_day:desc";

export default function GuestsScreen() {
  const { profile } = useAuth();
  const layout = useResponsiveLayout();
  const tenantId = profile?.connect_client_id ?? undefined;
  const [guests, setGuests] = useState<RemoteGuest[]>([]);
  const [offset, setOffset] = useState(0);
  const [paging, setPaging] = useState<GuestsPagingInfo>({ total: null, start: 0, limit: pageSize });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchCustomer, setSearchCustomer] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = async (
    nextOffset: number,
    mode: "loading" | "refresh" = "loading",
    searchValue: string = searchCustomer,
    append = false
  ) => {
    if (mode === "loading") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    if (append) setLoadingMore(true);
    setError(null);

    try {
      const page = await listGuestsPage({
        limit: pageSize,
        offset: nextOffset,
        sort: defaultSort,
        searchCustomer: searchValue,
        tenantId
      });
      if (append) {
        setGuests((prev) => {
          const byId = new Map<string, RemoteGuest>();
          [...prev, ...page.items].forEach((item) => byId.set(item.id, item));
          return [...byId.values()];
        });
      } else {
        setGuests(page.items);
      }
      setPaging(page.paging);
      setOffset(page.paging.start);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load guests");
    } finally {
      if (mode === "loading") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
      if (append) setLoadingMore(false);
    }
  };

  useEffect(() => {
    load(0, "loading", "").catch(() => undefined);
  }, [tenantId]);

  const filteredGuests = useMemo(() => guests, [guests]);

  const pageStart = paging.start + 1;
  const pageEnd = paging.start + Math.min(paging.limit, guests.length);
  const loadedCount = guests.length;
  const totalLabel = paging.total === null ? "Total: -" : `Total: ${paging.total.toLocaleString()}`;
  const loadedLabel = paging.total === null ? `Loaded: ${loadedCount}` : `Loaded: ${loadedCount}/${paging.total}`;
  const pageLabel = guests.length ? `${pageStart}-${pageEnd}` : "0-0";
  const pageCount = paging.total && paging.limit ? Math.max(1, Math.ceil(paging.total / paging.limit)) : null;
  const currentPage = paging.limit ? Math.floor(paging.start / paging.limit) + 1 : 1;
  const canPrev = paging.start > 0 && !loading && !loadingMore;
  const canNext = !loading && !loadingMore && (paging.total === null ? guests.length >= paging.limit : paging.start + paging.limit < paging.total);
  const canLoadMore = paging.total === null ? guests.length >= paging.limit : guests.length < paging.total;
  const listCardWidth = layout.cardColumns === 3 ? "31.5%" : layout.cardColumns === 2 ? "48.5%" : "100%";

  const guestsTitleChip = paging.total === null ? "-" : String(paging.total);

  return (
    <AppShell title="Guests" titleChip={guestsTitleChip}>
      <View style={styles.screen}>
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(offset, "refresh", searchCustomer)} />}
          stickyHeaderIndices={[0]}
          contentContainerStyle={[styles.content, layout.isTablet ? styles.contentTablet : null]}
          scrollEventThrottle={16}
          onScroll={({ nativeEvent }) => {
            const nearBottom =
              nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 280;
            if (!nearBottom || loading || loadingMore || refreshing || !canLoadMore) return;
            load(offset + paging.limit, "loading", searchCustomer, true).catch(() => undefined);
          }}
        >
          <View style={styles.searchWrap}>
            {search ? <Text style={styles.searchActive}>Active search: {search}</Text> : null}
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
                <View style={styles.clientBadge}>
                  <Text style={styles.clientBadgeLabel}>{`Client: ${tenantId ?? "-"}`}</Text>
                </View>
              </View>
              <View style={styles.paginationActions}>
                <Pressable
                  style={[styles.pageButton, !canPrev ? styles.pageButtonDisabled : null]}
                  disabled={!canPrev}
                  accessibilityLabel="Previous page"
                  onPress={() => load(Math.max(offset - paging.limit, 0), "loading", searchCustomer)}
                >
                  <Feather name="chevron-left" size={16} color="#3e1240" />
                </Pressable>
                <Pressable
                  style={[styles.pageButton, !canNext ? styles.pageButtonDisabled : null]}
                  disabled={!canNext}
                  accessibilityLabel="Next page"
                  onPress={() => load(offset + paging.limit, "loading", searchCustomer)}
                >
                  <Feather name="chevron-right" size={16} color="#3e1240" />
                </Pressable>
              </View>
            </View>
          </View>
          {loading ? <Text style={styles.meta}>Loading guests...</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!loading && !error && !filteredGuests.length ? <Text style={styles.meta}>No guests found.</Text> : null}

          <View style={styles.cardsGrid}>
            {filteredGuests.map((guest) => (
              <Pressable
                key={guest.id}
                style={[styles.heroCard, { width: listCardWidth }]}
                onPress={() => {
                  cacheGuest(guest);
                  router.push({
                    pathname: "/guest/[id]",
                    params: {
                      id: guest.id,
                      fullName: guest.fullName,
                      email: guest.email ?? "",
                      phone: guest.phone ?? "",
                      externalRef: guest.externalRef ?? "",
                      completedAt: guest.completedAt ?? "",
                      createdAt: guest.createdAt ?? ""
                    }
                  });
                }}
              >
                <Text style={styles.heroOrderId}>#{guest.id}</Text>
                <Text style={styles.heroGuest}>{guest.fullName}</Text>
                <Text style={styles.heroMeta}>{`Email: ${guest.email ?? "-"}`}</Text>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>GUEST</Text>
                </View>
              </Pressable>
            ))}
          </View>
          {loadingMore ? <Text style={styles.meta}>Loading more guests...</Text> : null}
        </ScrollView>

        {filtersOpen ? (
          <View style={[styles.floatingFilterDock, { left: -layout.screenPadding, right: -layout.screenPadding }]}>
            <View style={styles.filterRowGrid}>
              <Pressable
                style={[styles.chip, !search ? styles.chipActive : null]}
                onPress={() => {
                  setSearch("");
                  setSearchCustomer("");
                  load(0, "loading", "").catch(() => undefined);
                }}
              >
                <Text style={[styles.chipLabel, !search ? styles.chipLabelActive : null]}>All</Text>
              </Pressable>
              <Pressable
                style={styles.chip}
                onPress={() => {
                  const next = "gmail";
                  setSearch(next);
                  setSearchCustomer(next);
                  load(0, "loading", next).catch(() => undefined);
                }}
              >
                <Text style={styles.chipLabel}>Email</Text>
              </Pressable>
              <Pressable
                style={styles.chip}
                onPress={() => {
                  const next = "+";
                  setSearch(next);
                  setSearchCustomer(next);
                  load(0, "loading", next).catch(() => undefined);
                }}
              >
                <Text style={styles.chipLabel}>Phone</Text>
              </Pressable>
            </View>
            <View style={styles.filterRowGrid}>
              <Pressable
                style={[styles.chip, search ? styles.chipActive : null]}
                onPress={() => {
                  setSearch("");
                  setSearchDraft("");
                  setSearchCustomer("");
                  load(0, "loading", "").catch(() => undefined);
                }}
              >
                <Text style={[styles.chipLabel, search ? styles.chipLabelActive : null]}>{search ? `Clear: ${search}` : "No search"}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <View style={[styles.actionsBar, { left: -layout.screenPadding, right: -layout.screenPadding }]}>
          <Pressable style={styles.actionsButton} onPress={() => setFiltersOpen((prev) => !prev)}>
            <Feather name="sliders" size={16} color="#ff4fbe" />
            <Text style={styles.actionsButtonLabel}>{filtersOpen ? "Hide Filters" : "Filters"}</Text>
          </Pressable>
          <Pressable
            style={styles.actionsButton}
            onPress={
              search
                ? () => {
                    setSearch("");
                    setSearchDraft("");
                    setSearchCustomer("");
                    load(0, "loading", "").catch(() => undefined);
                  }
                : () => {
                    setSearchDraft(search);
                    setSearchModalVisible(true);
                  }
            }
          >
            <Feather name={search ? "x-circle" : "search"} size={16} color="#ff4fbe" />
            <Text style={styles.actionsButtonLabel}>{search ? "Clear Search" : "Search"}</Text>
          </Pressable>
          <Pressable style={styles.actionsButton} onPress={() => router.push("/(tabs)/scans")}>
            <Ionicons name="qr-code-outline" size={16} color="#ff4fbe" />
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
          <View style={[styles.modalCard, { maxWidth: layout.modalMaxWidth, alignSelf: "center", width: "100%" }]}>
            <Text style={styles.modalTitle}>Search Guests</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Guest name, email or phone"
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
                  setSearch("");
                  setSearchDraft("");
                  setSearchCustomer("");
                  setSearchModalVisible(false);
                  load(0, "loading", "").catch(() => undefined);
                }}
              >
                <Text style={styles.modalSecondaryLabel}>Clear</Text>
              </Pressable>
              <Pressable
                style={styles.modalPrimary}
                onPress={() => {
                  const next = searchDraft.trim();
                  setSearch(next);
                  setSearchCustomer(next);
                  setSearchModalVisible(false);
                  load(0, "loading", next).catch(() => undefined);
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
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    paddingBottom: 118
  },
  contentTablet: {
    paddingBottom: 128
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  searchWrap: {
    marginBottom: 12,
    backgroundColor: theme.colors.background,
    zIndex: 5
  },
  actionsBar: {
    position: "absolute",
    left: -16,
    right: -16,
    bottom: 0,
    backgroundColor: "#14161b",
    borderTopWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: "row",
    gap: 10,
    zIndex: 20,
    elevation: 20
  },
  actionsButton: {
    flex: 1,
    backgroundColor: "#101217",
    borderWidth: 1,
    borderColor: "#2d3138",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  actionsButtonLabel: {
    color: "#ff4fbe",
    fontWeight: "800"
  },
  searchActive: {
    marginTop: 8,
    color: theme.colors.mutedText,
    fontWeight: "600"
  },
  searchChips: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8
  },
  floatingFilterDock: {
    position: "absolute",
    left: -16,
    right: -16,
    bottom: 50,
    backgroundColor: "#14161b",
    borderTopWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
    zIndex: 19,
    elevation: 19
  },
  filterRowGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8
  },
  chip: {
    borderWidth: 1,
    borderColor: "#2d3138",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#101217"
  },
  chipActive: {
    backgroundColor: "#ff4fbe",
    borderColor: "#ff4fbe"
  },
  chipLabel: {
    color: "#ff4fbe",
    fontWeight: "700",
    fontSize: 12
  },
  chipLabelActive: {
    color: "#0b1220"
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
    marginTop: 8,
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
  clientBadge: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: "#fff2fb",
    borderWidth: 1,
    borderColor: "#f4bde0",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  clientBadgeLabel: {
    color: "#a72678",
    fontSize: 11,
    fontWeight: "700"
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
