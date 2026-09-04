import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const migrationPath = path.join(
  root,
  'supabase/migrations/20260903103749_archive_august_backups_v1.sql',
)
const docPath = path.join(root, 'docs/NOVEN_AUGUST_BACKUPS_COLD_ARCHIVE.md')
const exclusionsPath = path.join(
  root,
  'scripts/migration-replay/baseline-v1/exclusions-manifest.json',
)

assert.ok(fs.existsSync(migrationPath), 'Falta la migración de archivo frío de respaldos')
assert.ok(fs.existsSync(docPath), 'Falta la documentación del archivo frío de respaldos')

const sql = fs.readFileSync(migrationPath, 'utf8')
const doc = fs.readFileSync(docPath, 'utf8')
const exclusions = JSON.parse(fs.readFileSync(exclusionsPath, 'utf8'))

for (const keyword of ['drop', 'delete', 'truncate']) {
  assert.doesNotMatch(
    sql,
    new RegExp(`\\b${keyword}\\b`, 'i'),
    `La migración no puede usar ${keyword.toUpperCase()}`,
  )
}

assert.match(sql, /set lock_timeout = '5s'/i)
assert.match(sql, /create schema if not exists noven_archive authorization postgres/i)
assert.match(sql, /revoke all on schema noven_archive from public, anon, authenticated, service_role/i)
assert.match(sql, /v_public is distinct from v_expected or cardinality\(v_archived\) <> 0/i)
assert.match(sql, /alter table public\.%I set schema noven_archive/i)
assert.match(sql, /revoke all privileges on table noven_archive\.%I from public, anon, authenticated, service_role/i)
assert.match(sql, /foreign keys; se aborta el archivo/i)
assert.match(sql, /vistas dependientes; se aborta el archivo/i)
assert.match(sql, /funciones dependientes; se aborta el archivo/i)
assert.match(sql, /publicaciones; se aborta el archivo/i)
assert.match(sql, /if cardinality\(v_public\) = 0 and cardinality\(v_archived\) = 0 then\s+return;/i,
  'el replay sin datos históricos debe ser un no-op seguro')
assert.match(sql, /cambió el conteo/i)
assert.match(sql, /and not c\.relrowsecurity/i)

const expectedTables = [
  'dedup_turrocklets_backup_20260805',
  'productos_descripcion_backup_20260805',
  'productos_familia_backup_20260806',
]

for (const table of expectedTables) {
  assert.ok(sql.includes(`'${table}'`), `La migración no inventaría ${table}`)
  assert.ok(doc.includes(`\`${table}\``), `La documentación no inventaría ${table}`)
}

assert.match(doc, /113 filas preservadas/i)
assert.match(doc, /19 \| 65\.536 bytes/i)
assert.match(doc, /6 \| 32\.768 bytes/i)
assert.match(doc, /88 \| 24\.576 bytes/i)
assert.match(doc, /cero foreign keys/i)
assert.match(doc, /cero vistas, funciones o triggers dependientes/i)
assert.match(doc, /transacción reversible/i)

const schemaExclusion = exclusions.excluded_from_core_fingerprint.find(
  (entry) => entry.kind === 'schema',
)
assert.ok(schemaExclusion.objects.includes('noven_archive'))

const relationExclusion = exclusions.excluded_from_core_fingerprint.find(
  (entry) => entry.kind === 'relations',
)
assert.deepEqual(
  relationExclusion.objects,
  expectedTables.map((table) => `noven_archive.${table}`),
)

console.log('✓ Respaldos de agosto se archivan sin pérdida, dependencias ni acceso de clientes')
