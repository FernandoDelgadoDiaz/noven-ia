-- =============================================================================
-- NOVEN · WRITERS OPERATIVOS PRIVADOS V1
--
-- Los RPC operativos ya validan auth.uid() + scope sucursal/familia, pero varios
-- seguían siendo SECURITY INVOKER y por eso dependían de grants DML directos al
-- navegador. Esta migración conserva los contratos públicos y mueve la ejecución
-- privilegiada a `noven_private`, preparando el cutover RLS sin abrir tablas.
--
-- NO modifica reglas de negocio 45/20/10 ni la semántica de vendido/donación/
-- decomiso. Sólo cambia el límite de privilegios de escritura.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Renombrar las implementaciones validadas existentes.
-- -----------------------------------------------------------------------------
ALTER FUNCTION public.registrar_control_vencimiento(uuid, numeric, text)
  RENAME TO registrar_control_vencimiento_invoker_v1;
ALTER FUNCTION public.registrar_intervencion_rag(uuid, numeric, text)
  RENAME TO registrar_intervencion_rag_invoker_v1;
ALTER FUNCTION public.crear_vencimiento_operador(uuid, uuid, numeric, date, text)
  RENAME TO crear_vencimiento_operador_invoker_v1;
ALTER FUNCTION public.actualizar_vencimiento_operador(uuid, numeric, date, text)
  RENAME TO actualizar_vencimiento_operador_invoker_v1;
ALTER FUNCTION public.cerrar_vencimiento_operativo(uuid, text, text)
  RENAME TO cerrar_vencimiento_operativo_invoker_v1;
ALTER FUNCTION public.registrar_control_vencimiento_dashboard(uuid, numeric, date, integer, numeric, text)
  RENAME TO registrar_control_vencimiento_dashboard_invoker_v1;
ALTER FUNCTION public.anular_vencimiento_carga_incorrecta(uuid, text)
  RENAME TO anular_vencimiento_carga_incorrecta_invoker_v1;

