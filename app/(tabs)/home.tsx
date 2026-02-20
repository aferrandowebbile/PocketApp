import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View, Pressable } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CMSRenderer } from "@/cms/Renderer";
import { Avatar, Card, Skeleton } from "@/components";
import { useTenant } from "@/config/TenantProvider";
import { getActiveHighlightModes } from "@/modules/gating";
import { useTheme } from "@/theme/ThemeProvider";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { config, isLoading, refetch } = useTenant();
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const modes = getActiveHighlightModes(config);
  const [highlightMode, setHighlightMode] = useState<"ski" | "park">(modes.park ? "park" : "ski");

  const page = useMemo(() => config?.homePage, [config]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading || !config) {
    return (
      <View className="flex-1 px-5" style={{ backgroundColor: theme.colors.background, paddingTop: insets.top + 12 }}>
        <Skeleton height={72} />
        <Skeleton height={220} />
        <Skeleton height={90} />
        <Skeleton height={130} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        stickyHeaderIndices={[0]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <BlurView intensity={50} tint="systemMaterial" className="px-5 pb-3" style={{ paddingTop: insets.top + 6 }}>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="font-inter text-[14px]" style={{ color: theme.colors.muted }}>
                Welcome
              </Text>
              <Text className="font-inter-semibold text-[24px]" style={{ color: theme.colors.text }}>
                {config.name}
              </Text>
            </View>
            <Avatar label={config.name.slice(0, 2)} />
          </View>
        </BlurView>

        <View className="gap-5 px-5 pt-4">
          {modes.both ? (
            <Card>
              <View className="flex-row rounded-2xl p-1" style={{ backgroundColor: `${theme.colors.muted}15` }}>
                {(["ski", "park"] as const).map((mode) => (
                  <Pressable
                    key={mode}
                    className="flex-1 items-center rounded-xl py-2"
                    onPress={() => setHighlightMode(mode)}
                    style={{
                      backgroundColor: highlightMode === mode ? theme.colors.surface : "transparent"
                    }}
                  >
                    <Text className="font-inter-medium text-[14px]" style={{ color: theme.colors.text }}>
                      {mode === "ski" ? "Ski" : "Park"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          ) : null}

          <CMSRenderer
            page={page}
            context={{
              tenant: config,
              highlightMode: modes.ski && !modes.park ? "ski" : highlightMode
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}
