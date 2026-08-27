# NOVEN · ESTADO DE CUTOVER PRODUCTIVO · 2026-08-27

## Estado

**CUTOVER MULTITENANT COMPLETADO EN PRODUCCIÓN.**

La arquitectura validada fue mergeada a `master`, Netlify quedó nuevamente vinculado al repositorio `FernandoDelgadoDiaz/noven-ia` y el smoke de despliegue exacto confirmó que producción publica los commits actuales.

Supabase producción tiene aplicado el bloque multitenant completo, incluido el cierre de RLS y el hardening posterior.

## Migraciones productivas finales

Aplicadas correctamente:

1. `20260827000270_rls_cutover_v1.sql`
2. `20260827000275_rls_grants_hardening_v1.sql`
3. `20260827000280_advisor_hardening_v1.sql`
4. `20260827000290_post_cutover_security_v1.sql`
5. `20260827000300_index_cleanup_v1.sql`

Las versiones remotas quedaron registradas en `supabase_migrations.schema_migrations` con nombres `prod_*`.

## Checkpoint de datos después del cutover

- productos: 659
- estados `producto_sucursal` para 091: 659
- vencimientos históricos: 122
- acciones históricas: 15
- importaciones nuevas: 0
- pendientes globales: 0
- observaciones nuevas: 0
- intervenciones RAG nuevas: 0
- policies críticas Noven con `SELECT USING(true)`: 0

El despliegue no inventó ni eliminó actividad operativa histórica.

## Netlify

El sitio `https://noven-ia.netlify.app` quedó reconectado al repositorio GitHub.

El smoke `Production Deploy Smoke` confirmó:

- publicación del marcador exacto del commit nuevo;
- respuesta válida de la SPA productiva.

La rama productiva es `master`.

## Seguridad Noven

El navegador ya no tiene escritura directa sobre las tablas operativas. Los writes pasan por RPC/endpoints endurecidos y el estado de stock/VMD vive por sucursal.

El catálogo `productos` no expone al browser las columnas legacy `stock_actual` ni `venta_media_diaria` de 091.

No quedan policies críticas Noven de lectura abierta `USING(true)`.

El webhook secret de push fue retirado del cuerpo de `notify_push_urgente()` y almacenado en Supabase Vault bajo `noven_push_webhook_secret`. La función ahora lee Vault en runtime y no es ejecutable por `anon` ni `authenticated` como RPC.

Se eliminaron índices legacy duplicados sin tocar índices que respaldaran constraints.

## Advisors posteriores

Los hallazgos Noven críticos que motivaron el cutover quedaron resueltos.

Los avisos restantes se dividen en:

- tablas Noven deliberadamente server-only con RLS y sin policies browser (`importaciones`, snapshots y pendientes);
- índices nuevos marcados como `unused` inmediatamente después del despliegue, que no deben eliminarse por esa señal temprana;
- configuración/plataforma Supabase (`pg_net`, estrategia de conexiones Auth y leaked-password protection);
- hallazgos `desafio5s_*`, pertenecientes al sistema 5S y fuera del alcance de este cutover.

No modificar `desafio5s_*` como parte de Noven.

## Arquitectura productiva resultante

- catálogo de producto compartido por organización;
- stock y VMD independientes por sucursal;
- vencimientos y acciones scoped por sucursal/familia;
- clasificación `cod_art → familia` compartida por organización;
- detecciones pendientes conservadas por sucursal/importación;
- RAG con histórico de intervenciones y observaciones;
- cierre terminal auditable `vendido / donacion / decomiso`;
- administración de usuarios y asignaciones por sucursal;
- importadores Glaciar con escritura server-side/transaccional;
- browser sin DML directo sobre tablas operativas.

## Próximo paso operativo

El cutover técnico está cerrado. Antes de incorporar una segunda sucursal real, conviene realizar una prueba operativa corta en 091 con las pantallas productivas: Dashboard, Scanner, cierre vendido, Historial, importación por familia/masiva y Admin.
