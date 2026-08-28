-- =============================================================================
-- NOVEN · TERMINAL CLOSE OPERATIONAL QUARTER V1
--
-- El trimestre/año histórico de vendido/donación/decomiso debe pertenecer al día
-- operacional de Argentina, no a CURRENT_DATE de una sesión PostgreSQL en UTC.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.cerrar_vencimiento_operativo_invoker_v1(
  p_vencimiento_id uuid,
  p_resultado text,
  p_observaciones text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_org uuid;
  v_sucursal uuid;
  v_producto uuid;
  v_cantidad numeric;
  v_cantidad_accion integer;
  v_accion_id uuid;
  v_trimestre integer;
  v_anio integer;
  v_fecha_operativa date := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF p_resultado NOT IN ('vendido', 'donacion', 'decomiso') THEN
    RAISE EXCEPTION 'Resultado terminal inválido: %', p_resultado USING ERRCODE = '22023';
  END IF;

  SELECT p.organizacion_id, v.sucursal_id, v.producto_id, v.cantidad
    INTO v_org, v_sucursal, v_producto, v_cantidad
  FROM public.vencimientos v
  JOIN public.productos p ON p.id = v.producto_id
  WHERE v.id = p_vencimiento_id
    AND v.activo = true
  FOR UPDATE OF v;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vencimiento activo no encontrado o ya cerrado' USING ERRCODE = 'P0002';
  END IF;

  IF NOT noven_private.puede_ver_producto_sucursal(v_sucursal, v_producto) THEN
    RAISE EXCEPTION 'Sin permiso para cerrar este vencimiento' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.acciones_operativas a
    WHERE a.vencimiento_id = p_vencimiento_id
      AND a.tipo IN ('vendido', 'donacion', 'decomiso')
  ) THEN
    RAISE EXCEPTION 'El vencimiento ya tiene un resultado terminal registrado' USING ERRCODE = '23505';
  END IF;

  IF p_resultado = 'vendido' THEN
    IF COALESCE(v_cantidad, 0) > 0 THEN
      v_cantidad_accion := CEIL(v_cantidad)::integer;
    ELSE
      SELECT CEIL(o.cantidad_comprometida)::integer
        INTO v_cantidad_accion
      FROM public.vencimiento_observaciones o
      WHERE o.vencimiento_id = p_vencimiento_id
        AND o.cantidad_comprometida > 0
      ORDER BY o.observada_at DESC, o.id DESC
      LIMIT 1;

      v_cantidad_accion := COALESCE(v_cantidad_accion, 0);
    END IF;

    INSERT INTO public.vencimiento_observaciones(
      organizacion_id, sucursal_id, producto_id, vencimiento_id,
      usuario_id, cantidad_comprometida, nota
    ) VALUES (
      v_org, v_sucursal, v_producto, p_vencimiento_id,
      v_uid, 0, 'Cierre: vendido antes del vencimiento'
    );
  ELSE
    IF COALESCE(v_cantidad, 0) <= 0 THEN
      RAISE EXCEPTION 'No se puede registrar % con cantidad comprometida cero', p_resultado
        USING ERRCODE = '22023';
    END IF;
    v_cantidad_accion := CEIL(v_cantidad)::integer;
  END IF;

  v_anio := EXTRACT(YEAR FROM v_fecha_operativa)::integer;
  v_trimestre := EXTRACT(QUARTER FROM v_fecha_operativa)::integer;

  INSERT INTO public.acciones_operativas(
    tipo, cantidad, producto_id, vencimiento_id, sucursal_id,
    usuario_id, trimestre, anio, observaciones
  ) VALUES (
    p_resultado, v_cantidad_accion, v_producto, p_vencimiento_id, v_sucursal,
    v_uid, v_trimestre, v_anio, NULLIF(btrim(COALESCE(p_observaciones, '')), '')
  )
  RETURNING id INTO v_accion_id;

  UPDATE public.vencimientos
  SET cantidad = CASE WHEN p_resultado = 'vendido' THEN 0 ELSE cantidad END,
      activo = false,
      updated_at = now()
  WHERE id = p_vencimiento_id;

  RETURN v_accion_id;
END;
$$;

COMMENT ON FUNCTION public.cerrar_vencimiento_operativo_invoker_v1(uuid,text,text) IS
  'Registra resultado terminal con permisos por scope y asigna año/trimestre según fecha operacional Argentina.';

COMMIT;
