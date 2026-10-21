# A1 — Análisis de los 14 desafíos oficiales de NASA Space Apps 2026

Agente: A1. Fecha de corte: 21/10/2026. Estado de las fuentes: **resúmenes publicados el 17/09/2026**. Los **enunciados completos** (con datos y recursos oficiales) se publican el **28/10/2026** y **no** fueron leídos por nadie en esta investigación porque todavía no existen.

---

## 1. Misión

1. Completar y verificar la lista de los 14 desafíos 2026.
2. Para cada uno: nombre, URL, dificultad, proponente, resumen (lo más literal posible), problema, usuario, entregables, datos, dificultad científica y técnica (1-5), posibilidad de una demo en 48 h, riesgos y pendientes para el 28/10.
3. Separar el resumen publicado del enunciado completo.
4. Señalar mirrors del texto oficial.

No se escribió código de solución. No se hicieron commits.

---

## 2. Restricciones encontradas y método

- `spaceappschallenge.org`, `science.nasa.gov`, `astrobiology.com`, `zilesinopti.ro`, `startupcafe.ro`, `spaceappschallenge.ch`, `spaceappsvalencia.es` y `builder.aws.com` resultaron **inaccesibles**: WebFetch devolvió `ENOTFOUND` y curl devolvió `000` o `CONNECT 403`. Cada uno se probó una sola vez y no se insistió.
- `raw.githubusercontent.com` **sí** es accesible. `codeload.github.com` devolvió 403 para repos no adjuntados a la sesión.
- **El presupuesto de WebSearch se agotó** a mitad de la investigación: el límite de 200 llamadas por turno es compartido por todos los agentes. Por eso no se pudieron hacer búsquedas específicas para extraer los resúmenes literales de cada página oficial. Esta es la principal limitación del informe.
- Como vía secundaria se leyeron completos (**[LEÍDO]**) unos 50 README de repos públicos de equipos 2026. También se leyeron el catálogo estructurado y el registro de reglas del repo `SeCuReDmE-main-dev/nasa-space-apps-2026-research`, que declara haber observado el catálogo oficial renderizado el 22/09/2026.

### Búsquedas realizadas (WebSearch)

Con `allowed_domains=spaceappschallenge.org`:
- "2026 challenges spaceappschallenge"
- clima/observación terrestre
- agua/océano/aire
- MODIS VIIRS
- Moon/Mars/CLPS
- exoplanetas/asteroides/clima espacial
- ciudades/biodiversidad/desastres

Sin restricción de dominio:
- "Abandoned but not Forgotten"
- "Flame in Freefall"
- "Dancing with the SARs"
- "Planet X and SPHEREx"
- "Be An Earth System Trend Detective"
- lista de los 14 desafíos en rumano y en portugués/español
- artículo de NASA Science
- polo sur lunar

Con `allowed_domains=github.com`, una búsqueda por cada título de los 14 desafíos.

Las 3 últimas búsquedas en spaceappschallenge.org, pensadas para obtener texto literal de los resúmenes, **no se ejecutaron** porque se agotó el presupuesto.

---

## 3. Hallazgo principal: lista verificada de los 14 desafíos

Los títulos que faltaban son **"Dancing with the SARs"**, **"Be An Earth System Trend Detective!"** y **"Planet X and SPHEREx"**. Con ellos la lista suma 14.

Las etiquetas de dificultad provienen del catálogo SeCuReDmE (C), salvo que se indique otra fuente.

| ID (alfabético) | Título oficial | URL oficial (`spaceappschallenge.org/2026/challenges/…`) | Dificultad publicada | Tierra / Espacio | Evidencia del título |
|---|---|---|---|---|---|
| C01 | Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars | `abandoned-but-not-forgotten-storytelling-about-nasas-discarded-equipment-on-the-moon-and-mars/` | Principiante/Juvenil, Intermedio | Espacio (narrativa) | [LEÍDO] C + [SNIPPET] prensa RO, Valencia + ≥10 repos |
| C02 | Be An Earth System Trend Detective! | `be-an-earth-system-trend-detective/` | **Avanzado** (coinciden C, Valencia y cpt9m0) | Tierra | [LEÍDO] C, cpt9m0 + [SNIPPET] Valencia |
| C03 | Build a Junior Astronaut Mission Trainer | `build-a-junior-astronaut-mission-trainer/` | Principiante/Juvenil, Intermedio | Espacio (educación) | [SNIPPET] índice oficial + [LEÍDO] C |
| C04 | CLPS Lunar Mission Browser | `clps-lunar-mission-browser/` | Intermedio, Avanzado | Espacio (Luna) | [SNIPPET] índice oficial + [LEÍDO] C |
| C05 | Create Health Monitoring Software for Astronauts on Space Missions | `create-health-monitoring-software-for-astronauts-on-space-missions/` | Intermedio | Espacio (salud) | [SNIPPET] índice oficial + [LEÍDO] C |
| C06 | Dancing with the SARs | `dancing-with-the-sars/` | Intermedio, Avanzado | Tierra (NISAR) | [LEÍDO] C + [SNIPPET] prensa RO + ≥10 repos |
| C07 | Field Shift: Adapting Farms with NASA Data | `field-shift-adapting-farms-with-nasa-data/` | Intermedio, Avanzado | Tierra (agro) | [SNIPPET] índice oficial + [LEÍDO] C |
| C08 | Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data | `flame-in-freefall-ai-powered-fire-safety-insights-from-microgravity-combustion-data/` | Intermedio, Avanzado | Espacio (ISS / combustión) | [LEÍDO] C + [SNIPPET] prensa RO + ≥10 repos |
| C09 | Harmonization of MODIS and VIIRS Hot Spots | `harmonization-of-modis-and-viirs-hot-spots/` | Intermedio, Avanzado | Tierra (incendios) | [SNIPPET] URL oficial indexada + [LEÍDO] C |
| C10 | Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars | `identify-earth-locations-that-analog-the-permanent-moon-base-locations-and-mars/` | Principiante, Intermedio, Avanzado | Híbrido (Tierra al servicio de Luna/Marte) | [SNIPPET] índice oficial + [LEÍDO] C |
| C11 | Interplanetary Survival Guide: Martian Map | `interplanetary-survival-guide-martian-map/` | Intermedio | Espacio (Marte) | [SNIPPET] índice oficial + [LEÍDO] C |
| C12 | **Planet X and SPHEREx** | `planet-x-and-spherex/` | **Avanzado** | Espacio (astrofísica / sistema solar) | [LEÍDO] C + [LEÍDO] README de shrestha-droid y roshcr6, que enlazan la URL oficial |
| C13 | Space Mission Design Game | `space-mission-design-game/` | Principiante/Juvenil, Intermedio | Espacio (educación) | [SNIPPET] índice oficial + [LEÍDO] C |
| C14 | The Earth Information Jukebox | `the-earth-information-jukebox/` | Principiante/Juvenil, Intermedio | Tierra (accesibilidad / sonificación) | [SNIPPET] índice oficial + [LEÍDO] C |

