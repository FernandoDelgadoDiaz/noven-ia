# NOVEN · MATRIZ DE VALIDACIÓN CUTOVER MULTITENANT V1

Estado: **preparada, no ejecutada todavía**.

Esta matriz se ejecutará exclusivamente en una branch descartable de Supabase antes de cualquier cambio productivo. La branch debe eliminarse al finalizar.

## 0. Principios que NO pueden cambiar

- Una sola organización puede contener zonas y múltiples sucursales.
- Catálogo (`productos`) compartido por organización.
- Estado (`producto_sucursal`) independiente por SKU × sucursal.
- Cantidad comprometida de un vencimiento es independiente del stock total.
- Política operativa invariante:
  - vencido / día 0 → `decomiso`;
  - <= 10 días con cantidad comprometida restante → `donacion` obligatoria;
  - <= 20 días + cobertura insuficiente → `urgente`;
  - <= 45 días + cobertura insuficiente → `radar`;
  - resto → `seguro`.
- El motor predictivo no puede sobreescribir las ventanas corporativas 45/20/10.

## 1. Replay de migraciones desde cero

1. Crear branch Supabase **sin datos productivos**.
2. Verificar que toda la cadena `supabase/migrations` aplica en orden sin bootstrap manual.
3. Confirmar existencia de las tablas Noven y de las tablas 5S preexistentes sin modificarlas.
4. Confirmar que `20260525000002_add_familia_id_to_productos.sql` ya no depende de una tabla `familias` inexistente.
5. Confirmar que las migraciones multitenant y el cutover RLS llegan hasta el final.
6. Consultar `supabase_migrations.schema_migrations` y verificar que no falta ninguna versión del repo.

**Gate:** cualquier error de replay bloquea producción.

## 2. Fixtures multitienda

Crear datos de prueba claramente identificados, sin afirmar que sean datos productivos:

- organización test;
- zona Río Gallegos;
- zona Comodoro Rivadavia;
- sucursal `091`;
- sucursal `072`;
- sucursal `021`;
- gerente zonal Río Gallegos;
- gerente de 091;
- gerente de 072;
- gerente zonal Comodoro;
- operador 091 familia A;
- operador 072 familia A.

Usar al menos dos familias y dos productos para probar aislamiento positivo y negativo.

## 3. Catálogo global vs estado local

Para un mismo SKU:

- catálogo/descripcion/EAN iguales en 091 y 072;
- `producto_sucursal` 091: stock/VMD A;
- `producto_sucursal` 072: stock/VMD B;
- `producto_sucursal` 021: stock/VMD C.

Validar:

- cambiar stock de 091 no cambia 072 ni 021;
- cambiar VMD de 072 no cambia 091 ni 021;
- un EAN aprendido queda disponible en la organización sin duplicar SKU;
- `productos.stock_actual` y `productos.venta_media_diaria` legacy no son legibles por browser autenticado después del cutover;
- `v_producto_sucursal_operativo` devuelve el estado exacto de la sucursal autorizada.

## 4. RLS — matriz de lectura

### Gerente zonal Río Gallegos

Debe ver 091 y 072. No debe ver 021.

### Gerente 091

Debe ver únicamente 091.

### Operador 091 familia A

Debe ver únicamente:

- sucursal 091;
- familia A;
- productos/vencimientos de familia A.

No debe ver:

- familia B de 091;
- familia A de 072;
- 021.

### Gerente zonal Comodoro

Debe ver 021 y no 091/072.

## 5. RLS — DML browser negativo

Con JWT `authenticated`, comprobar que fallan los DML crudos:

- INSERT/UPDATE/DELETE `productos`;
- INSERT/UPDATE/DELETE `producto_sucursal`;
- INSERT/UPDATE/DELETE `producto_codigos`;
- INSERT/UPDATE/DELETE `vencimientos`;
- INSERT/UPDATE/DELETE `acciones_operativas`;
- INSERT `vencimiento_observaciones`;
- INSERT `intervenciones_rag`;
- INSERT/UPDATE/DELETE `usuarios`;
- cualquier acceso a `usuario_familias` legacy;
- INSERT/UPDATE/DELETE `sucursales`, `sectores`, `familias`.

Al mismo tiempo deben seguir funcionando los RPC públicos autorizados.

## 6. Scanner

Validar por usuario/sucursal:

