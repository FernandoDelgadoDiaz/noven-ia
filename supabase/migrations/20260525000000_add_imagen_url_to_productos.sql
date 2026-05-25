-- ============================================================
-- 20260525000000_add_imagen_url_to_productos.sql
-- Agrega columna imagen_url (text, nullable) a la tabla productos
-- ============================================================

ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS imagen_url text;
