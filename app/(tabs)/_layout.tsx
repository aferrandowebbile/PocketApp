import React from "react";
import { Redirect, Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useAuth } from "@/lib/auth";
import { theme } from "@/constants/theme";

export default function TabLayout() {
  const { session, selectedSiteAlias } = useAuth();

  if (!session) return <Redirect href="/login" />;
  if (!selectedSiteAlias) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#ff4fbe",
        tabBarInactiveTintColor: "#d5dce6",
        tabBarStyle: {
          height: 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 10 : 10,
          backgroundColor: "#000000",
          borderTopWidth: 0,
          shadowColor: "#000000",
          shadowOpacity: 0,
          shadowRadius: 0,
          shadowOffset: { width: 0, height: 0 },
          elevation: 0
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0
          // If your Grotesq font is loaded globally, swap this in:
          // fontFamily: "Grotesq-Medium"
        }
      }}
    >
      <Tabs.Screen
        name="dashboard"
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
      <Tabs.Screen name="commerce" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
