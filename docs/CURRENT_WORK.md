# NoVen · Estado de trabajo y continuidad

**Documento vivo y público.** Es el checkpoint para que Claude Code, Codex u
otro agente continúen desde el estado real del repositorio sin depender de un
chat privado.

**Regla operativa obligatoria:** cada cambio de estado, hallazgo, prueba y
pendiente nuevo, modificado o cerrado se registra acá **dentro de la misma rama
que lo produce**, antes del relevo o de abrir/actualizar el PR. Un pendiente no
se borra: se marca cerrado con su evidencia.

Este archivo conserva sólo información apta para un repositorio público. No
incluye credenciales, datos operativos, conteos productivos ni detalles de
seguridad explotables. Cuando una comprobación requiera ese material, se
registra el resultado mínimo y se enlaza el PR, CI o documento autorizado que
contiene la evidencia.

Fecha de corte: **2026-09-09**.

## Lectura obligatoria antes de continuar

1. Actualizar `origin/master` y comprobar que el SHA no cambió.
2. Leer este archivo, `PRODUCT_VISION.md` y el contrato enlazado para el bloque
   activo.
3. Revisar la rama, su diff, el PR y el CI; una rama remota por sí sola no
   demuestra trabajo activo.
4. Continuar desde “Próximo paso ejecutable”, no reconstruir el plan desde cero.
5. Actualizar este archivo en la misma rama antes de transmitir el trabajo.

## Fuentes de verdad

| Pregunta | Fuente |
|---|---|
| Producto y límites | `PRODUCT_VISION.md` |
| Trabajo activo y siguiente paso | este archivo |
| Circuito RAG centralizado | `docs/CIRCUITO_RAG_CENTRALIZADO_V1.md` |
| Hardening y deuda técnica | `docs/PRE_PRODUCTION_HARDENING_PLAN.md` |
| Decisiones técnicas | `ai/decisions.md` |
| Interfaces y contratos | `ai/contracts.md` |

## Corte Git verificado

- Base revisada: `origin/master` en `f0fd20f`, squash merge del PR #179.
- CI final del PR #179: run `34343884360`, completo en verde.
- El conector disponible no enumera runs disparados por push a `master`; la
  validación local y el CI de la nueva rama siguen siendo obligatorios.
- Rama activa: `feat/rag-centralizado-bandeja-zonal`.
- Propietario de la rama: Codex hasta merge o relevo explícito.
- Alcance de la rama: bloque 3 del circuito RAG centralizado —alta de la
  administración zonal de precios, bandeja estrictamente zonal y ejecución
  individual— sin confirmación en góndola, operación por lote ni aplicación de
  SQL en producción.
- Publicación: corte funcional `a0688ae` y checkpoint `f59cff5` publicados; PR
  draft #180 abierto contra `master`. El replay descartable terminó en verde en
  el run `34376604368`; su expectativa revisada está incorporada localmente y
  queda pendiente publicarla y exigir el CI completo resultante.

Siempre volver a consultar el remoto: estos SHA son evidencia del corte, no una
base permanente.

## Estado del producto

### Cerrado

| Bloque | Evidencia |
|---|---|
| Salidas de stock que no son venta | PR #164 |
| Escalón cero implícito | PR #166 |
| A · tramo y tipo de intervención | PR #167 |
| Contrato del circuito centralizado | PR #168 |
| B · medición por tramo | PR #169 |
| C1 · convivencia RAG/oferta central | PR #171 |
| C2A · operaciones explícitas por tipo | PR #173 |
| C2B · interfaz operativa | PR #175; cierre documental #176 |
| RAG centralizado · modelo y permisos | PR #178 |
| RAG centralizado · validación y seguimiento en sucursal | PR #179 |

### En ejecución

**Circuito de validación y ejecución centralizada de RAG.** A, B, C y los
bloques 1 y 2 ya están cerrados. El bloque 3 está en ejecución en
`feat/rag-centralizado-bandeja-zonal`.

