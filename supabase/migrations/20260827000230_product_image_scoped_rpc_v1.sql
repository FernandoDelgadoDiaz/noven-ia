-- =============================================================================
-- NOVEN · IMAGEN DE PRODUCTO CON SCOPE V1
--
-- Evita conceder UPDATE amplio sobre el catálogo compartido sólo para que un
-- operador pueda asociar/cambiar la foto de un SKU que gestiona.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION noven_private.actualizar_imagen_producto_operador_impl(
  p_sucursal_id uuid,
  p_producto_id uuid,
  p_imagen_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF NULLIF(btrim(COALESCE(p_imagen_url, '')), '') IS NULL THEN
    RAISE EXCEPTION 'URL de imagen obligatoria' USING ERRCODE = '22023';
  END IF;

  IF NOT noven_private.puede_ver_producto_sucursal(p_sucursal_id, p_producto_id) THEN
    RAISE EXCEPTION 'Sin permiso para modificar la imagen de este producto'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.productos p
  SET
    imagen_url = btrim(p_imagen_url),
    updated_at = pg_catalog.now()
  WHERE p.id = p_producto_id
    AND EXISTS (
      SELECT 1
      FROM public.sucursales s
      WHERE s.id = p_sucursal_id
        AND s.organizacion_id = p.organizacion_id
        AND s.activa = true
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto/sucursal incompatibles o inexistentes'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION noven_private.actualizar_imagen_producto_operador_impl(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.actualizar_imagen_producto_operador(
  p_sucursal_id uuid,
  p_producto_id uuid,
  p_imagen_url text
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.actualizar_imagen_producto_operador_impl(
    p_sucursal_id,
    p_producto_id,
    p_imagen_url
  );
$$;

REVOKE ALL ON FUNCTION public.actualizar_imagen_producto_operador(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualizar_imagen_producto_operador(uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION noven_private.actualizar_imagen_producto_operador_impl(uuid, uuid, text)
  TO authenticated;

COMMENT ON FUNCTION public.actualizar_imagen_producto_operador(uuid, uuid, text) IS
  'Permite cambiar únicamente imagen_url del producto si el usuario puede gestionar ese SKU en la sucursal.';

COMMIT;