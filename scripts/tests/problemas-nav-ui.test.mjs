import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

const dashboard = read('src/pages/Dashboard.tsx')
const layout = read('src/components/layout/AppLayout.tsx')
const router = read('src/router/index.tsx')
const problemas = read('src/pages/Problemas.tsx')

assert.doesNotMatch(dashboard, /<ProblemasActivosPanel/,
  'Problemas Activos no debe renderizarse dentro del Dashboard')
assert.match(layout, /to: '\/problemas', label: 'Problemas'/,
  'la navegación debe exponer la solapa Problemas')
assert.doesNotMatch(layout, />Salir<\/span>/,
  'Salir no debe ocupar una posición de la navegación móvil')
assert.match(router, /const Problemas = lazy\(\(\) => import\('\.\.\/pages\/Problemas'\)\)/)
assert.match(router, /path: 'problemas'/)
assert.match(problemas, /<ProblemasActivosPanel/,
  'la nueva solapa debe reutilizar el panel real de problemas activos')
assert.match(problemas, /useProblemasActivos\(sucursalId\)/,
  'la solapa debe conservar la misma fuente de información')
assert.match(dashboard, /aria-label="Cerrar sesión"/,
  'el cierre de sesión debe quedar reubicado en el avatar del Dashboard')
assert.match(dashboard, /window\.confirm\('\¿Cerrar sesión\?'\)/,
  'cerrar sesión desde el avatar debe requerir confirmación')

console.log('✓ Problemas: solapa propia, Dashboard intacto sin panel y cierre de sesión reubicado')
