-- =============================================================================
-- NOVEN · P0 MULTITENANT SECURITY HARDENING V1
--
-- Corrige tres riesgos detectados en auditoría de producción:
-- 1) Historial debe ejecutar con permisos del caller (security_invoker).
-- 2) El webhook urgente debe transportar la sucursal exacta del vencimiento.
-- 3) El cálculo de días del push usa fecha operacional Argentina y no CURRENT_DATE UTC.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Historial: impedir que la vista saltee RLS de acciones_operativas/productos.
--    Una migración posterior de identidad de producto recreó accidentalmente la
--    vista sin security_invoker. Lo fijamos explícitamente sin alterar columnas.
-- -----------------------------------------------------------------------------
ALTER VIEW public.v_acciones_operativas_historial
  SET (security_invoker = true);

REVOKE ALL ON TABLE public.v_acciones_operativas_historial FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.v_acciones_operativas_historial TO authenticated;

COMMENT ON VIEW public.v_acciones_operativas_historial IS
  'Historial operativo con identidad completa del artículo y RLS ejecutado con permisos del caller (security_invoker).';

-- -----------------------------------------------------------------------------
-- 2. Push urgente: el trigger entrega el contexto autoritativo de sucursal.
--    La selección de destinatarios queda a cargo de la Netlify Function usando
--    usuario_accesos + usuario_familias_sucursal. Ya no debe depender de roles
--    legacy globales.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_push_urgente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_nombre text;
  v_familia uuid;
  v_dias integer;
  v_webhook_secret text;
  v_fecha_operacional date;
BEGIN
  IF NEW.nivel_actual = 'urgente'
     AND NEW.nivel_actual IS DISTINCT FROM OLD.nivel_actual THEN

    SELECT p.descripcion, p.familia_id
      INTO v_nombre, v_familia
    FROM public.productos p
    WHERE p.id = NEW.producto_id;

    v_fecha_operacional := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
    v_dias := NEW.fecha_vencimiento - v_fecha_operacional;

    SELECT ds.decrypted_secret
      INTO v_webhook_secret
    FROM vault.decrypted_secrets ds
    WHERE ds.name = 'noven_push_webhook_secret'
    LIMIT 1;

    IF v_webhook_secret IS NULL OR v_webhook_secret = '' THEN
      RAISE WARNING 'NoVen push secret no disponible; push omitido para vencimiento %', NEW.id;
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := 'https://noven-ia.netlify.app/.netlify/functions/enviar-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_webhook_secret
      ),
      body := jsonb_build_object(
        'vencimiento_id', NEW.id,
        'sucursal_id', NEW.sucursal_id,
        'producto_nombre', v_nombre,
        'dias_restantes', v_dias,
        'familia_id', v_familia
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_push_urgente() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.notify_push_urgente() IS
  'Dispara push al entrar en urgente y entrega sucursal exacta para targeting multitenant; usa fecha operacional Argentina.';

COMMIT;
