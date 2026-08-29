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
const jpegMigration = read('supabase/migrations/20260827000370_product_image_jpeg_fallback_v1.sql')
const versionedMigration = read('supabase/migrations/20260828000250_product_image_versioned_publish_v1.sql')

assert.match(helper, /modo_imagen_producto_operador/, 'La UI debe consultar el permiso real de imagen')
assert.match(helper, /actualizar_imagen_producto_operador_v2/, 'La foto global debe persistirse mediante el RPC autorizado')
assert.match(helper, /guardarImagenProductoGlobal/, 'Debe existir un único servicio compartido de guardado')
assert.match(helper, /globalThis\.crypto\?\.randomUUID/, 'Cada publicación debe generar un UUID de versión')
assert.match(helper, /pathImagenProducto\(organizacionId, productoId, versionId\)/, 'Full y thumb deben compartir la misma versión')
assert.match(helper, /upsert:\s*false/g, 'Las imágenes versionadas deben crearse sin sobrescritura')
assert.doesNotMatch(helper, /upsert:\s*true/, 'No se debe sobrescribir una versión publicada')
assert.match(pipeline, /\$\{organizacionId\}\/productos\/\$\{productoId\}\/\$\{versionId\}\/full\.webp/, 'La ruta full debe ser global y versionada')
assert.match(pipeline, /\$\{organizacionId\}\/productos\/\$\{productoId\}\/\$\{versionId\}\/thumb\.webp/, 'La miniatura debe compartir la versión global')
assert.match(scanner, /guardarImagenProductoGlobal/, 'Scanner debe reutilizar el servicio global de fotos')
assert.match(modal, /guardarImagenProductoGlobal/, 'Control del producto debe reutilizar el servicio global de fotos')
assert.doesNotMatch(scanner, /\.from\(['"]productos['"]\)\s*\.update/s, 'Scanner no debe actualizar imagen_url directamente')
assert.doesNotMatch(scanner, /\.upload\([^\n]*file\b/, 'Scanner no debe subir el archivo original directamente')
assert.match(scanner, /modoFoto === 'solo_lectura'/, 'Scanner debe ocultar reemplazo a perfiles sin permiso')
assert.match(modal, /modoFoto === 'solo_lectura'/, 'El modal debe respetar modo solo lectura')
assert.match(jpegMigration, /'image\/webp', 'image\/jpeg'/, 'Storage debe aceptar WebP y JPEG optimizado')
assert.doesNotMatch(jpegMigration, /image\/png/, 'PNG original no debe habilitarse en Storage')

assert.match(versionedMigration, /split_part\(p_name, '\/', 4\)::uuid/, 'Storage debe exigir UUID de versión')
assert.match(versionedMigration, /split_part\(p_name, '\/', 5\)/, 'Storage debe validar full\/thumb dentro de la versión')
assert.match(versionedMigration, /DROP POLICY IF EXISTS "Update catalogo V2"/, 'El navegador no debe sobrescribir objetos existentes')
assert.match(versionedMigration, /v_full_version IS DISTINCT FROM v_thumb_version/, 'La publicación debe rechazar versiones mezcladas')
assert.match(versionedMigration, /FROM storage\.objects o[\s\S]*o\.name=v_full_path/, 'La RPC debe comprobar que full existe')
assert.match(versionedMigration, /FROM storage\.objects o[\s\S]*o\.name=v_thumb_path/, 'La RPC debe comprobar que thumb existe')
assert.match(versionedMigration, /UPDATE public\.productos[\s\S]*imagen_url=[\s\S]*imagen_thumb_url=/, 'Las dos URLs deben publicarse juntas')

console.log('✓ Foto global: permisos + versión inmutable + publicación completa full/thumb')
