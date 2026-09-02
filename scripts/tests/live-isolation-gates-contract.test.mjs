import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { requireDisposableLocalEnvironment } from '../live-isolation/gates-1-3.mjs'

const root = process.cwd()
const gatesPath = path.join(root, 'scripts/live-isolation/gates-1-3.mjs')
const runnerPath = path.join(root, 'scripts/migration-replay/run-baseline-replay.sh')
const workflowPath = path.join(root, '.github/workflows/ci.yml')
const gates = fs.readFileSync(gatesPath, 'utf8')
const runner = fs.readFileSync(runnerPath, 'utf8')
const workflow = fs.readFileSync(workflowPath, 'utf8')

assert.throws(() => requireDisposableLocalEnvironment({}), /NOVEN_EPHEMERAL_REPLAY=1/)
assert.throws(
  () =>
    requireDisposableLocalEnvironment({
      NOVEN_EPHEMERAL_REPLAY: '1',
      SUPABASE_URL: 'https://meqvjabgyrgwkxpclqxp.supabase.co',
      SUPABASE_ANON_KEY: 'anon-test',
      SUPABASE_SERVICE_ROLE_KEY: 'service-test',
    }),
  /refusing live isolation against non-local Supabase host/,
)
assert.throws(
  () =>
    requireDisposableLocalEnvironment({
      NOVEN_EPHEMERAL_REPLAY: '1',
      SUPABASE_URL: 'https://127.0.0.1:54321',
      SUPABASE_ANON_KEY: 'anon-test',
      SUPABASE_SERVICE_ROLE_KEY: 'service-test',
    }),
  /must use http/,
)

assert.deepEqual(
  requireDisposableLocalEnvironment({
    NOVEN_EPHEMERAL_REPLAY: '1',
    SUPABASE_URL: 'http://127.0.0.1:54321/',
    SUPABASE_ANON_KEY: 'anon-test',
    SUPABASE_SERVICE_ROLE_KEY: 'service-test',
  }),
  {
    apiUrl: 'http://127.0.0.1:54321',
    anonKey: 'anon-test',
    serviceRoleKey: 'service-test',
  },
)

assert.match(gates, /\/auth\/v1\/admin\/users/)
assert.match(gates, /\/auth\/v1\/token\?grant_type=password/)
assert.match(gates, /payload\.role, 'authenticated'/)
assert.match(gates, /rest\/v1\/producto_sucursal/)
assert.match(gates, /rpc\/guardar_vencimiento_y_stock_scanner_v1/)
assert.match(gates, /Gate 1:/)
assert.match(gates, /Gate 2:/)
assert.match(gates, /Gate 3:/)
assert.doesNotMatch(gates, /user_metadata|app_metadata/)
assert.doesNotMatch(gates, /noven-ia\.netlify\.app|meqvjabgyrgwkxpclqxp/)

assert.match(runner, /NOVEN_REPLAY_KEEP_RUNNING/)
assert.match(runner, /requires an explicit NOVEN_REPLAY_WORKSPACE/)
assert.match(runner, /supabase start -x realtime,storage-api/)

assert.match(workflow, /run-baseline-replay\.sh/)
assert.match(workflow, /Live isolation Gates 1-3/)
assert.match(workflow, /scripts\/live-isolation\/gates-1-3\.mjs/)
assert.doesNotMatch(workflow, /legacy-bootstrap|reset-with-legacy-bootstrap/)

console.log('live isolation Gates 1-3 contract: OK')
