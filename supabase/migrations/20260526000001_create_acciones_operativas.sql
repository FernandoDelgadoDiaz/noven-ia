CREATE TABLE IF NOT EXISTS acciones_operativas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('donacion', 'decomiso')),
  cantidad INTEGER NOT NULL DEFAULT 1,
  producto_id UUID REFERENCES productos(id),
  vencimiento_id UUID REFERENCES vencimientos(id),
  sucursal_id UUID NOT NULL,
  usuario_id UUID REFERENCES auth.users(id),
  trimestre INTEGER NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
  anio INTEGER NOT NULL,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acciones_operativas_trimestre
  ON acciones_operativas(sucursal_id, anio, trimestre, tipo);

ALTER TABLE acciones_operativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios autenticados pueden insertar acciones"
  ON acciones_operativas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "usuarios autenticados pueden leer acciones"
  ON acciones_operativas FOR SELECT TO authenticated
  USING (auth.uid() = usuario_id);
