import React from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import type { SectionComponentProps } from "@/cms/types";
import { Badge } from "@/components/Badge";

export function HeroSection({ section }: SectionComponentProps<Extract<SectionComponentProps["section"], { type: "hero" }>>) {
  const colors = section.props.gradient ?? ["#1D4ED8", "#0EA5E9"];

  return (
    <LinearGradient colors={colors} className="overflow-hidden rounded-3xl px-5 py-6">
      <Badge label="Today" />
      <Text className="mt-4 font-inter-semibold text-[30px] text-white">{section.props.title}</Text>
      <Text className="mt-2 font-inter text-[16px] text-white/90">{section.props.subtitle}</Text>
      {section.props.ctaLabel && section.props.ctaRoute ? (
        <Pressable
          onPress={() => router.push(section.props.ctaRoute as never)}
          className="mt-5 self-start rounded-2xl bg-white px-4 py-3"
        >
          <Text className="font-inter-semibold text-[16px] text-slate-900">{section.props.ctaLabel}</Text>
        </Pressable>
      ) : null}
      <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
    </LinearGradient>
  );
}
