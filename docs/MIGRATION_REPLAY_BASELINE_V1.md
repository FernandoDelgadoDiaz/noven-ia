# NOVEN · MIGRATION REPLAY BASELINE V1

Estado: contrato 1.4B aprobado y Baseline V1 materializada y verificada en hardening 1.4C. El replay en Supabase local descartable con PostgreSQL 17 produjo el fingerprint canónico esperado y cero diferencias estructurales.

## 1. Problema demostrado

El historial de migraciones de producción no es, por sí solo, un instalador universal de NoVen desde una base vacía.

La suite live 1.1 lo demostró en dos capas distintas:

1. `20260827000290_post_cutover_security_v1.sql` presupone `public.handle_updated_at()`, un objeto legacy que existió en producción antes de la cadena Git y cuyo `CREATE` no está versionado. 1.4A formalizó únicamente esa precondición mediante un shim efímero y protegido.
2. Al superar ese punto, `20260828000020_access_invitations_v1.sql` aborta una base vacía porque exige exactamente un `gerente_sucursal` activo de la sucursal `091`.

El inventario adicional confirma que el problema no termina allí:

- producción registró `prod_20260828000021_remove_unapproved_admin_bootstrap_v1`, una corrección del bootstrap 091 que no tiene una migración homónima en Git;
- `20260828000040_explicit_admin_org_and_local_role_hardening_v1.sql` exige una identidad Auth concreta (`gerente091@gmail.com`) y un acceso de gerente activo en 091;
- `20260830163500_reconciliar_tableta_bonobon_3449476.sql` es una reparación de datos productivos concreta y aborta si no existen los SKU, EAN y costo observados en ese incidente.

Por lo tanto, seguir agregando usuarios, productos o costos ficticios para satisfacer esas precondiciones no reconstruiría NoVen: reconstruiría accidentalmente episodios históricos de una producción específica.

## 2. Decisión

A partir de 1.4B se distinguen dos conceptos:

**Historial productivo:** registro inmutable de cómo llegó la producción actual a su estado. Puede contener bootstraps, correcciones, reparaciones de datos y dependencias de estado que sólo tenían sentido en el momento en que fueron aplicadas.

**Instalación reproducible:** mecanismo para crear un entorno nuevo, local, CI o futuro tenant/instalación técnica, sin necesitar usuarios, productos, costos ni incidentes históricos de producción.

El historial productivo no se modifica para convertirlo retroactivamente en un instalador universal.

La estrategia para entornos nuevos será:

`baseline de esquema verificada -> migraciones posteriores a la baseline`

No será:

`historial completo + datos ficticios hasta que deje de fallar`.

## 3. Qué es la baseline

La baseline V1 es un artefacto SQL de **esquema NoVen core**, ensamblado de forma determinística a partir del catálogo productivo leído sin DDL ni DML.

Debe incluir el estado estructural vigente necesario para NoVen:

- schemas operativos;
- tablas y columnas;
- claves, constraints e índices;
- vistas;
- funciones y procedimientos;
- triggers;
- RLS y policies;
- grants/revokes relevantes;
- extensiones y objetos auxiliares necesarios para ejecutar el producto.

No debe incluir:

- usuarios de Auth;
- perfiles o accesos reales;
- productos, stock, vencimientos, costos ni otra fila de negocio;
- objetos de Storage;
- secretos/Vault;
- cron/jobs o credenciales que deban provisionarse por infraestructura, salvo que el contrato de esquema requiera explícitamente su definición no secreta;
- datos archivados de Desafío 5S.

`desafio5s_archive` es estado legado preservado en producción, no una dependencia del cerebro de NoVen. La baseline core no debe necesitar recrear el Desafío 5S para después archivarlo.

## 4. Cutoff

El cutoff de repositorio para Baseline V1 es:

`20260901103500_desafio5s_cold_archive_v1.sql`

La baseline representa el esquema NoVen core observado en `master` `da958b6851adaa42b13fa0774dbebf36f43eb77e`, excluyendo el estado archivado 5S indicado arriba.

