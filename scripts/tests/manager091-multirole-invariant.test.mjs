import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

const adminRoute = read('src/components/auth/AdminRoute.tsx')
const accessRoute = read('src/components/auth/AccessAdminRoute.tsx')
const layout = read('src/components/layout/AppLayout.tsx')
const accessHook = read('src/hooks/useAccesosMultitenant.ts')
const accessContext = read('src/context/NovenAccessContext.tsx')
const scopeMigration = read('supabase/migrations/20260828000210_role_scope_invariants_v2.sql')

// Los permisos se acumulan, pero cada rol conserva su alcance propio.
assert.match(accessHook, /new Set\(accesos\.map\(\(a\) => a\.rol\)\)/,
  'la autorización debe conservar el conjunto de roles activos del usuario')
assert.match(accessHook, /lista\.some\(\(rol\) => roles\.has\(rol\)\)/,
  'cada capacidad se resuelve por pertenencia al conjunto, no por un rol único')

// Gerente de sucursal: Admin sólo sobre la sucursal actualmente seleccionada si
// existe un acceso gerente_sucursal exactamente para esa sucursal.
assert.match(adminRoute, /acceso\.rol === 'gerente_sucursal'/,
  'Admin local debe exigir rol gerente_sucursal')
assert.match(adminRoute, /acceso\.sucursal_id === sucursalId/,
  'Admin local debe exigir coincidencia exacta con la sucursal actual')
assert.match(scopeMigration, /ua\.rol = 'gerente_sucursal'[\s\S]*?ua\.sucursal_id = p_sucursal_id/,
  'backend debe aplicar el mismo límite exacto de sucursal')
assert.doesNotMatch(scopeMigration.match(/CREATE OR REPLACE FUNCTION public\.listar_admin_sucursal_v1[\s\S]*?(?=CREATE OR REPLACE FUNCTION)/)?.[0] ?? '', /gerente_zonal|admin_organizacion/,
  'ni zonal ni admin_organizacion deben administrar usuarios locales por sí solos')

// Jerarquía: sólo una cuenta con admin_organizacion + gerente_sucursal de la 091.
assert.match(accessRoute, /esAdministradorJerarquia/)
assert.match(accessRoute, /admin_organizacion/)
assert.match(accessRoute, /gerente_sucursal/)
assert.match(accessRoute, /sucursal\.codigo === '091'/)
assert.doesNotMatch(accessRoute, /gerente_zonal/,
  'gerente_zonal no debe entrar a Accesos y jerarquía')

assert.match(scopeMigration, /CREATE OR REPLACE FUNCTION noven_private\.es_administrador_jerarquia_v1/)
assert.match(scopeMigration, /ua_admin\.rol = 'admin_organizacion'/)
assert.match(scopeMigration, /ua_local\.rol = 'gerente_sucursal'/)
assert.match(scopeMigration, /s091\.codigo = '091'/)

// Layout: las dos capacidades pueden coexistir, pero no se mezclan.
assert.match(layout, /const administraSucursal =/)
assert.match(layout, /a\.rol === 'gerente_sucursal' && a\.sucursal_id === sucursalId/)
assert.match(layout, /const administraJerarquia =/)
assert.match(layout, /a\.rol === 'admin_organizacion'/)
assert.match(layout, /s\.codigo === '091'/)
assert.match(layout, /administraJerarquia && administraSucursal/,
  'la cuenta gerente 091 puede conservar simultáneamente Admin local y Jerarquía')

// La sucursal propia continúa siendo el contexto operativo por defecto.
assert.match(accessContext, /a\.rol === 'gerente_sucursal'/)
assert.match(accessContext, /if \(sucursalPropiaId\)[\s\S]*?sucursalId: sucursalPropiaId/)

console.log('✓ gerente 091 conserva Admin local + jerarquía exclusiva sin ampliar alcance operativo')
