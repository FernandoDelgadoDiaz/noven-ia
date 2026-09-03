# NOVEN · Evaluación de proveedor de análisis V1

**Corte documental:** 2026-09-03.
**Estado:** corpus, runner y contratos listos; ejecución empírica pendiente de `OPENAI_API_KEY`.
**Decisión de producto:** OpenAI, tomada por el responsable del producto el 2026-09-03.

## 1. Qué se evalúa

El benchmark mide exclusivamente si la respuesta respeta la verdad determinística y los guardarraíles de `SYSTEM_ADMIN`. No puntúa tono, fluidez, extensión ni preferencia estilística.

El corpus `scripts/provider-evaluation/corpus-v1.json` contiene tres sucursales, productos, identificadores y EAN deliberadamente sintéticos. Para cada caso fija:

- unidades expuestas, calculadas como `max(cantidad_comprometida - VMD × días_comerciales, 0)`, sin `floor`;
- dinero en riesgo a costo unitario sin IVA;
- existencia o ausencia de una ventana previa equivalente;
- trimestre actual abierto;
- membresía exacta del conjunto de productos recurrentes.

El scorer produce evidencia por aserción y cinco dimensiones: fidelidad económica, comparabilidad, trimestre abierto, estacionalidad y recurrencia. La validación falla si el modelo inventa una mejora sin base comparable, cierra el trimestre abierto, afirma estacionalidad con dos ventanas o llama recurrente a un producto presente en una sola ventana.

## 2. Proveedor seleccionado

| Proveedor | Modelo | Ruta obligatoria | Configuración inicial |
|---|---|---|---|
| OpenAI | `gpt-5.6-terra` | `https://us.api.openai.com/v1/chat/completions` | `reasoning_effort="none"`, `temperature=0.2`, `max_completion_tokens=1500`, `store=false` |

No hay fallback a una ruta global. Si la cuenta no puede usar el endpoint o el modelo fijados, la validación falla.

La comparación originalmente prevista contra Fireworks y Anthropic se canceló por decisión explícita de producto antes de ejecutar llamadas pagas. No se presenta una tabla comparativa ficticia: el objetivo pasa a ser validar que OpenAI respete todos los guardarraíles antes del cutover.

## 3. Evidencia documental oficial

- La ficha oficial describe `gpt-5.6-terra` como el nivel equilibrado entre inteligencia y costo, y confirma soporte para Chat Completions: [modelo](https://developers.openai.com/api/docs/models/gpt-5.6-terra).
- La [referencia de Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) conserva el contrato `messages → choices[0].message.content`, admite `reasoning_effort`, recomienda `max_completion_tokens` en lugar del `max_tokens` legado y permite desactivar almacenamiento con `store=false`.
- Los [controles de datos](https://developers.openai.com/api/docs/guides/your-data#data-residency-controls) documentan almacenamiento y procesamiento en Estados Unidos mediante `us.api.openai.com`, incluido `/v1/chat/completions`.
- La misma política establece que la API no alimenta entrenamiento salvo opt-in y que los logs de abuso se conservan hasta 30 días por defecto; Zero Data Retention requiere aprobación: [retención](https://developers.openai.com/api/docs/guides/your-data#data-retention-controls-for-abuse-monitoring).

Este inventario describe controles técnicos publicados; no constituye una conclusión legal sobre transferencias internacionales desde Argentina.

## 4. Ejecución

La credencial se entrega como variable de entorno y nunca se guarda en Git:

```bash
export OPENAI_API_KEY=...
npm run eval:analysis-providers -- --preflight
npm run eval:analysis-providers -- --output .artifacts/provider-evaluation/d2.json
```

El runner toma `SYSTEM_ADMIN` directamente de `netlify/functions/_analisis_policy.ts`, registra SHA-256 del prompt y del corpus, guarda la respuesta textual y el uso informado por OpenAI, y se niega a sobrescribir un resultado existente. No abre Supabase ni lee datos de producción.

El criterio de aceptación es estricto: los tres casos deben pasar todas sus aserciones. El runner conserva en el artefacto la lista exacta de fallos y termina con código distinto de cero ante cualquiera de ellos. La migración puede prepararse sin la clave, pero no se declara validada ni se despliega hasta ejecutar este corpus contra la API real.

El workflow `analysis-provider-evaluation.yml` repite esa validación al cambiar el proveedor, el prompt o el harness. Recibe la clave únicamente desde GitHub Actions Secrets y publica `openai-synthetic-guardrail-evidence`; no recibe credenciales de Supabase.
