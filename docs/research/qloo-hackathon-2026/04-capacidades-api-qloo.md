# 04 — Capacidades reales de la API Qloo

Fecha de consulta: **2026-10-22**. Fuentes: [Developer Guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide) (actualizada 07/10/2026) · [API Overview](https://docs.qloo.com/reference/api-overview) · [Parameter Reference](https://docs.qloo.com/reference/parameters) · [Heatmaps](https://docs.qloo.com/reference/heatmaps-use-case) · [Analysis Compare](https://docs.qloo.com/reference/analysis-compare-1).
Convención: **[H]** hecho documentado · **[I]** interpretación · **[NV]** no verificado (requiere clave).

**No tenemos clave: nada fue probado en vivo.**

## 1. Entorno del hackathon

- Base URL `https://hackathon.api.qloo.com`; la clave no funciona en staging ni en producción [H].
- Header `X-Api-Key`; `/v2/insights` es **GET con query string** [H].
- `/recommendations` y `/recs` (legacy) **no soportados** [H].
- Parámetros inválidos **se ignoran en silencio** (200 con resultados vacíos) [H] → hace falta validación propia.
- "The hackathon environment may not have data for every entity or region" [H] → **riesgo de cobertura (p. ej., Argentina)**.
- No se pueden filtrar campos de la respuesta; las respuestas son verbosas [H].
- Caché privada en servidor permitida sin límite de tiempo; **prohibido publicar datos de Qloo en el repo** [H].

## 2. Endpoints

| Endpoint | Función | Fuente |
|---|---|---|
| `GET /v2/insights` | Recomendaciones e insights (motor principal) | [H] |
| `GET /search` | Buscar entidades por nombre → ID | [H] |
| `GET /entities` | Buscar entidades por ID | [H] |
| `GET /v2/tags`, tag types | Buscar tags válidos (géneros, cocinas, etc.); no hay lista estática | [H] |
| `GET /v2/audiences`, audience types | Buscar audiencias (URN) | [H] |
| `GET/POST /v2/analysis/compare` | Comparar dos grupos de entidades (`a.signal.interests.entities`, `b.signal.interests.entities`) | [H]; contenido exacto de la respuesta [NV] |
| `GET trending` | Serie temporal de popularidad de una entidad | [H] |

## 3. Tipos de entidad (`filter.type` en Insights)

`artist`, `book`, `brand`, `destination`, `movie`, `person`, `place`, `podcast`, `tv_show`, `video_game` [H]; además `urn:heatmap` para mapas de calor y `urn:tag` [H].
- Errores comunes: `urn:entity:music` no existe (usar `artist`); `food_and_drink` no existe (usar `place` o `brand`) [H].
- **No hay entidad "producto"/SKU ni "plato"** [H por ausencia] → recomendaciones de productos de consumo masivo a nivel ítem requieren lógica propia [I].

## 4. Señales (en qué se basa la recomendación)

- `signal.interests.entities` — **varias entidades con `weight` individual** [H] → **permite combinar gustos de varias personas** en una sola consulta ponderada [I].
- `signal.interests.tags` (+ weight, + operador) [H].
- `signal.demographics.age` (6 rangos: ≤24, 25–29, 30–34, 35–44, 45–54, 55+), `signal.demographics.gender` (male|female) [H].
- `signal.demographics.audiences` (+ weight) [H].
- `signal.location` / `.query` / `.radius` [H].
- `bias.trends` (solo algunas categorías), `bias.quality` (places) [H].

## 5. Filtros y exclusiones

- **Exclusiones:** `filter.exclude.entities`, `filter.exclude.tags` (union/intersection), `filter.exclude.location` (WKT o geohash) [H].
- **Geografía:** `filter.location` (WKT POINT/POLYGON/MULTIPOLYGON o ID de *locality*), `.radius`, `.geohash`, `.query`; `filter.geocode.country_code|admin1_region|admin2_region|name` [H].
- **Places:** popularidad (percentil), `price_level` 1–4, rango de precio de hotel, `rating` Qloo 0–5, `hours` (día abierto), Resy, Tripadvisor, Michelin (`filter.external.exists`), `filter.references_brand` (sucursales de una marca) [H].
- **Contenido:** años de estreno y publicación, país de estreno, content rating, fechas de nacimiento y muerte (persons), `filter.entities` / `filter.results.entities` (evaluar afinidad de entidades concretas contra la señal) [H].
- Paginación: `take` máx. 50, `page`; `diversify.by` ciudad/metro; `sort_by` affinity|distance|rating|quality [H].

## 6. Qué devuelve

- Entidades con **puntaje de afinidad** y popularidad (percentil) [H].
- `feature.explainability=true` → metadata de explicación por recomendación y por conjunto [H]. Formato exacto [NV].
- Heatmap: grilla de geohash con `affinity`, `affinity_rank` y `popularity`; `output.heatmap.boundary` = geohash (default), ciudad o barrio; `heatmap.dimensions` (quality, popularity, hotel_class, price_level) [H].
- Trending: serie temporal de popularidad [H].

## 7. Lo que hace Qloo vs. lo que haría nuestro agente

| Qloo hace | Nuestro agente debe hacer |
|---|---|
| Afinidad entidad↔entidad y entidad↔audiencia | Interpretar el objetivo del usuario y planificar la secuencia de llamadas |
| Afinidad geográfica (heatmap) | Resolver nombres a IDs (`/search`) y desambiguar |
| Filtros, exclusiones y ponderaciones | Validar parámetros (los errores son silenciosos) y reintentar con estrategias alternativas |
| Tendencias por entidad | Combinar con datos externos (RSS, catálogos, censos) |
| Explicabilidad básica | Puntuar con fórmula propia (afinidad × novedad × factibilidad), decidir y redactar entregables |
| — | **Backtest**: comparar sus predicciones con resultados reales |
| — | Persistir estado, memoria y caché privada |

## 8. Limitaciones conocidas o probables

- Cobertura geográfica despareja en el entorno de hackathon [H]; LatAm sin garantía [NV].
- `person` probablemente sesgado a celebridades (actores, músicos, deportistas, autores) [I] — **crítico para ideas de personas no famosas**.
- Sin SKUs, platos ni productos [H por ausencia].
- Cuotas numéricas no publicadas [NV]; latencia no documentada [NV].
- `take` máximo 50 por página [H].
- No hay datos personales: es privacy-first [H en 2025]. No sirve para perfiles individuales reales sin *seeds* que provea el usuario [I].

## 9. Pruebas técnicas mínimas (ejecutar en <2 h al recibir la clave)

Cada prueba tiene un criterio de aprobado y una decisión asociada.

| # | Prueba | Llamada | Aprobado si | Si falla |
|---|---|---|---|---|
| T1 | Conectividad | `GET /v2/insights?filter.type=urn:entity:movie&signal.interests.tags=urn:tag:genre:media:comedy` | 200 con ≥10 entidades | Revisar base URL y header |
| T2 | Cobertura `person` para invitados de talk shows | `/search` de 30 invitados reales de un podcast de entretenimiento (desde RSS) | ≥70% resueltos a `urn:entity:person` | Descartar la idea A (ver 05) |
| T3 | Cobertura `podcast` | `/search` de 10 podcasts populares | ≥8 encontrados | Usar a los invitados como señal en vez del podcast |
| T4 | Recomendación de personas con exclusión | insights `filter.type=person`, `signal.interests.entities`=10 invitados pasados, `filter.exclude.entities`=los mismos | Resultados plausibles y no vacíos | Idea A no viable |
| T5 | Backtest | Ocultar los últimos 10 invitados reales y medir cuántos aparecen en el top‑50 | ≥2/10 (señal de valor > azar) | Narrativa de validación débil |
| T6 | Cobertura `brand` de consumo masivo | `/search` de 30 marcas de supermercado de EE. UU. | ≥70% | Descartar la idea B |
| T7 | Heatmap de marca por ciudad | `filter.type=urn:heatmap&filter.location.query=Chicago&signal.interests.entities=<marca>` | Grilla con variación de afinidad | Idea B sin componente geográfico |
| T8 | Cobertura LatAm | Heatmap y places en Buenos Aires | Datos no vacíos | Hacer la demo en EE. UU. |
| T9 | Explainability | `feature.explainability=true` | Campos de explicación presentes | Explicar con lógica propia |
| T10 | Trending | Trending de 3 personas | Serie temporal | Omitir la señal de "momento" |
