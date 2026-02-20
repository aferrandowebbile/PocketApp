import React from "react";
import { Pressable, Text, View } from "react-native";
import i18n from "@/i18n";
import { Card, SectionHeader } from "@/components";
import { useTenant } from "@/config/TenantProvider";
import { useTheme } from "@/theme/ThemeProvider";

export default function AccountScreen() {
  const { config } = useTenant();
  const { theme } = useTheme();

  const languages = config?.supportedLanguages ?? ["en"];

  return (
    <View className="flex-1 px-5 pt-5" style={{ backgroundColor: theme.colors.background }}>
      <SectionHeader title="Account" subtitle="Language and tenant settings" />

      <Card>
        <Text className="font-inter-semibold text-[20px]" style={{ color: theme.colors.text }}>
          Language
        </Text>
        <View className="mt-4 flex-row flex-wrap gap-2">
          {languages.map((languageCode) => {
            const selected = i18n.language === languageCode;
            return (
              <Pressable
                key={languageCode}
                onPress={() => void i18n.changeLanguage(languageCode)}
                className="rounded-full border px-4 py-2"
                style={{
                  borderColor: selected ? theme.colors.primary : theme.colors.border,
                  backgroundColor: selected ? `${theme.colors.primary}20` : theme.colors.surface
                }}
              >
                <Text className="font-inter-medium text-[14px]" style={{ color: selected ? theme.colors.primary : theme.colors.text }}>
                  {languageCode.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text className="mt-4 font-inter text-[13px]" style={{ color: theme.colors.muted }}>
          RTL is applied when switching to Arabic. Full layout mirroring may require app restart on some platforms.
        </Text>
      </Card>
    </View>
  );
}
