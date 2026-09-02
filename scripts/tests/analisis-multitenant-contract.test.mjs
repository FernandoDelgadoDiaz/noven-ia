import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const server = fs.readFileSync(path.join(root, 'netlify/functions/analisis.ts'), 'utf8')
const hook = fs.readFileSync(path.join(root, 'src/hooks/useAnalisis.ts'), 'utf8')

assert.doesNotMatch(server, /SUCURSAL_LEGACY|00000000-0000-0000-0000-000000000001/)
assert.doesNotMatch(server, /\.from\('usuario_familias'\)/)
assert.doesNotMatch(server, /select\('rol, sucursal_id'\)/)
assert.match(server, /body\.sucursal_id/)
assert.match(server, /\.from\('usuario_accesos'\)/)

const alcanceGerencial = server.match(
  /const alcanceGerencial = accesos\.some\(\(a\) =>[\s\S]*?\n\s*\)/,
)?.[0] ?? ''
assert.ok(alcanceGerencial, 'Análisis IA debe resolver el alcance gerencial explícitamente')
assert.match(alcanceGerencial, /a\.rol === 'gerente_zonal' && a\.zona_id === sucursal\.zona_id/,
  'gerente zonal puede analizar una sucursal únicamente dentro de su zona')
assert.match(alcanceGerencial, /a\.rol === 'gerente_sucursal' \|\| a\.rol === 'supervisor'/,
  'gerente/supervisor obtienen alcance por su rol local en la sucursal solicitada')
assert.match(alcanceGerencial, /a\.sucursal_id === sucursalId/,
  'el alcance local debe coincidir con la sucursal solicitada')
assert.doesNotMatch(alcanceGerencial, /admin_organizacion/,
  'admin_organizacion es jerarquía y no debe ampliar el alcance operativo de Análisis IA')
assert.doesNotMatch(alcanceGerencial, /'operador'/,
  'el operador no genera análisis gerencial')

// El análisis es capacidad de conducción: no queda ningún camino de operador.
assert.doesNotMatch(server, /a\.rol === 'operador'/,
  'no debe quedar una rama de autorización para operador en Análisis IA')
assert.doesNotMatch(server, /esOperadorLocal/,
  'la rama de operador fue eliminada, no desactivada')
assert.doesNotMatch(server, /\.from\('usuario_familias_sucursal'\)/,
  'sin ámbito parcial por familias no hace falta cargarlas')
assert.doesNotMatch(server, /SYSTEM_OPERADOR/,
  'queda un único system prompt gerencial')
assert.match(server, /El análisis gerencial está disponible para gerentes y supervisores/)
assert.match(server, /America\/Argentina\/Buenos_Aires/)

// El gate de UI acompaña, pero nunca reemplaza al servidor.
const guard = fs.readFileSync(path.join(root, 'src/components/auth/AnalysisRoute.tsx'), 'utf8')
const alcanceUi = fs.readFileSync(path.join(root, 'src/hooks/usePuedeVerAnalisis.ts'), 'utf8')
assert.match(guard, /Navigate to="\/dashboard" replace/,
  'un operador que entre por URL directa vuelve al Dashboard')
for (const rol of ['gerente_zonal', 'gerente_sucursal', 'supervisor']) {
  assert.match(alcanceUi, new RegExp(`'${rol}'`), `${rol} debe ver Análisis`)
}
assert.doesNotMatch(alcanceUi, /'operador'/, 'el operador no ve Análisis en el nav')

assert.doesNotMatch(hook, /usuario_id: user\?\.id|familia_ids|\brol\b/)
assert.match(hook, /body: JSON\.stringify\(\{ sucursal_id: sucursalSolicitada \}\)/)
assert.match(hook, /analisis_cache:\$\{usuarioId\}:\$\{sucursalId\}/)
assert.match(hook, /data\.sucursal_id !== sucursalSolicitada/)
assert.match(hook, /sucursalActualRef\.current !== sucursalSolicitada/)

console.log('✓ Análisis IA: zonal por zona, local por sucursal y jerarquía sin expansión operativa')
