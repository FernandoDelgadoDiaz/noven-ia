# NOVEN · Evaluación de proveedor de análisis V1

**Corte documental:** 2026-09-02.  
**Estado:** harness y contratos listos; ejecución empírica pendiente de credenciales.  
**Decisión de proveedor:** no tomada. Corresponde al responsable de producto en D3.

## 1. Qué se evalúa

El benchmark mide exclusivamente si la respuesta respeta la verdad determinística y los guardarraíles de `SYSTEM_ADMIN`. No puntúa tono, fluidez, extensión ni preferencia estilística.

El corpus `scripts/provider-evaluation/corpus-v1.json` contiene tres sucursales, productos, identificadores y EAN deliberadamente sintéticos. Para cada caso fija:

- unidades expuestas, calculadas como `max(cantidad_comprometida - VMD × días_comerciales, 0)`, sin `floor`;
- dinero en riesgo a costo unitario sin IVA;
- existencia o ausencia de una ventana previa equivalente;
- trimestre actual abierto;
- membresía exacta del conjunto de productos recurrentes.

El scorer produce evidencia por aserción y cinco dimensiones: fidelidad económica, comparabilidad, trimestre abierto, estacionalidad y recurrencia. Un candidato pierde puntos si inventa una mejora sin base comparable, cierra el trimestre abierto, afirma estacionalidad con dos ventanas o llama recurrente a un producto presente en una sola ventana.

## 2. Candidatos fijados para D2

| Candidato | Modelo solicitado | Ruta obligatoria | Retención documentada |
|---|---|---|---|
| DeepSeek open-weights en Fireworks | `accounts/fireworks/routers/deepseek-v4-flash-0731-us` | `https://us.api.fireworks.ai/inference/v1/chat/completions` | ZDR por defecto para modelos abiertos; prompts y generaciones sólo en memoria volátil durante la solicitud. |
| OpenAI | `gpt-5.6-terra` | `https://us.api.openai.com/v1/responses` y `store=false` | Los datos de API no se usan para entrenamiento salvo opt-in; logs de abuso hasta 30 días por defecto; ZDR requiere aprobación. |
| Anthropic | `claude-sonnet-5` | Claude API con `inference_geo="us"` | Entradas y salidas se eliminan dentro de 30 días bajo la política estándar; ZDR se acuerda por separado y aplican excepciones de seguridad/legales. |

No hay fallback a una ruta global. Si una cuenta no tiene habilitada la geografía solicitada, la evaluación debe fallar.

Los identificadores quedan fijados al corte documental. En particular, el candidato DeepSeek usa el modelo que Fireworks publica actualmente en su catálogo US-only; no se sustituye silenciosamente por otro modelo o endpoint si deja de estar disponible.

## 3. Evidencia documental oficial

### Fireworks / DeepSeek V4 Flash

- Fireworks lista `accounts/fireworks/routers/deepseek-v4-flash-0731-us` entre los modelos disponibles en su [servicio US-only](https://docs.fireworks.ai/serverless/us-only-serverless). La página indica que esa ruta sirve inferencia exclusivamente desde Estados Unidos.
- La [política de residencia](https://docs.fireworks.ai/accounts/data-residency) identifica `us.api.fireworks.ai` como endpoint de inferencia US-only y permite imponer la restricción a nivel de cuenta.
- La [política de retención](https://docs.fireworks.ai/guides/security_compliance/data_handling) declara Zero Data Retention por defecto para la inferencia de modelos abiertos. La excepción de 30 días corresponde a Responses API con `store=true`; este harness usa Chat Completions.

### OpenAI

- La ficha oficial describe `gpt-5.6-terra` como el equilibrio entre inteligencia y costo y expone Responses API: [modelo](https://developers.openai.com/api/docs/models/gpt-5.6-terra).
- Los [controles de datos](https://developers.openai.com/api/docs/guides/your-data#data-residency-controls) documentan procesamiento y almacenamiento en Estados Unidos mediante `us.api.openai.com`.
- La misma política establece que la API no alimenta entrenamiento salvo opt-in y que los logs de abuso se conservan hasta 30 días por defecto; ZDR es un control sujeto a aprobación: [retención](https://developers.openai.com/api/docs/guides/your-data#data-retention-controls-for-abuse-monitoring).

### Anthropic

- La ficha oficial identifica `claude-sonnet-5` como la combinación de velocidad e inteligencia: [modelos](https://platform.claude.com/docs/en/models/overview).
- La [residencia de datos](https://platform.claude.com/docs/en/manage-claude/data-residency) documenta `inference_geo="us"` para mantener inferencia en infraestructura estadounidense.
- Anthropic indica que los datos se almacenan en Estados Unidos y que el ruteo por defecto puede ser global: [ubicación](https://privacy.claude.com/en/articles/7996890-where-are-your-servers-located-do-you-host-your-models-on-eu-servers).
- Su [política comercial de retención](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data) establece borrado de entradas y salidas de API dentro de 30 días, con excepciones explícitas y posibilidad de acuerdo ZDR.

Este inventario describe controles técnicos publicados; no constituye una conclusión legal sobre transferencias internacionales desde Argentina.

## 4. Ejecución

Las credenciales se entregan como variables de entorno y nunca se guardan en Git:

```bash
export FIREWORKS_API_KEY=...
export OPENAI_API_KEY=...
export ANTHROPIC_API_KEY=...
npm run eval:analysis-providers -- --preflight
npm run eval:analysis-providers -- --output .artifacts/provider-evaluation/d2.json
```

El runner toma `SYSTEM_ADMIN` directamente de `netlify/functions/_analisis_policy.ts`, registra SHA-256 del prompt y del corpus, guarda la respuesta textual y el uso informado por cada proveedor, y se niega a sobrescribir un resultado existente. No abre Supabase ni lee datos de producción.

La comparación D3 sólo puede emitirse después de ejecutar los tres candidatos sobre el mismo corpus y revisar las aserciones fallidas. No se completan celdas con estimaciones ni resultados de terceros.
