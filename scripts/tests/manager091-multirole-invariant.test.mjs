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
const localAdmin = read('supabase/migrations/20260828000160_local_admin_scope_boundary_v2.sql')

// Los permisos se acumulan por rol; tener más de un acceso no reemplaza el anterior.
assert.match(accessHook, /new Set\(accesos\.map\(\(a\) => a\.rol\)\)/,
  'la autorización debe conservar el conjunto de roles activos del usuario')
assert.match(accessHook, /lista\.some\(\(rol\) => roles\.has\(rol\)\)/,
  'cada capacidad debe resolverse por pertenencia al conjunto, no por un rol único')

// Gerencia de sucursal: conserva administración operativa del local.
assert.match(adminRoute, /tieneRol\('gerente_sucursal'\)/,
  'gerente_sucursal debe conservar acceso a la administración local')
assert.match(localAdmin, /WHEN ua\.rol = 'gerente_sucursal' AND ua\.sucursal_id = p_sucursal_id THEN 1/,
  'backend debe autorizar al gerente únicamente sobre su sucursal')
assert.match(localAdmin, /UPDATE public\.usuario_accesos ua[\s\S]*?SET rol = v_rol_scope,[\s\S]*?activo = p_activo/,
  'gerencia local debe poder habilitar/deshabilitar accesos locales de Supervisor/Operador')
assert.match(localAdmin, /UPDATE public\.usuario_familias_sucursal[\s\S]*?activo = false/,
  'gerencia local debe conservar administración de responsabilidades por familia')

// Jerarquía corporativa es una capacidad separada: sólo existe si la misma cuenta
// también posee admin_organizacion o gerente_zonal. No se hereda por ser gerente local.
assert.match(accessRoute, /tieneRol\(\['admin_organizacion', 'gerente_zonal'\]\)/,
  'Accesos y jerarquía debe conservar su guard jerárquico independiente')
assert.doesNotMatch(accessRoute, /tieneRol\([^\n]*gerente_sucursal/,
  'gerente_sucursal por sí solo no debe obtener alcance corporativo')

// Una cuenta multirrol debe ver la unión de capacidades, nunca una u otra.
assert.match(layout, /const administraSucursal = [^\n]*tieneRol\('gerente_sucursal'\)/,
  'layout debe calcular administración de sucursal en forma independiente')
assert.match(layout, /const administraJerarquia = [^\n]*tieneRol\(\['admin_organizacion', 'gerente_zonal'\]\)/,
  'layout debe calcular administración jerárquica en forma independiente')
assert.match(layout, /\.\.\.\(administraSucursal \? SUCURSAL_ADMIN_NAV_ITEMS : \[\]\)/,
  'una cuenta con rol local debe conservar Importar/Admin')
assert.match(layout, /\.\.\.\(administraJerarquia \? \[ACCESS_ADMIN_NAV_ITEM\] : \[\]\)/,
  'una cuenta con rol jerárquico debe conservar Accesos')
assert.match(layout, /administraJerarquia && administraSucursal/,
  'móvil debe contemplar explícitamente la coexistencia de ambos permisos')
assert.match(layout, />\s*Accesos y jerarquía\s*</,
  'la acción Accesos y jerarquía debe seguir visible para la cuenta multirrol')

// Si la cuenta además es gerente de una sucursal, esa sucursal propia sigue siendo
// el contexto operativo por defecto aunque también tenga alcance superior.
assert.match(accessContext, /a\.rol === 'gerente_sucursal'/,
  'la sucursal propia debe derivarse del acceso gerente_sucursal')
assert.match(accessContext, /if \(sucursalPropiaId\)[\s\S]*?sucursalId: sucursalPropiaId/,
  'la sucursal propia debe tener prioridad como contexto operativo por defecto')

console.log('✓ Gerente 091 multirrol conserva administración local + Accesos y jerarquía sin ampliar el rol local')
