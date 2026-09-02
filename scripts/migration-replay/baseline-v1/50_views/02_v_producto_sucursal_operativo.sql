CREATE OR REPLACE VIEW public.v_producto_sucursal_operativo WITH (security_invoker=true) AS
 SELECT ps.id AS producto_sucursal_id,
    ps.organizacion_id,
    ps.sucursal_id,
    ps.producto_id,
    p.cod_art,
    p.codigo_barras,
    p.descripcion,
    p.marca,
    p.gramaje,
    p.categoria,
    p.proveedor,
    p.sector,
    p.precio_costo,
    p.imagen_url,
    p.familia_id,
    p.activo,
    ps.stock_actual,
    ps.venta_media_diaria,
    ps.fecha_ultima_importacion,
    ps.updated_at AS estado_updated_at
   FROM producto_sucursal ps
     JOIN productos p ON p.id = ps.producto_id AND p.organizacion_id = ps.organizacion_id;;
