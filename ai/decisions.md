# Decisiones tecnicas

## Vite vs Next.js
**Decision:** Vite + React SPA
**Razon:** App mobile-first tipo PWA, no necesita SSR. Vite es mas rapido para desarrollo y el deploy en Netlify es trivial con SPA redirect.

## cod_art vs codigo_barras
**Decision:** Usar `cod_art` como identificador primario del producto
**Razon:** El codigo de barras puede no estar disponible para todos los productos. El `cod_art` es el identificador interno del negocio y siempre existe. El scanner usa codigo de barras como lookup secundario.

## Administración jerárquica transitoria desde Sucursal 091 — 2026-08-31

**Decisión:** La capacidad de administración jerárquica de la organización se concede transitoriamente únicamente a una cuenta que combine `admin_organizacion` con `gerente_sucursal` activo de la sucursal código `091`.

**Motivo:** La Sucursal 091 es el entorno productivo actual y esta combinación permite administrar la jerarquía sin convertir `admin_organizacion` en un superusuario operativo ni ampliar el alcance de lectura/escritura fuera de los roles propios de la cuenta.

**Condición de salida:** Antes de incorporar una organización que requiera un administrador jerárquico distinto de un gerente de sucursal `091`, o antes de delegar la administración jerárquica a otra cuenta, reemplazar el literal de sucursal por una capacidad explícita a nivel organización. La capacidad jerárquica no deberá ampliar el alcance operativo del usuario.

## Desafío 5S archivado en frío dentro del proyecto Supabase de NoVen — 2026-09-01

**Decisión:** Mientras no se justifique el costo de un proyecto Supabase independiente para Desafío 5S, sus objetos y datos se conservan íntegramente dentro del mismo proyecto físico que NoVen, pero fuera de la superficie operativa: schema privado `desafio5s_archive`, bucket `desafio5s-imagenes` privado y sin acceso de `PUBLIC`, `anon`, `authenticated` ni `service_role` al schema archivado.

**Motivo:** Desafío 5S estaba activo sobre el mismo Supabase y varias RPC `desafio5s_*` eran ejecutables por `anon`. Revocar esos permisos sin más rompía un flujo real. Crear ahora otro proyecto agrega un costo mensual que no se justifica mientras 5S permanece inactivo. El archivo en frío elimina la superficie pública de 5S en NoVen sin perder las 7 tablas, 18 funciones, 2 vistas, datos históricos ni archivos de Storage, y su restauración fue verificada mediante un round-trip transaccional.

**Dependencia conocida:** `desafio5s_es_admin()` depende de `public.rol_actual()` y, por esa vía, de `public.usuarios` de NoVen. Esa dependencia se conserva únicamente para permitir una restauración futura en el proyecto actual; no debe trasladarse a un proyecto 5S independiente.

**Condición de salida:** Antes de reactivar Desafío 5S para uso real, crear su proyecto Supabase independiente cuando el costo sea aceptado, restaurar allí estructura/datos/Storage, reemplazar `public.rol_actual()` por autorización propia de 5S, validar el flujo participante y administrador, y recién después retirar el archivo frío del proyecto de NoVen.

## Análisis gerencial limitado a roles de conducción — 2026-09-02

**Decisión:** `netlify/functions/analisis.ts` sólo se concede a `gerente_zonal` de la zona de la sucursal, y a `gerente_sucursal` o `supervisor` de esa sucursal exacta. El rol `operador` deja de generar análisis. `admin_organizacion` sigue sin habilitar por sí solo.

**Motivo:** el análisis es una capacidad de conducción, no de operación: compara el trimestre en curso contra la ventana equivalente previa y prioriza dónde interviene la gestión. El operador trabaja sobre su propia bandeja de familias, donde el Dashboard y Vencimientos ya le dan lo que necesita para actuar.

Como efecto secundario deseado, reduce la población que puede disparar costo en el proveedor de inferencia y enviarle datos operativos. No lo reemplaza: sigue haciendo falta el límite por actor del ítem C2/C3, porque una sola cuenta de conducción alcanza para consumir sin techo.

**Consecuencia:** desaparece el ámbito parcial por familias dentro del análisis. Con un único ámbito posible —toda la sucursal— se eliminan el filtrado por `usuario_familias_sucursal`, la variante `SYSTEM_OPERADOR` del prompt y la bifurcación `scopeCompleto`. Queda un solo system prompt, lo que además simplifica la evaluación de guardarraíles del ítem 1.5.

**Condición de salida:** si en el futuro un perfil operativo necesita análisis de su propio ámbito, no reintroducir la bifurcación dentro de este endpoint. Debe ser una capacidad separada, con su propio prompt y su propio alcance declarado.

