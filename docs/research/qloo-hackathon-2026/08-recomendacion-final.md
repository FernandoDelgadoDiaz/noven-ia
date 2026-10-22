# 08 — Recomendación final

Fecha: **2026-10-22**.

## Respuesta al criterio final

> ¿Qué podemos construir, dentro del plazo, con diferenciación defendible frente a los ganadores 2025 y los participantes conocidos 2026, que maximice las posibilidades de competir por el 1.º premio?

**Green Room**: un agente de booking de invitados para podcasts y talk shows de entretenimiento, con **backtest contra invitados reales** como prueba de valor.

Es la única propuesta con ventaja defendible en los cuatro criterios oficiales y 0 competidores visibles. Pero la recomendación es **condicional**:

1. **Clave de API recibida a más tardar el lunes 27/10 a las 12:00 (Argentina).**
2. **T2, T4 y T5 aprobados** (cobertura de `person`, recomendación con exclusión y backtest mejor que el baseline sin Qloo).
3. **Disponibilidad para presentar en vivo y en inglés el 05/11.**

Si falla la 1 o la 2 y no aplica el plan B, la recomendación es **no presentar**. No conviene construir algo mediocre solo porque el concurso está abierto.

No se informan probabilidades de ganar: no hay base estadística para estimarlas (ver 06).

---

## Propuesta 1 (recomendada) — Green Room

**Concepto.** "Your audience already told us who they want to hear next." El agente lee la historia del show, infiere el gusto de su audiencia con el grafo de Qloo y propone invitados que esa audiencia ama pero que el show nunca tuvo, con evidencia, momento y un pitch listo para enviar.

**Problema.** Elegir invitados se hace por intuición y red de contactos. Los invitados obvios ya están sobreexpuestos. El *booker* es un rol pago y manual.

**Usuario.** Productores y hosts de podcasts y talk shows de entretenimiento, cultura, deportes y comedia (donde los invitados son personas presentes en el grafo de Qloo).

**Flujo completo del agente.**
1. *Input:* URL del RSS (o nombre del show) y objetivo ("crecer en audiencia joven", "un invitado de música", etc.).
2. *Ingesta:* descarga el RSS (público) y extrae los invitados de títulos y descripciones con el LLM.
3. *Resolución:* `/search` por cada invitado → IDs `urn:entity:person`. Desambigua y descarta lo no resuelto, con log visible.
4. *Perfil de audiencia:* `signal.interests.entities` = invitados pasados (ponderados por recencia) + el podcast si existe en Qloo (T3) → afinidades por categoría (`artist`, `movie`, `tv_show`) para describir "el gusto de tu audiencia".
5. *Candidatos:* `/v2/insights?filter.type=urn:entity:person` con `filter.exclude.entities` = invitados pasados; variantes con `filter.popularity.max` para evitar lo obvio.
6. *Puntuación propia:* afinidad Qloo × momento (`trending`) × novedad (penaliza la sobreexposición) × ajuste al objetivo. Fórmula visible.
7. *Autocrítica:* el agente revisa la lista. Si hay demasiados de una categoría, diversifica; si la afinidad es baja, relaja filtros y reintenta. Cada paso queda registrado.
8. *Entregable:* top 10 con razones (`feature.explainability`), un "ángulo de conversación" por invitado y un borrador del email de invitación.
9. *Prueba:* modo **Backtest**: oculta los últimos N invitados reales, corre el agente sobre el historial anterior y mide cuántos aparecen en su top‑K. Compara contra el mismo LLM **sin Qloo**.

**Papel indispensable de Qloo.** Sin el grafo, el paso 4–6 es lo que un LLM "adivina". El backtest mide exactamente esa diferencia. Usa person, podcast/tv_show, exclusiones, popularidad, trending y explainability (*Technological Implementation*).

**Diferencial.**
- *vs 2025:* ningún ganador trabajó medios ni personas; ninguno validó contra la realidad.
- *vs 2026 visible:* 0 repos de invitados para podcasts. Los más cercanos (sponsor-scout, partner-desk) buscan marcas, no invitados.
- La validación cuantitativa contra datos reales es rara en la muestra (homestand, routed y crossover la hacen en otros dominios).

