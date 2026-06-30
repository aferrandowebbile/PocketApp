export type DashboardSource = "mock" | "api" | "supabase";

export type DashboardAlert = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  event_time: string;
  action_label: string | null;
  action_route: string | null;
};

export type OperatorDashboard = {
  status: "on_track" | "at_risk";
  totalRevenue: number;
  currency: string | null;
  totalGuests: number;
  totalProductsSold: number;
  mobileRevenue: number;
  desktopRevenue: number;
  arrivalsExpected: number;
  arrivalsArrived: number;
  arrivalsNoShow: number;
  pendingCheckins2h: number;
  checkinsLast60m: number;
  validationSuccessRate: number;
  invalidScans: number;
  rejectedScans: number;
  topProductName: string;
  topProductCount: number;
  openIncidents: number;
  staffLoadHint: string;
  checkinsByHour: number[];
  invalidScansByHour: number[];
  noShowByHour: number[];
  alerts: DashboardAlert[];
  source: DashboardSource;
};

type ExportMetric = {
  total?: number;
  currency?: string;
  num_orders?: number;
  num_products?: number;
  num_customers?: number;
  num_guests?: number;
  customers?: number;
  guests?: number;
  daily?: Record<string, ExportMetric | null>;
};

type ExportProduct = {
  name?: string;
  total?: number;
  fees?: number;
  currency?: string;
  num_products?: number;
};

type OrdersExportPayload = {
  all?: ExportMetric;
  desktop?: ExportMetric;
  mobile?: ExportMetric;
  products?: ExportProduct[];
};

const ordersExportBaseUrl = (process.env.EXPO_PUBLIC_ORDERS_DIRECT_BASE_URL ?? "https://connect.spotlio.com").replace(/\/$/, "");

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getDailySeries(metric: ExportMetric | undefined, key: "total" | "num_orders" | "num_products"): number[] {
  const daily = metric?.daily ?? {};
  return Object.keys(daily)
    .sort()
    .map((date) => asNumber(daily[date]?.[key]));
}

function buildSalesHint(payload: OrdersExportPayload): string {
  const mobile = asNumber(payload.mobile?.total);
  const desktop = asNumber(payload.desktop?.total);
  const total = mobile + desktop;
  if (!total) return "No sales in the selected date range.";

  const mobileShare = Math.round((mobile / total) * 100);
  const leadingChannel = mobile >= desktop ? "mobile" : "desktop";
  return `${leadingChannel === "mobile" ? "Mobile" : "Desktop"} leads revenue. Mobile share: ${mobileShare}%.`;
}

function mapExportToDashboard(payload: OrdersExportPayload): OperatorDashboard {
  const all = payload.all ?? {};
  const products = Array.isArray(payload.products) ? payload.products : [];
  const topProduct =
    products
      .slice()
      .sort((a, b) => asNumber(b.total) - asNumber(a.total))[0] ?? null;
  const totalRevenue = asNumber(all.total);
  const orderCount = asNumber(all.num_orders);
  const productCount = asNumber(all.num_products);
  const guestCount =
    asNumber(all.num_customers) ||
    asNumber(all.num_guests) ||
    asNumber(all.customers) ||
    asNumber(all.guests) ||
    orderCount;
  const mobileRevenue = asNumber(payload.mobile?.total);
  const desktopRevenue = asNumber(payload.desktop?.total);
  const channelTotal = mobileRevenue + desktopRevenue;

  return {
    status: orderCount > 0 ? "on_track" : "at_risk",
    totalRevenue,
    currency: all.currency ?? topProduct?.currency ?? null,
    totalGuests: guestCount,
    totalProductsSold: productCount,
    mobileRevenue,
    desktopRevenue,
    arrivalsExpected: productCount,
    arrivalsArrived: orderCount,
    arrivalsNoShow: Math.max(0, productCount - orderCount),
    pendingCheckins2h: asNumber(payload.mobile?.num_orders),
    checkinsLast60m: asNumber(payload.desktop?.num_orders),
    validationSuccessRate: channelTotal ? (mobileRevenue / channelTotal) * 100 : 0,
    invalidScans: products.length,
    rejectedScans: 0,
    topProductName: topProduct?.name ?? "No products",
    topProductCount: asNumber(topProduct?.num_products),
    openIncidents: 0,
    staffLoadHint: buildSalesHint(payload),
    checkinsByHour: getDailySeries(all, "total"),
    invalidScansByHour: getDailySeries(payload.mobile, "total"),
    noShowByHour: getDailySeries(payload.desktop, "total"),
    alerts: [],
    source: "api"
  };
}

export async function getOperatorDashboard(params: {
  companyId: string;
  dateIso: string;
  source?: DashboardSource;
  startDateIso?: string;
  endDateIso?: string;
  apiToken?: string | null;
}): Promise<OperatorDashboard> {
  void params.companyId;
  void params.dateIso;
  void params.source;

  if (!params.apiToken) {
    throw new Error("Missing selected site API token. Please select a site before loading dashboard.");
  }

  const query = new URLSearchParams();
  query.set("startDate", params.startDateIso ?? params.dateIso);
  query.set("endDate", params.endDateIso ?? params.dateIso);
  query.set("api_token", params.apiToken);

  const response = await fetch(`${ordersExportBaseUrl}/console/export/orders?${query.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Dashboard export error (${response.status})${body ? `: ${body.slice(0, 140)}` : ""}`);
  }

  const payload = (await response.json()) as OrdersExportPayload;
  return mapExportToDashboard(payload);
}
