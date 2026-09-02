# Contratos de interfaces

Referencia rápida del modelo productivo. La fuente de verdad estructural es
`scripts/migration-replay/baseline-v1/`, verificada por fingerprint en CI.

## Jerarquía y acceso

| Tabla | Rol |
|---|---|
| `organizaciones` | límite de tenant: ningún dato de negocio cruza entre organizaciones |
| `regiones`, `zonas` | agrupación de sucursales |
| `sucursales` | límite operativo; `codigo` es el identificador del negocio (ej. `091`) |
| `usuarios` | perfil local |
| `usuario_accesos` | rol de alcance: `admin_organizacion`, `gerente_zonal`, `gerente_sucursal`, `supervisor`, `operador` |
| `usuario_familias_sucursal` | familias asignadas a un operador dentro de una sucursal |
| `invitaciones_acceso` | alta de usuarios por invitación |

## Catálogo, compartido por organización

| Tabla | Rol |
|---|---|
| `productos` | atributos de catálogo; `cod_art` es el identificador primario |
| `producto_codigos` | múltiples EAN/UPC/GTIN por producto, sin confundirlos con `cod_art` |
| `sectores`, `familias` | clasificación; `sectores.dias_donacion` define la política de riesgo |

`productos` no expone al browser las columnas legacy `stock_actual` ni `venta_media_diaria`.

## Estado por sucursal

| Tabla | Rol |
|---|---|
| `producto_sucursal` | `stock_actual`, `venta_media_diaria`, última importación. `(producto_id, sucursal_id)` único |
| `importaciones` | registro padre de cada archivo: sucursal, usuario, hash, fecha, estado, resultado |
| `producto_snapshots` | fotografía inmutable por producto/sucursal de cada importación |
| `productos_pendientes_catalogo`, `producto_pendiente_detecciones` | productos sin clasificar y dónde se detectaron |

## Operación

| Tabla | Rol |
|---|---|
| `vencimientos` | scoped por sucursal; cantidad comprometida con una fecha |
| `acciones_operativas` | acciones sobre un vencimiento, incluido el cierre terminal |
| `intervenciones_rag`, `rag_escalamientos` | ciclo de Retiro Anticipado de Góndola |
| `vencimiento_observaciones`, `producto_costo_observaciones` | evidencia operativa |
| `problemas_economicos_ciclos` | ciclo de vida del problema económico |
| `alertas_zonales`, `alertas_zonales_destinos`, `push_subscriptions` | notificaciones |

## Vistas operativas

`v_vencimientos_operativos`, `v_producto_sucursal_operativo`, `v_productos_catalogo`,
`v_acciones_operativas_historial`, `v_seguimiento_rag_actual`,
`v_resultado_vencimiento_tramos`, `v_efectividad_intervencion_rag`,
`v_efectividad_rag_operador`, `v_efectividad_rag_resumen`, `v_resultado_operador_rag`,
`v_problemas_economicos_historial`, `vw_usuarios_completos`.

## Contrato de seguridad

- RLS activo en todas las tablas de negocio.
- El browser tiene únicamente `SELECT`. No hay DML directo desde React sobre tablas operativas.
- Toda escritura pasa por RPC `SECURITY DEFINER` o por una función Netlify que valida alcance server-side.
- Las tablas server-only (`importaciones`, `producto_snapshots`, pendientes) tienen RLS habilitado y ninguna policy para el browser: es intencional.

## Scanner

- Input: código de barras (string).
- Lookup: `producto_codigos` dentro de la organización, con fallback a `cod_art`.
- Output: producto del catálogo de la organización + su estado en la sucursal activa, o `null`.
- Un EAN aprendido en una sucursal queda disponible para toda la organización.

## Motor predictivo

- Input: vencimiento (cantidad comprometida + fecha) + estado del producto en la sucursal + `sectores.dias_donacion`.
- Output: nivel de riesgo y métricas (`dias_stock`, `dias_comerciales_restantes`, `velocidad_necesaria`).
- Lógica: `hay_riesgo = dias_stock > dias_comerciales_restantes`, donde la ventana comercial termina en el umbral de donación del sector, no en el vencimiento.

## Importación Glaciar

- Input: CSV del reporte, con `Cod.Suc.Padrón` en el encabezado.
- La sucursal detectada se verifica contra el alcance del usuario **antes** de escribir.
- Idempotente por hash: reimportar el mismo archivo se rechaza sin reaplicar datos.
- Cada importación deja historia: actualizar el estado actual no borra el snapshot anterior.
