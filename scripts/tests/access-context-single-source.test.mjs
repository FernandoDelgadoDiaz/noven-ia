import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

const main = read('src/main.tsx')
const context = read('src/context/NovenAccessContext.tsx')
const useAuth = read('src/hooks/useAuth.ts')
const useRol = read('src/hooks/useUsuarioRol.ts')
const useAccesos = read('src/hooks/useAccesosMultitenant.ts')
const useSucursal = read('src/hooks/useSucursalActual.ts')
const activar = read('src/pages/ActivarCuenta.tsx')

assert.match(main, /NovenAccessProvider/)
assert.match(main, /<NovenAccessProvider>[\s\S]*<App \/>[\s\S]*<\/NovenAccessProvider>/)

assert.match(context, /supabase\.auth\.getSession\(\)/)
assert.match(context, /supabase\.auth\.onAuthStateChange/)
assert.match(context, /\.from\('usuarios'\)/)
assert.match(context, /\.from\('usuario_accesos'\)/)
assert.match(context, /\.from\('sucursales'\)/)
assert.match(context, /noven_sucursal_actual/)
assert.match(context, /noven:sucursal-cambio/)
assert.match(context, /a\.rol === 'gerente_sucursal'/)
assert.match(context, /refreshAuthorization/)

for (const [name, source] of [
  ['useAuth', useAuth],
  ['useUsuarioRol', useRol],
  ['useAccesosMultitenant', useAccesos],
  ['useSucursalActual', useSucursal],
]) {
  assert.match(source, /useNovenAccessContext/, `${name} debe leer del contexto compartido`)
  assert.doesNotMatch(source, /onAuthStateChange/, `${name} no debe crear listeners Auth propios`)
  assert.doesNotMatch(source, /\.from\(/, `${name} no debe repetir consultas de autorización`)
}

assert.doesNotMatch(activar, /onAuthStateChange/)
assert.doesNotMatch(activar, /auth\.getSession/)
assert.match(activar, /refreshAuthorization/)
assert.match(activar, /aceptar_invitacion_acceso_v1/)
assert.match(activar, /await refreshAuthorization\(\)/)

console.log('✓ Sesión, perfil, accesos y sucursal comparten un único snapshot de autorización')
