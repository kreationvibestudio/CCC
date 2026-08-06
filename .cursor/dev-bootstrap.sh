#!/usr/bin/env bash
# Idempotent database bootstrap for the local Supabase instance.
#
# Ensures a fresh local database is fully usable by the app:
#   - migrations + seed are applied (via `supabase db reset` when the schema is
#     missing — e.g. on a brand new Postgres volume);
#   - the local privilege grants that Supabase Cloud provides implicitly are
#     applied (see supabase/local-grants.sql);
#   - the demo admin user exists and has a super_administrator profile.
#
# Safe to run repeatedly; every step is a no-op once satisfied.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SUPABASE_CLI="supabase@2.111.0"
DB_CONTAINER="supabase_db_campaign-command-center"
API_URL="http://127.0.0.1:54321"
ADMIN_EMAIL="admin@demo.campaign.ng"
ADMIN_PASSWORD="DemoPassword123!"
# Fixed, well-known local Supabase service_role key (not a secret).
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

psql_db() { docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres "$@"; }

echo "    Waiting for the database to accept connections"
for _ in $(seq 1 60); do
  docker exec "$DB_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

if ! psql_db -tAc "select to_regclass('public.tenants');" | grep -q tenants; then
  echo "    Schema missing — applying migrations + seed via db reset"
  npx --yes "$SUPABASE_CLI" db reset
fi

echo "    Applying local privilege grants"
psql_db < supabase/local-grants.sql >/dev/null

echo "    Ensuring demo admin user exists ($ADMIN_EMAIL)"
if [ "$(psql_db -tAc "select 1 from auth.users where email='${ADMIN_EMAIL}' limit 1;")" != "1" ]; then
  for _ in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/auth/v1/health") || true
    [ "$code" = "200" ] && break
    sleep 1
  done
  curl -s -X POST "$API_URL/auth/v1/admin/users" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"email_confirm\":true}" \
    >/dev/null
fi

echo "    Ensuring admin profile role"
psql_db < supabase/cloud-admin.sql >/dev/null

echo "    Database bootstrap complete"
