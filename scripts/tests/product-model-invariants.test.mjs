import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const catalog = read('supabase/migrations/20260826000200_catalogo_estado_sucursal_v1.sql')
const operational = read('supabase/migrations/20260826000460_vencimientos_operativos_v1.sql')
const scanner = read('supabase/migrations/20260827000140_scanner_catalog_rpc_v1.sql')
const radar = read('supabase/migrations/20260827000340_radar_zonal_v1.sql')
const image = read('src/lib/product-image.ts')
const push = read('netlify/functions/enviar-push-radar-zonal.ts')

// 1) Identidad de producto compartida por organización.
assert.match(catalog, /CREATE TABLE public\.producto_codigos[\s\S]*UNIQUE \(organizacion_id, codigo\)/)
assert.match(scanner, /'cod_art', p\.cod_art/)
assert.match(scanner, /'codigo_barras', COALESCE\([\s\S]*public\.producto_codigos/)
assert.match(scanner, /'imagen_url', p\.imagen_url/)
assert.match(scanner, /WHERE p\.organizacion_id = v_org/)

// 2) Stock y VMD son estado local de la sucursal, nunca identidad global operativa.
assert.match(catalog, /CREATE TABLE public\.producto_sucursal[\s\S]*stock_actual[\s\S]*venta_media_diaria[\s\S]*UNIQUE \(producto_id, sucursal_id\)/)
assert.match(operational, /ps\.stock_actual/)
assert.match(operational, /ps\.venta_media_diaria/)
assert.match(operational, /ps\.sucursal_id = v\.sucursal_id/)
assert.doesNotMatch(operational, /p\.stock_actual|p\.venta_media_diaria/)
assert.match(scanner, /'venta_media_diaria', COALESCE\(ps\.venta_media_diaria, 0\)/)
assert.match(scanner, /'stock_actual', COALESCE\(ps\.stock_actual, 0\)/)
assert.match(scanner, /ps\.sucursal_id = p_sucursal_id/)

// 3) Foto compartida: path y persistencia por organización + producto, no por sucursal.
assert.match(image, /guardarImagenProductoGlobal/)
assert.match(image, /pathImagenProducto\(organizacionId, productoId\)/)
assert.match(image, /actualizar_imagen_producto_operador_v2/)
assert.match(image, /catálogo global por organización/)

// 4) Radar colaborativo: sólo misma zona, nunca el origen y sólo locales con stock positivo.
assert.match(radar, /sd\.zona_id = v_zona/)
assert.match(radar, /sd\.id <> v_sucursal_origen/)
assert.match(radar, /ps\.producto_id = v_producto/)
assert.match(radar, /ps\.stock_actual > 0/)

// Si ya existe un control activo en el destino, no se genera ruido; queda ya_controlado.
assert.match(radar, /WHEN vc\.id IS NOT NULL THEN 'ya_controlado'/)
assert.match(radar, /ELSE 'pendiente'/)
assert.match(radar, /public\.usuario_familias_sucursal/)
assert.match(radar, /ua\.rol = 'operador'/)

// 5) El aviso explica origen, SKU, fecha y stock del local receptor.
assert.match(push, /Radar Zonal · Suc\. \$\{origen\}/)
assert.match(push, /SKU \$\{codArt\}/)
assert.match(push, /vence \$\{fecha\}/)
assert.match(push, /stock: \$\{destino\.stock_snapshot\}/)
assert.match(push, /\.eq\('estado', 'pendiente'\)/)

console.log('✓ Modelo protegido: catálogo global · stock/VMD local · Radar colaborativo por zona')
