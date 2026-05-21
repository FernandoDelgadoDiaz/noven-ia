# Contratos de interfaces

## Supabase
- Tabla `sucursales`: id, nombre, direccion, activa, created_at
- Tabla `productos`: id, cod_art, codigo_barras, descripcion, marca, categoria, proveedor, sector, venta_media_diaria, stock_actual, precio_costo, activo, created_at, updated_at
- Tabla `vencimientos`: id, producto_id, sucursal_id, usuario_id, cantidad, lote, fecha_vencimiento, fecha_carga, activo, created_at
- RLS: activo en todas las tablas

## Scanner
- Input: codigo de barras (string)
- Output: Producto | null (busca por codigo_barras, fallback a cod_art)

## Motor predictivo
- Input: Vencimiento + Producto
- Output: VencimientoConRiesgo con nivel_riesgo y acciones_sugeridas
- Logica: cobertura = stock/venta_diaria; si cobertura > dias_restantes -> riesgo
