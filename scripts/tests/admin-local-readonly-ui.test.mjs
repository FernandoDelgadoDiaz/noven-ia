import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const admin = fs.readFileSync(path.join(root, 'src/pages/AdminSeguro.tsx'), 'utf8')

assert.match(admin, /perfil_activo: boolean/, 'UI debe distinguir estado global del perfil')
assert.match(admin, /editable: boolean/, 'UI debe consumir la bandera server-side de edición')
assert.match(
  admin,
  /onEditar=\{u\.editable \? \(\) => setModal\(\{ modo: 'editar', usuario: u \}\) : undefined\}/,
  'Sólo filas editables deben abrir el modal local',
)
assert.doesNotMatch(admin, /<option value="admin">/, 'Gerente no debe aparecer como rol editable local')
assert.match(
  admin,
  /modo === 'editar' && \(!usuario\?\.editable \|\| !usuario\.perfil_activo \|\| usuario\.rol === 'admin'\)/,
  'Modal debe cerrar también la edición por estado obsoleto/manipulado',
)
assert.match(admin, /Gestionar desde Accesos y jerarquía\./, 'Gerentes deben indicar el flujo jerárquico correcto')
assert.match(admin, /CUENTA SIN ACTIVAR/, 'Cuenta pendiente debe distinguirse del estado local')
assert.match(admin, /INACTIVO EN SUCURSAL/, 'Estado local inactivo debe mostrarse explícitamente')
assert.match(admin, />Solo lectura<\/span>/, 'Fila no editable debe verse como sólo lectura')

console.log('✓ Admin local refleja la frontera server-side: gerentes y cuentas no editables son sólo lectura')
