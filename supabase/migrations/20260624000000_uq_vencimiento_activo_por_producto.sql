-- ============================================================
-- 20260624000000_uq_vencimiento_activo_por_producto.sql
-- Hace cumplir a nivel DB la regla de negocio (F3 en PLAN.md):
--   máximo 1 vencimiento ACTIVO por (producto_id, sucursal_id).
--
-- Contexto: la regla hoy se aplica solo en el frontend (Scanner).
-- Dos operadores escaneando el mismo producto en paralelo podían
-- crear duplicados activos. Este índice cierra esa condición de
-- carrera a nivel base de datos.
--
-- Paso 1 (dedup): el índice único fallaría si ya existen duplicados
--   activos. Primero los desactivamos, conservando el más reciente
--   por fecha_carga (mismo criterio que usa el Scanner: limit(1)
--   order by fecha_carga desc).
-- Paso 2: crea el índice único parcial que bloquea nuevos duplicados.
--
-- No destructiva: NO borra filas. Marca activo=false en los
-- duplicados antiguos, que quedan auditables en la tabla.
-- Idempotente: re-ejecutarla no hace daño (el dedup no encuentra
-- duplicados y el índice usa IF NOT EXISTS).
-- ============================================================

-- ------------------------------------------------------------
-- Paso 1 — Deduplicar vencimientos activos existentes
-- Conserva 1 fila activa por (producto_id, sucursal_id): la de
-- fecha_carga más reciente (desempate por created_at y luego id).
-- ------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY producto_id, sucursal_id
      ORDER BY fecha_carga DESC, created_at DESC, id DESC
    ) AS rn
  FROM vencimientos
  WHERE activo = true
)
UPDATE vencimientos AS v
SET activo = false,
    updated_at = now()
FROM ranked
WHERE v.id = ranked.id
  AND ranked.rn > 1;

-- ------------------------------------------------------------
-- Paso 2 — Índice único parcial
-- Bloquea cualquier INSERT/UPDATE que dejaría dos filas activas
-- para el mismo producto en la misma sucursal.
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_vencimiento_activo_por_producto_sucursal
  ON vencimientos (producto_id, sucursal_id)
  WHERE activo = true;
