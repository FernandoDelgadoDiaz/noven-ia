-- =============================================================================
-- NOVEN · SCANNER · CATÁLOGO GLOBAL MISSING-ONLY V1
--
-- El Scanner puede enriquecer un producto global cuando falta Cod.Art. o EAN.
-- No es un editor global de códigos existentes. Las correcciones/reemplazos de
-- identidad requieren un flujo de catálogo explícito y no una llamada manual a
-- estas RPC de enriquecimiento.
--
-- La vinculación EAN también elimina el ON CONFLICT reactivo: la restricción
-- UNIQUE de (organizacion_id,codigo) debe abortar una carrera concurrente en vez
-- de permitir que el campo principal apunte a un código perteneciente a otro SKU.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.completar_cod_art_producto_scanner_invoker_v1(
  p_sucursal_id uuid,
  p_producto_id uuid,
  p_cod_art text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $$
DECLARE
  v_org uuid := noven_private.scanner_org(p_sucursal_id);
  v_cod text := btrim(p_cod_art);
  v_cod_actual text;
  v_conflicto jsonb;
BEGIN
  IF v_cod !~ '^[0-9]{7}$' THEN
    RAISE EXCEPTION 'Código interno inválido' USING ERRCODE = '22023';
  END IF;

  SELECT p.cod_art
    INTO v_cod_actual
  FROM public.productos p
  WHERE p.id = p_producto_id
    AND p.organizacion_id = v_org;

  IF NOT FOUND
     OR NOT noven_private.puede_ver_producto_sucursal(p_sucursal_id, p_producto_id) THEN
    RAISE EXCEPTION 'Producto fuera del alcance' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(COALESCE(v_cod_actual, '')), '') IS NOT NULL THEN
    RAISE EXCEPTION 'El producto ya tiene código interno; la corrección requiere el flujo de catálogo'
      USING ERRCODE = '42501';
  END IF;

  v_conflicto := public.buscar_conflicto_codigos_scanner(
    p_sucursal_id,
    v_cod,
    '',
    p_producto_id
  );
  IF v_conflicto IS NOT NULL THEN
    RAISE EXCEPTION 'Código interno ocupado por otro producto: %', v_conflicto::text
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.productos
  SET cod_art = v_cod,
      updated_at = now()
  WHERE id = p_producto_id
    AND organizacion_id = v_org
    AND NULLIF(btrim(COALESCE(cod_art, '')), '') IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El código interno fue completado por otra operación. Volvé a cargar el producto.'
      USING ERRCODE = '40001';
  END IF;

  RETURN noven_private.scanner_producto_json(p_producto_id, p_sucursal_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.vincular_ean_producto_scanner_invoker_v1(
  p_sucursal_id uuid,
  p_producto_id uuid,
  p_ean text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $$
DECLARE
  v_org uuid := noven_private.scanner_org(p_sucursal_id);
  v_ean text := btrim(p_ean);
  v_codigo_actual text;
  v_conflicto jsonb;
  v_tipo text;
BEGIN
  IF v_ean !~ '^(?:[0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$' THEN
    RAISE EXCEPTION 'EAN inválido' USING ERRCODE = '22023';
  END IF;

  SELECT p.codigo_barras
    INTO v_codigo_actual
  FROM public.productos p
  WHERE p.id = p_producto_id
    AND p.organizacion_id = v_org;

  IF NOT FOUND
     OR NOT noven_private.puede_ver_producto_sucursal(p_sucursal_id, p_producto_id) THEN
    RAISE EXCEPTION 'Producto fuera del alcance' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(COALESCE(v_codigo_actual, '')), '') IS NOT NULL
     OR EXISTS (
       SELECT 1
       FROM public.producto_codigos pc
       WHERE pc.organizacion_id = v_org
         AND pc.producto_id = p_producto_id
         AND pc.activo = true
     ) THEN
    RAISE EXCEPTION 'El producto ya tiene EAN; la corrección o incorporación de aliases requiere el flujo de catálogo'
      USING ERRCODE = '42501';
  END IF;

  v_conflicto := public.buscar_conflicto_codigos_scanner(
    p_sucursal_id,
    '',
    v_ean,
    p_producto_id
  );
  IF v_conflicto IS NOT NULL THEN
    RAISE EXCEPTION 'EAN ocupado por otro producto: %', v_conflicto::text
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.productos
  SET codigo_barras = v_ean,
      updated_at = now()
  WHERE id = p_producto_id
    AND organizacion_id = v_org
    AND NULLIF(btrim(COALESCE(codigo_barras, '')), '') IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El EAN fue completado por otra operación. Volvé a cargar el producto.'
      USING ERRCODE = '40001';
  END IF;

  v_tipo := CASE length(v_ean)
    WHEN 8 THEN 'ean8'
    WHEN 12 THEN 'upca'
    WHEN 13 THEN 'ean13'
    WHEN 14 THEN 'gtin14'
    ELSE 'otro'
  END;

  -- Sin ON CONFLICT: si otra transacción tomó el mismo EAN después del chequeo,
  -- la UNIQUE debe abortar la transacción completa, incluido el UPDATE anterior.
  INSERT INTO public.producto_codigos(
    organizacion_id,
    producto_id,
    codigo,
    tipo,
    es_principal,
    activo
  ) VALUES (
    v_org,
    p_producto_id,
    v_ean,
    v_tipo,
    true,
    true
  );

  RETURN noven_private.scanner_producto_json(p_producto_id, p_sucursal_id);
END;
$$;

COMMIT;
