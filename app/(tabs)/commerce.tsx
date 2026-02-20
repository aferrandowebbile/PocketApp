import React from "react";
import { Redirect, router } from "expo-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { useAuth } from "@/lib/auth";
import { canAccessCommerce } from "@/lib/permissions";

export default function CommerceHomeScreen() {
  const { profile } = useAuth();

  if (!canAccessCommerce(profile)) {
    return <Redirect href="/(tabs)/home" />;
  }

  return (
    <AppShell title="Commerce">
      <Card title="Arrivals today" subtitle="Review expected arrivals and mark arrivals" onPress={() => router.push("/commerce/arrivals")} />
      <Card title="Search customer" subtitle="Find customer by name, email, phone, or external ref" onPress={() => router.push("/commerce/customer-search")} />
      <Card title="Validate purchase (scan QR)" subtitle="Scan a token and validate in real time" onPress={() => router.push("/commerce/scan-qr")} />
    </AppShell>
  );
}
