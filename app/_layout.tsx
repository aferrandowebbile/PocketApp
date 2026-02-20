import "../global.css";
import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { queryClient } from "@/config/queryClient";
import { TenantProvider } from "@/config/TenantProvider";
import { I18nProvider } from "@/i18n/I18nProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold
  });

  useEffect(() => {
    if (loaded) {
      void SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <TenantProvider>
            <ThemeProvider>
              <I18nProvider>
                <StatusBar style="auto" />
                <Stack>
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="offer/[id]" options={{ presentation: "modal", title: "Offer" }} />
                  <Stack.Screen name="event/[id]" options={{ presentation: "modal", title: "Event" }} />
                  <Stack.Screen name="poi/[id]" options={{ presentation: "modal", title: "Point of Interest" }} />
                  <Stack.Screen name="web-embed" options={{ presentation: "modal", title: "Web" }} />
                </Stack>
              </I18nProvider>
            </ThemeProvider>
          </TenantProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