## Expectativa móvil del replay y pérdida diferida del ancla — 2026-09-02

**Decisión:** el gate de replay pasa de comparar contra una foto estática del catálogo productivo a comparar contra una expectativa móvil, atada por hash al conjunto exacto de migraciones posteriores al cutoff. `expected-fingerprint.json` se conserva como ancla de producción y sólo se re-materializa de forma explícita y periódica.

**Motivo:** el gate anterior sólo podía estar verde con el schema congelado. El replay aplica baseline más migraciones posteriores, pero comparaba contra una foto que sólo contenía el baseline; la primera migración nueva —cualquiera— lo rompía por diseño, no por deriva.

La alternativa obvia, regenerar el ancla desde la base replicada, era peor que el problema: la convertía en «lo que produjo el replay» en vez de «lo que hay en producción», dejando el gate verde y sin capacidad de detectar deriva.

**Qué se cede:** el gate deja de responder, en cada corrida, si el repositorio reconstruye lo que hay en producción. Pasa a verificar reproducibilidad y cambio declarado. El ancla se mantiene viva únicamente por la re-materialización periódica.

**Cuándo se cede, que es lo que hace aceptable el intercambio:** hoy no se cede nada. Con cero migraciones posteriores al cutoff el verificador exige que la expectativa móvil sea idéntica al ancla, así que el gate sigue respondiendo la pregunta completa. La pérdida se materializa recién con la primera migración —la del contador de cuota y caché de `analisis.ts`— y llega en el mismo momento en que se cobra el beneficio: la protección de un endpoint que hoy permite costo ilimitado en un tercero y salida de datos operativos sin techo.

No es «aceptamos perder el ancla», es «la perdemos cuando ganamos otra cosa a cambio», y ambas cosas ocurren en el mismo PR y quedan visibles en el mismo diff.

**Condición de salida:** scriptar la extracción de los fragmentos desde el catálogo productivo. Hoy es el único paso manual del procedimiento y es justamente el que sostiene el ancla: cuanto más caro es el camino legítimo, más tentador es mover la fecha del tripwire y seguir. Debería resolverse antes de la primera re-materialización real.

## OpenAI como proveedor del análisis gerencial — 2026-09-03

**Decisión:** `netlify/functions/analisis.ts` usa OpenAI con el modelo `gpt-5.6-terra` mediante Chat Completions en `https://api.openai.com/v1/chat/completions`. La credencial server-only es `OPENAI_API_KEY`; la solicitud fija `store=false`, `reasoning_effort=none`, `temperature=0.2` y `max_completion_tokens=1500`. No existe fallback automático a DeepSeek ni a ningún otro proveedor.

**Responsable de la decisión:** el responsable del producto eligió OpenAI explícitamente el 2026-09-03. La comparación inicialmente prevista contra Fireworks y Anthropic se canceló antes de ejecutar llamadas pagas; no se fabrican resultados comparativos. El corpus sintético determinístico permanece como gate de aceptación del proveedor elegido.

**Motivo:** Chat Completions conserva el contrato que ya consumía la Function —mensajes `system`/`user` y respuesta `choices[0].message.content`—, por lo que el cambio de proveedor no exige reescribir el prompt, la lógica económica, la cuota por actor, el caché ni el frontend. `gpt-5.6-terra` cubre el rol de análisis gerencial con un equilibrio explícito entre capacidad y costo.

**Jurisdicción — corregido el 2026-09-04:** la primera versión de este registro afirmaba que «el endpoint regional fija procesamiento y almacenamiento en Estados Unidos», y se apoyaba en `https://us.api.openai.com`. Era incorrecto por dos motivos distintos, y ambos importan.

El primero es de hecho: **el proyecto no es elegible para residencia regional.** Figura como «Global» en la consola y el campo no es editable — la residencia de datos es una función de cuentas empresariales. La llamada al endpoint regional nunca funcionó: devolvía `HTTP 401 · incorrect_hostname`, y eso se descubrió recién al correr el corpus contra la API real, porque hasta entonces faltaba la credencial. La afirmación estuvo escrita durante un día sin que nada la hubiera ejercido.

El segundo es conceptual, y sobrevive a la corrección del primero: **residencia de almacenamiento no implica residencia de procesamiento.** Aun con el endpoint regional disponible, la garantía habría sido sobre dónde se almacenan los datos en reposo, no sobre dónde corre la inferencia. El registro original confundía las dos cosas.

Lo que efectivamente se sostiene hoy: **OpenAI procesa las peticiones de la API en Estados Unidos por defecto**, y Chat Completions se atiende en centros de datos estadounidenses. Lo que NO se tiene es la garantía contractual de almacenamiento en reposo dentro de la región, que es lo que el endpoint regional habría aportado.

