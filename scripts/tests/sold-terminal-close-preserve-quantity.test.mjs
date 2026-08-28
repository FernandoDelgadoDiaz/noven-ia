import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const migration = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20260828000140_sold_terminal_close_preserve_quantity_v1.sql'),
  'utf8',
)
const sql = migration.replace(/^\s*--.*$/gm, '')

assert.match(
  sql,
  /p_resultado = 'vendido'[\s\S]*?v_cantidad_accion := CEIL\(v_cantidad\)::integer/,
  'vendido debe registrar como acción el último saldo positivo del vencimiento',
)
assert.match(
  sql,
  /cantidad_comprometida, nota[\s\S]*?v_uid, 0, 'Cierre: vendido antes del vencimiento'/,
  'vendido debe registrar una observación final con saldo 0',
)
assert.doesNotMatch(
  sql,
  /SET\s+cantidad\s*=\s*(?:CASE[\s\S]*?THEN\s+0|0)/i,
  'el cierre no debe escribir 0 en vencimientos.cantidad',
)
assert.match(
  sql,
  /UPDATE public\.vencimientos[\s\S]*?SET activo = false/,
  'el vencimiento debe salir de activos al cerrar',
)
assert.match(
  sql,
  /noven_private\.puede_ver_producto_sucursal\(v_sucursal, v_producto\)/,
  'el hotfix debe conservar autorización por scope',
)
assert.match(
  sql,
  /a\.tipo IN \('vendido', 'donacion', 'decomiso'\)/,
  'el hotfix debe conservar protección contra doble cierre',
)
assert.match(
  sql,
  /America\/Argentina\/Buenos_Aires/,
  'el hotfix debe conservar fecha operacional Argentina',
)

console.log('✓ Vendido preserva cantidad histórica positiva, observa saldo 0 y cierra activo=false')
