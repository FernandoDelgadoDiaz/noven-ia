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

Fecha de corte: **2026-09-12**.

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

### Hotfix activo · redirección de invitaciones

- Base revisada: `origin/master` en `248d1e8`, cierre documental del PR #186.
- Rama activa: `fix/invitaciones-redirect-produccion`.
- Hallazgo reproducido desde una invitación real: el enlace de activación fue
  emitido con destino `localhost`, por lo que no puede completarse desde el
  dispositivo de la persona invitada. No se registra el token ni el enlace.
- Alcance: fijar el destino público de activación en las tres rutas de
  invitaciones, rechazar antes de entregar cualquier link que Supabase devuelva
  con otro destino y limpiar la cuenta Auth parcial en ese fallo.
- Implementación local: las altas jerárquicas, locales y la regeneración usan
  un único destino canónico. El servidor valida el `redirect_to` contenido en
  cada link generado; ante desvío no lo devuelve y compensa la cuenta Auth.
- Configuración externa pendiente de comprobar en Supabase Auth: `Site URL` y
  la lista exacta de redirecciones deben admitir el sitio público y
  `/activar`. Este ajuste de control no requiere ni autoriza SQL productivo.
- Pruebas locales sobre `248d1e8`: contrato específico verde; suite completa
  123/123, build y `git diff --check` verdes; lint sin errores y con el warning preexistente de
  `ScannerModal.tsx:143`.
- La invitación afectada debe regenerarse después de desplegar el hotfix; el
  enlace anterior no debe reutilizarse.
- Mientras se preparaba el arreglo se detectó que `master` había avanzado desde
  `33a8c5e`; el hotfix se reconcilió con la base actual en vez de forzar el PR
  obsoleto. El bloque 3B, la constatación inicial y sus cierres documentales ya
  están incorporados en `master` y no se reabren ni se sobrescriben.
- El conector disponible no enumera runs disparados por push a `master`; la
  validación local y el CI de esta rama siguen siendo obligatorios.

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
| RAG centralizado · 3A bandeja y ejecución zonal | PR #180 |

### En ejecución

**Circuito de validación y ejecución centralizada de RAG.** A, B, C y los
bloques 1, 2 y 3A ya están cerrados. En ejecución está el bloque 3B en
`feat/rag-centralizado-jornada-zonal`; se considera cerrado sólo después del
merge explícitamente autorizado.

Orden acordado:

1. modelo de solicitud, máquina de estados y permisos — cerrado;
2. validación gerencial y seguimiento desde la sucursal — cerrado;
3. bandeja zonal:
   - **3A:** base y ejecución individual — cerrado;
   - **3B:** jornada configurable, corte de visibilidad y exportación Excel por
     sucursal o por toda la zona — en ejecución;
4. confirmación o rechazo en góndola por gerente, supervisor u operador
   asignado a la familia, iniciando el tramo sólo al confirmar;
5. impresión y operación por lote restante.

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

**Riesgo asumido, registrado el 2026-09-10.** El circuito se está construyendo
sobre una recomendación que todavía no se validó en producción. Es una decisión
consciente del responsable del producto, no un supuesto implícito. Qué se asume,
qué pasa si la evidencia no acompaña y qué habría que revisar entonces quedó
escrito en `docs/PRE_PRODUCTION_HARDENING_PLAN.md`, en la entrada del circuito.

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
- El CI `34377626774` pasó replay, suite, lint y build, y falló al iniciar el
  gate vivo: el fixture zonal ya sembraba un vencimiento activo y el Gate 1
  intentaba crear un segundo vencimiento activo para el mismo producto y
  sucursal. Cuota, exposición y Playwright no llegaron a ejecutarse.
- Se corrigió el fixture para reutilizar ese vencimiento en la escritura válida
  del operador, conservando tanto la unicidad como la prueba real de permiso. El
  contrato del gate exige ahora explícitamente esa reutilización. Contrato
  específico, suite 118/118 y diff-check quedaron verdes; lint no tiene errores
  y conserva el warning preexistente.
- La corrección se publicó como `80e2f57`. El CI `34378399796` terminó completo
  en verde: replay estructural, aislamiento vivo 1–4, cuota, exposición y los
  recorridos críticos de Playwright incluidos. El PR #180 salió de draft y está
  listo para revisión.
- El checkpoint final `b8600ec` repitió todos los gates en verde en el run
  `34396862327`.
- Requisito operativo confirmado para el bloque 3B: cada zona configura su
  ventana de recepción; `Santa Cruz Sur` usa 08:00–12:00. Dentro de la ventana,
  las solicitudes aparecen en tiempo real pero siempre agrupadas y ordenadas
  por sucursal, no por orden de llegada. Desde el corte quedan registradas para
  la jornada siguiente y no son visibles ese día.
