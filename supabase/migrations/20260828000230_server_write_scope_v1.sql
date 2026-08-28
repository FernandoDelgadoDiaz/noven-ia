-- =============================================================================
-- NOVEN · SCOPE SERVER-ONLY PARA IMPORTACIÓN/CATÁLOGO
--
-- Los writers históricos quedan ocultos detrás de wrappers obligatorios:
-- - gerente_sucursal / supervisor: pueden operar sólo su sucursal.
-- - gerente_zonal: sólo lectura, nunca pasa gates de escritura.
-- - admin_organizacion: no amplía alcance operativo.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.validar_operacion_local_server_v1(
  p_actor_id uuid,
  p_sucursal_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.sucursales s
      ON s.id=p_sucursal_id
     AND s.activa=true
    JOIN public.usuario_accesos ua
      ON ua.usuario_id=u.id
     AND ua.organizacion_id=s.organizacion_id
     AND ua.sucursal_id=s.id
     AND ua.rol IN ('gerente_sucursal','supervisor')
     AND ua.activo=true
    WHERE u.id=p_actor_id
      AND u.activo=true
  );
$$;

CREATE OR REPLACE FUNCTION public.validar_resolucion_pendiente_server_v1(
  p_actor_id uuid,
  p_pendiente_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.producto_pendiente_detecciones d
      ON d.pendiente_id=p_pendiente_id
    JOIN public.sucursales s
      ON s.id=d.sucursal_id
     AND s.activa=true
    JOIN public.usuario_accesos ua
      ON ua.usuario_id=u.id
     AND ua.organizacion_id=s.organizacion_id
     AND ua.sucursal_id=s.id
     AND ua.rol IN ('gerente_sucursal','supervisor')
     AND ua.activo=true
    WHERE u.id=p_actor_id
      AND u.activo=true
  );
$$;

