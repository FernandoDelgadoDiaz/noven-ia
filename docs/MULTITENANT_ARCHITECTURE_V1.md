# NoVen IA — Arquitectura multitenant V1

Estado: diseño base para migración progresiva desde la Sucursal 091 en producción.

## Objetivo

Convertir NoVen desde una aplicación de una sola sucursal a una plataforma jerárquica y segura capaz de operar múltiples zonas y sucursales sin mezclar datos ni romper el flujo actual.

Jerarquía objetivo:

```text
organización
  └── zona
      └── sucursal
          ├── gerente de sucursal
          ├── supervisor
          └── operadores por familia
```

## Invariantes de arquitectura

1. **El límite de tenant es la organización.** Ningún dato de negocio de una organización puede ser visible para otra.
2. **La zona agrupa sucursales.** Un gerente zonal puede leer únicamente las sucursales de su zona.
3. **La sucursal es el límite operativo.** Stock, venta media, vencimientos, acciones e importaciones siempre pertenecen a una sucursal.
4. **El catálogo es compartido dentro de la organización.** El vínculo `cod_art ↔ EAN ↔ descripción ↔ imagen` no debe reaprenderse en cada sucursal.
5. **El estado del producto no es global.** `stock_actual`, `venta_media_diaria` y cualquier señal operativa viven en una entidad `producto_sucursal`.
6. **RLS es la autoridad.** React puede ocultar información por UX, pero jamás es la barrera de seguridad.
7. **No existe SELECT abierto de datos operativos.** `TO authenticated USING (true)` no es una política aceptable para tablas de negocio multitenant.
8. **Las importaciones son auditables e idempotentes.** Cada archivo debe tener sucursal, usuario, hash, fecha, estado y resultado.
9. **Cada importación deja historia.** Actualizar el estado actual no debe borrar el snapshot anterior.
10. **La migración es progresiva.** La Sucursal 091 debe continuar funcionando durante toda la transición.

## Modelo objetivo

### Catálogo compartido

```text
organizaciones
zonas
sucursales

productos
producto_codigos
```

`productos` conserva atributos de catálogo. `producto_codigos` permite múltiples EAN/UPC/GTIN por producto sin confundirlos con `cod_art`.

### Estado por sucursal

```text
producto_sucursal
  producto_id
  sucursal_id
  stock_actual
  venta_media_diaria
  fecha_ultima_importacion
```

La combinación `(producto_id, sucursal_id)` es única.

### Histórico de reportes

```text
importaciones
producto_snapshots
```

Una importación de Glaciar genera un registro padre y N snapshots inmutables de producto/sucursal.

### Operación de vencimientos

```text
vencimientos
acciones_operativas
```

Ambas tablas permanecen sucursal-scoped. En una fase posterior `vencimientos` pasará de un único vencimiento activo por producto/sucursal a múltiples lotes activos con lógica FEFO.

## Roles objetivo

| Rol | Alcance |
|---|---|
| platform_admin | toda la plataforma NoVen |
| org_admin | toda una organización |
| zone_manager | todas las sucursales de una zona |
| store_manager | toda una sucursal |
| supervisor | sucursal/familias asignadas según política |
| operator | sucursal + familias asignadas |

Los roles actuales `admin`, `supervisor` y `operador` se mantienen durante la transición para no romper producción. El cambio de autorización se realizará en una fase separada.

## Importación Glaciar

El parser actual ya detecta datos del encabezado del reporte. La evolución debe agregar como dato obligatorio el código de sucursal (`Cod.Suc.Padrón`) y verificarlo contra el alcance del usuario antes de escribir.

Flujo objetivo:

```text
CSV
 → parseo local/preview
 → detectar organización + sucursal
 → verificar autorización server-side
 → calcular hash
 → rechazar duplicado si ya fue procesado
 → transacción de importación
 → actualizar producto_sucursal
 → insertar producto_snapshots
 → registrar resultado
```

## Estrategia de migración

### Fase 1 — Núcleo jerárquico

- Crear `organizaciones` y `zonas`.
- Agregar `organizacion_id`, `zona_id` y `codigo` a `sucursales`.
- Asociar la sucursal actual 091 a la organización y zona iniciales.
- No cambiar todavía el comportamiento del frontend.

### Fase 2 — Catálogo vs. estado

- Crear `producto_sucursal`.
- Copiar el `stock_actual` y `venta_media_diaria` actuales de 091 a esa tabla.
- Mantener temporalmente las columnas legacy en `productos` para compatibilidad.
- Adaptar lecturas y escrituras de manera incremental.

### Fase 3 — Seguridad multitenant

- Reemplazar SELECT abiertos de tablas operativas.
- Implementar helpers de alcance seguros.
- Probar BOLA/IDOR entre dos sucursales y dos zonas ficticias antes de habilitar usuarios reales.

### Fase 4 — Importación auditable + snapshots

- Crear `importaciones` y `producto_snapshots`.
- Hacer que cada CSV deje una fotografía histórica.
- Detectar el código de sucursal desde Glaciar.

### Fase 5 — Jerarquía zonal

- Incorporar gerentes zonales.
- Dashboard zonal agregado sin permitir acceso fila-a-fila fuera del alcance.

### Fase 6 — Motor predictivo V2

- Multi-lote.
- FEFO.
- Serie histórica de stock/VMD.
- Predicción basada en evolución real y no sólo estado actual.

## Gates obligatorios antes de producción multitenant

1. Operador de Sucursal A no puede consultar ni mutar datos de Sucursal B mediante REST directo.
2. Gerente de Sucursal A no puede consultar Sucursal B.
3. Gerente Zonal A puede acceder a todas sus sucursales y a ninguna de otra zona.
4. Mismo SKU puede tener stock/VMD distintos en múltiples sucursales sin sobrescribirse.
5. EAN aprendido por una sucursal queda disponible para el catálogo de la organización.
6. CSV de una sucursal no puede escribirse en otra aunque el usuario modifique el request.
7. Reimportar el mismo archivo se detecta mediante hash.
8. Los datos actuales de 091 sobreviven a cada migración.
9. `npm test`, `npm run lint` y `npm run build` pasan antes de merge.
10. Security Advisor de Supabase queda sin nuevos hallazgos de RLS provocados por la migración.

## Regla de despliegue

Ninguna fase se aplica directamente a producción desde una sesión de desarrollo. Primero debe existir en Git, pasar pruebas de aislamiento y ser revisable como diff/PR. La migración de producción debe ser explícita y reversible en cuanto a datos (sin deletes destructivos durante esta transición).
