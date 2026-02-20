import React from "react";
import { Text, View } from "react-native";
import { MapPinned } from "lucide-react-native";
import { Card, SectionHeader } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";

export default function MapScreen() {
  const { theme } = useTheme();

  return (
    <View className="flex-1 px-5 pt-5" style={{ backgroundColor: theme.colors.background }}>
      <SectionHeader title="Map" subtitle="Interactive map module placeholder" />
      <Card>
        <View className="items-center py-14">
          <MapPinned size={28} color={theme.colors.primary} />
          <Text className="mt-3 font-inter-semibold text-[20px]" style={{ color: theme.colors.text }}>
            Map coming soon
          </Text>
          <Text className="mt-2 text-center font-inter text-[14px]" style={{ color: theme.colors.muted }}>
            Connect this screen to your destination map provider.
          </Text>
        </View>
      </Card>
    </View>
  );
}
