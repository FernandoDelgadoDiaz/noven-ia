-- =============================================================================
-- NOVEN · PUBLICACIÓN VERSIONADA DE FOTO DE PRODUCTO
--
-- Objetivo:
-- - nunca sobrescribir la versión actualmente publicada;
-- - full + thumb nacen bajo el mismo UUID de versión;
-- - la DB cambia ambas URLs juntas sólo si los dos objetos existen;
-- - clientes viejos no pueden volver a escribir full.webp/thumb.webp fijos.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION noven_private.puede_insertar_imagen_catalogo_storage(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_org uuid;
  v_producto uuid;
  v_version uuid;
  v_archivo text;
  v_imagen_actual text;
  v_visible_local boolean;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RETURN false; END IF;
  IF pg_catalog.split_part(p_name, '/', 2) <> 'productos' THEN RETURN false; END IF;
  IF pg_catalog.split_part(p_name, '/', 6) <> '' THEN RETURN false; END IF;

  v_archivo := pg_catalog.split_part(p_name, '/', 5);
  IF v_archivo NOT IN ('full.webp', 'thumb.webp') THEN RETURN false; END IF;

  BEGIN
    v_org := pg_catalog.split_part(p_name, '/', 1)::uuid;
    v_producto := pg_catalog.split_part(p_name, '/', 3)::uuid;
    v_version := pg_catalog.split_part(p_name, '/', 4)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;

  IF v_version IS NULL THEN RETURN false; END IF;

  SELECT p.imagen_url,
    EXISTS (
      SELECT 1
      FROM public.producto_sucursal ps
      JOIN public.usuario_accesos ua
        ON ua.usuario_id = (SELECT auth.uid())
       AND ua.organizacion_id = ps.organizacion_id
       AND ua.sucursal_id = ps.sucursal_id
       AND ua.activo = true
       AND ua.rol IN ('gerente_sucursal', 'supervisor', 'operador')
      WHERE ps.producto_id = p.id
        AND ps.organizacion_id = p.organizacion_id
        AND noven_private.puede_ver_producto_sucursal(ps.sucursal_id, p.id)
    )
  INTO v_imagen_actual, v_visible_local
  FROM public.productos p
  WHERE p.id = v_producto AND p.organizacion_id = v_org;

  IF NOT FOUND OR NOT COALESCE(v_visible_local, false) THEN RETURN false; END IF;

  -- Primera foto: cualquier rol operativo autorizado puede aportar la faltante.
  IF NULLIF(pg_catalog.btrim(COALESCE(v_imagen_actual, '')), '') IS NULL THEN RETURN true; END IF;

  -- Reemplazo: sólo supervisor/gerencia local, igual que el contrato vigente.
  RETURN EXISTS (
    SELECT 1
    FROM public.producto_sucursal ps
    WHERE ps.producto_id = v_producto
      AND ps.organizacion_id = v_org
      AND noven_private.puede_reemplazar_imagen_producto(ps.sucursal_id, v_producto)
  );
END;
$$;

-- Los objetos versionados son inmutables desde cliente. No existe caso válido
-- de UPDATE: un reemplazo siempre crea otro UUID y luego publica ese par.
CREATE OR REPLACE FUNCTION noven_private.puede_actualizar_imagen_catalogo_storage(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT false;
$$;

DROP POLICY IF EXISTS "Update catalogo V2" ON storage.objects;

-- Reafirmamos INSERT con el helper versionado. SELECT público se conserva.
DROP POLICY IF EXISTS "Upload catalogo V2" ON storage.objects;
CREATE POLICY "Upload catalogo V2"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'productos-imagenes'
  AND noven_private.puede_insertar_imagen_catalogo_storage(name)
);

CREATE OR REPLACE FUNCTION noven_private.actualizar_imagen_producto_operador_v2_impl(
  p_sucursal_id uuid,
  p_producto_id uuid,
  p_imagen_url text,
  p_imagen_thumb_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_org uuid;
  v_imagen_actual text;
  v_accion text;
  v_fragmento text;
  v_full_tail text;
  v_thumb_tail text;
  v_full_version uuid;
  v_thumb_version uuid;
  v_full_path text;
  v_thumb_path text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE='28000';
  END IF;

  IF NULLIF(pg_catalog.btrim(COALESCE(p_imagen_url,'')),'') IS NULL
     OR NULLIF(pg_catalog.btrim(COALESCE(p_imagen_thumb_url,'')),'') IS NULL THEN
    RAISE EXCEPTION 'Las URLs de imagen son obligatorias' USING ERRCODE='22023';
  END IF;

  SELECT p.organizacion_id, p.imagen_url
  INTO v_org, v_imagen_actual
  FROM public.productos p
  JOIN public.sucursales s
    ON s.id = p_sucursal_id
   AND s.organizacion_id = p.organizacion_id
   AND s.activa = true
  WHERE p.id = p_producto_id
  FOR UPDATE OF p;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto/sucursal incompatibles o inexistentes' USING ERRCODE='P0002';
  END IF;

  IF NOT noven_private.puede_ver_producto_sucursal(p_sucursal_id,p_producto_id) THEN
    RAISE EXCEPTION 'Sin permiso para gestionar la foto de este producto' USING ERRCODE='42501';
  END IF;

  v_accion := CASE
    WHEN NULLIF(pg_catalog.btrim(COALESCE(v_imagen_actual,'')),'') IS NULL THEN 'agregar'
    ELSE 'reemplazar'
  END;

  IF v_accion='reemplazar'
     AND NOT noven_private.puede_reemplazar_imagen_producto(p_sucursal_id,p_producto_id) THEN
    RAISE EXCEPTION 'La foto ya existe; el reemplazo requiere supervisor o gerencia' USING ERRCODE='42501';
  END IF;

  v_fragmento := '/productos-imagenes/' || v_org::text || '/productos/' || p_producto_id::text || '/';

  IF pg_catalog.position(v_fragmento IN p_imagen_url)=0
     OR pg_catalog.position(v_fragmento IN p_imagen_thumb_url)=0 THEN
    RAISE EXCEPTION 'Ruta de imagen fuera del catálogo de la organización' USING ERRCODE='22023';
  END IF;

  v_full_tail := pg_catalog.split_part(
    pg_catalog.substring(
      p_imagen_url
      FROM pg_catalog.position(v_fragmento IN p_imagen_url) + pg_catalog.length(v_fragmento)
    ),
    '?',
    1
  );
  v_thumb_tail := pg_catalog.split_part(
    pg_catalog.substring(
      p_imagen_thumb_url
      FROM pg_catalog.position(v_fragmento IN p_imagen_thumb_url) + pg_catalog.length(v_fragmento)
    ),
    '?',
    1
  );

  IF pg_catalog.split_part(v_full_tail,'/',2) <> 'full.webp'
     OR pg_catalog.split_part(v_full_tail,'/',3) <> ''
     OR pg_catalog.split_part(v_thumb_tail,'/',2) <> 'thumb.webp'
     OR pg_catalog.split_part(v_thumb_tail,'/',3) <> '' THEN
    RAISE EXCEPTION 'La foto debe usar rutas versionadas full/thumb' USING ERRCODE='22023';
  END IF;

  BEGIN
    v_full_version := pg_catalog.split_part(v_full_tail,'/',1)::uuid;
    v_thumb_version := pg_catalog.split_part(v_thumb_tail,'/',1)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Versión de imagen inválida' USING ERRCODE='22023';
  END;

  IF v_full_version IS DISTINCT FROM v_thumb_version THEN
    RAISE EXCEPTION 'Full y miniatura deben pertenecer a la misma versión' USING ERRCODE='22023';
  END IF;

  v_full_path := v_org::text || '/productos/' || p_producto_id::text || '/' || v_full_version::text || '/full.webp';
  v_thumb_path := v_org::text || '/productos/' || p_producto_id::text || '/' || v_full_version::text || '/thumb.webp';

  IF NOT EXISTS (
    SELECT 1 FROM storage.objects o
    WHERE o.bucket_id='productos-imagenes' AND o.name=v_full_path
  ) OR NOT EXISTS (
    SELECT 1 FROM storage.objects o
    WHERE o.bucket_id='productos-imagenes' AND o.name=v_thumb_path
  ) THEN
    RAISE EXCEPTION 'La versión de imagen no está completa en Storage' USING ERRCODE='23514';
  END IF;

  UPDATE public.productos
  SET imagen_url=pg_catalog.btrim(p_imagen_url),
      imagen_thumb_url=pg_catalog.btrim(p_imagen_thumb_url),
      updated_at=pg_catalog.now()
  WHERE id=p_producto_id AND organizacion_id=v_org;

  INSERT INTO public.producto_imagen_cambios(
    organizacion_id,producto_id,sucursal_id,usuario_id,accion,imagen_url,imagen_thumb_url
  ) VALUES (
    v_org,p_producto_id,p_sucursal_id,v_uid,v_accion,
    pg_catalog.btrim(p_imagen_url),pg_catalog.btrim(p_imagen_thumb_url)
  );
END;
$$;

COMMIT;