- Las solicitudes cargadas antes de las 08:00 se guardan para la jornada del
  mismo día y aparecen a las 08:00. No se rechazan ni se difieren al día
  siguiente.
- La administrativa debe poder exportar un `.xlsx` real de una sucursal o del
  total visible de la zona, respetando el mismo orden. Después de cargar los
  cambios en el sistema de la cadena vuelve a la bandeja y usa **Marcar Activo**;
  el evento interno continúa siendo `ejecutada`.
- El PR #180 conserva su alcance como base 3A y no implementa todavía ventana,
  diferimiento ni exportación. No presentar el circuito zonal como terminado
  hasta cerrar 3B.
- Los dos recorridos Playwright nuevos tienen sintaxis validada, pero no se
  ejecutaron localmente porque el runner aislado sólo se instala en CI.
- Hallazgo corregido: la hora de ejecución se toma después de adquirir el lock,
  para que una espera concurrente no cree un evento anterior al ya confirmado.
- Hallazgo descartado: una salida truncada pareció mostrar un cierre SQL
  duplicado; la inspección numerada del archivo verificó que no existía.
- La CLI de Supabase no está instalada en este entorno y el intento de obtenerla
  por `npx` no fue autorizado. La migración usa un nombre fechado generado en
  UTC; no se consultó ni modificó ninguna base.

## Rama activa · bloque 3B

Alcance implementado:

- `zonas` recibe la ventana de recepción como configuración propia, con
  `08:00`–`12:00` por defecto y la restricción de que el corte sea posterior al
  inicio. El valor por defecto es política del circuito, no un dato sembrado.
- Una única función privada decide a qué jornada pertenece un momento: el mismo
  día hasta el corte, el siguiente desde el corte, siempre en horario argentino.
  El inicio no participa de esa decisión, porque una carga previa a la apertura
  pertenece a la jornada de ese mismo día.
- La solicitud persiste su jornada al crearse y no vuelve a recalcularla. La fila
  y su jornada se derivan de un único instante, para que no puedan caer a lados
  distintos del corte.
- Las solicitudes ya registradas se reconstruyeron con la misma regla aplicada
  sobre `creada_at`. El bloqueo de inmutabilidad se suspende sólo para ese
  relleno y se restablece dentro de la misma transacción.
- La bandeja aplica el corte de visibilidad con sus dos mitades: un pendiente de
  una jornada anterior se ve siempre; lo asignado a hoy espera a que abra la
  ventana; lo diferido no se ve ese día.
- Ejecutar rechaza lo que todavía no corresponde ver. El reintento idempotente
  responde antes de esa guarda, para que una repetición tardía no falle.
- La bandeja agrupa por sucursal y exporta un `.xlsx` real —ZIP con partes
  OOXML, sin dependencias nuevas— por sucursal o por la jornada visible completa
  de la zona, respetando orden y agrupación de la pantalla.
- La acción de la administrativa pasa a llamarse **Marcar Activo**; el evento
  interno sigue siendo `ejecutada`.
- La ventana se configura desde Accesos y jerarquía, por la Function
  administrativa y con permiso de administración de jerarquía. No es superficie
  del browser ni de la propia bandeja.

Decisión ratificada: la bandeja **no** muestra un conteo de solicitudes
diferidas. La razón de fondo no es sólo que el contrato diga que no se ven ese
día: **un número visible es una invitación**. Si el conteo está ahí, tarde o
temprano alguien pregunta si no puede procesarlas ya que están, y el corte se
disuelve entero. Además la administrativa no puede hacer nada con esa
información hoy: le genera ansiedad sin acción posible. Si la operación real lo
pide, se agrega.

Pruebas de la rama:

- contrato específico del bloque 3B: verde;
- prueba de mutación: once mutantes, todos detectados; cada sustitución se
  verificó aplicada antes de correr el contrato, para que un reemplazo fallido
  no se lea como cobertura. Cubren las dos mitades del corte de visibilidad, la
  pérdida de `security_invoker` en la vista, el corte tomado por el inicio en vez
  del cierre, la ejecución fuera de jornada, el reintento caído después de la
  guarda, el porcentaje exportado como texto, el orden gobernado por la llegada,
  la ventana configurable desde el browser, el relleno que deja el bloqueo
  apagado y la jornada derivada de un instante distinto al de la fila;
- contrato del bloque 3A actualizado: la exportación deja de estar prohibida, la
  acción cambia de nombre y el formateo en horario argentino se afirma sobre la
  librería compartida entre pantalla y archivo;
- el archivo exportado se vuelve a abrir en la prueba con un lector de ZIP
  propio, que verifica el CRC32 de cada parte contra los bytes leídos por
  offset: un error de posiciones no se vería comparando cadenas;
