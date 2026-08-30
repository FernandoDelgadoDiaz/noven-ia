import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const dashboard = fs.readFileSync(path.join(root, 'src/pages/Dashboard.tsx'), 'utf8')
const vencimientos = fs.readFileSync(path.join(root, 'src/pages/Vencimientos.tsx'), 'utf8')

assert.match(dashboard, /Atención requerida[\s\S]*?navigate\('\/vencimientos\?filtro=accion'\)/,
  'La cenefa de acción inmediata debe abrir sólo los casos de acción inmediata')
assert.match(dashboard, /Resumen de riesgos[\s\S]*?navigate\('\/vencimientos\?filtro=riesgo'\)/,
  'La tarjeta de riesgo total debe abrir urgente\/donación\/decomiso + radar')
assert.match(dashboard, /navigate\('\/vencimientos\?filtro=radar'\)/,
  'La tarjeta Radar debe conservar su filtro específico')

assert.match(vencimientos, /type FiltroUrl = 'accion' \| 'riesgo' \| 'radar'/)
assert.match(vencimientos, /NIVELES_ACCION_INMEDIATA[^\n]*\['urgente', 'donacion', 'decomiso'\]/)
assert.match(vencimientos, /NIVELES_EN_RIESGO[^\n]*\['urgente', 'donacion', 'decomiso', 'radar'\]/)
assert.match(vencimientos, /filtroUrl === 'accion'[\s\S]*NIVELES_ACCION_INMEDIATA/)
assert.match(vencimientos, /filtroUrl === 'riesgo'[\s\S]*NIVELES_EN_RIESGO/)
assert.match(vencimientos, /textoConteoUrl\(filtroUrl, vencimientosMostrados\.length\)/,
  'El encabezado debe reflejar el conteo filtrado, no todos los registros activos')

console.log('✓ Dashboard y Vencimientos mantienen coherencia entre mensajes, filtros y conteos')
