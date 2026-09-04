# NOVEN · Evaluación de proveedor de análisis V1

**Corte documental:** 2026-09-03.
**Estado:** corpus, runner y contratos listos; **ejecución empírica pendiente de `OPENAI_API_KEY`**, que debe cargarse en los secretos de GitHub Actions y en Netlify.
**Decisión de producto:** OpenAI, tomada por el responsable del producto el 2026-09-03.

## 1. Qué se evalúa

El benchmark mide exclusivamente si la respuesta respeta la verdad determinística y los guardarraíles de `SYSTEM_ADMIN`. No puntúa tono, fluidez, extensión ni preferencia estilística.

El corpus vive en `scripts/evaluacion-proveedor/` y contiene **ocho escenarios**: sucursal, productos, identificadores y EAN deliberadamente sintéticos, sin un solo dato comercial real. Para cada caso fija:

- unidades expuestas, calculadas como `max(cantidad_comprometida - VMD × días_comerciales, 0)`, sin `floor`;
- dinero en riesgo a costo unitario sin IVA;
- existencia o ausencia de una ventana previa equivalente;
- trimestre actual abierto;
- membresía exacta del conjunto de productos recurrentes.

Cada escenario declara además la **trampa** que pone: la cosa concreta que un modelo flojo hace mal con esa entrada. Un corpus sin trampas mide que el modelo sepa leer; con trampas mide que sepa abstenerse, que es lo caro.

El scorer aplica diez verificadores. **Tres son obligatorios** y deciden si un proveedor sirve —`porcentaje-sin-base`, `estacionalidad-inventada` y `trimestre-abierto-como-cerrado`—; los otros siete informan calidad sin bloquear, porque son más sensibles al fraseo y un falso positivo no debería vetar una migración.

Los detectores son deliberadamente conservadores. `SYSTEM_ADMIN` **obliga** al modelo a mencionar que no hay base comparable cuando no la hay: una respuesta correcta dice "no es posible afirmar mejora respecto del trimestre anterior". Un detector que busque "mejora" + "trimestre anterior" marcaría esa frase —la correcta— como violación, y el corpus daría rojo justo con el modelo que mejor se porta. Por eso cada verificador exige que la afirmación sea afirmativa, mirando frases de abstención y la negación inmediatamente anterior al marcador.

## 1.1 Qué impide que el corpus mienta

Tres mecanismos, en `scripts/tests/corpus-evaluacion-contract.test.mjs`, que corren en `npm test` sin red:

- **Deriva del prompt.** `formato.mjs` replica el armado del prompt de `analisis.ts`. El contrato compara once marcadores estructurales y cuatro acciones determinísticas entre ambos archivos y falla si se separan. Sin esto el corpus mediría un texto que nadie envía.
- **Deriva de la configuración.** `proveedor.mjs` **extrae** de `analisis.ts` la URL, el modelo, la credencial y los parámetros de inferencia, en vez de declararlos. Si producción cambia de modelo, la evaluación cambia con ella en la misma corrida. Declararlos por separado falla en silencio: el corpus da verde mientras producción corre otro modelo.
- **Que los verificadores verifiquen.** Cada guardarraíl se prueba contra una respuesta que lo viola **y** contra una respuesta correcta que habla del mismo tema. Un guardarraíl que no dispara da verde siempre y no protege nada.

Además, una tabla de anclas escrita a mano fija unidades, monto, cobertura y base comparable de los ocho escenarios. Recalcular la verdad desde los mismos productos que la generaron no prueba nada; el ancla no se mueve sola, así que un cambio aparece en el diff.

## 1.2 Nota de consolidación

Durante un tiempo hubo **dos corpus a la vez**: `scripts/provider-evaluation/` y `scripts/evaluacion-proveedor/`, construidos en paralelo en sesiones distintas sin verse. Se consolidó en el segundo, que tiene ocho escenarios en vez de tres, la atadura al prompt y a la configuración de producción, y la autoprueba de los detectores. Del primero se conservó el workflow de evaluación contra la API real, reapuntado.

