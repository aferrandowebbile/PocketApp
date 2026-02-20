import React from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import type { SectionComponentProps } from "@/cms/types";
import { Card, SectionHeader } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";

export function CardCarouselSection({ section }: SectionComponentProps<any>) {
  const { theme } = useTheme();

  return (
    <View>
      <SectionHeader title={section.props.title} />
      <FlatList
        data={section.props.items}
        horizontal
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{ gap: 12, paddingRight: 16 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(item.route as never)} style={{ width: 280 }}>
            <Card>
              <Text className="font-inter-semibold text-[20px]" style={{ color: theme.colors.text }}>
                {item.title}
              </Text>
              {item.subtitle ? (
                <Text className="mt-2 font-inter text-[14px]" style={{ color: theme.colors.muted }}>
                  {item.subtitle}
                </Text>
              ) : null}
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}
