-- =============================================================================
-- NOVEN · SCANNER WRITERS PRIVADOS V1
--
-- Los RPC V1 ya validaban organización/sucursal/familia, pero eran SECURITY
-- INVOKER y por eso dependían de conceder INSERT/UPDATE directos sobre el
-- catálogo. Esta migración conserva exactamente los contratos públicos y mueve
-- la ejecución privilegiada a noven_private para poder cerrar esos grants.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Renombrar implementaciones V1. Siguen conteniendo TODAS las validaciones
-- de scope existentes; ya no serán invocables directamente por authenticated.
-- -----------------------------------------------------------------------------
ALTER FUNCTION public.vincular_ean_producto_scanner(uuid, uuid, text)
  RENAME TO vincular_ean_producto_scanner_invoker_v1;
ALTER FUNCTION public.completar_cod_art_producto_scanner(uuid, uuid, text)
  RENAME TO completar_cod_art_producto_scanner_invoker_v1;
ALTER FUNCTION public.crear_producto_scanner(uuid, text, text, text, text, text, integer, numeric, uuid)
  RENAME TO crear_producto_scanner_invoker_v1;

REVOKE ALL ON FUNCTION public.vincular_ean_producto_scanner_invoker_v1(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.completar_cod_art_producto_scanner_invoker_v1(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crear_producto_scanner_invoker_v1(uuid, text, text, text, text, text, integer, numeric, uuid)
  FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Implementaciones privadas con privilegios. auth.uid() se conserva en la
-- sesión y las funciones V1 vuelven a ejecutar scanner_org/puede_ver_* antes de
-- cada write; SECURITY DEFINER sólo evita depender de grants de tabla browser.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION noven_private.vincular_ean_producto_scanner_impl(
  p_sucursal_id uuid,
  p_producto_id uuid,
  p_ean text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  RETURN public.vincular_ean_producto_scanner_invoker_v1(
    p_sucursal_id,
    p_producto_id,
    p_ean
  );
END;
$$;

CREATE OR REPLACE FUNCTION noven_private.completar_cod_art_producto_scanner_impl(
  p_sucursal_id uuid,
  p_producto_id uuid,
  p_cod_art text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  RETURN public.completar_cod_art_producto_scanner_invoker_v1(
    p_sucursal_id,
    p_producto_id,
    p_cod_art
  );
END;
$$;

CREATE OR REPLACE FUNCTION noven_private.crear_producto_scanner_impl(
  p_sucursal_id uuid,
  p_cod_art text,
  p_ean text,
  p_descripcion text,
  p_marca text,
  p_categoria text,
  p_stock_actual integer,
  p_venta_media_diaria numeric,
  p_familia_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  RETURN public.crear_producto_scanner_invoker_v1(
    p_sucursal_id,
    p_cod_art,
    p_ean,
    p_descripcion,
    p_marca,
    p_categoria,
    p_stock_actual,
    p_venta_media_diaria,
    p_familia_id
  );
END;
$$;

REVOKE ALL ON FUNCTION noven_private.vincular_ean_producto_scanner_impl(uuid, uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION noven_private.completar_cod_art_producto_scanner_impl(uuid, uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION noven_private.crear_producto_scanner_impl(uuid, text, text, text, text, text, integer, numeric, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.vincular_ean_producto_scanner_impl(uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION noven_private.completar_cod_art_producto_scanner_impl(uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION noven_private.crear_producto_scanner_impl(uuid, text, text, text, text, text, integer, numeric, uuid)
  TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Contratos públicos idénticos para el frontend.
-- -----------------------------------------------------------------------------
CREATE FUNCTION public.vincular_ean_producto_scanner(
  p_sucursal_id uuid,
  p_producto_id uuid,
  p_ean text
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.vincular_ean_producto_scanner_impl(
    p_sucursal_id,
    p_producto_id,
    p_ean
  );
$$;

CREATE FUNCTION public.completar_cod_art_producto_scanner(
  p_sucursal_id uuid,
  p_producto_id uuid,
  p_cod_art text
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.completar_cod_art_producto_scanner_impl(
    p_sucursal_id,
    p_producto_id,
    p_cod_art
  );
$$;

CREATE FUNCTION public.crear_producto_scanner(
  p_sucursal_id uuid,
  p_cod_art text,
  p_ean text,
  p_descripcion text,
  p_marca text,
  p_categoria text,
  p_stock_actual integer,
  p_venta_media_diaria numeric,
  p_familia_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.crear_producto_scanner_impl(
    p_sucursal_id,
    p_cod_art,
    p_ean,
    p_descripcion,
    p_marca,
    p_categoria,
    p_stock_actual,
    p_venta_media_diaria,
    p_familia_id
  );
$$;

REVOKE ALL ON FUNCTION public.vincular_ean_producto_scanner(uuid, uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.completar_cod_art_producto_scanner(uuid, uuid, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crear_producto_scanner(uuid, text, text, text, text, text, integer, numeric, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vincular_ean_producto_scanner(uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.completar_cod_art_producto_scanner(uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_producto_scanner(uuid, text, text, text, text, text, integer, numeric, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.vincular_ean_producto_scanner(uuid, uuid, text) IS
  'Scanner: contrato público; write privilegiado vive en noven_private y revalida scope.';
COMMENT ON FUNCTION public.completar_cod_art_producto_scanner(uuid, uuid, text) IS
  'Scanner: contrato público; write privilegiado vive en noven_private y revalida scope.';
COMMENT ON FUNCTION public.crear_producto_scanner(uuid, text, text, text, text, text, integer, numeric, uuid) IS
  'Scanner: alta catálogo+estado local sin grants directos de INSERT/UPDATE al browser.';

COMMIT;