import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  SHIM_RELATIVE_PATH,
  SHIM_SQL,
  cleanupLegacyReplayBootstrap,
  prepareLegacyReplayBootstrap,
} from '../migration-replay/legacy-bootstrap.mjs'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noven-replay-bootstrap-'))
const env = { NOVEN_EPHEMERAL_REPLAY: '1' }
const target = path.join(root, SHIM_RELATIVE_PATH)

try {
  assert.throws(
    () => prepareLegacyReplayBootstrap({ root, env: {} }),
    /Refusing legacy bootstrap outside an explicitly disposable replay/,
  )

  const prepared = prepareLegacyReplayBootstrap({ root, env })
  assert.equal(prepared, target)
  assert.equal(fs.readFileSync(target, 'utf8'), SHIM_SQL)

  assert.match(SHIM_RELATIVE_PATH, /20260827000285_local_replay_/)
  assert.match(SHIM_SQL, /CREATE OR REPLACE FUNCTION public\.handle_updated_at\(\)/)
  assert.match(SHIM_SQL, /CREATE TRIGGER productos_updated_at/)
  assert.match(SHIM_SQL, /EXECUTE FUNCTION public\.handle_updated_at\(\)/)
  assert.match(SHIM_SQL, /NEW\.updated_at = now\(\)/)

  // Idempotent only when the existing shim is byte-for-byte the expected local shim.
  assert.equal(prepareLegacyReplayBootstrap({ root, env }), target)

  assert.equal(cleanupLegacyReplayBootstrap({ root, env }), true)
  assert.equal(fs.existsSync(target), false)
  assert.equal(cleanupLegacyReplayBootstrap({ root, env }), false)

  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, '-- unexpected migration\n', 'utf8')

  assert.throws(
    () => prepareLegacyReplayBootstrap({ root, env }),
    /Refusing to overwrite unexpected migration shim/,
  )
  assert.throws(
    () => cleanupLegacyReplayBootstrap({ root, env }),
    /Refusing to delete unexpected migration file/,
  )

  console.log('migration replay legacy bootstrap: OK')
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}
