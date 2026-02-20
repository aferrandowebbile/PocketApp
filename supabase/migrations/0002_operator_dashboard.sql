-- Operator dashboard mock data model (Supabase-backed)

create table if not exists public.operator_dashboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  snapshot_date date not null,
  status text not null default 'on_track' check (status in ('on_track', 'at_risk')),
  arrivals_expected integer not null default 0,
  arrivals_arrived integer not null default 0,
  arrivals_no_show integer not null default 0,
  pending_checkins_2h integer not null default 0,
  checkins_last_60m integer not null default 0,
  validation_success_rate numeric(5, 2) not null default 0,
  invalid_scans integer not null default 0,
  rejected_scans integer not null default 0,
  top_product_name text,
  top_product_count integer not null default 0,
  open_incidents integer not null default 0,
  staff_load_hint text,
  checkins_by_hour jsonb not null default '[]'::jsonb,
  invalid_scans_by_hour jsonb not null default '[]'::jsonb,
  no_show_by_hour jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (company_id, snapshot_date)
);

create table if not exists public.operator_dashboard_alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  snapshot_date date not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  body text not null,
  event_time timestamptz not null default now(),
  action_label text,
  action_route text,
  created_at timestamptz not null default now()
);

create index if not exists operator_dashboard_snapshots_company_date_idx
  on public.operator_dashboard_snapshots (company_id, snapshot_date desc);

create index if not exists operator_dashboard_alerts_company_date_idx
  on public.operator_dashboard_alerts (company_id, snapshot_date desc, event_time desc);

alter table public.operator_dashboard_snapshots enable row level security;
alter table public.operator_dashboard_alerts enable row level security;

create policy operator_dashboard_snapshots_select_company
on public.operator_dashboard_snapshots for select
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.company_id = operator_dashboard_snapshots.company_id
  )
);

create policy operator_dashboard_alerts_select_company
on public.operator_dashboard_alerts for select
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.company_id = operator_dashboard_alerts.company_id
  )
);
