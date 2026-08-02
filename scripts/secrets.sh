#!/usr/bin/env bash
# Secret management via GitHub CLI — run in Git Bash
# Usage: ./scripts/secrets.sh backup|restore|github|list

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"
SECRETS_DIR="$ROOT/secrets"
LATEST="$SECRETS_DIR/latest.env.local"
REPO="kreationvibestudio/CCC"

cmd="${1:-help}"

backup() {
  [[ -f "$ENV_FILE" ]] || { echo "Missing .env.local"; exit 1; }
  mkdir -p "$SECRETS_DIR"
  ts="$(date -u +%Y-%m-%dT%H-%M-%S)"
  cp "$ENV_FILE" "$SECRETS_DIR/env-${ts}.local"
  cp "$ENV_FILE" "$LATEST"
  echo "✓ Backed up to secrets/latest.env.local"
}

restore() {
  if [[ -f "$LATEST" ]]; then
    cp "$LATEST" "$ENV_FILE"
    echo "✓ Restored secrets/latest.env.local → .env.local"
  else
    latest="$(ls -1 "$SECRETS_DIR"/env-*.local 2>/dev/null | sort -r | head -1 || true)"
    [[ -n "$latest" ]] || { echo "No backup found"; exit 1; }
    cp "$latest" "$ENV_FILE"
    echo "✓ Restored from $(basename "$latest")"
  fi
}

github_push() {
  command -v gh >/dev/null || { echo "Install GitHub CLI: https://cli.github.com/"; exit 1; }
  src="$ENV_FILE"
  [[ -f "$src" ]] || src="$LATEST"
  [[ -f "$src" ]] || { echo "No .env.local or backup"; exit 1; }

  echo "Pushing secrets to GitHub ($REPO)…"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="$(echo "$line" | xargs)"
    [[ -z "$line" || "$line" != *=* ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    val="${val#\"}"; val="${val%\"}"
    val="${val#\'}"; val="${val%\'}"
    [[ "$key" == "VERCEL_OIDC_TOKEN" ]] && continue
    [[ -z "$val" || "$val" == *your-* ]] && continue
    printf '%s' "$val" | gh secret set "$key" --repo "$REPO"
    echo "  ✓ $key"
  done < "$src"
  echo "Done → https://github.com/$REPO/settings/secrets/actions"
}

list_keys() {
  src="$ENV_FILE"
  [[ -f "$src" ]] || src="$LATEST"
  [[ -f "$src" ]] || { echo "No env file"; exit 1; }
  echo "Configured keys:"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^# ]] && continue
    [[ "$line" != *=* ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    [[ "$key" == "VERCEL_OIDC_TOKEN" ]] && continue
    if [[ -n "$val" && "$val" != *your-* ]]; then status=set; else status=empty; fi
    echo "  $key: $status"
  done < "$src"
}

case "$cmd" in
  backup)  backup ;;
  restore) restore ;;
  github)  github_push ;;
  list)    list_keys ;;
  *)
    cat <<EOF
Usage: ./scripts/secrets.sh <command>

  backup   Copy .env.local → secrets/ (gitignored)
  restore  Restore .env.local from backup
  github   Push secrets to GitHub Actions (gh secret set)
  list     Show keys without values

GitHub is the remote vault. Local secrets/ is gitignored — never committed.
EOF
    ;;
esac
