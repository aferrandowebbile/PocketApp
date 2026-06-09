-- Tenant mapping for external Connect API client id.

alter table public.profiles
add column if not exists tenant_id uuid references public.companies(id) on delete restrict;

update public.profiles
set tenant_id = company_id
where tenant_id is null;

alter table public.profiles
alter column tenant_id set not null;

create index if not exists profiles_tenant_id_idx on public.profiles (tenant_id);

create table if not exists public.tenant_client_mappings (
  tenant_id uuid primary key references public.companies(id) on delete cascade,
  connect_client_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_client_mappings_connect_client_idx
  on public.tenant_client_mappings (connect_client_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tenant_client_mappings_touch_updated_at on public.tenant_client_mappings;
create trigger trg_tenant_client_mappings_touch_updated_at
before update on public.tenant_client_mappings
for each row
execute function public.touch_updated_at();

alter table public.tenant_client_mappings enable row level security;

drop policy if exists tenant_client_mappings_select_tenant on public.tenant_client_mappings;
create policy tenant_client_mappings_select_tenant
on public.tenant_client_mappings for select
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.tenant_id = tenant_client_mappings.tenant_id
  )
);

drop policy if exists tenant_client_mappings_admin_write on public.tenant_client_mappings;
create policy tenant_client_mappings_admin_write
on public.tenant_client_mappings for all
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'admin'
      and me.tenant_id = tenant_client_mappings.tenant_id
  )
)
with check (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'admin'
      and me.tenant_id = tenant_client_mappings.tenant_id
  )
);

