#!/bin/bash
# Wrapper for launchd: runs publish.ts with Railway env vars injected
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
REPO="$(cd "$(dirname "$0")/.." && pwd)"   # this Mac's checkout, whatever the login name

cd "$REPO"
mkdir -p logs
railway run -- npx tsx scripts/publish.ts "$@" \
  >> "$REPO"/logs/publish.log 2>&1
