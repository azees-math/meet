#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p \
  "$ROOT_DIR/.pnpm-store" \
  "$ROOT_DIR/.pnpm-cache" \
  "$ROOT_DIR/.pnpm-state" \
  "$ROOT_DIR/.pnpm-data" \
  "$ROOT_DIR/.pnpm-bin"

export XDG_CACHE_HOME="$ROOT_DIR/.pnpm-cache"
export XDG_STATE_HOME="$ROOT_DIR/.pnpm-state"
export XDG_DATA_HOME="$ROOT_DIR/.pnpm-data"
export npm_config_store_dir="$ROOT_DIR/.pnpm-store"
export PNPM_HOME="$ROOT_DIR/.pnpm-bin"

exec pnpm "$@"
