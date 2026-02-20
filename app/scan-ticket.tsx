import React, { useMemo, useState } from "react";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";
import { parseOrdersResponse, type RemoteOrder } from "@/services/ordersClient";

type ParsedDetails = {
  type: "json" | "url" | "text";
  rows: Array<{ key: string; value: string }>;
  prettyJson?: string;
};

const ordersDirectBaseUrl = (process.env.EXPO_PUBLIC_ORDERS_DIRECT_BASE_URL ?? "https://connect.spotlio.com").replace(/\/$/, "");
const ordersClient = process.env.EXPO_PUBLIC_ORDERS_API_CLIENT ?? "tlml";
const ordersSort = process.env.EXPO_PUBLIC_ORDERS_API_SORT ?? "completed_at_day:desc";
const ordersMode = process.env.EXPO_PUBLIC_ORDERS_API_MODE ?? "partial";
const ordersStatuses = (process.env.EXPO_PUBLIC_ORDERS_API_STATUS ?? "completed,canceled")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function parseQrData(raw: string): ParsedDetails {
  try {
    const json = JSON.parse(raw) as Record<string, unknown>;
    const rows = Object.entries(json).map(([key, value]) => ({
      key,
      value: typeof value === "string" ? value : JSON.stringify(value)
    }));
    return { type: "json", rows, prettyJson: JSON.stringify(json, null, 2) };
  } catch {
    // continue
  }

  try {
    const url = new URL(raw);
    const rows: Array<{ key: string; value: string }> = [
      { key: "host", value: url.host },
      { key: "path", value: url.pathname }
    ];
    url.searchParams.forEach((value, key) => {
      rows.push({ key, value });
    });
    return { type: "url", rows };
  } catch {
    // continue
  }

  return {
    type: "text",
    rows: [{ key: "value", value: raw }]
  };
}