**Recuento Tierra/Espacio.** Hay 5 desafíos puramente terrestres (C02, C06, C07, C09, C14) y C10 es híbrido. Contando C10 como terrestre son 6, lo que **coincide** con la fuente secundaria que hablaba de "6 de 14 sobre la Tierra" [INFERENCIA]. El "desafío avanzado de analizar datos de observación terrestre para identificar patrones de tendencias ambientales y climáticas" es **C02** [SNIPPET Valencia: "Ciencias de la Tierra #02 … Analiza datos de observación de la Tierra … Dificultad: Avanzado"].

### Fuente contaminada que hay que descartar

El README `tiovene/nasa-spaceapps` ("Guia Oficial & Hub Brasil") [LEÍDO] lista 14 desafíos, pero **omite** Martian Map, MODIS/VIIRS y Planet X/SPHEREx. A cambio incluye tres títulos sin respaldo en ninguna otra fuente:
- "Living Off the Cosmic Land (ISRU Explorer)"
- "Cosmic Clean-Up: Orbital Debris Tracker"
- "Open Science for All: Biodiversity & Ocean Watch"

Probablemente son inventados, quizás generados por IA. Se clasifican **[NO VERIFICADO / probable fabricación]** y **no deben usarse**. Además, varias de sus etiquetas de dificultad difieren de las de C. Por ejemplo, para C05, C08, C10 y C04 dice "Avanzado" sin matices.

### Discrepancias de dificultad entre fuentes

| Desafío | C (SeCuReDmE) | tiovene | Comentario |
|---|---|---|---|
| C04 CLPS | Intermedio, Avanzado | Avanzado | |
| C05 Salud | Intermedio | Intermedio/Avanzado | |
| C07 Field Shift | Intermedio, Avanzado | Avanzado | |
| C08 Flame | Intermedio, Avanzado | Avanzado | |
| C10 Análogos | Principiante, Intermedio, Avanzado | Avanzado | |

Se adopta C, que declara haber leído el catálogo renderizado, pero queda como **[NO VERIFICADO contra la fuente primaria]**.

### Numeración "Challenge N" usada por los equipos

Algunos equipos escriben "Challenge 7" (RotaShift, Field Shift) o "Challenge 9" (Chronofire, MODIS/VIIRS). Esos números coinciden con el orden alfabético del catálogo, no con una numeración temática [INFERENCIA]. Un snippet que dice "CLPS … número 10" contradice ese orden, así que no es fiable.

---

## 4. Resumen publicado vs. enunciado completo

| Aspecto | Resumen publicado (17/09) | Enunciado completo (28/10) |
|---|---|---|
| Estado | Publicado. Su texto literal **no se pudo leer** desde este entorno. Se dispone de paráfrasis [LEÍDO, fuente secundaria] y de fragmentos casi literales copiados por equipos | **No publicado** al 21/10 |
| Contenido conocido | Título, dificultad y uno o dos párrafos de objetivo | Datos y recursos oficiales de NASA y agencias socias, y posiblemente consideraciones y requisitos más precisos [INFERENCIA, basada en ediciones previas] |
| Juzgamiento y envío | — | Las guías llegan el **13/11/2026** |

Por lo tanto, **todo lo que este informe dice sobre datos oficiales, entregables y requisitos detallados es INFERENCIA**, salvo que se indique lo contrario. Ningún equipo ni repo leído tuvo acceso al enunciado completo. Algunos lo declaran explícitamente: cpt9m0, Aluchashi y Yoriichi-0u0/earth-fm.

### Mirrors y textos casi literales encontrados

