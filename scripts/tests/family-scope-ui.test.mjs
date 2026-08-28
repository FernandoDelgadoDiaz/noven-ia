import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

const context = read('src/context/NovenAccessContext.tsx')
const sucursal = read('src/hooks/useSucursalActual.ts')
const familias = read('src/hooks/useUsuarioFamilias.ts')

assert.match(
  context,
  /organizacion_id:\s*string/,
  'la sucursal operativa debe transportar organizacion_id para resolver scopes mixtos',
)
assert.match(
  context,
  /select\('id, codigo, nombre, zona_id, organizacion_id'\)/,
  'la consulta única de sucursales debe traer la organización autoritativa',
)
assert.match(
  sucursal,
  /useNovenAccessContext/,
  'el hook operativo debe consumir la metadata de la fuente única',
)

assert.match(
  familias,
  /a\.organizacion_id !== sucursalActual\.organizacion_id/,
  'un rol de otra organización no puede ampliar las familias de la sucursal actual',
)
assert.match(
  familias,
  /a\.rol === 'admin_organizacion'/,
  'admin de organización conserva todas las familias sólo después del guard de organización',
)
assert.match(
  familias,
  /a\.rol === 'gerente_zonal'/,
  'gerente zonal debe resolverse explícitamente',
)
assert.match(
  familias,
  /a\.zona_id === sucursalActual\.zona_id/,
  'gerente zonal sólo amplía familias dentro de su zona',
)
assert.match(
  familias,
  /a\.rol === 'gerente_sucursal' \|\| a\.rol === 'supervisor'/,
  'gerente y supervisor locales deben resolverse explícitamente',
)
assert.match(
  familias,
  /a\.sucursal_id === sucursalId/,
  'gerente/supervisor sólo amplían familias en su sucursal exacta',
)
assert.doesNotMatch(
  familias,
  /\['admin_organizacion',\s*'gerente_zonal',\s*'gerente_sucursal',\s*'supervisor'\]\.includes\(a\.rol\)/,
  'no debe volver el permiso global por mera presencia de un rol superior',
)
assert.match(
  familias,
  /\.from\('usuario_familias_sucursal'\)[\s\S]*?\.eq\('sucursal_id', sucursalId\)[\s\S]*?\.eq\('activo', true\)/,
  'operador debe leer únicamente sus familias activas de la sucursal seleccionada',
)
assert.match(
  familias,
  /const sinFamilias = Boolean\(sucursalId\)/,
  'no debe anunciar sin familias mientras todavía no hay contexto de sucursal',
)

console.log('✓ Alcance UI de familias replica organización, zona y sucursal de PostgreSQL')
