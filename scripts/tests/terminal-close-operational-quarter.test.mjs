import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const migration = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20260828000090_terminal_close_operational_quarter_v1.sql'),
  'utf8',
)
const sql = migration.replace(/^\s*--.*$/gm, '')

assert.doesNotMatch(
  sql,
  /CURRENT_DATE/i,
  'el cierre terminal no debe usar CURRENT_DATE de la sesión',
)
assert.match(
  sql,
  /America\/Argentina\/Buenos_Aires/,
  'el cierre terminal debe usar fecha operacional Argentina',
)
assert.match(
  sql,
  /v_anio := EXTRACT\(YEAR FROM v_fecha_operativa\)::integer/,
  'el año histórico debe derivarse de la fecha operacional',
)
assert.match(
  sql,
  /v_trimestre := EXTRACT\(QUARTER FROM v_fecha_operativa\)::integer/,
  'el trimestre histórico debe derivarse de la fecha operacional',
)
assert.match(
  sql,
  /p_resultado NOT IN \('vendido', 'donacion', 'decomiso'\)/,
  'se deben conservar sólo los tres resultados terminales válidos',
)
assert.match(
  sql,
  /noven_private\.puede_ver_producto_sucursal\(v_sucursal, v_producto\)/,
  'el hardening de fecha no puede debilitar el control de scope',
)
assert.match(
  sql,
  /a\.tipo IN \('vendido', 'donacion', 'decomiso'\)/,
  'se debe conservar la protección contra doble resultado terminal',
)

console.log('✓ Cierres terminales asignan año/trimestre con fecha operacional Argentina')
