-- Optional seed data for local development.
-- Create auth users first via Supabase Auth UI, then replace UUID placeholders.

insert into public.companies (id, name)
values ('11111111-1111-1111-1111-111111111111', 'Demo Spotlio Company')
on conflict do nothing;

insert into public.profiles (id, company_id, role, first_name, last_name, email)
values
  ('<ADMIN_USER_UUID>', '11111111-1111-1111-1111-111111111111', 'admin', 'Alice', 'Admin', 'admin@example.com'),
  ('<OPERATOR_USER_UUID>', '11111111-1111-1111-1111-111111111111', 'operator', 'Olivia', 'Operator', 'operator@example.com'),
  ('<VIEWER_USER_UUID>', '11111111-1111-1111-1111-111111111111', 'viewer', 'Victor', 'Viewer', 'viewer@example.com')
on conflict (id) do nothing;

insert into public.customers (id, company_id, first_name, last_name, email, phone, external_ref)
values
  ('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Nora', 'Guest', 'nora@example.com', '+15550101', 'CUS-1001'),
  ('22222222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Liam', 'Visitor', 'liam@example.com', '+15550102', 'CUS-1002')
on conflict (id) do nothing;

insert into public.products (id, company_id, name, sku)
values
  ('31111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Lift Pass Day Ticket', 'LP-DAY-01'),
  ('32222222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Equipment Rental', 'RENT-STD')
on conflict (id) do nothing;

insert into public.purchases (id, company_id, customer_id, product_id, status, purchased_at, external_ref)
values
  ('41111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', '31111111-1111-1111-1111-111111111111', 'valid', now() - interval '2 hours', 'PUR-1001'),
  ('42222222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-1111-1111-1111-111111111111', '32222222-1111-1111-1111-111111111111', 'refunded', now() - interval '1 day', 'PUR-1002')
on conflict (id) do nothing;

insert into public.purchase_tokens (id, company_id, purchase_id, token, expires_at)
values
  ('51111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '41111111-1111-1111-1111-111111111111', 'tok_live_demo_001', now() + interval '7 days'),
  ('52222222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '42222222-1111-1111-1111-111111111111', 'tok_live_demo_002', now() + interval '7 days')
on conflict (token) do nothing;

insert into public.arrivals (id, company_id, date, customer_id, purchase_id, status, notes)
values
  ('61111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', current_date, '21111111-1111-1111-1111-111111111111', '41111111-1111-1111-1111-111111111111', 'expected', 'Morning session'),
  ('62222222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', current_date, '22222222-1111-1111-1111-111111111111', '42222222-1111-1111-1111-111111111111', 'expected', 'Afternoon arrival')
on conflict (id) do nothing;

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
