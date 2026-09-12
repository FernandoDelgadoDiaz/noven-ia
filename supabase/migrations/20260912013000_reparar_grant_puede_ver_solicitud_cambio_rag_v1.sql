-- =============================================================================
-- NOVEN · REPARACIÓN · EL GRANT QUE FALTÓ EN EL HELPER DE RLS DEL CIRCUITO
--
-- EL DEFECTO, TAL COMO SE VIO. La tarjeta de control mostraba en rojo:
--
--     permission denied for function puede_ver_solicitud_cambio_rag
--
-- Reproducido contra producción como el gerente de la 091: los tres objetos del
-- circuito fallaban con 42501 —`solicitudes_cambio_rag`,
-- `solicitud_cambio_rag_eventos` y la vista `v_solicitudes_cambio_rag_actual`—
-- mientras `v_seguimiento_rag_actual` seguía respondiendo. Por eso el síntoma
-- era parcial: la tarjeta cargaba y el estado de la solicitud no.
--
-- LA CAUSA. `20260909020007` creó el helper y escribió:
--
--     REVOKE ALL ON FUNCTION noven_private.puede_ver_solicitud_cambio_rag(...)
--       FROM PUBLIC, anon, authenticated;
--
-- y nunca escribió el GRANT correspondiente. El REVOKE era correcto —saca a
-- `anon` y los defaults amplios de Supabase—, pero se llevó puesto también al
-- rol que sí lo necesita.
--
-- POR QUÉ ACÁ EL GRANT NO ES OPCIONAL. La función es el guard de dos políticas
-- RLS:
--
--     solicitudes_cambio_rag_select_scope
--     solicitud_cambio_rag_eventos_select_scope
--
-- y una política RLS SE EVALÚA CON LOS PRIVILEGIOS DE QUIEN CONSULTA, no con
-- los del dueño. No hay ningún SECURITY DEFINER en el medio que preste sus
-- permisos: el invocador es `authenticated` directamente. Sin EXECUTE, la
-- política no puede evaluarse y la tabla entera queda inaccesible.
--
-- Es la misma familia que D-7 y que la reparación `20260905190500`, y la regla
-- ya está escrita en `ai/rules.md`: revocarle a `authenticated` «parece más
-- seguro y se escribe solo», y deja el objeto concedido e inutilizable a la vez.
-- Lo nuevo es el lugar: hasta ahora el caso conocido era el wrapper INVOKER
-- sobre un `_impl`; éste es un helper de política, donde la dependencia del
-- privilegio del invocador es todavía menos visible al leer el SQL.
--
-- EL AISLAMIENTO NO SE APOYA EN ESTE REVOKE. Sigue viniendo de que
-- `noven_private` no está expuesto por PostgREST, de que la función es STABLE y
-- de sólo lectura, y de que lo que decide qué filas se ven es su propio cuerpo
-- contra `usuario_accesos`. Conceder EXECUTE no amplía lo que nadie puede ver:
-- habilita que la política pueda correr.
--
-- ALCANCE. Sólo `authenticated`, que es lo que está roto. `anon` queda afuera.
-- `service_role` tampoco lo necesita: no evalúa RLS.
--
-- AUDITADAS Y CORRECTAS, para no arreglar de más. Las otras funciones del
-- circuito sin EXECUTE para `authenticated` lo están A PROPÓSITO:
--   · `noven_private.jornada_rag_zonal_v1` — sólo se llama desde dentro de
--     DEFINERs cuyo dueño sí puede ejecutarla.
--   · `public.configurar_jornada_rag_zonal_v1` — concedida a `service_role`, se
--     llama desde una Netlify Function con esa clave.
--   · `noven_private.validar_evento_solicitud_cambio_rag` — función de trigger;
--     PostgreSQL verifica EXECUTE al crear el trigger, no al dispararlo.
-- =============================================================================

GRANT EXECUTE ON FUNCTION
  noven_private.puede_ver_solicitud_cambio_rag(uuid, uuid, uuid, uuid)
  TO authenticated;

COMMENT ON FUNCTION
  noven_private.puede_ver_solicitud_cambio_rag(uuid, uuid, uuid, uuid) IS
  'Guard de alcance de las políticas RLS de solicitudes_cambio_rag y sus eventos. Una política se evalúa con los privilegios de quien consulta, así que authenticated NECESITA EXECUTE: sin él la política no corre y la tabla queda inaccesible. El aislamiento lo da el cuerpo de la función contra usuario_accesos y que noven_private no esté expuesto por PostgREST, no la ausencia de este grant.';
