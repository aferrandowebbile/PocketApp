import React, { useState } from "react";
import { Redirect } from "expo-router";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";
import { useAuth } from "@/lib/auth";

export default function LoginScreen() {
  const { session, signInWithPassword, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Redirect href="/(tabs)/home" />;

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

  const onGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Spotlio Pocket">
      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} autoCapitalize="none" value={email} onChangeText={setEmail} />
        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label={busy ? "Please wait..." : "Sign in"} onPress={onEmailLogin} disabled={busy} />
        <View style={{ height: 10 }} />
        <PrimaryButton label="Continue with Google" onPress={onGoogle} disabled={busy} />
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 8
  },
  label: {
    color: theme.colors.text,
    fontWeight: "600"
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6
  },
  error: {
    color: theme.colors.danger,
    marginBottom: 6
  }
});
