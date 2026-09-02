CREATE OR REPLACE FUNCTION noven_private.puede_gestionar_invitacion_v1(p_actor_id uuid, p_invitacion_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.invitaciones_acceso ia
    JOIN public.usuarios actor ON actor.id=p_actor_id AND actor.activo=true
    WHERE ia.id=p_invitacion_id
      AND (
        (
          ia.rol IN ('gerente_zonal','gerente_sucursal')
          AND noven_private.es_administrador_jerarquia_v1(p_actor_id,ia.organizacion_id)
        )
        OR (
          ia.rol IN ('supervisor','operador')
          AND EXISTS (
            SELECT 1
            FROM public.usuario_accesos ua_local
            WHERE ua_local.usuario_id=p_actor_id
              AND ua_local.organizacion_id=ia.organizacion_id
              AND ua_local.rol='gerente_sucursal'
              AND ua_local.sucursal_id=ia.sucursal_id
              AND ua_local.activo=true
          )
        )
      )
  );
$function$

CREATE OR REPLACE FUNCTION noven_private.puede_insertar_imagen_catalogo_storage(p_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION noven_private.puede_leer_familia_sucursal(p_sucursal_id uuid, p_familia_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION noven_private.puede_leer_producto_sucursal(p_sucursal_id uuid, p_producto_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION noven_private.puede_reemplazar_imagen_producto(p_sucursal_id uuid, p_producto_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.productos p ON p.id = p_producto_id
    JOIN public.sucursales s
      ON s.id = p_sucursal_id
     AND s.organizacion_id = p.organizacion_id
     AND s.activa = true
    JOIN public.usuario_accesos ua
      ON ua.usuario_id = u.id
     AND ua.organizacion_id = p.organizacion_id
     AND ua.activo = true
    WHERE u.id = (SELECT auth.uid())
      AND u.activo = true
      AND ua.rol IN ('gerente_sucursal', 'supervisor')
      AND ua.sucursal_id = s.id
  );
$function$

CREATE OR REPLACE FUNCTION noven_private.puede_ver_familia_sucursal(p_sucursal_id uuid, p_familia_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$

CREATE OR REPLACE FUNCTION noven_private.puede_ver_producto_sucursal(p_sucursal_id uuid, p_producto_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'noven_private', 'pg_temp'
AS $function$
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
$function$
