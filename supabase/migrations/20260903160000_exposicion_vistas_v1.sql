-- =============================================================================
-- NOVEN · EXPOSICIÓN DE VISTAS V1  (Fase 2 · ítem 2.5)
--
-- Las vistas eran el punto ciego de la clasificación por exposición: el
-- relevamiento miraba tablas (`relkind = 'r'`) y las vistas quedaban afuera.
-- Al mirarlas aparecieron dos cosas.
--
-- 1. DIEZ VISTAS CON DML COMPLETO PARA `authenticated`
--
--    INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES y TRIGGER, además de SELECT.
--    Es el mismo patrón de `public.regiones` (ítem 2.2): grants que sobran y
--    cuya inocuidad depende de otra cosa. Acá esa otra cosa es que
--    `security_invoker` está activo y que `authenticated` sólo tiene SELECT
--    sobre las tablas base, así que un INSERT a través de la vista muere en el
--    permiso de la tabla base. Sigue siendo una escritura que nadie quiere
--    habilitada y que nadie declaró.
--
-- 2. `security_invoker` ESTABA BIEN, PERO NADA LO SOSTENÍA
--
--    Las doce vistas ya lo tenían en `true`, así que el aislamiento multitenant
--    se sostenía. Lo que no existía era algo que lo verificara: una vista nueva
--    creada sin la opción evalúa RLS como su dueño —`postgres`— y expone las
--    filas de TODAS las organizaciones a cualquier usuario autenticado, sin que
--    el gate de replay ni ningún contrato lo notaran.
--
--    Los `ALTER VIEW` de abajo son idempotentes y hoy no cambian nada. Están
--    para que la propiedad quede escrita en una migración en vez de existir
--    sólo como un hecho del catálogo que alguien configuró alguna vez.
--
-- QUÉ NO TOCA
--
-- No toca `service_role` ni `postgres`, ni la definición de ninguna vista, ni
-- ninguna política. No toca datos.
-- =============================================================================

BEGIN;

-- --- 1. Quitar la escritura que nadie declaró --------------------------------

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.v_acciones_operativas_historial,
  public.v_efectividad_intervencion_rag,
  public.v_efectividad_rag_operador,
  public.v_efectividad_rag_resumen,
  public.v_producto_sucursal_operativo,
  public.v_productos_catalogo,
  public.v_resultado_operador_rag,
  public.v_resultado_vencimiento_tramos,
  public.v_seguimiento_rag_actual,
  public.v_vencimientos_operativos
FROM authenticated;

-- La lectura es lo que la aplicación necesita, y queda explícita.
GRANT SELECT ON TABLE
  public.v_acciones_operativas_historial,
  public.v_efectividad_intervencion_rag,
  public.v_efectividad_rag_operador,
  public.v_efectividad_rag_resumen,
  public.v_producto_sucursal_operativo,
  public.v_productos_catalogo,
  public.v_resultado_operador_rag,
  public.v_resultado_vencimiento_tramos,
  public.v_seguimiento_rag_actual,
  public.v_vencimientos_operativos
TO authenticated;

-- --- 2. Dejar `security_invoker` escrito, no sólo configurado ---------------
--
-- Idempotente: las doce ya lo tienen. Es la condición para que una vista pueda
-- exponerse a `authenticated` sin romper el aislamiento.

ALTER VIEW public.v_acciones_operativas_historial SET (security_invoker = true);
ALTER VIEW public.v_efectividad_intervencion_rag  SET (security_invoker = true);
ALTER VIEW public.v_efectividad_rag_operador      SET (security_invoker = true);
ALTER VIEW public.v_efectividad_rag_resumen       SET (security_invoker = true);
ALTER VIEW public.v_problemas_economicos_historial SET (security_invoker = true);
ALTER VIEW public.v_producto_sucursal_operativo   SET (security_invoker = true);
ALTER VIEW public.v_productos_catalogo            SET (security_invoker = true);
ALTER VIEW public.v_resultado_operador_rag        SET (security_invoker = true);
ALTER VIEW public.v_resultado_vencimiento_tramos  SET (security_invoker = true);
ALTER VIEW public.v_seguimiento_rag_actual        SET (security_invoker = true);
ALTER VIEW public.v_vencimientos_operativos       SET (security_invoker = true);
ALTER VIEW public.vw_usuarios_completos           SET (security_invoker = true);

COMMIT;