Orden acordado:

1. modelo de solicitud, máquina de estados y permisos;
2. validación gerencial y seguimiento desde la sucursal;
3. bandeja zonal y ejecución individual;
4. confirmación o rechazo en góndola por gerente, supervisor u operador
   asignado a la familia, iniciando el tramo sólo al confirmar;
5. exportación, impresión y operación por lote.

### Decisión de evidencia · 2026-09-08

La evidencia no se inventa: se construye con la operación real dentro del
circuito. La muestra de veinte a treinta sugerencias aceptadas y medidas **no**
bloquea la coordinación ni la trazabilidad.

Hasta reunir esa muestra:

- el porcentaje proviene sólo del motor determinístico vigente;
- el histórico no modifica recomendaciones;
- no se afirma efectividad histórica ni se recalibran umbrales;
- la UI distingue evidencia insuficiente de una intervención medida e
  inefectiva.

## Estado del hardening

Resumen reconciliado; el detalle y las condiciones de salida permanecen en
`docs/PRE_PRODUCTION_HARDENING_PLAN.md`.

- Fase 0: cerrada.
- Fase 1: 1.1, 1.3, 1.4 y 1.5 cerrados; 1.2 parcial.
- Fase 2: 2.2 a 2.5 cerrados; 2.1 pendiente y 2.6 diferido.
- Fase 3: 3.3 cerrado; 3.1, 3.2, 3.4 y 3.5 pendientes.
- Deudas D-8 y D-9: pendientes; no forman parte del primer bloque del circuito.

## PR que no deben confundirse con trabajo activo

- PR #160: cerrado sin merge como reemplazado por #177; conserva su historial
  documental y no es trabajo activo.
- PR #118: diseño del Agente 2, permanece en draft. No implementar hasta contar
  con su muestra operativa y la decisión económica indicadas en ese PR.

## Pruebas

Última base validada, PR #177:

- `npm test`: 115/115 archivos en verde.
- `npm run lint`: cero errores; permanece un warning preexistente en
  `ScannerModal.tsx:143`.
- `npm run build`: verde.
- `git diff --check`: verde.
- Playwright local no se ejecutó porque `npm ci` no instala directamente el
  runner; `AGENTS.md` ahora remite a la preparación exacta usada por CI. El
  Playwright del PR #177 terminó en verde.
- CI del PR #177: contratos, lint, build, replay, aislamiento, cuota, exposición
  y Playwright completos en verde en los runs `34281365574` y `34281819683`.

Último bloque cerrado:

- contrato específico del bloque 2: verde;
- prueba de mutación: verde; al retirar temporalmente el bloqueo que serializa
  solicitudes, el contrato falló por la causa esperada y el código fue
  restaurado antes de repetirlo en verde;
- contratos UX, allowlist RPC y frontera de seguridad: verdes;
- `npm run build`: verde;
- `npm run lint`: cero errores y el warning preexistente de `ScannerModal.tsx`;
- `npm test`: 117 de 117 archivos verdes después de incorporar la expectativa
  regenerada;
- `git diff --check`: verde;
- replay SQL descartable del bloque 2: verde en el run `34338998266`, ejecutado
  sobre `e542ca3`; artefacto `10098969631` revisado antes de incorporar.
- diff estructural del replay: agrega dos funciones, elimina cero objetos y
  cambia sólo la RPC de control prevista. También retira del browser los dos
  permisos de instrumentación anterior y agrega los cuatro permisos acotados de
  la nueva RPC. El fingerprint del ancla permaneció intacto.
- intento de replay `34338010251`: falló porque el workflow se lanzó sobre
  `master` y no sobre la rama del PR #179. Regeneró sin la migración nueva y el
  gate rechazó el resultado; no hay expectativa válida para incorporar.
- CI previos del PR #179 fallaron por el gate esperado de expectativa móvil. Se
  reemplazaron como evidencia del replay por el run posterior `34339575079`.
