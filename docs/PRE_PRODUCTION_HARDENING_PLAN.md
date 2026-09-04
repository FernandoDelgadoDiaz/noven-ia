# NOVEN · Plan de endurecimiento pre-producción

**Estado del documento:** reconstruido desde evidencia del repositorio el 2026-09-02; Fases 2 y 3 definidas el 2026-09-03.
**Punto de verificación:** `master` = `c7adbd3` (2.2 y 2.3 mergeados).

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

**Fases 2 y 3 se definieron el 2026-09-03** y ya no figuran como NO DEFINIDAS. Su contenido no se reconstruyó —no había qué reconstruir, quedó fuera de Git junto con el resto— sino que se acordó y se bajó acá. Los veredictos de sus ítems se apoyan en el relevamiento de sólo lectura de producción de esa fecha: grants, políticas RLS, advisors de seguridad y workflows de CI.

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

### 0.3 · Registrar decisiones pendientes — HECHO

- PR #125 registró en `ai/decisions.md` dos de las tres decisiones previstas:
  1. excepción transitoria `admin_organizacion + gerente_sucursal 091`, con motivo y condición de salida;
  2. archivo frío de Desafío 5S dentro del proyecto Supabase de NoVen, con condición de salida y la dependencia conocida `desafio5s_es_admin() → public.rol_actual() → public.usuarios`.
- **La tercera quedó registrada el 2026-09-04:** la elección de proveedor de inferencia para `analisis.ts`. PR #141 registra OpenAI con `gpt-5.6-terra`, credencial server-only, `store=false`, y la jurisdicción que efectivamente se sostiene —procesamiento en EE.UU. por defecto, sin residencia contratada, porque la cuenta no es elegible—. Incluye la corrección del fundamento original, que confundía residencia de almacenamiento con residencia de procesamiento.

**0.3 cerrado.** Las tres decisiones previstas están en `ai/decisions.md` con motivo y condición de salida.

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

### 1.2 · Rate limiting y cuota por actor — PARCIAL

