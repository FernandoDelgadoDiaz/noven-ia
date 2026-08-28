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
  !admin.includes('<option value="admin">'),
  'Admin local no debe ofrecer edición de gerentes de sucursal.',
)
expect(
  admin.includes('Los gerentes de sucursal se crean desde Accesos y jerarquía mediante invitación.'),
  'Falta el guard de frontend contra alta local de gerentes.',
)
expect(
  admin.includes('Los gerentes de sucursal y zonales se crean desde Accesos y jerarquía'),
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
  'La migración histórica debe conservar el bloqueo de creación/promoción local de gerentes.',
)
expect(
  migration.includes('Los gerentes de sucursal se crean desde Accesos y jerarquía mediante invitación'),
  'Falta el rechazo histórico de backend para altas locales de gerentes.',
)

console.log('admin-org-explicit-local-guard: OK')