- CI `34339575079`: replay, contratos, lint, build, aislamiento, cuota,
  clasificación de exposición y preparación de Playwright quedaron verdes. El
  único fallo fue un E2E que todavía buscaba el porcentaje editable retirado por
  este bloque e intentaba enviarlo dentro de la RPC de control.
- El E2E fue actualizado para pulsar `Informar 30%`, comprobar una única llamada
  a `solicitar_cambio_rag(p_vencimiento_id)` y comprobar que esa acción no llama
  a `registrar_control_vencimiento_dashboard` ni escribe tablas directamente.
  El fixture y el contrato estático cubren la nueva ruta.
- Verificación local posterior al ajuste E2E: contrato específico y suite
  completa 117/117 en verde; build y diff-check verdes; lint con cero errores y
  el warning preexistente de `ScannerModal.tsx:143`.
- CI final del corte funcional `43404eb`: run `34340514382` completo en verde,
  incluido el recorrido Playwright corregido y todos los gates de replay,
  aislamiento, cuota y exposición.
- CI del checkpoint `b71e6bd`: run `34340919978` completo en verde con los
  mismos gates. El PR #179 dejó de ser draft después de este resultado.
- CI del checkpoint final `653ee6a`: run `34341380605` completo en verde,
  incluido Playwright.
- CI del cierre documental `7f54943`: run `34341800649` completo en verde.
- CI del contrato zonal `41c3730`: run `34342774425` completo en verde.
- Alcance zonal ratificado: `administrativa_precios_zonal` requiere organización
  y una zona concreta —por ejemplo, `Santa Cruz Sur`—, nunca alcance global ni
  sucursal directa. El modelo, las FK, RLS y transiciones ya lo exigen. La UI y
  API actuales de Accesos y jerarquía todavía no permiten dar de alta este rol;
  esa habilitación es condición de entrada del bloque 3.
- La presencia previa de un gerente zonal no es condición para crear la
  administrativa. Si falta, Accesos y jerarquía debe ofrecer invitarlo o
  continuar; queda una advertencia o pendiente de cobertura, nunca un bloqueo.

Rama activa, bloque 3:

- Alta de `administrativa_precios_zonal` implementada en Accesos y jerarquía,
  Function e invitaciones. Organización y zona son obligatorias; sucursal y
  familias están prohibidas. La cobertura activa o pendiente de gerencia y
  precios se muestra por zona.
- Si falta gerente zonal, la interfaz ofrece invitarlo o continuar. El servidor
  no consulta ni exige esa cobertura para registrar o activar a la
  administrativa.
- `/rag/zona` implementa la bandeja de propósito único. La cuenta pura no recibe
  Dashboard, selector de sucursal, Scanner, vencimientos, análisis, problemas,
  importación, administración local ni la invitación a push operativo.
- La bandeja lista sólo solicitudes de zonas activas de la cuenta y conserva los
  ejecutados durante veinticuatro horas. La ejecución es individual, bloquea la
  solicitud, revalida organización y zona y es idempotente.
- Ejecutar agrega el evento con habilitación para el día operativo argentino
  siguiente. No abre una intervención ni expone confirmación en góndola,
  exportación, impresión u operación por lote.
- Se amplió el gate vivo sobre Supabase efímero con dos administrativas de zonas
  distintas: debe probar aislamiento, rechazo entre zonas, ausencia de DML
  directo, idempotencia y ausencia de intervención.
- Verificación local: contrato específico y contrato de aislamiento verdes;
  prueba de mutación verde al debilitar temporalmente la igualdad de zona y
  restaurarla; build y `git diff --check` verdes; lint sin errores y con el
  warning preexistente de `ScannerModal.tsx:143`.
- Los CI iniciales `34370271789` y `34370439782` fallaron únicamente en la suite
  por el gate deliberado de expectativa móvil todavía desactualizada.
