-- =============================================================================
-- NOVEN · SCANNER CATÁLOGO MULTITENANT V1
--
-- Centraliza las operaciones sensibles del Scanner:
--   - búsqueda EAN/cod_art dentro de la organización de la sucursal;
--   - detección de conflictos por tenant;
--   - vínculo EAN append-friendly en producto_codigos;
--   - completar cod_art;
--   - alta atómica catálogo global + estado local producto_sucursal.
--
-- El navegador sólo envía sucursal + datos operativos. La organización se deriva
-- en DB y todos los writes verifican scope.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. El bridge legacy puede omitirse desde escritores V2.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_legacy_producto_estado_091()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Los RPC V2 escriben producto_sucursal explícitamente y deben evitar que el
  -- trigger invente una fila 091 para un alta originada en otra sucursal.
  IF current_setting('noven.skip_legacy_bridge', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.organizacion_id <> '10000000-0000-4000-8000-000000000001'::uuid THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.producto_sucursal (
    organizacion_id,
    producto_id,
    sucursal_id,
    stock_actual,
    venta_media_diaria
  )
  VALUES (
    NEW.organizacion_id,
    NEW.id,
    '00000000-0000-0000-0000-000000000001'::uuid,
    NEW.stock_actual,
    NEW.venta_media_diaria
  )
  ON CONFLICT (producto_id, sucursal_id)
  DO UPDATE SET
    stock_actual = EXCLUDED.stock_actual,
    venta_media_diaria = EXCLUDED.venta_media_diaria,
    updated_at = now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_legacy_producto_estado_091()
  FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Helpers privados
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION noven_private.scanner_org(p_sucursal_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, noven_private, pg_temp
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_org uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT noven_private.tiene_acceso_sucursal(p_sucursal_id) THEN
    RAISE EXCEPTION 'Sin acceso a la sucursal' USING ERRCODE = '42501';
  END IF;

  SELECT organizacion_id INTO v_org
  FROM public.sucursales
  WHERE id = p_sucursal_id AND activa = true;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Sucursal activa no encontrada' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_org;
END;
$$;

REVOKE ALL ON FUNCTION noven_private.scanner_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.scanner_org(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION noven_private.scanner_producto_json(
  p_producto_id uuid,
  p_sucursal_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'cod_art', p.cod_art,
    'codigo_barras', COALESCE(
      (SELECT pc.codigo
       FROM public.producto_codigos pc
       WHERE pc.producto_id = p.id
         AND pc.organizacion_id = p.organizacion_id
         AND pc.activo = true
       ORDER BY pc.es_principal DESC, pc.created_at ASC
       LIMIT 1),
      p.codigo_barras
    ),
    'descripcion', p.descripcion,
    'marca', p.marca,
    'gramaje', p.gramaje,
    'categoria', p.categoria,
    'proveedor', p.proveedor,
    'sector', p.sector,
    'venta_media_diaria', COALESCE(ps.venta_media_diaria, 0),
    'stock_actual', COALESCE(ps.stock_actual, 0),
    'precio_costo', p.precio_costo,
    'imagen_url', p.imagen_url,
    'familia_id', p.familia_id,
    'activo', p.activo,
    'created_at', p.created_at,
    'updated_at', p.updated_at,
    'organizacion_id', p.organizacion_id
  )
  FROM public.productos p
  LEFT JOIN public.producto_sucursal ps
    ON ps.producto_id = p.id
   AND ps.sucursal_id = p_sucursal_id
   AND ps.organizacion_id = p.organizacion_id
  WHERE p.id = p_producto_id;
$$;

REVOKE ALL ON FUNCTION noven_private.scanner_producto_json(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.scanner_producto_json(uuid, uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Búsqueda scanner por EAN/cod_art, siempre dentro de la organización
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buscar_producto_scanner(
  p_sucursal_id uuid,
  p_codigo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, noven_private, pg_temp
AS $$
DECLARE
  v_org uuid;
  v_codigo text := btrim(p_codigo);
  v_producto_id uuid;
BEGIN
  IF v_codigo = '' THEN RETURN NULL; END IF;
  v_org := noven_private.scanner_org(p_sucursal_id);

  SELECT p.id INTO v_producto_id
  FROM public.productos p
  WHERE p.organizacion_id = v_org
    AND p.activo IS DISTINCT FROM false
    AND (
      EXISTS (
        SELECT 1 FROM public.producto_codigos pc
        WHERE pc.organizacion_id = v_org
          AND pc.producto_id = p.id
          AND pc.codigo = v_codigo
          AND pc.activo = true
      )
      OR p.codigo_barras = v_codigo
    )
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF v_producto_id IS NULL THEN
    SELECT p.id INTO v_producto_id
    FROM public.productos p
    WHERE p.organizacion_id = v_org
      AND p.activo IS DISTINCT FROM false
      AND p.cod_art = v_codigo
    ORDER BY p.created_at ASC
    LIMIT 1;
  END IF;

  IF v_producto_id IS NULL THEN RETURN NULL; END IF;
  RETURN noven_private.scanner_producto_json(v_producto_id, p_sucursal_id);
END;
$$;

REVOKE ALL ON FUNCTION public.buscar_producto_scanner(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_producto_scanner(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Conflictos de códigos dentro del tenant
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buscar_conflicto_codigos_scanner(
  p_sucursal_id uuid,
  p_cod_art text,
  p_ean text,
  p_excluir_producto_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, noven_private, pg_temp
AS $$
DECLARE
  v_org uuid := noven_private.scanner_org(p_sucursal_id);
  v_cod text := btrim(COALESCE(p_cod_art, ''));
  v_ean text := btrim(COALESCE(p_ean, ''));
  v_id uuid;
  v_motivo text;
BEGIN
  IF v_cod <> '' THEN
    SELECT p.id INTO v_id
    FROM public.productos p
    WHERE p.organizacion_id = v_org
      AND p.cod_art = v_cod
      AND (p_excluir_producto_id IS NULL OR p.id <> p_excluir_producto_id)
    LIMIT 1;
    IF v_id IS NOT NULL THEN v_motivo := 'cod_art_ocupado'; END IF;
  END IF;

  IF v_id IS NULL AND v_ean <> '' THEN
    SELECT p.id INTO v_id
    FROM public.productos p
    WHERE p.organizacion_id = v_org
      AND (p_excluir_producto_id IS NULL OR p.id <> p_excluir_producto_id)
      AND (
        p.codigo_barras = v_ean
        OR EXISTS (
          SELECT 1 FROM public.producto_codigos pc
          WHERE pc.organizacion_id = v_org
            AND pc.producto_id = p.id
            AND pc.codigo = v_ean
            AND pc.activo = true
        )
      )
    LIMIT 1;
    IF v_id IS NOT NULL THEN v_motivo := 'ean_ocupado'; END IF;
  END IF;

  IF v_id IS NULL AND v_ean <> '' THEN
    SELECT p.id INTO v_id
    FROM public.productos p
    WHERE p.organizacion_id = v_org
      AND p.cod_art = v_ean
      AND (p_excluir_producto_id IS NULL OR p.id <> p_excluir_producto_id)
    LIMIT 1;
    IF v_id IS NOT NULL THEN v_motivo := 'ean_guardado_como_cod_art'; END IF;
  END IF;

  IF v_id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'motivo', v_motivo,
    'producto', noven_private.scanner_producto_json(v_id, p_sucursal_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.buscar_conflicto_codigos_scanner(uuid, text, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_conflicto_codigos_scanner(uuid, text, text, uuid)
  TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Vincular EAN compartido dentro de la organización
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vincular_ean_producto_scanner(
  p_sucursal_id uuid,
  p_producto_id uuid,
  p_ean text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, noven_private, pg_temp
AS $$
DECLARE
  v_org uuid := noven_private.scanner_org(p_sucursal_id);
  v_ean text := btrim(p_ean);
  v_conflicto jsonb;
  v_tipo text;
  v_principal boolean;
BEGIN
  IF v_ean !~ '^(?:[0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$' THEN
    RAISE EXCEPTION 'EAN inválido' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.productos p
    WHERE p.id = p_producto_id AND p.organizacion_id = v_org
  ) OR NOT noven_private.puede_ver_producto_sucursal(p_sucursal_id, p_producto_id) THEN
    RAISE EXCEPTION 'Producto fuera del alcance' USING ERRCODE = '42501';
  END IF;

  v_conflicto := public.buscar_conflicto_codigos_scanner(
    p_sucursal_id, '', v_ean, p_producto_id
  );
  IF v_conflicto IS NOT NULL THEN
    RAISE EXCEPTION 'EAN ocupado por otro producto: %', v_conflicto::text
      USING ERRCODE = '23505';
  END IF;

  v_tipo := CASE length(v_ean)
    WHEN 8 THEN 'ean8'
    WHEN 12 THEN 'upca'
    WHEN 13 THEN 'ean13'
    WHEN 14 THEN 'gtin14'
    ELSE 'otro'
  END;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.producto_codigos
    WHERE producto_id = p_producto_id
      AND organizacion_id = v_org
      AND activo = true
      AND es_principal = true
  ) INTO v_principal;

  INSERT INTO public.producto_codigos(
    organizacion_id, producto_id, codigo, tipo, es_principal, activo
  ) VALUES (
    v_org, p_producto_id, v_ean, v_tipo, v_principal, true
  )
  ON CONFLICT (organizacion_id, codigo)
  DO UPDATE SET activo = true, updated_at = now();

  -- Compatibilidad: mantener el campo singular mientras existan lectores legacy.
  UPDATE public.productos
  SET codigo_barras = COALESCE(NULLIF(codigo_barras, ''), v_ean), updated_at = now()
  WHERE id = p_producto_id AND organizacion_id = v_org;

  RETURN noven_private.scanner_producto_json(p_producto_id, p_sucursal_id);
END;
$$;

REVOKE ALL ON FUNCTION public.vincular_ean_producto_scanner(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vincular_ean_producto_scanner(uuid, uuid, text)
  TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Completar código interno Glaciar
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.completar_cod_art_producto_scanner(
  p_sucursal_id uuid,
  p_producto_id uuid,
  p_cod_art text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, noven_private, pg_temp
AS $$
DECLARE
  v_org uuid := noven_private.scanner_org(p_sucursal_id);
  v_cod text := btrim(p_cod_art);
  v_conflicto jsonb;
BEGIN
  IF v_cod !~ '^[0-9]{7}$' THEN
    RAISE EXCEPTION 'Código interno inválido' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.productos p
    WHERE p.id = p_producto_id AND p.organizacion_id = v_org
  ) OR NOT noven_private.puede_ver_producto_sucursal(p_sucursal_id, p_producto_id) THEN
    RAISE EXCEPTION 'Producto fuera del alcance' USING ERRCODE = '42501';
  END IF;

  v_conflicto := public.buscar_conflicto_codigos_scanner(
    p_sucursal_id, v_cod, '', p_producto_id
  );
  IF v_conflicto IS NOT NULL THEN
    RAISE EXCEPTION 'Código interno ocupado por otro producto: %', v_conflicto::text
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.productos
  SET cod_art = v_cod, updated_at = now()
  WHERE id = p_producto_id AND organizacion_id = v_org;

  RETURN noven_private.scanner_producto_json(p_producto_id, p_sucursal_id);
END;
$$;

REVOKE ALL ON FUNCTION public.completar_cod_art_producto_scanner(uuid, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.completar_cod_art_producto_scanner(uuid, uuid, text)
  TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Familias que el usuario puede usar desde Scanner en una sucursal
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.listar_familias_scanner(p_sucursal_id uuid)
RETURNS TABLE(id uuid, nombre text, codigo text, sector_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, noven_private, pg_temp
AS $$
DECLARE
  v_org uuid := noven_private.scanner_org(p_sucursal_id);
BEGIN
  RETURN QUERY
  SELECT f.id, f.nombre, f.codigo, f.sector_id
  FROM public.familias f
  WHERE f.organizacion_id = v_org
    AND noven_private.puede_ver_familia_sucursal(p_sucursal_id, f.id)
  ORDER BY f.nombre;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_familias_scanner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_familias_scanner(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 8. Alta atómica: catálogo global + EAN + estado local
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_producto_scanner(
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
SECURITY INVOKER
SET search_path = public, noven_private, pg_temp
AS $$
DECLARE
  v_org uuid := noven_private.scanner_org(p_sucursal_id);
  v_cod text := btrim(p_cod_art);
  v_ean text := btrim(p_ean);
  v_desc text := btrim(p_descripcion);
  v_conflicto jsonb;
  v_producto_id uuid;
  v_tipo text;
BEGIN
  IF v_cod !~ '^[0-9]{7}$' THEN
    RAISE EXCEPTION 'Código interno inválido' USING ERRCODE = '22023';
  END IF;
  IF v_ean !~ '^(?:[0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$' THEN
    RAISE EXCEPTION 'EAN inválido' USING ERRCODE = '22023';
  END IF;
  IF v_desc = '' THEN
    RAISE EXCEPTION 'La descripción es obligatoria' USING ERRCODE = '22023';
  END IF;
  IF p_stock_actual IS NULL OR p_stock_actual < 0 THEN
    RAISE EXCEPTION 'Stock inválido' USING ERRCODE = '22023';
  END IF;
  IF p_venta_media_diaria IS NULL OR p_venta_media_diaria < 0 THEN
    RAISE EXCEPTION 'Venta media inválida' USING ERRCODE = '22023';
  END IF;
  IF p_familia_id IS NULL OR NOT noven_private.puede_ver_familia_sucursal(p_sucursal_id, p_familia_id) THEN
    RAISE EXCEPTION 'Familia obligatoria o fuera del alcance' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.familias f
    WHERE f.id = p_familia_id AND f.organizacion_id = v_org
  ) THEN
    RAISE EXCEPTION 'La familia no pertenece a la organización' USING ERRCODE = '23503';
  END IF;

  v_conflicto := public.buscar_conflicto_codigos_scanner(
    p_sucursal_id, v_cod, v_ean, NULL
  );
  IF v_conflicto IS NOT NULL THEN
    RAISE EXCEPTION 'Conflicto de códigos: %', v_conflicto::text USING ERRCODE = '23505';
  END IF;

  -- El escritor V2 crea estado local explícito; no usar el bridge de 091.
  PERFORM set_config('noven.skip_legacy_bridge', '1', true);

  INSERT INTO public.productos(
    cod_art,
    codigo_barras,
    descripcion,
    marca,
    categoria,
    stock_actual,
    venta_media_diaria,
    familia_id,
    activo,
    organizacion_id
  ) VALUES (
    v_cod,
    v_ean,
    v_desc,
    NULLIF(btrim(COALESCE(p_marca, '')), ''),
    NULLIF(btrim(COALESCE(p_categoria, '')), ''),
    0,
    0,
    p_familia_id,
    true,
    v_org
  )
  RETURNING id INTO v_producto_id;

  v_tipo := CASE length(v_ean)
    WHEN 8 THEN 'ean8'
    WHEN 12 THEN 'upca'
    WHEN 13 THEN 'ean13'
    WHEN 14 THEN 'gtin14'
    ELSE 'otro'
  END;

  INSERT INTO public.producto_codigos(
    organizacion_id, producto_id, codigo, tipo, es_principal, activo
  ) VALUES (
    v_org, v_producto_id, v_ean, v_tipo, true, true
  );

  INSERT INTO public.producto_sucursal(
    organizacion_id,
    producto_id,
    sucursal_id,
    stock_actual,
    venta_media_diaria
  ) VALUES (
    v_org,
    v_producto_id,
    p_sucursal_id,
    p_stock_actual,
    p_venta_media_diaria
  );

  RETURN noven_private.scanner_producto_json(v_producto_id, p_sucursal_id);
END;
$$;

REVOKE ALL ON FUNCTION public.crear_producto_scanner(uuid, text, text, text, text, text, integer, numeric, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_producto_scanner(uuid, text, text, text, text, text, integer, numeric, uuid)
  TO authenticated;

COMMIT;
