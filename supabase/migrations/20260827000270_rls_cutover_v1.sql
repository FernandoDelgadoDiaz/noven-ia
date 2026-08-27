-- =============================================================================
-- NOVEN · RLS CUTOVER MULTITENANT V1
--
-- OBJETIVO
--   El navegador deja de tener DML directo sobre las tablas operativas. Lee sólo
--   mediante RLS/column grants y escribe mediante RPCs/endpoints ya endurecidos.
--
-- IMPORTANTE
--   - NO modifica tablas ni policies `desafio5s_*`.
--   - NO modifica storage.
--   - NO modifica las reglas de riesgo 45/20/10.
--   - Debe probarse en una branch descartable antes de producción.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. PRODUCTOS — catálogo compartido por organización, SIN estado legacy 091.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS productos_select_authenticated ON public.productos;
DROP POLICY IF EXISTS productos_select ON public.productos;
DROP POLICY IF EXISTS productos_insert_admin ON public.productos;
DROP POLICY IF EXISTS productos_insert_operador_familia ON public.productos;
DROP POLICY IF EXISTS productos_update_admin ON public.productos;
DROP POLICY IF EXISTS productos_update_operador_familia ON public.productos;
DROP POLICY IF EXISTS productos_insert ON public.productos;
DROP POLICY IF EXISTS productos_update ON public.productos;

-- `productos_select_scope_v1` fue creada en 20260826000350 y queda como única
-- policy browser de lectura del catálogo por organización.

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

-- Deliberadamente NO se otorga SELECT sobre productos.stock_actual ni
-- productos.venta_media_diaria. Son espejo legacy de 091, no estado multitienda.

-- -----------------------------------------------------------------------------
-- 2. ESTADO SKU × SUCURSAL Y CÓDIGOS — lectura RLS, escritura sólo RPC/server.
-- -----------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON TABLE public.producto_sucursal FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.producto_codigos FROM authenticated;
GRANT SELECT ON TABLE public.producto_sucursal TO authenticated;
GRANT SELECT ON TABLE public.producto_codigos TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. VENCIMIENTOS — eliminar todas las rutas legacy de escritura/lectura abierta.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS vencimientos_select_authenticated ON public.vencimientos;
DROP POLICY IF EXISTS vencimientos_select ON public.vencimientos;
DROP POLICY IF EXISTS vencimientos_insert ON public.vencimientos;
DROP POLICY IF EXISTS vencimientos_insert_own ON public.vencimientos;
DROP POLICY IF EXISTS vencimientos_update ON public.vencimientos;
DROP POLICY IF EXISTS vencimientos_update_own ON public.vencimientos;
DROP POLICY IF EXISTS vencimientos_update_admin_o_familia ON public.vencimientos;
DROP POLICY IF EXISTS vencimientos_delete_own ON public.vencimientos;
DROP POLICY IF EXISTS vencimientos_delete_admin_o_familia ON public.vencimientos;

DROP POLICY IF EXISTS vencimientos_select_scope_v1 ON public.vencimientos;
CREATE POLICY vencimientos_select_scope_v1
  ON public.vencimientos
  FOR SELECT
  TO authenticated
  USING (noven_private.puede_ver_producto_sucursal(sucursal_id, producto_id));

REVOKE INSERT, UPDATE, DELETE ON TABLE public.vencimientos FROM authenticated;
GRANT SELECT ON TABLE public.vencimientos TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. ACCIONES TERMINALES — sólo lectura scoped; cierre siempre por RPC.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS acciones_select_sucursal ON public.acciones_operativas;
DROP POLICY IF EXISTS acciones_select ON public.acciones_operativas;
DROP POLICY IF EXISTS "usuarios autenticados pueden leer acciones" ON public.acciones_operativas;
DROP POLICY IF EXISTS acciones_insert ON public.acciones_operativas;
DROP POLICY IF EXISTS "usuarios autenticados pueden insertar acciones" ON public.acciones_operativas;
DROP POLICY IF EXISTS acciones_operativas_insert_scope_v1 ON public.acciones_operativas;

