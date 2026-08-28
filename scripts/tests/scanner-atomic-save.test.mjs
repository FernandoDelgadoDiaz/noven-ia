import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260828000120_scanner_atomic_expiry_stock_v1.sql'), 'utf8')
const form = fs.readFileSync(path.join(root, 'src/components/scanner/VencimientoForm.tsx'), 'utf8')

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.guardar_vencimiento_y_stock_scanner_v1/)
assert.match(migration, /public\.crear_vencimiento_operador\(/)
assert.match(migration, /public\.actualizar_vencimiento_operador\(/)
assert.match(migration, /public\.actualizar_stock_producto_sucursal_scanner\(/)
assert.match(migration, /v\.producto_id, v\.sucursal_id/)
assert.match(migration, /v\.activo = true/)
assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon/)
assert.match(migration, /GRANT EXECUTE ON FUNCTION[\s\S]*TO authenticated/)
assert.doesNotMatch(migration, /SECURITY DEFINER/)

assert.match(form, /\.rpc\('guardar_vencimiento_y_stock_scanner_v1'/)
assert.doesNotMatch(form, /\.rpc\('crear_vencimiento_operador'/)
assert.doesNotMatch(form, /\.rpc\('actualizar_vencimiento_operador'/)
assert.doesNotMatch(form, /\.rpc\('actualizar_stock_producto_sucursal_scanner'/)
assert.doesNotMatch(form, /Vencimiento guardado, pero error al actualizar stock local/)
assert.match(form, /p_vencimiento_id: vencimientoExistente\?\.id \?\? null/)
assert.match(form, /p_stock_actual: stockNum/)

console.log('✓ Scanner guarda vencimiento/control y stock en una sola transacción')
