# Spotlio Pocket (Expo)

Customer-facing support + commerce companion app for Spotlio customers.

## Stack

- Expo + React Native + TypeScript (strict)
- expo-router
- StyleSheet-based UI
- Supabase (Auth, Postgres, Storage, Realtime)
- Voice notes: expo-audio + expo-file-system
- QR scan: expo-camera
- Zendesk integration via backend API (`/server` local mock)

## Project Structure

- `app/` Expo routes/screens
- `src/` app logic, services, auth, features
- `supabase/migrations/` schema + RLS
- `supabase/functions/zendesk/` Edge Function stub
- `supabase/seed.sql` sample data
- `server/` local mock Zendesk API
- `tests/` minimal tests for critical logic

## Environment Variables

Copy `.env.example` to `.env` and set:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_ZENDESK_API_BASE_URL` (default `http://localhost:8787`)
- `EXPO_PUBLIC_CHATBOT_API_BASE_URL` (default `https://spotlio-rest-api-production.up.railway.app`)
- `EXPO_PUBLIC_CHATBOT_API_PATH` (default `/api/chat`)
- `EXPO_PUBLIC_CHATBOT_RESORT_CODE` (default `villars`)
- `EXPO_PUBLIC_ORDERS_DIRECT_BASE_URL` (default `https://connect.spotlio.com`) direct orders endpoint host
- `EXPO_PUBLIC_ORDERS_API_CLIENT` (default `tlml`)
- `EXPO_PUBLIC_ORDERS_API_SORT` (default `completed_at_day:desc`)
- `EXPO_PUBLIC_ORDERS_API_MODE` (default `partial`)
- `EXPO_PUBLIC_ORDERS_API_STATUS` (default `completed,canceled`)
- `EXPO_PUBLIC_DASHBOARD_SOURCE` (`mock` default; options: `mock|supabase|api`)
- `EXPO_PUBLIC_ENABLE_ADMIN_COMMERCE` (default `false`)
- `EXPO_PUBLIC_VALIDATION_COOLDOWN_MINUTES` (default `5`)

Backend/ops vars:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ZENDESK_SUBDOMAIN`
- `ZENDESK_EMAIL`
- `ZENDESK_API_TOKEN`
- `PORT`
- `VALIDATION_COOLDOWN_MINUTES`
- `ORDERS_API_BASE_URL` (default `https://connect.spotlio.com`)
- `ORDERS_API_CLIENT` (default `tlml`)
- `ORDERS_API_SORT` (default `completed_at_day:desc`)
- `ORDERS_API_MODE` (default `partial`)
- `ORDERS_API_STATUS` (default `completed,canceled`)
- `ORDERS_PROXY_AUTH_HEADER` (optional, server-side `Authorization`)
- `ORDERS_PROXY_COOKIE` (optional, server-side session cookie)
- `ORDERS_PROXY_X_API_KEY` (optional)
- `ORDERS_PROXY_FORCE_MOCK` (`true` to return local sample orders)

## Supabase Setup

1. Create a Supabase project.
2. Run migration:
   - Apply `supabase/migrations/0001_init.sql`.
   - Apply `supabase/migrations/0002_operator_dashboard.sql` (Operator dashboard KPI snapshots + alerts).
3. Ensure storage bucket exists:
   - `ticket-audio` (migration inserts it automatically if missing).
4. (Optional) Seed demo data:
   - Replace `<ADMIN_USER_UUID>`, `<OPERATOR_USER_UUID>`, `<VIEWER_USER_UUID>` in `supabase/seed.sql`.
   - Run the seed SQL.
   - Seed includes dashboard mock KPIs/alerts for Home.

### Roles and Access

- `viewer`: read-only (no ticket replies/voice; no commerce)
- `operator`: support reply + commerce
- `admin`: support reply; commerce access controlled by app feature flag (`EXPO_PUBLIC_ENABLE_ADMIN_COMMERCE`) and DB feature flag (below)

Enable admin commerce server-side (optional):

```sql
alter role authenticator set app.settings.admin_commerce_enabled = 'true';
```

RLS is enforced in Postgres for all core/support/commerce tables.

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Start mock Zendesk backend:

```bash
npm run mock:server
```

If Orders shows `Network request failed` on a physical phone, keep `EXPO_PUBLIC_ORDERS_PROXY_BASE_URL=http://localhost:8787` and ensure phone + dev machine are on the same network; the app auto-resolves localhost to Expo host IP.

3. Start Expo:

```bash
npm run start
```

4. Run on devices:

```bash
npm run ios
npm run android
```

## Backend Integration

### Local Mock (`/server`)

Endpoints used by app:

- `GET /tickets?companyId=...&status=open|pending|solved`
- `GET /tickets/:id?companyId=...`
- `POST /tickets/:id/reply`

Mock data is in-memory and returns sanitized fields only.

### Supabase Edge Function Stub

- `supabase/functions/zendesk/index.ts`
- Placeholder to wire real Zendesk credentials from Supabase secrets.
- Keeps Zendesk secrets out of mobile app.

## Scripts

- `npm run lint`
- `npm run typecheck`
- `npm test`

## Notes

- Zendesk internal data is intentionally not exposed in app models.
- Agent names are not shown in UI; spotlio-side messages display `Spotlio Team`.
- QR validation has app-side cooldown plus server-side/recent-validation check via `validations` table query.
