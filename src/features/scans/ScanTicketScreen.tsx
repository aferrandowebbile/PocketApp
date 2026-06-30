import React, { useMemo, useState } from "react";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useAuth } from "@/lib/auth";
import { getSelectedSiteApiToken } from "@/lib/directusAuth";
import { cacheOrder } from "@/lib/orderStore";
import { appendScanHistory } from "@/lib/scanStore";
import { parseOrdersResponse, type RemoteOrder } from "@/services/ordersClient";

type ParsedDetails = {
  type: "json" | "url" | "text";
  rows: Array<{ key: string; value: string }>;
  prettyJson?: string;
};

function extractApiMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const message = record.message;
  if (typeof message === "string" && message.trim()) return message;
  const error = record.error;
  if (typeof error === "string" && error.trim()) return error;
  return null;
}

const ordersDirectBaseUrl = (process.env.EXPO_PUBLIC_ORDERS_DIRECT_BASE_URL ?? "https://connect.spotlio.com").replace(/\/$/, "");
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function countOrderTickets(order: RemoteOrder | null): number {
  if (!order) return 0;
  if (typeof order.productCount === "number" && Number.isFinite(order.productCount) && order.productCount > 0) return order.productCount;
  if (typeof order.quantity === "number" && Number.isFinite(order.quantity) && order.quantity > 0) return order.quantity;

  const raw = asRecord(order.raw);
  if (!raw) return 0;
  const arrays = [raw.line_items, raw.lineItems, raw.products, raw.items];
  for (const candidate of arrays) {
    if (Array.isArray(candidate) && candidate.length > 0) return candidate.length;
  }
  return 0;
}