- gate vivo ampliado con un Gate 5 sobre Supabase efímero: prueba que lo diferido
  no entra en la bandeja ni puede ejecutarse, que lo asignado a hoy espera al
  inicio, que un pendiente de una jornada anterior se ve igual, y que el rechazo
  no deja un evento de ejecución. Las ventanas del gate se fijan para no depender
  de la hora en que corra el CI;
- `npm test`: 118 de 119 archivos verdes. El único fallo es el gate deliberado
  que exige regenerar la expectativa móvil del replay por la migración nueva;
- `npm run lint`: cero errores; permanece el warning preexistente de
  `ScannerModal.tsx:143`;
- `npm run build`: verde;
- `git diff --check`: verde;
- Playwright no se ejecutó localmente porque el runner sólo se instala en CI. El
  recorrido zonal se amplió para leer la jornada visible y descargar el archivo,
  comprobando que empiece con la firma de un ZIP y contenga la hoja y el
  producto.

Hallazgo corregido antes de pedir CI: `to_char` no tiene sobrecarga para `time`.
Los cuerpos plpgsql no se analizan al crearse, así que una conversión implícita
inexistente habría fallado recién al ejecutar la bandeja, con la migración ya
aplicada. Los seis usos pasaron a un cast explícito a `interval`.

Regeneración de la expectativa: el primer run se lanzó sobre el commit anterior
y quedó inservible al publicarse el cast; se canceló y se relanzó sobre la
cabeza nueva. La expectativa sólo vale para el commit sobre el que se regeneró.

Replay descartable verde en el run `34517411806`, sobre `b91d9cc`. Ese run
también es la única prueba de que el cuerpo de las funciones resuelve: la
migración aplicó contra un Postgres real. Se incorporaron exclusivamente
`expected-replay-fingerprint.json` y `replay-expectation.json` dentro de
`baseline-v1`, extraídos del log con verificación SHA-256; el ancla permaneció
intacta y `git status` no muestra ningún otro archivo de la baseline modificado.

Diff estructural, comparado por objeto completo: agrega nueve objetos —las tres
columnas nuevas, sus dos restricciones, el índice por zona y jornada, y las dos
funciones—, no elimina ninguno, y cambia cinco: las tres RPC previstas, el
contexto de altas y la vista de solicitudes. En la vista cambia sólo
`definition_sha256`: `options` sigue en `["security_invoker=true"]`, igual que en
las otras dos vistas del circuito. El único cambio de ACL es un `EXECUTE` para
`service_role` sobre la RPC de configuración; `authenticated` no gana nada, y
`jornada_rag_zonal_v1` no aparece en el ACL de nadie.

Hallazgo en el propio instrumento: `acl` no es una lista sino un objeto que
agrupa `schemas`, `tables` y `functions`, así que el comparador lo volcaba
entero como un valor único. La sección más sensible del fingerprint era la menos
legible, y ahí adentro podía viajar cualquier permiso nuevo sin que nadie lo
viera. El comparador ahora baja un nivel en las secciones que agrupan otras, y
su contrato cubre el caso; se verificó que el caso nuevo falla contra la versión
anterior del comparador.

Dos ciclos de CI se gastaron en el mismo lugar —el fixture del gate vivo— y los
dos fallos fueron invariantes del esquema que ningún gate local puede ver, porque
el gate vivo necesita Docker y un Supabase efímero. Ambos quedaron cubiertos por
el contrato, con su prueba de mutación:

- el `CHECK` no admite una jornada anterior a la fecha de creación, y el fixture
  sembraba una solicitud con jornada de ayer creada hoy;
- la FK contra `rag_escala_descuento` exige que todo porcentaje pertenezca a la
  escala de la organización, y el fixture pedía un escalón que él mismo no
  sembraba.

En los dos casos la corrección fue ajustar el fixture, no relajar la restricción:
estaba construyendo estados que el circuito no puede producir.

El tercer CI pasó los gates vivos completos —incluido el Gate 5 nuevo— y falló en
Playwright por una consecuencia de este mismo bloque: la tarjeta ahora muestra la
pastilla breve y también el estado completo, así que buscar el texto de la
pastilla por subcadena coincidía con dos elementos. Se corrigió exigiendo la
coincidencia exacta y comprobando además el estado completo, que es información
nueva que la tarjeta debe mostrar. El contrato lo exige y la mutación lo
confirma.

El primer CI del PR falló en el gate vivo, y lo cazó una restricción propia de
este bloque: el fixture sembraba una solicitud con jornada de ayer pero fecha de
creación de hoy, y el `CHECK` no admite una jornada anterior a la creación. La
restricción tiene razón —una solicitud de una jornada anterior se creó ese día—,
así que el fixture estaba construyendo un estado que el circuito no puede
producir. Se corrigió fechándola completa, no relajando la restricción. El
contrato ahora exige esa coherencia y se verificó que la exige: quitando la fecha
de creación, el contrato falla.

