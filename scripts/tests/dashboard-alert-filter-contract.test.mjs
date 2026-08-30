import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const dashboard = fs.readFileSync(path.join(root, 'src/pages/Dashboard.tsx'), 'utf8')
const vencimientos = fs.readFileSync(path.join(root, 'src/pages/Vencimientos.tsx'), 'utf8')

assert.match(dashboard, /navigate\('\/vencimientos\?filtro=accion'\)/)
assert.match(dashboard, /navigate\('\/vencimientos\?filtro=riesgo'\)/)
assert.match(dashboard, /navigate\('\/vencimientos\?filtro=radar'\)/)

assert.match(vencimientos, /type FiltroUrl = 'accion' \| 'riesgo' \| 'radar'/)
assert.match(vencimientos, /NIVELES_ACCION_INMEDIATA/)
assert.match(vencimientos, /NIVELES_EN_RIESGO/)
assert.match(vencimientos, /filtroUrl === 'accion'/)
assert.match(vencimientos, /filtroUrl === 'riesgo'/)
assert.match(vencimientos, /producto\$\{n === 1 \? '' : 's'\} con acción inmediata/)
assert.match(vencimientos, /producto\$\{n === 1 \? '' : 's'\} en riesgo/)
assert.match(vencimientos, /producto\$\{n === 1 \? '' : 's'\} en radar/)
assert.doesNotMatch(dashboard, /onClick=\{\(\) => navigate\('\/vencimientos'\)\}/)

console.log('✓ Dashboard y listado conservan conteos/filtros coherentes')