| Mirror | Qué contiene | Estado |
|---|---|---|
| `SeCuReDmE-main-dev/nasa-space-apps-2026-research` → `data/challenges/README.md` y `2026-challenge-summaries.json` | Los 14 títulos, URLs, dificultades y una **paráfrasis** de cada resumen (el propio repo aclara: "Its summaries are paraphrases"), observados el 22/09 | [LEÍDO], secundaria |
| Mismo repo → `docs/rules/space-apps-2026.md` | Registro de reglas y fechas con citas literales del FAQ | [LEÍDO], secundaria |
| Mismo repo → `docs/project/challenge-shortlist.md` | Dossiers de C02, C06, C08 y C09 con preguntas abiertas para el 28/10 | [LEÍDO], secundaria |
| README del equipo Protikriti (C11) | Cita en bloque: "The challenge: build a layered, integrated view of a location or route on the Martian surface that pulls together data from multiple NASA science missions, to help a human explorer plan a successful Marswalk while doing new science along the way." | [LEÍDO], **probablemente casi literal** |
| README de `cpt9m0/trend-detective` (C02) | "examine variables measured by NASA missions or produced by NASA models, visualize how they change over time, and determine: What… Where… How much… Whether the change is statistically significant" | [LEÍDO], probablemente casi literal |
| Snippet de búsqueda sobre los repos de C14 | "building an interface, script, or application that pairs Earth Information Center (EIC) visual frames with dynamic sonifications generated in real time" | [SNIPPET], probablemente casi literal |
| README de Chronofire (C09) | "combine and harmonise MODIS hotspot detections at one kilometre resolution with VIIRS detections at 375 metres, so that wildfire activity can be tracked consistently across the whole record" | [LEÍDO], paráfrasis del equipo |
| Sitio de la sede de Valencia (`spaceappsvalencia.es`) | Lista numerada en español con dificultad | [SNIPPET]. No se pudo abrir (403) |
| Sitio de la sede de Lucerna (`spaceappschallenge.ch`) | Menciona "fourteen challenges" y el foco lunar | [SNIPPET]. No se pudo abrir |
| Prensa rumana (StartupCafe, start-up.ro, România Pozitivă, zilesinopti.ro) | Lista parcial con descripciones | [SNIPPET]. No se pudo abrir |

---

## 5. Ficha por desafío

### Escalas y convenciones de las fichas

- **Dificultad científica (Cien.) y técnica (Téc.).** Escala de 1 a 5, donde 5 es la más difícil. Es un juicio propio [INFERENCIA].
- **Demo en 48 h.** Indica si un equipo pequeño y competente puede mostrar algo convincente y honesto en 48 h. Es [INFERENCIA].
- **Proponente.** Ninguna fuente leída indica qué agencia o experto propone cada desafío. Las páginas oficiales suelen indicarlo, pero no fueron legibles. Por eso **todos los proponentes quedan [NO VERIFICADO]**. Donde se menciona una misión con socio extranjero, se señala solo como dato asociado. El rumor de que **CONAE** propone C09 **no encontró ninguna confirmación** en las búsquedas hechas.
- **Fuentes del resumen.** "Paráfrasis C" indica la paráfrasis del catálogo SeCuReDmE [LEÍDO, secundaria].

---

### C01 — Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars

- **Dificultad oficial:** Principiante/Juvenil, Intermedio.
- **Proponente:** [NO VERIFICADO].
- **Resumen:**
  - Paráfrasis C: "Explain the history and scientific contribution of NASA equipment left on the Moon, Mars and elsewhere to school-age audiences."
  - Prensa rumana [SNIPPET]: "documentar las historias de los equipos de la NASA dejados en la Luna y Marte".
- **Problema:** el hardware abandonado (rovers, landers, instrumentos) no es conocido como patrimonio científico.
- **Usuario:** estudiantes en edad escolar y educadores.
- **Entregables:** no publicados. La categoría Best Storytelling encaja [INFERENCIA].
- **Datos probables [INFERENCIA]:** NSSDCA (catálogo de naves), imágenes LRO/LROC de los sitios de alunizaje, HiRISE de los landers en Marte, archivos de misiones (Apollo, Viking, Spirit, Opportunity, InSight).
- **Dificultad:** Cien. 1 / Téc. 2. El riesgo está en la veracidad histórica y los derechos de imágenes, no en la técnica.
- **Demo en 48 h:** **alta**. Un sitio narrativo o un juego es fácil de mostrar.
- **Riesgos:**
  - Saturación muy alta: al menos 10 repos 2026 ya publicados.
  - Difícil diferenciarse.
  - Juzgamiento subjetivo.
- **Pendiente del 28/10:** lista oficial de datos o imágenes, formato esperado (historia, juego, app) y público objetivo exacto.

### C02 — Be An Earth System Trend Detective!

- **Dificultad oficial:** **Avanzado**.
- **Proponente:** [NO VERIFICADO].
- **Resumen:**
  - Casi literal [LEÍDO cpt9m0]: examinar variables medidas por misiones de NASA o producidas por modelos NASA, visualizar su cambio en el tiempo y determinar *qué* cambia, *dónde*, *cuánto* y si el cambio es *estadísticamente significativo*.
  - Paráfrasis C: "Examine where NASA-observed or modelled Earth-system variables change, by how much, and with what statistical significance."
- **Problema:** detectar tendencias ambientales y climáticas robustas y comunicarlas.
- **Usuario:** público, decisores y educadores [INFERENCIA]. El resumen no se pudo leer completo.
- **Entregables:** no publicados.
- **Datos probables [INFERENCIA]:** MERRA-2, GPM IMERG, GRACE/GRACE-FO, MODIS (NDVI, LST), NASA POWER, GISTEMP, OCO-2. Los equipos ya usan POWER, MERRA-2, GPM y GRACE [LEÍDO, varios README].
- **Dificultad:** Cien. 4 / Téc. 3.
  - La inferencia válida es difícil: autocorrelación, estacionalidad, comparaciones múltiples, huecos y cambios de sensor.
  - Mann-Kendall y Sen son los métodos estándar, lo que deja poco margen para diferenciarse.
- **Demo en 48 h:** **media-alta**. Un mapa de tendencias con significancia es demostrable. Lo difícil es el rigor.
- **Riesgos:**
  - Presentar como hallazgos artefactos de sensores o de datos faltantes.
  - Saturación: al menos 7 repos ya publicados.
  - Producto genérico tipo "dashboard climático".
- **Pendiente del 28/10:** variables y productos permitidos, periodos, escalas y qué significa "significativo" en la evaluación.

### C03 — Build a Junior Astronaut Mission Trainer

