# NoVen · Estado de trabajo y continuidad

**Documento vivo.** Es la fuente de verdad para saber qué se está construyendo,
qué quedó terminado y cuál es el siguiente paso. Debe actualizarse en el mismo
PR que cambie alguno de esos estados.

Fecha de corte: **2026-09-08**.

## Qué documento responde cada pregunta

| Pregunta | Fuente |
|---|---|
| Qué producto estamos construyendo | `PRODUCT_VISION.md` |
| Cómo funciona el futuro circuito zonal de RAG | `docs/CIRCUITO_RAG_CENTRALIZADO_V1.md` |
| Qué está en curso y qué sigue | este documento |
| Estado del hardening y deuda técnica | `docs/PRE_PRODUCTION_HARDENING_PLAN.md` |
| Decisiones técnicas o transitorias ya tomadas | `ai/decisions.md` |

Ningún chat privado es fuente de verdad. Si una decisión o avance no está en Git,
el siguiente agente debe considerarlo no transferido.

## Regla de trabajo entre agentes

- Un solo agente implementa una rama o migración por vez.
- Claude Code y Codex pueden continuar el mismo producto, pero no editar
  simultáneamente la misma rama.
- El relevo ocurre después de commit y push. El agente entrante lee este archivo,
  la documentación enlazada, el diff de la rama y el estado del CI.
- Antes de empezar o continuar: comprobar `master`, PR abiertos, rama activa y,
  si corresponde, producción en modo de sólo lectura.
- Nunca hacer cambios directos en `master`, editar migraciones aplicadas, tocar el
  ledger manualmente ni modificar
  `scripts/migration-replay/baseline-v1/expected-fingerprint.json`.

## Estado verificado

### Base productiva

- `master`: `d4f6358` al corte de este documento.
- Bloque 5a · salidas de stock que no son venta: mergeado en PR #164.
- Escalón cero implícito: mergeado en PR #166.
- Bloque A · tramo y tipo de intervención: mergeado en PR #167.
- Especificación del circuito RAG centralizado: mergeada en PR #168.
- Bloque B · medición por tramo: mergeado en PR #169.

Los SHA son evidencia del corte, no una invitación a trabajar sobre una base
vieja. Siempre hay que volver a consultar el `master` remoto.

### C1 · cerrado por Codex

- Rama: `feat/convivencia-rag-oferta-central`.
- Head recibido de Claude Code: `494d573`.
- Propiedad: Codex la asumió y cerró el 2026-09-08. La rama ya no debe recibir
  trabajo nuevo; el siguiente bloque parte de `master`.
- Estado: PR #171 mergeado como `13ded23`, CI del PR y del push a `master`
  completos en verde, y migración aplicada y verificada en producción.
- Alcance: permitir un RAG y una oferta central simultáneos sin que uno cierre al
  otro; separar sus tramos; mostrar una sola medición combinada y marcarla como
  no atribuible cuando se superponen.
- C1 no crea ofertas centrales, no cambia la UI y no agrega el circuito zonal.
- La primera expectativa móvil de C1 queda descartada: describía
  `v_intervencion_tramos` sin `security_invoker=true`. No debe copiarse ni
  commitearse aunque su workflow haya terminado verde.

### Contrato UX previo a C2 · cerrado

- Rama: `docs/c2-ux-operator-contract`.
- Alcance: fijar cómo se incorporan los nuevos estados conservando la tarjeta del
  Dashboard y el modal de control actuales.
