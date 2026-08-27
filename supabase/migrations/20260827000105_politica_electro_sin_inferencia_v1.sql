-- No inferir política de donación para ELECTRO.
-- El negocio confirmó 2 días para Verdulería/Carnicería/Lácteos/Panadería/Rotisería
-- y 10 días para Almacén/Bebidas/Limpieza/Perfumería/No comestibles/Textil/Congelados.
-- ELECTRO, FIAMBRES e INSUMOS quedan sin clasificación explícita hasta confirmación.

UPDATE public.sectores
SET dias_donacion = NULL
WHERE upper(btrim(nombre)) = 'ELECTRO';
