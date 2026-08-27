-- =============================================================================
-- NOVEN · HISTORIAL DE ACCIONES OPERATIVAS CON SCOPE V1
--
-- Prepara Dashboard/Historial para cerrar las policies SELECT true legacy.
-- El nombre del actor se expone únicamente cuando el caller puede ver el
-- producto/sucursal de esa acción; no requiere abrir public.usuarios.
-- =============================================================================

BEGIN;

CREATE POLICY acciones_operativas_select_scope_v1
  ON public.acciones_operativas
  FOR SELECT
  TO authenticated
  USING (
    noven_private.puede_ver_producto_sucursal(sucursal_id, producto_id)
  );

CREATE POLICY acciones_operativas_insert_scope_v1
  ON public.acciones_operativas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = (SELECT auth.uid())
    AND noven_private.puede_ver_producto_sucursal(sucursal_id, producto_id)
  );

CREATE OR REPLACE FUNCTION noven_private.nombre_actor_accion_visible(
  p_usuario_id uuid,
  p_sucursal_id uuid,
  p_producto_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_nombre text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT noven_private.puede_ver_producto_sucursal(p_sucursal_id, p_producto_id) THEN
    RETURN NULL;
  END IF;

  SELECT u.nombre
  INTO v_nombre
  FROM public.usuarios u
  WHERE u.id = p_usuario_id;

  RETURN v_nombre;
END;
$$;

REVOKE ALL ON FUNCTION noven_private.nombre_actor_accion_visible(uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION noven_private.nombre_actor_accion_visible(uuid, uuid, uuid)
  TO authenticated;

CREATE OR REPLACE VIEW public.v_acciones_operativas_historial
WITH (security_invoker = true)
AS
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
  noven_private.nombre_actor_accion_visible(
    a.usuario_id,
    a.sucursal_id,
    a.producto_id
  ) AS usuario_nombre,
  p.descripcion AS producto_descripcion,
  p.marca AS producto_marca,
  p.imagen_url AS producto_imagen_url,
  p.familia_id AS producto_familia_id
FROM public.acciones_operativas a
JOIN public.productos p ON p.id = a.producto_id;

REVOKE ALL ON TABLE public.v_acciones_operativas_historial FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.v_acciones_operativas_historial TO authenticated;

COMMENT ON VIEW public.v_acciones_operativas_historial IS
  'Historial operativo con RLS invoker y nombre de actor visible sólo dentro del scope producto×sucursal.';

COMMIT;