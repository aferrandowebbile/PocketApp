import React from "react";
import { Redirect, Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform, Pressable, StyleSheet, View } from "react-native";
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
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Feather name={focused ? "grid" : "grid"} size={size} color={color} />
          )
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
        name="assistant"
        options={{
          title: "Assistant",
          tabBarIcon: ({ focused }) => <Feather name="aperture" size={20} color={focused ? "#111827" : "#5b6070"} />,
          tabBarButton: (props) => (
            <Pressable
              onPress={props.onPress}
              onLongPress={props.onLongPress}
              accessibilityState={props.accessibilityState}
              accessibilityLabel={props.accessibilityLabel}
              testID={props.testID}
              style={({ pressed }) => [styles.assistantWrap, pressed ? styles.assistantPressed : null]}
            >
              <View style={styles.assistantInner}>{props.children}</View>
            </Pressable>
          )
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarIcon: ({ color, size }) => <Feather name="bell" size={size} color={color} />
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
    </Tabs>
  );
}

const styles = StyleSheet.create({
  assistantWrap: {
    top: -14,
    justifyContent: "center",
    alignItems: "center"
  },
  assistantPressed: {
    opacity: 0.92
  },
  assistantInner: {
    minWidth: 66,
    height: 54,
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#fcb4e0",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    borderWidth: 1,
    borderColor: "#f8a7d9"
  }
});
