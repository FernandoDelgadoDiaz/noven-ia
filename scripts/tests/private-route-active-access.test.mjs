import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const route = fs.readFileSync(path.join(root, 'src/components/auth/PrivateRoute.tsx'), 'utf8')
const acciones = fs.readFileSync(path.join(root, 'src/hooks/useAccionesOperativas.ts'), 'utf8')

assert.match(route, /useUsuarioRol/)
assert.match(route, /useAccesosMultitenant/)
assert.match(route, /!perfil\.activo/)
assert.match(route, /!legacyMode && accesos\.length === 0/)
assert.match(route, /Cuenta pendiente o desactivada/)
assert.match(route, /Sin acceso activo/)
assert.doesNotMatch(route, /if \(!session\)[\s\S]{0,80}return <Outlet/)

assert.match(acciones, /if \(!sucursalId\)/)
assert.match(acciones, /setVendidos\(0\)/)
assert.match(acciones, /setLoading\(false\)/)
assert.match(acciones, /\.eq\('sucursal_id', sucursalId\)/)
assert.match(acciones, /America\/Argentina\/Buenos_Aires/)

console.log('✓ Rutas privadas exigen acceso activo y acciones no consultan UUID vacío')