**Arquitectura mínima.**
- Frontend: Vite + React + Tailwind (stack conocido), una sola página con 3 estados: input → progreso del agente (log en vivo) → resultados y backtest.
- Backend: Netlify Functions (TypeScript). Loop de agente con *tool calling* (OpenAI o Anthropic) y herramientas: `fetch_rss`, `extract_guests`, `qloo_search`, `qloo_insights`, `qloo_trending`, `score_candidates`, `draft_pitch`, `run_backtest`.
- Caché **privada** de respuestas Qloo (Netlify Blobs). Nada de Qloo en el repo [regla de la developer guide].
- Repo público nuevo, licencia MIT, README en inglés con diagrama y "How judges can test in 60 seconds".
- Sin base de datos de usuarios ni login (reduce fricción para jueces).

**Funciones mínimas para la demo.**
1. Pegar un RSS y obtener el top 10 con razones.
2. Log visible de las decisiones del agente.
3. Backtest Qloo vs. sin Qloo con una métrica simple (aciertos en el top‑K).
4. Borrador de invitación.
5. 3 shows de ejemplo precargados (botones) para que un juez lo pruebe sin pensar.

**Tiempo estimado.** 3–4 días de desarrollo asistido + 1 día de pulido y entrega (ver 09).

**Costos y dependencias.** LLM ~US$ 5–20; Netlify (plan gratuito); Qloo gratis. Dependencias: clave Qloo, RSS públicos, proveedor LLM con clave propia (ya disponible: OpenAI se usa en otros proyectos; **usar una clave nueva y separada**).

**Riesgos.** Cobertura de `person` (T2); recomendaciones obvias (T4); backtest sin señal (T5); percepción de adulación; final en inglés; clave tardía.

**Estrategia ante el jurado.**
- Título y primera línea con un número: "Predicted N of the last 10 real guests — the same model without Qloo predicted M." Solo con resultados reales; si M ≥ N, no presentar esa afirmación.
- Mapear la descripción a los 4 criterios con un subtítulo por criterio (ayuda al juzgamiento asistido por IA).
- Ejemplos con shows de entretenimiento (Cedric y Abrams los reconocen); evitar usar el podcast de un juez como caso principal.
- Video de 2 minutos aunque no sea obligatorio (los jueces pueden juzgar solo con texto e imágenes).
- Para la final: demo en vivo con un show elegido por el público o el host. Es el formato que hace brillar a un agente rápido.

---

## Propuesta 2 (plan B) — Shelf Signal

**Concepto.** Agente de surtido localizado para almacenes y minimercados independientes: qué marcas sumar o rotar según el gusto del barrio.
- **Problema/usuario:** dueño de almacén independiente en EE. UU. (demo en dos barrios contrastantes de una ciudad grande).
- **Flujo:** dirección + lista de marcas → heatmap de marcas en el barrio → faltantes con alta afinidad → actuales con baja afinidad → "plan de prueba de 4 semanas" con cantidades conservadoras para minimizar la merma → lista de pedido.
- **Qloo:** `brand`, `urn:heatmap`, `filter.references_brand`, `filter.location`.
- **Diferencial:** 0 repos de supermercado/almacén; comprensión genuina del dominio (merma, rotación, capital inmovilizado).
- **Arquitectura y costos:** igual a la de Green Room (reutilizando la infraestructura del agente).
- **Riesgos:** T6/T7; argumento "gusto ≠ ventas"; sin validación con datos reales.
- **Cuándo usarla:** solo si Green Room falla en T2/T4 y Shelf Signal aprueba T6/T7 el mismo día.
- **Restricción:** **no usar datos, código ni clientes de NoVen IA.**

## Propuesta 3 (no recomendada; referencia) — Matchday

Noches temáticas y sponsors para clubes de ligas menores (heatmap + artists + brands). Es la de menor riesgo técnico, pero **no supera el red team** por competidores visibles con más rigor ([homestand](https://github.com/ramenprotokol/homestand)). Se incluye solo para cumplir el formato de tres y como comparación: **no construirla**.

---

## Decisión

| Condición al 27/10 12:00 ART | Acción |
|---|---|
| Clave OK + T2/T4/T5 OK + disponible el 05/11 | **Construir Green Room** |
| Clave OK + Green Room falla + T6/T7 OK | Construir Shelf Signal (expectativas más bajas) |
| Clave OK + ambas fallan | **No presentar** |
| Sin clave | **No presentar** (no es posible cumplir las reglas) |
| Sin disponibilidad para la final en inglés | Reconsiderar: se puede competir por 2.º/3.º, pero el 1.º se decide en vivo |
