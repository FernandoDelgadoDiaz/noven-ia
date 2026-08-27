-- =============================================================================
-- NOVEN · IMPORTACIÓN MASIVA APRENDIDA V1
--
-- El Listado de Reposición Asistida completo actualiza sólo SKU previamente
-- aprendidos por cod_art exacto y con familia conocida. Los SKU nuevos o sin
-- familia quedan fuera de la escritura y se devuelven como pendientes.
--
-- El RPC es SERVER-ONLY: lo invocará una Netlify Function con service_role.
-- authenticated/anon no pueden llamarlo directamente.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Auditoría específica del modo masivo
-- -----------------------------------------------------------------------------
ALTER TABLE public.importaciones
  ADD COLUMN IF NOT EXISTS modo text NOT NULL DEFAULT 'familia',
  ADD COLUMN IF NOT EXISTS filas_aplicadas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS filas_sin_mapear integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS filas_sin_familia integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'importaciones_modo_check'
      AND conrelid = 'public.importaciones'::regclass
  ) THEN
    ALTER TABLE public.importaciones
      ADD CONSTRAINT importaciones_modo_check
      CHECK (modo IN ('familia', 'masiva'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'importaciones_conteos_masivos_check'
      AND conrelid = 'public.importaciones'::regclass
  ) THEN
    ALTER TABLE public.importaciones
      ADD CONSTRAINT importaciones_conteos_masivos_check
      CHECK (
        filas_aplicadas >= 0
        AND filas_sin_mapear >= 0
        AND filas_sin_familia >= 0
      );
  END IF;
END;
$$;

COMMENT ON COLUMN public.importaciones.modo IS
  'familia = aprendizaje/reconciliación; masiva = asistido completo ruteado por cod_art aprendido.';

-- -----------------------------------------------------------------------------
-- 2. Aplicación atómica del asistido completo
--
-- p_items: [{
--   "cod_art":"3328533",
--   "stock":169,
--   "venta_media_diaria":3.15,
--   "fila_origen":21
-- }]
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aplicar_importacion_glaciar_masiva(
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
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_org_id uuid;
  v_zona_id uuid;
  v_codigo_sucursal text;
  v_importacion_id uuid;
  v_importacion_existente uuid;
  v_estado_existente text;
  v_aplicadas integer := 0;
  v_sin_mapear integer := 0;
  v_sin_familia integer := 0;
  v_items_count integer := 0;
  v_legacy_091 constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  IF p_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario requerido para importar';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items debe ser un array JSON';
  END IF;

  v_items_count := jsonb_array_length(p_items);
  IF v_items_count = 0 THEN
    RAISE EXCEPTION 'La importación no contiene filas';
  END IF;

  IF p_archivo_sha256 IS NULL OR p_archivo_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'SHA-256 de archivo inválido';
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
      'El archivo corresponde a la sucursal %, pero la sesión intenta importar en %',
      p_codigo_sucursal_fuente,
      v_codigo_sucursal;
  END IF;

  -- Importación masiva permitida a roles de gestión, no a operador.
  IF NOT EXISTS (
    SELECT 1
    FROM public.usuario_accesos ua
    WHERE ua.usuario_id = p_usuario_id
      AND ua.organizacion_id = v_org_id
      AND ua.activo = true
      AND (
        ua.rol = 'admin_organizacion'
        OR (ua.rol = 'gerente_zonal' AND ua.zona_id = v_zona_id)
        OR (
          ua.rol IN ('gerente_sucursal', 'supervisor')
          AND ua.sucursal_id = p_sucursal_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'El usuario no tiene permiso para importar el asistido completo de esta sucursal';
  END IF;

  -- Idempotencia: mismo archivo físico + sucursal + reporte sólo se aplica una vez.
  SELECT i.id, i.estado
  INTO v_importacion_existente, v_estado_existente
  FROM public.importaciones i
  WHERE i.sucursal_id = p_sucursal_id
    AND i.tipo_reporte = 'reposicion_asistida'
    AND i.archivo_sha256 = p_archivo_sha256;

  IF v_importacion_existente IS NOT NULL THEN
    RETURN jsonb_build_object(
      'duplicada', true,
      'importacion_id', v_importacion_existente,
      'estado', v_estado_existente
    );
  END IF;

  INSERT INTO public.importaciones (
    organizacion_id,
    sucursal_id,
    usuario_id,
    tipo_reporte,
    codigo_sucursal_fuente,
    fecha_reporte,
    nombre_archivo,
    archivo_sha256,
    filas_total,
    filas_validas,
    filas_descartadas,
    modo,
    estado
  ) VALUES (
    v_org_id,
    p_sucursal_id,
    p_usuario_id,
    'reposicion_asistida',
    p_codigo_sucursal_fuente,
    p_fecha_reporte,
    p_nombre_archivo,
    p_archivo_sha256,
    GREATEST(COALESCE(p_filas_total, v_items_count), 0),
    GREATEST(COALESCE(p_filas_validas, v_items_count), 0),
    GREATEST(COALESCE(p_filas_descartadas, 0), 0),
    'masiva',
    'validada'
  )
  RETURNING id INTO v_importacion_id;

  -- Conteos autoritativos. La descripción no participa de la resolución.
  WITH entrada AS (
    SELECT
      btrim(x.cod_art) AS cod_art,
      x.stock,
      COALESCE(x.venta_media_diaria, 0) AS venta_media_diaria,
      x.fila_origen
    FROM jsonb_to_recordset(p_items) AS x(
      cod_art text,
      stock integer,
      venta_media_diaria numeric,
      fila_origen integer
    )
  ), resuelta AS (
    SELECT e.*, p.id AS producto_id, p.familia_id
    FROM entrada e
    LEFT JOIN public.productos p
      ON p.organizacion_id = v_org_id
     AND p.cod_art = e.cod_art
     AND p.activo = true
  )
  SELECT
    count(*) FILTER (WHERE producto_id IS NOT NULL AND familia_id IS NOT NULL),
    count(*) FILTER (WHERE producto_id IS NULL),
    count(*) FILTER (WHERE producto_id IS NOT NULL AND familia_id IS NULL)
  INTO v_aplicadas, v_sin_mapear, v_sin_familia
  FROM resuelta;

  -- Estado actual por sucursal. Un SKU conocido en el catálogo puede aparecer
  -- por primera vez en esta tienda; el upsert crea su estado local.
  WITH entrada AS (
    SELECT
      btrim(x.cod_art) AS cod_art,
      x.stock,
      COALESCE(x.venta_media_diaria, 0) AS venta_media_diaria
    FROM jsonb_to_recordset(p_items) AS x(
      cod_art text,
      stock integer,
      venta_media_diaria numeric,
      fila_origen integer
    )
  ), ruteable AS (
    SELECT
      p.id AS producto_id,
      e.stock,
      e.venta_media_diaria
    FROM entrada e
    JOIN public.productos p
      ON p.organizacion_id = v_org_id
     AND p.cod_art = e.cod_art
     AND p.activo = true
     AND p.familia_id IS NOT NULL
  )
  INSERT INTO public.producto_sucursal (
    organizacion_id,
    producto_id,
    sucursal_id,
    stock_actual,
    venta_media_diaria,
    fecha_ultima_importacion
  )
  SELECT
    v_org_id,
    r.producto_id,
    p_sucursal_id,
    r.stock,
    r.venta_media_diaria,
    now()
  FROM ruteable r
  ON CONFLICT (producto_id, sucursal_id)
  DO UPDATE SET
    stock_actual = EXCLUDED.stock_actual,
    venta_media_diaria = EXCLUDED.venta_media_diaria,
    fecha_ultima_importacion = EXCLUDED.fecha_ultima_importacion,
    updated_at = now();

  -- Snapshot inmutable de esta importación.
  WITH entrada AS (
    SELECT
      btrim(x.cod_art) AS cod_art,
      x.stock,
      COALESCE(x.venta_media_diaria, 0) AS venta_media_diaria,
      x.fila_origen
    FROM jsonb_to_recordset(p_items) AS x(
      cod_art text,
      stock integer,
      venta_media_diaria numeric,
      fila_origen integer
    )
  ), ruteable AS (
    SELECT
      p.id AS producto_id,
      e.stock,
      e.venta_media_diaria,
      e.fila_origen
    FROM entrada e
    JOIN public.productos p
      ON p.organizacion_id = v_org_id
     AND p.cod_art = e.cod_art
     AND p.activo = true
     AND p.familia_id IS NOT NULL
  )
  INSERT INTO public.producto_snapshots (
    importacion_id,
    organizacion_id,
    sucursal_id,
    producto_id,
    stock,
    venta_media_diaria,
    fila_origen
  )
  SELECT
    v_importacion_id,
    v_org_id,
    p_sucursal_id,
    r.producto_id,
    r.stock,
    r.venta_media_diaria,
    r.fila_origen
  FROM ruteable r;

  -- Puente temporal: la UI legacy de 091 aún lee estos campos desde productos.
  -- Sólo 091 recibe este espejo; ninguna otra sucursal contamina el catálogo.
  IF p_sucursal_id = v_legacy_091 THEN
    WITH entrada AS (
      SELECT
        btrim(x.cod_art) AS cod_art,
        x.stock,
        COALESCE(x.venta_media_diaria, 0) AS venta_media_diaria
      FROM jsonb_to_recordset(p_items) AS x(
        cod_art text,
        stock integer,
        venta_media_diaria numeric,
        fila_origen integer
      )
    )
    UPDATE public.productos p
    SET
      stock_actual = e.stock,
      venta_media_diaria = e.venta_media_diaria,
      updated_at = now()
    FROM entrada e
    WHERE p.organizacion_id = v_org_id
      AND p.cod_art = e.cod_art
      AND p.activo = true
      AND p.familia_id IS NOT NULL;
  END IF;

  UPDATE public.importaciones
  SET
    filas_aplicadas = v_aplicadas,
    filas_sin_mapear = v_sin_mapear,
    filas_sin_familia = v_sin_familia,
    estado = 'aplicada',
    aplicada_at = now()
  WHERE id = v_importacion_id;

  RETURN jsonb_build_object(
    'duplicada', false,
    'importacion_id', v_importacion_id,
    'aplicadas', v_aplicadas,
    'sin_mapear', v_sin_mapear,
    'sin_familia', v_sin_familia,
    'familias', (
      WITH entrada AS (
        SELECT btrim(x.cod_art) AS cod_art
        FROM jsonb_to_recordset(p_items) AS x(
          cod_art text,
          stock integer,
          venta_media_diaria numeric,
          fila_origen integer
        )
      )
      SELECT COALESCE(jsonb_agg(resumen ORDER BY productos DESC, nombre), '[]'::jsonb)
      FROM (
        SELECT
          f.id AS familia_id,
          f.codigo,
          f.nombre,
          count(*) AS productos
        FROM entrada e
        JOIN public.productos p
          ON p.organizacion_id = v_org_id
         AND p.cod_art = e.cod_art
         AND p.activo = true
         AND p.familia_id IS NOT NULL
        JOIN public.familias f ON f.id = p.familia_id
        GROUP BY f.id, f.codigo, f.nombre
      ) resumen
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_importacion_glaciar_masiva(
  uuid, uuid, text, text, text, integer, integer, integer, jsonb, date
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_importacion_glaciar_masiva(
  uuid, uuid, text, text, text, integer, integer, integer, jsonb, date
) TO service_role;

COMMENT ON FUNCTION public.aplicar_importacion_glaciar_masiva(
  uuid, uuid, text, text, text, integer, integer, integer, jsonb, date
) IS
  'Server-only: aplica en una transacción el asistido completo por cod_art exacto, conserva snapshots y evita duplicar el mismo archivo.';

COMMIT;
