-- =============================================================================
-- NOVEN · RLS GRANTS HARDENING V1
--
-- El cutover 00270 cerró DML browser, pero varias tablas legacy conservaban
-- privilegios SQL heredados que no forman parte del contrato web (TRUNCATE,
-- REFERENCES y TRIGGER). Esta migración aplica mínimo privilegio estricto:
-- browser = SELECT con RLS/column grants; writes = RPC/endpoints endurecidos.
-- =============================================================================

BEGIN;

-- Catálogo: SELECT sólo por columnas seguras; nunca stock/VMD legacy de 091.
REVOKE ALL ON TABLE public.productos FROM authenticated;
GRANT SELECT (
  id,
  organizacion_id,
  cod_art,
  codigo_barras,
  descripcion,
  marca,
  gramaje,
  categoria,
  proveedor,
  sector,
  precio_costo,
  imagen_url,
  familia_id,
  activo,
  created_at,
  updated_at
) ON TABLE public.productos TO authenticated;

-- Tablas browser read-only después del cutover.
REVOKE ALL ON TABLE public.producto_sucursal FROM authenticated;
REVOKE ALL ON TABLE public.producto_codigos FROM authenticated;
REVOKE ALL ON TABLE public.vencimientos FROM authenticated;
REVOKE ALL ON TABLE public.acciones_operativas FROM authenticated;
REVOKE ALL ON TABLE public.vencimiento_observaciones FROM authenticated;
REVOKE ALL ON TABLE public.intervenciones_rag FROM authenticated;
REVOKE ALL ON TABLE public.sucursales FROM authenticated;
REVOKE ALL ON TABLE public.sectores FROM authenticated;
REVOKE ALL ON TABLE public.familias FROM authenticated;
REVOKE ALL ON TABLE public.usuarios FROM authenticated;
REVOKE ALL ON TABLE public.usuario_accesos FROM authenticated;
REVOKE ALL ON TABLE public.usuario_familias_sucursal FROM authenticated;

GRANT SELECT ON TABLE public.producto_sucursal TO authenticated;
GRANT SELECT ON TABLE public.producto_codigos TO authenticated;
GRANT SELECT ON TABLE public.vencimientos TO authenticated;
GRANT SELECT ON TABLE public.acciones_operativas TO authenticated;
GRANT SELECT ON TABLE public.vencimiento_observaciones TO authenticated;
GRANT SELECT ON TABLE public.intervenciones_rag TO authenticated;
GRANT SELECT ON TABLE public.sucursales TO authenticated;
GRANT SELECT ON TABLE public.sectores TO authenticated;
GRANT SELECT ON TABLE public.familias TO authenticated;
GRANT SELECT ON TABLE public.usuarios TO authenticated;
GRANT SELECT ON TABLE public.usuario_accesos TO authenticated;
GRANT SELECT ON TABLE public.usuario_familias_sucursal TO authenticated;

-- Legacy retirado del browser.
REVOKE ALL ON TABLE public.usuario_familias FROM authenticated;
REVOKE ALL ON TABLE public.vw_usuarios_completos FROM authenticated;

-- Verificación: ninguna tabla operativa puede conservar privilegios de escritura
-- o DDL auxiliar para authenticated.
DO $$
DECLARE
  v_tabla text;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY[
    'producto_sucursal',
    'producto_codigos',
    'vencimientos',
    'acciones_operativas',
    'vencimiento_observaciones',
    'intervenciones_rag',
    'sucursales',
    'sectores',
    'familias',
    'usuarios',
    'usuario_accesos',
    'usuario_familias_sucursal',
    'usuario_familias'
  ] LOOP
    IF has_table_privilege('authenticated', format('public.%I', v_tabla), 'INSERT')
       OR has_table_privilege('authenticated', format('public.%I', v_tabla), 'UPDATE')
       OR has_table_privilege('authenticated', format('public.%I', v_tabla), 'DELETE')
       OR has_table_privilege('authenticated', format('public.%I', v_tabla), 'TRUNCATE')
       OR has_table_privilege('authenticated', format('public.%I', v_tabla), 'REFERENCES')
       OR has_table_privilege('authenticated', format('public.%I', v_tabla), 'TRIGGER') THEN
      RAISE EXCEPTION 'Hardening abortado: authenticated conserva privilegios extra sobre %', v_tabla;
    END IF;
  END LOOP;

  IF has_table_privilege('authenticated', 'public.productos', 'INSERT')
     OR has_table_privilege('authenticated', 'public.productos', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.productos', 'DELETE')
     OR has_table_privilege('authenticated', 'public.productos', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.productos', 'REFERENCES')
     OR has_table_privilege('authenticated', 'public.productos', 'TRIGGER') THEN
    RAISE EXCEPTION 'Hardening abortado: authenticated conserva privilegios extra sobre productos';
  END IF;
END;
$$;

COMMIT;