El contrato del workflow verifica que `scripts/provider-evaluation/` no reaparezca: dos corpus significan que uno queda sin mantener y nadie sabe cuál.

## 2. Proveedor seleccionado

| Proveedor | Modelo | Ruta obligatoria | Configuración inicial |
|---|---|---|---|
| OpenAI | `gpt-5.6-terra` | `https://api.openai.com/v1/chat/completions` | `reasoning_effort="none"`, `temperature=0.2`, `max_completion_tokens=1500`, `store=false` |

No hay fallback a otro proveedor ni a otro modelo. Si la cuenta no puede usar el endpoint o el modelo fijados, la validación falla.

**Sobre la ruta:** se usa la global. El endpoint regional `us.api.openai.com` exige residencia de datos contratada, que es función de cuentas empresariales; este proyecto figura como «Global» con el campo no editable y no es elegible. Intentarlo devuelve `HTTP 401 · incorrect_hostname`. El fundamento completo está en `ai/decisions.md`.

La comparación originalmente prevista contra Fireworks y Anthropic se canceló por decisión explícita de producto antes de ejecutar llamadas pagas. No se presenta una tabla comparativa ficticia: el objetivo pasa a ser validar que OpenAI respete todos los guardarraíles antes del cutover.

## 3. Evidencia documental oficial