-- Lectura de pendientes con alcance real. El admin jerárquico sólo ve lo que
-- además le corresponda por un rol operativo; el zonal ve detecciones de su zona.
CREATE OR REPLACE FUNCTION public.listar_productos_pendientes_catalogo_v2(p_usuario_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $$
  SELECT COALESCE(jsonb_agg(item ORDER BY last_detected_at DESC),'[]'::jsonb)
  FROM (
    SELECT
      jsonb_build_object(
        'id',pp.id,
        'organizacion_id',pp.organizacion_id,
        'cod_art',pp.cod_art,
        'descripcion',pp.descripcion,
        'marca',pp.marca,
        'gramaje',pp.gramaje,
        'producto_id',pp.producto_id,
        'first_detected_at',pp.first_detected_at,
        'last_detected_at',pp.last_detected_at,
        'detecciones',count(DISTINCT d.importacion_id),
        'sucursales',COALESCE(
          jsonb_agg(DISTINCT jsonb_build_object('id',s.id,'codigo',s.codigo,'nombre',s.nombre)),
          '[]'::jsonb
        )
      ) AS item,
      pp.last_detected_at
    FROM public.productos_pendientes_catalogo pp
    JOIN public.producto_pendiente_detecciones d ON d.pendiente_id=pp.id
    JOIN public.sucursales s ON s.id=d.sucursal_id AND s.activa=true
    JOIN public.usuarios u ON u.id=p_usuario_id AND u.activo=true
    WHERE pp.estado='pendiente'
      AND EXISTS (
        SELECT 1
        FROM public.usuario_accesos ua
        WHERE ua.usuario_id=p_usuario_id
          AND ua.organizacion_id=pp.organizacion_id
          AND ua.activo=true
          AND (
            (ua.rol='gerente_zonal' AND ua.zona_id=s.zona_id)
            OR (
              ua.rol IN ('gerente_sucursal','supervisor')
              AND ua.sucursal_id=s.id
            )
          )
      )
    GROUP BY pp.id,pp.organizacion_id,pp.cod_art,pp.descripcion,pp.marca,
             pp.gramaje,pp.producto_id,pp.first_detected_at,pp.last_detected_at
  ) q;
$$;

-- Encapsulamos los writers service-only existentes sin copiar su lógica de negocio.
-- Sus implementaciones históricas pierden EXECUTE incluso para service_role;
-- sólo los wrappers SECURITY DEFINER pueden alcanzarlas después del gate.
ALTER FUNCTION public.aplicar_importacion_glaciar_familia_v1(
  uuid,uuid,text,text,text,text,integer,integer,integer,jsonb,date
) RENAME TO aplicar_importacion_glaciar_familia_legacy_v1;

CREATE FUNCTION public.aplicar_importacion_glaciar_familia_v1(
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
  p_fecha_reporte date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.validar_operacion_local_server_v1(p_usuario_id,p_sucursal_id) THEN
    RAISE EXCEPTION 'El usuario no tiene permiso operativo para importar esta familia en la sucursal'
      USING ERRCODE='42501';
  END IF;
  RETURN public.aplicar_importacion_glaciar_familia_legacy_v1(
    p_sucursal_id,p_usuario_id,p_codigo_sucursal_fuente,p_codigo_familia,
    p_nombre_archivo,p_archivo_sha256,p_filas_total,p_filas_validas,
    p_filas_descartadas,p_operaciones,p_fecha_reporte
  );
END;
$$;

ALTER FUNCTION public.aplicar_importacion_glaciar_masiva_v2(
  uuid,uuid,text,text,text,integer,integer,integer,jsonb,date
) RENAME TO aplicar_importacion_glaciar_masiva_legacy_v2;

CREATE FUNCTION public.aplicar_importacion_glaciar_masiva_v2(
  p_sucursal_id uuid,
  p_usuario_id uuid,
  p_codigo_sucursal_fuente text,
  p_nombre_archivo text,
  p_archivo_sha256 text,
  p_filas_total integer,
  p_filas_validas integer,
  p_filas_descartadas integer,
  p_items jsonb,
  p_fecha_reporte date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.validar_operacion_local_server_v1(p_usuario_id,p_sucursal_id) THEN
    RAISE EXCEPTION 'El usuario no tiene permiso operativo para importar en la sucursal'
      USING ERRCODE='42501';
  END IF;
  RETURN public.aplicar_importacion_glaciar_masiva_legacy_v2(
    p_sucursal_id,p_usuario_id,p_codigo_sucursal_fuente,p_nombre_archivo,
    p_archivo_sha256,p_filas_total,p_filas_validas,p_filas_descartadas,
    p_items,p_fecha_reporte
  );
END;
$$;

ALTER FUNCTION public.resolver_producto_pendiente_catalogo(uuid,uuid,uuid)
  RENAME TO resolver_producto_pendiente_catalogo_legacy_v1;

CREATE FUNCTION public.resolver_producto_pendiente_catalogo(
  p_pendiente_id uuid,
  p_familia_id uuid,
  p_usuario_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.validar_resolucion_pendiente_server_v1(p_usuario_id,p_pendiente_id) THEN
    RAISE EXCEPTION 'El usuario no tiene permiso operativo para clasificar este producto'
      USING ERRCODE='42501';
  END IF;
  RETURN public.resolver_producto_pendiente_catalogo_legacy_v1(
    p_pendiente_id,p_familia_id,p_usuario_id
  );
END;
$$;

ALTER FUNCTION public.resolver_pendientes_catalogo_por_familia_csv(
  uuid,uuid,text,text,jsonb
) RENAME TO resolver_pendientes_catalogo_por_familia_csv_legacy_v1;

CREATE FUNCTION public.resolver_pendientes_catalogo_por_familia_csv(
  p_sucursal_id uuid,
  p_usuario_id uuid,
  p_codigo_sucursal_fuente text,
  p_codigo_familia text,
  p_cod_arts jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.validar_operacion_local_server_v1(p_usuario_id,p_sucursal_id) THEN
    RAISE EXCEPTION 'El usuario no tiene permiso operativo para aprender catálogo desde esta sucursal'
      USING ERRCODE='42501';
  END IF;
  RETURN public.resolver_pendientes_catalogo_por_familia_csv_legacy_v1(
    p_sucursal_id,p_usuario_id,p_codigo_sucursal_fuente,p_codigo_familia,p_cod_arts
  );
END;
$$;

-- Implementaciones legacy fuera del API incluso para el service key.
REVOKE ALL ON FUNCTION public.aplicar_importacion_glaciar_familia_legacy_v1(
  uuid,uuid,text,text,text,text,integer,integer,integer,jsonb,date
) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.aplicar_importacion_glaciar_masiva_legacy_v2(
  uuid,uuid,text,text,text,integer,integer,integer,jsonb,date
) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.resolver_producto_pendiente_catalogo_legacy_v1(uuid,uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.resolver_pendientes_catalogo_por_familia_csv_legacy_v1(
  uuid,uuid,text,text,jsonb
) FROM PUBLIC,anon,authenticated,service_role;

-- Esta implementación base sólo debe ser alcanzable internamente desde el
-- wrapper v2 protegido. Ningún Function con service_role puede invocarla directo.
REVOKE ALL ON FUNCTION public.aplicar_importacion_glaciar_masiva(
  uuid,uuid,text,text,text,integer,integer,integer,jsonb,date
) FROM PUBLIC,anon,authenticated,service_role;

-- Sólo service_role puede invocar gates, wrappers y lectura server-side.
REVOKE ALL ON FUNCTION public.validar_operacion_local_server_v1(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validar_operacion_local_server_v1(uuid,uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.validar_resolucion_pendiente_server_v1(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validar_resolucion_pendiente_server_v1(uuid,uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.listar_productos_pendientes_catalogo_v2(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.listar_productos_pendientes_catalogo_v2(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.aplicar_importacion_glaciar_familia_v1(
  uuid,uuid,text,text,text,text,integer,integer,integer,jsonb,date
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_importacion_glaciar_familia_v1(
  uuid,uuid,text,text,text,text,integer,integer,integer,jsonb,date
) TO service_role;

REVOKE ALL ON FUNCTION public.aplicar_importacion_glaciar_masiva_v2(
  uuid,uuid,text,text,text,integer,integer,integer,jsonb,date
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_importacion_glaciar_masiva_v2(
  uuid,uuid,text,text,text,integer,integer,integer,jsonb,date
) TO service_role;

REVOKE ALL ON FUNCTION public.resolver_producto_pendiente_catalogo(uuid,uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_producto_pendiente_catalogo(uuid,uuid,uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.resolver_pendientes_catalogo_por_familia_csv(
  uuid,uuid,text,text,jsonb
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_pendientes_catalogo_por_familia_csv(
  uuid,uuid,text,text,jsonb
) TO service_role;

COMMIT;
