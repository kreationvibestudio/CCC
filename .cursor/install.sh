#!/usr/bin/env bash
# Cloud Agent install step for Campaign Command Center.
#
# Runs once (after checkout) to prepare durable, source-derived state:
#   - Docker Engine (required to run the local Supabase stack)
#   - Node dependencies
#   - a pre-fetched Supabase CLI
#   - a .env.local pointing at the local Supabase instance
#
# It is idempotent: re-running it converges without side effects. Per-boot
# work (starting the Docker daemon and Supabase, seeding the demo admin) lives
# in .cursor/start.sh instead.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SUPABASE_CLI="supabase@2.111.0"

echo "==> [install] Ensuring Docker Engine is installed"
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
  fi
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    docker-ce docker-ce-cli containerd.io docker-compose-plugin fuse-overlayfs
else
  echo "    Docker already installed: $(docker --version)"
fi

echo "==> [install] Installing Node dependencies"
npm install

echo "==> [install] Pre-fetching the Supabase CLI"
npx --yes "$SUPABASE_CLI" --version >/dev/null 2>&1 || true

echo "==> [install] Writing .env.local (fixed local Supabase dev keys)"
if [ ! -f .env.local ]; then
  cat > .env.local <<'EOF'
# Local Supabase (npx supabase start). These are the fixed, well-known demo
# keys the Supabase CLI generates for every local instance — they are NOT
# secrets and are safe for local development only.
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Facebook / Meta (optional — Social Media sync). Leave blank for local dev.
FACEBOOK_PAGE_ID=
FACEBOOK_USER_ACCESS_TOKEN=
FACEBOOK_PAGE_ACCESS_TOKEN=

# Termii SMS (optional)
TERMII_API_KEY=
TERMII_SENDER_ID=
EOF
else
  echo "    .env.local already exists — leaving it untouched"
fi

echo "==> [install] Done"
