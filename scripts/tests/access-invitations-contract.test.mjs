import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

const originalMigration = read('supabase/migrations/20260828000020_access_invitations_v1.sql')
const scopeMigration = read('supabase/migrations/20260828000210_role_scope_invariants_v2.sql')
const backend = read('netlify/functions/admin-accesos.ts')
const activar = read('src/pages/ActivarCuenta.tsx')
const router = read('src/router/index.tsx')
const accessContext = read('src/context/NovenAccessContext.tsx')
const sucursalHook = read('src/hooks/useSucursalActual.ts')
const adminRoute = read('src/components/auth/AdminRoute.tsx')
const accessRoute = read('src/components/auth/AccessAdminRoute.tsx')
const adminPage = read('src/pages/AdminAccesos.tsx')
const layout = read('src/components/layout/AppLayout.tsx')

// El historial conserva el origen del modelo, pero la autorización vigente está
// redefinida por la migración más reciente y no admite delegación al zonal.
assert.match(scopeMigration, /CREATE OR REPLACE FUNCTION noven_private\.es_administrador_jerarquia_v1/)
assert.match(scopeMigration, /ua_admin\.rol = 'admin_organizacion'/)
assert.match(scopeMigration, /ua_local\.rol = 'gerente_sucursal'/)
assert.match(scopeMigration, /s091\.codigo = '091'/)
assert.match(scopeMigration, /CREATE OR REPLACE FUNCTION public\.registrar_invitacion_acceso_v1/)
assert.match(scopeMigration, /IF NOT noven_private\.es_administrador_jerarquia_v1\(p_actor_id,v_org\) THEN/)

const hierarchyBlock = scopeMigration.match(/CREATE OR REPLACE FUNCTION public\.registrar_invitacion_acceso_v1[\s\S]*?(?=CREATE OR REPLACE FUNCTION noven_private\.puede_gestionar_invitacion_v1)/)?.[0] ?? ''
assert.ok(hierarchyBlock)
assert.doesNotMatch(hierarchyBlock, /ua\.rol = 'gerente_zonal'/,
  'gerente_zonal no debe crear accesos jerárquicos')

// Permiso real vive en usuario_accesos; metadata Auth sólo lleva nombre.
assert.match(scopeMigration, /INSERT INTO public\.usuario_accesos/)
assert.match(scopeMigration, /CASE WHEN p_rol='gerente_sucursal' THEN 'admin' ELSE 'supervisor' END/)
assert.match(backend, /data: \{ nombre \}/)
assert.doesNotMatch(backend, /data: \{[^}]*rol/)

// Una invitación no concede acceso antes de ser aceptada.
assert.match(scopeMigration, /CASE WHEN p_rol='gerente_sucursal' THEN p_sucursal_id ELSE NULL END,false\);/)
assert.match(originalMigration, /update public\.usuario_accesos ua[\s\S]*set activo = true/)
assert.match(originalMigration, /where ua\.usuario_id = auth\.uid\(\)/)
assert.match(originalMigration, /update public\.usuarios[\s\S]*set activo = true/)

// Los dos canales existen y el link es entregable por WhatsApp.
assert.match(backend, /auth\.admin\.generateLink/)
assert.match(backend, /type: 'invite'/)
assert.match(backend, /auth\.admin\.inviteUserByEmail/)
assert.match(backend, /properties\.action_link/)
assert.match(backend, /deleteUser\(usuarioId\)/)
assert.match(adminPage, /Copiar invitación para WhatsApp/)
assert.match(adminPage, /Link \/ WhatsApp/)

// Activación propia: el invitado define contraseña y recién entonces habilita el scope.
assert.match(router, /path: '\/activar'/)
assert.match(activar, /auth\.updateUser\(\{ password \}\)/)
assert.match(activar, /aceptar_invitacion_acceso_v1/)
assert.match(activar, /aceptadas < 1/)
assert.match(activar, /await refreshAuthorization\(\)/)

// La selección operacional proviene de RLS; admin_organizacion no debe abrir por
// sí solo otras sucursales y el gerente mantiene su sucursal propia como default.
assert.match(accessContext, /from\('sucursales'\)/)
assert.match(accessContext, /noven_sucursal_actual/)
assert.match(accessContext, /a\.rol === 'gerente_sucursal'/)
assert.match(accessContext, /if \(sucursalPropiaId\)/)
assert.match(sucursalHook, /useNovenAccessContext/)
assert.doesNotMatch(sucursalHook, /from\('sucursales'\)/)

// Guards: Admin local exige gerente de esa sucursal; jerarquía exige admin + 091.
assert.match(adminRoute, /acceso\.rol === 'gerente_sucursal'/)
assert.match(adminRoute, /acceso\.sucursal_id === sucursalId/)
assert.match(accessRoute, /admin_organizacion/)
assert.match(accessRoute, /gerente_sucursal/)
assert.match(accessRoute, /codigo === '091'/)
assert.doesNotMatch(accessRoute, /gerente_zonal/)
assert.match(layout, /administraJerarquia && administraSucursal/)
assert.match(router, /path: 'admin\/accesos'/)

console.log('Invitaciones seguras + jerarquía exclusiva gerente 091 — OK')