-- `acciones_operativas_select_scope_v1` queda como contrato de lectura.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.acciones_operativas FROM authenticated;
GRANT SELECT ON TABLE public.acciones_operativas TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. HISTORIA DE CONTROLES Y RAG — append-only vía RPC; lectura scoped.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS venc_obs_insert_scope ON public.vencimiento_observaciones;
DROP POLICY IF EXISTS rag_insert_scope ON public.intervenciones_rag;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.vencimiento_observaciones FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.intervenciones_rag FROM authenticated;
GRANT SELECT ON TABLE public.vencimiento_observaciones TO authenticated;
GRANT SELECT ON TABLE public.intervenciones_rag TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. SUCURSALES / SECTORES / FAMILIAS — lectura tenant-scoped, sin DML browser.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS sucursales_select ON public.sucursales;
DROP POLICY IF EXISTS sucursales_select_authenticated ON public.sucursales;
DROP POLICY IF EXISTS sucursales_insert_admin ON public.sucursales;
DROP POLICY IF EXISTS sucursales_update_admin ON public.sucursales;

DROP POLICY IF EXISTS sectores_select ON public.sectores;
DROP POLICY IF EXISTS sectores_select_authenticated ON public.sectores;

DROP POLICY IF EXISTS familias_select ON public.familias;
DROP POLICY IF EXISTS familias_select_authenticated ON public.familias;

-- Quedan:
--   sucursales_select_scope_v1
--   sectores_select_scope_v1
--   familias_select_scope_v1
REVOKE INSERT, UPDATE, DELETE ON TABLE public.sucursales FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.sectores FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.familias FROM authenticated;
GRANT SELECT ON TABLE public.sucursales TO authenticated;
GRANT SELECT ON TABLE public.sectores TO authenticated;
GRANT SELECT ON TABLE public.familias TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. USUARIOS — el browser sólo necesita leer SU propio perfil legacy.
-- Admin V2 opera por endpoint service-role + RPC server-only.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS usuarios_select_authenticated ON public.usuarios;
DROP POLICY IF EXISTS usuarios_insert_own ON public.usuarios;
DROP POLICY IF EXISTS usuarios_insert_self ON public.usuarios;
DROP POLICY IF EXISTS usuarios_update_admin ON public.usuarios;
DROP POLICY IF EXISTS usuarios_update_own ON public.usuarios;
DROP POLICY IF EXISTS usuarios_update_admin_or_self ON public.usuarios;

DROP POLICY IF EXISTS usuarios_select_own ON public.usuarios;
CREATE POLICY usuarios_select_own
  ON public.usuarios
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.usuarios FROM authenticated;
GRANT SELECT ON TABLE public.usuarios TO authenticated;

-- Vista admin legacy: ya no forma parte del flujo activo y no debe convertirse
-- en una vía lateral para enumerar perfiles/asignaciones.
REVOKE ALL ON TABLE public.vw_usuarios_completos FROM authenticated;

-- -----------------------------------------------------------------------------
-- 8. ASIGNACIÓN LEGACY GLOBAL — retirada de la superficie browser.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS usuario_familias_admin ON public.usuario_familias;
DROP POLICY IF EXISTS usuario_familias_select ON public.usuario_familias;
DROP POLICY IF EXISTS usuario_familias_select_authenticated ON public.usuario_familias;
DROP POLICY IF EXISTS usuario_familias_insert_authenticated ON public.usuario_familias;
DROP POLICY IF EXISTS usuario_familias_delete_authenticated ON public.usuario_familias;

REVOKE ALL ON TABLE public.usuario_familias FROM authenticated;

-- La autorización vigente vive en:
--   usuario_accesos
--   usuario_familias_sucursal
-- Ambas tablas ya nacieron sin DML browser y con lectura propia.

-- -----------------------------------------------------------------------------
-- 9. Verificación estructural de seguridad dentro de la misma transacción.
-- Si una policy legacy crítica siguiera existiendo con USING(true), abortar.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_abiertas integer;
BEGIN
  SELECT count(*)
  INTO v_abiertas
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename IN (
      'productos',
      'vencimientos',
      'acciones_operativas',
      'sucursales',
      'sectores',
      'familias',
      'usuarios',
      'usuario_familias'
    )
    AND p.cmd = 'SELECT'
    AND lower(regexp_replace(COALESCE(p.qual, ''), '\\s+', '', 'g')) IN ('true', '(true)');

  IF v_abiertas > 0 THEN
    RAISE EXCEPTION
      'Cutover abortado: todavía existen % policy/policies SELECT USING(true) en tablas Noven críticas',
      v_abiertas;
  END IF;
END;
$$;

COMMIT;
