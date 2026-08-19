#!/usr/bin/env bash
# Idempotent database bootstrap for the local Supabase instance.
#
# Ensures a fresh local database is fully usable by the app:
#   - migrations + seed are applied (via `supabase db reset` when the schema is
#     missing — e.g. on a brand new Postgres volume);
#   - the local privilege grants that Supabase Cloud provides implicitly are
#     applied (see supabase/local-grants.sql).
#
# No demo users are created. The first account to register becomes super administrator.
# Safe to run repeatedly; every step is a no-op once satisfied.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SUPABASE_CLI="supabase@2.111.0"
DB_CONTAINER="supabase_db_campaign-command-center"

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

echo "    Database bootstrap complete (no sample users)"