- Replay descartable verde en el run `34376604368`, sobre `f59cff5`. El
  artefacto `10114175577` coincidió con el digest SHA-256 publicado y contenía
  exactamente las dos expectativas permitidas; el ancla permaneció intacta.
- El diff estructural agregó las dos implementaciones y los dos wrappers del
  bloque, modificó sólo las dos restricciones y las cinco funciones de
  invitaciones/contexto previstas, y agregó únicamente sus permisos de
  ejecución para roles autenticados de servidor y aplicación. No eliminó
  objetos ni cambió tablas, columnas, vistas, RLS, políticas, índices o
  triggers.
- Se incorporaron exclusivamente `expected-replay-fingerprint.json` y
  `replay-expectation.json` dentro de `baseline-v1`.
- Verificación local posterior: `npm test` 118/118, build y `git diff --check`
  verdes; lint sin errores y con el warning preexistente de
  `ScannerModal.tsx:143`.
- Los dos recorridos Playwright nuevos tienen sintaxis validada, pero no se
  ejecutaron localmente porque el runner aislado sólo se instala en CI.
- Hallazgo corregido: la hora de ejecución se toma después de adquirir el lock,
  para que una espera concurrente no cree un evento anterior al ya confirmado.
- Hallazgo descartado: una salida truncada pareció mostrar un cierre SQL
  duplicado; la inspección numerada del archivo verificó que no existía.
- La CLI de Supabase no está instalada en este entorno y el intento de obtenerla
  por `npx` no fue autorizado. La migración usa un nombre fechado generado en
  UTC; no se consultó ni modificó ninguna base.

## Próximo paso ejecutable

1. Publicar las dos expectativas revisadas y este checkpoint en
   `feat/rag-centralizado-bandeja-zonal`.
2. Exigir suite completa, cuarto gate vivo, exposición y Playwright verdes antes
   de sacar el PR #180 de draft. No aplicar SQL en producción ni mergear sin
   autorización explícita.

## Protocolo de relevo

- Una sola persona o agente edita una rama o migración por vez.
- No hacer cambios directos en `master`.
- No editar migraciones aplicadas, el ledger ni la baseline productiva.
- El relevo ocurre después de commit y push. El entrante verifica este archivo,
  el diff, el PR y el CI.
- Si cambia el alcance, falla una prueba o aparece un bloqueo, registrarlo acá
  antes de continuar.

## Registro de esta rama

### 2026-09-08 · Codex

- Formalizó la regla de continuidad dentro de la misma rama.
- Reconcilió el plan de hardening con los PR ya cerrados y corrigió dos estados
  documentales obsoletos: la deuda de C2 y el proveedor del análisis.
- Registró la autorización para construir el circuito y el nuevo papel de la
  muestra operativa.
- Detectó que el comando Playwright documentado no era autocontenido después de
  `npm ci`; corrigió la instrucción y dejó el CI como gate obligatorio.
- La primera publicación fue detenida por contener un nivel de detalle
  inadecuado para un remoto público. El responsable eligió expresamente la
  versión reducida; se retiraron datos operativos y hallazgos sensibles sin
  eliminar estados, pruebas, decisiones ni próximos pasos.
- La validación local quedó verde según “Pruebas de la rama activa”.
- Publicó la rama reducida mediante la conexión autorizada de GitHub y abrió el
  PR #177 contra `master`. El cliente Git local no tenía credenciales; no se
  cambió la configuración ni se intentó eludir la autenticación.
- El CI completo del PR #177 terminó verde en el run `34281365574`, incluidos
  replay, pruebas de aislamiento y Playwright. Queda habilitado el merge.

### 2026-09-09 · Codex

- PR #177 mergeado por squash en `master` como `63fea6d`; su segundo CI completo
  también terminó verde en el run `34281819683`.
- PR #160 cerrado sin merge y comentado como reemplazado por #177; PR #118
  permanece intacto en draft.
