-- =============================================================================
-- NOVEN · GERENTE ZONAL READ-ONLY
--
-- `puede_ver_*` queda como autorización OPERATIVA porque es el helper histórico
-- consumido por Scanner/RPCs de escritura. Se crean helpers `puede_leer_*` para
-- RLS de lectura, donde sí participa gerente_zonal dentro de su zona.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION noven_private.puede_leer_familia_sucursal(
  p_sucursal_id uuid,
  p_familia_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.sucursales s ON s.id=p_sucursal_id AND s.activa=true
    JOIN public.familias f ON f.id=p_familia_id AND f.organizacion_id=s.organizacion_id
    JOIN public.usuario_accesos ua
      ON ua.usuario_id=u.id
     AND ua.organizacion_id=s.organizacion_id
     AND ua.activo=true
    WHERE u.id=(SELECT auth.uid())
      AND u.activo=true
      AND (
        (ua.rol='gerente_zonal' AND ua.zona_id=s.zona_id)
        OR (ua.rol IN ('gerente_sucursal','supervisor') AND ua.sucursal_id=s.id)
        OR (
          ua.rol='operador'
          AND ua.sucursal_id=s.id
          AND EXISTS (
            SELECT 1
            FROM public.usuario_familias_sucursal ufs
            WHERE ufs.usuario_id=ua.usuario_id
              AND ufs.organizacion_id=s.organizacion_id
              AND ufs.sucursal_id=s.id
              AND ufs.familia_id=f.id
              AND ufs.activo=true
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION noven_private.puede_leer_producto_sucursal(
  p_sucursal_id uuid,
  p_producto_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public','noven_private','pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.productos p
    JOIN public.sucursales s
      ON s.id=p_sucursal_id
     AND s.organizacion_id=p.organizacion_id
     AND s.activa=true
    WHERE p.id=p_producto_id
      AND p.familia_id IS NOT NULL
      AND noven_private.puede_leer_familia_sucursal(p_sucursal_id,p.familia_id)
  );
$$;

-- Helper histórico = operación. No admin_organizacion ni gerente_zonal.
CREATE OR REPLACE FUNCTION noven_private.puede_ver_familia_sucursal(
  p_sucursal_id uuid,
  p_familia_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.sucursales s ON s.id=p_sucursal_id AND s.activa=true
    JOIN public.familias f ON f.id=p_familia_id AND f.organizacion_id=s.organizacion_id
    JOIN public.usuario_accesos ua
      ON ua.usuario_id=u.id
     AND ua.organizacion_id=s.organizacion_id
     AND ua.activo=true
    WHERE u.id=(SELECT auth.uid())
      AND u.activo=true
      AND (
        (ua.rol IN ('gerente_sucursal','supervisor') AND ua.sucursal_id=s.id)
        OR (
          ua.rol='operador'
          AND ua.sucursal_id=s.id
          AND EXISTS (
            SELECT 1
            FROM public.usuario_familias_sucursal ufs
            WHERE ufs.usuario_id=ua.usuario_id
              AND ufs.organizacion_id=s.organizacion_id
              AND ufs.sucursal_id=s.id
              AND ufs.familia_id=f.id
              AND ufs.activo=true
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION noven_private.puede_ver_producto_sucursal(
  p_sucursal_id uuid,
  p_producto_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public','noven_private','pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.productos p
    JOIN public.sucursales s
      ON s.id=p_sucursal_id
     AND s.organizacion_id=p.organizacion_id
     AND s.activa=true
    WHERE p.id=p_producto_id
      AND p.familia_id IS NOT NULL
      AND noven_private.puede_ver_familia_sucursal(p_sucursal_id,p.familia_id)
  );
$$;

-- Las lecturas zonales usan explícitamente los helpers read-only.
DROP POLICY IF EXISTS producto_sucursal_select_scope ON public.producto_sucursal;
CREATE POLICY producto_sucursal_select_scope
ON public.producto_sucursal
FOR SELECT
USING (noven_private.puede_leer_producto_sucursal(sucursal_id,producto_id));

DROP POLICY IF EXISTS vencimientos_select_scope_v1 ON public.vencimientos;
CREATE POLICY vencimientos_select_scope_v1
ON public.vencimientos
FOR SELECT
USING (noven_private.puede_leer_producto_sucursal(sucursal_id,producto_id));

DROP POLICY IF EXISTS venc_obs_select_scope ON public.vencimiento_observaciones;
CREATE POLICY venc_obs_select_scope
ON public.vencimiento_observaciones
FOR SELECT
USING (noven_private.puede_leer_producto_sucursal(sucursal_id,producto_id));

DROP POLICY IF EXISTS rag_select_scope ON public.intervenciones_rag;
CREATE POLICY rag_select_scope
ON public.intervenciones_rag
FOR SELECT
USING (noven_private.puede_leer_producto_sucursal(sucursal_id,producto_id));

DROP POLICY IF EXISTS acciones_operativas_select_scope_v1 ON public.acciones_operativas;
CREATE POLICY acciones_operativas_select_scope_v1
ON public.acciones_operativas
FOR SELECT
USING (noven_private.puede_leer_producto_sucursal(sucursal_id,producto_id));

-- Un zonal que lee una acción dentro de su zona puede ver el nombre del actor,
-- sin que eso le conceda ninguna escritura.
CREATE OR REPLACE FUNCTION noven_private.nombre_actor_accion_visible(
  p_usuario_id uuid,
  p_sucursal_id uuid,
  p_producto_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_nombre text;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  IF NOT noven_private.puede_leer_producto_sucursal(p_sucursal_id,p_producto_id) THEN RETURN NULL; END IF;
  SELECT u.nombre INTO v_nombre FROM public.usuarios u WHERE u.id=p_usuario_id;
  RETURN v_nombre;
END;
$$;

REVOKE ALL ON FUNCTION noven_private.puede_leer_familia_sucursal(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION noven_private.puede_leer_producto_sucursal(uuid,uuid)
  FROM PUBLIC,anon,authenticated;

COMMIT;