- **Dificultad oficial:** Principiante/Juvenil, Intermedio.
- **Proponente:** [NO VERIFICADO].
- **Resumen:**
  - Paráfrasis C: "Help students experience the resource and engineering trade-offs of a lunar or Martian outpost through an interactive learning experience."
  - Prensa [SNIPPET]: "un juego en el que los niños gestionan una base lunar o marciana".
- **Problema:** enseñar las compensaciones de ingeniería en soporte vital, energía, agua, radiación, etc.
- **Usuario:** niños y jóvenes, docentes.
- **Entregables:** no publicados. Probablemente un juego o app interactiva [INFERENCIA].
- **Datos probables [INFERENCIA]:** parámetros ECLSS de la ISS, hojas de datos de la Luna y Marte, MOXIE, dosis de radiación (MSL-RAD), DONKI.
- **Dificultad:** Cien. 2 / Téc. 2-3.
- **Demo en 48 h:** **alta**.
- **Riesgos:**
  - Saturación: al menos 9 repos, algunos muy pulidos (Little Orbit, OUTPOST).
  - Sobredimensionar la simulación.
  - Que el valor pedagógico no esté medido.
- **Pendiente del 28/10:** rango de edades, si se exigen datos reales y el formato.

### C04 — CLPS Lunar Mission Browser

- **Dificultad oficial:** Intermedio, Avanzado.
- **Proponente:** [NO VERIFICADO]. Probablemente del ámbito CLPS de NASA [INFERENCIA por el nombre].
- **Resumen:**
  - Paráfrasis C: "Make lunar site and date comparisons easier using Sun and Earth positions relative to the horizon."
  - NASA Science [SNIPPET]: varios desafíos tratan "surface operations at the Moon's South Pole, managing sunlight and communications windows".
- **Problema:** planificar dónde y cuándo aterrizar según la iluminación solar y la visibilidad directa a la Tierra (DTE) en el polo sur.
- **Usuario:** planificadores de misiones CLPS. Para tiovene, "intuitive tool for mission planners" [NO VERIFICADO].
- **Entregables:** no publicados.
- **Datos probables [INFERENCIA]:** horizontes LOLA (LDEM), efemérides NAIF SPICE, JPL Horizons, mapas de iluminación del polo sur, ventanas de la DSN. Los equipos usan LOLA y SPICE [LEÍDO lunar-ops, lunahorizon].
- **Dificultad:** Cien. 3 / Téc. 4. Implica geometría, marcos de referencia, libración y validación contra Horizons.
- **Demo en 48 h:** **media**. Es verificable y tiene criterio objetivo, pero el preprocesamiento de horizontes es costoso.
- **Riesgos:**
  - Ya hay herramientas avanzadas preconstruidas. `RootVandal/lunar-ops` declara haber sido desarrollada en octubre de 2026, antes del hackatón, "not a hackathon submission".
  - Requiere experiencia de dominio.
- **Pendiente del 28/10:** sitios candidatos oficiales, rango de fechas, productos LOLA indicados y métricas pedidas.

### C05 — Create Health Monitoring Software for Astronauts on Space Missions

- **Dificultad oficial:** Intermedio.
- **Proponente:** [NO VERIFICADO].
- **Resumen:**
  - Paráfrasis C: "Organize health indicators so astronauts can assess their condition during extended missions."
  - Prensa [SNIPPET]: "una app para monitorear la salud de los astronautas durante las misiones".
- **Problema:** autonomía médica de la tripulación en misiones largas fuera de LEO.
- **Usuario:** astronautas y cirujanos de vuelo.
- **Entregables:** no publicados.
- **Datos probables [INFERENCIA]:** NASA OSDR/GeneLab (Inspiration4, Twins Study), NASA-STD-3001, dosimetría de la ISS, Human Research Program. Varios equipos usan OSDR [LEÍDO astro-health].
- **Dificultad:** Cien. 3 / Téc. 2.
  - Los datos fisiológicos reales casi no son públicos, así que casi todos los equipos simulan telemetría.
  - La interpretación clínica requiere especialistas.
- **Demo en 48 h:** **alta en lo visual, baja en sustancia**. Es el típico dashboard con datos simulados.
- **Riesgos:**
  - Datos simulados, lo que debilita "Best Use of Data".
  - Afirmaciones médicas fuera de alcance.
  - Saturación: al menos 10 repos.
- **Pendiente del 28/10:** qué datos reales provee NASA, qué indicadores y qué alcance de decisión está permitido.

### C06 — Dancing with the SARs

- **Dificultad oficial:** Intermedio, Avanzado.
- **Proponente:** [NO VERIFICADO]. La misión NISAR es NASA-ISRO [LEÍDO, varios README; dato conocido].
- **Resumen:**
  - Paráfrasis C: "Use NISAR radar observations to track and communicate one or more kinds of surface change."
  - Prensa RO [SNIPPET]: analiza cambios de la superficie terrestre con datos radar NISAR.
  - tiovene [NO VERIFICADO]: deforestación, quemas, inundaciones, deformación.
- **Problema:** hacer comprensibles los cambios superficiales medidos por radar de apertura sintética (SAR).
- **Usuario:** público, gestores de riesgo y científicos [INFERENCIA].
- **Entregables:** no publicados.
- **Datos probables [INFERENCIA]:**
  - Productos NISAR L1/L2 (GCOV, GUNW) vía ASF DAAC, en bandas L y S y con repetición de 12 días.
  - Los equipos usan NISAR_L2_GCOV y productos de muestra [LEÍDO terrascope-ai, TerraCascade].
- **Dificultad:** Cien. 4 / Téc. 4. Implica interpretar SAR, InSAR, georreferencia y archivos HDF5 de gran volumen.
- **Demo en 48 h:** **media**.
- **Riesgos:**
  - Cobertura y disponibilidad de pares NISAR para el área elegida.
  - Volumen de datos.
  - Varios equipos usan datos sintéticos [LEÍDO Sidvortex], lo que indica que la barrera es real.