**Por qué esto igual cumple el objetivo de 1.5.** El ítem existe para sacar los datos operativos de una jurisdicción sin control verificable de retención — ese era el riesgo D-6, con DeepSeek. Ese objetivo se cumple: se pasa de un proveedor sobre el que no había decisión registrada, ni política de retención evaluada, ni jurisdicción conocida, a uno con retención publicada, `store=false` explícito y procesamiento en EE.UU. por defecto. La garantía es más débil que la que se creyó tener el 03-09, pero es una garantía real y auditable, y es estrictamente mejor que el punto de partida. Queda registrada como más débil justamente para que nadie la cite después como si fuera residencia contratada.

**Límites:** `store=false` desactiva el almacenamiento voluntario de la respuesta para productos de distillation/evals, pero no equivale por sí solo a Zero Data Retention. Bajo la política estándar pueden existir logs de abuso por hasta 30 días; ZDR requiere aprobación de OpenAI. No hay residencia de datos contratada. Esta es una decisión técnica documentada, no una conclusión legal sobre transferencias internacionales desde Argentina.

**Despliegue:** configurar `OPENAI_API_KEY` en Netlify antes del merge. Sin la variable, `analisis.ts` falla cerrado con error de configuración y la capacidad queda indisponible. Antes del cutover deben pasar los tres casos del corpus sintético contra la API real; después del deploy se realiza un smoke controlado y recién entonces se revoca la credencial anterior de DeepSeek.

**Condición de salida:** reevaluar proveedor o modelo si el corpus detecta una regresión de guardarraíles, si la cuenta pasa a ser elegible para residencia de datos regional —en cuyo caso corresponde contratarla y volver al endpoint regional—, si cambia la retención publicada, el costo/latencia deja de ser compatible con la operación, o aparece un requisito legal que la configuración actual no cubra. Cualquier reemplazo repite evaluación sintética, decisión explícita y despliegue sin fallback silencioso.

## Migración de `desafio5s_*` a proyecto propio diferida — 2026-09-04

**Decisión:** el ítem 2.6 del plan de endurecimiento —mover las nueve relaciones de `desafio5s_archive` y el bucket `desafio5s-imagenes` a un proyecto Supabase independiente— **no se ejecuta por ahora.** El archivo frío del 2026-09-01 se conserva como estado estable, no como paso intermedio con fecha.

**Motivo:** el archivo en frío ya absorbió el riesgo principal. Las RPC `desafio5s_*` dejaron de ser ejecutables por `anon`, el schema quedó fuera de `public` y el bucket dejó de ser público. Lo que resta es riesgo de convivencia —instancia, backups y cuota compartidos con NoVen—, no superficie alcanzable desde afuera.

Contra eso, mover datos productivos a un proyecto nuevo tiene costo real: un proyecto pago adicional, la migración de estructura, datos y Storage, el corte de la dependencia hacia `public.usuarios` y una ventana de verificación sobre un módulo que hoy nadie usa. Es el único ítem de Fase 2 con riesgo sobre datos, y el riesgo residual que elimina no lo justifica hoy.

**Dependencia conocida que queda viva:** `desafio5s_es_admin()` depende de `public.rol_actual()` y, por esa vía, de `public.usuarios`. Mientras 2.6 siga diferido, esa dependencia atraviesa la frontera entre un módulo archivado y el núcleo activo de NoVen. **Un refactor de `public.rol_actual()` o de `public.usuarios` rompe en silencio a `desafio5s_es_admin()`:** nada la ejecuta, ningún test la cubre y ningún flujo falla, así que la rotura no se descubre hasta el día de la restauración. Quien toque cualquiera de las dos tiene que verificar `desafio5s_archive` explícitamente, o cortar la dependencia en ese mismo cambio.

**Condición de salida:** ejecutar 2.6 ante **cualquiera** de estos tres hechos, sin esperar a los otros dos.

1. **Entra una segunda organización comercial.** Deja de ser aceptable que datos de un producto discontinuado compartan instancia y backups con los datos operativos de un cliente que no los eligió.
2. **Alguien de sistemas de un cliente audita la base.** `desafio5s_archive` es defendible pero exige explicación; un auditor externo encuentra primero el schema ajeno y después el motivo.
3. **Desafío 5S vuelve a estar activo.** Es la condición ya registrada el 2026-09-01, y se conserva sin cambios: reactivar sobre el proyecto de NoVen no es una opción.

Hasta que ocurra alguno, esto es una decisión tomada y no un pendiente. Si se revisa, se revisa por uno de esos tres hechos, no por acumulación de tiempo.
