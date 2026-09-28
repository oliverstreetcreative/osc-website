#!/bin/bash
# Wrapper for launchd: runs publish.ts with Railway env vars injected
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
REPO="$(cd "$(dirname "$0")/.." && pwd)"   # this Mac's checkout, whatever the login name

cd "$REPO"
# bible.db lives in Dropbox; the script's built-in default is the Mini's RAID mount.
ADMIN="$HOME/Dropbox (Personal)/OLIVER STREET CREATIVE/_admin"
export BIBLE_PATH="${BIBLE_PATH:-$ADMIN/bible.db}"
export PUBLISH_STATE_PATH="${PUBLISH_STATE_PATH:-$ADMIN/.publish-state.json}"
mkdir -p logs
railway run -- npx tsx scripts/publish.ts "$@" \
  >> "$REPO"/logs/publish.log 2>&1