Verificación local con la expectativa incorporada y el fixture corregido:
`npm test` 119 de 119 archivos verdes, `npm run lint` sin errores y con el
warning preexistente de `ScannerModal.tsx:143`, `npm run build` verde y
`git diff --check` verde.

CI completo en verde sobre `18df7bb` en el run `34545436645`: replay estructural,
contratos, lint, build, aislamiento vivo 1–5 con el Gate 5 nuevo, cuota,
clasificación de exposición y los veinte recorridos Playwright. El PR #181 quedó
en estado `clean` contra `master`.

Pendiente de esta rama: autorización explícita antes de mergear y antes de
aplicar SQL en producción. Al aplicarla, registrar el timestamp productivo como
se hizo con C1 y C2A.

## Circuito RAG aplicado a producción · 2026-09-11

Los cuatro bloques se aplicaron **de a uno, con verificación de objetos entre
cada paso**, y antes de cada uno se comprobaron sus precondiciones para que un
fallo dijera qué faltaba y no «algo falló». Ninguno falló.

| Bloque | Versión en Git | Versión en el ledger productivo |
|---|---|---|
| 1 · modelo y estados | `20260909020007` | `20260911010801` |
| 2 · validación en sucursal | `20260909092814` | `20260911011059` |
| 3A · bandeja zonal | `20260909144530` | `20260911011425` |
| 3B · jornada zonal | `20260910183632` | `20260911011704` |

El desvío de timestamp es el mismo de C1 y C2A —el mecanismo remoto registra la
hora de ejecución, no la del nombre del archivo— y quedó documentado en
`scripts/migration-replay/history-manifest.json`, con su contrato.

Verificado contra la base después de aplicar:

- las dos tablas del circuito, su vista y sus políticas RLS existen; la vista
  conserva `security_invoker=true` **después** del reemplazo de 3B;
- el trigger de inmutabilidad quedó **reactivado** tras el relleno de jornada;
- `jornada_zonal` es `NOT NULL` y las 17 zonas tomaron la ventana 08:00–12:00;
- `authenticated` tiene EXECUTE sólo donde corresponde;
  `configurar_jornada_rag_zonal_v1` no está expuesta al browser y
  `jornada_rag_zonal_v1` no tiene EXECUTE para nadie;
- la guarda de jornada está presente en la ejecución.

### El desfasaje se cerró; la capacidad de abrir el primer RAG no

Medido contra la base, no deducido: de los vencimientos activos, **uno** puede
crear una solicitud hoy —tiene RAG vigente, estado insuficiente y escalón
superior disponible—. El circuito está vivo de punta a punta.

Los **nueve** en `sin_rag` siguen sin poder recibir uno, y no por el desfasaje:
la RPC exige `rag_porcentaje IS NOT NULL`, porque el circuito sabe **escalar** un
RAG existente y no **abrir** el primero. Aplicar los cuatro bloques alineó la
base con el frontend, que era el desfasaje; no cerró el hueco del primer RAG,
que es un hallazgo aparte y espera tres decisiones de producto.

Dicho sin rodeos: el criterio «que la operación vuelva a poder poner un RAG en un
producto sin intervención previa» **no se cumple**, y no iba a cumplirse con
estas cuatro migraciones.

## Cómo se llegó acá · producción no tenía los bloques 1, 2 ni 3A

Verificado contra la base productiva el 2026-09-11, antes de aplicar 3B. **3B no
se puede aplicar**: su migración empieza con `ALTER TABLE
public.solicitudes_cambio_rag`, y esa tabla no existe en producción.

El ledger productivo termina en `intervenciones_explicitas_por_tipo_v1` (C2A).
Las migraciones de los bloques 1, 2 y 3A del circuito nunca se aplicaron. La
comprobación no se hizo sobre el ledger sino sobre los objetos, que es la
evidencia real: `solicitudes_cambio_rag`, `solicitud_cambio_rag_eventos`,
`v_solicitudes_cambio_rag_actual`, `solicitar_cambio_rag`,
`listar_bandeja_rag_zonal`, `ejecutar_solicitud_cambio_rag` y
`zonas.rag_jornada_inicio` devuelven todos nulo.

Aplicar 3B exigía aplicar antes esos tres bloques. Se autorizaron y se aplicaron
los cuatro el 2026-09-11; el detalle está arriba. Esta sección se conserva porque
explica el origen del ítem de deuda sobre migraciones mergeadas sin aplicar.

### Corrección de un diagnóstico anterior

El hallazgo de más abajo decía que el bloque 2 había cerrado el camino viejo para
abrir un RAG. **Eso es cierto del repositorio, no de producción.** En la base
productiva `registrar_control_vencimiento_dashboard` todavía acepta
`p_porcentaje_rag` y no lo rechaza: la migración que cierra esa puerta no está
aplicada.