Este cutoff es un contrato de replay para entornos nuevos. **No renumera, borra ni reescribe ninguna migración ya aplicada en producción.**

La baseline no se agregará a `supabase/migrations/` como si fuera una nueva migración productiva. Se mantendrá en un espacio separado para bootstrap de entornos nuevos y CI.

## 5. Ejecución del replay

`scripts/migration-replay/run-baseline-replay.sh` construye un workspace descartable con:

1. una única migración baseline V1;
2. sólo las migraciones de producto posteriores al cutoff declarado;
3. fixtures de tests creados después de completar el esquema, nunca antes para satisfacer migraciones históricas.

De este modo Supabase no intenta ejecutar sobre una base vacía las migraciones históricas clasificadas como no universales.

El runner exige `NOVEN_EPHEMERAL_REPLAY=1`, PostgreSQL 17 y un directorio de migraciones inicialmente vacío. Nunca inserta filas directamente en `supabase_migrations.schema_migrations` para fingir que el historial fue aplicado.

## 6. Contrato del manifest

`scripts/migration-replay/history-manifest.json` es la lista versionada de excepciones conocidas.

Categorías iniciales:

- `legacy_schema_precondition`: dependencia estructural legacy ausente del historial Git;
- `production_state_bootstrap`: bootstrap que exige filas productivas preexistentes;
- `production_ledger_only_correction`: migración registrada en producción sin contraparte homónima en Git;
- `production_identity_bootstrap`: decisión ligada a una identidad Auth concreta;
- `production_business_data_repair`: reparación de un incidente/registro de negocio específico.

Una migración clasificada allí no puede volver a etiquetarse como `universal_replay` para obtener CI verde sin una decisión explícita.

## 7. Verificación obligatoria de Baseline V1

Antes de que la baseline pueda desbloquear 1.1 deberá probarse en una base descartable y compararse contra producción a nivel estructural.

La comparación mínima abarcará:

- tablas/columnas/tipos/defaults;
- constraints/FK;
- índices;
- vistas;
- funciones: firma, seguridad y `search_path`;
- triggers;
- RLS/policies;
- grants/revokes;
- schemas operativos.

Las diferencias deliberadas deben quedar enumeradas. La exclusión de `desafio5s_archive` será una diferencia conocida y documentada, no una sorpresa.

No se copiarán filas productivas para hacer coincidir los dos entornos.

La verificación se completó en el paso `Validate materialized baseline on disposable Supabase` del run `Noven CI #335`. El resultado fue:

- 31 tablas y 384 columnas;
- 226 constraints y 128 índices;
- 112 funciones y 12 views;
- 29 triggers, RLS en 31 tablas y 17 policies;
- fingerprint SHA-256 `837771691ffc6e2276c66a26f9ae010c872f12ea33b118406d48b2ad6fca38af`;
- cero diferencias estructurales.

El fallo posterior de ese run pertenecía a un E2E dependiente de la fecha real y fue aislado y corregido en el PR #130; no afectó el replay ni el diff estructural.

## 8. Relación con 1.1

El PR de 1.1 permanece en draft hasta completar sus propios Gates 1–3, pero la dependencia de reproducibilidad queda resuelta.

1.1 no debe seguir agregando shims o fixtures para atravesar migraciones históricas. Debe retomarse usando la Baseline V1 verificada y las migraciones posteriores al cutoff.

Recién entonces se crearán los fixtures ORG_A / ORG_B y usuarios de prueba mediante Auth local para ejecutar Gates 1–3 con JWT reales.

## 9. Relación con producción

1.4B y 1.4C son exclusivamente de reproducibilidad, clasificación y verificación estructural.

No realiza DDL ni DML en producción. No modifica el ledger remoto. No edita migraciones aplicadas. No cambia datos de negocio ni comportamiento productivo.

## 10. Materialización 1.4C

