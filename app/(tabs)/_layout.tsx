import React from "react";
import { Redirect, Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { canAccessCommerce } from "@/lib/permissions";
import { theme } from "@/constants/theme";

export default function TabLayout() {
  const { session, profile } = useAuth();
  const insets = useSafeAreaInsets();

  if (!session) return <Redirect href="/login" />;

  const showCommerce = canAccessCommerce(profile);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accentDark,
        tabBarInactiveTintColor: "#98a2b3",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#eef0f3",
          height: 58 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? Math.max(insets.bottom - 2, 10) : 8
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.2
          // If your Grotesq font is loaded globally, swap this in:
          // fontFamily: "Grotesq-Medium"
        }
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <Feather name="bar-chart-2" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => <Feather name="clipboard" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="guests"
        options={{
          title: "Guests",
          tabBarIcon: ({ color, size }) => <Feather name="users" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="commerce"
        options={{
          title: "Commerce",
          tabBarIcon: ({ color, size }) => <Feather name="shopping-bag" size={size} color={color} />,
          href: showCommerce ? "/(tabs)/commerce" : null
        }}
      />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
