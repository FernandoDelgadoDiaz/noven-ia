-- ============================================================
-- 20260523000000_add_gramaje_to_productos.sql
-- Agrega columna gramaje (text, nullable) a la tabla productos
-- ============================================================

ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS gramaje text;
