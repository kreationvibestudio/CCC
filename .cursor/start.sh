#!/usr/bin/env bash
# Cloud Agent start step for Campaign Command Center (runs on every boot).
#
# Reconciles per-boot runtime state and then returns:
#   1. start the Docker daemon (nested-VM friendly)
#   2. fix bridge forwarding so containers can reach each other
#   3. bring up the local Supabase stack
#   4. bootstrap the database (schema, grants, demo admin)
#
# The Next.js dev server is intentionally NOT started here — it runs as the
# `next-dev` terminal (see .cursor/environment.json) so its logs stay visible.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SUPABASE_CLI="supabase@2.111.0"

echo "==> [start] Ensuring the Docker daemon is running"
if ! sudo docker info >/dev/null 2>&1; then
  # No systemd in the Cloud Agent VM, so launch dockerd directly. fuse-overlayfs
  # is required because overlay2 is unavailable inside the nested container.
  sudo bash -c 'nohup dockerd --storage-driver=fuse-overlayfs >/var/log/dockerd.log 2>&1 &'
  for _ in $(seq 1 60); do
    sudo docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi
sudo docker info >/dev/null 2>&1 || { echo "dockerd failed to start; see /var/log/dockerd.log"; exit 1; }

echo "==> [start] Allowing Docker bridge forwarding"
# The base VM ships a legacy iptables FORWARD chain whose policy is DROP, which
# silently blocks container-to-container traffic (Supabase services can't reach
# Postgres). Set it to ACCEPT; Docker's own nftables rules still apply.
sudo iptables-legacy -P FORWARD ACCEPT 2>/dev/null \
  || sudo iptables -P FORWARD ACCEPT 2>/dev/null || true

echo "==> [start] Making the Docker socket usable without sudo"
sudo chmod 666 /var/run/docker.sock 2>/dev/null || true

echo "==> [start] Starting local Supabase"
npx --yes "$SUPABASE_CLI" start

echo "==> [start] Bootstrapping the database"
bash "$REPO_ROOT/.cursor/dev-bootstrap.sh"

echo "==> [start] Ready. Next.js runs in the 'next-dev' terminal."