La causa operativa en producción es otra y más simple: **el frontend desplegado
está tres bloques adelante de la base.** La interfaz ya es la del circuito
centralizado —no ofrece el porcentaje editable— y la base todavía no tiene el
circuito. El hueco es la diferencia entre las dos.

La degradación está prevista en el código: `useSolicitudCambioRag` marca
`disponible: false` ante `42P01`/`PGRST205` y la tarjeta no muestra un error. Por
eso el síntoma se ve como una ausencia y no como una falla.

## Hallazgo abierto · el circuito no sabe abrir el primer RAG

Detectado el 2026-09-10 sobre la app en uso, fuera del alcance de 3B. **No es un
problema de interfaz: no existe ningún camino para crear el primer RAG de un
producto.** Verificado en los tres niveles:

- **Superficie de RPC.** Las únicas RPC de RAG expuestas al browser son
  `finalizar_rag_vigente` y `solicitar_cambio_rag`. La oferta central sí tiene su
  `informar_oferta_central`; el RAG no tiene su par, porque se resolvió que pasa
  por el circuito centralizado.
- **Servidor.** `solicitar_cambio_rag` exige `rag_porcentaje IS NOT NULL`,
  `dias_desde_ultimo_rag IS NOT NULL`, `estado_seguimiento_rag IN ('insuficiente',
  'sin_movimiento')` y un escalón estrictamente mayor al vigente. Sin tramo
  abierto, la vista devuelve `sin_rag` y esas cuatro condiciones son inalcanzables.
- **Interfaz.** El bloque de sugerencia está anidado dentro de
  `rag_porcentaje != null`; sin RAG la tarjeta cae al texto «Todavía no hay un RAG
  registrado», sin acción.

La causa es de diseño, no un defecto de implementación: el motor de cobertura
mide un tramo contra su propia ventana, así que **sin tramo no hay nada que
medir**, y el circuito quedó construido como escalamiento. El bloque 2 cerró a la
vez el camino anterior —registrar un control ya no acepta un porcentaje RAG—, así
que la única puerta que existía se cerró sin que se abriera la nueva.

Consecuencia en uso: un producto en Radar cuya velocidad necesaria supera
holgadamente su venta media no puede recibir un RAG por ningún medio.

**Planteo pendiente de decisión, no implementado.** Son dos sugerencias
distintas, con evidencia distinta, y confundirlas repetiría el error de que dos
situaciones produzcan el mismo valor:

1. **Primer RAG, escalón cero a uno.** No hay tramo ni cobertura medida. La única
   señal disponible es la que ya calcula el motor de riesgo y ya se muestra en la
   tarjeta: la velocidad necesaria contra la venta media informada por Glaciar.
   Es evidencia prestada —no una observación propia de NoVen sobre ese
   vencimiento—, y eso tiene que quedar marcado: `cobertura_al_sugerir` no puede
   guardar una cobertura medida y una estimada en la misma columna sin
   distinguirlas.
2. **Escalamiento, escalón n a n+1.** Hay tramo. La señal es la cobertura medida
   contra la ventana del propio tramo, con la guarda de ventana observable. Es lo
   que ya funciona.

Decisiones que no son mías y bloquean la implementación:

- si la primera sugerencia es siempre el primer escalón de la escala, o puede
  saltar varios cuando el déficit es grande. El modelo ya admite lo segundo
  —`escalones_sugeridos` acepta más de uno y el escalón cero implícito ya sabe
  contarlos—, pero hoy la RPC escribe `1` fijo. A favor del primer escalón: la
  evidencia es la más débil del circuito. En contra: con pocos días de ventana un
  primer escalón corto pierde un ciclo de control entero;
- si la primera sugerencia exige un control nuevo, como el resto del circuito.
  El principio vigente dice que sin observación nueva no hay sugerencia nueva;
- si esto es un bloque propio antes del 4, o un arreglo que entra antes por
  dejar la operación sin una herramienta.

### Verificado · el tope de escala está cubierto en el motor y mudo en la tarjeta

El motor lo resuelve bien: `subirEscalones` devuelve `null` cuando el porcentaje
vigente ya es el tope, y `evaluarSugerencia` produce el motivo `tope_de_escala`
con `hay: false`. No inventa un escalón que no existe.

Pero **ese motivo no se muestra en ninguna parte**. El bloque de sugerencia del
modal se renderiza sólo cuando `sugerencia.hay`, así que con un RAG en el tope la
tarjeta muestra el estado —«RAG insuficiente»— y las velocidades, y no dice nada
sobre por qué no hay sugerencia. Queda mudo justo donde hace falta una frase.

Hoy no hay ningún vencimiento en esa situación en producción, así que es un
arreglo de texto sin urgencia, pero es real.

## Próximo paso ejecutable

1. Validar y publicar el hotfix de redirección; confirmar su CI y desplegarlo.
2. Regenerar la invitación afectada y comprobar que el enlace termina en
   `https://noven-ia.netlify.app/activar`, nunca en localhost.
