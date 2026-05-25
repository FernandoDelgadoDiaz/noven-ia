-- ============================================================
-- 20260525100000_admin_panel_schema.sql
-- Panel de administración de usuarios
-- Tablas: usuarios, sectores, familias, usuario_familias
-- ============================================================

-- ------------------------------------------------------------
-- TABLA: usuarios (perfil extendido)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id          uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  nombre      text        NOT NULL DEFAULT '',
  rol         text        NOT NULL DEFAULT 'operador' CHECK (rol IN ('admin', 'operador', 'supervisor')),
  sucursal_id uuid        REFERENCES sucursales (id) ON DELETE SET NULL,
  activo      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_select_authenticated" ON usuarios;
CREATE POLICY "usuarios_select_authenticated"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "usuarios_insert_self" ON usuarios;
CREATE POLICY "usuarios_insert_self"
  ON usuarios
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "usuarios_update_admin_or_self" ON usuarios;
CREATE POLICY "usuarios_update_admin_or_self"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ------------------------------------------------------------
-- TABLA: sectores
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sectores (
  id      uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo  text  NOT NULL UNIQUE,
  nombre  text  NOT NULL
);

ALTER TABLE sectores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sectores_select_authenticated" ON sectores;
CREATE POLICY "sectores_select_authenticated"
  ON sectores
  FOR SELECT
  TO authenticated
  USING (true);

-- ------------------------------------------------------------
-- TABLA: familias
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS familias (
  id         uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id  uuid  NOT NULL REFERENCES sectores (id) ON DELETE CASCADE,
  codigo     text  NOT NULL UNIQUE,
  nombre     text  NOT NULL
);

ALTER TABLE familias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "familias_select_authenticated" ON familias;
CREATE POLICY "familias_select_authenticated"
  ON familias
  FOR SELECT
  TO authenticated
  USING (true);

-- ------------------------------------------------------------
-- TABLA: usuario_familias
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario_familias (
  usuario_id  uuid  NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  familia_id  uuid  NOT NULL REFERENCES familias (id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, familia_id)
);

ALTER TABLE usuario_familias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuario_familias_select_authenticated" ON usuario_familias;
CREATE POLICY "usuario_familias_select_authenticated"
  ON usuario_familias
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "usuario_familias_insert_authenticated" ON usuario_familias;
CREATE POLICY "usuario_familias_insert_authenticated"
  ON usuario_familias
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "usuario_familias_delete_authenticated" ON usuario_familias;
CREATE POLICY "usuario_familias_delete_authenticated"
  ON usuario_familias
  FOR DELETE
  TO authenticated
  USING (true);

-- ------------------------------------------------------------
-- DATOS: Sectores y Familias de ejemplo
-- ------------------------------------------------------------
INSERT INTO sectores (id, codigo, nombre) VALUES
  ('10000000-0000-0000-0000-000000000001', '001', 'ALMACEN'),
  ('10000000-0000-0000-0000-000000000002', '005', 'BEBIDAS'),
  ('10000000-0000-0000-0000-000000000003', '010', 'LACTEOS'),
  ('10000000-0000-0000-0000-000000000004', '015', 'FIAMBRES'),
  ('10000000-0000-0000-0000-000000000005', '020', 'PANADERIA')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO familias (id, sector_id, codigo, nombre) VALUES
  -- ALMACEN
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '001', 'ACEITES Y VINAGRES'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '002', 'ARROZ Y LEGUMBRES'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '003', 'GOLOSINAS Y CHOCOLATES'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '004', 'HARINAS Y REBOZADORES'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '014', 'COPETIN'),
  -- BEBIDAS
  ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000002', '010', 'AGUAS Y SODAS'),
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000002', '011', 'CERVEZAS'),
  ('20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000002', '012', 'GASEOSAS'),
  ('20000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000002', '013', 'JUGOS Y BEBIDAS'),
  -- LACTEOS
  ('20000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000003', '020', 'LECHES'),
  ('20000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000003', '021', 'YOGURES'),
  ('20000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000003', '022', 'QUESOS'),
  ('20000000-0000-0000-0000-000000000023', '10000000-0000-0000-0000-000000000003', '023', 'MANTECAS Y CREMAS'),
  -- FIAMBRES
  ('20000000-0000-0000-0000-000000000030', '10000000-0000-0000-0000-000000000004', '030', 'FIAMBRES ENVASADOS'),
  ('20000000-0000-0000-0000-000000000031', '10000000-0000-0000-0000-000000000004', '031', 'EMBUTIDOS'),
  -- PANADERIA
  ('20000000-0000-0000-0000-000000000040', '10000000-0000-0000-0000-000000000005', '040', 'PANES Y FACTURAS'),
  ('20000000-0000-0000-0000-000000000041', '10000000-0000-0000-0000-000000000005', '041', 'GALLETITAS')
ON CONFLICT (codigo) DO NOTHING;

-- ------------------------------------------------------------
-- DATOS: Perfil del usuario admin (gerente091@gmail.com)
-- Se inserta si el usuario ya existe en auth.users
-- ------------------------------------------------------------
INSERT INTO usuarios (id, nombre, rol, activo)
SELECT id, 'Fernando', 'admin', true
FROM auth.users
WHERE email = 'gerente091@gmail.com'
ON CONFLICT (id) DO UPDATE SET rol = 'admin', nombre = 'Fernando', activo = true;

-- ------------------------------------------------------------
-- DATOS: Perfil del operador (fernandodelgado@gmail.com)
-- Solo si no existe — NO cambiar rol si ya existe
-- ------------------------------------------------------------
INSERT INTO usuarios (id, nombre, rol, activo)
SELECT id, 'Repositora Golosinas', 'operador', true
FROM auth.users
WHERE email = 'fernandodelgado@gmail.com'
ON CONFLICT (id) DO UPDATE SET rol = 'operador';
