-- =============================================================================
-- NOVEN · SCANNER ESTADO LOCAL POR SUCURSAL V1
--
-- El Scanner deja de escribir stock_actual en `productos` (catálogo global).
-- El estado de stock vive en `producto_sucursal` y se actualiza mediante un RPC
-- que deriva organización/scope en PostgreSQL.
-- =============================================================================

BEGIN;

-- Implementación privada con privilegios de escritura. No está expuesta por
-- PostgREST; el wrapper público invoker de abajo es el único contrato browser.
CREATE OR REPLACE FUNCTION noven_private.upsert_stock_producto_sucursal_scanner(
  p_sucursal_id uuid,
  p_producto_id uuid,
  p_stock_actual integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, noven_private, pg_temp
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_org uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF p_stock_actual IS NULL OR p_stock_actual < 0 THEN
    RAISE EXCEPTION 'Stock inválido' USING ERRCODE = '22023';
  END IF;

  SELECT s.organizacion_id
  INTO v_org
  FROM public.sucursales s
  JOIN public.productos p
    ON p.organizacion_id = s.organizacion_id
   AND p.id = p_producto_id
  WHERE s.id = p_sucursal_id
    AND s.activa = true;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Producto/sucursal incompatibles o inexistentes'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT noven_private.puede_ver_producto_sucursal(p_sucursal_id, p_producto_id) THEN
    RAISE EXCEPTION 'Sin permiso para actualizar este producto en la sucursal'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.producto_sucursal (
    organizacion_id,
    producto_id,
    sucursal_id,
    stock_actual,
    venta_media_diaria
  )
  VALUES (
    v_org,
    p_producto_id,
    p_sucursal_id,
    p_stock_actual,
    0
  )
  ON CONFLICT (producto_id, sucursal_id)
  DO UPDATE SET
    stock_actual = EXCLUDED.stock_actual,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION noven_private.upsert_stock_producto_sucursal_scanner(uuid, uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.upsert_stock_producto_sucursal_scanner(uuid, uuid, integer)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.actualizar_stock_producto_sucursal_scanner(
  p_sucursal_id uuid,
  p_producto_id uuid,
  p_stock_actual integer
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, noven_private, pg_temp
AS $$
  SELECT noven_private.upsert_stock_producto_sucursal_scanner(
    p_sucursal_id,
    p_producto_id,
    p_stock_actual
  );
$$;

REVOKE ALL ON FUNCTION public.actualizar_stock_producto_sucursal_scanner(uuid, uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualizar_stock_producto_sucursal_scanner(uuid, uuid, integer)
  TO authenticated;

COMMENT ON FUNCTION public.actualizar_stock_producto_sucursal_scanner(uuid, uuid, integer) IS
  'Scanner: actualiza/crea stock local SKU×sucursal sin modificar el catálogo global productos.';

COMMIT;
