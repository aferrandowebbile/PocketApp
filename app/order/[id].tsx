import React from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { theme } from "@/constants/theme";
import { getCachedOrder } from "@/lib/orderStore";
import { orderActionsClient } from "@/services/orderActionsClient";

type OrderLine = {
  name: string;
  quantity: number;
  amount: number | null;
  currency: string | null;
  startDate: string | null;
  imageUrl: string | null;
  firstName: string | null;
  lastName: string | null;
};

type OrderTotals = {
  numProducts: number | null;
  amount: number | null;
  currency: string | null;
};

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

    const key = normalizeAttrKey(getStr(row, ["name", "key", "label", "field"]) ?? "");
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
      .map((item): OrderLine | null => {
        const row = asRecord(item);
        if (!row) return null;
        const name =
          getStr(row, ["name", "product_name", "productName", "title", "ticket_name", "ticketName"]) ?? "Product";
        const quantity = getNum(row, ["quantity", "qty", "count", "units"]) ?? 1;
        const attrsPricing = getPricingAndDateFromItemAttributes(row.attributes);
        const amount = attrsPricing.unitPrice ?? getNum(row, ["amount", "price", "total", "total_price", "totalPrice"]);
        const currency = attrsPricing.currency ?? getStr(row, ["currency", "currency_code", "currencyCode"]);
        const startDate = attrsPricing.date ?? getStr(row, ["start_date", "startDate", "date"]);
        const imageUrl =
          getStr(row, ["image", "image_url", "imageUrl"]) ??
          getStr(asRecord(row.product) ?? {}, ["image", "image_url", "imageUrl"]) ??
          getFromAttributesArray(row.attributes, ["image", "image_url", "imageUrl", "product_image", "productImage"]);
        const customerNames = getCustomerNamesFromItemAttributes(row.attributes);
        return {
          name,
          quantity,
          amount,
          currency,
          startDate,
          imageUrl,
          firstName: customerNames.firstName,
          lastName: customerNames.lastName
        };
      })
      .filter((line): line is OrderLine => Boolean(line));

    if (mapped.length) return mapped;
  }

  return [];
}

