import assert from 'node:assert/strict'
import fs from 'node:fs'

const dashboard = fs.readFileSync(new URL('../../src/pages/Dashboard.tsx', import.meta.url), 'utf8')
const hook = fs.readFileSync(new URL('../../src/hooks/useAccionesOperativas.ts', import.meta.url), 'utf8')
const migration = fs.readFileSync(new URL('../../supabase/migrations/20260829233000_acciones_economicas_v1.sql', import.meta.url), 'utf8')

assert.match(
  dashboard,
  /nivel_riesgo === 'radar'/,
  'Radar debe formar parte del riesgo económico actual',
)
assert.match(
  dashboard,
  /const itemsAccionInmediata = data\.filter/,
  'riesgo total y acción inmediata deben ser contadores separados',
)
assert.match(
  dashboard,
  /Recuperadas por venta/,
  'el Dashboard debe identificar venta como recuperación',
)
assert.match(
  dashboard,
  /Perdidas · donación \+ decomiso/,
  'donación y decomiso deben consolidarse como pérdida',
)
assert.match(
  hook,
  /setVendidos\(vendidosRows\.reduce/,
  'vendidos debe sumar unidades y no contar eventos',
)
assert.match(
  hook,
  /resumir\(rows, \['donacion', 'decomiso'\]\)/,
  'la pérdida económica debe sumar donación y decomiso',
)
assert.match(
  migration,
  /'congelado_al_cierre'/,
  'los nuevos cierres deben congelar el costo disponible',
)
assert.match(
  migration,
  /'retrospectiva_0258'/,
  'los cierres históricos deben distinguir valorización retrospectiva',
)
assert.match(
  migration,
  /valor_economico_sin_iva/,
  'la vista de historial debe exponer el resultado económico sin IVA',
)

console.log('✓ Riesgo total incluye Radar y resultados conservan unidades + costo s/IVA')
