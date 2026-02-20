import React from "react";
import { Text, View } from "react-native";
import { Bell } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { FlashList } from "@shopify/flash-list";
import { Card, ListRow, SectionHeader } from "@/components";
import { getNotifications } from "@/config/notifications";
import { useTenant } from "@/config/TenantProvider";
import { useTheme } from "@/theme/ThemeProvider";

export default function InboxScreen() {
  const { theme } = useTheme();
  const { tenantId } = useTenant();

  const { data } = useQuery({
    queryKey: ["notifications", tenantId],
    queryFn: () => getNotifications(tenantId)
  });

  return (
    <View className="flex-1 px-5 pt-5" style={{ backgroundColor: theme.colors.background }}>
      <SectionHeader title="Inbox" subtitle="Updates and guest-facing alerts" />
      {!data?.length ? (
        <Card>
          <View className="items-center py-10">
            <View className="mb-3 rounded-full p-4" style={{ backgroundColor: `${theme.colors.primary}15` }}>
              <Bell color={theme.colors.primary} size={26} />
            </View>
            <Text className="font-inter-semibold text-[20px]" style={{ color: theme.colors.text }}>
              All caught up
            </Text>
            <Text className="mt-2 text-center font-inter text-[14px]" style={{ color: theme.colors.muted }}>
              No notifications yet. New alerts from Supabase will appear here.
            </Text>
          </View>
        </Card>
      ) : (
        <Card>
          <FlashList
            data={data}
            estimatedItemSize={72}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ListRow title={item.title} subtitle={item.body} />}
          />
        </Card>
      )}
    </View>
  );
}
