import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const helper = fs.readFileSync(path.join(root, 'src/lib/saludo-dashboard.ts'), 'utf8')
const dashboard = fs.readFileSync(path.join(root, 'src/pages/Dashboard.tsx'), 'utf8')

assert.match(helper, /America\/Argentina\/Buenos_Aires/,
  'el saludo debe usar la hora operativa de Argentina')
assert.match(helper, /Buenos días/)
assert.match(helper, /Buenas tardes/)
assert.match(helper, /Buenas noches/)
assert.match(helper, /split\(\/\\s\+\//,
  'debe tomar sólo el primer nombre del perfil')
assert.match(helper, /nombreCorto \? `\$\{saludo\}, \$\{nombreCorto\} 👋`/,
  'el saludo personalizado debe incluir el primer nombre')
assert.match(helper, /: `\$\{saludo\} 👋`/,
  'si falta nombre debe conservar un fallback genérico')

assert.match(dashboard, /useUsuarioRol/,
  'el Dashboard debe usar el perfil de usuario ya cargado')
assert.match(dashboard, /saludoDashboard\(perfil\?\.nombre\)/,
  'el Dashboard debe personalizar el saludo con el nombre del perfil')
assert.doesNotMatch(dashboard, /\{getGreeting\(\)\}/,
  'no debe quedar el saludo genérico anterior en el encabezado')

console.log('✓ Dashboard saluda por hora operativa y primer nombre del usuario')
