-- =============================================================================
-- NOVEN · IDENTIDAD COMPLETA DEL ARTÍCULO V1
--
-- Regla transversal de UX:
-- cada referencia operativa a un artículo debe poder mostrar descripción,
-- marca, gramaje/presentación, código interno y EAN, además de su imagen cuando
-- el contexto la soporte.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Radar Zonal: completar el contrato JSON del artículo
-- -----------------------------------------------------------------------------
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
        FROM public.usuario_familias_sucursal ufs
        WHERE ufs.usuario_id = v_uid
          AND ufs.sucursal_id = d.sucursal_id
          AND ufs.familia_id = a.familia_id
          AND ufs.activo = true
      )
  ) q;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION noven_private.listar_mis_alertas_zonales_v1_impl(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.listar_mis_alertas_zonales_v1_impl(uuid)
  TO authenticated;

COMMENT ON FUNCTION noven_private.listar_mis_alertas_zonales_v1_impl(uuid) IS
  'Bandeja personal de Radar Zonal con identidad completa del artículo: descripción, marca, gramaje, interno, EAN e imagen.';

-- -----------------------------------------------------------------------------
-- 2. Historial operativo: agregar identidad completa sin romper columnas previas
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_acciones_operativas_historial AS
SELECT
  a.id,
  a.tipo,
  a.cantidad,
  a.created_at,
  a.observaciones,
  a.usuario_id,
  a.sucursal_id,
  a.producto_id,
  a.vencimiento_id,
  a.trimestre,
  a.anio,
  noven_private.nombre_actor_accion_visible(a.usuario_id, a.sucursal_id, a.producto_id) AS usuario_nombre,
  p.descripcion AS producto_descripcion,
  p.marca AS producto_marca,
  p.imagen_url AS producto_imagen_url,
  p.familia_id AS producto_familia_id,
  p.gramaje AS producto_gramaje,
  p.cod_art AS producto_cod_art,
  p.codigo_barras AS producto_codigo_barras
FROM public.acciones_operativas a
JOIN public.productos p ON p.id = a.producto_id;

COMMENT ON VIEW public.v_acciones_operativas_historial IS
  'Historial de cierres operativos con identidad completa del artículo para identificación física inequívoca.';

COMMIT;
