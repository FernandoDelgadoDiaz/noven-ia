-- =============================================================================
-- NOVEN · RADAR ZONAL · ALCANCE ACTUAL DEL OPERADOR V1
--
-- Una alerta puede haber sido asignada cuando el usuario era responsable de una
-- familia. La bandeja y cualquier respuesta deben revalidar el alcance ACTUAL:
-- perfil activo + acceso operador activo + familia activa en la sucursal.
-- Así retirar una responsabilidad corta inmediatamente la capacidad de actuar,
-- incluso si el cliente conserva un destino_id antiguo.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION noven_private.listar_mis_alertas_zonales_v1_impl(
  p_sucursal_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT COALESCE(jsonb_agg(item ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'destino_id', d.id,
        'alerta_id', a.id,
        'estado', d.estado,
        'producto_id', a.producto_id,
        'cod_art', p.cod_art,
        'codigo_barras', p.codigo_barras,
        'descripcion', p.descripcion,
        'marca', p.marca,
        'gramaje', p.gramaje,
        'imagen_thumb_url', p.imagen_thumb_url,
        'familia_id', a.familia_id,
        'fecha_vencimiento', a.fecha_vencimiento,
        'nivel_origen', a.nivel_origen,
        'sucursal_origen_id', a.sucursal_origen_id,
        'sucursal_origen_codigo', so.codigo,
        'sucursal_origen_nombre', so.nombre,
        'sucursal_destino_id', d.sucursal_id,
        'sucursal_destino_codigo', sd.codigo,
        'stock_snapshot', d.stock_snapshot,
        'stock_actual', COALESCE(ps.stock_actual, d.stock_snapshot),
        'stock_actualizado_at', COALESCE(ps.fecha_ultima_importacion, d.stock_actualizado_at),
        'created_at', d.created_at
      ) AS item,
      d.created_at
    FROM public.alertas_zonales_destinos d
    JOIN public.alertas_zonales a ON a.id = d.alerta_id
    JOIN public.productos p ON p.id = a.producto_id
    JOIN public.sucursales so ON so.id = a.sucursal_origen_id
    JOIN public.sucursales sd ON sd.id = d.sucursal_id
    LEFT JOIN public.producto_sucursal ps
      ON ps.producto_id = a.producto_id
     AND ps.sucursal_id = d.sucursal_id
     AND ps.organizacion_id = d.organizacion_id
    WHERE d.usuario_id = v_uid
      AND d.estado IN ('pendiente','revisar_despues')
      AND (p_sucursal_id IS NULL OR d.sucursal_id = p_sucursal_id)
      AND EXISTS (
        SELECT 1
        FROM public.usuarios u
        JOIN public.usuario_accesos ua
          ON ua.usuario_id = u.id
         AND ua.organizacion_id = d.organizacion_id
         AND ua.sucursal_id = d.sucursal_id
         AND ua.rol = 'operador'
         AND ua.activo = true
        JOIN public.usuario_familias_sucursal ufs
          ON ufs.usuario_id = u.id
         AND ufs.organizacion_id = d.organizacion_id
         AND ufs.sucursal_id = d.sucursal_id
         AND ufs.familia_id = a.familia_id
         AND ufs.activo = true
        WHERE u.id = v_uid
          AND u.activo = true
      )
  ) q;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION noven_private.listar_mis_alertas_zonales_v1_impl(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.listar_mis_alertas_zonales_v1_impl(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION noven_private.responder_alerta_zonal_v1_impl(
  p_destino_id uuid,
  p_respuesta text,
  p_cantidad integer DEFAULT NULL,
  p_fecha_otra date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_dest public.alertas_zonales_destinos%ROWTYPE;
  v_alerta public.alertas_zonales%ROWTYPE;
  v_vencimiento_existente uuid;
  v_vencimiento_nuevo uuid;
  v_fecha date;
  v_estado text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF p_respuesta NOT IN ('misma_fecha','otra_fecha','no_lo_tengo','revisar_despues') THEN
    RAISE EXCEPTION 'Respuesta de Radar Zonal inválida' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_dest
  FROM public.alertas_zonales_destinos
  WHERE id = p_destino_id
  FOR UPDATE;

  IF v_dest.id IS NULL THEN
    RAISE EXCEPTION 'Alerta zonal inexistente' USING ERRCODE = 'P0002';
  END IF;

  IF v_dest.usuario_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'La alerta no está asignada a este operador' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_alerta
  FROM public.alertas_zonales
  WHERE id = v_dest.alerta_id;

  IF v_alerta.id IS NULL THEN
    RAISE EXCEPTION 'Alerta zonal inexistente' USING ERRCODE = 'P0002';
  END IF;

  -- La asignación histórica no alcanza: el operador debe conservar HOY su
  -- cuenta, acceso local y familia responsable. Este gate ocurre antes de
  -- cualquier retorno o UPDATE, incluso para no_lo_tengo/revisar_despues.
  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.organizacion_id = v_dest.organizacion_id
     AND ua.sucursal_id = v_dest.sucursal_id
     AND ua.rol = 'operador'
     AND ua.activo = true
    JOIN public.usuario_familias_sucursal ufs
      ON ufs.usuario_id = u.id
     AND ufs.organizacion_id = v_dest.organizacion_id
     AND ufs.sucursal_id = v_dest.sucursal_id
     AND ufs.familia_id = v_alerta.familia_id
     AND ufs.activo = true
    WHERE u.id = v_uid
      AND u.activo = true
  ) THEN
    RAISE EXCEPTION 'Ya no tenés responsabilidad activa sobre esta familia en la sucursal'
      USING ERRCODE = '42501';
  END IF;

  IF v_dest.estado NOT IN ('pendiente','revisar_despues') THEN
    RETURN jsonb_build_object('estado', v_dest.estado, 'ya_resuelta', true);
  END IF;

  IF p_respuesta = 'revisar_despues' THEN
    UPDATE public.alertas_zonales_destinos
    SET estado = 'revisar_despues', updated_at = now()
    WHERE id = p_destino_id;
    RETURN jsonb_build_object('estado', 'revisar_despues');
  END IF;

  IF p_respuesta = 'no_lo_tengo' THEN
    UPDATE public.alertas_zonales_destinos
    SET estado = 'no_lo_tengo', respuesta_at = now(), updated_at = now()
    WHERE id = p_destino_id;
    RETURN jsonb_build_object('estado', 'no_lo_tengo');
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad comprometida debe ser mayor a cero' USING ERRCODE = '22023';
  END IF;

  IF p_respuesta = 'otra_fecha' AND p_fecha_otra IS NULL THEN
    RAISE EXCEPTION 'La nueva fecha de vencimiento es obligatoria' USING ERRCODE = '22023';
  END IF;

  v_fecha := CASE
    WHEN p_respuesta = 'misma_fecha' THEN v_alerta.fecha_vencimiento
    ELSE p_fecha_otra
  END;

  SELECT v.id INTO v_vencimiento_existente
  FROM public.vencimientos v
  WHERE v.producto_id = v_alerta.producto_id
    AND v.sucursal_id = v_dest.sucursal_id
    AND v.activo = true
  ORDER BY v.created_at DESC NULLS LAST, v.id
  LIMIT 1;

  IF v_vencimiento_existente IS NOT NULL THEN
    UPDATE public.alertas_zonales_destinos
    SET estado = 'ya_controlado',
        respuesta_at = now(),
        vencimiento_destino_id = v_vencimiento_existente,
        updated_at = now()
    WHERE id = p_destino_id;

    RETURN jsonb_build_object(
      'estado', 'ya_controlado',
      'vencimiento_id', v_vencimiento_existente,
      'ya_resuelta', true
    );
  END IF;

  SELECT noven_private.crear_vencimiento_operador_impl(
    v_alerta.producto_id,
    v_dest.sucursal_id,
    p_cantidad,
    v_fecha,
    NULL
  ) INTO v_vencimiento_nuevo;

  v_estado := CASE
    WHEN v_fecha = v_alerta.fecha_vencimiento THEN 'misma_fecha'
    ELSE 'otra_fecha'
  END;

  UPDATE public.alertas_zonales_destinos
  SET estado = v_estado,
      respuesta_at = now(),
      cantidad_confirmada = p_cantidad,
      fecha_confirmada = v_fecha,
      vencimiento_destino_id = v_vencimiento_nuevo,
      updated_at = now()
  WHERE id = p_destino_id;

  RETURN jsonb_build_object(
    'estado', v_estado,
    'vencimiento_id', v_vencimiento_nuevo,
    'fecha_vencimiento', v_fecha,
    'cantidad', p_cantidad
  );
END;
$$;

REVOKE ALL ON FUNCTION noven_private.responder_alerta_zonal_v1_impl(uuid,text,integer,date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.responder_alerta_zonal_v1_impl(uuid,text,integer,date)
  TO authenticated;

COMMIT;
