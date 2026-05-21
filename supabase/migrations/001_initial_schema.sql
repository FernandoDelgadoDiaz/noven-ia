-- ============================================================
-- 001_initial_schema.sql
-- Tablas: sucursales, productos, vencimientos
-- RLS activo en todas. Policies según rol y ownership.
-- ============================================================

-- ------------------------------------------------------------
-- TABLA: sucursales
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sucursales (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text        NOT NULL,
  direccion   text,
  activa      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;

-- Usuarios autenticados pueden leer sucursales activas
CREATE POLICY "sucursales_select_authenticated"
  ON sucursales
  FOR SELECT
  TO authenticated
  USING (true);

-- Solo el rol "admin" puede insertar o modificar sucursales
CREATE POLICY "sucursales_insert_admin"
  ON sucursales
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "sucursales_update_admin"
  ON sucursales
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- ------------------------------------------------------------
-- TABLA: productos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_art             text        NOT NULL UNIQUE,
  codigo_barras       text,
  descripcion         text        NOT NULL,
  marca               text,
  categoria           text,
  proveedor           text,
  sector              text,
  venta_media_diaria  numeric     NOT NULL DEFAULT 0,
  stock_actual        numeric     NOT NULL DEFAULT 0,
  precio_costo        numeric,
  activo              boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

-- Usuarios autenticados pueden leer productos activos
CREATE POLICY "productos_select_authenticated"
  ON productos
  FOR SELECT
  TO authenticated
  USING (true);

-- Solo el rol "admin" puede insertar o modificar productos
CREATE POLICY "productos_insert_admin"
  ON productos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "productos_update_admin"
  ON productos
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_productos_cod_art
  ON productos (cod_art);

CREATE INDEX IF NOT EXISTS idx_productos_codigo_barras
  ON productos (codigo_barras)
  WHERE codigo_barras IS NOT NULL;

-- Trigger para mantener updated_at actualizado
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER productos_set_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- TABLA: vencimientos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vencimientos (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id       uuid        NOT NULL REFERENCES productos (id) ON DELETE RESTRICT,
  sucursal_id       uuid        NOT NULL REFERENCES sucursales (id) ON DELETE RESTRICT,
  usuario_id        uuid        NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  cantidad          numeric     NOT NULL,
  lote              text,
  fecha_vencimiento date        NOT NULL,
  fecha_carga       date        NOT NULL DEFAULT current_date,
  activo            boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vencimientos ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede ver vencimientos
CREATE POLICY "vencimientos_select_authenticated"
  ON vencimientos
  FOR SELECT
  TO authenticated
  USING (true);

-- Cada usuario solo puede insertar sus propios registros
CREATE POLICY "vencimientos_insert_own"
  ON vencimientos
  FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- Cada usuario solo puede actualizar sus propios registros
CREATE POLICY "vencimientos_update_own"
  ON vencimientos
  FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- Cada usuario solo puede eliminar sus propios registros
CREATE POLICY "vencimientos_delete_own"
  ON vencimientos
  FOR DELETE
  TO authenticated
  USING (usuario_id = auth.uid());

-- Índices para joins y filtros habituales
CREATE INDEX IF NOT EXISTS idx_vencimientos_producto_id
  ON vencimientos (producto_id);

CREATE INDEX IF NOT EXISTS idx_vencimientos_sucursal_id
  ON vencimientos (sucursal_id);

CREATE INDEX IF NOT EXISTS idx_vencimientos_fecha_vencimiento
  ON vencimientos (fecha_vencimiento);
