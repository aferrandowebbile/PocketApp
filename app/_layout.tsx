import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";

function RootNavigator() {
  const { loading } = useAuth();

  if (loading) {
    return <AppLoadingScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="scan-ticket"
        options={{
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          animation: "slide_from_right"
        }}
      />
      <Stack.Screen
        name="order/[id]"
        options={{
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          animation: "slide_from_right"
        }}
      />
      <Stack.Screen
        name="guest/[id]"
        options={{
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          animation: "slide_from_right"
        }}
      />
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
