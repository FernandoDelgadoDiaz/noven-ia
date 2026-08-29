-- Permite reabrir el MISMO archivo 0258 que fue importado antes de que existiera
-- la trazabilidad específica. No reaplica stock/VMD: sólo corrige la fuente y
-- persiste los campos adicionales del mismo archivo (costos, períodos, tránsito).

CREATE OR REPLACE FUNCTION public.aplicar_importacion_0258_familia_v1(
  p_sucursal_id uuid,
  p_usuario_id uuid,
  p_codigo_sucursal_fuente text,
  p_codigo_familia text,
  p_nombre_archivo text,
  p_archivo_sha256 text,
  p_filas_total integer,
  p_filas_validas integer,
  p_filas_descartadas integer,
  p_operaciones jsonb,
  p_detalle_items jsonb,
  p_fecha_reporte date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_result jsonb;
  v_importacion_id uuid;
  v_existente_id uuid;
  v_existente_estado text;
BEGIN
  IF NOT public.validar_operacion_local_server_v1(p_usuario_id, p_sucursal_id) THEN
    RAISE EXCEPTION 'El usuario no tiene permiso operativo para importar esta familia en la sucursal'
      USING ERRCODE = '42501';
  END IF;

  SELECT i.id, i.estado INTO v_existente_id, v_existente_estado
  FROM public.importaciones i
  WHERE i.sucursal_id = p_sucursal_id
    AND i.tipo_reporte = 'glaciar_0258'
    AND i.archivo_sha256 = p_archivo_sha256;

  IF v_existente_id IS NOT NULL THEN
    PERFORM noven_private.persistir_detalle_0258_v1(v_existente_id, p_sucursal_id, p_detalle_items);
    RETURN jsonb_build_object('duplicada', true, 'importacion_id', v_existente_id, 'estado', v_existente_estado, 'fuente', 'glaciar_0258', 'detalle_enriquecido', true);
  END IF;

  v_result := public.aplicar_importacion_glaciar_familia_v1(
    p_sucursal_id, p_usuario_id, p_codigo_sucursal_fuente, p_codigo_familia,
    p_nombre_archivo, p_archivo_sha256, p_filas_total, p_filas_validas,
    p_filas_descartadas, p_operaciones, p_fecha_reporte
  );

  v_importacion_id := NULLIF(v_result->>'importacion_id', '')::uuid;
  IF v_importacion_id IS NULL THEN
    RAISE EXCEPTION 'La importación no devolvió identidad trazable';
  END IF;

  IF COALESCE((v_result->>'duplicada')::boolean, false) THEN
    -- Antes de este cambio, un 0258 se registraba como reposicion_asistida.
    -- El SHA prueba que es exactamente el mismo archivo que acaba de parsearse
    -- como 0258; no se reejecuta la importación principal.
    UPDATE public.importaciones
    SET tipo_reporte = 'glaciar_0258'
    WHERE id = v_importacion_id
      AND sucursal_id = p_sucursal_id
      AND archivo_sha256 = p_archivo_sha256
      AND tipo_reporte = 'reposicion_asistida';

    PERFORM noven_private.persistir_detalle_0258_v1(v_importacion_id, p_sucursal_id, p_detalle_items);
    RETURN v_result || jsonb_build_object('fuente', 'glaciar_0258', 'detalle_enriquecido', true);
  END IF;

  UPDATE public.importaciones
  SET tipo_reporte = 'glaciar_0258'
  WHERE id = v_importacion_id;

  PERFORM noven_private.persistir_detalle_0258_v1(v_importacion_id, p_sucursal_id, p_detalle_items);
  RETURN v_result || jsonb_build_object('fuente', 'glaciar_0258');
END;
$function$;

CREATE OR REPLACE FUNCTION public.aplicar_importacion_0258_masiva_v1(
  p_sucursal_id uuid,
  p_usuario_id uuid,
  p_codigo_sucursal_fuente text,
  p_nombre_archivo text,
  p_archivo_sha256 text,
  p_filas_total integer,
  p_filas_validas integer,
  p_filas_descartadas integer,
  p_items jsonb,
  p_detalle_items jsonb,
  p_fecha_reporte date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_result jsonb;
  v_importacion_id uuid;
  v_existente_id uuid;
  v_existente_estado text;
BEGIN
  IF NOT public.validar_operacion_local_server_v1(p_usuario_id, p_sucursal_id) THEN
    RAISE EXCEPTION 'El usuario no tiene permiso operativo para importar en la sucursal'
      USING ERRCODE = '42501';
  END IF;

  SELECT i.id, i.estado INTO v_existente_id, v_existente_estado
  FROM public.importaciones i
  WHERE i.sucursal_id = p_sucursal_id
    AND i.tipo_reporte = 'glaciar_0258'
    AND i.archivo_sha256 = p_archivo_sha256;

  IF v_existente_id IS NOT NULL THEN
    PERFORM noven_private.persistir_detalle_0258_v1(v_existente_id, p_sucursal_id, p_detalle_items);
    RETURN jsonb_build_object('duplicada', true, 'importacion_id', v_existente_id, 'estado', v_existente_estado, 'fuente', 'glaciar_0258', 'detalle_enriquecido', true);
  END IF;

  v_result := public.aplicar_importacion_glaciar_masiva_v2(
    p_sucursal_id, p_usuario_id, p_codigo_sucursal_fuente, p_nombre_archivo,
    p_archivo_sha256, p_filas_total, p_filas_validas, p_filas_descartadas,
    p_items, p_fecha_reporte
  );

  v_importacion_id := NULLIF(v_result->>'importacion_id', '')::uuid;
  IF v_importacion_id IS NULL THEN
    RAISE EXCEPTION 'La importación no devolvió identidad trazable';
  END IF;

  IF COALESCE((v_result->>'duplicada')::boolean, false) THEN
    UPDATE public.importaciones
    SET tipo_reporte = 'glaciar_0258'
    WHERE id = v_importacion_id
      AND sucursal_id = p_sucursal_id
      AND archivo_sha256 = p_archivo_sha256
      AND tipo_reporte = 'reposicion_asistida';

    PERFORM noven_private.persistir_detalle_0258_v1(v_importacion_id, p_sucursal_id, p_detalle_items);
    RETURN v_result || jsonb_build_object('fuente', 'glaciar_0258', 'detalle_enriquecido', true);
  END IF;

  UPDATE public.importaciones
  SET tipo_reporte = 'glaciar_0258'
  WHERE id = v_importacion_id;

  PERFORM noven_private.persistir_detalle_0258_v1(v_importacion_id, p_sucursal_id, p_detalle_items);
  RETURN v_result || jsonb_build_object('fuente', 'glaciar_0258');
END;
$function$;

REVOKE ALL ON FUNCTION public.aplicar_importacion_0258_familia_v1(uuid, uuid, text, text, text, text, integer, integer, integer, jsonb, jsonb, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aplicar_importacion_0258_masiva_v1(uuid, uuid, text, text, text, integer, integer, integer, jsonb, jsonb, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_importacion_0258_familia_v1(uuid, uuid, text, text, text, text, integer, integer, integer, jsonb, jsonb, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.aplicar_importacion_0258_masiva_v1(uuid, uuid, text, text, text, integer, integer, integer, jsonb, jsonb, date) TO service_role;