- **Pendiente del 28/10:** nivel de producto, polarizaciones, pares temporales y tipos de cambio que se esperan.

### C07 — Field Shift: Adapting Farms with NASA Data

- **Dificultad oficial:** Intermedio, Avanzado.
- **Proponente:** [NO VERIFICADO].
- **Resumen:**
  - Paráfrasis C: "Support exploration of crop rotation choices using NASA observations, local soil information and agricultural priorities."
  - Prensa [SNIPPET]: adaptación de la agricultura al cambio climático.
- **Problema:** elegir rotaciones de cultivos que se adapten a un clima cambiante y mejoren el suelo.
- **Usuario:** agricultores y extensionistas.
- **Entregables:** no publicados.
- **Datos probables [INFERENCIA]:** NASA POWER, SMAP (humedad del suelo), GPM IMERG, MODIS NDVI (MOD13Q1), HLS, más datos de suelo locales (SoilGrids). Todos aparecen ya en README de equipos [LEÍDO].
- **Dificultad:** Cien. 4 / Téc. 3. La agronomía exige un experto y conocimiento local.
- **Demo en 48 h:** **media-alta**. Es demostrable con heurísticas transparentes, pero cuesta que sea creíble.
- **Riesgos:**
  - Recomendaciones agronómicas sin validar.
  - Saturación: al menos 10 repos.
- **Pendiente del 28/10:** qué datos de suelo, qué "prioridades agrícolas" y qué región o escala.

### C08 — Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data

- **Dificultad oficial:** Intermedio, Avanzado.
- **Proponente:** [NO VERIFICADO]. Probablemente del área de investigación en combustión de NASA (Glenn) [INFERENCIA].
- **Resumen:**
  - Paráfrasis C: "Make experimental findings on combustion in microgravity easier to find, compare, rank and interpret through an AI-assisted dashboard."
  - Prensa RO [SNIPPET]: análisis del comportamiento del fuego en microgravedad con ayuda de IA.
- **Problema:** el conocimiento de experimentos de combustión (FLEX, BASS-II, Saffire, ACME y otros) está disperso. Hay que hacerlo usable para la seguridad contra incendios en hábitats.
- **Usuario:** investigadores e ingenieros de seguridad [INFERENCIA].
- **Entregables:** el resumen pide explícitamente un dashboard asistido por IA (paráfrasis C). El registro de reglas C aclara que esa IA es un requisito del producto, no una regla sobre el uso de IA durante el hackatón.
- **Datos probables [INFERENCIA]:** informes técnicos NTRS, datos FLEX, BASS-II, Saffire, LUCI y PSI (Physical Sciences Informatics). Los equipos ya los usan [LEÍDO MicroFire-Atlas, flame-in-freefall].
- **Dificultad:** Cien. 3-4 / Téc. 3. Los experimentos son heterogéneos y las condiciones no son comparables. Es necesario abstenerse cuando falta evidencia.
- **Demo en 48 h:** **media-alta**. La recuperación de información con citas es demostrable.
- **Riesgos:**
  - Alucinaciones de la IA en un dominio de seguridad.
  - Saturación: al menos 10 repos, algunos ya muy elaborados (MicroFire-Atlas con 56 pruebas citadas).
- **Pendiente del 28/10:** corpus oficial y su licencia, y qué significa "rank".

### C09 — Harmonization of MODIS and VIIRS Hot Spots

- **Dificultad oficial:** Intermedio, Avanzado.
- **Proponente:** [NO VERIFICADO]. El rumor de CONAE **no tiene confirmación** en ninguna búsqueda hecha.
- **Resumen:**
  - Paráfrasis C: "Reconcile sensor-specific hotspot histories into a calendar for exploring historical burning activity in a chosen area."
  - Dossier C [LEÍDO]: "a comparable history of satellite-detected burning activity and a calendar that can be examined for a selected area."
- **Problema:** VIIRS (375 m) detecta más focos, y más pequeños, que MODIS (1 km). Por eso las series largas muestran un salto artificial al cambiar de sensor.
- **Usuario:** gestores de fuego y analistas regionales [INFERENCIA].
- **Entregables:** el resumen menciona un **calendario de actividad de quema** para un área elegida (paráfrasis C; los equipos coinciden).
- **Datos probables [INFERENCIA]:**
  - FIRMS (MODIS C6.1 MCD14ML, VIIRS 375 m VNP14IMG / VJ114), MOD14A1/VNP14A1.
  - Contexto temporal [LEÍDO firelens, Chronofire; NO VERIFICADO en fuente oficial]: el feed VIIRS de S-NPP terminaría el 1/11/2026 y el retiro de MODIS está previsto para fines de 2026 o 2027.
- **Dificultad:** Cien. 4 / Téc. 3. La comparabilidad entre sensores es el núcleo científico y no tiene una solución única.
- **Demo en 48 h:** **alta**. El calendario y el mapa son visibles, y las APIs de FIRMS son simples.
- **Riesgos:**
  - Saturación: al menos 10 repos, algunos con 26 años de datos procesados (firelens) y prepublicados (kiln-watch declara trabajo del 5 al 10/10).
  - Calibraciones regionales frágiles. firelens reporta R² 0,586 en el norte de India.
- **Pendiente del 28/10:** productos, colecciones y fechas oficiales, y si se provee una referencia de evaluación.

### C10 — Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars

- **Dificultad oficial:** Principiante, Intermedio, Avanzado (multinivel).
- **Proponente:** [NO VERIFICADO].
- **Resumen:**
  - Paráfrasis C: "Characterize Earth environments with properties relevant to candidate lunar or Martian locations."
  - Prensa RO [SNIPPET]: identificar lugares de la Tierra parecidos a la Luna o Marte, por ejemplo Atacama o Haughton, para probar equipos.