- Creó `feat/rag-centralizado-modelo-estados` desde `63fea6d` y asumió su
  propiedad para el bloque 1. No ejecutó SQL ni escrituras productivas.
- Consultó la documentación vigente de Supabase antes de diseñar el esquema; el
  acceso directo al índice liviano del changelog no devolvió contenido en este
  entorno, por lo que cualquier supuesto de plataforma debe quedar cubierto por
  contratos y el replay local.
- Verificó `supabase` CLI 2.117.0 y la ayuda vigente de `migration new`. El
  intento de consultar el estado local no completó porque la aprobación de red
  del ejecutor fue cancelada; no se consultó ni modificó una base.
- Cerró el mapa del bloque 1: el nuevo rol queda fuera de todos los helpers de
  scanner, operación local, catálogo, análisis y Radar; sólo obtiene lectura del
  circuito por un helper dedicado a organización y zona.
- Definió la solicitud como snapshot inmutable de la sugerencia y sus insumos,
  separada de `intervenciones_rag`. La intervención conserva una FK nullable y
  única que sólo se completará al confirmar en góndola.
- Definió la máquina append-only: `solicitada → ejecutada → confirmada` o
  `solicitada → ejecutada → no_aplicada → ejecutada…`. La disponibilidad del
  día siguiente se deriva en `v_solicitudes_cambio_rag_actual`; no se persiste
  como un evento ficticio.
- El comando `supabase migration new` alcanzó a crear el archivo fechado antes
  de que el ejecutor cancelara su acceso de red. Se pobló ese archivo y se
  descartaron los archivos vacíos de intentos posteriores; ninguna base fue
  consultada ni modificada.
- Agregó RLS y sólo `SELECT` para `authenticated`, revocó DML directo y protegió
  solicitudes/eventos contra `UPDATE` y `DELETE`. Las transiciones validan rol,
  alcance, orden temporal y habilitación en la fecha operativa argentina.
- Actualizó `ai/contracts.md`, el tipo compartido de roles, la clasificación de
  exposición y un contrato específico. No expuso todavía el alta del nuevo rol
  en la UI: hacerlo antes de su bandeja propia dejaría una cuenta sin superficie
  válida y contradiría la separación del Dashboard operativo.
- Verificación local del corte: contrato específico, build y diff-check verdes;
  lint sin errores; suite con 115/116 archivos verdes. El único fallo es el gate
  deliberado que exige regenerar la expectativa del replay por la nueva
  migración. Docker/Postgres local no están disponibles, por lo que el replay
  descartable queda como próximo gate remoto.
- Publicó el primer corte de la rama como `d62cd83` y Fernando ejecutó el
  workflow manual de regeneración exclusivamente sobre esa rama.
- El replay descartable terminó en verde en el run `34303953570`. Su diff
  estructural agregó sólo la superficie prevista del bloque: dos tablas, una
  vista, sus funciones, triggers, RLS, políticas, índices y restricciones; no
  eliminó tablas, vistas, funciones, políticas ni columnas existentes.
- Incorporó exclusivamente `expected-replay-fingerprint.json` y
  `replay-expectation.json` desde el artefacto `10085981195`; el fingerprint del
  ancla permaneció intacto.
- Verificación posterior al replay: `npm test` 116/116, build y diff-check
  verdes; lint sin errores y con el warning preexistente de `ScannerModal.tsx`.
- Publicó la expectativa y el checkpoint como `bf48afc` y abrió el PR #178
  contra `master`. El CI completo quedó como gate activo en ese corte; no se
  aplicó SQL en producción.
- El CI completo del PR #178 terminó en verde en el run `34304501281`, incluidos
  replay estructural, aislamiento multitenant, cuota, exposición y Playwright.
  El bloque 1 queda listo para revisión y decisión de merge; no se mergeó ni se
  aplicó SQL en producción.
