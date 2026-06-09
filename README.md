# Spotlio Control (Expo)

Operations + commerce companion app for Spotlio teams.

## Stack

- Expo + React Native + TypeScript (strict)
- expo-router
- StyleSheet-based UI
- Supabase (Auth, Postgres, Storage, Realtime)
- QR scan: expo-camera

## Project Structure

- `app/` Expo routes/screens
- `src/` app logic, services, auth, features
- `supabase/migrations/` schema + RLS
- `supabase/seed.sql` sample data
- `tests/` minimal tests for critical logic

## Environment Variables

Copy `.env.example` to `.env` and set:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_CHATBOT_API_BASE_URL` (default `https://spotlio-rest-api-production.up.railway.app`)
- `EXPO_PUBLIC_CHATBOT_API_PATH` (default `/api/chat`)
- `EXPO_PUBLIC_CHATBOT_RESORT_CODE` (default `villars`)
- `EXPO_PUBLIC_ORDERS_DIRECT_BASE_URL` (default `https://connect.spotlio.com`) direct orders endpoint host
- `EXPO_PUBLIC_ORDERS_API_CLIENT` (default `tlml`, used as fallback when no tenant mapping exists)
- `EXPO_PUBLIC_ORDERS_API_SORT` (default `completed_at_day:desc`)
- `EXPO_PUBLIC_ORDERS_API_MODE` (default `partial`)
- `EXPO_PUBLIC_ORDERS_API_STATUS` (default `completed,canceled`)
- `EXPO_PUBLIC_DASHBOARD_SOURCE` (`supabase` default; use `supabase`)
- `EXPO_PUBLIC_ENABLE_ADMIN_COMMERCE` (default `false`)
- `EXPO_PUBLIC_VALIDATION_COOLDOWN_MINUTES` (default `5`)

## Supabase Setup

1. Create a Supabase project.
2. Run migration:
   - Apply `supabase/migrations/0001_init.sql`.
   - Apply `supabase/migrations/0002_operator_dashboard.sql` (Operator dashboard KPI snapshots + alerts).
   - Apply `supabase/migrations/0004_tenant_client_mapping.sql` (profile tenant id + Connect client mapping).
3. (Optional) Seed demo data:
   - Replace `<ADMIN_USER_UUID>`, `<OPERATOR_USER_UUID>`, `<VIEWER_USER_UUID>` in `supabase/seed.sql`.
   - Run the seed SQL.
   - Seed includes dashboard mock KPIs/alerts for Home.

### Roles and Access

- `viewer`: read-only
- `operator`: commerce access
- `admin`: commerce access controlled by app feature flag (`EXPO_PUBLIC_ENABLE_ADMIN_COMMERCE`) and DB feature flag (below)

Enable admin commerce server-side (optional):

```sql
alter role authenticator set app.settings.admin_commerce_enabled = 'true';
```

RLS is enforced in Postgres for all core/commerce tables.

### Tenant Mapping (Connect client id)

- `profiles.tenant_id` identifies the tenant for each user.
- `tenant_client_mappings` maps `tenant_id -> connect_client_id` (the `client` query value for Connect APIs).
- App reads `connect_client_id` from this table and falls back to `EXPO_PUBLIC_ORDERS_API_CLIENT` when missing.

## Run Locally

0. Use a compatible Node version (recommended: Node 20 LTS).
   - Expo SDK 54 in this project can fail on Node 22 with startup port errors.
   - Example with nvm: `nvm use 20`

1. Install dependencies:

```bash
npm install
```

2. Start Expo:

```bash
npm run start
```

3. Run on devices:

```bash
npm run ios
npm run android
```

## Scripts

- `npm run lint`
- `npm run typecheck`
- `npm test`

## Notes

- QR validation has app-side cooldown plus server-side/recent-validation check via `validations` table query.
