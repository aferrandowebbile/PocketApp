import React, { useState } from "react";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { AppShell } from "@/components/AppShell";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";
import { validatePurchaseToken } from "@/features/commerce/validation";
import { useAuth } from "@/lib/auth";
import { canAccessCommerce } from "@/lib/permissions";

export default function ScanQrScreen() {
  const { profile } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const isFocused = useIsFocused();
  const permissionDeniedPermanently = permission?.status === "denied" && permission?.canAskAgain === false;

  if (!canAccessCommerce(profile)) {
    router.replace("/(tabs)/dashboard");
    return null;
  }

  const onScan = async (result: BarcodeScanningResult) => {
    if (!profile) return;
    if (Date.now() < cooldownUntil) return;

    setCooldownUntil(Date.now() + 2500);
    setValidating(true);
    setMessage(null);

    try {
      const response = await validatePurchaseToken({
        token: result.data,
        companyId: profile.company_id,
        userId: profile.id
      });

      if (response.status === "success") {
        router.push({
          pathname: "/commerce/purchase/[id]",
          params: { id: response.purchase.id, status: "success" }
        });
        return;
      }

      if (response.status === "invalid_code") {
        setMessage("Invalid code");
      } else if (response.status === "not_valid") {
        setMessage(`Not valid: ${response.reason}`);
      } else {
        setMessage(response.reason);
      }
    } catch {
      setMessage("Validation failed.");
    } finally {
      setValidating(false);
    }
  };

  return (
    <AppShell title="Scan QR">
      {!permission?.granted ? (
        <View style={styles.emptyState}>
          <Text style={styles.message}>Camera permission is required to scan QR codes.</Text>
          <PrimaryButton
            label={permissionDeniedPermanently ? "Open settings" : "Allow camera"}
            onPress={() => {
              if (permissionDeniedPermanently) {
                Linking.openSettings().catch(() => undefined);
                return;
              }
              setCameraError(null);
              requestPermission().catch(() => undefined);
            }}
          />
        </View>
      ) : (
        <View style={styles.cameraWrap} collapsable={false}>
          <CameraView
            key={`commerce-camera-${String(isFocused)}-${String(permission?.granted)}`}
            style={styles.camera}
            active={isFocused}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={onScan}
            onMountError={(event) => {
              const details = event?.message ?? "Camera failed to mount.";
              setCameraError(details);
            }}
          />
        </View>
      )}
      {cameraError ? <Text style={styles.errorText}>{cameraError}</Text> : null}
      {validating ? <Text style={styles.status}>Validating scan...</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    height: 320,
    borderRadius: 14
  },
  camera: {
    flex: 1
  },
  message: {
    marginTop: 12,
    color: theme.colors.text
  },
  status: {
    marginTop: 12,
    color: theme.colors.accentDark,
    fontWeight: "600"
  },
  emptyState: {
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12
  },
  errorText: {
    marginTop: 10,
    color: theme.colors.danger,
    fontWeight: "600"
  }
});
