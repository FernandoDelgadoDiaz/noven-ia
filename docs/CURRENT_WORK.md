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

- Base revisada: `origin/master` en `63fea6d`, merge del PR #177.
- CI del PR #177: runs `34281365574` y `34281819683`, completos en verde.
- El conector disponible no enumera runs disparados por push a `master`; la
  validación local y el CI de la nueva rama siguen siendo obligatorios.
- Rama activa: `feat/rag-centralizado-modelo-estados`.
- Propietario de la rama: Codex hasta merge o relevo explícito.
- Alcance de la rama: bloque 1 del circuito RAG centralizado —modelo de
  solicitud, máquina de estados, nuevo rol y permisos— sin interfaz ni
  aplicación de SQL en producción.
- Publicación: rama local, todavía sin commit remoto ni PR.

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
cerrados. La implementación por bloques está autorizada; el bloque 1 está en
ejecución en `feat/rag-centralizado-modelo-estados`.

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

Rama técnica actual:

- contrato específico del bloque 1: verde;
- `npm run build`: verde;
- `npm run lint`: cero errores y el warning preexistente de `ScannerModal.tsx`;
- `npm test`: 115 de 116 archivos verdes; el único rojo es el gate esperado de
  expectativa móvil, porque la nueva migración todavía debe pasar por el replay
  descartable y registrar su fingerprint;
- `git diff --check`: verde;
- replay SQL real: pendiente; este entorno no dispone de Docker/Postgres local.

## Próximo paso ejecutable

1. Publicar el primer commit de la rama y regenerar la expectativa móvil en el
   Supabase descartable de CI.
2. Revisar el diff estructural, incorporar sólo los dos artefactos de expectativa
   y corregir cualquier incompatibilidad SQL que revele el replay.
3. Ejecutar suite completa, abrir el PR pequeño y esperar CI verde.
4. No aplicar SQL en producción dentro de este bloque.

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
