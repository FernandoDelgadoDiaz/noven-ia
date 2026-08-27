-- =============================================================================
-- NOVEN · APRENDIZAJE DE PENDIENTES DESDE CSV FILTRADO V1
--
-- Un reporte Glaciar filtrado por familia funciona como evidencia autoritativa:
-- todos los cod_art pendientes presentes en ese archivo se clasifican juntos con
-- la Cód.Familia del reporte. La resolución sigue siendo global por organización.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.resolver_pendientes_catalogo_por_familia_csv(
  p_sucursal_id uuid,
  p_usuario_id uuid,
  p_codigo_sucursal_fuente text,
  p_codigo_familia text,
  p_cod_arts jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_org_id uuid;
  v_zona_id uuid;
  v_codigo_sucursal text;
  v_familia_id uuid;
  v_pendiente record;
  v_resultado jsonb;
  v_resueltos integer := 0;
  v_ya_resueltos integer := 0;
  v_sucursales_afectadas integer := 0;
BEGIN
  IF p_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario requerido';
  END IF;

  IF p_cod_arts IS NULL OR jsonb_typeof(p_cod_arts) <> 'array' THEN
    RAISE EXCEPTION 'p_cod_arts debe ser un array JSON';
  END IF;

  SELECT s.organizacion_id, s.zona_id, s.codigo
  INTO v_org_id, v_zona_id, v_codigo_sucursal
  FROM public.sucursales s
  WHERE s.id = p_sucursal_id
    AND s.activa = true;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Sucursal inexistente o inactiva';
  END IF;

  IF btrim(COALESCE(p_codigo_sucursal_fuente, '')) <> v_codigo_sucursal THEN
    RAISE EXCEPTION
      'El archivo corresponde a la sucursal %, pero la sesión intenta aprender desde %',
      p_codigo_sucursal_fuente,
      v_codigo_sucursal;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuario_accesos ua
    WHERE ua.usuario_id = p_usuario_id
      AND ua.organizacion_id = v_org_id
      AND ua.activo = true
      AND ua.rol <> 'operador'
      AND (
        ua.rol = 'admin_organizacion'
        OR (ua.rol = 'gerente_zonal' AND ua.zona_id = v_zona_id)
        OR (ua.rol IN ('gerente_sucursal', 'supervisor') AND ua.sucursal_id = p_sucursal_id)
      )
  ) THEN
    RAISE EXCEPTION 'El usuario no tiene alcance para aprender catálogo desde esta sucursal';
  END IF;

  SELECT f.id INTO v_familia_id
  FROM public.familias f
  WHERE f.organizacion_id = v_org_id
    AND f.codigo = btrim(p_codigo_familia);

  IF v_familia_id IS NULL THEN
    RAISE EXCEPTION 'La familia % no existe en la organización', p_codigo_familia;
  END IF;

  FOR v_pendiente IN
    WITH codigos AS (
      SELECT DISTINCT btrim(value #>> '{}') AS cod_art
      FROM jsonb_array_elements(p_cod_arts)
      WHERE jsonb_typeof(value) = 'string'
        AND btrim(value #>> '{}') <> ''
    )
    SELECT pp.id, pp.cod_art
    FROM public.productos_pendientes_catalogo pp
    JOIN codigos c ON c.cod_art = pp.cod_art
    WHERE pp.organizacion_id = v_org_id
      AND pp.estado = 'pendiente'
    ORDER BY pp.cod_art
  LOOP
    SELECT public.resolver_producto_pendiente_catalogo(
      v_pendiente.id,
      v_familia_id,
      p_usuario_id
    ) INTO v_resultado;

    IF COALESCE((v_resultado->>'ya_resuelto')::boolean, false) THEN
      v_ya_resueltos := v_ya_resueltos + 1;
    ELSE
      v_resueltos := v_resueltos + 1;
      v_sucursales_afectadas := v_sucursales_afectadas
        + COALESCE((v_resultado->>'sucursales_afectadas')::integer, 0);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'familia_id', v_familia_id,
    'codigo_familia', btrim(p_codigo_familia),
    'resueltos', v_resueltos,
    'ya_resueltos', v_ya_resueltos,
    'sucursales_afectadas', v_sucursales_afectadas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolver_pendientes_catalogo_por_familia_csv(
  uuid, uuid, text, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_pendientes_catalogo_por_familia_csv(
  uuid, uuid, text, text, jsonb
) TO service_role;

COMMENT ON FUNCTION public.resolver_pendientes_catalogo_por_familia_csv(
  uuid, uuid, text, text, jsonb
) IS
  'Server-only: clasifica en bloque pendientes globales usando la Cód.Familia verificada de un reporte Glaciar filtrado.';

COMMIT;