- Fernando ratificó que la validación en góndola también corresponde al operador
  asignado a la familia del producto. El permiso ya estaba implementado en la
  migración del bloque 1 y ahora queda explícito en el contrato para la interfaz
  del bloque 4.
- El CI final del PR #178 terminó en verde en el run `34305619467`; el PR fue
  mergeado por squash en `master` como `5a92df3`.
- Creó `feat/rag-centralizado-validacion-sucursal` desde ese merge e inició el
  bloque 2. El alcance excluye bandeja zonal, ejecución administrativa,
  confirmación en góndola y cualquier escritura productiva.
- Implementó `solicitar_cambio_rag(p_vencimiento_id)`: la RPC recibe sólo la
  identidad del vencimiento, resuelve permiso y alcance en servidor, recalcula
  el siguiente escalón, crea el snapshot y su evento inicial de forma atómica e
  idempotente, sin abrir una intervención.
- Cerró el atajo anterior: registrar un control ya no admite un porcentaje RAG
  y la instrumentación separada dejó de ser una RPC del navegador. La evidencia
  nace con la operación que crea la solicitud.
- Reemplazó el porcentaje editable por `Informar NN%` para gerente/supervisor y
  `Requiere gerente o supervisor` para operador. La tarjeta muestra pendiente
  de ejecución, ejecutada sin habilitar, lista para verificar, confirmada o no
  aplicada; solicitar nunca se presenta como cambio de precio.
- Agregó la bandeja de validación del gerente dentro del Dashboard existente.
  Reúne sugerencias y solicitudes de la sucursal y ordena primero por urgencia y
  después por dinero en riesgo, sin inventar un score compuesto.
- Conservó el contrato del bloque 4: la verificación futura en góndola podrá
  hacerla gerente, supervisor u operador asignado a la familia. Este bloque sólo
  muestra el estado; todavía no expone las acciones de confirmación/rechazo.
- Añadió contratos del bloque y actualizó allowlist y frontera browser. La
  prueba de mutación retiró temporalmente la serialización, comprobó el fallo
  esperado y restauró el código; contrato, build, lint y diff-check quedaron
  verdes.
- La suite completa quedó en 116/117: sólo falla la expectativa móvil porque la
  nueva migración aún no pasó por el replay descartable. No se consultó ni
  modificó producción.
- Creó el commit local `48c1e39` y publicó el mismo árbol mediante la conexión
  autorizada de GitHub como `90d2736`. El cliente Git local continúa sin
  credenciales; no se alteró su configuración.
- Publicó el checkpoint como `e23a3dd` y abrió el PR draft #179 contra `master`.
  El draft conserva como gate explícito el replay descartable; todavía no está
  habilitado para merge.
- Fernando ejecutó el workflow manual, pero GitHub usó `master`; el run
  `34338010251` terminó fallando en el gate que limita el cambio a la expectativa
  móvil. No se incorporó su artefacto. Queda pendiente repetirlo sobre
  `feat/rag-centralizado-validacion-sucursal`.
- El replay repetido sobre la rama correcta terminó en verde en el run
  `34338998266`. El artefacto `10098969631` coincidió con su digest publicado y
  mantuvo intacto el ancla.
- Revisó el fingerprint completo: dos funciones nuevas, cero objetos eliminados
  y un único cambio de definición previsto en la RPC de control; los permisos
  browser reflejan el reemplazo de la instrumentación anterior por la solicitud
  acotada.
- Incorporó exclusivamente `expected-replay-fingerprint.json` y
  `replay-expectation.json`. La verificación posterior quedó en 117/117 pruebas,
  build y diff-check verdes; lint sin errores y con el warning preexistente de
  `ScannerModal.tsx`.
- El primer CI del PR #179, run `34337224074`, terminó fallido por la expectativa
  móvil desactualizada ya identificada localmente. No se interpreta como un
  defecto funcional: exige ejecutar y revisar el replay descartable antes de
  continuar.
