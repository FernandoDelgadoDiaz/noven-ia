import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

const helper = read('src/lib/product-image.ts')
const pipeline = read('src/lib/image-pipeline.ts')
const scanner = read('src/components/scanner/ProductoConfirm.tsx')
const modal = read('src/components/dashboard/EditarVencimientoModalSeguro.tsx')
const migration = read('supabase/migrations/20260827000370_product_image_jpeg_fallback_v1.sql')

assert.match(helper, /modo_imagen_producto_operador/, 'La UI debe consultar el permiso real de imagen')
assert.match(helper, /actualizar_imagen_producto_operador_v2/, 'La foto global debe persistirse mediante el RPC autorizado')
assert.match(helper, /guardarImagenProductoGlobal/, 'Debe existir un único servicio compartido de guardado')
assert.match(pipeline, /\$\{organizacionId\}\/productos\/\$\{productoId\}\/full\.webp/, 'La ruta debe ser global por organización + producto')
assert.match(pipeline, /\$\{organizacionId\}\/productos\/\$\{productoId\}\/thumb\.webp/, 'La miniatura debe compartir la misma identidad global')
assert.match(scanner, /guardarImagenProductoGlobal/, 'Scanner debe reutilizar el servicio global de fotos')
assert.match(modal, /guardarImagenProductoGlobal/, 'Control del producto debe reutilizar el servicio global de fotos')
assert.doesNotMatch(scanner, /\.from\(['"]productos['"]\)\s*\.update/s, 'Scanner no debe actualizar imagen_url directamente')
assert.doesNotMatch(scanner, /\.upload\([^\n]*file\b/, 'Scanner no debe subir el archivo original directamente')
assert.match(scanner, /modoFoto === 'solo_lectura'/, 'Scanner debe ocultar reemplazo a perfiles sin permiso')
assert.match(modal, /modoFoto === 'solo_lectura'/, 'El modal debe respetar modo solo lectura')
assert.match(migration, /'image\/webp', 'image\/jpeg'/, 'Storage debe aceptar WebP y JPEG optimizado')
assert.doesNotMatch(migration, /image\/png/, 'PNG original no debe habilitarse en Storage')

console.log('✓ Foto de producto es global, compartida y protegida por permisos')
