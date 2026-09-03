-- =============================================================================
-- NOVEN · REGIONES SOLO SELECT V1  (Fase 2 · ítem 2.2)
--
-- `public.regiones` es la única tabla de negocio con DML abierto a
-- `authenticated`. Hoy tiene:
--
--   DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--
-- La única otra tabla con grants de escritura es la de suscripciones push, y
-- esa es legítima: el browser registra su propia suscripción, y el contrato
-- de escrituras desde el cliente la exceptúa explícitamente por eso.
-- `regiones` no tiene ningún escritor desde el cliente.
--
-- POR QUÉ IMPORTA SI HOY NO ES EXPLOTABLE
--
-- No lo es: la única política de la tabla, `regiones_select_scope`, cubre
-- `SELECT`. Un INSERT desde un cliente autenticado sería rechazado por RLS al
-- no encontrar política permisiva de escritura.
--
-- Pero eso quiere decir que la protección depende de una AUSENCIA —que nadie
-- haya escrito todavía una política de escritura— y no de una negativa. El día
-- que alguien agregue una política `FOR ALL` o `FOR INSERT` sobre `regiones`,
-- el grant ya está puesto y la escritura queda habilitada sin que nadie vuelva
-- a discutirlo. Revocar ahora convierte esa ausencia en una decisión.
--
-- QUÉ NO TOCA
--
-- No toca la política RLS, ni `service_role`, ni `postgres`. Las Netlify
-- Functions escriben con `service_role`, que conserva su grant intacto.
-- =============================================================================

BEGIN;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.regiones
  FROM authenticated;

-- Explícito en vez de implícito: la lectura acotada por
-- `noven_private.tiene_acceso_organizacion(organizacion_id)` es lo que la
-- aplicación necesita y lo único que queda.
GRANT SELECT ON TABLE public.regiones TO authenticated;

COMMIT;
