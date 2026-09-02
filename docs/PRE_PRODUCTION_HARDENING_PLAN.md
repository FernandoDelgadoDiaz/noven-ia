# NOVEN · Plan de endurecimiento pre-producción

**Estado del documento:** reconstruido desde evidencia del repositorio el 2026-09-02.
**Punto de verificación:** `master` = `50a27c7`.

## 0. Por qué existe este documento

La auditoría que originó este plan se realizó sobre el HEAD `46a93f4` (2026-08-30) y **nunca fue commiteada**. El plan de cuatro fases vivió fuera de Git: no existe en ningún commit de ninguna rama, ni referenciado desde ningún archivo del repositorio.

La consecuencia práctica fue que el estado del plan sólo podía reconstruirse por arqueología sobre mensajes de PR y nombres de rama. Este documento existe para cerrar esa brecha: **es la fuente de verdad del plan de endurecimiento**. Cualquier sesión futura arranca de acá.

El contenido de Fase 0 y Fase 1 fue reconstruido a partir de:

- commits y PRs con prefijo `hardening/` (#123–#132);
- `ai/decisions.md`;
- `docs/MIGRATION_REPLAY_BASELINE_V1.md` y `docs/DESAFIO5S_COLD_ARCHIVE.md`;
- los contratos en `scripts/tests/` y la suite en `scripts/live-isolation/`;
- `.github/workflows/ci.yml` y el historial de runs de `Noven CI`;
- consultas de sólo lectura contra Supabase producción (`meqvjabgyrgwkxpclqxp`).

Los veredictos de abajo se apoyan en esa evidencia, no en el enunciado original de la auditoría, que no está disponible.

## 1. Convenciones

| Veredicto | Significado |
|---|---|
| **HECHO** | Implementado, mergeado a `master` y respaldado por evidencia verificable. |
| **PARCIAL** | Mergeado pero con alcance menor al que el ítem requiere. Se detalla qué falta. |
| **PENDIENTE** | Sin empezar. |
| **NO DEFINIDO** | El ítem no existe en el repositorio en ninguna forma. |

Regla de trabajo vigente: un PR por ítem, rama → PR → CI verde → merge. Ningún cambio directo a `master`.

## 2. Fase 0 — Base de control

### 0.1 · Proteger `master` — HECHO

- PR #123 (`c4ebcfd`, merge `64fcf0b`) agregó `master` al trigger `push` de `.github/workflows/ci.yml` como red secundaria.
- La API de GitHub devuelve `"protected": true` para `master` (y `false` para las 141 ramas restantes).
- CI corre efectivamente en push a `master` desde el run #319: runs 319, 321, 323, 326, 333, 337, 339, 341, 343 y 345 (`50a27c7`, success).

**Salvedad registrada:** las reglas concretas de protección no pudieron verificarse desde sesión automatizada — la API de protección de rama y de rulesets devuelve 403 a través del proxy, y el servidor MCP de GitHub no expone esos endpoints. El PR #123 declaró cuatro requisitos: PR obligatorio sobre `master`, required status check del workflow `Noven CI`, bloqueo de force-push y bloqueo de delete. **Verificación manual pendiente en Settings → Branches.**

### 0.2 · Archivar Desafío 5S en frío — HECHO

- PR #124, migración `20260901103500_desafio5s_cold_archive_v1.sql`.
- Verificado contra producción: **0** objetos `desafio5s_*` en `public` (funciones y relaciones), **9** relaciones vivas en `desafio5s_archive`, bucket `desafio5s-imagenes` con `public = false`.
- Contrato: `scripts/tests/desafio5s-cold-archive-contract.test.mjs` prohíbe operaciones destructivas en esa migración.
- Documentación: `docs/DESAFIO5S_COLD_ARCHIVE.md` (inventario preservado, mecánica del archivo, dependencia conocida y condición de salida).

### 0.3 · Registrar decisiones pendientes — PARCIAL

- PR #125 registró en `ai/decisions.md` dos de las tres decisiones previstas:
  1. excepción transitoria `admin_organizacion + gerente_sucursal 091`, con motivo y condición de salida;
  2. archivo frío de Desafío 5S dentro del proyecto Supabase de NoVen, con condición de salida y la dependencia conocida `desafio5s_es_admin() → public.rol_actual() → public.usuarios`.
- **Falta la tercera:** la elección de proveedor de inferencia para `analisis.ts`. El propio PR #125 la difirió explícitamente al ítem 1.5, "después de evaluar jurisdicción, retención y calidad contra un corpus sintético determinístico".

**0.3 no se cierra hasta que 1.5 produzca esa decisión y quede registrada en `ai/decisions.md`.**

## 3. Fase 1 — Endurecimiento técnico

### 1.1 · Suite live de aislamiento multitenant — HECHO

- PR #126 (merge `157b354`).
- `scripts/live-isolation/gates-1-3.mjs` crea tres usuarios sintéticos vía Auth Admin local, obtiene **JWT reales** por password grant y ejecuta lecturas y escrituras contra PostgREST y RPC reales sobre un Supabase local descartable. Sin mocks ni interceptores.
- Gates verificados:
  - **Gate 1 — operador A1:** lee sólo su sucursal y su familia asignada; ejecuta la RPC atómica dentro de alcance; PATCH y RPC fuera de alcance reciben 403 y no mutan datos (confirmado con service-role local).
  - **Gate 2 — gerente de sucursal A1:** lee sólo su sucursal; no lee A2 ni otra organización.
  - **Gate 3 — gerente zonal A1:** lee A1 y A2 de su zona; no lee la zona A2 ni la organización B.
- Guard duro que rechaza cualquier host no local o HTTPS; el stack se detiene siempre al finalizar.
- Corre en CI como paso propio (`Live isolation Gates 1-3`).
- Contrato: `scripts/tests/live-isolation-gates-contract.test.mjs`.

**Límite conocido:** los gates prueban aislamiento sobre organizaciones, zonas y sucursales **sintéticas**. Las 183 sucursales reales de producción no han sido ejercidas por esta suite.

### 1.2 · Rate limiting de administración e invitaciones — PARCIAL

- PR #131.
- `netlify/functions/admin-read.ts`: 180 req / 60 s. `netlify/functions/admin-write.ts`: 20 req / 60 s. Ambas con ventana deslizante y `aggregateBy: ['ip', 'domain']`.
- Rutas canónicas `/api/admin/read/*` y `/api/admin/write/*`, despachadas por `_lib/admin-router.ts`.
- Bypass cerrado: los handlers legacy devuelven 404 cuando `adminLaneForPath` no matchea, de modo que `/.netlify/functions/admin-*` ya no es una vía alternativa sin límite.
- Contrato: `scripts/tests/admin-rate-limit-contract.test.mjs`.

**Qué quedó incompleto.** La cobertura es exclusivamente administrativa. Las otras 17 funciones de `netlify/functions/` no tienen ningún límite, incluida `analisis.ts`, que es un endpoint autenticado que gasta tokens de un proveedor pago por request.

El techo del plan básico de Netlify (dos reglas `rateLimit` declaradas en código) ya está consumido. Ver §6 — **deuda conocida D-1**.

### 1.3 · Eliminar scans globales de Auth — HECHO

- PR #132 (`83f2953`).
- `netlify/functions/_lib/auth-directory.ts` reemplaza la paginación global de `listUsers` y `/auth/v1/admin/users` por `getUserById` puntual.
- Los IDs consultados provienen exclusivamente del resultado ya autorizado de `listar_admin_sucursal_v1`; se deduplican y se consultan de a 8 en paralelo.
- Se conservan usuarios locales cuya identidad Auth fue eliminada (email vacío, no error).
- Se eliminó el pre-scan de emails previo a invitar: Auth resuelve la unicidad de forma atómica y sólo los códigos estables `email_exists` y `user_already_exists` se traducen a HTTP 409.
- Contrato: `scripts/tests/auth-directory-scope-contract.test.mjs` impide reintroducir scans globales o paginación del directorio.

### 1.4 · Replay reproducible de migraciones — HECHO

Partido en tres subítems porque el bloqueo original resultó ser de estado, no de orden.

**1.4A — Bootstrap legacy (PR #127).** Shim efímero que recrea `public.handle_updated_at()` y el trigger `productos_updated_at`, activo sólo bajo `NOVEN_EPHEMERAL_REPLAY=1`, con cleanup por `trap` e ignore explícito para impedir commit accidental. Contrato: `migration-replay-legacy-bootstrap.test.mjs`.

**1.4B — Contrato de baseline (PR #128).** `scripts/migration-replay/history-manifest.json` inventaría y clasifica las migraciones que no son un instalador universal: precondición legacy `handle_updated_at`, bootstrap que exige exactamente un gerente activo de 091, identidad Auth `gerente091@gmail.com`, la corrección stateful `prod_20260828000021` sin homónimo en Git, y la reparación ligada a un SKU/EAN/costo productivo concreto. Política declarada: entornos nuevos y CI usan `baseline verificada → migraciones posteriores`, nunca el historial completo. Contrato: `migration-replay-baseline-contract.test.mjs`.

**1.4C — Materializar la baseline (PR #129).** 39 fragmentos SQL en `scripts/migration-replay/baseline-v1/`, verificados por Git blob SHA: 31 tablas, 384 columnas, 226 constraints, 128 índices standalone, 112 funciones, 12 views, 29 triggers, RLS en 31/31 tablas, 17 policies, y ACL explícitos de schemas, relaciones, secuencias y funciones.

- Cutoff: `20260901103500_desafio5s_cold_archive_v1.sql`.
- SQL ensamblado: `334a0b7555185f07f83f7342bce442f5079fe9b42cf9d5fc1a4622db7bb72abf`.
- Fingerprint canónico V1: `837771691ffc6e2276c66a26f9ae010c872f12ea33b118406d48b2ad6fca38af`.
- Huella productiva legacy preservada: `2cdba36ae58117100c8d0c8f9ddf235beeb8eaa372c90d9c777c43a991ad2020`.

**El gate es bloqueante, no advisory.** `verify-structural-fingerprint.mjs` lanza excepción ante cualquier diferencia estructural no explicada y ante un cambio del SHA de la huella productiva registrada. `run-baseline-replay.sh` corre con `set -euo pipefail`, de modo que un fallo del replay corta el job antes de los gates de aislamiento y del E2E.

Documentación completa: `docs/MIGRATION_REPLAY_BASELINE_V1.md`.

### 1.5 · Decisión de proveedor de inferencia — PENDIENTE

Nada implementado. `netlify/functions/analisis.ts` sigue enviando a `https://api.deepseek.com/chat/completions` (modelo `deepseek-chat`, `temperature 0.2`, `max_tokens 1500`). No existe entrada en `ai/decisions.md`.

Alcance comprometido en el PR #125:

1. construir un corpus sintético determinístico, con verdad de base conocida y sin datos comerciales reales;
2. evaluar candidatos por **adherencia a los guardarraíles del system prompt** — no afirmar porcentajes de mejora sin base comparable, no inventar estacionalidad, no confundir trimestre abierto con cerrado — no por estilo;
3. sumar el análisis documental de jurisdicción y política de retención de cada candidato;
4. presentar la comparación **antes** de migrar; la decisión es del responsable del producto;
5. una vez tomada, migración y registro en `ai/decisions.md` van en el mismo PR.

Este ítem bloquea el cierre de 0.3.

### Fuera de numeración · Reloj determinístico para E2E RAG — HECHO

PR #130. Un E2E dependía de la fecha real: el fixture usaba vencimiento `2026-09-12` y al llegar el 2026-09-02 entró en la ventana de donación de 10 días, dejó de renderizar el control RAG y el test se volvió dependiente del calendario. Se fijó el reloj de esa prueba en `2026-08-31T12:00:00Z` sin tocar lógica de producto.

**La clase de problema sigue viva:** las fechas de los fixtures siguen siendo absolutas y la lógica de riesgo depende de ventanas móviles de 45 / 20 / 10 / 2 días.

## 4. Fases 2 y 3 — NO DEFINIDAS

**No existen en el repositorio.** No hay commit, rama, PR, archivo ni referencia que las mencione. Toda la actividad posterior al 2026-08-30 corresponde a Fase 0 y Fase 1.

La auditoría original enunciaba cuatro fases (0, 1, 2 y 3), pero el contenido de las dos últimas quedó fuera de Git junto con el resto del documento.

**Acción requerida:** definir el alcance de Fases 2 y 3 y registrarlo en este archivo antes de darlas por planificadas. Hasta entonces, cualquier afirmación sobre su estado es especulación.

## 5. Verificación del estado actual

Qué corre y qué prueba, al 2026-09-02:

- **`scripts/tests/`: 89 archivos `.test.mjs`.** Contratos en Node puro (`node:assert`), sin framework: leen el código fuente o transpilan un módulo TS y afirman invariantes. `scripts/test.mjs` los corre en procesos separados y devuelve exit≠0 si alguno falla. Ocho fueron creados por este plan: `admin-rate-limit-contract`, `auth-directory-scope-contract`, `desafio5s-cold-archive-contract`, `live-isolation-gates-contract` y los cuatro `migration-replay-*`.
- **`e2e/`: 2 specs, 15 tests** (13 en `critical-flows.spec.mjs`, 2 en `catalog-role-boundary.spec.mjs`), 3 fixtures. **Corren contra un Supabase interceptado por fixture** (`VITE_SUPABASE_URL=http://127.0.0.1:4173/__supabase`), no real: son tests de flujo de UI y **no ejercen RLS**. La verificación con backend real vive exclusivamente en `scripts/live-isolation/gates-1-3.mjs`.
- **`.github/workflows/ci.yml`: un único job `verify`,** en orden — `npm test` → `npm run lint` → `npm run build` → replay de Baseline V1 con fingerprint estructural → export de credenciales efímeras → Gates 1–3 → Playwright/Chromium → parada del Supabase efímero (`if: always()`). Triggers: push a `master`, push a `feat/multitenant-architecture-v1` (rama ya fusionada, ver E1) y pull request contra `master`.

Estado de producción al mismo corte (`meqvjabgyrgwkxpclqxp`, Postgres 17.6, `sa-east-1`):

- 1 organización, 17 zonas, 183 sucursales cargadas y activas — **datos operativos únicamente en la 091**: 713 filas de `producto_sucursal` y 145 vencimientos, todas de 091;
- 713 productos de catálogo, 3 importaciones;
- 3 usuarios y 4 accesos activos;
- ledger de migraciones: 142 versiones aplicadas, última `20260901134512`; el repositorio tiene 106 archivos, y la brecha está inventariada en `history-manifest.json`;
- `authenticated` tiene sólo `SELECT` sobre `productos`, `vencimientos` y `producto_sucursal`; **0** policies de `SELECT USING(true)` en `public`;
- advisors de seguridad: sin ERROR; 22 INFO `rls_enabled_no_policy` (7 del schema archivado, correcto por diseño; 15 de tablas NoVen deliberadamente server-only); 3 WARN — `pg_net` en `public`, protección de contraseñas filtradas desactivada, y `aceptar_invitacion_acceso_v1()` ejecutable por `authenticated` como `SECURITY DEFINER` (intencional: es el canje de invitación).

## 6. Deuda conocida

Limitaciones aceptadas conscientemente. No son invariantes: son cosas que hay que resolver cuando el contexto lo permita.

**D-1 · Techo de rate limiting de Netlify.** El plan básico admite dos reglas `rateLimit` declaradas en código, y ambas están consumidas por `/api/admin/read/*` y `/api/admin/write/*`. Ninguna otra función puede protegerse por esa vía. `analisis.ts` es el caso más expuesto. Requiere una vía alternativa (límite por usuario en Postgres, router con path único, u otra).

**D-2 · Dependencia viva del schema archivado.** `desafio5s_es_admin()` consulta `public.rol_actual()` y por esa vía `public.usuarios` de NoVen. Se conserva a propósito para permitir restauración en el proyecto actual, pero significa que un refactor de `rol_actual()` o de `usuarios` rompe silenciosamente un módulo que nadie está mirando. Condición de salida en `ai/decisions.md`.

**D-3 · Concentración de privilegios.** La única cuenta administradora combina `admin_organizacion` con `gerente_sucursal` de 091. Documentada como transitoria, con condición de salida — que se dispara justo en el momento de mayor carga: incorporar una organización o delegar la administración jerárquica.

**D-4 · Superficie de tenancy 60× mayor que la operada.** 183 sucursales activas contra 1 con datos. El aislamiento está probado sobre entidades sintéticas; el primer usuario de una segunda sucursal real será la primera vez que se ejerza sobre datos productivos.

**D-5 · Fixtures con fechas absolutas.** Ver el ítem fuera de numeración de §3.

**D-6 · Datos operativos hacia un proveedor sin decisión registrada.** Ver 1.5.

## 7. Fuera del alcance de las sesiones automatizadas

Requieren intervención manual del responsable:

- verificar y completar las reglas de protección de `master` en la UI de GitHub (ver 0.1);
- activar leaked-password protection en Supabase Auth;
- mover la extensión `pg_net` fuera del schema `public`;
- decidir el estado de las 182 sucursales cargadas sin datos operativos;
- la prueba operativa corta en 091 que `docs/PRODUCTION_CUTOVER_STATUS_20260827.md` define como paso previo a incorporar una segunda sucursal real (Dashboard, Scanner, cierre vendido, Historial, importación por familia y masiva, Admin).

## 8. Mantenimiento de este documento

Cada PR de endurecimiento que cambie el estado de un ítem debe actualizar su veredicto acá, en el mismo PR. Un ítem que pasa de PARCIAL a HECHO sin que este archivo lo refleje reintroduce exactamente el problema que motivó §0.