export function ScanTicketScreen({ showBack = true }: { showBack?: boolean }) {
  const { profile } = useAuth();
  const layout = useResponsiveLayout();
  const tenantId = profile?.connect_client_id ?? "";
  const [permission, requestPermission] = useCameraPermissions();
  const [lastScanAt, setLastScanAt] = useState(0);
  const [rawQrValue, setRawQrValue] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [showConfirmValidationModal, setShowConfirmValidationModal] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanTypeLabel, setScanTypeLabel] = useState<string | null>(null);
  const isFocused = useIsFocused();
  const permissionDeniedPermanently = permission?.status === "denied" && permission?.canAskAgain === false;

  const parsed = useMemo(() => (rawQrValue ? parseQrData(rawQrValue) : null), [rawQrValue]);
  const canValidateQr = Boolean(rawQrValue && rawQrValue.trim().length > 0);
  const detailsCardsPerRow = layout.cardColumns >= 2 ? 2 : 1;
  const detailCardWidth = detailsCardsPerRow === 2 ? "48.5%" : "100%";

  const onScan = (result: BarcodeScanningResult) => {
    if (Date.now() - lastScanAt < 2000) return;
    setLastScanAt(Date.now());
    const scannedValue = result.data.trim();
    setRawQrValue(scannedValue);
    setValidationMessage(null);
    setScanTypeLabel(result.type ? result.type.replace(/_/g, " ").toUpperCase() : "UNKNOWN");
    if (/^\d+$/.test(scannedValue)) {
      setPendingOrderId(scannedValue);
      setShowConfirmValidationModal(true);
    }
  };

  const validateQr = async (orderIdInput?: string) => {
    const orderId = (orderIdInput ?? rawQrValue ?? "").trim();
    if (!orderId) return;
    setValidating(true);
    setValidationMessage(null);

    try {
      if (!tenantId.trim()) {
        throw new Error("Missing selected site alias. Please select a site in Profile before scanning.");
      }
      const query = new URLSearchParams();
      query.set("client", tenantId);
      query.set("limit", "10");
      query.set("offset", "0");
      query.set("sort", ordersSort);
      ordersStatuses.forEach((status) => query.append("status[]", status));
      query.set("mode", ordersMode);
      query.set("search[id]", orderId);

      const url = `${ordersDirectBaseUrl}/console/orders?${query.toString()}`;
      const apiToken = await getSelectedSiteApiToken();
      const headers: Record<string, string> = { Accept: "application/json, text/plain, */*" };
      if (apiToken) {
        headers.Authorization = `Bearer ${apiToken}`;
        headers["X-API-Key"] = apiToken;
      }
      const response = await fetch(url, { method: "GET", headers });

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
        const apiMessage = extractApiMessage(payload);
        const message = apiMessage ? `Validation error: ${apiMessage}` : "Order not found for this code.";
        setValidationMessage(message);
        await saveScanRecord({ status: "error", message });
        return;
      }

      const apiMessage = extractApiMessage(payload);
      const nextOrder = parsedOrders[0];
      const message = apiMessage ? `Validation successful: ${apiMessage}` : "Validation successful: order found.";
      setValidationMessage(message);
      await saveScanRecord({ status: "validated", message, order: nextOrder });
      cacheOrder(nextOrder);
      resetScanState();
      router.push({
        pathname: "/order/[id]",
        params: {
          id: nextOrder.id,
          guestName: nextOrder.guestName,
          product: nextOrder.product,
          quantity: String(nextOrder.quantity),
          totalPrice: nextOrder.totalPrice === null ? "" : String(nextOrder.totalPrice),
          currency: nextOrder.currency ?? "",
          status: nextOrder.status,
          date: nextOrder.date,
          startDate: nextOrder.startDate ?? "",
          tenantId,
          lookupMode: "scan"
        }
      });
    } catch (error) {
      const message = error instanceof Error ? `Validation error: ${error.message}` : "Validation error.";
      setValidationMessage(message);
      await saveScanRecord({ status: "error", message });
    } finally {
      setValidating(false);
    }
  };

  const resetScanState = () => {
    setRawQrValue(null);
    setValidationMessage(null);
    setPendingOrderId(null);
    setShowConfirmValidationModal(false);
    setScanTypeLabel(null);
  };

  const saveScanRecord = async ({ status, message, order }: {
    status: "validated" | "error" | "redeemed";
    message: string;
    order?: RemoteOrder | null;
  }) => {
    if (!rawQrValue) return;
    await appendScanHistory({
      scannedAt: new Date().toISOString(),
      rawValue: rawQrValue,
      scanTypeLabel,
      parsedType: parsed?.type ?? "unknown",
      validationStatus: status,
      validationMessage: message,
      orderId: order?.id ?? null,
      guestName: order?.guestName ?? null,
      product: order?.product ?? null,
      orderStatus: order?.status ?? null,
      ticketCount: order ? countOrderTickets(order) : null
    });
  };

  return (
    <AppShell title="Scans">
      {showBack ? (
        <Pressable
          style={styles.back}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace("/(tabs)/scans");
          }}
        >
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
      ) : null}

      <View style={[styles.layout, layout.isTablet ? styles.layoutTablet : null]}>
        <View style={[styles.cameraColumn, layout.isTablet ? styles.cameraColumnTablet : null]}>
          {!permission?.granted ? (
            <View style={styles.permission}>
              <Text style={styles.permissionText}>Camera permission is required to scan a ticket QR code or barcode.</Text>
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
            <View style={[styles.cameraWrap, layout.isTablet ? styles.cameraWrapTablet : null]} collapsable={false}>
              <CameraView
                key={`ticket-camera-${String(isFocused)}-${String(permission?.granted)}`}
                style={styles.camera}
                active={isFocused}
                barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "code39", "ean13", "ean8", "upc_a", "upc_e", "itf14", "pdf417"] }}
                onBarcodeScanned={onScan}
                onMountError={(event) => {
                  const details = event?.message ?? "Camera failed to mount.";
                  setCameraError(details);
                }}
              />
              <View style={styles.overlay}>
                <Text style={styles.overlayText}>Align QR code or barcode in frame</Text>
              </View>
            </View>
          )}
          {cameraError ? <Text style={styles.cameraError}>{cameraError}</Text> : null}
          {!rawQrValue ? (
            <View style={styles.hintCard}>
              <Text style={styles.hintTitle}>Ready to scan</Text>
              <Text style={styles.hintText}>Use this screen for order validation and quick redeem actions. On tablets, keep the camera upright and centered for the best detection speed.</Text>
            </View>
          ) : null}
        </View>

        {rawQrValue ? (
          <ScrollView style={[styles.detailsWrap, layout.isTablet ? styles.detailsWrapTablet : null]} contentContainerStyle={styles.detailsContent}>
            <View style={styles.cardGrid}>
              <View style={{ width: detailCardWidth }}>
                <Card title="Detected Format" subtitle={parsed?.type.toUpperCase() ?? "-"} />
              </View>
              {scanTypeLabel ? (
                <View style={{ width: detailCardWidth }}>
                  <Card title="Scanner Type" subtitle={scanTypeLabel} />
                </View>
              ) : null}
              {parsed?.rows.map((row) => (
                <View key={`${row.key}:${row.value}`} style={{ width: detailCardWidth }}>
                  <Card title={row.key} subtitle={row.value} />
                </View>
              ))}
            </View>
            <Pressable
              style={[styles.validateButton, !canValidateQr || validating ? styles.validateButtonDisabled : null]}
              disabled={!canValidateQr || validating}
              onPress={() => {
                validateQr().catch(() => undefined);
              }}
            >
              <Text style={styles.validateButtonLabel}>{validating ? "Validating..." : "Validate scan"}</Text>
            </Pressable>
            {validating ? <ActivityIndicator color={theme.colors.success} style={styles.validateLoader} /> : null}
            {validationMessage ? <Text style={styles.validationMessage}>{validationMessage}</Text> : null}
            <PrimaryButton label="Scan another code" onPress={resetScanState} />
          </ScrollView>
        ) : null}
      </View>

      <Modal visible={showConfirmValidationModal} transparent animationType="fade" onRequestClose={() => setShowConfirmValidationModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: layout.modalMaxWidth }]}>
            <Text style={styles.modalTitle}>Order detected</Text>
            <Text style={styles.modalRow}>{`Order ID: ${pendingOrderId ?? "-"}`}</Text>
            <Text style={styles.modalRow}>Do you want to validate this order now?</Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondary}
                onPress={() => {
                  setShowConfirmValidationModal(false);
                  setPendingOrderId(null);
                }}
              >
                <Text style={styles.modalSecondaryLabel}>No</Text>
              </Pressable>
              <Pressable
                style={styles.modalPrimary}
                onPress={async () => {
                  const orderId = pendingOrderId;
                  setShowConfirmValidationModal(false);
                  setPendingOrderId(null);
                  if (!orderId) return;
                  await validateQr(orderId);
                }}
              >
                <Text style={styles.modalPrimaryLabel}>Yes, validate</Text>
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
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff"
  },
  backLabel: {
    color: "#374151",
    fontWeight: "700"
  },
  layout: {
    flex: 1,
    gap: 12
  },
  layoutTablet: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  cameraColumn: {
    gap: 12
  },
  cameraColumnTablet: {
    flex: 1.1
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
    overflow: "hidden"
  },
  cameraWrapTablet: {
    height: 420
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
  hintCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: "#fff",
    padding: 16
  },
  hintTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 18
  },
  hintText: {
    marginTop: 8,
    color: theme.colors.mutedText,
    lineHeight: 20
  },
  detailsWrap: {
    flex: 1
  },
  detailsWrapTablet: {
    flex: 0.9
  },
  detailsContent: {
    paddingBottom: 8
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
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
  modalInfo: {
    marginTop: 8,
    color: theme.colors.text,
    fontWeight: "600"
  },
  cameraError: {
    marginTop: 8,
    marginBottom: 6,
    color: theme.colors.danger,
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
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center"
  },
  modalSecondaryLabel: {
    color: "#065f46",
    fontWeight: "800"
  }
});