- **Problema:** encontrar análogos terrestres para probar hardware y operaciones.
- **Usuario:** planificadores de pruebas de análogos [INFERENCIA].
- **Entregables:** no publicados.
- **Datos probables [INFERENCIA]:**
  - Para la Tierra: NASADEM/SRTM, Copernicus DEM, MODIS LST, NASA POWER.
  - Para los objetivos: LOLA, Diviner, sitios Artemis III, MOLA, HiRISE.
  - Catálogos de análogos de NASA, ESA y CSA.
- **Dificultad:** Cien. 3 / Téc. 3. Definir y validar criterios de similitud es lo central, y la similitud total es imposible (PSR a 40 K).
- **Demo en 48 h:** **alta**. Un globo con ranking es vistoso.
- **Riesgos:**
  - Puntuaciones arbitrarias.
  - Saturación: al menos 10 repos, con TerraNova ya puntuando 78.247 celdas.
- **Pendiente del 28/10:** sitios base oficiales y criterios o variables sugeridos.

### C11 — Interplanetary Survival Guide: Martian Map

- **Dificultad oficial:** Intermedio.
- **Proponente:** [NO VERIFICADO].
- **Resumen:**
  - Casi literal [LEÍDO README Protikriti]: "build a layered, integrated view of a location or route on the Martian surface that pulls together data from multiple NASA science missions, to help a human explorer plan a successful Marswalk while doing new science along the way."
  - Paráfrasis C: "Combine NASA observations into a view of a Martian location or route that can inform human exploration."
- **Problema:** planificar una caminata humana en Marte con información integrada de seguridad y ciencia.
- **Usuario:** exploradores humanos y planificadores; también educación [INFERENCIA].
- **Entregables:** no publicados. La frase clave es "layered, integrated view".
- **Datos probables [INFERENCIA]:** MOLA, CTX, HiRISE (DTM), THEMIS, CRISM, Viking, nomenclatura IAU, datos MEDA/REMS.
- **Dificultad:** Cien. 3 / Téc. 3-4. Alinear varias fuentes y manejar resoluciones es lo difícil.
- **Demo en 48 h:** **alta**.
- **Riesgos:**
  - Saturación: al menos 10 repos (ver BRIEF).
  - La evidencia propia de ASTRA (E1) muestra que rutear con pendiente sobre CTX de 20 m no reduce la exposición real a pendientes >15°. El "safety verdict" de muchos equipos podría ser engañoso a esa resolución [INFERENCIA, basada en el BRIEF].
- **Pendiente del 28/10:** zonas sugeridas, capas mínimas y criterios de "successful Marswalk".

### C12 — Planet X and SPHEREx (título faltante, ahora verificado)

- **Dificultad oficial:** **Avanzado**.
- **Proponente:** [NO VERIFICADO]. SPHEREx es una misión NASA/JPL con datos en IRSA/IPAC (Caltech) [LEÍDO roshcr6; dato conocido].
- **Resumen:**
  - Paráfrasis C: "Help the public inspect changes across repeated SPHEREx sky imagery."
  - Los equipos lo interpretan como buscar objetos en movimiento (asteroides, TNOs, un hipotético Planeta X) en imágenes multiépoca de SPHEREx [LEÍDO shrestha-droid, gitmahin].
- **Problema:** abrir los datos multiépoca de SPHEREx al público y a la ciencia ciudadana para detectar objetos que se mueven o cambian.
- **Usuario:** público y ciencia ciudadana.
- **Entregables:** no publicados.
- **Datos probables [INFERENCIA]:** imágenes SPHEREx Quick Release (QR2/QR3) vía IRSA (SIA/TAP), JPL Horizons y SBDB para la validación contra objetos conocidos, y quizá WISE/NEOWISE.
- **Dificultad:** Cien. 4-5 / Téc. 4-5.
  - Hay que manejar formatos astronómicos (FITS, WCS), alinear épocas, diferenciar imágenes y controlar falsos positivos.
  - El volumen de datos es alto.
  - Detectar un "Planeta X" real es esencialmente imposible en 48 h. El propio roshcr6 advierte contra confirmaciones prematuras.
- **Demo en 48 h:** **media**. La recuperación de asteroides conocidos es demostrable y verificable. La afirmación "Planeta X" no lo es.
- **Riesgos:**
  - Fuerte dependencia de la disponibilidad de IRSA.
  - Expectativas sensacionalistas.
  - Saturación algo menor que en otros desafíos, aunque hay al menos 10 repos.
- **Pendiente del 28/10:** productos y épocas oficiales, región del cielo sugerida y qué se considera "cambio".

### C13 — Space Mission Design Game

- **Dificultad oficial:** Principiante/Juvenil, Intermedio.
- **Proponente:** [NO VERIFICADO].
- **Resumen:** paráfrasis C: "Let learners explore the interacting objectives and resource constraints of a space mission."
- **Problema:** enseñar el diseño de misiones (presupuesto, masa, energía, trayectoria, carga científica).
- **Usuario:** estudiantes y público general.
- **Entregables:** un juego, según el título.
- **Datos probables [INFERENCIA]:** hojas de datos planetarias de NSSDC, parámetros de JPL, ecuación del cohete, datos de misiones reales.
- **Dificultad:** Cien. 2 / Téc. 2-3.
- **Demo en 48 h:** **alta**.
- **Riesgos:**
  - Se solapa conceptualmente con C03.
  - Saturación: al menos 10 repos.
  - Sobredimensionar la simulación.
- **Pendiente del 28/10:** audiencia, nivel de realismo y si se exigen datos reales.

### C14 — The Earth Information Jukebox