- buscar por EAN;
- buscar por `cod_art`;
- detectar conflicto EAN/código dentro de la organización;
- vincular EAN existente;
- completar `cod_art`;
- crear SKU nuevo + EAN + estado de sucursal atómicamente;
- actualizar stock únicamente en `producto_sucursal` de la sucursal actual;
- crear vencimiento + primera observación atómicamente;
- actualizar vencimiento + observación sin DML directo browser.

**Negativo:** operador sin familia/sucursal no puede usar los RPC para saltar el scope.

## 7. Importación Glaciar por familia

Validar:

- `Cod.Suc.Padrón` obligatorio;
- archivo 091 no puede importarse en sesión 072;
- familia debe pertenecer a la organización;
- preview usa catálogo + estado local de sucursal;
- decisión `mismo/distinto` está ligada al `producto_id` visto en preview;
- cambio concurrente del catálogo invalida una decisión vieja;
- catálogo + estado + snapshot + auditoría se aplican en una sola transacción;
- SHA repetido en la misma sucursal no duplica importación;
- mismo SHA en otra sucursal es independiente.

## 8. Importación masiva

Validar mismo archivo con SKU conocido y desconocido:

- conocido + familia → actualiza sólo estado local;
- desconocido → pendiente global, sin escritura arbitraria en catálogo;
- conocido sin familia → pendiente;
- snapshot conserva stock negativo/VMD anómalo si así llega del sistema fuente;
- pendientes detectados por distintas sucursales convergen al mismo catálogo global;
- resolver pendiente propaga clasificación sin mezclar stock entre tiendas.

## 9. Motor de riesgo por sucursal

Usar el mismo SKU con estados locales distintos y vencimientos equivalentes.

Casos mínimos:

1. >45 días → seguro.
2. <=45 + cantidad/VMD excede ventana → radar.
3. <=20 + riesgo persiste → urgente.
4. <=10 + cantidad comprometida >0 → donación, aunque VMD matemáticamente pudiera venderla.
5. <=0 → decomiso.
6. VMD 0 → cobertura infinita para Radar/Urgente, respetando luego 10/0 obligatorios.
7. Misma cantidad/fecha pero VMD distinto por sucursal → niveles distintos sin contaminación cruzada.

## 10. Controles, RAG y resultados terminales

Validar:

- cada control crea observación append-only;
- cantidad actual sincroniza con última observación;
- RAG conserva porcentaje, cantidad y VMD del momento de aplicación;
- `vendido` cierra una sola vez y deja acción auditable;
- `donacion` cierra con cantidad positiva;
- `decomiso` cierra con cantidad positiva;
- doble cierre concurrente falla;
- anulación por carga incorrecta no se contabiliza como vendido/donación/decomiso.

## 11. Historial y Dashboard

- `v_acciones_operativas_historial` sólo devuelve acciones dentro del scope.
- El nombre del actor se muestra sin abrir lectura global de `usuarios`.
- `vendido` cuenta casos resueltos, no unidades inferidas.
- donación/decomiso suman cantidades según contrato actual.
- operador no puede consultar historial de otra familia/sucursal.

## 12. Admin por sucursal

Validar:

- gerente de 091 no administra 072;
- alta de operador crea perfil + acceso + familias coherentes;
- una familia activa tiene un único operador responsable por sucursal;
- la misma familia puede tener operador distinto en 091 y 072;
- edición de un usuario no borra accesos de otras sucursales;
- fallo de asignación revierte la transacción de DB;
- si una cuenta Auth nueva no puede completar DB, el endpoint compensa eliminando la cuenta recién creada.

## 13. Advisors y comprobaciones finales

Ejecutar después del replay/cutover:

- Security Advisor;
- Performance Advisor;
- listado de `pg_policies` para tablas Noven críticas;
- listado de grants de `authenticated`;
- búsqueda de policies `SELECT USING(true)` en tablas críticas;
- búsqueda de SECURITY DEFINER en schema `public` introducidas por esta fase;
- comprobar que no se agregaron nuevos warnings de FK sin índice.

Separar cualquier finding 5S del alcance Noven; no corregirlo en esta fase.

## 14. Gate para producción

Sólo se habilita el plan productivo si se cumplen TODOS:

- replay limpio sin intervención manual;
- CI verde;
- RLS positivo y negativo aprobado;
- Scanner aprobado;
- importación familia y masiva aprobadas;
- 45/20/10 aprobado;
- historial/terminales aprobado;
- Admin aprobado;
- advisors sin nuevos findings críticos de Noven;
- branch descartable eliminada al finalizar.