export default function ScanTicketScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [lastScanAt, setLastScanAt] = useState(0);
  const [rawQrValue, setRawQrValue] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [matchedOrder, setMatchedOrder] = useState<RemoteOrder | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const parsed = useMemo(() => (rawQrValue ? parseQrData(rawQrValue) : null), [rawQrValue]);
  const canValidateQr = Boolean(rawQrValue && rawQrValue.trim().length > 0);

  const onScan = (result: BarcodeScanningResult) => {
    if (Date.now() - lastScanAt < 2000) return;
    setLastScanAt(Date.now());
    setRawQrValue(result.data);
    setValidationMessage(null);
    setMatchedOrder(null);
  };

  const validateQr = async () => {
    if (!rawQrValue) return;
    setValidating(true);
    setValidationMessage(null);
    setMatchedOrder(null);

    try {
      const query = new URLSearchParams();
      query.set("client", ordersClient);
      query.set("limit", "10");
      query.set("offset", "0");
      query.set("sort", ordersSort);
      ordersStatuses.forEach((status) => query.append("status[]", status));
      query.set("mode", ordersMode);
      query.set("search[id]", rawQrValue);

      const url = `${ordersDirectBaseUrl}/console/orders?${query.toString()}`;
      const response = await fetch(url, { method: "GET", headers: { Accept: "application/json, text/plain, */*" } });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Validation API error (${response.status})${body ? `: ${body.slice(0, 160)}` : ""}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json") ? await response.json() : await response.text();

      if (typeof payload === "string") {
        const lower = payload.toLowerCase();
        if (lower.includes("<html") || lower.includes("<!doctype html")) {
          throw new Error("Orders endpoint returned HTML. You may need an authenticated session on connect.spotlio.com.");
        }
      }

      const parsedOrders = parseOrdersResponse(payload);
      if (!parsedOrders.length) {
        setValidationMessage("QR not found in orders.");
        return;
      }

      setMatchedOrder(parsedOrders[0]);
      setValidationMessage("QR found. Ticket exists.");
      setShowSuccessModal(true);
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : "Validation failed.");
    } finally {
      setValidating(false);
    }
  };

  return (
    <AppShell title="Scan Ticket">
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>

      {!permission?.granted ? (
        <View style={styles.permission}>
          <Text style={styles.permissionText}>Camera permission is required to scan a ticket QR code.</Text>
          <PrimaryButton label="Allow camera" onPress={() => requestPermission()} />
        </View>
      ) : (
        <View style={styles.cameraWrap}>
          <CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={onScan} />
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>Align QR code in frame</Text>
          </View>
        </View>
      )}

      {rawQrValue ? (
        <ScrollView style={styles.detailsWrap}>
          <Card title="QR Raw Value" subtitle={rawQrValue} />
          <Card title="Detected Format" subtitle={parsed?.type.toUpperCase() ?? "-"} />
          {parsed?.type === "json" && parsed.prettyJson ? <Card title="Detected JSON" subtitle={parsed.prettyJson} /> : null}
          {parsed?.rows.map((row) => (
            <Card key={`${row.key}:${row.value}`} title={row.key} subtitle={row.value} />
          ))}
          <Pressable
            style={[styles.validateButton, !canValidateQr || validating ? styles.validateButtonDisabled : null]}
            disabled={!canValidateQr || validating}
            onPress={validateQr}
          >
            <Text style={styles.validateButtonLabel}>{validating ? "Validating..." : "Validate QR"}</Text>
          </Pressable>
          {validating ? <ActivityIndicator color={theme.colors.success} style={styles.validateLoader} /> : null}
          {validationMessage ? <Text style={styles.validationMessage}>{validationMessage}</Text> : null}
          <PrimaryButton
            label="Scan another QR"
            onPress={() => {
              setRawQrValue(null);
              setValidationMessage(null);
              setMatchedOrder(null);
              setShowSuccessModal(false);
            }}
          />
        </ScrollView>
      ) : null}

      <Modal visible={showSuccessModal && Boolean(matchedOrder)} transparent animationType="fade" onRequestClose={() => setShowSuccessModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ticket Valid</Text>
            {matchedOrder ? (
              <>
                <Text style={styles.modalRow}>Order: {matchedOrder.id}</Text>
                <Text style={styles.modalRow}>Guest: {matchedOrder.guestName}</Text>
                <Text style={styles.modalRow}>Product: {matchedOrder.product}</Text>
                <Text style={styles.modalRow}>Quantity: {matchedOrder.quantity}</Text>
                <Text style={styles.modalRow}>Status: {matchedOrder.status}</Text>
                <Text style={styles.modalRow}>Date: {new Date(matchedOrder.date).toLocaleString()}</Text>
              </>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={() => setShowSuccessModal(false)}>
                <Text style={styles.modalSecondaryLabel}>Close</Text>
              </Pressable>
              <Pressable
                style={styles.modalPrimary}
                onPress={() => {
                  setShowSuccessModal(false);
                  setRawQrValue(null);
                  setValidationMessage(null);
                  setMatchedOrder(null);
                }}
              >
                <Text style={styles.modalPrimaryLabel}>Scan Next</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ffd7ef",
    backgroundColor: "#fff7fc"
  },
  backLabel: {
    color: "#a72678",
    fontWeight: "700"
  },
  permission: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 14
  },
  permissionText: {
    color: theme.colors.text,
    marginBottom: 10
  },
  cameraWrap: {
    height: 280,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12
  },
  camera: {
    flex: 1
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.45)"
  },
  overlayText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600"
  },
  detailsWrap: {
    flex: 1
  },
  validateButton: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8
  },
  validateButtonDisabled: {
    opacity: 0.6
  },
  validateButtonLabel: {
    color: "#fff",
    fontWeight: "800"
  },
  validateLoader: {
    marginBottom: 8
  },
  validationMessage: {
    marginBottom: 10,
    color: theme.colors.text,
    fontWeight: "600"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 24, 40, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  modalCard: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1fae5",
    padding: 16
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f5132",
    marginBottom: 10
  },
  modalRow: {
    color: theme.colors.text,
    marginBottom: 6
  },
  modalActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10
  },
  modalPrimary: {
    flex: 1,
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center"
  },
  modalPrimaryLabel: {
    color: "#fff",
    fontWeight: "800"
  },
  modalSecondary: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center"
  },
  modalSecondaryLabel: {
    color: "#111827",
    fontWeight: "700"
  }
});
