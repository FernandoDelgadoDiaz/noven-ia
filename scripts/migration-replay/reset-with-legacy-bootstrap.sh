#!/usr/bin/env bash
set -euo pipefail

export NOVEN_EPHEMERAL_REPLAY=1

cleanup() {
  node scripts/migration-replay/legacy-bootstrap.mjs cleanup || true
}
trap cleanup EXIT

node scripts/migration-replay/legacy-bootstrap.mjs prepare
supabase db reset
