import React from "react";
import { View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import type { SectionComponentProps } from "@/cms/types";
import { Card, ListRow, SectionHeader } from "@/components";

export function ListSection({ section }: SectionComponentProps<any>) {
  return (
    <View>
      <SectionHeader title={section.props.title} />
      <Card>
        <FlashList
          data={section.props.items}
          estimatedItemSize={70}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <ListRow title={item.title} subtitle={item.subtitle} onPress={() => router.push(item.route as never)} />
          )}
        />
      </Card>
    </View>
  );
}
