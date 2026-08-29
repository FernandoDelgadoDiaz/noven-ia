-- EAN global colaborativo: un SKU puede aprender varios EAN por escaneo.
-- La UNIQUE existente (organizacion_id, codigo) sigue impidiendo que un mismo
-- EAN quede asociado silenciosamente a dos productos de la organización.
-- productos.codigo_barras se conserva como espejo compatible del primer EAN.

CREATE OR REPLACE FUNCTION public.vincular_ean_producto_scanner_invoker_v1(
  p_sucursal_id uuid,
  p_producto_id uuid,
  p_ean text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$
DECLARE
  v_org uuid := noven_private.scanner_org(p_sucursal_id);
  v_ean text := btrim(p_ean);
  v_codigo_actual text;
  v_conflicto jsonb;
  v_tipo text;
  v_tiene_codigo_activo boolean;
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

  -- Reescanear un EAN ya aprendido por este mismo producto es idempotente.
  IF EXISTS (
    SELECT 1
    FROM public.producto_codigos pc
    WHERE pc.organizacion_id = v_org
      AND pc.producto_id = p_producto_id
      AND pc.codigo = v_ean
      AND pc.activo = true
  ) OR btrim(COALESCE(v_codigo_actual, '')) = v_ean THEN
    RETURN noven_private.scanner_producto_json(p_producto_id, p_sucursal_id);
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

  SELECT EXISTS (
    SELECT 1
    FROM public.producto_codigos pc
    WHERE pc.organizacion_id = v_org
      AND pc.producto_id = p_producto_id
      AND pc.activo = true
  ) INTO v_tiene_codigo_activo;

  v_tipo := CASE length(v_ean)
    WHEN 8 THEN 'ean8'
    WHEN 12 THEN 'upca'
    WHEN 13 THEN 'ean13'
    WHEN 14 THEN 'gtin14'
    ELSE 'otro'
  END;

  -- Sin ON CONFLICT: si otra transacción tomó el mismo EAN después del chequeo,
  -- la UNIQUE (organizacion_id, codigo) aborta la transacción completa.
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
    NOT v_tiene_codigo_activo,
    true
  );

  -- Sólo el primer EAN llena el campo legacy de compatibilidad. Los aliases
  -- posteriores viven en producto_codigos y no reemplazan la identidad principal.
  IF NULLIF(btrim(COALESCE(v_codigo_actual, '')), '') IS NULL THEN
    UPDATE public.productos
    SET codigo_barras = v_ean,
        updated_at = now()
    WHERE id = p_producto_id
      AND organizacion_id = v_org
      AND NULLIF(btrim(COALESCE(codigo_barras, '')), '') IS NULL;
  END IF;

  RETURN noven_private.scanner_producto_json(p_producto_id, p_sucursal_id);
END;
$function$;
