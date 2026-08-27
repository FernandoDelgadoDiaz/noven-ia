# NOVEN · Cutover readiness V1

Fecha de validación: 2026-08-26/27
Rama: `feat/multitenant-architecture-v1`

## Estado

La arquitectura multitenant + RAG + importación masiva compartida fue probada en una branch descartable de Supabase sin datos productivos. La branch de prueba fue eliminada al finalizar. Producción no fue modificada.

## Validaciones que pasaron

### Riesgo por política de sector

- Almacén con 8 días restantes y umbral 10 → `donacion`.
- Lácteos con 8 días restantes, umbral 2 y VMD suficiente → `seguro`.
- Lácteos con 2 días restantes → `donacion`.
- Almacén con 30 días, cantidad comprometida 100 y VMD 2 → `radar` porque no alcanza a vender antes del retiro obligatorio.

### Estado por sucursal

El mismo SKU mantuvo stock y VMD independientes en 091 y 021. La actualización de una sucursal no contaminó la otra.

### Catálogo aprendido por organización

Caso probado con un cod_art nuevo:

1. 091 lo detectó con stock/VMD propios.
2. 021 detectó el mismo cod_art con otros stock/VMD.
3. Se creó un único pendiente global con dos detecciones.
4. Un gerente sin alcance sobre las sucursales donde apareció fue rechazado.
5. El gerente 021 lo clasificó una sola vez.
6. La resolución creó un único producto global, dos estados `producto_sucursal` y dos snapshots históricos.
7. Luego 043 importó el mismo cod_art y ya fue ruteado automáticamente a la familia aprendida; no volvió a quedar pendiente.
8. Repetir el mismo archivo en la misma sucursal devolvió importación duplicada sin reaplicar datos.

### Aprendizaje desde CSV filtrado

Un segundo cod_art pendiente detectado en 091 y 021 fue resuelto en bloque mediante `Cód.Familia = 003` de un reporte filtrado. La clasificación se propagó a ambas sucursales sin intervención individual por producto.

### RAG

- Se registró RAG 30%.
- Control posterior 100 → 100 produjo `sin_movimiento`.
- Se registró una segunda intervención RAG 50% sin sobrescribir la anterior.
- Control posterior con reducción produjo `efectivo`.
- El histórico conservó ambas intervenciones.

### RLS nuevo

Con identidad de operador 091:

- `producto_sucursal` no mostró estados de 021.
- `v_vencimientos_operativos` filtró por sucursal/familia.
- Las tablas legacy `productos` y `vencimientos` siguieron mostrando filas adicionales por sus policies permisivas antiguas.

Conclusión: el modelo nuevo aísla correctamente, pero el cutover final NO debe ejecutarse hasta eliminar los lectores/escritores directos que aún dependen de policies legacy.

## Bugs encontrados y corregidos durante la prueba

### Vista de vencimientos

`20260827000110_risk_engine_sector_policy_v1.sql` intentaba insertar columnas de política sectorial en medio de `v_vencimientos_operativos` mediante `CREATE OR REPLACE VIEW`. PostgreSQL rechazó el cambio de contrato (`42P16`).

Corrección: la migración ahora hace `DROP VIEW IF EXISTS` + `CREATE VIEW` + grants explícitos.

### Índices FK nuevos

Supabase Advisor marcó FKs sin índice en observaciones RAG y pendientes compartidos. Se agregó `20260827000180_rag_pending_fk_indexes_v1.sql`. Tras aplicarla desaparecieron los avisos de FK correspondientes al esquema nuevo.

## Bloqueadores previos a producción

### 1. Reproducibilidad del esquema histórico

Una branch limpia no reconstruye todo el esquema legacy necesario sólo desde el historial actual. El repositorio conserva migraciones históricas con orden incompatible (por ejemplo una migración referencia `familias` antes de su creación).

No reescribir silenciosamente migraciones ya aplicadas en producción. Definir un baseline canónico/squashed para entornos limpios y una estrategia explícita de reconciliación del historial productivo.

### 2. Accesos legacy directos

`Scanner.tsx` todavía tiene caminos directos contra `productos` y `vencimientos`, pese a que los RPC multitenant ya existen. Entre ellos:

- detección del vencimiento activo mediante `public.vencimientos`;
- validación y escritura de EAN directamente en `public.productos`;
- alta de producto directamente en `public.productos`;
- completar `cod_art` directamente en `public.productos`.

El importador por familia también sigue siendo un escritor legacy y deberá pasar por un backend/RPC transaccional antes del cierre RLS.

### 3. Cutover RLS final

Sólo después de eliminar lectores/escritores directos legacy:

- eliminar policies `SELECT ... USING (true)` y policies antiguas incompatibles;
- conservar únicamente policies por organización/zona/sucursal/familia;
- retirar el bridge temporal de estado 091;
- impedir que stock/VMD legacy de `productos` sean una fuente operativa.

## Próximo orden de trabajo

1. Migrar los últimos caminos de Scanner a RPC/vistas seguras.
2. Migrar Importar por familia a transacción server-side y catálogo/estado separados.
3. Definir baseline reproducible para clean/dev branches sin tocar historial productivo aplicado.
4. Crear migración final de RLS/cutover.
5. Volver a probar en branch descartable antes de producción.
