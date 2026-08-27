-- =============================================================================
-- NOVEN · PRODUCT IMAGE STORAGE HARDENING V2
--
-- Aplicar sólo después de desplegar el frontend Image Pipeline V2.
-- Restringe nuevas cargas a WebP <= 1 MB y a rutas organizacion/producto.
-- Las imágenes legacy existentes siguen siendo públicas y visibles.
-- =============================================================================

BEGIN;

UPDATE storage.buckets
SET file_size_limit = 1048576,
    allowed_mime_types = ARRAY['image/webp']::text[]
WHERE id = 'productos-imagenes';

DROP POLICY IF EXISTS "Upload autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Update autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Upload catalogo V2" ON storage.objects;
DROP POLICY IF EXISTS "Update catalogo V2" ON storage.objects;

CREATE POLICY "Upload catalogo V2"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'productos-imagenes'
    AND noven_private.puede_insertar_imagen_catalogo_storage(name)
  );

CREATE POLICY "Update catalogo V2"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'productos-imagenes'
    AND noven_private.puede_actualizar_imagen_catalogo_storage(name)
  )
  WITH CHECK (
    bucket_id = 'productos-imagenes'
    AND noven_private.puede_actualizar_imagen_catalogo_storage(name)
  );

-- La lectura pública del bucket se conserva: las fotos de catálogo no son
-- evidencia operativa ni contienen información sensible.

COMMIT;
