-- =============================================================================
-- NOVEN · PRODUCT IMAGE V2 FINAL HARDENING
--
-- Cierra el RPC legacy que permitía cambiar imagen_url sin pasar por la
-- gobernanza V2, evita archivos V2 huérfanos cuando ya existe una foto oficial
-- y completa índices de FK de la auditoría de imágenes.
-- =============================================================================

BEGIN;

-- El frontend V2 ya no usa este contrato. Se conserva la función por
-- compatibilidad histórica, pero deja de ser ejecutable por usuarios de app.
REVOKE ALL ON FUNCTION public.actualizar_imagen_producto_operador(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION noven_private.actualizar_imagen_producto_operador_impl(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;

-- INSERT de archivos V2:
-- - si el producto todavía no tiene foto oficial, cualquier usuario con acceso
--   al producto puede aportar la primera foto;
-- - si ya existe una foto oficial, crear/reemplazar objetos requiere rol
--   elevado dentro de la organización.
CREATE OR REPLACE FUNCTION noven_private.puede_insertar_imagen_catalogo_storage(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid;
  v_producto uuid;
  v_archivo text;
  v_imagen_actual text;
  v_visible boolean;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RETURN false; END IF;
  IF pg_catalog.split_part(p_name, '/', 2) <> 'productos' THEN RETURN false; END IF;

  v_archivo := pg_catalog.split_part(p_name, '/', 4);
  IF v_archivo NOT IN ('full.webp', 'thumb.webp') THEN RETURN false; END IF;

  BEGIN
    v_org := pg_catalog.split_part(p_name, '/', 1)::uuid;
    v_producto := pg_catalog.split_part(p_name, '/', 3)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;

  SELECT
    p.imagen_url,
    EXISTS (
      SELECT 1
      FROM public.producto_sucursal ps
      WHERE ps.producto_id = p.id
        AND ps.organizacion_id = p.organizacion_id
        AND noven_private.puede_ver_producto_sucursal(ps.sucursal_id, p.id)
    )
  INTO v_imagen_actual, v_visible
  FROM public.productos p
  WHERE p.id = v_producto
    AND p.organizacion_id = v_org;

  IF NOT FOUND OR NOT COALESCE(v_visible, false) THEN RETURN false; END IF;

  IF NULLIF(btrim(COALESCE(v_imagen_actual, '')), '') IS NULL THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.usuario_accesos ua
    WHERE ua.usuario_id = (SELECT auth.uid())
      AND ua.organizacion_id = v_org
      AND ua.activo = true
      AND ua.rol IN ('admin_organizacion', 'gerente_zonal', 'gerente_sucursal', 'supervisor')
  );
END;
$$;

REVOKE ALL ON FUNCTION noven_private.puede_insertar_imagen_catalogo_storage(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.puede_insertar_imagen_catalogo_storage(text)
  TO authenticated;

-- Índices que cubren todas las FK de la tabla de auditoría.
CREATE INDEX IF NOT EXISTS producto_imagen_cambios_org_idx
  ON public.producto_imagen_cambios(organizacion_id);
CREATE INDEX IF NOT EXISTS producto_imagen_cambios_producto_org_idx
  ON public.producto_imagen_cambios(producto_id, organizacion_id);
CREATE INDEX IF NOT EXISTS producto_imagen_cambios_sucursal_org_idx
  ON public.producto_imagen_cambios(sucursal_id, organizacion_id);
CREATE INDEX IF NOT EXISTS producto_imagen_cambios_usuario_idx
  ON public.producto_imagen_cambios(usuario_id);

COMMIT;
