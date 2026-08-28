import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

const migration = read('supabase/migrations/20260828000020_access_invitations_v1.sql')
const backend = read('netlify/functions/admin-accesos.ts')
const activar = read('src/pages/ActivarCuenta.tsx')
const router = read('src/router/index.tsx')
const sucursalHook = read('src/hooks/useSucursalActual.ts')
const adminRoute = read('src/components/auth/AdminRoute.tsx')
const accessRoute = read('src/components/auth/AccessAdminRoute.tsx')
const adminPage = read('src/pages/AdminAccesos.tsx')
const layout = read('src/components/layout/AppLayout.tsx')

// Jerarquía de creación: org -> zonal/sucursal; zonal -> sucursal de su zona.
assert.match(migration, /ua\.rol in \('admin_organizacion','gerente_zonal'\)/)
assert.match(migration, /p_rol = 'gerente_sucursal'[\s\S]*?ua\.rol = 'gerente_zonal'[\s\S]*?ua\.zona_id = v_zona_objetivo/)
assert.match(migration, /Solo el administrador de organización puede crear gerentes zonales/)
assert.doesNotMatch(migration, /p_rol not in \([^)]*supervisor/)
assert.doesNotMatch(migration, /p_rol not in \([^)]*operador/)

// Ninguna cuenta existente recibe privilegios de organización automáticamente.
assert.match(migration, /NO promueve automáticamente ninguna cuenta existente/)
assert.doesNotMatch(migration, /s\.codigo = '091'/)
assert.doesNotMatch(migration, /Bootstrap admin_organizacion/)

// Permiso real en usuario_accesos; metadata Auth sólo lleva nombre de presentación.
assert.match(migration, /insert into public\.usuario_accesos/)
assert.match(migration, /case when p_rol = 'gerente_sucursal' then 'admin' else 'supervisor' end/)
assert.match(backend, /data: \{ nombre \}/)
assert.doesNotMatch(backend, /data: \{[^}]*rol/)

// Una invitación no concede acceso antes de ser aceptada.
assert.match(migration, /case when p_rol = 'gerente_sucursal' then p_sucursal_id else null end,\n\s*false\n\s*\);/)
assert.match(migration, /update public\.usuario_accesos ua[\s\S]*set activo = true/)
assert.match(migration, /where ua\.usuario_id = auth\.uid\(\)/)
assert.match(migration, /update public\.usuarios[\s\S]*set activo = true/)

// Los dos canales existen y el link es entregable por WhatsApp.
assert.match(backend, /auth\.admin\.generateLink/)
assert.match(backend, /type: 'invite'/)
assert.match(backend, /auth\.admin\.inviteUserByEmail/)
assert.match(backend, /properties\.action_link/)
assert.match(backend, /No tenés permiso para asignar esa sucursal/)
assert.match(backend, /deleteUser\(usuarioId\)/)
assert.match(adminPage, /Copiar invitación para WhatsApp/)
assert.match(adminPage, /Link \/ WhatsApp/)

// Activación propia: el invitado define contraseña y recién entonces habilita el scope.
assert.match(router, /path: '\/activar'/)
assert.match(activar, /auth\.updateUser\(\{ password \}\)/)
assert.match(activar, /aceptar_invitacion_acceso_v1/)
assert.match(activar, /aceptadas < 1/)

// Un zonal/admin puede elegir únicamente sucursales que RLS le deja leer.
assert.match(sucursalHook, /from\('sucursales'\)/)
assert.match(sucursalHook, /noven_sucursal_actual/)
assert.match(sucursalHook, /seleccionarSucursal/)
assert.match(sucursalHook, /perfil\?\.sucursal_id && idsPermitidos\.has/)

// Guards y navegación: admin local no equivale a admin jerárquico.
assert.match(adminRoute, /tieneRol\('gerente_sucursal'\)/)
assert.match(accessRoute, /admin_organizacion/)
assert.match(accessRoute, /gerente_zonal/)
assert.match(layout, /administraJerarquia && !administraSucursal/)
assert.match(router, /path: 'admin\/accesos'/)

console.log('Invitaciones jerárquicas, activación diferida y selección de sucursal — OK')
