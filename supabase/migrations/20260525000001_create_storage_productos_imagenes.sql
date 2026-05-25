-- Bucket público para imágenes de productos
INSERT INTO storage.buckets (id, name, public)
VALUES ('productos-imagenes', 'productos-imagenes', true)
ON CONFLICT DO NOTHING;

-- Lectura pública (cualquier visitante puede ver las imágenes)
CREATE POLICY "Lectura pública de imágenes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'productos-imagenes');

-- Upload solo para usuarios autenticados
CREATE POLICY "Upload autenticado"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'productos-imagenes');

-- Update solo para usuarios autenticados
CREATE POLICY "Update autenticado"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'productos-imagenes');
