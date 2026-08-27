-- Reproducción histórica segura.
--
-- Esta versión ya figura como aplicada en producción. En entornos nuevos no puede
-- crear todavía la FK porque `public.familias` nace en la migración siguiente
-- (20260525100000). Agregamos sólo la columna aquí; la integridad definitiva queda
-- impuesta por `productos_familia_organizacion_fk` en la fase multitenant.
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS familia_id uuid;
