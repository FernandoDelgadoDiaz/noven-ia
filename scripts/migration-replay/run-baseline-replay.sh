#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
workspace="${NOVEN_REPLAY_WORKSPACE:-$(mktemp -d -t noven-baseline-replay.XXXXXX)}"
diff_output="${NOVEN_REPLAY_DIFF_OUTPUT:-${repo_root}/structural-diff.json}"
created_workspace=0

if [[ -z "${NOVEN_REPLAY_WORKSPACE:-}" ]]; then
  created_workspace=1
fi

cleanup() {
  if [[ -d "${workspace}/supabase" ]]; then
    (
      cd "${workspace}"
      supabase stop --no-backup
    ) >/dev/null 2>&1 || true
  fi

  if [[ "${created_workspace}" -eq 1 ]]; then
    case "${workspace}" in
      /tmp/noven-baseline-replay.*)
        rm -rf -- "${workspace}"
        ;;
      *)
        echo "Refusing to remove unexpected replay workspace: ${workspace}" >&2
        ;;
    esac
  fi
}
trap cleanup EXIT

export NOVEN_EPHEMERAL_REPLAY=1
export SUPABASE_TELEMETRY_DISABLED=true

mkdir -p "${workspace}"
(
  cd "${workspace}"
  supabase init --force

  if ! grep -Eq '^major_version = 17$' supabase/config.toml; then
    echo "Baseline replay requires PostgreSQL 17 to match production." >&2
    exit 1
  fi
)

node "${repo_root}/scripts/migration-replay/baseline-workspace.mjs" \
  --workspace "${workspace}"

(
  cd "${workspace}"
  supabase start -x gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
  supabase status -o env > "${workspace}/supabase-local.env"
)

set -a
source "${workspace}/supabase-local.env"
set +a

export NOVEN_REPLAY_DB_URL="${DB_URL}"
node "${repo_root}/scripts/migration-replay/verify-structural-fingerprint.mjs" \
  --diff-output "${diff_output}"
