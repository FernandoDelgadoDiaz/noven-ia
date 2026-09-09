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
| `usuario_accesos` | rol de alcance: `admin_organizacion`, `gerente_zonal`, `administrativa_precios_zonal`, `gerente_sucursal`, `supervisor`, `operador` |
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
| `solicitudes_cambio_rag`, `solicitud_cambio_rag_eventos` | pedido centralizado separado del tramo RAG + historial append-only de su máquina de estados |
| `vencimiento_observaciones`, `producto_costo_observaciones` | evidencia operativa |
| `problemas_economicos_ciclos` | ciclo de vida del problema económico |
| `alertas_zonales`, `alertas_zonales_destinos`, `push_subscriptions` | notificaciones |

## Vistas operativas

`v_vencimientos_operativos`, `v_producto_sucursal_operativo`, `v_productos_catalogo`,
`v_acciones_operativas_historial`, `v_seguimiento_rag_actual`,
`v_resultado_vencimiento_tramos`, `v_efectividad_intervencion_rag`,
`v_efectividad_rag_operador`, `v_efectividad_rag_resumen`, `v_resultado_operador_rag`,
`v_problemas_economicos_historial`, `vw_usuarios_completos`.

`v_solicitudes_cambio_rag_actual` proyecta el último evento sin reemplazar el
historial. `ejecutada_no_habilitada` y `lista_confirmacion` son estados derivados
por la fecha operativa; la fuente persistida sigue siendo el evento `ejecutada`.

## Circuito RAG centralizado

- Máquina persistida: `solicitada → ejecutada → confirmada` o
  `solicitada → ejecutada → no_aplicada → ejecutada…`.
- Solicitud y eventos son inmutables; cada transición conserva actor y hora.
- `administrativa_precios_zonal` sólo ve las solicitudes de su zona y sólo puede
  protagonizar el evento `ejecutada`; no integra helpers de scanner, catálogo,
  vencimientos, análisis, importación, administración local ni Radar.
- La verificación en góndola (`confirmada` o `no_aplicada`) puede registrarla el
  gerente o supervisor de la sucursal y también un operador asignado a la
  familia del producto en esa sucursal.
- `intervenciones_rag.solicitud_cambio_rag_id` es nullable: solicitar o ejecutar
  nunca abre el tramo; el vínculo se completará al confirmar en góndola.
- `solicitar_cambio_rag(p_vencimiento_id)` es la única escritura browser del
  bloque de validación: recibe sólo el vencimiento, recalcula server-side el
  escalón y la evidencia, valida gerente/supervisor en esa sucursal y reutiliza
  la solicitud abierta ante doble click.
- `registrar_control_vencimiento_dashboard` rechaza todo
  `p_porcentaje_rag` no nulo. El control registra observación; no puede abrir ni
  modificar un RAG por una ruta lateral.
- `instrumentar_sugerencia_rag` deja de tener `EXECUTE` para `authenticated`:
  el snapshot nace atómicamente con la solicitud, no en una segunda llamada.
- `administrativa_precios_zonal` se invita desde Accesos y jerarquía con una
  organización y zona concretas; nunca recibe sucursal ni familias. La falta de
  gerente zonal se muestra como cobertura pendiente, pero no impide registrar
  ni activar la invitación.
- `listar_bandeja_rag_zonal()` resuelve `auth.uid()` en servidor y devuelve sólo
  solicitudes de zonas donde la cuenta tiene ese rol activo. Incluye pendientes
  sin límite de antigüedad y ejecutadas durante veinticuatro horas.
- Cada zona debe configurar en servidor el inicio y el corte de su jornada de
  recepción. En `Santa Cruz Sur` la ventana es 08:00–12:00: dentro de ella las
  solicitudes aparecen en tiempo real; desde el corte se asignan a la jornada
  siguiente y permanecen invisibles hasta entonces.
- La bandeja mantiene un orden estable por código de sucursal ascendente,
  sector/familia y fin de acción, independientemente del orden de llegada. Debe
  exportar `.xlsx` real para una sucursal seleccionada o para toda la jornada
  visible de la zona, sin incluir solicitudes diferidas.
- `ejecutar_solicitud_cambio_rag(p_solicitud_id)` recibe sólo la identidad de la
  solicitud, bloquea su fila y vuelve a validar rol, organización y zona. Agrega
  un único evento `ejecutada`, devuelve el existente ante reintentos y fija la
  habilitación en el día operativo argentino siguiente; no abre intervenciones.
- La acción visible de la administrativa es **Marcar Activo** y sólo se usa
  después de cargar el precio en el sistema de la cadena; internamente conserva
  el evento append-only `ejecutada`.
- La cuenta cuyo único acceso es `administrativa_precios_zonal` entra a
  `/rag/zona` y no recibe Dashboard, selector de sucursal, Scanner, vencimientos,
  análisis, problemas, importación, administración local ni Radar operativo.
- La bandeja de sucursal existe sólo para gerente/supervisor y ordena por días
  comerciales ascendentes y luego dinero en riesgo descendente. No usa un score
  compuesto. El operador conserva lectura del estado en la tarjeta.

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
