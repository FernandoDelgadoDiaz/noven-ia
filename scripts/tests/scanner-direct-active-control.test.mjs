import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const confirm = fs.readFileSync(path.join(ROOT, 'src/components/scanner/ProductoConfirm.tsx'), 'utf8')

assert.match(confirm, /v_vencimientos_operativos/, 'El scanner debe verificar si el producto ya tiene un vencimiento activo')
assert.match(confirm, /\.eq\('activo', true\)/, 'La detección directa solo debe considerar vencimientos activos')
assert.match(confirm, /EditarVencimientoModal/, 'Un producto ya controlado debe reutilizar el modal operativo de edición')
assert.match(confirm, /if \(vencimientoActivo && vencimientoActivo\.dias_donacion != null\)/, 'El acceso directo debe activarse cuando existe un control activo con política válida')
assert.match(confirm, /onClose=\{onCancel\}/, 'Cerrar el control directo debe devolver al scanner limpio')
assert.match(confirm, /onGuardado=\{onCancel\}/, 'Guardar el control directo debe devolver al scanner limpio')
assert.doesNotMatch(confirm, /dias_donacion:\s*10/, 'El acceso directo no debe inventar un umbral de donación')

console.log('✓ Scanner abre directamente el control de un producto con vencimiento activo')
