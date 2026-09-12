-- Evita que /activar cambie la contraseña de una sesión persistida que no
-- corresponde a la invitación abierta. La validación ocurre antes de Auth.

CREATE OR REPLACE FUNCTION public.validar_invitacion_pendiente_v1()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT count(*)::integer
  FROM public.invitaciones_acceso ia
  JOIN auth.users au
    ON au.id = (SELECT auth.uid())
   AND au.id = ia.usuario_id
   AND lower(btrim(au.email)) = lower(btrim(ia.email))
  WHERE ia.estado = 'pendiente'
    AND ia.expires_at > now();
$$;

REVOKE ALL ON FUNCTION public.validar_invitacion_pendiente_v1()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validar_invitacion_pendiente_v1()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.validar_invitacion_pendiente_v1() IS
  'Confirma que la identidad Auth actual posee una invitación pendiente y vigente con el mismo email antes de permitir un cambio de contraseña.';
