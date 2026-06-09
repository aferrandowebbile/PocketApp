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
import { useAuth } from "@/lib/auth";
import { getSelectedSiteApiToken } from "@/lib/directusAuth";
import { redeemsClient } from "@/services/redeemsClient";
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

function isOrderRedeemed(order: RemoteOrder | null): boolean {
  if (!order) return false;
  if (order.redemption === "full") return true;
  const raw = asRecord(order.raw);
  if (!raw) return false;
  return raw.redeemed === true || raw.is_redeemed === true || raw.isRedeemed === true;
}

function canRedeemOrder(order: RemoteOrder | null): boolean {
  if (!order) return false;
  const status = order.status.toLowerCase();
  return countOrderTickets(order) > 0 && !isOrderRedeemed(order) && (status === "completed" || status === "valid");
}

export default function ScanTicketScreen() {
  const { profile } = useAuth();
  const tenantId = profile?.connect_client_id ?? "";
  const [permission, requestPermission] = useCameraPermissions();
  const [lastScanAt, setLastScanAt] = useState(0);
  const [rawQrValue, setRawQrValue] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [matchedOrder, setMatchedOrder] = useState<RemoteOrder | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [showConfirmValidationModal, setShowConfirmValidationModal] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanTypeLabel, setScanTypeLabel] = useState<string | null>(null);
  const [redeemingOrder, setRedeemingOrder] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null);
  const isFocused = useIsFocused();
  const permissionDeniedPermanently = permission?.status === "denied" && permission?.canAskAgain === false;

  const parsed = useMemo(() => (rawQrValue ? parseQrData(rawQrValue) : null), [rawQrValue]);
  const canValidateQr = Boolean(rawQrValue && rawQrValue.trim().length > 0);
  const ticketCount = useMemo(() => countOrderTickets(matchedOrder), [matchedOrder]);
  const redeemableOrder = useMemo(() => canRedeemOrder(matchedOrder), [matchedOrder]);

  const onScan = (result: BarcodeScanningResult) => {
    if (Date.now() - lastScanAt < 2000) return;
    setLastScanAt(Date.now());
    const scannedValue = result.data.trim();
    setRawQrValue(scannedValue);
    setValidationMessage(null);
    setMatchedOrder(null);
    setRedeemMessage(null);
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
    setMatchedOrder(null);

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
        setValidationMessage(apiMessage ? `Validation error: ${apiMessage}` : "Order not found for this code.");
        return;
      }

      const apiMessage = extractApiMessage(payload);
      setMatchedOrder(parsedOrders[0]);
      setValidationMessage(apiMessage ? `Validation successful: ${apiMessage}` : "Validation successful: order found.");
      setShowSuccessModal(true);
    } catch (error) {
      setValidationMessage(error instanceof Error ? `Validation error: ${error.message}` : "Validation error.");
    } finally {
      setValidating(false);
    }
  };

  const resetScanState = () => {
    setRawQrValue(null);
    setValidationMessage(null);
    setMatchedOrder(null);
    setShowSuccessModal(false);
    setRedeemMessage(null);
    setPendingOrderId(null);
    setShowConfirmValidationModal(false);
    setScanTypeLabel(null);
  };

  return (
    <AppShell title="Scan Ticket">
      <Pressable
        style={styles.back}
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
            return;
          }
          router.replace("/(tabs)/orders");
        }}
      >
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>

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
        <View style={styles.cameraWrap} collapsable={false}>
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

      {rawQrValue ? (
        <ScrollView style={styles.detailsWrap}>
          <Card title="Detected Format" subtitle={parsed?.type.toUpperCase() ?? "-"} />
          {scanTypeLabel ? <Card title="Scanner Type" subtitle={scanTypeLabel} /> : null}
          {parsed?.rows.map((row) => (
            <Card key={`${row.key}:${row.value}`} title={row.key} subtitle={row.value} />
          ))}
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
          <PrimaryButton
            label="Scan another code"
            onPress={resetScanState}
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
                <Text style={styles.modalRow}>Tickets: {ticketCount}</Text>
                <Text style={styles.modalRow}>Status: {matchedOrder.status}</Text>
                <Text style={styles.modalRow}>Date: {new Date(matchedOrder.date).toLocaleString()}</Text>
                {redeemMessage ? <Text style={styles.modalInfo}>{redeemMessage}</Text> : null}
                {!redeemMessage && ticketCount === 0 ? <Text style={styles.modalInfo}>This order has no tickets to redeem.</Text> : null}
                {!redeemMessage && ticketCount > 0 && !redeemableOrder ? (
                  <Text style={styles.modalInfo}>
                    {isOrderRedeemed(matchedOrder) ? "This order is already redeemed." : "This order is not eligible for redeem."}
                  </Text>
                ) : null}
                {!redeemMessage && redeemableOrder ? <Text style={styles.modalInfo}>This order has tickets. Do you want to redeem it now?</Text> : null}
              </>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={() => setShowSuccessModal(false)}>
                <Text style={styles.modalSecondaryLabel}>Close</Text>
              </Pressable>
              {redeemableOrder ? (
                <Pressable
                  style={[styles.modalPrimary, redeemingOrder ? styles.validateButtonDisabled : null]}
                  disabled={redeemingOrder}
                  onPress={async () => {
                    if (!matchedOrder) return;
                    try {
                      setRedeemingOrder(true);
                      const response = await redeemsClient.redeemOrder(matchedOrder.id);
                      setMatchedOrder({
                        ...matchedOrder,
                        redemption: "full",
                        raw: {
                          ...matchedOrder.raw,
                          redeemed: true,
                          is_redeemed: true,
                          isRedeemed: true
                        }
                      });
                      setRedeemMessage(response.message || "Order redeemed");
                      setValidationMessage(response.message || "Order redeemed");
                    } catch (error) {
                      const message = error instanceof Error ? error.message : "Redeem order failed.";
                      setRedeemMessage(message);
                    } finally {
                      setRedeemingOrder(false);
                    }
                  }}
                >
                  <Text style={styles.modalPrimaryLabel}>{redeemingOrder ? "Redeeming..." : "Redeem order"}</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.modalPrimary}
                onPress={() => {
                  resetScanState();
                }}
              >
                <Text style={styles.modalPrimaryLabel}>Scan Next</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={showConfirmValidationModal} transparent animationType="fade" onRequestClose={() => setShowConfirmValidationModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
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