- Publicó la expectativa revisada del replay en el corte remoto `97cd37a`. El CI
  resultante, run `34339575079`, dejó verdes todos los gates de base de datos,
  seguridad, contratos, build y lint; sólo falló el Playwright que conservaba la
  interacción anterior con un porcentaje editable.
- Actualizó ese recorrido para representar la operación vigente: gerencia
  informa la sugerencia mediante `solicitar_cambio_rag`, sin reutilizar la RPC
  de control ni efectuar escrituras directas. Contrato específico, 117/117
  pruebas, build y diff-check quedaron verdes; lint quedó sin errores y con su
  warning preexistente.
- Publicó el ajuste E2E como `43404eb`. El run `34340514382` terminó completo en
  verde, incluido Playwright; el defecto era exclusivamente la expectativa
  obsoleta del test y no la nueva operación de solicitud.
- Publicó el checkpoint `b71e6bd`; su run `34340919978` también terminó completo
  en verde. Sacó el PR #179 de draft y actualizó su descripción para retirar el
  replay ya resuelto. El PR está listo para revisión, sin merge ni SQL aplicado
  en producción.
- Publicó el estado final como `653ee6a`; el run `34341380605` terminó completo
  en verde. El único pendiente del bloque es la decisión explícita de merge.
- El cierre documental `7f54943` quedó verde en el run `34341800649`.
- Fernando precisó que la administración zonal de precios está atada a una zona
  concreta, como `Santa Cruz Sur`. Verificó que la capa de datos ya fuerza ese
  alcance y registró para el bloque 3 el pendiente real: habilitar el alta del
  rol en Accesos y jerarquía y mantener su bandeja estrictamente zonal.
- El contrato zonal publicado como `41c3730` quedó verde en el run
  `34342774425`. Fernando corrigió una condición de UX: el sistema debe pedir la
  cobertura del gerente zonal, pero permitir continuar sin ella al crear la
  administrativa; se registró como aviso pendiente y no como dependencia dura.
- Publicó esa corrección como `f44404b`; el run `34343884360` terminó completo
  en verde. El PR #179 fue mergeado por squash en `master` como `f0fd20f`.
- Creó `feat/rag-centralizado-bandeja-zonal` desde ese merge e inició el bloque
  3. La rama excluye confirmación en góndola, exportación, impresión, ejecución
  por lote y cualquier escritura en producción.
- Implementó el alta zonal no bloqueante, la bandeja exclusiva y la ejecución
  individual del bloque 3. Añadió contratos, mutación, recorridos Playwright y
  un cuarto gate vivo sobre Supabase descartable. El corte local queda listo
  para publicar; el replay y su expectativa continúan pendientes.
- Publicó el corte funcional reducido como `a0688ae` y abrió el PR draft #180.
  El run inicial `34370271789` quedó en cola; el PR permanece bloqueado hasta
  ejecutar y revisar el replay descartable sobre la rama correcta.
- El checkpoint `f59cff5` generó el CI `34370439782`; tanto ese run como el
  inicial fallaron sólo en el gate previsto de expectativa móvil.
- Fernando ejecutó el replay sobre la rama correcta. El run `34376604368`
  terminó en verde sobre `f59cff5`; todos sus pasos de regeneración, protección
  del ancla, limitación del diff y suite completa pasaron.
- Verificó byte a byte el digest del artefacto `10114175577` y comprobó que
  contiene exclusivamente las dos expectativas móviles. La revisión por clave
  confirmó cuatro funciones nuevas, los cambios esperados de invitaciones y
  contexto, permisos acotados y cero objetos eliminados o cambios fuera del
  alcance.
- Incorporó sólo esos dos archivos. La validación local posterior quedó en
  118/118 pruebas, build y diff-check verdes; lint sin errores y con el warning
  preexistente de `ScannerModal.tsx:143`. Queda pendiente publicar este corte y
  exigir todos los gates del nuevo CI antes de habilitar revisión.
