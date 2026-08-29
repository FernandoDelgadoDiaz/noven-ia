import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const helper = fs.readFileSync(path.join(ROOT, 'src/lib/product-image.ts'), 'utf8')
const pipeline = fs.readFileSync(path.join(ROOT, 'src/lib/image-pipeline.ts'), 'utf8')
const migration = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20260828000250_product_image_versioned_publish_v1.sql'),
  'utf8',
)

const fullUpload = helper.indexOf('.upload(paths.full')
const thumbUpload = helper.indexOf('.upload(paths.thumb')
const publishRpc = helper.indexOf(".rpc('actualizar_imagen_producto_operador_v2'")

assert.ok(fullUpload >= 0, 'debe subir full')
assert.ok(thumbUpload > fullUpload, 'thumb debe subirse después de full dentro de la misma versión')
assert.ok(publishRpc > thumbUpload, 'la DB sólo se publica después de ambos uploads')
assert.equal((helper.match(/upsert:\s*false/g) ?? []).length, 2, 'ambos objetos deben ser INSERT inmutable')
assert.doesNotMatch(helper, /upsert:\s*true/, 'no debe existir overwrite de foto publicada')
assert.match(helper, /const versionId = nuevaVersionImagen\(\)/)
assert.match(pipeline, /versionId: string/)
assert.match(pipeline, /\$\{versionId\}\/full\.webp/)
assert.match(pipeline, /\$\{versionId\}\/thumb\.webp/)

assert.match(migration, /CREATE POLICY "Upload catalogo V2"[\s\S]*FOR INSERT[\s\S]*TO authenticated/)
assert.match(migration, /DROP POLICY IF EXISTS "Update catalogo V2" ON storage\.objects/)
assert.match(migration, /CREATE OR REPLACE FUNCTION noven_private\.puede_actualizar_imagen_catalogo_storage[\s\S]*SELECT false;/)
assert.match(migration, /v_full_version IS DISTINCT FROM v_thumb_version/)
assert.match(migration, /La versión de imagen no está completa en Storage/)
assert.match(migration, /storage\.objects o[\s\S]*o\.name=v_full_path/)
assert.match(migration, /storage\.objects o[\s\S]*o\.name=v_thumb_path/)

console.log('✓ Foto publicada sólo tras completar un par inmutable de la misma versión')