**Rate limiting administrativo (PR #131).**

- `netlify/functions/admin-read.ts`: 180 req / 60 s. `netlify/functions/admin-write.ts`: 20 req / 60 s. Ambas con ventana deslizante y `aggregateBy: ['ip', 'domain']`.
- Rutas canónicas `/api/admin/read/*` y `/api/admin/write/*`, despachadas por `_lib/admin-router.ts`.
- Bypass cerrado: los handlers legacy devuelven 404 cuando `adminLaneForPath` no matchea, de modo que `/.netlify/functions/admin-*` ya no es una vía alternativa sin límite.
- Contrato: `scripts/tests/admin-rate-limit-contract.test.mjs`.

**Cuota por actor en Postgres (C3, PR #140).** La vía nativa de Netlify no alcanzaba, por dos razones que se descubrieron al medirlas: `config.rateLimit` sólo existe en el runtime v2 y **14 de las 16 funciones son handlers v1**, de modo que el techo real no era "dos reglas" sino "dos reglas *y* migrar cada función a v2"; y la agregación es por IP, que en un supermercado —donde toda la sucursal sale por una IP pública— traba a los operadores legítimos sin frenar a quien cambie de red.

El actor que hay que limitar es el usuario, y la única capa que lo conoce de forma confiable es la base.

- Migración `20260902170000_cuota_por_actor_y_cache_analisis_v1.sql`: `rate_limit_consumo` (una fila por actor/endpoint/ventana, con la ventana truncada dentro de la PK para que las viejas queden huérfanas y se purguen por antigüedad, sin lógica de expiración) y `analisis_cache` (clave restringida por CHECK a sha256 hex). Ambas server-only: RLS activo, cero policies, ACL revocadas de `PUBLIC`, `anon` y `authenticated`.
- `consumir_cuota_actor_v1` es atómica: `INSERT ... ON CONFLICT ... DO UPDATE SET consumo = consumo + 1 RETURNING`, una sola sentencia por ventana. No hay `SELECT` seguido de `UPDATE`, que es la carrera que un bucle explota. Las dos ventanas se toman siempre en el mismo orden porque son filas distintas y el orden inverso deadlockearía. Se decide sobre el valor devuelto por el incremento, nunca antes: un intento rechazado también consume ventana, así un bucle se auto-castiga en vez de reintentar gratis.
- `netlify/functions/_lib/cuota.ts` declara la política por endpoint y queda listo para los demás. `analisis` declara `anteFalla: 'cerrado'`, con el comentario que explica por qué es el criterio **inverso** al de un endpoint operativo: en Scanner fallar cerrado rompería la operación de la sucursal por un contador caído, mientras que acá fallar abierto es costo ilimitado en un tercero y datos operativos saliendo del país sin techo.
- Caché server-side con clave `sha256(system_prompt + datosFormateados)`. Es segura por construcción: un acierto sólo ocurre si la entrada autorizada es byte a byte idéntica, así que devolver el ámbito de otro usuario es estructuralmente imposible, no una verificación que alguien pueda olvidar. Se invalida sola a diario porque la fecha operacional viaja dentro de los datos.
- Límites 10/hora y 20/día por usuario. 429 al superarlos, 503 si el contador no responde.
- Contratos: `cuota-analisis-contract.test.mjs` (uso normal, ambos límites, las tres formas de contador caído, orden de las operaciones, atomicidad de la RPC y ACL server-only) y `scripts/live-isolation/cuota-analisis.mjs`, que contra Postgres real dispara **40 llamadas concurrentes contra un límite de 10** y exige exactamente 10 permitidas con consumos consecutivos sin repeticiones. Eso es lo único que prueba la atomicidad: una prueba secuencial la pasaría igual un contador con carrera.

**Estado productivo.** La migración fue aplicada después del merge. Git la conserva como `20260902170000_cuota_por_actor_y_cache_analisis_v1.sql`; producción la registró como versión `20260902211635`, con el mismo nombre `cuota_por_actor_y_cache_analisis_v1`. El desfase de timestamp proviene del mecanismo remoto usado al aplicarla y está inventariado en `history-manifest.json`; no se normaliza el ledger.

**Qué sigue incompleto.** Diez endpoints autenticados por JWT siguen sin cuota por actor. Tres de ellos —los administrativos— tienen al menos el límite por IP del router. Los siete restantes no tienen ninguno: `costos-riesgo`, `problemas-activos`, `importar-familia`, `importar-asistido-completo`, `aprender-pendientes-familia`, `listar-pendientes-catalogo` y `resolver-pendiente-catalogo`.

El mecanismo para cubrirlos ya existe y es el mismo: declarar su política en `_lib/cuota.ts` —eligiendo explícitamente `anteFalla`, que para un endpoint operativo debe ser `abierto`— y llamar a `consumirCuota` después de resolver el uid. **1.2 se cierra cuando estén cubiertos.**

### 1.3 · Eliminar scans globales de Auth — HECHO

- PR #132 (`83f2953`).
- `netlify/functions/_lib/auth-directory.ts` reemplaza la paginación global de `listUsers` y `/auth/v1/admin/users` por `getUserById` puntual.
- Los IDs consultados provienen exclusivamente del resultado ya autorizado de `listar_admin_sucursal_v1`; se deduplican y se consultan de a 8 en paralelo.
- Se conservan usuarios locales cuya identidad Auth fue eliminada (email vacío, no error).
- Se eliminó el pre-scan de emails previo a invitar: Auth resuelve la unicidad de forma atómica y sólo los códigos estables `email_exists` y `user_already_exists` se traducen a HTTP 409.
- Contrato: `scripts/tests/auth-directory-scope-contract.test.mjs` impide reintroducir scans globales o paginación del directorio.

### 1.4 · Replay reproducible de migraciones — HECHO

Partido en subítems porque el bloqueo original resultó ser de estado, no de orden.

**1.4A — Bootstrap legacy (PR #127).** Shim efímero que recrea `public.handle_updated_at()` y el trigger `productos_updated_at`, activo sólo bajo `NOVEN_EPHEMERAL_REPLAY=1`, con cleanup por `trap` e ignore explícito para impedir commit accidental. Contrato: `migration-replay-legacy-bootstrap.test.mjs`.

**1.4B — Contrato de baseline (PR #128).** `scripts/migration-replay/history-manifest.json` inventaría y clasifica las migraciones que no son un instalador universal: precondición legacy `handle_updated_at`, bootstrap que exige exactamente un gerente activo de 091, identidad Auth `gerente091@gmail.com`, la corrección stateful `prod_20260828000021` sin homónimo en Git, y la reparación ligada a un SKU/EAN/costo productivo concreto. Política declarada: entornos nuevos y CI usan `baseline verificada → migraciones posteriores`, nunca el historial completo. Contrato: `migration-replay-baseline-contract.test.mjs`.

**1.4C — Materializar la baseline (PR #129).** 39 fragmentos SQL en `scripts/migration-replay/baseline-v1/`, verificados por Git blob SHA: 31 tablas, 384 columnas, 226 constraints, 128 índices standalone, 112 funciones, 12 views, 29 triggers, RLS en 31/31 tablas, 17 policies, y ACL explícitos de schemas, relaciones, secuencias y funciones.

- Cutoff: `20260901103500_desafio5s_cold_archive_v1.sql`.
- SQL ensamblado: `334a0b7555185f07f83f7342bce442f5079fe9b42cf9d5fc1a4622db7bb72abf`.
- Fingerprint canónico V1: `837771691ffc6e2276c66a26f9ae010c872f12ea33b118406d48b2ad6fca38af`.
- Huella productiva legacy preservada: `2cdba36ae58117100c8d0c8f9ddf235beeb8eaa372c90d9c777c43a991ad2020`.

**1.4D — Expectativa móvil (PR #138).** El gate de 1.4C sólo podía estar verde con el schema congelado: el replay aplica baseline + migraciones posteriores al cutoff, pero comparaba contra una foto estática que sólo contenía el baseline. La primera migración nueva —cualquiera— lo rompía por diseño. La expectativa pasó a ser móvil y atada por hash al conjunto exacto de migraciones posteriores; el ancla de producción `expected-fingerprint.json` queda intacta y sólo se re-materializa de forma explícita y periódica. Contrato: `migration-replay-moving-expectation.test.mjs`.

**Lo que el gate dejó de responder en cada corrida:** "¿el repositorio reconstruye lo que hay en producción?". Ahora verifica reproducibilidad y cambio declarado. El ancla se mantiene viva sólo por la re-materialización periódica documentada en `docs/MIGRATION_REPLAY_BASELINE_V1.md` §14.4, con un tripwire en la suite si se pasa de los días declarados.

**1.4E — Workflow de regeneración (PR #139).** Regenerar la expectativa móvil exige levantar un Supabase descartable, y no todo entorno puede: el de las sesiones automatizadas tiene Docker, pero la política de egress le bloquea los CDN donde viven los blobs de las imágenes, lo que dejó a C3 sin poder cerrarse desde ahí. `.github/workflows/regenerate-replay-expectation.yml` corre esa regeneración en CI a pedido y devuelve los archivos como artefacto, con un resumen para revisar sin descargar.

Es `workflow_dispatch` únicamente, con `permissions: contents: read`, y **no commitea**: el diff de la expectativa es lo que hay que revisar en el PR, y un workflow que lo commiteara solo convertiría esa revisión en un paso automático que nadie lee. Antes de publicar el artefacto verifica que el ancla siga intacta, que no haya cambiado nada fuera de la expectativa móvil, y que la suite pase con el resultado. Contrato: `regenerate-workflow-contract.test.mjs`.

Cubre la mitad adyacente de la fricción documentada en `docs/MIGRATION_REPLAY_BASELINE_V1.md` §14.4 —correr el replay sin tener el entorno— pero **no** la extracción de fragmentos desde el catálogo productivo, que sigue manual y sigue siendo la condición de salida pendiente.

**1.4F — Respaldo verificable en logs.** El artefacto sigue siendo la vía principal, pero el workflow incorpora una recuperación opt-in para entornos donde no pueda descargarse: emite `expected-replay-fingerprint.json` y `replay-expectation.json` como `gzip+base64`, cada uno entre delimitadores propios y acompañado por su SHA-256. El input `emitir_payload_en_log` es booleano y permanece apagado por defecto.

`scripts/migration-replay/extraer-expectativa-del-log.mjs` sirve como emisor versionado y como extractor. Al extraer exige exactamente un bloque de cada archivo, valida delimitadores, nombre, encoding, base64 canónico, gzip, checksum y JSON antes de escribir únicamente los dos nombres permitidos. Contratos: `regenerate-workflow-contract.test.mjs` y `replay-log-extractor.test.mjs`.

**Primer ejercicio real del mecanismo.** La migración de C3 fue la primera posterior al cutoff. El workflow se disparó sobre su rama (run `33677961434`), regeneró la expectativa, verificó que el ancla siguiera intacta, que sólo cambiaran los dos archivos de la expectativa, y corrió la suite completa con el resultado. La expectativa quedó atada a `20260902170000_cuota_por_actor_y_cache_analisis_v1.sql` en el commit `129db11`. El mecanismo funcionó de punta a punta en su primer uso.

Al aplicarla a producción, Supabase registró la misma migración bajo la versión remota `20260902211635`. La equivalencia y la decisión explícita de no reescribir el ledger quedaron fijadas en `history-manifest.json` para distinguir este caso conocido de una deriva futura.

**El gate es bloqueante, no advisory.** `verify-structural-fingerprint.mjs` lanza excepción ante cualquier diferencia estructural no explicada y ante un cambio del SHA de la huella productiva registrada. `run-baseline-replay.sh` corre con `set -euo pipefail`, de modo que un fallo del replay corta el job antes de los gates de aislamiento y del E2E.

Documentación completa: `docs/MIGRATION_REPLAY_BASELINE_V1.md`.

### 1.5 · Decisión de proveedor de inferencia — HECHO

`netlify/functions/analisis.ts` usa OpenAI (`gpt-5.6-terra`, Chat Completions en `https://api.openai.com/v1/chat/completions`, `store=false`, `reasoning_effort=none`, `temperature=0.2`, `max_completion_tokens=1500`). La decisión está registrada en `ai/decisions.md` con jurisdicción, retención, límites y condición de salida.

**Estado por paso:**

| Paso | Estado |
|---|---|
| 1 · corpus sintético determinístico | **HECHO** — PR #146 |
| 2 · medir adherencia a guardarraíles | **HECHO** — corridas 33869459977 y 33903831553 |
| 3 · jurisdicción y retención | **HECHO** — PR #141, corregido el 04-09 |
| 4 · presentar la comparación | **N/A por decisión del responsable** |
| 5 · migración + `ai/decisions.md` | **HECHO** — PR #141 |

El paso 4 se canceló explícitamente: el responsable del producto eligió OpenAI el 2026-09-03 y la comparación contra otros candidatos se descartó antes de ejecutar llamadas pagas. **No se fabricaron resultados comparativos.**

**Resultado del paso 2.** Dos corridas contra la API real, 48 respuestas distintas en total —ninguna repetida entre corridas—, ocho escenarios por tres repeticiones cada una. **El modelo no violó ninguno de los diez guardarraíles en ninguna de las 48.** Los tres obligatorios —`porcentaje-sin-base`, `estacionalidad-inventada`, `trimestre-abierto-como-cerrado`— quedaron en verde 24/24 en la corrida final.

**Lo que costó llegar ahí, y por qué importa.** La primera corrida produjo 17 fallas y las 17 eran artefactos de los detectores: la suite nunca se había ejercido contra salida real y cada verificador estaba calibrado contra el fraseo que imaginó su autor. Se resolvió con una pasada de validación de los diez —59 casos de mutación con el fraseo de abstención extraído de las respuestas reales, más una prueba adversaria que inyecta violaciones dentro de una respuesta textual del modelo— y no parcheando el detector que fallaba en cada vuelta. El detalle está en `docs/ANALYSIS_PROVIDER_EVALUATION_V1.md` §5.

La distinción se mantiene explícita en ese documento: **el modelo se comportó bien** es evidencia de las corridas; **el instrumento lo certifica** sólo vale desde la validación completa. Antes de ella el corpus no estaba en condiciones de autorizar nada.

Dos hallazgos operativos que quedaron corregidos en el camino: el endpoint regional `us.api.openai.com` nunca funcionó —la cuenta no es elegible para residencia de datos y devolvía `HTTP 401 incorrect_hostname`—, y el job del workflow no tenía presupuesto de tiempo para el corpus completo, lo que producía cancelaciones que se leían como fallas.

El corpus vive en `scripts/evaluacion-proveedor/`: ocho escenarios deterministas con verdad de base conocida —unidades en riesgo, monto expuesto, existencia de ventana previa comparable, recurrencia—, sin datos comerciales reales. Diez verificadores, de los cuales tres son obligatorios y deciden si un proveedor sirve.

**No es sólo para esta migración.** Es la verificación de regresión de cualquier cambio futuro de modelo o de prompt, y `corpus-evaluacion-contract.test.mjs` lo mantiene atado al prompt real: si `analisis.ts` cambia un marcador estructural y el corpus no, CI va rojo.

**Pendiente de cierre operativo:** eliminar `DEEPSEEK_API_KEY` del código y de Netlify, recién después de verificar el análisis en producción contra OpenAI.

Desde el PR #137 hay **un solo system prompt** que evaluar (`SYSTEM_ADMIN`), no dos: al limitarse el análisis a roles de conducción desapareció la variante de operador. Eso reduce la superficie de la evaluación.

Este ítem cerró y con él se cerró 0.3.

### Fuera de numeración · Reloj determinístico para E2E RAG — HECHO

PR #130. Un E2E dependía de la fecha real: el fixture usaba vencimiento `2026-09-12` y al llegar el 2026-09-02 entró en la ventana de donación de 10 días, dejó de renderizar el control RAG y el test se volvió dependiente del calendario. Se fijó el reloj de esa prueba en `2026-08-31T12:00:00Z` sin tocar lógica de producto.

**La clase de problema sigue viva:** las fechas de los fixtures siguen siendo absolutas y la lógica de riesgo depende de ventanas móviles de 45 / 20 / 10 / 2 días.

### Fuera de numeración · Eliminar escritores directos desde el browser — HECHO

PR #135. `src/pages/Importar.tsx` e `ImportarMasivo.tsx` quedaron sin rutear cuando el router pasó a las variantes `*Seguro`, pero siguieron en el árbol. `Importar.tsx` contenía `insert()` y `update()` directos sobre `public.productos` desde React. No explotaban porque `authenticated` sólo tiene `SELECT`, pero volvían a ser explotables ante cualquier grant nuevo.

Contrato: `no-browser-business-writes.test.mjs` recorre el AST de `src/` con el compilador de TypeScript —no el texto, que un salto de línea evade— y falla ante `insert`, `update`, `upsert` o `delete` sobre cualquier tabla que no sea `push_subscriptions`. Incluye una autoprueba del detector para que no pueda pasar en vacío si el recorrido del AST se rompe.

### Fuera de numeración · Análisis limitado a roles de conducción — HECHO

PR #137. `analisis.ts` sólo se concede a `gerente_zonal` de la zona y a `gerente_sucursal` o `supervisor` de esa sucursal exacta. El operador recibe 403. Al quedar un único ámbito posible se eliminaron —no desactivaron— el filtrado por `usuario_familias_sucursal`, la variante `SYSTEM_OPERADOR` del prompt y la bifurcación `scopeCompleto`. Decisión registrada en `ai/decisions.md` con motivo y condición de salida.

### Fuera de numeración · Archivo frío de respaldos de agosto — EN EJECUCIÓN

El inventario físico productivo contiene 36 tablas: 33 core y tres respaldos históricos de agosto que la baseline excluye deliberadamente. Los respaldos conservan 113 filas: 19 en `dedup_turrocklets_backup_20260805`, 6 en `productos_descripcion_backup_20260805` y 88 en `productos_familia_backup_20260806`.

La revisión previa confirmó que no tienen foreign keys, vistas, funciones, triggers, publicaciones ni referencias desde el código activo. La migración nueva `20260903103749_archive_august_backups_v1.sql` propone moverlos de `public` a `noven_archive`, preservar filas, RLS, policies e índices, y revocar acceso a `PUBLIC`, `anon`, `authenticated` y `service_role`. No usa `DROP`, `DELETE` ni `TRUNCATE`; aborta ante cualquier inventario o dependencia inesperados. En un replay limpio funciona como no-op de datos porque la baseline no fabrica estos respaldos.

La decisión, evidencia de catálogo, mecanismo reversible y condición de restauración están en `docs/NOVEN_AUGUST_BACKUPS_COLD_ARCHIVE.md`. El contrato `august-backups-cold-archive-contract.test.mjs` verifica las guardas no destructivas, el inventario exacto, el comportamiento del replay y las exclusiones del fingerprint. El ítem permanece **EN EJECUCIÓN** hasta merge, aplicación y verificación productiva.

## 4. Fase 2 — Superficie de exposición

Fase 2 cierra la superficie que Fase 1 dejó verificada pero no acotada. Fase 1 probó que el aislamiento multitenant funciona; Fase 2 reduce lo que habría que atravesar si dejara de funcionar.

Estado verificado contra producción (`meqvjabgyrgwkxpclqxp`) al 2026-09-03: **36 tablas en `public`, todas con RLS habilitada, `anon` sin un solo grant en ninguna.** El punto de partida es bueno; lo que falta es que siga siéndolo sin depender de que alguien se acuerde.

### 2.1 · Leaked-password protection — PENDIENTE (dashboard)

El advisor de seguridad devuelve `auth_leaked_password_protection` en nivel WARN: "Leaked password protection is currently disabled". Supabase Auth puede contrastar contra HaveIBeenPwned en el alta y el cambio de contraseña.

**No es automatizable desde sesión.** Es un toggle de Authentication → Policies en el dashboard. Queda a cargo del responsable del proyecto.

Sin verificación posterior el ítem no se cierra: una vez activado, el advisor deja de emitir ese lint y eso es la evidencia.

### 2.2 · Reducir el grant de `public.regiones` a SELECT — HECHO

`authenticated` tiene sobre `public.regiones`: `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE`.

Es la **única** tabla de negocio con DML abierto a `authenticated`. La otra tabla con grants de escritura es `push_subscriptions`, que es legítima: el browser registra su propia suscripción push y `no-browser-business-writes.test.mjs` la exceptúa explícitamente por eso.

Hoy no es explotable en la práctica —la política `regiones_select_scope` sólo cubre `SELECT`, así que un `INSERT` de un cliente sería rechazado por RLS al no encontrar política permisiva de escritura— pero el grant sobra y la protección depende de una ausencia, no de una negativa. Cualquier política de escritura que alguien agregue después la vuelve explotable sin que el grant vuelva a discutirse.

**PR #148**, migración `20260903120000_regiones_solo_select_v1.sql`. Revoca `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` y `TRIGGER`, y deja `GRANT SELECT` explícito. No toca `service_role`, ni la política, ni datos.

La evidencia la da el gate de replay: el diff de la huella estructural es exactamente seis grants quitados sobre `public.regiones` y ninguno agregado. Contrato: `regiones-solo-select-contract.test.mjs`, verificado contra cuatro regresiones.

### 2.3 · Secret scanning en CI — HECHO

No existe. Verificado: ninguno de los cinco workflows (`ci.yml`, `deploy-smoke.yml`, `netlify-diagnostic.yml`, `regenerate-replay-expectation.yml`, `site-http-diagnostic.yml`) contiene un paso de escaneo de secretos.

El repositorio maneja `SUPABASE_SERVICE_ROLE_KEY`, claves de proveedor de inferencia y claves VAPID de web-push. El riesgo concreto no es el commit deliberado sino el archivo de diagnóstico pegado en un PR.

**PR #149.** gitleaks 8.30.1 con versión fija, `.gitleaks.toml` propio, corriendo **antes** de tests, lint y build. Escanea el árbol de trabajo, no el historial: escanear el historial completo en cada corrida marca lo mismo siempre hasta que nadie lee la salida.

Las reglas propias distinguen la `anon` key —pública por diseño— de la `service_role`. Marcar la anon generaría un hallazgo en cada build y enseñaría a ignorar la alerta.

**Detalle que sólo apareció al verificar:** la primera versión de la regla de `service_role` no disparaba. `service_role` viaja en base64 dentro del payload del JWT, y base64 codifica de a tres bytes, así que produce tres cadenas distintas según el offset; con un solo literal se escapaban dos de cada tres casos. Lo cazaba la regla genérica `jwt`, así que el escaneo "funcionaba" y la regla propia era decorativa. Ahora cubre las tres alineaciones y el contrato las exige por nombre.

### 2.4 · Aserción anti-`USING(true)` sobre todas las tablas de negocio — HECHO (subsumido en 2.5)

**Verificado hoy: cero políticas con `USING(true)` o `WITH CHECK(true)` en `public`.** Las trece políticas de `authenticated` pasan sin excepción por `noven_private.tiene_acceso_organizacion/zona/sucursal(...)` o por `auth.uid()`.

Es decir: **este ítem no arregla nada, preserva algo.** Ese es exactamente el motivo por el que va como test de CI y no como aserción dentro de una migración histórica. Una aserción en una migración se evalúa una vez, el día que se aplica, y después es texto muerto; el invariante que hay que sostener es "de acá en adelante ninguna política nueva es permisiva", y eso sólo lo sostiene algo que corra en cada PR.

### 2.5 · Clasificación explícita de tablas por exposición — HECHO

Un test que falle ante una tabla nueva sin clasificar. La clasificación que sale del relevamiento de producción tiene cinco clases:

| Clase | Qué la define | Tablas |
|---|---|---|
| `lectura_tenant` | `authenticated` con `SELECT` y política acotada por organización/zona/sucursal | `acciones_operativas`, `familias`, `intervenciones_rag`, `organizaciones`, `producto_codigos`, `producto_sucursal`, `productos`, `regiones`, `sectores`, `sucursales`, `vencimiento_observaciones`, `vencimientos`, `zonas` |
| `propia_del_usuario` | `authenticated` con `SELECT` acotado por `auth.uid()` | `usuarios`, `usuario_accesos`, `usuario_familias_sucursal` |
| `escritura_propia` | Único escritor legítimo desde el browser | `push_subscriptions` |
| `solo_servidor` | Sin grants a `authenticated`; se escribe por Netlify Function con `service_role` | `alertas_zonales`, `alertas_zonales_destinos`, `analisis_cache`, `importacion_0258_detalle`, `importaciones`, `invitaciones_acceso`, `problemas_economicos_ciclos`, `producto_costo_observaciones`, `producto_costo_ultima_observacion`, `producto_imagen_cambios`, `producto_pendiente_detecciones`, `producto_snapshots`, `productos_pendientes_catalogo`, `rag_escalamientos`, `rate_limit_consumo`, `usuario_familias` |
| `respaldo_historico` | Tablas de respaldo de agosto, sin rol en el circuito | `dedup_turrocklets_backup_20260805`, `productos_descripcion_backup_20260805`, `productos_familia_backup_20260806` |

**PR #150**, que implementa 2.4 y 2.5 juntos. La verificación corre en CI contra el Supabase descartable del replay, así que evalúa el resultado acumulado de todas las migraciones: un grant es un hecho del catálogo, leerlo del texto de las migraciones es adivinar.

**Se cubrieron también las vistas, que el ítem no contemplaba.** El primer diseño miraba sólo `relkind = 'r'`, y las vistas son la puerta trasera de RLS: por defecto se evalúan con los permisos de su dueño. Aparecieron dos cosas — diez vistas con DML completo para `authenticated` (mismo patrón que 2.2), y que `security_invoker = true` estaba correctamente puesto en las doce pero **nada lo verificaba**. Una vista nueva sin la opción habría expuesto todas las organizaciones sin que el gate de replay lo notara. La migración `20260903160000_exposicion_vistas_v1.sql` revoca los DML y deja `security_invoker` escrito.

El contrato prueba quince formas de exposición indebida sobre catálogos armados a mano, sin levantar Postgres.

**Este ítem subsume a 2.4**: si cada tabla declara su clase y el test verifica que sus grants y políticas reales coinciden con la clase declarada, entonces una política `USING(true)` sobre una tabla `lectura_tenant` falla por definición. Dos tests separados dirían dos veces lo mismo con una costura entre ellos.

Los veinticuatro lints `rls_enabled_no_policy` del advisor —dieciséis en `public`, siete en `desafio5s_archive`— **no son un defecto**: son tablas `solo_servidor` con RLS habilitada y sin grants, es decir, negación total para `authenticated`. La clasificación tiene que registrar eso como intencional, o el advisor va a seguir pareciendo una lista de pendientes que nadie atiende.

**Salvedad registrada:** el advisor marca `public.aceptar_invitacion_acceso_v1()` como `SECURITY DEFINER` ejecutable por `authenticated` vía REST. Se revisó el cuerpo de la función: **no es un defecto.** No toma argumentos, deriva la identidad de `auth.uid()`, cruza contra el email del propio `auth.users` y sólo activa filas de `usuario_accesos` de ese mismo `usuario_id`, con `SET search_path`. Es `SECURITY DEFINER` porque tiene que escribir en tablas que `authenticated` no puede tocar, que es el patrón correcto. Queda anotado para que no se re-investigue.

### 2.6 · Migrar `desafio5s_*` a su propio proyecto Supabase — PENDIENTE

El PR #124 (ítem 0.2) movió las nueve relaciones de Desafío 5S a `desafio5s_archive` dentro del **mismo** proyecto. Era el paso correcto y no es el destino: el archivo frío sigue compartiendo instancia, backups, cuota y superficie de Auth con NoVen.

La dependencia registrada en 0.2 es la que ata el nudo: `desafio5s_es_admin() → public.rol_actual() → public.usuarios`. Mientras exista, el archivo no es autónomo y no se puede mover sin romperlo o sin replicar usuarios.

**Alcance:** proyecto Supabase propio, migración de las nueve relaciones y del bucket `desafio5s-imagenes`, corte de la dependencia hacia `public.usuarios`, y baja de `desafio5s_archive` de este proyecto una vez verificado el destino.

**Es el ítem más grande de Fase 2 y el único con riesgo sobre datos.** No se hace en la misma tanda que los otros cinco.

## 5. Fase 3 — Capacidad multitenant real

Fase 2 acota la exposición de un despliegue de una sucursal. Fase 3 es lo que hace falta para que la segunda organización no sea un proyecto en sí misma.

Ninguno de estos ítems está empezado. Los cuatro tienen en común que hoy funcionan porque hay **una** organización con **una** sucursal con datos: son correctos por coincidencia, no por diseño.

### 3.1 · Procedimiento idempotente de alta de organizaciones — PENDIENTE

Hoy no existe procedimiento. La organización actual, sus 17 zonas y sus 183 sucursales entraron por migraciones y cargas puntuales.

**Alcance:** una función o script que reciba la definición de una organización y la deje creada —con zonas, sucursales, sectores y `dias_donacion`— y que **correrlo dos veces no produzca duplicados ni error**. La idempotencia no es elegancia: un alta que falla a la mitad tiene que poder reintentarse sin limpieza manual.

**Condición de cierre:** dar de alta una organización de prueba dos veces seguidas en un Supabase descartable y verificar que el segundo intento no cambia nada.

### 3.2 · Reparación de datos tenant-scoped — PENDIENTE

Reemplaza el patrón "una migración por SKU". Hoy, corregir un dato de un producto concreto genera un archivo en `supabase/migrations/`, y eso tiene tres costos que crecen: infla el replay, mezcla corrección de datos con evolución de esquema, y ata una corrección de la organización actual al historial que **toda** organización futura va a reproducir.

Ese último es el que importa. Una migración que arregla un SKU de la 091 se va a aplicar a la base de la organización siguiente, donde ese SKU no existe.

**Alcance:** un mecanismo de reparación acotado por tenant, fuera de la cadena de migraciones, con registro de quién reparó qué y cuándo, y sin capacidad de tocar filas fuera del tenant indicado.

### 3.3 · Benchmark de performance con volumen realista — PENDIENTE

**Antes de decidir cualquier índice.** Hoy hay 713 filas en `producto_sucursal` y 145 vencimientos, todas de la 091. Cualquier plan de consulta medido contra ese volumen es ruido: a esa escala Postgres elige secuencial y acierta.

Agregar índices "por las dudas" antes de medir es la forma habitual de pagar escritura para comprar una lectura que nadie hizo.

**Alcance:** generar volumen sintético representativo —varias organizaciones, decenas de sucursales, órdenes de magnitud más de vencimientos—, medir las consultas del dashboard, del análisis y del scanner, y **recién entonces** decidir índices, con el plan de ejecución como evidencia.

### 3.4 · Reemplazar el literal `091` por capacidad organizacional — PENDIENTE

`ai/decisions.md` registra la excepción transitoria `admin_organizacion + gerente_sucursal 091` con su condición de salida. Este ítem es esa salida.

**Alcance:** sustituir la referencia al código de sucursal por una capacidad declarada explícitamente en el modelo, de modo que el permiso se derive de lo que la organización habilita y no de una sucursal nombrada en el código.

**Condición de disparo:** se ejecuta cuando se cumpla la condición de salida ya registrada, no antes. Adelantarlo agregaría un mecanismo de capacidades sin un segundo caso que lo valide, que es cómo se diseñan abstracciones equivocadas.

## 6. Verificación del estado actual

Qué corre y qué prueba, al 2026-09-02:

- **`scripts/tests/`: 100 archivos `.test.mjs`.** Contratos en Node puro (`node:assert`), sin framework: leen el código fuente o transpilan un módulo TS y afirman invariantes. `scripts/test.mjs` los corre en procesos separados y devuelve exit≠0 si alguno falla. Veinte fueron creados por este plan: `admin-rate-limit-contract`, `august-backups-cold-archive-contract`, `auth-directory-scope-contract`, `ci-trigger-contract`, `clasificacion-exposicion-contract`, `corpus-evaluacion-contract`, `cuota-analisis-contract`, `desafio5s-cold-archive-contract`, `live-isolation-gates-contract`, `no-browser-business-writes`, `regenerate-workflow-contract`, `regiones-solo-select-contract`, `replay-log-extractor`, `secret-scanning-contract` y los cinco `migration-replay-*`.
- **`e2e/`: 2 specs, 14 tests** (12 en `critical-flows.spec.mjs`, 2 en `catalog-role-boundary.spec.mjs`), 3 fixtures. **Corren contra un Supabase interceptado por fixture** (`VITE_SUPABASE_URL=http://127.0.0.1:4173/__supabase`), no real: son tests de flujo de UI y **no ejercen RLS**. La verificación con backend real vive exclusivamente en `scripts/live-isolation/`.
- **`.github/workflows/ci.yml`: un único job `verify`,** en orden — `npm test` → `npm run lint` → `npm run build` → replay de Baseline V1 con fingerprint estructural → export de credenciales efímeras → Gates 1–3 de aislamiento → cuota por actor bajo concurrencia → Playwright/Chromium → parada del Supabase efímero (`if: always()`). Triggers: push a `master` y pull request contra `master`. El trigger dedicado de la rama histórica `feat/multitenant-architecture-v1`, ya fusionada, fue retirado en E1 y quedó cubierto por `ci-trigger-contract.test.mjs`.
- **`.github/workflows/regenerate-replay-expectation.yml`:** manual, para regenerar la expectativa móvil sin tener el entorno; opcionalmente emite el respaldo verificable en logs, apagado por defecto. Ver 1.4E–1.4F.

Estado de producción al mismo corte (`meqvjabgyrgwkxpclqxp`, Postgres 17.6, `sa-east-1`):

- 1 organización, 17 zonas, 183 sucursales cargadas y activas — **datos operativos únicamente en la 091**: 713 filas de `producto_sucursal` y 145 vencimientos, todas de 091;
- 713 productos de catálogo, 3 importaciones;
- 3 usuarios y 4 accesos activos;
- ledger de migraciones: 143 versiones aplicadas, última `20260902211635` (`cuota_por_actor_y_cache_analisis_v1`); el archivo equivalente en Git usa `20260902170000`. La brecha histórica y este desfase conocido están inventariados en `history-manifest.json`;
- `authenticated` tiene sólo `SELECT` sobre `productos`, `vencimientos` y `producto_sucursal`; **0** policies de `SELECT USING(true)` en `public`;
- advisors de seguridad: sin ERROR; 22 INFO `rls_enabled_no_policy` (7 del schema archivado, correcto por diseño; 15 de tablas NoVen deliberadamente server-only); 3 WARN — `pg_net` en `public`, protección de contraseñas filtradas desactivada, y `aceptar_invitacion_acceso_v1()` ejecutable por `authenticated` como `SECURITY DEFINER` (intencional: es el canje de invitación).

## 7. Deuda conocida

Limitaciones aceptadas conscientemente. No son invariantes: son cosas que hay que resolver cuando el contexto lo permita.

**D-1 · Endpoints autenticados sin cuota por actor.** El plan básico de Netlify admite dos reglas `rateLimit` declaradas en código, y ambas están consumidas por `/api/admin/read/*` y `/api/admin/write/*`. Además `config.rateLimit` sólo existe en el runtime v2 y 14 de las 16 funciones son handlers v1: el techo real no es "dos reglas" sino "dos reglas y migrar cada función a v2". Y la agregación es por IP, que en una sucursal detrás de NAT castiga al operador legítimo sin frenar al abusivo.

`analisis.ts` era el caso más expuesto —el único donde un usuario autenticado podía generar costo ilimitado en un tercero y enviarle datos operativos— y **quedó cubierto** con cuota por actor en Postgres y caché server-side. Ver 1.2.

Lo que queda de esta deuda son los siete endpoints autenticados que no tienen ningún límite, enumerados en 1.2. Ninguno gasta dinero en terceros, pero varios hacen trabajo pesado en Postgres.

`scripts/tests/admin-rate-limit-contract.test.mjs` **no congela la cantidad de reglas**: verifica que las dos conocidas sigan declaradas y que toda regla declarada esté completa. Una tercera regla legítima pasa el contrato. Congelar el número convertía el techo del proveedor en un test que rompía cualquier intento de proteger otra función, escondiendo esta deuda en lugar de señalarla.

**D-2 · Dependencia viva del schema archivado.** `desafio5s_es_admin()` consulta `public.rol_actual()` y por esa vía `public.usuarios` de NoVen. Se conserva a propósito para permitir restauración en el proyecto actual, pero significa que un refactor de `rol_actual()` o de `usuarios` rompe silenciosamente un módulo que nadie está mirando. Condición de salida en `ai/decisions.md`.

**D-3 · Concentración de privilegios.** La única cuenta administradora combina `admin_organizacion` con `gerente_sucursal` de 091. Documentada como transitoria, con condición de salida — que se dispara justo en el momento de mayor carga: incorporar una organización o delegar la administración jerárquica.

**D-4 · Superficie de tenancy 60× mayor que la operada.** 183 sucursales activas contra 1 con datos. El aislamiento está probado sobre entidades sintéticas; el primer usuario de una segunda sucursal real será la primera vez que se ejerza sobre datos productivos.

**D-5 · Fixtures con fechas absolutas.** Ver el ítem fuera de numeración de §3.

**D-6 · Datos operativos hacia un proveedor sin decisión registrada.** Ver 1.5. La cuota y el caché de 1.2 reducen el volumen que sale —cada acierto de caché es una llamada que no ocurre— pero no cambian la jurisdicción.

**D-7 · Extracción de la baseline sin scriptar.** Re-materializar el ancla de producción requiere extraer a mano los 39 fragmentos desde el catálogo productivo. Es el único paso manual del mecanismo de reproducibilidad y, a la vez, el único que mantiene vivo el ancla. Ver `docs/MIGRATION_REPLAY_BASELINE_V1.md` §14.4.

## 8. Fuera del alcance de las sesiones automatizadas

Requieren intervención manual del responsable:

- verificar y completar las reglas de protección de `master` en la UI de GitHub (ver 0.1);
- activar leaked-password protection en Supabase Auth (ítem 2.1);
- mover la extensión `pg_net` fuera del schema `public`;
- cargar `OPENAI_API_KEY` en Netlify y en los secretos de GitHub Actions: sin esa credencial el corpus de evaluación no puede correrse contra el proveedor y el ítem 1.5 no cierra;
- reconstruir la línea de base de merma, que no es derivable de los datos cargados;
- decidir el estado de las 182 sucursales cargadas sin datos operativos;
- la prueba operativa corta en 091 que `docs/PRODUCTION_CUTOVER_STATUS_20260827.md` define como paso previo a incorporar una segunda sucursal real (Dashboard, Scanner, cierre vendido, Historial, importación por familia y masiva, Admin).

## 9. Mantenimiento de este documento

Cada PR de endurecimiento que cambie el estado de un ítem debe actualizar su veredicto acá, en el mismo PR. Un ítem que pasa de PARCIAL a HECHO sin que este archivo lo refleje reintroduce exactamente el problema que motivó §0.
