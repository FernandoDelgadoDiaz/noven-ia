-- =============================================================================
-- NOVEN · REPARACIÓN: la instrumentación del RAG nunca pudo ejecutarse
--
-- QUÉ PASÓ
--
-- `20260904120000_rag_cobertura_escala_e_instrumentacion_v1.sql` creó
-- `public.instrumentar_sugerencia_rag` como wrapper SECURITY INVOKER sobre
-- `noven_private.instrumentar_sugerencia_rag_impl`, y le revocó EXECUTE sobre la
-- implementación a `authenticated`.
--
-- Un wrapper SECURITY INVOKER corre con los privilegios de QUIEN LLAMA. Sin
-- EXECUTE sobre la implementación, cada llamada muere con
-- `permission denied for function instrumentar_sugerencia_rag_impl`.
--
-- La RPC quedó concedida y a la vez inutilizable desde el 2026-09-04.
--
-- LA EVIDENCIA
--
-- En producción, al momento de escribir esto: 17 intervenciones registradas,
-- CERO con `cobertura_al_sugerir`, `escalones_sugeridos` u `origen_sugerencia`
-- —incluida la única creada después de que la migración se aplicara—. El ACL de
-- la implementación era `{postgres=X/postgres}`: sólo postgres podía ejecutarla.
--
-- No se notó antes porque el frontend traga el error:
-- `EditarVencimientoModalSeguro.tsx` guarda el `error` en una variable y lo
-- manda a `console.error`. El RAG se registra bien; lo que se pierde en silencio
-- es la instrumentación, que es justamente la evidencia con la que después se
-- iba a confrontar la regla contra la realidad.
--
-- POR QUÉ EL GRANT NO DEBILITA NADA
--
-- El aislamiento de `noven_private` no lo da este permiso sino que el esquema no
-- está entre los expuestos por PostgREST: nadie puede llamar a la implementación
-- por HTTP aunque tenga EXECUTE. Es el patrón que ya usan las trece RPC que sí
-- funcionan —`registrar_control_vencimiento_impl`,
-- `registrar_intervencion_rag_impl` y las demás—, todas con
-- `authenticated=X/postgres` en su ACL.
--
-- NO SE EDITA LA MIGRACIÓN APLICADA. Esta es nueva y sólo corrige el permiso.
-- No toca la función, ni su cuerpo, ni ningún dato.
--
-- LO QUE ESTA MIGRACIÓN NO PUEDE HACER
--
-- Recuperar la instrumentación de las 17 intervenciones ya registradas. Ese dato
-- no se generó y no se inventa: quedan con sus columnas en NULL, que es la
-- verdad —nadie las instrumentó—. Desde acá en adelante sí se registra.
-- =============================================================================

REVOKE ALL ON FUNCTION noven_private.instrumentar_sugerencia_rag_impl(uuid, numeric, smallint, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION noven_private.instrumentar_sugerencia_rag_impl(uuid, numeric, smallint, text)
  TO authenticated;