- **Dificultad oficial:** Principiante/Juvenil, Intermedio.
- **Proponente:** [NO VERIFICADO]. El Earth Information Center (EIC) de NASA es el contexto.
- **Resumen:**
  - Casi literal [SNIPPET]: "building an interface, script, or application that pairs Earth Information Center (EIC) visual frames with dynamic sonifications generated in real time."
  - Paráfrasis C: "Make Earth Information Center visual content accessible through dynamic sound-based representations."
  - Earth FM [LEÍDO]: "pair EIC visual frames with dynamic real-time sonification".
- **Problema:** la comunicación del EIC es casi solo visual y excluye a las personas ciegas o con baja visión.
- **Usuario:** personas con discapacidad visual y público general. Accesibilidad.
- **Entregables:** "interface, script, or application" [SNIPPET].
- **Datos probables [INFERENCIA]:** contenidos del EIC (earth.gov), GISTEMP, GIBS, NASA Earth Now, nivel del mar, CO₂ y otros.
- **Dificultad:** Cien. 2 / Téc. 2-3. La sonificación es sencilla. Hacerla buena y evaluarla con usuarios reales no lo es.
- **Demo en 48 h:** **muy alta**. Es audiovisual e inmediata.
- **Riesgos:**
  - Sin validación con usuarios ciegos. Los propios equipos lo admiten [SNIPPET].
  - Saturación: al menos 10 repos.
  - Juzgamiento subjetivo.
- **Pendiente del 28/10:** qué contenidos EIC son la entrada oficial y si hay expectativas de accesibilidad o estándares.

---

## 6. Tabla comparativa

Toda la tabla es [INFERENCIA], salvo la columna de dificultad oficial.

| ID | Dificultad oficial | Cien. | Téc. | Demo 48 h | Saturación observada (repos 2026 ya publicados) | Mayor riesgo |
|---|---|---|---|---|---|---|
| C01 | Principiante–Intermedio | 1 | 2 | Alta | Muy alta (≥10) | Indiferenciación |
| C02 | Avanzado | 4 | 3 | Media-alta | Alta (≥7) | Rigor estadístico |
| C03 | Principiante–Intermedio | 2 | 2-3 | Alta | Muy alta (≥9) | Indiferenciación |
| C04 | Intermedio–Avanzado | 3 | 4 | Media | Alta (≥10) | Dominio y preprocesamiento |
| C05 | Intermedio | 3 | 2 | Alta (superficial) | Muy alta (≥10) | Datos simulados, alcance médico |
| C06 | Intermedio–Avanzado | 4 | 4 | Media | Alta (≥10) | Experiencia en SAR, datos |
| C07 | Intermedio–Avanzado | 4 | 3 | Media-alta | Alta (≥10) | Validez agronómica |
| C08 | Intermedio–Avanzado | 3-4 | 3 | Media-alta | Alta (≥10) | IA en dominio de seguridad |
| C09 | Intermedio–Avanzado | 4 | 3 | Alta | Alta (≥10) | Calibración entre sensores |
| C10 | Multinivel | 3 | 3 | Alta | Alta (≥10) | Criterios arbitrarios |
| C11 | Intermedio | 3 | 3-4 | Alta | Muy alta (≥10) | Resolución y seguridad engañosas |
| C12 | Avanzado | 4-5 | 4-5 | Media | Alta (≥10) | Datos y falsos positivos |
| C13 | Principiante–Intermedio | 2 | 2-3 | Alta | Alta (≥10) | Solapamiento con C03 |
| C14 | Principiante–Intermedio | 2 | 2-3 | Muy alta | Alta (≥10) | Sin validación de usuarios |

**Nota sobre la saturación.** El conteo es el de los resultados de una única búsqueda en GitHub por desafío, que devuelve hasta 10 resultados. Por eso "≥10" significa "al menos 10" y no un total. No mide calidad.

---

## 7. Observaciones transversales

1. **Trabajo previo al hackatón.** El FAQ dice: "Teams are not allowed to begin working on the challenges prior to the hackathon" (citado [LEÍDO] en el registro de reglas C). Aun así, se observan decenas de repos con soluciones avanzadas y desplegadas antes del 14/11. Ejemplos:
   - kiln-watch declara trabajo del 5 al 10/10.
   - lunar-ops fue desarrollado en octubre.
   - TrajectIQ hizo un smoke test el 18/10.

   Otros equipos, como kamikaze1120/skyshift y SeCuReDmE, se abstienen explícitamente. Esto afecta el análisis competitivo: el nivel de los competidores visibles ya es alto. Es una posible zona de descalificación para ellos, pero eso es [INFERENCIA]: no se conoce cómo se aplica la regla.
2. **Varias fuentes de terceros contienen afirmaciones fabricadas o no verificables.** El caso más claro es tiovene, con tres desafíos inexistentes. No se debe usar ninguna lista sin contrastarla.
3. **Desafíos con criterio de verificación objetivo**, que permiten demostrar corrección: C04 (validación contra Horizons/SPICE), C09 (comparación en el periodo de solapamiento de sensores), C12 (recuperación de asteroides conocidos) y C02 (significancia estadística). Los desafíos educativos y narrativos (C01, C03, C13, C14) dependen más del juicio subjetivo [INFERENCIA].

---

## 8. Objeciones propias

- **No leí ninguna página oficial.** Todo el contenido de los resúmenes proviene de fuentes secundarias: un catálogo que declara haber leído el sitio oficial, README de equipos y snippets de buscador. La dificultad y las URLs dependen en gran medida de una sola fuente (SeCuReDmE). Esa fuente es coherente con los URLs oficiales indexados y con varios repos independientes, pero sigue sin estar verificada contra la fuente primaria.
- Las paráfrasis de C pueden omitir requisitos del resumen real, por ejemplo menciones a socios internacionales o a datos concretos.
- Las puntuaciones de dificultad y demo son juicios propios, sin experimentos.
- Al agotarse el presupuesto de búsqueda no se buscaron: otras sedes locales con traducciones completas, el blog oficial "Explore The Next Frontier" con la lista y los proponentes, ni la confirmación o el descarte de CONAE para C09.

