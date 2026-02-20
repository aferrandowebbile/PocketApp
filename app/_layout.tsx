import React from "react";
import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth";
import { theme } from "@/constants/theme";

function RootNavigator() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator color={theme.colors.accentDark} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="scan-ticket" />
      <Stack.Screen name="ticket/[id]" />
      <Stack.Screen name="order/[id]" />
      <Stack.Screen name="commerce/arrivals" />
      <Stack.Screen name="commerce/customer-search" />
      <Stack.Screen name="commerce/scan-qr" />
      <Stack.Screen name="commerce/purchase/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
