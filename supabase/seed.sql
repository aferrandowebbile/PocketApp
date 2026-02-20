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
