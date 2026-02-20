import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Flag, Mountain, Ticket, Timer, type LucideIcon } from "lucide-react-native";
import type { QuickActionItem } from "@/cms/schema";
import type { SectionComponentProps } from "@/cms/types";
import { useTheme } from "@/theme/ThemeProvider";

const iconMap: Record<string, LucideIcon> = {
  mountain: Mountain,
  flag: Flag,
  timer: Timer,
  ticket: Ticket
};

export function QuickActionsSection({ section, context }: SectionComponentProps<any>) {
  const { theme } = useTheme();

  const actions = useMemo(() => {
    return section.props.actions.filter((action: QuickActionItem) => {
      if (!action.module) return true;
      return Boolean(context.tenant?.enabledModules[action.module]);
    });
  }, [section.props.actions, context.tenant]);

  return (
    <View>
      {section.props.title ? (
        <Text className="mb-3 font-inter-semibold text-[20px]" style={{ color: theme.colors.text }}>
          {section.props.title}
        </Text>
      ) : null}
      <View className="flex-row flex-wrap justify-between gap-y-3">
        {actions.map((action: QuickActionItem) => {
          const Icon = iconMap[action.icon] ?? Mountain;
          return (
            <Pressable
              key={action.id}
              onPress={() => (action.route ? router.push(action.route as never) : undefined)}
              className="w-[23%] items-center"
            >
              <View
                className="h-14 w-14 items-center justify-center rounded-2xl border"
                style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}
              >
                <Icon size={20} color={theme.colors.text} />
              </View>
              <Text className="mt-2 text-center font-inter text-[13px]" style={{ color: theme.colors.text }}>
                {action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
