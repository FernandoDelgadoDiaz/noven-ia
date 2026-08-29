import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const cutover = read('supabase/migrations/20260828000260_freeze_legacy_product_store_state_v1.sql')
const operational = read('supabase/migrations/20260826000460_vencimientos_operativos_v1.sql')
const scanner = read('supabase/migrations/20260827000140_scanner_catalog_rpc_v1.sql')

// El estado operativo continúa siendo producto_sucursal.
assert.match(operational, /ps\.stock_actual/)
assert.match(operational, /ps\.venta_media_diaria/)
assert.doesNotMatch(operational, /p\.stock_actual|p\.venta_media_diaria/)
assert.match(scanner, /COALESCE\(ps\.stock_actual, 0\)/)
assert.match(scanner, /COALESCE\(ps\.venta_media_diaria, 0\)/)

// El bridge histórico productos -> 091 deja de existir en runtime.
assert.match(cutover, /DROP TRIGGER IF EXISTS productos_sync_estado_091_insert/)
assert.match(cutover, /DROP TRIGGER IF EXISTS productos_sync_estado_091_update/)
assert.match(cutover, /REVOKE ALL ON FUNCTION public\.sync_legacy_producto_estado_091\(\)/)

// Las columnas quedan físicamente presentes pero congeladas.
assert.match(cutover, /NEW\.stock_actual := 0/)
assert.match(cutover, /NEW\.venta_media_diaria := 0/)
assert.match(cutover, /NEW\.stock_actual := OLD\.stock_actual/)
assert.match(cutover, /NEW\.venta_media_diaria := OLD\.venta_media_diaria/)
assert.match(cutover, /BEFORE INSERT ON public\.productos/)
assert.match(cutover, /BEFORE UPDATE OF stock_actual, venta_media_diaria ON public\.productos/)
assert.match(cutover, /LEGACY CONGELADO/)

// Este bloque no hace un DROP destructivo ni vuelve a copiar estado local al catálogo global.
assert.doesNotMatch(cutover, /DROP\s+COLUMN/i)
assert.doesNotMatch(cutover, /INSERT\s+INTO\s+public\.producto_sucursal/i)
assert.doesNotMatch(cutover, /UPDATE\s+public\.producto_sucursal/i)

console.log('✓ Estado legacy de productos queda congelado; stock/VMD operativo permanece por sucursal')
