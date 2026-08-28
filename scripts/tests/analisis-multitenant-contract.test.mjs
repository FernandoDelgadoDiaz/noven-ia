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

const scopeCompleto = server.match(
  /const scopeCompleto = accesos\.some\(\(a\) =>[\s\S]*?\n\s*\)/,
)?.[0] ?? ''
assert.ok(scopeCompleto, 'Análisis IA debe resolver el alcance completo explícitamente')
assert.match(scopeCompleto, /a\.rol === 'gerente_zonal' && a\.zona_id === sucursal\.zona_id/,
  'gerente zonal puede analizar una sucursal únicamente dentro de su zona')
assert.match(scopeCompleto, /a\.rol === 'gerente_sucursal' \|\| a\.rol === 'supervisor'/,
  'gerente/supervisor sólo obtienen alcance completo por su rol operativo local')
assert.match(scopeCompleto, /a\.sucursal_id === sucursalId/,
  'el alcance local debe coincidir con la sucursal solicitada')
assert.doesNotMatch(scopeCompleto, /admin_organizacion/,
  'admin_organizacion es jerarquía y no debe ampliar el alcance operativo de Análisis IA')

assert.match(server, /a\.rol === 'operador' && a\.sucursal_id === sucursalId/)
assert.match(server, /\.from\('usuario_familias_sucursal'\)/)
assert.match(server, /\.eq\('sucursal_id', sucursalId\)/)
assert.match(server, /No tenés acceso a la sucursal seleccionada/)
assert.match(server, /America\/Argentina\/Buenos_Aires/)

assert.doesNotMatch(hook, /usuario_id: user\?\.id|familia_ids|\brol\b/)
assert.match(hook, /body: JSON\.stringify\(\{ sucursal_id: sucursalSolicitada \}\)/)
assert.match(hook, /analisis_cache:\$\{usuarioId\}:\$\{sucursalId\}/)
assert.match(hook, /data\.sucursal_id !== sucursalSolicitada/)
assert.match(hook, /sucursalActualRef\.current !== sucursalSolicitada/)

console.log('✓ Análisis IA: zonal por zona, local por sucursal y jerarquía sin expansión operativa')
