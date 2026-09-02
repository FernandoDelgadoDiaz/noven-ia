CREATE OR REPLACE VIEW public.v_productos_catalogo WITH (security_invoker=true) AS
 SELECT id,
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
   FROM productos p;;
