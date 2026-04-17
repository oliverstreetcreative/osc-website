#!/bin/bash
# Wrapper for launchd: runs publish.ts with Railway env vars injected
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export HOME="/Users/sampatton"

cd /Users/sampatton/code/osc-website
railway run -- npx tsx scripts/publish.ts "$@" \
  >> /Users/sampatton/code/osc-website/logs/publish.log 2>&1
