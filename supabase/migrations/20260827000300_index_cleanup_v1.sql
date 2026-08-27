-- =============================================================================
-- NOVEN · INDEX CLEANUP V1
--
-- Elimina únicamente índices btree idénticos confirmados por Supabase Advisor.
-- Ninguno respalda PK/UNIQUE/FK constraints. Se conserva un índice equivalente
-- por cada columna.
-- =============================================================================

BEGIN;

DROP INDEX IF EXISTS public.acciones_operativas_producto_idx;
DROP INDEX IF EXISTS public.acciones_operativas_usuario_idx;

DROP INDEX IF EXISTS public.idx_vencimientos_fecha_vencimiento;
DROP INDEX IF EXISTS public.idx_vencimientos_producto_id;
DROP INDEX IF EXISTS public.idx_vencimientos_sucursal_id;

COMMIT;
