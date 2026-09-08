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

- `master`: `8191a9e` al corte de este documento.
- Bloque 5a · salidas de stock que no son venta: mergeado en PR #164.
- Escalón cero implícito: mergeado en PR #166.
- Bloque A · tramo y tipo de intervención: mergeado en PR #167.
- Especificación del circuito RAG centralizado: mergeada en PR #168.
- Bloque B · medición por tramo: mergeado en PR #169.

Los SHA son evidencia del corte, no una invitación a trabajar sobre una base
vieja. Siempre hay que volver a consultar el `master` remoto.

### Trabajo en curso de Codex · C1

- Rama: `feat/convivencia-rag-oferta-central`.
- Head recibido de Claude Code: `494d573`.
- Propiedad: Codex la asumió el 2026-09-08; Claude Code no debe modificarla
  mientras este estado siga vigente.
- Estado: corrección de seguridad y regeneración de expectativa móvil en curso;
  todavía no hay PR ni cambios productivos.
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
7. **La sugerencia no se negocia.** Desaparecen `Usar NN%` y la posibilidad de
   elegir otro porcentaje. Gerente o supervisor usa `Informar NN%`.
8. **Pedir y ejecutar no inicia la medición.** El tramo RAG comienza cuando una
   persona confirma mediante botón que el precio está aplicado en góndola.

El contrato completo de textos, estados, roles y condiciones de aceptación está
en `docs/CIRCUITO_RAG_CENTRALIZADO_V1.md`, sección "Contrato UX de las pantallas
operativas (bloque C2)".

## Orden de ejecución

### 1 · Cerrar el contrato UX

- PR [#170](https://github.com/FernandoDelgadoDiaz/noven-ia/pull/170).
- Cerrado en `master` como `8191a9e`, con CI completo verde.
- No modifica producción.

### 2 · Terminar y revisar C1

- Revisar la rama `feat/convivencia-rag-oferta-central` contra el `master` más
  reciente y contra el contrato UX.
- Restaurar `security_invoker=true` en las dos vistas reemplazadas por C1. La
  primera regeneración demostró que `v_intervencion_tramos` lo perdía.
- Regenerar la expectativa móvil después del arreglo; el artefacto del run
  `34062416239` no es válido para merge porque captura el esquema inseguro.
- Confirmar que cada escritura, finalización, instrumentación y tramo esté
  acotado por tipo.
- Abrir PR pequeño, ejecutar CI completo y mergear sólo en verde.
- Aplicar su migración a producción únicamente siguiendo el procedimiento normal
  y verificarla después; nunca tocar el ledger manualmente.

### 3 · Construir C2 · oferta central en las pantallas actuales

- Resolver primero el bloqueo conocido: el camino actual de **Finalizar RAG**
  busca "la intervención viva" sin filtrar por tipo y podría cerrar la oferta
  central equivocada.
- Crear operaciones explícitas por tipo; no esconder comandos en texto libre.
- Permitir que el operador informe y finalice una oferta central desde el modal
  actual, sin inferencia ni fechas retroactivas.
- Mostrar RAG y oferta central simultáneos en la tarjeta sin alterar su jerarquía.
- Integrar la transferencia como tercera acción visible sin convertir sus
  unidades en ventas ni obligarla a usar el modelo temporal de precios.
- Agregar contratos y E2E para cero intervenciones, cada intervención por
  separado, convivencia, alternancia y finalización correcta.

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

- C1: terminar la corrección de `security_invoker`, regenerar la expectativa,
  revisar el nuevo diff estructural, abrir PR, CI, merge y aplicación controlada.
- C2: esquema de operaciones por tipo, interfaz mínima y pruebas.
- Resolver técnicamente la presentación de transferencia como acción visible sin
  confundirla con una intervención de precio ni con una venta.
- Reunir evidencia real de veinte a treinta sugerencias aceptadas y medidas.
- Construir las bandejas del gerente y de la administrativa sólo después de esa
  evidencia.
- Mantener separados los pendientes de producto de las deudas enumeradas en
  `docs/PRE_PRODUCTION_HARDENING_PLAN.md`.

## Registro de actividad

### 2026-09-08 · Codex

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
- La expectativa descargada se considera descartada. Debe generarse otra desde
  la migración corregida; `expected-fingerprint.json` permanece intacto.
- Verificación posterior al arreglo: el contrato C1 pasa y una mutación que
  elimina el `ALTER VIEW` nuevo falla en la aserción correcta. `npm run lint`
  queda con cero errores y el warning preexistente de `ScannerModal.tsx`;
  `npm run build` pasa. `npm test` queda en 112/113: falla únicamente
  `migration-replay-moving-expectation` porque el hash de la migración cambió y
  la expectativa descartada ya no coincide. Es el fallo esperado hasta volver a
  correr el workflow de regeneración; no se corrige localmente.
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