- Cambios productivos o de base: ninguno; sólo documentación.
- PR: [#170](https://github.com/FernandoDelgadoDiaz/noven-ia/pull/170).
- Estado: mergeado en `master` como `8191a9e`, con CI completo verde.

### C2A · operaciones explícitas por tipo · cerrado

- Rama: `feat/c2a-intervenciones-explicitas`.
- PR: [#173](https://github.com/FernandoDelgadoDiaz/noven-ia/pull/173).
- Estado: mergeado en `master` como `a7b0c49`, con CI completo verde en el PR y
  en el push a `master`; migración aplicada y verificada en producción.
- Alcance: iniciar oferta central por click actual y finalizar RAG u oferta
  central de forma independiente e idempotente, sin cierres cruzados.
- Producción preservó 20 intervenciones, 15 vigentes, cero ofertas creadas por la
  migración y cero duplicados vigentes por tipo.
- El ledger productivo registró `20260908110244` frente al archivo Git
  `20260908103000`; la divergencia está inventariada y no debe normalizarse.
- C2B fue rebasado sobre `master` después de cerrar y documentar C2A. Debe pasar
  CI propio antes de habilitar la interfaz de operador.

## Decisiones de producto ya fijadas

1. **La verdad entra por el click.** NoVen no infiere ni retrotrae una
   intervención. Si una oferta central ya existía pero el operador no la informa,
   para NoVen el producto sigue sin esa intervención.
2. **Seguro, Radar y Urgente describen riesgo, no intervenciones.** Cualquiera de
   esos estados puede coexistir con ninguna acción, RAG, oferta central o ambas.
3. **RAG y oferta central son independientes.** Pueden alternarse, dejar períodos
   sin intervención o convivir. Iniciar o finalizar una no modifica la otra.
4. **La transferencia es la tercera herramienta visible contra la pérdida.** Es
   un movimiento físico de stock y sus unidades no pueden contabilizarse como
   venta. Puede declararse mientras las intervenciones comerciales siguen
   vigentes.
5. **La pantalla diaria del operador se conserva.** No se agregan bandejas
   administrativas ni colecciones de botones al Dashboard. Los estados se ven en
   pastillas y la acción ocurre dentro del producto.
6. **Una sola acción destacada.** El modal puede conservar controles compactos
   independientes para intervenciones que conviven, pero sólo resalta el próximo
   paso principal según rol y estado.
7. **En el futuro circuito centralizado, la sugerencia no se negocia.** Allí
   desaparecen `Usar NN%` y la posibilidad de elegir otro porcentaje; gerente o
   supervisor usará `Informar NN%`. C2B conserva el flujo RAG actual mientras se
   reúne evidencia real y no adelanta ese circuito.
8. **En el futuro circuito centralizado, pedir y ejecutar no inicia la
   medición.** El tramo RAG comenzará cuando una persona confirme mediante botón
   que el precio está aplicado en góndola. Esa separación tampoco forma parte de
   C2B.

El contrato completo de textos, estados, roles y condiciones de aceptación está
en `docs/CIRCUITO_RAG_CENTRALIZADO_V1.md`, sección "Contrato UX de las pantallas
operativas (bloque C2)".

## Orden de ejecución

### 1 · Cerrar el contrato UX

- PR [#170](https://github.com/FernandoDelgadoDiaz/noven-ia/pull/170).
- Cerrado en `master` como `8191a9e`, con CI completo verde.
- No modifica producción.

### 2 · Terminar y revisar C1

- Cerrado en PR #171 y `master` `13ded23`.
- `security_invoker=true` restaurado y verificado en las dos vistas.
- Artefacto válido: run `34176477330`, sobre `85a82b8`; checksum ZIP
  `6dd14df41f1fcbe17fa5ae7bf2cd47f47d2bc20493c07761478c669214c7f7f2`.
- Migración aplicada en producción como ledger `20260908095426`; el desfase con
  Git `20260906230000` está documentado en `history-manifest.json` y el ledger no
  fue normalizado.

### Trabajo en curso de Codex · C2B

- Rama: `feat/c2b-ui-intervenciones-v2`, rebasada sobre `master` `d4f6358`. La
  rama remota anterior `feat/c2b-ui-intervenciones` queda reemplazada y no debe
  recibir trabajo nuevo.
- C2A ya está mergeado, aplicado y documentado; C2B no queda apilado sobre una
  rama pendiente.
- El diff contra `master` contiene once archivos: interfaz, hooks, contratos,
  fixtures E2E y este registro. No contiene migraciones ni fingerprints.
- El modal conserva stock, vencimiento y cantidad como acción principal, agrupa
  RAG y oferta central bajo **Intervenciones** y usa las RPC explícitas por tipo.
- La tarjeta puede mostrar simultáneamente RAG, oferta central y la última
  transferencia informada, con texto legible en lugar de un `+1` aislado.
- Después de un control con una caída anómala, pregunta su causa y permite
  declarar transferencia; las unidades continúan derivándose en el servidor y
  no se cuentan como venta.
- La revisión previa al PR corrigió tres fallas: el modal ya no se desmonta antes
  de que el operador clasifique una caída anómala, y una oferta central explícita
  finalizada prevalece sobre cualquier marca histórica anterior. Además, una
  transferencia informada no oculta una sugerencia RAG que todavía corresponda.
- Tiene contratos y E2E para convivencia, click explícito, transferencia y la
  regresión de oferta histórica. La ejecución Playwright completa corresponde al
  runner de CI.
- Verificación local: `npm test` 115/115 archivos en verde; `npm run lint` sin
  errores y con el warning preexistente de `ScannerModal.tsx`; `npm run build`
  verde. El ancla `expected-fingerprint.json` sigue intacta con SHA-256
  `0da259b3b5d37dc241d9358d8ed883614a856dc8fc71fdd62a3f80ffe79de0b2`.
- No agrega migraciones, roles, bandejas ni el circuito zonal futuro.

### 3 · Construir C2 · oferta central en las pantallas actuales

- C2A cerró el bloqueo de las operaciones por tipo en PR #173.
- C2B adapta el modal y la tarjeta actuales, sin inferencia ni fechas
  retroactivas, y conecta la declaración de transferencia sin contarla como
  venta.
- Falta publicar C2B, obtener CI completo verde, mergear y verificar el deploy.

### 4 · Reunir evidencia antes del circuito zonal

- Obtener entre veinte y treinta sugerencias RAG aceptadas con su tramo medido.
- No sustituir esa evidencia con datos fabricados ni construir autorizaciones
  sobre una recomendación todavía no validada en uso real.

### 5 · Circuito centralizado de RAG

Después de cerrar A, B y C y superar la condición de evidencia:

1. control nuevo y sugerencia;
2. validación de gerente o supervisor mediante **Informar NN%**;
3. solicitud visible en la bandeja de la administrativa zonal;
4. carga manual en el sistema de la cadena y marca de ejecutado;
5. habilitación al día siguiente;
6. confirmación en góndola por operador, supervisor o gerente;
7. creación de la intervención y comienzo del tramo recién en esa confirmación;
8. salida explícita **No está aplicado** cuando la ejecución no llegó a góndola.

## Pendientes concretos

- C2B: cerrar CI, merge y verificación del deploy de la interfaz mínima.
- Reunir evidencia real de veinte a treinta sugerencias aceptadas y medidas.
- Construir las bandejas del gerente y de la administrativa sólo después de esa
  evidencia.
- Mantener separados los pendientes de producto de las deudas enumeradas en
  `docs/PRE_PRODUCTION_HARDENING_PLAN.md`.

## Registro de actividad

### 2026-09-08 · Codex

- Rebasó C2B sobre `master` `d4f6358` una vez cerrados C2A y su registro de
  ledger. La rama conserva once archivos de interfaz, contratos y continuidad,
  sin migraciones ni cambios de esquema.
- En la revisión previa al PR detectó que `onGuardado()` desmontaba el modal
  justo después de abrir la pregunta por una caída anómala; lo corrigió para que
  el operador pueda declarar transferencia u otra causa antes del cierre.
- También evitó que el fallback del modelo anterior resucite una oferta central
  histórica después de que exista una oferta explícita ya finalizada, y agregó
  cobertura de regresión estática y E2E.
- Separó la señal visible de transferencia de las intervenciones comerciales:
  puede convivir con ellas y no bloquea una sugerencia RAG todavía válida.
- Cerró la validación local de C2B con 115/115 contratos, lint sin errores y
  build verde. Playwright queda como gate obligatorio del PR.
- Antes de transmitir revalidó `master` en `d4f6358`, únicamente los PR #160 y
  #118 abiertos, y producción en modo de sólo lectura: las tres RPC de C2A
  siguen presentes, hay 22 intervenciones, 17 vigentes, cero ofertas centrales
  informadas y cero duplicados vigentes por tipo. No ejecutó escrituras.
- Mergeó el registro del timestamp productivo de C2A en PR #174 como `d4f6358`.
  El ledger permanece intacto y el push a `master` pasó CI completo.
- Cerró C2A en PR #173 como `a7b0c49`: 114/114 contratos, lint, build,
  baseline/replay, Gates 1–3, cuota, exposición y Playwright en verde tanto en el
  PR como en el push a `master`.
- Aplicó `intervenciones_explicitas_por_tipo_v1` en producción mediante Supabase
  y verificó las tres RPC, sus permisos y el filtro RAG del camino legacy. No se
  insertaron, cerraron ni modificaron intervenciones.
- Registró el desfase Git `20260908103000` / ledger `20260908110244` sin tocar ni
  normalizar el historial productivo.

- Mergeó el contrato UX en PR #170 como `8191a9e`; CI completo verde y ninguna
  modificación de producción.
- Asumió expresamente la rama C1 desde `494d573` porque Claude Code quedó fuera
  de actividad hasta el siguiente relevo.
- Descargó el artefacto `expectativa-replay-regenerada` del run `34062416239` y
  verificó el ZIP contra su digest SHA-256 publicado. Traía exactamente
  `expected-replay-fingerprint.json` y `replay-expectation.json`.
- El diff estructural reveló una regresión crítica: C1 hacía
  `CREATE OR REPLACE VIEW public.v_intervencion_tramos` sin restaurar
  `security_invoker=true`; la reloption pasaba de `["security_invoker=true"]` a
  `null`. El trabajo se detuvo y Fernando fue avisado antes de PR o producción.
- Tras autorización para continuar, agregó el `ALTER VIEW` faltante y amplió el
  contrato de C1 para exigir `security_invoker=true` en las dos vistas que la
  migración reemplaza.
- Revalidó producción en modo de sólo lectura antes de transmitir la corrección:
  C1 no figura en el ledger, sigue vigente el índice anterior por
  `vencimiento_id`, y ambas vistas productivas conservan
  `security_invoker=true`. No ejecutó DDL ni modificó filas.
- Completó las precondiciones de datos de C1 en producción mediante consultas de
  sólo lectura: existen 20 intervenciones, todas de tipo `rag`; 15 permanecen
  vigentes y no hay grupos duplicados vigentes por `(vencimiento_id, tipo)`.
- Transmitió la corrección de seguridad a la rama como `638d288`. Para continuar
  ejecutó nuevamente `Regenerar expectativa del replay` después de documentar
  las precondiciones como `85a82b8`.
- Validó el run nuevo `34176477330`: terminó verde sobre el head exacto
  `85a82b8`. Su artefacto `expectativa-replay-regenerada` pesa 36.521 bytes,
  coincide byte a byte con el SHA-256 publicado y contiene únicamente
  `expected-replay-fingerprint.json` y `replay-expectation.json`.
- El diff contra `master` es el esperado y no tiene cambios de opciones, ACL,
  RLS ni policies: modifica dos funciones y dos vistas, quita el índice único
  vigente por vencimiento y agrega el índice único vigente por
  `(vencimiento_id, tipo)`.
- Con la expectativa nueva: `npm test` pasa 113/113, `npm run lint` pasa con cero
  errores y el warning preexistente de `ScannerModal.tsx`, y `npm run build`
  pasa. El checksum del ancla permanece
  `0da259b3b5d37dc241d9358d8ed883614a856dc8fc71fdd62a3f80ffe79de0b2`.
- Antes del commit final revalidó `master` en `8191a9e`, la rama en `85a82b8`,
  únicamente los PR #160 y #118 abiertos, y producción sin C1 en el ledger,
  con el índice anterior y ambas vistas todavía en `security_invoker=true`.
- Transmitió la expectativa móvil y este registro como `9b4bf61` y abrió el PR
  #171. GitHub detectó un único conflicto add/add en `CURRENT_WORK.md` porque C1
  nació antes del merge de #170; lo resolvió conservando la versión de C1, que
  ya incluye íntegramente el contenido de `master` más el seguimiento posterior.
  No hubo conflicto en código, migraciones ni fingerprints.
- La expectativa del run viejo quedó descartada y el fallo transitorio 112/113
  de `migration-replay-moving-expectation` quedó resuelto exclusivamente con el
  artefacto nuevo; no se regeneró localmente ni se modificó el ancla.
- El contrato C1 pasa y una mutación que elimina el `ALTER VIEW` nuevo falla en
  la aserción correcta, demostrando que la regresión vuelve a ser detectable.
- Mergeó el PR #171 como `13ded23` después de CI completo verde, y esperó también
  el CI verde del push a `master` antes de tocar producción.
- Aplicó C1 en producción mediante el mecanismo normal de Supabase. El ledger la
  registró como `20260908095426 convivencia_rag_oferta_central_v1`, frente al
  archivo Git `20260906230000`; no modificó ni normalizó el ledger.
- Verificación productiva posterior: índice único vigente por
  `(vencimiento_id, tipo)`, índice anterior ausente, filtros `tipo='rag'` en las
  dos funciones, ambas vistas con `security_invoker=true`, permisos coincidentes
  con el fingerprint, 20 intervenciones preservadas, 15 vigentes y cero
  duplicados vigentes por tipo. Las vistas responden correctamente.
- Un merge accidental ocurrió sólo en un worktree local ajeno a C1; se restauró
  el ref exacto y se dejó una referencia local recuperable. Nunca se transmitió
  a GitHub ni afectó producción.

### 2026-09-07 · Codex

- Revisó las pantallas móviles actuales aportadas por Fernando.
- Fijó el principio de conservar su estructura y priorizar el uso del operador.
- Documentó el contrato UX de C2: verdad por click, coexistencia, textos por rol,
  una acción destacada y comienzo de medición sólo tras confirmar en góndola.
- Verificación local: `npm test` — 112 archivos en verde; `npm run lint` — cero
  errores y un warning preexistente en `ScannerModal.tsx`; `npm run build` —
  verde.
- No ejecutó cambios en producción.

## Cómo retomar si cambia el agente

1. Leer `PRODUCT_VISION.md`, este documento y
   `docs/CIRCUITO_RAG_CENTRALIZADO_V1.md` completos.
2. Consultar el último `master`, las ramas y los PR abiertos; no confiar sólo en
   los SHA escritos arriba.
3. Leer el diff completo de la rama que se vaya a asumir.
4. Confirmar que ningún otro agente esté trabajando sobre ella.
5. Continuar desde el primer punto pendiente de "Orden de ejecución" y actualizar
   este archivo dentro del mismo PR cuando cambie su estado.
