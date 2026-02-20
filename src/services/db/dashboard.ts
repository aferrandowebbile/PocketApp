import { supabase } from "@/lib/supabase";

export type DashboardSource = "supabase" | "mock" | "api";

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

type SnapshotRow = {
  status: "on_track" | "at_risk";
  arrivals_expected: number;
  arrivals_arrived: number;
  arrivals_no_show: number;
  pending_checkins_2h: number;
  checkins_last_60m: number;
  validation_success_rate: number;
  invalid_scans: number;
  rejected_scans: number;
  top_product_name: string | null;
  top_product_count: number;
  open_incidents: number;
  staff_load_hint: string | null;
  checkins_by_hour: unknown;
  invalid_scans_by_hour: unknown;
  no_show_by_hour: unknown;
};

type AlertRow = DashboardAlert;

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "number" && Number.isFinite(item)) return item;
      if (typeof item === "string" && item.trim() && !Number.isNaN(Number(item))) return Number(item);
      return null;
    })
    .filter((item): item is number => item !== null);
}

function buildMockDashboard(dateIso: string): OperatorDashboard {
  const daySeed = Number(dateIso.replace(/-/g, "").slice(-2)) || 1;
  const expected = 100 + daySeed;
  const arrived = Math.max(0, expected - 34);
  const noShow = 5 + (daySeed % 3);
  const invalid = 3 + (daySeed % 4);
  const rejected = 1 + (daySeed % 2);

  return {
    status: "on_track",
    arrivalsExpected: expected,
    arrivalsArrived: arrived,
    arrivalsNoShow: noShow,
    pendingCheckins2h: 16 + (daySeed % 5),
    checkinsLast60m: 10 + (daySeed % 6),
    validationSuccessRate: 93.8,
    invalidScans: invalid,
    rejectedScans: rejected,
    topProductName: "Lift Pass Day Ticket",
    topProductCount: 48 + (daySeed % 7),
    openIncidents: 2 + (daySeed % 3),
    staffLoadHint: "Peak check-in traffic expected within 90 minutes.",
    checkinsByHour: [6, 7, 8, 11, 10, 14, 16, 15, 12, 11, 9, 8],
    invalidScansByHour: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    noShowByHour: [0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 1, 1],
    alerts: [
      {
        id: "mock-1",
        severity: "warning",
        title: "Queue building at main gate",
        body: "Pending check-ins increased in the last 20 minutes.",
        event_time: new Date().toISOString(),
        action_label: "Open Arrivals",
        action_route: "/commerce/arrivals"
      },
      {
        id: "mock-2",
        severity: "critical",
        title: "Invalid scans spike",
        body: "Verify devices and ticket source for invalid code attempts.",
        event_time: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        action_label: "Scan Ticket",
        action_route: "/scan-ticket"
      }
    ],
    source: "mock"
  };
}

function mapDashboard(snapshot: SnapshotRow, alerts: DashboardAlert[], source: DashboardSource): OperatorDashboard {
  return {
    status: snapshot.status,
    arrivalsExpected: snapshot.arrivals_expected,
    arrivalsArrived: snapshot.arrivals_arrived,
    arrivalsNoShow: snapshot.arrivals_no_show,
    pendingCheckins2h: snapshot.pending_checkins_2h,
    checkinsLast60m: snapshot.checkins_last_60m,
    validationSuccessRate: snapshot.validation_success_rate,
    invalidScans: snapshot.invalid_scans,
    rejectedScans: snapshot.rejected_scans,
    topProductName: snapshot.top_product_name ?? "Top product",
    topProductCount: snapshot.top_product_count,
    openIncidents: snapshot.open_incidents,
    staffLoadHint: snapshot.staff_load_hint ?? "Monitor arrivals and scanner health.",
    checkinsByHour: toNumberArray(snapshot.checkins_by_hour),
    invalidScansByHour: toNumberArray(snapshot.invalid_scans_by_hour),
    noShowByHour: toNumberArray(snapshot.no_show_by_hour),
    alerts,
    source
  };
}

export async function getOperatorDashboard(params: {
  companyId: string;
  dateIso: string;
  source?: DashboardSource;
}): Promise<OperatorDashboard> {
  const source = params.source ?? "supabase";

  if (source === "mock") {
    return buildMockDashboard(params.dateIso);
  }

  if (source === "api") {
    // Placeholder for future API adapter.
    // Keep app resilient by returning Supabase mock data shape for now.
    return buildMockDashboard(params.dateIso);
  }

  const [snapshotResult, alertsResult] = await Promise.all([
    supabase
      .from("operator_dashboard_snapshots")
      .select(
        "status,arrivals_expected,arrivals_arrived,arrivals_no_show,pending_checkins_2h,checkins_last_60m,validation_success_rate,invalid_scans,rejected_scans,top_product_name,top_product_count,open_incidents,staff_load_hint,checkins_by_hour,invalid_scans_by_hour,no_show_by_hour"
      )
      .eq("company_id", params.companyId)
      .eq("snapshot_date", params.dateIso)
      .maybeSingle(),
    supabase
      .from("operator_dashboard_alerts")
      .select("id,severity,title,body,event_time,action_label,action_route")
      .eq("company_id", params.companyId)
      .eq("snapshot_date", params.dateIso)
      .order("event_time", { ascending: false })
      .limit(8)
  ]);

  if (snapshotResult.error) throw snapshotResult.error;
  if (alertsResult.error) throw alertsResult.error;

  if (!snapshotResult.data) {
    return buildMockDashboard(params.dateIso);
  }

  return mapDashboard(snapshotResult.data as SnapshotRow, (alertsResult.data ?? []) as AlertRow[], "supabase");
}
