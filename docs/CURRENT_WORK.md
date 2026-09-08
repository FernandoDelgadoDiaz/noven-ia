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

Fecha de corte: **2026-09-08**.

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

- Base revisada: `origin/master` en `1f2a9b8`.
- Último CI de esa base: run `34250337992`, completo en verde.
- Rama activa: `docs/current-work-operational-rule`.
- Head remoto validado: `8cd31a4`.
- Propietario de la rama: Codex hasta merge o relevo explícito.
- Alcance de la rama: continuidad pública, reconciliación de estados y decisión
  de iniciar el circuito RAG. No contiene código productivo ni migraciones.
- Publicación: autorizada por el responsable en versión reducida. PR
  [#177](https://github.com/FernandoDelgadoDiaz/noven-ia/pull/177) abierto contra
  `master`; run `34281365574` completo en verde.

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

### En ejecución

**Circuito de validación y ejecución centralizada de RAG.** A, B y C ya están
cerrados. La implementación por bloques está autorizada y comienza después de
mergear esta reconciliación documental.

Orden acordado:

1. modelo de solicitud, máquina de estados y permisos;
2. validación gerencial y seguimiento desde la sucursal;
3. bandeja zonal y ejecución individual;
4. confirmación o rechazo en góndola, iniciando el tramo sólo al confirmar;
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

- PR #160: contiene evidencia documental válida de Fase 2, pero su cambio de
  reglas quedó superado. Esta rama incorpora los estados válidos; después de su
  merge, #160 debe cerrarse como reemplazado, no mergearse tal como está.
- PR #118: diseño del Agente 2, permanece en draft. No implementar hasta contar
  con su muestra operativa y la decisión económica indicadas en ese PR.

## Pruebas de la rama activa

Ejecutadas y repetidas el 2026-09-08 después de reducir el checkpoint público:

- `npm test`: 115/115 archivos en verde.
- `npm run lint`: cero errores; permanece un warning preexistente en
  `ScannerModal.tsx:143`.
- `npm run build`: verde.
- `git diff --check`: verde.
- Playwright local no se ejecutó porque `npm ci` no instala directamente el
  runner; `AGENTS.md` ahora remite a la preparación exacta usada por CI. El
  Playwright del PR #177 terminó en verde.
- CI del PR #177: contratos, lint, build, replay, aislamiento, cuota, exposición
  y Playwright completos en verde en el run `34281365574`.

## Próximo paso ejecutable

1. Mergear el PR #177 y comprobar el CI posterior de `master`.
2. Cerrar PR #160 como reemplazado, conservando su historial.
3. Crear desde el nuevo `master` una rama pequeña para el bloque 1 del circuito:
   modelo de solicitud, estados y permisos.
4. Diseñar migración y contratos sin aplicar SQL en producción dentro de ese
   primer PR.

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