3. Cerrar el hotfix y volver al objetivo que traiga la operación; no reabrir 3B,
   que ya está fusionado y aplicado.

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
- Publicó la expectativa y el checkpoint como `e042124`. El CI `34377626774`
  validó replay, pruebas, lint y build, y luego encontró una colisión interna del
  fixture: Gate 1 intentaba crear un vencimiento activo que Gate 4 ya había
  sembrado para la misma identidad. Los gates posteriores quedaron sin ejecutar.
- Ajustó Gate 1 para actualizar el vencimiento sembrado y agregó una aserción de
  contrato que impide reintroducir la colisión. La corrección no cambia esquema
  ni producto. Contrato específico, suite 118/118 y diff-check quedaron verdes;
  lint no tiene errores y conserva el warning preexistente. Queda pendiente
  publicarla y repetir el CI completo.
- Publicó la corrección como `80e2f57`. El CI `34378399796` completó en verde
  replay, aislamiento vivo 1–4, cuota, exposición y Playwright, además de suite,
  lint y build. Sacó el PR #180 de draft; el único pendiente del bloque es la
  revisión y decisión explícita de merge. No se aplicó SQL en producción.
- El checkpoint final `b8600ec` quedó completo en verde en el run
  `34396862327`.
- Fernando precisó el ciclo de recepción zonal: 08:00–12:00 para `Santa Cruz
  Sur`; dentro de la ventana, ingreso en tiempo real con orden estable por
  sucursal; desde el corte, visibilidad diferida hasta la jornada siguiente.
  También exige exportar Excel por sucursal o por toda la zona y mostrar
  **Marcar Activo** sólo después de la carga externa. Se incorporó al contrato
  como bloque 3B, previo a la validación en góndola y todavía sin implementar.
- Fernando confirmó el borde previo a la apertura: una solicitud cargada antes
  de las 08:00 se conserva para la jornada de ese mismo día y aparece a las
  08:00. No se rechaza ni se envía a la jornada siguiente.

### 2026-09-11 · Claude Code · rama `feat/informar-rag-constatacion`

- **Hallazgo de fondo, ya nombrado como regla.** Al cerrar la puerta lateral por
  la que el browser abría un RAG se reconstruyó solamente el camino de
  **autorizar** un cambio (`solicitar_cambio_rag`, que exige un RAG vigente). El
  camino de **constatar** el primero nunca se reconstruyó, así que un vencimiento
  sin intervención previa no tenía forma de recibir su primer RAG: no por falta
  de permiso, sino por falta de camino. Sin intervención no hay tramo y sin tramo
  el motor de cobertura no arranca. La omisión no daba síntoma de error — la
  tarjeta decía «Todavía no hay un RAG registrado», que era cierto, junto a
  ningún botón.
- **La regla quedó escrita en `ai/rules.md`:** constatar un hecho y autorizar un
  cambio son permisos distintos. Constatar lo puede hacer quien está frente al
  producto; autorizar, quien tiene la jerarquía.
- Nueva migración `20260911151500_informar_rag_constatacion_v1.sql`: RPC
  `public.informar_rag(uuid, numeric, text)` sobre
  `noven_private.informar_rag_impl`, autorizada por
  `puede_ver_producto_sucursal` y sin lista de roles. Es RPC propia y no cuelga
  del control: registrar stock y declarar un precio no vuelven a ser la misma
  llamada. No puede tocar un RAG vigente con otro porcentaje —ese camino sigue
  siendo el circuito centralizado— y ante el mismo porcentaje devuelve la
  intervención existente sin mover `aplicado_at`.
- La escala **no** bloquea la constatación: si la cadena puso un porcentaje fuera
  de escala, ocurrió, y se registra marcado `fuera_de_escala`. La instrumentación
  se delega en `instrumentar_sugerencia_rag_impl` con origen `manual` en vez de
  recalcular el escalón: dos cómputos del mismo número terminan divergiendo, y
  dejar `escalones_estado` en NULL habría afirmado «no se instrumentó» sobre una
  fila nacida hoy.
- UI: el texto muerto de la tarjeta se reemplazó por el selector de la escala más
  «Informar RAG», con un campo libre detrás de «Otro porcentaje…» para el caso
  fuera de escala. El camino diario sigue siendo elegir el número y confirmarlo.
- Contratos nuevos: `frontera-constatar-autorizar-contract.test.mjs` —registro de
  RPC clasificadas, con **mutantes en las dos direcciones** (un constatador con
  lista de roles y un autorizador que se conforma con el alcance tienen que
  hacerlo fallar) más un tercer mutante para el registro incompleto— e
  `informar-rag-contract.test.mjs` para las propiedades de la RPC.
