-- Spotlio Pocket initial schema + RLS

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'operator', 'viewer');
create type public.ticket_direction as enum ('customer', 'spotlio');
create type public.ticket_message_type as enum ('text', 'audio');
create type public.purchase_status as enum ('valid', 'refunded', 'void');
create type public.arrival_status as enum ('expected', 'arrived', 'no_show');

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  role public.app_role not null default 'viewer',
  first_name text not null,
  last_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id text primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  subject text not null,
  status text not null,
  priority text,
  assignee_user_id uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null references public.tickets(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  direction public.ticket_direction not null,
  type public.ticket_message_type not null,
  body_text text,
  audio_storage_path text,
  audio_duration_ms integer,
  constraint message_body_chk check (
    (type = 'text' and body_text is not null and audio_storage_path is null)
    or
    (type = 'audio' and audio_storage_path is not null)
  )
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  ticket_id text references public.tickets(id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  external_ref text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  sku text,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  status public.purchase_status not null,
  purchased_at timestamptz not null,
  external_ref text
);

create table if not exists public.purchase_tokens (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.validations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  validated_by uuid not null references public.profiles(id) on delete restrict,
  validated_at timestamptz not null default now(),
  location text,
  device_id text
);

create table if not exists public.arrivals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  date date not null,
  customer_id uuid not null references public.customers(id) on delete cascade,
  purchase_id uuid references public.purchases(id) on delete set null,
  status public.arrival_status not null default 'expected',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists arrivals_company_date_idx on public.arrivals (company_id, date);
create index if not exists ticket_messages_ticket_created_idx on public.ticket_messages (ticket_id, created_at);
create index if not exists notifications_company_user_created_idx on public.notifications (company_id, user_id, created_at desc);
create index if not exists purchase_tokens_company_token_idx on public.purchase_tokens (company_id, token);
create index if not exists validations_company_purchase_validated_idx on public.validations (company_id, purchase_id, validated_at desc);
create index if not exists customers_company_search_idx on public.customers (company_id, last_name, first_name);

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p.*
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.is_company_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.is_company_operator()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'operator'
  );
$$;

create or replace function public.can_reply_tickets()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator')
  );
$$;

create or replace function public.can_access_commerce()
returns boolean
language sql
stable
as $$
  -- Default Operator-only. Enable Admin access by setting:
  -- alter role authenticator set app.settings.admin_commerce_enabled = 'true';
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'operator'
        or (
          p.role = 'admin'
          and coalesce(current_setting('app.settings.admin_commerce_enabled', true), 'false') = 'true'
        )
      )
  );
$$;

alter table public.profiles enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_tokens enable row level security;
alter table public.validations enable row level security;
alter table public.arrivals enable row level security;

-- profiles
create policy profiles_select_own
on public.profiles for select
using (id = auth.uid());

create policy profiles_admin_select_company
on public.profiles for select
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'admin'
      and me.company_id = profiles.company_id
  )
);

create policy profiles_operator_select_company
on public.profiles for select
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'operator'
      and me.company_id = profiles.company_id
  )
);

create policy profiles_update_own
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- tickets
create policy tickets_select_company
on public.tickets for select
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = tickets.company_id
  )
);

-- ticket messages
create policy ticket_messages_select_company
on public.ticket_messages for select
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = ticket_messages.company_id
  )
);

create policy ticket_messages_insert_non_viewer
on public.ticket_messages for insert
with check (
  public.can_reply_tickets()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = ticket_messages.company_id
  )
);

-- notifications
create policy notifications_select_company_or_personal
on public.notifications for select
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.company_id = notifications.company_id
      and (notifications.user_id is null or notifications.user_id = auth.uid())
  )
);

create policy notifications_update_read_own
on public.notifications for update
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.company_id = notifications.company_id
      and (notifications.user_id is null or notifications.user_id = auth.uid())
  )
)
with check (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.company_id = notifications.company_id
      and (notifications.user_id is null or notifications.user_id = auth.uid())
  )
);

-- commerce tables
create policy customers_select_commerce
on public.customers for select
using (
  public.can_access_commerce()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = customers.company_id
  )
);

create policy customers_mutate_commerce
on public.customers for all
using (
  public.can_access_commerce()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = customers.company_id
  )
)
with check (
  public.can_access_commerce()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = customers.company_id
  )
);

create policy products_select_commerce
on public.products for select
using (
  public.can_access_commerce()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = products.company_id
  )
);

create policy products_mutate_commerce
on public.products for all
using (
  public.can_access_commerce()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = products.company_id
  )
)
with check (
  public.can_access_commerce()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = products.company_id
  )
);

create policy purchases_select_commerce
on public.purchases for select
using (
  public.can_access_commerce()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = purchases.company_id
  )
);

create policy purchases_mutate_commerce
on public.purchases for all
using (
  public.can_access_commerce()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = purchases.company_id
  )
)
with check (
  public.can_access_commerce()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = purchases.company_id
  )
);

create policy purchase_tokens_select_commerce
on public.purchase_tokens for select
using (
  public.can_access_commerce()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = purchase_tokens.company_id
  )
);

create policy purchase_tokens_mutate_commerce
on public.purchase_tokens for all
using (
  public.can_access_commerce()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = purchase_tokens.company_id
  )
)
with check (
  public.can_access_commerce()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = purchase_tokens.company_id
  )
);

create policy validations_select_commerce
on public.validations for select
using (
  public.can_access_commerce()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = validations.company_id
  )
);

create policy validations_insert_commerce
on public.validations for insert
with check (
  public.can_access_commerce()
  and validated_by = auth.uid()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = validations.company_id
  )
);

create policy arrivals_select_commerce
on public.arrivals for select
using (
  public.can_access_commerce()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = arrivals.company_id
  )
);

create policy arrivals_mutate_commerce
on public.arrivals for all
using (
  public.can_access_commerce()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = arrivals.company_id
  )
)
with check (
  public.can_access_commerce()
  and exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.company_id = arrivals.company_id
  )
);

-- Storage bucket policy (ticket audio)
insert into storage.buckets (id, name, public)
values ('ticket-audio', 'ticket-audio', true)
on conflict (id) do nothing;

create policy "ticket audio read company"
on storage.objects for select
using (
  bucket_id = 'ticket-audio'
);

create policy "ticket audio upload non viewer"
on storage.objects for insert
with check (
  bucket_id = 'ticket-audio'
  and public.can_reply_tickets()
);
