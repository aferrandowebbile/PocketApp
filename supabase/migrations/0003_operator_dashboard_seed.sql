-- Seed dashboard KPI snapshots + alerts (idempotent)

insert into public.operator_dashboard_snapshots (
  id,
  company_id,
  snapshot_date,
  status,
  arrivals_expected,
  arrivals_arrived,
  arrivals_no_show,
  pending_checkins_2h,
  checkins_last_60m,
  validation_success_rate,
  invalid_scans,
  rejected_scans,
  top_product_name,
  top_product_count,
  open_incidents,
  staff_load_hint,
  checkins_by_hour,
  invalid_scans_by_hour,
  no_show_by_hour
)
values
  (
    '71111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    current_date,
    'on_track',
    126,
    74,
    6,
    18,
    12,
    94.2,
    5,
    2,
    'Lift Pass Day Ticket',
    54,
    3,
    'High traffic expected in next 90 min.',
    '[6,8,9,11,10,12,15,14,12,9,8,7]'::jsonb,
    '[0,1,0,0,1,0,1,0,0,1,0,1]'::jsonb,
    '[0,0,1,0,0,1,0,0,1,0,1,2]'::jsonb
  )
on conflict (company_id, snapshot_date) do update
set
  status = excluded.status,
  arrivals_expected = excluded.arrivals_expected,
  arrivals_arrived = excluded.arrivals_arrived,
  arrivals_no_show = excluded.arrivals_no_show,
  pending_checkins_2h = excluded.pending_checkins_2h,
  checkins_last_60m = excluded.checkins_last_60m,
  validation_success_rate = excluded.validation_success_rate,
  invalid_scans = excluded.invalid_scans,
  rejected_scans = excluded.rejected_scans,
  top_product_name = excluded.top_product_name,
  top_product_count = excluded.top_product_count,
  open_incidents = excluded.open_incidents,
  staff_load_hint = excluded.staff_load_hint,
  checkins_by_hour = excluded.checkins_by_hour,
  invalid_scans_by_hour = excluded.invalid_scans_by_hour,
  no_show_by_hour = excluded.no_show_by_hour,
  updated_at = now();

insert into public.operator_dashboard_alerts (
  id,
  company_id,
  snapshot_date,
  severity,
  title,
  body,
  event_time,
  action_label,
  action_route
)
values
  (
    '81111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    current_date,
    'warning',
    'Queue building at main gate',
    '14 pending check-ins detected in the last 20 minutes.',
    now() - interval '18 minutes',
    'Open Arrivals',
    '/commerce/arrivals'
  ),
  (
    '82222222-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    current_date,
    'critical',
    'Invalid scans spike',
    '5 invalid scans in the last hour. Verify scanner devices.',
    now() - interval '9 minutes',
    'Open Scan',
    '/scan-ticket'
  ),
  (
    '83333333-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    current_date,
    'info',
    'VIP arrival in 45 min',
    'Guest Nora Guest has a VIP package arriving soon.',
    now() - interval '4 minutes',
    'Search Guest',
    '/(tabs)/guests'
  )
on conflict (id) do nothing;
