import React, { useState } from "react";
import { Redirect } from "expo-router";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { directusConfigError } from "@/lib/directusAuth";

export default function LoginScreen() {
  const { session, signInWithPassword, sites, selectedSiteAlias, selectSite, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [siteBusyAlias, setSiteBusyAlias] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  if (session && selectedSiteAlias) return <Redirect href="/(tabs)/dashboard" />;

  const onEmailLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const onSelectSite = async (alias: string) => {
    setSiteBusyAlias(alias);
    setError(null);
    try {
      await selectSite(alias);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not select site");
    } finally {
      setSiteBusyAlias(null);
    }
  };

  if (session) {
    return (
      <AppShell title="Spotlio Control">
        <View style={styles.sitePicker}>
          <Text style={styles.kicker}>Site Access</Text>
          <Text style={styles.title}>Choose a site</Text>
          <Text style={styles.subtitle}>This site will be used as the Connect API client for orders, guests, commerce, and scans.</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <ScrollView contentContainerStyle={styles.siteList}>
            {sites.map((site) => {
              const busySite = siteBusyAlias === site.alias;
              return (
                <Pressable
                  key={site.id}
                  style={styles.siteOption}
                  onPress={() => onSelectSite(site.alias)}
                  disabled={Boolean(siteBusyAlias)}
                >
                  <View style={styles.siteOptionText}>
                    <Text style={styles.siteName}>{site.name}</Text>
                    <Text style={styles.siteAlias}>{site.alias}</Text>
                  </View>
                  <Text style={styles.siteAction}>{busySite ? "Selecting..." : "Use"}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {!sites.length ? <Text style={styles.error}>No sites found for this Directus user.</Text> : null}
          <Pressable style={styles.secondaryAction} onPress={signOut} disabled={Boolean(siteBusyAlias)}>
            <Text style={styles.secondaryActionLabel}>Sign out</Text>
          </Pressable>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell title="Spotlio Control">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.wrapper}>
        <View style={styles.hero}>
          <View style={styles.heroGlowLarge} />
          <View style={styles.heroGlowSmall} />
          <Text style={styles.kicker}>Operations Access</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to manage guests, orders, and commerce operations.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="name@company.com"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput}
              secureTextEntry={!showPassword}
              placeholder="Enter your password"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              editable={!busy}
            />
            <Pressable onPress={() => setShowPassword((prev) => !prev)} style={styles.toggle} disabled={busy}>
              <Text style={styles.toggleLabel}>{showPassword ? "Hide" : "Show"}</Text>
            </Pressable>
          </View>

          {directusConfigError ? <Text style={styles.error}>{directusConfigError}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton label={busy ? "Signing in..." : "Sign in"} onPress={onEmailLogin} disabled={busy} />
        </View>
      </KeyboardAvoidingView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  hero: {
    borderWidth: 1,
    borderColor: "#ffd7ef",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    backgroundColor: "#fff8fc",
    overflow: "hidden"
  },
  heroGlowLarge: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "#fbd3ea",
    top: -100,
    right: -70
  },
  heroGlowSmall: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "#ffe7f5",
    bottom: -60,
    left: -40
  },
  kicker: {
    color: "#a72678",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7
  },
  title: {
    marginTop: 6,
    fontSize: 30,
    lineHeight: 34,
    color: theme.colors.text,
    fontWeight: "800"
  },
  subtitle: {
    marginTop: 8,
    color: "#6b7280",
    lineHeight: 20
  },
  card: {
    borderWidth: 1,
    borderColor: "#f0d8e8",
    borderRadius: 20,
    padding: 16,
    gap: 8,
    backgroundColor: "#fff"
  },
  label: {
    color: theme.colors.text,
    fontWeight: "700",
    marginTop: 2
  },
  input: {
    borderWidth: 1,
    borderColor: "#e8dce5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 6,
    color: theme.colors.text
  },
  passwordWrap: {
    borderWidth: 1,
    borderColor: "#e8dce5",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: theme.colors.text
  },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  toggleLabel: {
    color: "#a72678",
    fontWeight: "700"
  },
  error: {
    color: theme.colors.danger,
    marginBottom: 6
  },
  sitePicker: {
    flex: 1,
    gap: 12
  },
  siteList: {
    gap: 10,
    paddingBottom: 12
  },
  siteOption: {
    borderWidth: 1,
    borderColor: "#e8dce5",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  siteOptionText: {
    flex: 1
  },
  siteName: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 16
  },
  siteAlias: {
    marginTop: 3,
    color: "#6b7280"
  },
  siteAction: {
    color: "#a72678",
    fontWeight: "800"
  },
  secondaryAction: {
    alignSelf: "flex-start",
    paddingVertical: 8
  },
  secondaryActionLabel: {
    color: "#6b7280",
    fontWeight: "700"
  }
});
