-- =============================================================================
-- MULTITENANT V1 · FASE 3B — vistas operativas + scope de familia en inventario
--
-- Corrige un punto de mínimo privilegio: tener acceso a una sucursal NO implica
-- que un operador pueda leer el stock/VMD de todas sus familias. Gerentes y
-- supervisores sí ven toda la sucursal; operadores quedan acotados a sus familias.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Helper privado: ¿puede el usuario ver este producto en esta sucursal?
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION noven_private.puede_ver_producto_sucursal(
  p_sucursal_id uuid,
  p_producto_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, noven_private, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.productos p
    JOIN public.sucursales s
      ON s.id = p_sucursal_id
     AND s.organizacion_id = p.organizacion_id
    WHERE p.id = p_producto_id
      AND p.familia_id IS NOT NULL
      AND noven_private.puede_ver_familia_sucursal(p_sucursal_id, p.familia_id)
  );
$$;

REVOKE ALL ON FUNCTION noven_private.puede_ver_producto_sucursal(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.puede_ver_producto_sucursal(uuid, uuid)
  TO authenticated;

DROP POLICY IF EXISTS producto_sucursal_select_scope ON public.producto_sucursal;
CREATE POLICY producto_sucursal_select_scope
  ON public.producto_sucursal
  FOR SELECT
  TO authenticated
  USING (noven_private.puede_ver_producto_sucursal(sucursal_id, producto_id));

-- -----------------------------------------------------------------------------
-- 2. Vista catálogo: deliberadamente SIN stock ni venta media
--
-- Este será el contrato de lectura del catálogo compartido. Evita que una futura
-- sucursal consuma accidentalmente las columnas legacy de estado que todavía
-- permanecen en `productos` durante la transición de 091.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_productos_catalogo
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.organizacion_id,
  p.cod_art,
  p.codigo_barras,
  p.descripcion,
  p.marca,
  p.gramaje,
  p.categoria,
  p.proveedor,
  p.sector,
  p.precio_costo,
  p.imagen_url,
  p.familia_id,
  p.activo,
  p.created_at,
  p.updated_at
FROM public.productos p;

REVOKE ALL ON TABLE public.v_productos_catalogo FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.v_productos_catalogo TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Vista operativa: catálogo + estado de UNA sucursal
--
-- La fila conductora es producto_sucursal, por lo que su RLS filtra primero el
-- scope de sucursal/familia. La vista nunca usa stock_actual/VMD legacy.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_producto_sucursal_operativo
WITH (security_invoker = true)
AS
SELECT
  ps.id AS producto_sucursal_id,
  ps.organizacion_id,
  ps.sucursal_id,
  ps.producto_id,
  p.cod_art,
  p.codigo_barras,
  p.descripcion,
  p.marca,
  p.gramaje,
  p.categoria,
  p.proveedor,
  p.sector,
  p.precio_costo,
  p.imagen_url,
  p.familia_id,
  p.activo,
  ps.stock_actual,
  ps.venta_media_diaria,
  ps.fecha_ultima_importacion,
  ps.updated_at AS estado_updated_at
FROM public.producto_sucursal ps
JOIN public.productos p
  ON p.id = ps.producto_id
 AND p.organizacion_id = ps.organizacion_id;

REVOKE ALL ON TABLE public.v_producto_sucursal_operativo FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.v_producto_sucursal_operativo TO authenticated;

COMMENT ON VIEW public.v_productos_catalogo IS
  'Contrato de catálogo compartido; excluye explícitamente stock y VMD legacy.';
COMMENT ON VIEW public.v_producto_sucursal_operativo IS
  'Contrato operativo SKU × sucursal con estado aislado y filtrado por RLS.';

COMMIT;
