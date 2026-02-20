import React from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";

type ListRowProps = {
  title: string;
  subtitle?: string;
  onPress?: () => void;
};

export function ListRow({ title, subtitle, onPress }: ListRowProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between py-3"
      style={{ borderBottomColor: theme.colors.border, borderBottomWidth: 1 }}
    >
      <View className="flex-1 pr-4">
        <Text className="font-inter-medium text-[16px]" style={{ color: theme.colors.text }}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-1 font-inter text-[14px]" style={{ color: theme.colors.muted }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={18} color={theme.colors.muted} />
    </Pressable>
  );
}