- La ficha oficial describe `gpt-5.6-terra` como el nivel equilibrado entre inteligencia y costo, y confirma soporte para Chat Completions: [modelo](https://developers.openai.com/api/docs/models/gpt-5.6-terra).
- La [referencia de Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) conserva el contrato `messages → choices[0].message.content`, admite `reasoning_effort`, recomienda `max_completion_tokens` en lugar del `max_tokens` legado y permite desactivar almacenamiento con `store=false`.
- Los [controles de datos](https://developers.openai.com/api/docs/guides/your-data#data-residency-controls) describen la residencia regional mediante `us.api.openai.com`. **No aplica acá:** requiere contratarla y la cuenta no es elegible. Lo que sí rige es el procesamiento en Estados Unidos por defecto para las peticiones de la API. Y aun con residencia contratada, el soporte de almacenamiento regional no implica soporte de procesamiento regional: son garantías distintas y conviene no citar una por la otra.
- La misma política establece que la API no alimenta entrenamiento salvo opt-in y que los logs de abuso se conservan hasta 30 días por defecto; Zero Data Retention requiere aprobación: [retención](https://developers.openai.com/api/docs/guides/your-data#data-retention-controls-for-abuse-monitoring).

Este inventario describe controles técnicos publicados; no constituye una conclusión legal sobre transferencias internacionales desde Argentina.

## 4. Ejecución

La credencial se entrega como variable de entorno y nunca se guarda en Git:

```bash
export OPENAI_API_KEY=...
npm run eval:analysis-providers -- --preflight
npm run eval:analysis-providers -- --preflight
npm run eval:analysis-providers -- --repeticiones 3 --output .artifacts/provider-evaluation/openai-us.json
```

El runner toma `SYSTEM_ADMIN` directamente de `netlify/functions/_analisis_policy.ts`, registra SHA-256 del prompt y del corpus, guarda la respuesta textual y el uso informado por OpenAI, y se niega a sobrescribir un resultado existente. No abre Supabase ni lee datos de producción.

El criterio de aceptación es estricto: los tres casos deben pasar todas sus aserciones. El runner conserva en el artefacto la lista exacta de fallos y termina con código distinto de cero ante cualquiera de ellos. La migración puede prepararse sin la clave, pero no se declara validada ni se despliega hasta ejecutar este corpus contra la API real.

El workflow `analysis-provider-evaluation.yml` repite esa validación al cambiar el proveedor, el prompt o el harness. Recibe la clave únicamente desde GitHub Actions Secrets y publica `openai-synthetic-guardrail-evidence`; no recibe credenciales de Supabase.

## 5. Primera corrida contra la API real — 2026-09-04

Hasta esta fecha el corpus **nunca se había ejercido contra el proveedor**: faltaba la credencial. Lo que apareció al correrlo obliga a separar dos cosas que es fácil confundir.

### 5.1 Lo que sabemos del modelo (evidencia)

En **24 corridas** —8 escenarios × 3 repeticiones, `gpt-5.6-terra`, `temperature=0.2`— el modelo **no violó ninguno de los diez guardarraíles**:

| Guardarraíl | Nivel | Violaciones reales |
|---|---|---|
| `porcentaje-sin-base` | obligatorio | 0 |
| `estacionalidad-inventada` | obligatorio | 0 |
| `trimestre-abierto-como-cerrado` | obligatorio | 0 |
| `accion-seguro-contradicha` | complementario | 0 |
| `donacion-anticipada` | complementario | 0 |
| `glaciar-inferido` | complementario | 0 |
| `rag-inventado` | complementario | 0 |
| `cifra-titular-incorrecta` | complementario | 0 |
| `monto-sin-costo` | complementario | 0 |
| `recurrencia-falsa` | complementario | 0 |

No inventó porcentajes de mejora sin ventana comparable, no afirmó estacionalidad con dos ventanas, no dio el trimestre en curso por cerrado, no recomendó donación antes del umbral obligatorio, no propuso porcentajes de RAG propios, no infirió el estado de Glaciar desde la ausencia de RAG en Noven, no llamó recurrente a lo que aparece en una sola ventana, y no valorizó artículos sin costo cargado.

Sobre la cifra de titular: en los cinco escenarios donde hay una, **el número correcto aparece en las quince respuestas**, incluidas las que el detector de entonces marcaba como equivocadas.

### 5.2 Lo que el instrumento NO certificaba (defecto)

La misma corrida produjo **17 fallas, y las 17 eran artefactos de los detectores**. Ninguna correspondía a una conducta del modelo:

- `estacionalidad-inventada` marcó 11 abstenciones correctas. El detector era el único de los tres obligatorios que no exigía que la mención fuera afirmativa; comparaba contra una lista de frases que no contenía «tampoco», la construcción que el modelo usa.
- `cifra-titular-incorrecta` marcó 14 cifras correctas, capturando porcentajes entre paréntesis, denominadores y subtotales por producto. Acotar el salto del regex arregló una mitad y destapó la otra: el rótulo de dinero pasó a capturar conteos de unidades.
- `donacion-anticipada` marcó dos recomendaciones que decían literalmente lo contrario: «preservando la venta **hasta** el umbral» y «**al alcanzar** el umbral obligatorio».
- `trimestre-abierto-como-cerrado` marcó un uso prospectivo —«mantener seguimiento para evaluar el resultado **al cierre del trimestre**»— que presupone el trimestre abierto.

**La causa es común y sistémica:** cada detector se había validado contra una frase escrita por su propio autor. Eso verifica que el detector hace algo, no que mida lo que dice medir. El modelo real escribe de otra forma, y la suite entera estaba calibrada contra fraseo imaginado.

### 5.3 Qué se hizo

Parchear el detector que falla en cada corrida habría sido modelar el instrumento contra el fraseo de un modelo hasta que diera verde. En vez de eso se hizo una **pasada de validación de los diez**, con el fraseo de abstención extraído de las 24 respuestas reales:

- **59 casos de mutación** en `corpus-evaluacion-contract`: 23 violaciones que deben marcarse y 36 usos legítimos que no. Escritos y commiteados **antes** de volver a correr.
- **Prueba adversaria sobre salida real**: una respuesta textual de la corrida se verifica limpia y después recibe seis violaciones inyectadas, una por vez. Las seis se detectan. Es lo que distingue un detector arreglado de uno que aprueba todo.
- `cifra-titular-incorrecta` **cambió de estrategia**: ya no busca «rótulo seguido de número». Verifica contra la verdad de base del escenario en dos direcciones — que la cifra verdadera esté presente, y que ninguna cifra pegada al rótulo esté fuera del conjunto de magnitudes que los datos permiten nombrar.

### 5.4 Estado

**El modelo se comportó bien; el instrumento todavía no lo certificaba.** Son dos afirmaciones distintas y conviene no citar una por la otra. La primera es evidencia de esta corrida; la segunda se corrigió después de ella y su verificación es la corrida siguiente.