REVOKE ALL ON FUNCTION public.registrar_control_vencimiento_invoker_v1(uuid, numeric, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_intervencion_rag_invoker_v1(uuid, numeric, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crear_vencimiento_operador_invoker_v1(uuid, uuid, numeric, date, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.actualizar_vencimiento_operador_invoker_v1(uuid, numeric, date, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cerrar_vencimiento_operativo_invoker_v1(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_control_vencimiento_dashboard_invoker_v1(uuid, numeric, date, integer, numeric, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.anular_vencimiento_carga_incorrecta_invoker_v1(uuid, text)
  FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Implementaciones privadas con privilegios.
--
-- Las funciones *_invoker_v1 mantienen todas sus validaciones originales:
-- auth.uid(), estado activo, producto×sucursal y puede_ver_producto_sucursal.
-- SECURITY DEFINER sólo evita depender de grants DML browser sobre las tablas.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION noven_private.registrar_control_vencimiento_impl(
  p_vencimiento_id uuid,
  p_cantidad_comprometida numeric,
  p_nota text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;
  RETURN public.registrar_control_vencimiento_invoker_v1(
    p_vencimiento_id, p_cantidad_comprometida, p_nota
  );
END;
$$;

CREATE OR REPLACE FUNCTION noven_private.registrar_intervencion_rag_impl(
  p_vencimiento_id uuid,
  p_porcentaje_descuento numeric,
  p_nota text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;
  RETURN public.registrar_intervencion_rag_invoker_v1(
    p_vencimiento_id, p_porcentaje_descuento, p_nota
  );
END;
$$;

CREATE OR REPLACE FUNCTION noven_private.crear_vencimiento_operador_impl(
  p_producto_id uuid,
  p_sucursal_id uuid,
  p_cantidad numeric,
  p_fecha_vencimiento date,
  p_lote text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;
  RETURN public.crear_vencimiento_operador_invoker_v1(
    p_producto_id, p_sucursal_id, p_cantidad, p_fecha_vencimiento, p_lote
  );
END;
$$;

CREATE OR REPLACE FUNCTION noven_private.actualizar_vencimiento_operador_impl(
  p_vencimiento_id uuid,
  p_cantidad numeric,
  p_fecha_vencimiento date,
  p_lote text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;
  RETURN public.actualizar_vencimiento_operador_invoker_v1(
    p_vencimiento_id, p_cantidad, p_fecha_vencimiento, p_lote
  );
END;
$$;

CREATE OR REPLACE FUNCTION noven_private.cerrar_vencimiento_operativo_impl(
  p_vencimiento_id uuid,
  p_resultado text,
  p_observaciones text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;
  RETURN public.cerrar_vencimiento_operativo_invoker_v1(
    p_vencimiento_id, p_resultado, p_observaciones
  );
END;
$$;

CREATE OR REPLACE FUNCTION noven_private.registrar_control_vencimiento_dashboard_impl(
  p_vencimiento_id uuid,
  p_cantidad_comprometida numeric,
  p_fecha_vencimiento date,
  p_stock_actual integer,
  p_porcentaje_rag numeric DEFAULT NULL,
  p_nota text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;
  RETURN public.registrar_control_vencimiento_dashboard_invoker_v1(
    p_vencimiento_id,
    p_cantidad_comprometida,
    p_fecha_vencimiento,
    p_stock_actual,
    p_porcentaje_rag,
    p_nota
  );
END;
$$;

CREATE OR REPLACE FUNCTION noven_private.anular_vencimiento_carga_incorrecta_impl(
  p_vencimiento_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;
  PERFORM public.anular_vencimiento_carga_incorrecta_invoker_v1(
    p_vencimiento_id, p_motivo
  );
END;
$$;

REVOKE ALL ON FUNCTION noven_private.registrar_control_vencimiento_impl(uuid, numeric, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION noven_private.registrar_intervencion_rag_impl(uuid, numeric, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION noven_private.crear_vencimiento_operador_impl(uuid, uuid, numeric, date, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION noven_private.actualizar_vencimiento_operador_impl(uuid, numeric, date, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION noven_private.cerrar_vencimiento_operativo_impl(uuid, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION noven_private.registrar_control_vencimiento_dashboard_impl(uuid, numeric, date, integer, numeric, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION noven_private.anular_vencimiento_carga_incorrecta_impl(uuid, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION noven_private.registrar_control_vencimiento_impl(uuid, numeric, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION noven_private.registrar_intervencion_rag_impl(uuid, numeric, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION noven_private.crear_vencimiento_operador_impl(uuid, uuid, numeric, date, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION noven_private.actualizar_vencimiento_operador_impl(uuid, numeric, date, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION noven_private.cerrar_vencimiento_operativo_impl(uuid, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION noven_private.registrar_control_vencimiento_dashboard_impl(uuid, numeric, date, integer, numeric, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION noven_private.anular_vencimiento_carga_incorrecta_impl(uuid, text)
  TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Contratos públicos estables para el frontend.
-- -----------------------------------------------------------------------------
CREATE FUNCTION public.registrar_control_vencimiento(
  p_vencimiento_id uuid,
  p_cantidad_comprometida numeric,
  p_nota text DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.registrar_control_vencimiento_impl(
    p_vencimiento_id, p_cantidad_comprometida, p_nota
  );
$$;

CREATE FUNCTION public.registrar_intervencion_rag(
  p_vencimiento_id uuid,
  p_porcentaje_descuento numeric,
  p_nota text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.registrar_intervencion_rag_impl(
    p_vencimiento_id, p_porcentaje_descuento, p_nota
  );
$$;

CREATE FUNCTION public.crear_vencimiento_operador(
  p_producto_id uuid,
  p_sucursal_id uuid,
  p_cantidad numeric,
  p_fecha_vencimiento date,
  p_lote text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.crear_vencimiento_operador_impl(
    p_producto_id, p_sucursal_id, p_cantidad, p_fecha_vencimiento, p_lote
  );
$$;

CREATE FUNCTION public.actualizar_vencimiento_operador(
  p_vencimiento_id uuid,
  p_cantidad numeric,
  p_fecha_vencimiento date,
  p_lote text DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.actualizar_vencimiento_operador_impl(
    p_vencimiento_id, p_cantidad, p_fecha_vencimiento, p_lote
  );
$$;

CREATE FUNCTION public.cerrar_vencimiento_operativo(
  p_vencimiento_id uuid,
  p_resultado text,
  p_observaciones text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.cerrar_vencimiento_operativo_impl(
    p_vencimiento_id, p_resultado, p_observaciones
  );
$$;

CREATE FUNCTION public.registrar_control_vencimiento_dashboard(
  p_vencimiento_id uuid,
  p_cantidad_comprometida numeric,
  p_fecha_vencimiento date,
  p_stock_actual integer,
  p_porcentaje_rag numeric DEFAULT NULL,
  p_nota text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.registrar_control_vencimiento_dashboard_impl(
    p_vencimiento_id,
    p_cantidad_comprometida,
    p_fecha_vencimiento,
    p_stock_actual,
    p_porcentaje_rag,
    p_nota
  );
$$;

CREATE FUNCTION public.anular_vencimiento_carga_incorrecta(
  p_vencimiento_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT noven_private.anular_vencimiento_carga_incorrecta_impl(
    p_vencimiento_id, p_motivo
  );
$$;

REVOKE ALL ON FUNCTION public.registrar_control_vencimiento(uuid, numeric, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_intervencion_rag(uuid, numeric, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crear_vencimiento_operador(uuid, uuid, numeric, date, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.actualizar_vencimiento_operador(uuid, numeric, date, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cerrar_vencimiento_operativo(uuid, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_control_vencimiento_dashboard(uuid, numeric, date, integer, numeric, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.anular_vencimiento_carga_incorrecta(uuid, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.registrar_control_vencimiento(uuid, numeric, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_intervencion_rag(uuid, numeric, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_vencimiento_operador(uuid, uuid, numeric, date, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_vencimiento_operador(uuid, numeric, date, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.cerrar_vencimiento_operativo(uuid, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_control_vencimiento_dashboard(uuid, numeric, date, integer, numeric, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.anular_vencimiento_carga_incorrecta(uuid, text)
  TO authenticated;

COMMIT;