export default function OrderDetailScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    guestName?: string;
    product?: string;
    quantity?: string;
    totalPrice?: string;
    currency?: string;
    status?: string;
    date?: string;
    startDate?: string;
  }>();

  const id = typeof params.id === "string" ? params.id : "";
  const cached = id ? getCachedOrder(id) : null;

  const guestName = cached?.guestName ?? (typeof params.guestName === "string" ? params.guestName : "Unknown guest");
  const product = cached?.product ?? (typeof params.product === "string" ? params.product : "Unknown product");
  const quantity = cached?.quantity ?? Number(params.quantity ?? "1");
  const totalPrice = cached?.totalPrice ?? (params.totalPrice ? Number(params.totalPrice) : null);
  const currency = cached?.currency ?? (typeof params.currency === "string" && params.currency ? params.currency : null);
  const status = cached?.status ?? (typeof params.status === "string" ? params.status : "unknown");
  const date = cached?.date ?? (typeof params.date === "string" ? params.date : new Date().toISOString());
  const startDate = cached?.startDate ?? (typeof params.startDate === "string" ? params.startDate : null);
  const [validatedAt, setValidatedAt] = React.useState<string | null>(null);
  const [refundedAt, setRefundedAt] = React.useState<string | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = React.useState<number | null>(null);
  const [itemActionMessage, setItemActionMessage] = React.useState<string | null>(null);
  const [rawOpen, setRawOpen] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState<null | "validate-order" | "refund-order" | "validate-item" | "refund-item">(null);
  const productLines = React.useMemo(() => extractOrderLines(cached?.raw), [cached?.raw]);
  const totals = React.useMemo(() => extractOrderTotals(cached?.raw), [cached?.raw]);
  const normalizedStatus = status.toLowerCase();
  const canValidate = ["completed", "valid"].includes(normalizedStatus) && !validatedAt && !refundedAt;
  const canRefund = ["completed", "valid"].includes(normalizedStatus) && !refundedAt;
  const blockedReason =
    validatedAt
      ? "Order already validated"
      : refundedAt
        ? "Order already refunded"
      : normalizedStatus === "canceled"
        ? "Canceled orders cannot be validated"
        : normalizedStatus === "void"
          ? "Void orders cannot be validated"
          : normalizedStatus === "refunded"
            ? "Refunded orders cannot be validated"
            : normalizedStatus !== "completed" && normalizedStatus !== "valid"
              ? `Order status "${status}" is not eligible for validation`
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

  return (
    <AppShell title="Order Detail">
      <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backLabel}>Back to orders</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.orderId}>#{id || "N/A"}</Text>
          <Text style={styles.guest}>{guestName}</Text>
          <Text style={styles.date}>{new Date(date).toLocaleString()}</Text>
          <Text style={styles.date}>Start date: {startDate ? new Date(startDate).toLocaleString() : "-"}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{status.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Products</Text>
        <View style={styles.totalsCard}>
          <Text style={styles.totalsRow}>{`Number of products: ${totals.numProducts ?? quantity}`}</Text>
          <Text style={styles.totalsRow}>{`Price: ${totalsPrice}`}</Text>
        </View>
        {productLines.length ? (
          productLines.map((line, index) => (
            <Pressable
              key={`${line.name}-${index}`}
              style={[styles.productCard, selectedItemIndex === index ? styles.productCardSelected : null]}
              onPress={() => setSelectedItemIndex((prev) => (prev === index ? null : index))}
            >
              {line.imageUrl ? <Image source={{ uri: line.imageUrl }} style={styles.productImage} resizeMode="cover" /> : null}
              <Text style={styles.productTitle}>{`${index + 1}. Product: ${line.name}`}</Text>
              <Text style={styles.productRow}>{`Person: ${(line.firstName || line.lastName) ? `${line.firstName ?? "-"} ${line.lastName ?? "-"}` : "-"}`}</Text>
              <Text style={styles.productRow}>{`Price: ${line.amount !== null ? `${line.amount}${line.currency ? ` ${line.currency}` : ""}` : "-"}`}</Text>
              <Text style={styles.productRow}>{`Start Date: ${line.startDate ? new Date(line.startDate).toLocaleString() : "-"}`}</Text>
              {selectedItemIndex === index ? (
                <View style={styles.itemActions}>
                  <Pressable
                    style={[styles.itemButton, styles.itemButtonRefund, actionLoading === "refund-item" ? styles.bottomDisabled : null]}
                    disabled={actionLoading !== null}
                    onPress={async () => {
                      try {
                        setActionLoading("refund-item");
                        await orderActionsClient.refundOrderItem(id, { itemIndex: index, itemName: line.name });
                        setItemActionMessage(`Item refunded: ${line.name}`);
                      } catch (error) {
                        setItemActionMessage(error instanceof Error ? error.message : "Refund item API not ready.");
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                  >
                    <Text style={styles.itemButtonLabel}>{actionLoading === "refund-item" ? "Refunding..." : "Refund Item"}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.itemButton, styles.itemButtonValidate, actionLoading === "validate-item" ? styles.bottomDisabled : null]}
                    disabled={actionLoading !== null}
                    onPress={async () => {
                      try {
                        setActionLoading("validate-item");
                        await orderActionsClient.validateOrderItem(id, { itemIndex: index, itemName: line.name });
                        setItemActionMessage(`Item validated: ${line.name}`);
                      } catch (error) {
                        setItemActionMessage(error instanceof Error ? error.message : "Validate item API not ready.");
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                  >
                    <Text style={styles.itemButtonLabel}>{actionLoading === "validate-item" ? "Validating..." : "Validate Item"}</Text>
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          ))
        ) : (
          <Card title={product} subtitle={`Quantity: ${quantity}\nAmount: ${formattedTotal}`} />
        )}
        <View style={styles.validateWrap}>
          <Text style={[styles.validateNote, blockedReason ? styles.validateBlocked : styles.validateAllowed]}>
            {itemActionMessage ?? blockedReason ?? "Tap an item to show item actions."}
          </Text>
          {validatedAt ? <Text style={styles.validatedAt}>Validated at {new Date(validatedAt).toLocaleString()}</Text> : null}
          {refundedAt ? <Text style={styles.validatedAt}>Refunded at {new Date(refundedAt).toLocaleString()}</Text> : null}
        </View>

        {cached?.raw ? (
          <View style={styles.accordionWrap}>
            <Pressable style={styles.accordionHeader} onPress={() => setRawOpen((prev) => !prev)}>
              <Text style={styles.accordionTitle}>Raw Payload (Debug)</Text>
              <Text style={styles.accordionChevron}>{rawOpen ? "▲" : "▼"}</Text>
            </Pressable>
            {rawOpen ? <Card title="Payload" subtitle={JSON.stringify(cached.raw, null, 2)} /> : null}
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.bottomButton, styles.bottomRefund, !canRefund || actionLoading !== null ? styles.bottomDisabled : null]}
          disabled={!canRefund || actionLoading !== null}
          onPress={async () => {
            try {
              setActionLoading("refund-order");
              await orderActionsClient.refundOrder(id);
              setRefundedAt(new Date().toISOString());
              setItemActionMessage("Order refunded");
            } catch (error) {
              setItemActionMessage(error instanceof Error ? error.message : "Refund API not ready.");
            } finally {
              setActionLoading(null);
            }
          }}
        >
          <Text style={styles.bottomButtonLabel}>
            {actionLoading === "refund-order" ? "Refunding..." : refundedAt ? "Refunded" : "Refund"}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.bottomButton, styles.bottomValidate, !canValidate || actionLoading !== null ? styles.bottomDisabled : null]}
          disabled={!canValidate || actionLoading !== null}
          onPress={async () => {
            try {
              setActionLoading("validate-order");
              await orderActionsClient.validateOrder(id);
              setValidatedAt(new Date().toISOString());
              setItemActionMessage("Order validated");
            } catch (error) {
              setItemActionMessage(error instanceof Error ? error.message : "Validate API not ready.");
            } finally {
              setActionLoading(null);
            }
          }}
        >
          <Text style={styles.bottomButtonLabel}>
            {actionLoading === "validate-order" ? "Validating..." : validatedAt ? "Validated" : "Validate"}
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
    backgroundColor: "#fff5fb",
    borderWidth: 1,
    borderColor: "#ffd7ef",
    marginBottom: 10
  },
  backLabel: {
    color: "#a72678",
    fontWeight: "700"
  },
  hero: {
    backgroundColor: "#fff8fc",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ffd7ef",
    padding: 16,
    marginBottom: 12
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
    borderColor: "#ffd7ef",
    borderRadius: theme.radius.md,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#fff8fc"
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
  productCardSelected: {
    borderColor: "#fcb4e0",
    backgroundColor: "#fff8fc"
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
  accordionWrap: {
    marginBottom: 12
  },
  accordionHeader: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  accordionTitle: {
    color: theme.colors.text,
    fontWeight: "700"
  },
  accordionChevron: {
    color: theme.colors.mutedText,
    fontWeight: "700"
  }
});
