-- Noven IA · imágenes globales de producto · fallback de codec
--
-- El catálogo mantiene una sola foto global por organización + producto.
-- Storage conserva el límite de 1 MB y las políticas de ruta/permisos existentes.
-- WebP sigue siendo el formato preferido; JPEG se admite únicamente como
-- fallback cuando WebKit/iOS no codifica WebP y devuelve otro MIME.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/webp', 'image/jpeg']::text[]
WHERE id = 'productos-imagenes';
