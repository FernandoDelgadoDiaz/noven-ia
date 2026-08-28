import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const migration = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20260828000080_risk_functions_operational_date_v1.sql'),
  'utf8',
)
const sql = migration.replace(/^\s*--.*$/gm, '')

assert.doesNotMatch(
  sql,
  /CURRENT_DATE/i,
  'ninguna función de riesgo debe depender de CURRENT_DATE de la sesión',
)
assert.match(
  sql,
  /America\/Argentina\/Buenos_Aires/g,
  'las funciones deben resolver la fecha operacional Argentina',
)
assert.match(
  sql,
  /IF v_dias_donacion IS NULL THEN RETURN NULL; END IF;/,
  'el riesgo zonal debe devolver NULL fuera del circuito, no seguro',
)
assert.doesNotMatch(
  sql,
  /IF v_dias_donacion IS NULL THEN RETURN 'seguro'; END IF;/,
  'no debe volver la inferencia NULL -> seguro',
)
assert.match(
  sql,
  /IF v_nivel IS NULL OR v_nivel = 'seguro' THEN RETURN NULL; END IF;/,
  'Radar Zonal no debe generar evento para fuera de circuito ni seguro',
)
assert.match(
  sql,
  /WHERE ve\.activo = true\s+AND s\.dias_donacion IS NOT NULL/,
  'el recalculador debe excluir vencimientos fuera del circuito',
)
assert.doesNotMatch(
  sql,
  /WHEN dias_donacion IS NULL THEN 'seguro'/,
  'el recalculador no debe etiquetar sectores sin política como seguros',
)
assert.match(
  sql,
  /GREATEST\(v_dias - v_dias_donacion, 0\)/,
  'el cálculo zonal debe conservar la ventana comercial autoritativa',
)
assert.match(
  sql,
  /dias_stock > GREATEST\(dias - dias_donacion, 0\)/,
  'el recalculador debe comparar días de stock contra ventana comercial',
)

console.log('✓ Funciones de riesgo usan fecha Argentina y NULL significa fuera del circuito')