- `rag-sugerencia-ux-contract` se ajustó de forma deliberada: prohibía todo campo
  numérico ligado al RAG. La excepción del porcentaje fuera de escala quedó
  cercada por aserciones propias (sólo en la rama sin RAG, sólo detrás de «Otro
  porcentaje…», y con el total de campos numéricos del modal fijado) en vez de
  aflojar la regla.
- Validación local: lint sin errores (con el warning preexistente de
  `ScannerModal.tsx:143`), build verde, suite de contratos verde salvo la
  expectativa móvil del replay, que por diseño se regenera en CI al agregarse una
  migración.
- Playwright local: 21 recorridos en verde, incluidos dos nuevos para el primer
  RAG —el camino de escala y el de porcentaje fuera de escala—. El único rojo es
  `catalog-role-boundary` en el caso del gerente zonal, y **falla igual sin este
  cambio**: se verificó volviendo el árbol al estado de `master` y repitiendo el
  recorrido. Queda como artefacto de este entorno; el CI es la autoridad.
- Expectativa móvil regenerada en el run `34629059400` sobre el mismo SHA del PR,
  con sus pasos de protección del ancla y de limitación del diff en verde. Se
  incorporó extrayéndola del log, verificando el SHA-256 de cada archivo, y sin
  tocar el ancla `expected-fingerprint.json` —comprobado por digest antes y
  después—. Suite completa 121/121 con la expectativa nueva.
- Diff estructural por objeto completo: **agrega 5, saca 0, cambia 0**. Las dos
  funciones nuevas y sus tres entradas de ACL. Ni `anon` ni `PUBLIC`: el REVOKE
  previo al GRANT hizo lo que dice. La forma de los permisos es idéntica a la de
  `informar_oferta_central` —`authenticated` + `service_role` en el wrapper
  público, sólo `authenticated` en la implementación—, así que no introduce una
  asimetría nueva.
- **No se aplicó SQL en producción.** La aplicación requiere autorización
  explícita y se avisa antes.

### 2026-09-11 · Claude Code · aplicación productiva de `informar_rag`

- PR #183 mergeado por squash como `f248fd8`, con CI verde sobre `0b6b2c8`.
- Migración aplicada a producción. El ledger registró el timestamp de ejecución
  `20260911181056` frente al `20260911151500` del nombre en Git: misma forma de
  divergencia que C1, C2A y los cuatro bloques del circuito, documentada como
  `repository_production_version_mismatch` en `history-manifest.json` y
  declarada en su contrato, que falla si la entrada no se declara.
- Verificación contra el catálogo, no contra el archivo: las dos funciones
  existen con la seguridad y el `search_path` que dice la migración; `anon` no
  tiene EXECUTE sobre ninguna; `authenticated` la tiene sobre ambas; la forma de
  permisos coincide con `informar_oferta_central`. Y lo que el `PERFORM`
  necesita —una única sobrecarga de `instrumentar_sugerencia_rag_impl` con la
  firma exacta, y el dueño del DEFINER con EXECUTE sobre ella— está verificado
  en producción, además del gate de exposición que ya lo había ejecutado en CI.

#### El conteo pedido, contra la base

- **Los nueve pueden recibir un RAG informado. Ninguno queda afuera.** Los nueve
  tienen vencimiento y producto activos, familia asignada, sucursal activa y
  fila en `producto_sucursal` con VMD. El guard real se evaluó haciéndose pasar
  por cada usuario de la sucursal: pasa el gerente, y pasa el operador cuya
  familia cubre a los nueve. El otro operador no pasa, y es correcto: tiene otra
  familia asignada, así que el alcance está haciendo su trabajo.
- **Pero hoy sólo dos muestran el botón, y eso no es lo mismo.** El bloque RAG
  de la tarjeta se dibuja con `nivel_actual IN ('radar','urgente')`. Siete de los
  nueve están en `seguro`, así que el camino existe y la pantalla no lo ofrece.

#### Hallazgo: la puerta de riesgo y la ventana comercial miden distinto

- Verificado con los datos, no deducido: `nivel_actual` pasa a `radar` a los 45
  **días hasta el vencimiento**, mientras que `dias_comerciales_restantes` resta
  los días de donación del sector (10 acá). Un producto con 36 días comerciales
  tiene 46 hasta el vencimiento y sigue marcado `seguro`.
- Las dos medidas difieren exactamente en `dias_donacion`, y eso contradice la
  doctrina del propio proyecto: la ventana comercial real termina en el umbral de
  donación, no en el vencimiento. La tarjeta usa la medida que el motor dice que
  no hay que usar.
- No se cambió nada: tocar el umbral de nivel afecta a todo el tablero y está
  documentado en `docs/RISK_AND_RAG_RULES_V1.md`. Queda como decisión de producto
  pendiente, no como defecto silencioso.
