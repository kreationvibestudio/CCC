#!/usr/bin/env bash
# Verify / guide the Windows local copy at D:\CCC (Git Bash: /d/CCC).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

norm="$(pwd -W 2>/dev/null || pwd)"
echo "Project root: $ROOT"
echo "Windows path: $norm"

case "$norm" in
  D:/CCC|D:\\CCC|/d/CCC|d:/CCC)
    echo "✓ Local copy path matches D:\\CCC"
    ;;
  *)
    echo "⚠ Expected local copy at D:\\CCC (Git Bash: cd /d/CCC)"
    echo "  You are currently in: $norm"
    echo "  Continue only if this is intentional."
    ;;
esac

if [[ -f .env.local ]]; then
  echo "✓ .env.local present"
else
  echo "✗ Missing .env.local — copy secrets or run: npx vercel env pull .env.local --yes"
fi

if [[ -f secrets/latest.env.local ]]; then
  echo "✓ secrets/latest.env.local present"
else
  echo "· No secrets/ backup yet (optional)"
fi

if [[ -d node_modules ]]; then
  echo "✓ node_modules present"
else
  echo "· Run: npm ci"
fi

echo
echo "Next:"
echo "  npm run secrets:list"
echo "  npm run dev"
echo "Docs: docs/LOCAL-WINDOWS.md"
