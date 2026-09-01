import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const migrationPath = path.join(
  root,
  'supabase/migrations/20260901103500_desafio5s_cold_archive_v1.sql',
)
const docPath = path.join(root, 'docs/DESAFIO5S_COLD_ARCHIVE.md')

assert.ok(fs.existsSync(migrationPath), 'Falta la migración de archivo frío 5S')
assert.ok(fs.existsSync(docPath), 'Falta la documentación de restauración 5S')

const sql = fs.readFileSync(migrationPath, 'utf8')
const doc = fs.readFileSync(docPath, 'utf8')

for (const keyword of ['drop', 'delete', 'truncate']) {
  assert.ok(
    !new RegExp(`\\b${keyword}\\b`, 'i').test(sql),
    `La migración no puede usar ${keyword.toUpperCase()}`,
  )
}

assert.match(sql, /create schema if not exists desafio5s_archive/i)
assert.match(sql, /revoke all on schema desafio5s_archive from public, anon, authenticated, service_role/i)
assert.match(sql, /alter view public\.%I set schema desafio5s_archive/i)
assert.match(sql, /alter function public\.%I\(%s\) set schema desafio5s_archive/i)
assert.match(sql, /alter table public\.%I set schema desafio5s_archive/i)
assert.match(sql, /set public = false[\s\S]*where id = 'desafio5s-imagenes'/i)

for (const policy of [
  'desafio5s_public_read',
  'desafio5s_admin_upload',
  'desafio5s_admin_update',
]) {
  assert.match(sql, new RegExp(`alter policy ${policy} on storage\\.objects to service_role`, 'i'))
}

const expectedTables = [
  'desafio5s_admins',
  'desafio5s_asset_chunks',
  'desafio5s_evaluacion_preguntas',
  'desafio5s_evaluaciones',
  'desafio5s_participantes',
  'desafio5s_preguntas',
  'desafio5s_respuestas',
]

const expectedFunctions = [
  'desafio5s_acceso_ranking',
  'desafio5s_admin_dashboard',
  'desafio5s_admin_habilitar_reevaluacion',
  'desafio5s_admin_iniciar_prueba',
  'desafio5s_admin_pendientes',
  'desafio5s_admin_persona_detalle',
  'desafio5s_admin_set_imagen',
  'desafio5s_admin_visuales',
  'desafio5s_asignar_preguntas',
  'desafio5s_asset',
  'desafio5s_es_admin',
  'desafio5s_iniciar',
  'desafio5s_pregunta',
  'desafio5s_ranking',
  'desafio5s_responder',
  'desafio5s_responder_v2',
  'desafio5s_resultado',
  'desafio5s_revision',
]

for (const name of [...expectedTables, ...expectedFunctions]) {
  assert.ok(sql.includes(`'${name}'`), `El inventario no incluye ${name}`)
}

assert.match(sql, /v_archive_tables <> 7/i)
assert.match(sql, /v_archive_views <> 2/i)
assert.match(sql, /v_archive_functions <> 18/i)
assert.match(sql, /storage:desafio5s-imagenes/i)
assert.match(sql, /cambió el conteo/i)

assert.match(doc, /44 evaluaciones/i)
assert.match(doc, /399 respuestas/i)
assert.match(doc, /660 asignaciones/i)
assert.match(doc, /65 preguntas/i)
assert.match(doc, /35 archivos/i)
assert.match(doc, /public\.rol_actual\(\)/i)
assert.match(doc, /restauración en el mismo proyecto/i)
assert.match(doc, /proyecto Supabase independiente/i)
assert.match(doc, /no se versionan datos personales/i)

console.log('Contrato de archivo frío Desafío 5S: OK')
