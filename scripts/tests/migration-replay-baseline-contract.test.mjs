import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const manifestPath = path.join(root, 'scripts/migration-replay/history-manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

assert.equal(manifest.version, 1)
assert.equal(manifest.policy.historical_chain_is_universal_installer, false)
assert.equal(
  manifest.policy.new_environment_strategy,
  'verified_schema_baseline_then_forward_migrations',
)
assert.equal(manifest.policy.production_ledger_action, 'none')
assert.equal(manifest.policy.edit_applied_migrations, false)
assert.equal(manifest.policy.fabricate_production_business_data_for_replay, false)
assert.equal(manifest.policy.baseline_artifact_status, 'required_not_generated')
assert.equal(manifest.policy.baseline_scope, 'noven_core_schema_only')
assert.ok(manifest.policy.excluded_state.includes('auth_users'))
assert.ok(manifest.policy.excluded_state.includes('business_rows'))
assert.ok(manifest.policy.excluded_state.includes('storage_objects'))

const byId = new Map(manifest.known_non_universal_history.map((entry) => [entry.id, entry]))
const requiredIds = [
  'legacy_handle_updated_at',
  'admin_091_bootstrap',
  'remove_unapproved_admin_bootstrap',
  'explicit_admin_091_identity',
  'bonobon_3449476_repair',
]

assert.deepEqual([...byId.keys()].sort(), [...requiredIds].sort())

for (const entry of manifest.known_non_universal_history) {
  assert.equal(entry.universal_replay, false, `${entry.id} no puede marcarse replay universal`)
  assert.ok(entry.reason, `${entry.id} debe explicar por qué es histórico`)
  assert.ok(entry.resolution, `${entry.id} debe declarar resolución`)

  if (entry.repository_path) {
    const fullPath = path.join(root, entry.repository_path)
    assert.equal(fs.existsSync(fullPath), true, `Falta ${entry.repository_path}`)
    const sql = fs.readFileSync(fullPath, 'utf8')
    for (const marker of entry.evidence_markers) {
      assert.ok(sql.includes(marker), `${entry.id}: no se encontró evidencia ${marker}`)
    }
  }
}

const ledgerOnly = byId.get('remove_unapproved_admin_bootstrap')
assert.equal(ledgerOnly.repository_path, null)
assert.equal(ledgerOnly.production_ledger_version, '20260828011602')
assert.equal(
  ledgerOnly.production_ledger_name,
  'prod_20260828000021_remove_unapproved_admin_bootstrap_v1',
)

const admin091 = byId.get('admin_091_bootstrap')
assert.equal(admin091.resolution, 'baseline_required')
const explicit091 = byId.get('explicit_admin_091_identity')
assert.equal(explicit091.resolution, 'baseline_required')
const bonobon = byId.get('bonobon_3449476_repair')
assert.equal(bonobon.resolution, 'baseline_required')

const cleanExceptions = new Map(
  manifest.known_clean_replay_exceptions.map((entry) => [entry.id, entry]),
)
const archive5s = cleanExceptions.get('desafio5s_cold_archive')
assert.ok(archive5s)
assert.equal(archive5s.classification, 'state_aware_but_clean_noop')
const archiveSql = fs.readFileSync(path.join(root, archive5s.repository_path), 'utf8')
for (const marker of archive5s.evidence_markers) {
  assert.ok(archiveSql.includes(marker), `5S archive: no se encontró evidencia ${marker}`)
}

// 1.4A sigue siendo una excepción explícita de compatibilidad local, no una
// autorización para seguir fabricando estado productivo en el replay.
const legacyBootstrap = fs.readFileSync(
  path.join(root, 'scripts/migration-replay/legacy-bootstrap.mjs'),
  'utf8',
)
assert.ok(legacyBootstrap.includes("NOVEN_EPHEMERAL_REPLAY !== '1'"))
assert.ok(legacyBootstrap.includes('LOCAL / CI ONLY'))

console.log('migration replay baseline contract: OK')
