-- =============================================================================
-- NOVEN · POST-CUTOVER SECURITY V1
--
-- - Saca el webhook secret del cuerpo de notify_push_urgente().
-- - El secreto se provisiona fuera de migraciones en Supabase Vault.
-- - El trigger lee Vault sólo en runtime y no queda expuesto como RPC.
-- - Fija search_path en helpers de trigger.
-- - Agrega el índice FK faltante por sucursal en acciones_operativas.
--
-- Esta migración NO contiene ningún secreto.
-- =============================================================================

BEGIN;

ALTER FUNCTION public.handle_updated_at()
  SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.notify_push_urgente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_nombre         text;
  v_familia        uuid;
  v_dias           integer;
  v_webhook_secret text;
BEGIN
  IF NEW.nivel_actual = 'urgente'
     AND NEW.nivel_actual IS DISTINCT FROM OLD.nivel_actual THEN

    SELECT p.descripcion, p.familia_id
      INTO v_nombre, v_familia
      FROM public.productos p
     WHERE p.id = NEW.producto_id;

    v_dias := NEW.fecha_vencimiento - CURRENT_DATE;

    SELECT ds.decrypted_secret
      INTO v_webhook_secret
      FROM vault.decrypted_secrets ds
     WHERE ds.name = 'noven_push_webhook_secret'
     LIMIT 1;

    -- Push es best-effort: nunca debe bloquear una actualización operativa
    -- si el secreto de infraestructura no está provisionado en un entorno.
    IF v_webhook_secret IS NULL OR v_webhook_secret = '' THEN
      RAISE WARNING 'NoVen push secret no disponible; push omitido para vencimiento %', NEW.id;
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url     := 'https://noven-ia.netlify.app/.netlify/functions/enviar-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_webhook_secret
      ),
      body    := jsonb_build_object(
        'vencimiento_id', NEW.id,
        'producto_nombre', v_nombre,
        'dias_restantes', v_dias,
        'familia_id', v_familia
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_push_urgente()
  FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS acciones_operativas_sucursal_idx
  ON public.acciones_operativas(sucursal_id);

COMMIT;