- Mitigación temporal por el calendario, no por diseño: seis de los siete cruzan
  a `radar` entre el 2026-09-12 y el 2026-09-16, y el séptimo el 2026-10-05.

### 2026-09-11 · Claude Code · política de vencimientos, cierre del análisis

- Se cerró el análisis de umbrales **sin ejecutarlo**. Nada de eso rompe hoy: la
  operación viva está toda en masivos y no hay ningún vencimiento activo en
  perecederos. Los tres hallazgos quedaron registrados con evidencia en
  `docs/PRE_PRODUCTION_HARDENING_PLAN.md` para retomarse cuando importen —una
  segunda cadena o perecederos reales—, no antes.
- Única escritura productiva: `NO COMESTIBLES` (060) y `TEXTIL` (070) pasaron a
  `dias_donacion = NULL`, como ya se había hecho con `ELECTRO` e `INSUMOS`. Los
  cuatro sectores fuera de alcance quedan uniformes; cero familias afectadas.
- No se crearon `VERDULERIA`, `PASTAS` ni `CARNICERIA`: `sectores.codigo` refleja
  la taxonomía del origen y no se inventa un código que la cadena no dio.
- Sin cambios de esquema, sin tocar el cálculo de nivel, sin tocar los seis
  lugares donde viven los umbrales. El comportamiento actual queda como estaba.
### 2026-09-11 · Claude Code · nomenclatura del sistema de origen

- El nombre de la cadena y el de sus reportes salieron del texto de usuario:
  diecinueve cadenas en once archivos. Quedan en comentarios, identificadores y
  nombres de archivo, que es donde describen el formato real que se parsea.
- **El relevamiento inicial estaba incompleto y lo detectó el contrato.** Miró
  sólo `pages` y `components`, y se le escaparon tres mensajes de error que viven
  en `src/lib/importar-glaciar.ts` y llegan al usuario vía `throw new Error` desde
  las dos pantallas de importación, más un encabezado en mayúsculas del reporte
  exportable. El contrato los encontró antes que la revisión a ojo.
- El contrato también protege la mitad inversa: los nombres de columna se
  conservan. Sin esa aserción, la regla empujaría a vaciar los mensajes de error.
- Un mutante cazó un defecto del propio contrato: el filtro de identificadores
  borraba también la palabra suelta, así que daba verde sin verificar nada.
  Corregido exigiendo un carácter pegado.
- Dos contratos existentes anclaban en el texto viejo y se actualizaron: las
  acciones sugeridas de `riesgo-politicas` y el mensaje de carga masiva de
  `importar-0258`. Lo que verifican no cambió; cambió la redacción.
- `LARGO_COD_ART = 7` no se tocó: es un supuesto de formato, no de nomenclatura,
  y la desambiguación contra EAN depende de él. Queda en el plan.
- **El CI encontró lo que la validación local no miró.** Se validó con la suite
  de contratos y el build, y no con Playwright —siendo que todo el cambio era
  texto de pantalla, que es justo lo que Playwright verifica—. Tres recorridos
  rompieron en CI sobre los textos renombrados: dos `getByLabel('Stock total
  Glaciar')` y un encabezado «Importar desde Glaciar». Corregidos.
- Por eso el contrato ahora **también recorre `e2e/`**: un recorrido que busca el
  nombre de la cadena sólo pasa si la pantalla lo tiene, así que encontrarlo ahí
  significa o que la UI lo conserva o que el recorrido quedó viejo. Las dos son
  defectos, y el contrato los ve sin depender de acordarse de correr Playwright.
- Suite completa en verde, build limpio, lint sin errores (con el warning
  preexistente de `ScannerModal.tsx:143`). Playwright local: 21 de 22, con el
  único rojo en `catalog-role-boundary:49`, que **falla igual con el árbol
  limpio** y pasa en CI.

### 2026-09-12 · Estado final de la sesión

Lo que quedó en producción y verificado:

- **`informar_rag` viva.** El primer RAG de un vencimiento se puede constatar.
  Los nueve vencimientos que estaban sin camino pueden recibirlo: verificado
  contra la base, evaluando el guard real como cada usuario de la sucursal.
- **El circuito RAG centralizado, sus cuatro bloques aplicados**, con el
  timestamp productivo de cada uno registrado en el ledger y declarado en su
  contrato.
- **La regla de la frontera** —constatar un hecho y autorizar un cambio son
  permisos distintos— nombrada en `ai/rules.md`, con contrato y mutantes en las
  dos direcciones.
- **El nombre del sistema de la cadena fuera del texto de usuario**, con un
  contrato que cubre también los recorridos E2E.
- **Sectores fuera de alcance uniformes:** `NO COMESTIBLES` y `TEXTIL` pasaron a
  `dias_donacion = NULL`, como ya estaban `ELECTRO` e `INSUMOS`.

Sin ramas ni PRs abiertos. Sin migraciones mergeadas y sin aplicar.
