import React from "react";
import { Tabs } from "expo-router";
import { House, Map, Bell, UserRound } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/ThemeProvider";

export default function TabLayout() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          height: 84,
          paddingTop: 8
        },
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 12
        }
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("home"),
          tabBarIcon: ({ color, size }) => <House size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t("map"),
          tabBarIcon: ({ color, size }) => <Map size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: t("inbox"),
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t("account"),
          tabBarIcon: ({ color, size }) => <UserRound size={size} color={color} />
        }}
      />
      <Tabs.Screen name="orders" options={{ href: null }} />
      <Tabs.Screen name="assistant" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="commerce" options={{ href: null }} />
    </Tabs>
  );
}
