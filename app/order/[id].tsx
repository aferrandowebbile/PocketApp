import React from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { theme } from "@/constants/theme";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useAuth } from "@/lib/auth";
import { cacheOrder, getCachedOrder } from "@/lib/orderStore";
import { getOrderById, type RemoteOrder } from "@/services/ordersClient";
import { redeemsClient } from "@/services/redeemsClient";

type OrderLine = {
  lineNumber: number;
  name: string;
  quantity: number;
  amount: number | null;
  currency: string | null;
  startDate: string | null;
  imageUrl: string | null;
  firstName: string | null;
  lastName: string | null;
  redeemed: boolean;
};

type OrderTotals = {
  numProducts: number | null;
  amount: number | null;
  currency: string | null;
};

type ProductTimeState = "past" | "today" | "tomorrow" | "later";
type OrderDetailParams = {
  id?: string | string[];
  guestName?: string | string[];
  product?: string | string[];
  quantity?: string | string[];
  totalPrice?: string | string[];
  currency?: string | string[];
  status?: string | string[];
  date?: string | string[];
  startDate?: string | string[];
  tenantId?: string | string[];
  lookupMode?: string | string[];
};

function paramString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

function parseParamNumber(value: string, fallback: number): number {
  if (!value.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMaybeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function getNum(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  }
  return null;
}

function getStr(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function hasRedeemFields(record: Record<string, unknown> | null): boolean {
  if (!record) return false;
  const redemption = getStr(record, ["redemption", "redeem_status", "redeemStatus"])?.toLowerCase() ?? null;
  if (redemption === "full") return true;
  const redeemedAt =
    getStr(record, ["redeemed_at", "redeemedAt"]) ??
    getStr(record, ["redeemed_at_day", "redeemedAtDay"]) ??
    getStr(record, ["redeemed_at_hour", "redeemedAtHour"]) ??
    null;
  const redeemedAtObject =
    asRecord(record.redeemed_at) ??
    asRecord(record.redeemedAt) ??
    null;
  const redeemedAtObjectDay = redeemedAtObject ? getStr(redeemedAtObject, ["day", "date"]) : null;
  const redeemedAtObjectHour = redeemedAtObject ? getStr(redeemedAtObject, ["hour", "time"]) : null;
  if (redeemedAtObjectDay || redeemedAtObjectHour) return true;
  if (redeemedAt) return true;
  return record.redeemed === true || record.is_redeemed === true || record.isRedeemed === true;
}

function normalizeAttrKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getFromAttributesArray(
  attributes: unknown,
  wantedKeys: string[]
): string | null {
  if (!Array.isArray(attributes)) return null;
  const targetSet = new Set(wantedKeys.map((key) => normalizeAttrKey(key)));

  for (const item of attributes) {
    const row = asRecord(item);
    if (!row) continue;
    const rawKey = getStr(row, ["name", "key", "label", "field"]) ?? "";
    const key = normalizeAttrKey(rawKey);
    if (!targetSet.has(key)) continue;

    const direct =
      getStr(row, ["value", "text", "answer", "content"]) ??
      getStr(asRecord(row.value) ?? {}, ["value", "text", "url", "src"]);
    if (direct) return direct;
  }

  return null;
}

function getCustomerNamesFromItemAttributes(attributes: unknown): { firstName: string | null; lastName: string | null } {
  if (!Array.isArray(attributes)) return { firstName: null, lastName: null };

  let firstName: string | null = null;
  let lastName: string | null = null;

  for (const item of attributes) {
    const row = asRecord(item);
    if (!row) continue;

    const key = normalizeAttrKey(getStr(row, ["name", "key", "label", "field"]) ?? "");
    const valueObj = asRecord(row.value);
    const customerInValue = valueObj ? asRecord(valueObj.customer) : null;
    const nestedFirst =
      (valueObj ? getStr(valueObj, ["first_name", "firstName", "firstname"]) : null) ??
      (customerInValue ? getStr(customerInValue, ["first_name", "firstName", "firstname"]) : null);
    const nestedLast =
      (valueObj ? getStr(valueObj, ["last_name", "lastName", "lastname"]) : null) ??
      (customerInValue ? getStr(customerInValue, ["last_name", "lastName", "lastname"]) : null);

    // Case 1: attribute key explicitly references customer first/last name.
    if (!firstName && (key === "customerfirstname" || key === "customerfirst" || key === "firstname" || key === "first")) {
      firstName = getStr(row, ["value", "text", "answer"]) ?? getStr(valueObj ?? {}, ["value", "text"]) ?? nestedFirst ?? null;
    }
    if (!lastName && (key === "customerlastname" || key === "customerlast" || key === "lastname" || key === "last")) {
      lastName = getStr(row, ["value", "text", "answer"]) ?? getStr(valueObj ?? {}, ["value", "text"]) ?? nestedLast ?? null;
    }

    // Case 2: attribute key is `customer` and value is object containing first_name/last_name.
    if (key === "customer" && valueObj) {
      if (!firstName) firstName = getStr(valueObj, ["first_name", "firstName", "firstname", "first"]);
      if (!lastName) lastName = getStr(valueObj, ["last_name", "lastName", "lastname", "last"]);
    }

    // Case 3: attributes can hold nested customer object even when key is different.
    if (!firstName && nestedFirst) firstName = nestedFirst;
    if (!lastName && nestedLast) lastName = nestedLast;
  }

  return { firstName, lastName };
}

function getPricingAndDateFromItemAttributes(attributes: unknown): {
  unitPrice: number | null;
  currency: string | null;
  date: string | null;
} {
  if (!Array.isArray(attributes)) return { unitPrice: null, currency: null, date: null };

  let unitPrice: number | null = null;
  let currency: string | null = null;
  let date: string | null = null;

  for (const item of attributes) {
    const row = asRecord(item);
    if (!row) continue;

    const key = normalizeAttrKey(getStr(row, ["attribute", "name", "key", "label", "field"]) ?? "");
    const valueObj = asRecord(row.value);
    const scalar =
      getStr(row, ["value", "text", "answer"]) ??
      getStr(valueObj ?? {}, ["value", "text"]);

    if (!unitPrice && key === "unitprice") {
      const asNum = scalar ? Number(scalar) : null;
      unitPrice = asNum !== null && !Number.isNaN(asNum) ? asNum : (valueObj ? getNum(valueObj, ["unit_price", "unitPrice"]) : null);
    }

    if (!currency && key === "currency") {
      currency = scalar ?? (valueObj ? getStr(valueObj, ["currency", "code"]) : null);
    }

    if (!date && key === "date") {
      date = scalar ?? (valueObj ? getStr(valueObj, ["date"]) : null);
    }
  }

  return { unitPrice, currency, date };
}

function extractOrderTotals(raw: Record<string, unknown> | undefined): OrderTotals {
  if (!raw) return { numProducts: null, amount: null, currency: null };

  const totalObj =
    asRecord(raw.total) ??
    asRecord(asRecord(raw.order)?.total) ??
    null;

  const numProducts =
    (totalObj ? getNum(totalObj, ["num_products", "numProducts"]) : null) ??
    getNum(raw, ["num_products", "numProducts"]) ??
    null;

  const amount =
    (totalObj ? getNum(totalObj, ["amount", "total_amount", "totalAmount", "price"]) : null) ??
    getNum(raw, ["amount", "total_amount", "totalAmount", "price"]) ??
    null;

  const currency =
    (totalObj ? getStr(totalObj, ["currency", "currency_code", "currencyCode"]) : null) ??
    getStr(raw, ["currency", "currency_code", "currencyCode"]) ??
    null;

  return { numProducts, amount, currency };
}

function extractOrderRedeemed(raw: Record<string, unknown> | undefined): boolean {
  if (!raw) return false;
  return hasRedeemFields(raw) || hasRedeemFields(asRecord(raw.order));
}

function extractOrderLines(raw: Record<string, unknown> | undefined): OrderLine[] {
  if (!raw) return [];
  const arrays: unknown[] = [
    raw.products,
    raw.line_items,
    raw.lineItems,
    raw.items,
    asRecord(raw.order)?.products,
    asRecord(raw.order)?.line_items,
    asRecord(raw.order)?.lineItems,
    asRecord(raw.order)?.items
  ];

  for (const candidate of arrays) {
    if (!Array.isArray(candidate)) continue;
    const mapped = candidate
      .map((item, index): OrderLine | null => {
        const row = asRecord(item);
        if (!row) return null;
        const lineNumber = getNum(row, ["line_number", "lineNumber", "line", "number"]) ?? index + 1;
        const name =
          getStr(row, ["name", "product_name", "productName", "title", "ticket_name", "ticketName"]) ?? "Product";
        const quantity = getNum(row, ["quantity", "qty", "count", "units"]) ?? 1;
        const attributes = row.attributes;
        const attrsPricing = getPricingAndDateFromItemAttributes(attributes);
        const amount =
          getNum(row, ["unit_price", "unitPrice", "price", "amount", "total_amount", "totalAmount"]) ?? attrsPricing.unitPrice;
        const currency = getStr(row, ["currency", "currency_code", "currencyCode"]) ?? attrsPricing.currency;
        const startDate =
          getStr(row, ["start_date", "startDate", "date", "event_date", "eventDate"]) ??
          attrsPricing.date;
        const imageUrl =
          getStr(row, ["image", "image_url", "imageUrl"]) ??
          getStr(asRecord(row.product) ?? {}, ["image", "image_url", "imageUrl"]) ??
          getFromAttributesArray(attributes, ["image", "image_url", "imageUrl", "product_image", "productImage"]);
        const customerNames = getCustomerNamesFromItemAttributes(attributes);
        const firstName =
          customerNames.firstName ??
          getStr(row, ["first_name", "firstName"]) ??
          getStr(asRecord(row.customer) ?? {}, ["first_name", "firstName"]);
        const lastName =
          customerNames.lastName ??
          getStr(row, ["last_name", "lastName"]) ??
          getStr(asRecord(row.customer) ?? {}, ["last_name", "lastName"]);
        const redeemed = hasRedeemFields(row) || hasRedeemFields(asRecord(row.product));
        return {
          lineNumber,
          name,
          quantity,
          amount,
          currency,
          startDate,
          imageUrl,
          firstName,
          lastName,
          redeemed
        };
      })
      .filter((line): line is OrderLine => Boolean(line));

    if (mapped.length) return mapped;
  }

  return [];
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getProductTimeState(value: string | null): ProductTimeState {
  if (!value) return "later";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "later";

  const todayStart = startOfLocalDay(new Date());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  const dayAfterTomorrowStart = new Date(todayStart);
  dayAfterTomorrowStart.setDate(todayStart.getDate() + 2);
  const targetStart = startOfLocalDay(parsed);

  if (targetStart.getTime() < todayStart.getTime()) return "past";
  if (targetStart.getTime() === todayStart.getTime()) return "today";
  if (targetStart.getTime() === tomorrowStart.getTime()) return "tomorrow";
  if (targetStart.getTime() >= dayAfterTomorrowStart.getTime()) return "later";
  return "later";
}

export default function OrderDetailScreen() {
  const { profile } = useAuth();
  const layout = useResponsiveLayout();
  const params = useLocalSearchParams<OrderDetailParams>();
  const tenantIdFromRoute = paramString(params.tenantId);
  const tenantId = tenantIdFromRoute || profile?.connect_client_id || undefined;

  const id = paramString(params.id);
  const cached = id ? getCachedOrder(id) : null;
  const [orderData, setOrderData] = React.useState<RemoteOrder | null>(cached);
  const [orderLoading, setOrderLoading] = React.useState(false);
  const [orderError, setOrderError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;

    setOrderLoading(true);
    setOrderError(null);
    getOrderById(id, tenantId)
      .then((result) => {
        if (!result) {
          setOrderError("Order was not found in API response.");
          return;
        }
        setOrderData(result);
        cacheOrder(result);
      })
      .catch((error: unknown) => {
        setOrderError(error instanceof Error ? error.message : "Failed to load order details.");
      })
      .finally(() => {
        setOrderLoading(false);
      });
  }, [id, tenantId]);

  const sourceOrder = orderData ?? cached;
  const routeGuestName = paramString(params.guestName);
  const routeProduct = paramString(params.product);
  const guestName = sourceOrder?.guestName ?? (routeGuestName.length ? routeGuestName : "Unknown guest");
  const product = sourceOrder?.product ?? (routeProduct.length ? routeProduct : "Unknown product");
  const quantity = sourceOrder?.quantity ?? parseParamNumber(paramString(params.quantity), 1);
  const routeTotalPrice = paramString(params.totalPrice);
  const totalPrice = sourceOrder?.totalPrice ?? (routeTotalPrice ? parseParamNumber(routeTotalPrice, NaN) : null);
  const routeCurrency = paramString(params.currency);
  const currency = sourceOrder?.currency ?? (routeCurrency ? routeCurrency : null);
  const routeStatus = paramString(params.status);
  const routeDate = paramString(params.date);
  const status = sourceOrder?.status ?? (routeStatus.length ? routeStatus : "unknown");
  const date = sourceOrder?.date ?? (routeDate.length ? routeDate : new Date().toISOString());
  const routeStartDate = paramString(params.startDate);
  const startDate = sourceOrder?.startDate ?? (routeStartDate ? routeStartDate : null);
  const [validatedAt, setValidatedAt] = React.useState<string | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = React.useState<number | null>(null);
  const [itemActionMessage, setItemActionMessage] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState<null | "redeem-order" | "revoke-order" | "redeem-item" | "revoke-item">(null);
  const [orderRedeemedOverride, setOrderRedeemedOverride] = React.useState<boolean | null>(null);
  const [lineRedeemedOverrides, setLineRedeemedOverrides] = React.useState<Record<number, boolean>>({});
  const productLines = React.useMemo(() => extractOrderLines(sourceOrder?.raw), [sourceOrder?.raw]);
  const totals = React.useMemo(() => extractOrderTotals(sourceOrder?.raw), [sourceOrder?.raw]);
  const sourceOrderRedeemed = React.useMemo(() => extractOrderRedeemed(sourceOrder?.raw), [sourceOrder?.raw]);
  const orderRedeemed = orderRedeemedOverride ?? sourceOrderRedeemed;
  const redeemedProductCount = React.useMemo(
    () => productLines.filter((line) => (lineRedeemedOverrides[line.lineNumber] ?? line.redeemed)).length,
    [lineRedeemedOverrides, productLines]
  );
  const allProductsRedeemed = productLines.length > 0 && redeemedProductCount === productLines.length;
  const fullyRedeemed = orderRedeemed || allProductsRedeemed;
  const normalizedStatus = status.toLowerCase();
  const eligibleForRedeem = Boolean(id) && ["completed", "valid"].includes(normalizedStatus);
  const canRedeem = eligibleForRedeem && !fullyRedeemed && !validatedAt;
  const canRevokeRedeem = eligibleForRedeem && fullyRedeemed;
  const productCardWidth = layout.cardColumns === 3 ? "31.5%" : layout.cardColumns === 2 ? "48.5%" : "100%";
  const blockedReason =
    fullyRedeemed || validatedAt
      ? "Order already redeemed"
      : normalizedStatus === "canceled"
        ? "Canceled orders cannot be redeemed"
        : normalizedStatus === "void"
          ? "Void orders cannot be redeemed"
          : normalizedStatus === "refunded"
            ? "Refunded orders cannot be redeemed"
            : normalizedStatus !== "completed" && normalizedStatus !== "valid"
              ? `Order status "${status}" is not eligible for redeem`
              : null;

  const formattedTotal = React.useMemo(() => {
    if (totalPrice === null || Number.isNaN(totalPrice)) return "-";
    if (currency) {
      try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(totalPrice);
      } catch {
        return `${totalPrice.toFixed(2)} ${currency}`;
      }
    }
    return totalPrice.toFixed(2);
  }, [currency, totalPrice]);

  const totalsPrice = React.useMemo(() => {
    if (totals.amount === null || Number.isNaN(totals.amount)) return formattedTotal;
    if (totals.currency) {
      try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency: totals.currency }).format(totals.amount);
      } catch {
        return `${totals.amount.toFixed(2)} ${totals.currency}`;
      }
    }
    return totals.amount.toFixed(2);
  }, [formattedTotal, totals.amount, totals.currency]);
  const productCountFallback = React.useMemo(() => {
    if (!productLines.length) return quantity;
    return productLines.reduce((sum, line) => sum + Math.max(0, line.quantity || 0), 0);
  }, [productLines, quantity]);

  const timeStateMeta: Record<ProductTimeState, { label: string; cardStyle: object; chipStyle: object }> = {
    past: { label: "Past", cardStyle: styles.productCardPast, chipStyle: styles.productChipPast },
    today: { label: "Today", cardStyle: styles.productCardToday, chipStyle: styles.productChipToday },
    tomorrow: { label: "Tomorrow", cardStyle: styles.productCardTomorrow, chipStyle: styles.productChipTomorrow },
    later: { label: "Later", cardStyle: styles.productCardLater, chipStyle: styles.productChipLater }
  };

  return (
    <AppShell title="Order Detail">
      <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, layout.isTablet ? styles.scrollContentTablet : null]}
      >
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
          <Text style={styles.backLabel}>Back to orders</Text>
        </Pressable>

        <View style={[styles.topGrid, layout.isTablet ? styles.topGridTablet : null]}>
          <View style={[styles.hero, fullyRedeemed ? styles.heroRedeemed : null, layout.isTablet ? styles.heroTablet : null]}>
            <Text style={styles.orderId}>#{id || "N/A"}</Text>
            <Text style={styles.guest}>{guestName}</Text>
            <Text style={styles.date}>{formatMaybeDate(date) ?? "-"}</Text>
            {startDate ? <Text style={styles.date}>Start date: {formatMaybeDate(startDate) ?? "-"}</Text> : null}
            {orderLoading ? <Text style={styles.date}>Refreshing order from API...</Text> : null}
            {orderError ? <Text style={styles.errorText}>{orderError}</Text> : null}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{status.toUpperCase()}</Text>
            </View>
          </View>

          <View style={[styles.totalsCard, layout.isTablet ? styles.totalsCardTablet : null]}>
            <Text style={styles.sectionTitle}>Products</Text>
            <Text style={styles.totalsRow}>{`Number of products: ${totals.numProducts ?? productCountFallback}`}</Text>
            <Text style={styles.totalsRow}>{`Price: ${totalsPrice}`}</Text>
            <View style={styles.validateWrap}>
              <Text style={[styles.validateNote, blockedReason ? styles.validateBlocked : styles.validateAllowed]}>
                {itemActionMessage ?? blockedReason ?? "Tap an item to show redeem actions."}
              </Text>
              {validatedAt ? <Text style={styles.validatedAt}>Redeemed at {new Date(validatedAt).toLocaleString()}</Text> : null}
            </View>
          </View>
        </View>
        {productLines.length ? (
          <View style={styles.productsGrid}>
            {productLines.map((line, index) => {
              const timeState = getProductTimeState(line.startDate);
              const meta = timeStateMeta[timeState];
              const lineRedeemed = lineRedeemedOverrides[line.lineNumber] ?? line.redeemed;
              const productCardStyle = lineRedeemed ? styles.productCardRedeemed : meta.cardStyle;
              return (
                <Pressable
                  key={`${line.name}-${index}`}
                  style={[styles.productCard, productCardStyle, selectedItemIndex === index ? styles.productCardSelected : null, { width: productCardWidth }]}
                  onPress={() => setSelectedItemIndex((prev) => (prev === index ? null : index))}
                >
                  <View style={[styles.productStateChip, lineRedeemed ? styles.productChipRedeemed : meta.chipStyle]}>
                    <View style={styles.chipContent}>
                      {lineRedeemed ? (
                        <Feather name="check-circle" size={12} color="#166534" />
                      ) : (
                        <Feather name="clock" size={12} color="#374151" />
                      )}
                      <Text style={[styles.productStateChipLabel, lineRedeemed ? styles.productStateChipLabelRedeemed : null]}>
                        {lineRedeemed ? "Redeemed" : meta.label}
                      </Text>
                    </View>
                  </View>
                  {line.imageUrl ? <Image source={{ uri: line.imageUrl }} style={styles.productImage} resizeMode="cover" /> : null}
                  <Text style={styles.productTitle}>{`${index + 1}. Product: ${line.name}`}</Text>
                  {line.firstName || line.lastName ? (
                    <Text style={styles.productRow}>{`Person: ${[line.firstName, line.lastName].filter(Boolean).join(" ")}`}</Text>
                  ) : null}
                  <Text style={styles.productRow}>{`Price: ${line.amount !== null ? `${line.amount}${line.currency ? ` ${line.currency}` : ""}` : "-"}`}</Text>
                  {line.startDate ? <Text style={styles.productRow}>{`Start Date: ${formatMaybeDate(line.startDate) ?? "-"}`}</Text> : null}
                  {selectedItemIndex === index ? (
                    <View style={styles.itemActions}>
                      {lineRedeemed ? (
                        <Pressable
                          style={[styles.itemButton, styles.itemButtonRefund, actionLoading === "revoke-item" ? styles.bottomDisabled : null]}
                          disabled={actionLoading !== null}
                          onPress={async () => {
                            try {
                              setActionLoading("revoke-item");
                              const response = await redeemsClient.revokeProduct(id, line.lineNumber);
                              setLineRedeemedOverrides((prev) => ({ ...prev, [line.lineNumber]: false }));
                              if (response.result?.order_redeem_revoked === true) setOrderRedeemedOverride(false);
                              setItemActionMessage(response.message || `Product redeem revoked: ${line.name}`);
                            } catch (error) {
                              setItemActionMessage(error instanceof Error ? error.message : "Revoke product redeem failed.");
                            } finally {
                              setActionLoading(null);
                            }
                          }}
                        >
                          <Text style={styles.itemButtonLabel}>{actionLoading === "revoke-item" ? "Revoking..." : "Revoke Redeem"}</Text>
                        </Pressable>
                      ) : null}
                      {!lineRedeemed ? (
                        <Pressable
                          style={[styles.itemButton, styles.itemButtonValidate, actionLoading === "redeem-item" ? styles.bottomDisabled : null]}
                          disabled={actionLoading !== null}
                          onPress={async () => {
                            try {
                              setActionLoading("redeem-item");
                              const response = await redeemsClient.redeemProduct(id, line.lineNumber);
                              setLineRedeemedOverrides((prev) => ({ ...prev, [line.lineNumber]: true }));
                              if (response.result?.order_redeemed === true) setOrderRedeemedOverride(true);
                              setItemActionMessage(response.message || `Product redeemed: ${line.name}`);
                            } catch (error) {
                              setItemActionMessage(error instanceof Error ? error.message : "Redeem product failed.");
                            } finally {
                              setActionLoading(null);
                            }
                          }}
                        >
                          <Text style={styles.itemButtonLabel}>{actionLoading === "redeem-item" ? "Redeeming..." : "Redeem Item"}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Card title={product} subtitle={`Quantity: ${quantity}\nAmount: ${formattedTotal}`} />
        )}

      </ScrollView>
      <View style={[styles.bottomBar, { left: -layout.screenPadding, right: -layout.screenPadding }]}>
        {canRevokeRedeem ? (
          <Pressable
            style={[styles.bottomButton, styles.bottomRefund, actionLoading !== null ? styles.bottomDisabled : null]}
            disabled={actionLoading !== null}
            onPress={async () => {
              try {
                setActionLoading("revoke-order");
                const response = await redeemsClient.revokeOrder(id);
                setValidatedAt(null);
                setOrderRedeemedOverride(false);
                setLineRedeemedOverrides(Object.fromEntries(productLines.map((line) => [line.lineNumber, false])));
                setItemActionMessage(response.message || "Order redeem revoked");
              } catch (error) {
                setItemActionMessage(error instanceof Error ? error.message : "Revoke order redeem failed.");
              } finally {
                setActionLoading(null);
              }
            }}
          >
            <Text style={styles.bottomButtonLabel}>
              {actionLoading === "revoke-order" ? "Revoking..." : "Revoke All Items"}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.bottomButton, styles.bottomValidate, !canRedeem || actionLoading !== null ? styles.bottomDisabled : null]}
          disabled={!canRedeem || actionLoading !== null}
          onPress={async () => {
            try {
              setActionLoading("redeem-order");
              const response = await redeemsClient.redeemOrder(id);
              setValidatedAt(new Date().toISOString());
              setOrderRedeemedOverride(true);
              setLineRedeemedOverrides(Object.fromEntries(productLines.map((line) => [line.lineNumber, true])));
              setItemActionMessage(response.message || "Order redeemed");
            } catch (error) {
              setItemActionMessage(error instanceof Error ? error.message : "Redeem order failed.");
            } finally {
              setActionLoading(null);
            }
          }}
        >
          <Text style={styles.bottomButtonLabel}>
            {actionLoading === "redeem-order" ? "Redeeming..." : "Redeem All Items"}
          </Text>
        </Pressable>
      </View>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 10
  },
  backLabel: {
    color: "#374151",
    fontWeight: "700"
  },
  hero: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    marginBottom: 12
  },
  heroTablet: {
    flex: 1.2,
    marginBottom: 0
  },
  topGrid: {
    gap: 12
  },
  topGridTablet: {
    flexDirection: "row",
    alignItems: "stretch"
  },
  heroRedeemed: {
    backgroundColor: "#f0fdf4",
    borderColor: "#86efac"
  },
  orderId: {
    color: "#cc3f97",
    fontWeight: "700",
    marginBottom: 4
  },
  guest: {
    color: theme.colors.text,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800"
  },
  date: {
    marginTop: 6,
    color: theme.colors.mutedText
  },
  errorText: {
    marginTop: 6,
    color: theme.colors.danger
  },
  badge: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  badgeText: {
    color: "#3e1240",
    fontWeight: "700",
    fontSize: 12
  },
  validateWrap: {
    marginBottom: 12
  },
  validateNote: {
    marginTop: 8,
    fontSize: 12
  },
  validateAllowed: {
    color: theme.colors.success
  },
  validateBlocked: {
    color: theme.colors.warning
  },
  validatedAt: {
    marginTop: 6,
    fontSize: 12,
    color: theme.colors.mutedText
  },
  sectionTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 18,
    marginBottom: 8
  },
  totalsCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: theme.radius.md,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#ffffff"
  },
  totalsCardTablet: {
    flex: 0.8,
    marginBottom: 0
  },
  totalsRow: {
    color: theme.colors.text,
    fontWeight: "700",
    marginBottom: 4
  },
  productCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 10,
    marginBottom: 12,
    backgroundColor: "#fff"
  },
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  productCardPast: {
    backgroundColor: "#fafafa",
    borderColor: "#e5e7eb"
  },
  productCardToday: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0"
  },
  productCardTomorrow: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe"
  },
  productCardLater: {
    backgroundColor: "#fffaf0",
    borderColor: "#fde68a"
  },
  productCardRedeemed: {
    backgroundColor: "#f0fdf4",
    borderColor: "#86efac"
  },
  productCardSelected: {
    borderColor: "#f9a8d4",
    backgroundColor: "#ffffff"
  },
  productStateChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8
  },
  chipContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  productChipPast: {
    backgroundColor: "#f3f4f6"
  },
  productChipToday: {
    backgroundColor: "#dcfce7"
  },
  productChipTomorrow: {
    backgroundColor: "#dbeafe"
  },
  productChipLater: {
    backgroundColor: "#fef3c7"
  },
  productChipRedeemed: {
    backgroundColor: "#bbf7d0"
  },
  productStateChipLabel: {
    color: "#374151",
    fontSize: 11,
    fontWeight: "700"
  },
  productStateChipLabelRedeemed: {
    color: "#166534"
  },
  productImage: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#f3f4f6"
  },
  productTitle: {
    color: theme.colors.text,
    fontWeight: "700",
    marginBottom: 6
  },
  productRow: {
    color: theme.colors.text,
    marginBottom: 3
  },
  itemActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8
  },
  itemButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center"
  },
  itemButtonRefund: {
    backgroundColor: "#fee2e2"
  },
  itemButtonValidate: {
    backgroundColor: "#dcfce7"
  },
  itemButtonLabel: {
    fontWeight: "700",
    color: "#1f2937"
  },
  screen: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 96
  },
  scrollContentTablet: {
    paddingBottom: 108
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    flexDirection: "row",
    gap: 10
  },
  bottomButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  bottomRefund: {
    backgroundColor: "#fecaca"
  },
  bottomValidate: {
    backgroundColor: "#bbf7d0"
  },
  bottomDisabled: {
    opacity: 0.55
  },
  bottomButtonLabel: {
    fontWeight: "800",
    color: "#1f2937"
  },
});
