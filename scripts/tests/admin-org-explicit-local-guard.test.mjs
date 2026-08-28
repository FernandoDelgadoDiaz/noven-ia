import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const admin = fs.readFileSync(path.join(root, 'src/pages/AdminSeguro.tsx'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260828000040_explicit_admin_org_and_local_role_hardening_v1.sql'),
  'utf8',
)

function expect(condition, message) {
  if (!condition) throw new Error(message)
}

expect(
  admin.includes("{modo === 'editar' && usuario?.rol === 'admin' && <option value=\"admin\">Admin de sucursal</option>}"),
  'El rol admin sólo debe aparecer al editar un gerente ya existente.',
)
expect(
  !admin.includes('\n              <option value="admin">Admin de sucursal</option>\n'),
  'Nuevo usuario local no debe ofrecer Admin de sucursal de forma incondicional.',
)
expect(
  admin.includes('Los gerentes de sucursal se crean desde Accesos y jerarquía mediante invitación.'),
  'Falta el guard de frontend contra alta local de gerentes.',
)
expect(
  admin.includes('Los gerentes de sucursal y gerentes zonales se crean desde Accesos y jerarquía'),
  'Falta la explicación del flujo correcto en el formulario local.',
)
expect(
  migration.includes("lower(u.email) = 'gerente091@gmail.com'"),
  'La aprobación explícita debe quedar versionada para la cuenta autorizada.',
)
expect(
  migration.includes("'admin_organizacion'"),
  'La migración debe otorgar admin_organizacion sin reemplazar gerente_sucursal.',
)
expect(
  migration.includes("if p_rol_legacy = 'admin' then"),
  'La base debe bloquear creación/promoción local de nuevos gerentes.',
)
expect(
  migration.includes('Los gerentes de sucursal se crean desde Accesos y jerarquía mediante invitación'),
  'Falta el rechazo de backend para altas locales de gerentes.',
)

console.log('admin-org-explicit-local-guard: OK')