---

## 9. Conclusiones

1. La lista de 14 queda **completa y con alta consistencia entre fuentes independientes**. Los títulos que faltaban son *Dancing with the SARs*, *Be An Earth System Trend Detective!* y *Planet X and SPHEREx*.
2. Los resúmenes publicados son **breves** y no traen datos oficiales. **Toda decisión sobre datos y entregables debe esperar al 28/10.**
3. Los 14 desafíos tienen ya al menos 10 repos públicos de terceros, salvo C02 con al menos 7. Ninguno está "vacío". La diferenciación tendrá que venir del rigor y la verificabilidad, no de la idea [INFERENCIA].
4. Por la combinación de criterio objetivo y demo viable, **C09, C04, C12 y C02** son los más defendibles técnicamente. **C14 y C01** son los más accesibles para una demo, pero tienen evaluación más subjetiva [INFERENCIA].

---

## 10. Tabla de fuentes

| URL | Qué afirma | Estado |
|---|---|---|
| https://www.spaceappschallenge.org/2026/challenges/ (y las URLs individuales de §3) | Catálogo de 14 desafíos | [SNIPPET] solo títulos. Inaccesible (ENOTFOUND) |
| https://www.spaceappschallenge.org/2026/challenges/harmonization-of-modis-and-viirs-hot-spots/ | Existe C09 | [SNIPPET] URL indexada |
| https://www.spaceappschallenge.org/2026/challenges/clps-lunar-mission-browser/ | Existe C04 | [SNIPPET] |
| https://raw.githubusercontent.com/SeCuReDmE-main-dev/nasa-space-apps-2026-research/main/data/challenges/README.md | 14 títulos, URLs y dificultad (observado el 22/09) | [LEÍDO], secundaria |
| …/data/challenges/2026-challenge-summaries.json | Paráfrasis de los 14 resúmenes | [LEÍDO], secundaria (paráfrasis declarada) |
| …/docs/rules/space-apps-2026.md | Fechas (17/09, 28/10, 13/11, 14–15/11), cita del FAQ sobre trabajo previo, términos de licencias | [LEÍDO], secundaria con citas |
| …/docs/project/challenge-shortlist.md | Dossiers de C02, C06, C08 y C09 | [LEÍDO], secundaria |
| https://raw.githubusercontent.com/tiovene/nasa-spaceapps/main/README.md | Lista de 14 con 3 títulos espurios | [LEÍDO]. **No fiable** |
| https://github.com/AhsanulHoque22/Nasa-Space-Apps-Challenge-2026-Team-Protikriti | Cita del desafío C11 | [LEÍDO README] |
| https://github.com/cpt9m0/trend-detective | Texto del desafío C02 y su dificultad | [LEÍDO README] |
| https://github.com/shahedrayhan23/Chronofire | Paráfrasis de C09; plan sin implementar | [LEÍDO README] |
| https://github.com/shahmirkhan106/firelens | Datos de FIRMS; fin de S-NPP VIIRS el 1/11/2026 | [LEÍDO README]; fecha [NO VERIFICADO] |
| https://github.com/Aalvee-Aarham/kiln-watch | Trabajo del 5 al 10/10/2026 en C09 | [LEÍDO README] |
| https://github.com/RootVandal/lunar-ops | Herramienta de C04 desarrollada en octubre de 2026 | [LEÍDO README] |
| https://github.com/shrestha-droid/spherex-moving-sky, https://github.com/roshcr6/NASA2026, https://github.com/gitmahin/planetx-spherex, https://github.com/kamikaze1120/skyshift | Existencia de C12, enlace a la URL oficial, datos IRSA | [LEÍDO README] |
| https://github.com/Yoriichi-0u0/earth-fm | Resumen de C14 aportado por el equipo | [LEÍDO README] |
| https://github.com/A-K-M-Asifuzzaman/MicroFire-Atlas | Corpus BASS-II, Saffire y LUCI para C08 | [LEÍDO README] |
| Unos 40 README adicionales de equipos (lista en `scratchpad/list.txt`) | Enfoques y datos usados por desafío | [LEÍDO README]. Funcionalidad **declarada**, no comprobada |
| startupcafe.ro, romaniapozitiva.ro, start-up.ro, zilesinopti.ro | Lista parcial; "Dancing with the SARs"; "Flame in Free Fall"; análogos (Atacama, Haughton) | [SNIPPET]. Inaccesibles |
| spaceappsvalencia.es | C01 Principiante/Intermedio; C02 Avanzado ("Ciencias de la Tierra #02") | [SNIPPET]. 403 |
| spaceappschallenge.ch (Lucerna) | 14 desafíos, foco lunar | [SNIPPET] |
| science.nasa.gov/…/nasa-welcomes-all-ages-experience-levels-for-space-apps-challenge/ | Desafíos sobre el polo sur lunar, luz solar y comunicaciones | [SNIPPET]. Inaccesible |
| therecursive.com | "14 challenges, each marked as beginner, intermediate or advanced" | [SNIPPET] |

---

## 11. Pendientes

1. **El 28/10:** leer los 14 enunciados completos y actualizar las secciones de datos, entregables, proponente y requisitos. Esto requiere acceso a spaceappschallenge.org desde otro entorno o mirrors fiables.
2. Verificar la dificultad y los proponentes contra la fuente primaria, en especial el rumor de CONAE para C09.
3. Obtener el texto literal de los 14 resúmenes del 17/09. No fue posible por el bloqueo del sitio y el agotamiento de WebSearch.
4. El **13/11:** guías de juzgamiento y envío, y política de uso de asistentes de IA.
5. Aclarar cómo aplica la organización la regla de "no trabajar antes del hackatón", dada la cantidad de repos avanzados observados.