Los fragmentos verificados viven en `scripts/migration-replay/baseline-v1/`. El assembler comprueba primero el Git blob SHA de cada fragmento y luego genera una sola migración temporal fuera de `supabase/migrations/`.

Inventario materializado:

- 31 tablas y 384 columnas;
- 226 constraints y 128 índices standalone;
- 112 funciones;
- 12 views en orden topológico, todas con `security_invoker=true`;
- 29 triggers;
- RLS en las 31 tablas y 17 policies;
- ACL explícitos de schemas, relaciones, secuencias identity y funciones;
- 6 identity columns creadas por `GENERATED BY DEFAULT AS IDENTITY`, sin precrear sus secuencias.

El SQL ensamblado tiene 39 fragmentos, 355.807 bytes y SHA-256 `334a0b7555185f07f83f7342bce442f5079fe9b42cf9d5fc1a4622db7bb72abf`. El assembler conserva intactos los blobs canónicos de funciones y agrega sus 112 terminadores de sentencia al generar la migration ejecutable.

## 11. Fingerprint y diferencias permitidas

El fingerprint canónico V1 incluye tablas, columnas, identity, constraints, índices, funciones, views, triggers, RLS, policies y ACL. El fingerprint productivo materializado por esta versión del canonicalizer tiene SHA-256:

`837771691ffc6e2276c66a26f9ae010c872f12ea33b118406d48b2ad6fca38af`

La huella productiva anterior `2cdba36ae58117100c8d0c8f9ddf235beeb8eaa372c90d9c777c43a991ad2020` se conserva como evidencia legacy. No es comparable byte a byte con la huella V1 porque pertenecía a otra representación cuyo canonicalizer completo no quedó materializado. Esto es una diferencia de representación, no una diferencia aceptada de schema.

El comparador actual evalúa el JSON estructural objeto por objeto y exige cero diferencias no explicadas. Las exclusiones permitidas están enumeradas en `exclusions-manifest.json`; no incluyen excepciones genéricas ni una tolerancia para obtener CI verde.

## 12. Evidencia externa al core SQL

El inventario conserva, sin copiar datos ni secretos:

- bucket `productos-imagenes`;
- cron `recalcular-niveles-vencimientos`, schedule `0 12 * * *`;
- nombre Vault `noven_push_webhook_secret`.

Estos objetos quedan como evidencia de infraestructura y no forman parte del baseline SQL core.

## 13. Incidente de transporte resuelto

El blob incorrecto `5108d740b95207d0cc047e1cce730ca4824573b7` de `v_problemas_economicos_historial` no provenía de normalización de base64. Sus bytes contenían una definición anterior (`resultado_at` en lugar de `resuelto_at`) y omitían un salto de línea del SQL productivo actual.

La remediación fue regenerar cada view directamente desde el catálogo productivo, calcular el Git blob SHA sobre esos mismos bytes y aceptar el blob sólo si GitHub devolvía exactamente la huella esperada. Los blobs huérfanos con mismatch permanecen fuera de todo tree.

## 14. Expectativa móvil y re-materialización del ancla

### 14.1 El problema que resolvió

La versión 1.4C comparaba el resultado del replay contra `expected-fingerprint.json`, una foto estática del catálogo productivo, con tolerancia cero.

El replay aplica **baseline + migraciones posteriores al cutoff** (`baseline-workspace.mjs`), pero la foto contenía únicamente el baseline. Mientras no existió ninguna migración posterior, ambas coincidían y CI estuvo verde. La primera migración nueva —cualquiera— habría hecho fallar el gate por diseño, no por deriva.

Dicho de otro modo: el gate sólo podía estar verde con el schema congelado.

### 14.2 Qué se hizo

La expectativa se volvió móvil. `expected-replay-fingerprint.json` es la huella esperada del conjunto que el replay aplica hoy, y `replay-expectation.json` la ata a ese conjunto exacto mediante el hash de los nombres **y el contenido** de las migraciones posteriores.

Consecuencias:

- agregar o editar una migración posterior sin regenerar la expectativa hace fallar el gate con instrucciones;
- regenerarla produce un diff en el PR que muestra exactamente qué cambio estructural introduce la migración, que es lo que hay que revisar;
- la regeneración (`run-baseline-replay.sh --regenerate`) exige `NOVEN_EPHEMERAL_REPLAY=1` y **nunca escribe sobre `expected-fingerprint.json`**.

### 14.3 Qué se perdió

**El gate dejó de responder, en cada corrida, la pregunta que originó el ítem 1.4: ¿el repositorio sigue reconstruyendo lo que hay en producción?**

Con expectativa móvil, el gate verifica **reproducibilidad** —el mismo input produce el mismo output— y **cambio declarado** —ninguna migración altera la estructura sin que alguien lo registre. Ambas cosas son valiosas y se sostienen indefinidamente. Ninguna es un ancla contra producción.

La única excepción es el caso de cero migraciones posteriores: ahí el verificador exige que la expectativa móvil sea idéntica al ancla, de modo que el replay sí reconstruye producción. Es el estado del repositorio hoy, y dejará de serlo con la primera migración.

Regenerar `expected-fingerprint.json` desde la base replicada **no es una alternativa**: lo convertiría en "lo que produjo el replay" en lugar de "lo que hay en producción", el gate quedaría verde y perdería su capacidad de detectar deriva, en silencio.

### 14.4 Re-materialización del ancla

Es lo único que mantiene vivo el ancla contra producción. **Es explícita y periódica. Nunca automática:** un ancla que se refresca sola dentro de la corrida no ancla nada.

**Cuándo.** Como máximo cada `anchor_revalidacion_maxima_dias` (hoy 180), declarado en `replay-expectation.json`. Además, siempre que se sospeche deriva: un cambio aplicado a producción fuera del flujo de migraciones, o una discrepancia entre el ledger productivo y `supabase/migrations`.

**Quién.** El responsable del repositorio. Requiere acceso de lectura al catálogo productivo, que una sesión automatizada no tiene y no debe tener.

**Cómo.** El procedimiento es el de la materialización original (§10, PR #129): se extraen los 39 fragmentos desde el catálogo productivo, se actualiza `artifact-manifest.json` con el git blob SHA de cada uno, se re-arma la baseline, se verifica en una base descartable, y se actualizan `expected-fingerprint.json`, su SHA en `fingerprint-metadata.json` y el cutoff. Después se regenera la expectativa móvil, que vuelve a partir del ancla nueva.

**Cuánto lleva, y dónde está el punto débil.** El armado, la verificación y la regeneración están scriptados (`run-baseline-replay.sh`, `--regenerate`) y son minutos de CI. **La extracción de los fragmentos desde el catálogo productivo no está scriptada:** se hizo a mano en el PR #129 y es el grueso del trabajo.

Eso convierte al paso menos automatizado del mecanismo en el único que mantiene vivo el ancla, que es una mala combinación conocida: cuanto más caro es el camino legítimo, más tentador es mover la fecha y seguir. Scriptar la extracción es la mejora de mayor valor pendiente sobre este mecanismo, y debería hacerse antes de la primera re-materialización real, no después.

**Qué se rompe si nadie lo hace.** El gate sigue verde indefinidamente, porque reproducibilidad y cambio declarado se siguen cumpliendo. Lo que se degrada en silencio es la correspondencia con producción: un cambio aplicado a mano sobre producción —un `ALTER` de emergencia, un índice agregado desde el dashboard— no aparece en ninguna migración, no altera la expectativa móvil y **no lo detecta nadie**. El repositorio deja de describir producción y el primer síntoma llega cuando haya que reconstruir un entorno.

Por eso `migration-replay-moving-expectation.test.mjs` incluye un tripwire: si el ancla supera los días declarados, la suite falla y nombra el procedimiento. Mover la fecha sin re-materializar deja el gate verde y sin ancla — es exactamente el modo de falla que el tripwire existe para evitar, y está dicho en el mensaje de error.
