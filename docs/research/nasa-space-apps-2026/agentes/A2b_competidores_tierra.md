# A2b — Inteligencia competitiva, parte 2: desafíos de Tierra (NASA Space Apps 2026)

Agente: A2b · Fecha de trabajo: 2026-10-20/21 · Estado: **completo con huecos declarados** (se agotó el presupuesto de búsquedas web compartido; ver §8).

---

## 1. Misión

Para los desafíos de temática Tierra de NASA Space Apps 2026 (Harmonization of MODIS and VIIRS Hot Spots; Field Shift: Adapting Farms with NASA Data; The Earth Information Jukebox; y los demás títulos terrestres que aparezcan), relevar:

- repositorios públicos de equipos 2026,
- herramientas oficiales, productos y literatura que ya resuelvan el problema,
- el competidor o la alternativa más fuerte que se haya verificado,
- el nivel de saturación,
- para MODIS/VIIRS en particular: qué hace FIRMS, qué hay publicado sobre armonización y cuándo terminan MODIS y S-NPP.

No se escribió código de solución ni se hicieron commits. No se ejecutó código de terceros: los repos se clonaron (`git clone --depth 200`, sin hooks) en `/tmp/claude-0/-home-user/7029a718-8690-52ad-a08e-e11704dd6284/scratchpad/repos2/` y solo se leyeron.

---

## 2. Búsquedas realizadas (registro)

| # | Consulta / acción | Resultado |
|---|---|---|
| 1 | WebSearch `2026 challenges Harmonization of MODIS and VIIRS Hot Spots` (dominio spaceappschallenge.org) | La URL oficial existe. Sin texto del enunciado en el snippet. |
| 2 | WebSearch `2026 challenges Field Shift Adapting Farms with NASA Data` (dominio SAC) | La URL oficial existe. También aparecen desafíos agro de 2024 y 2025. |
| 3 | WebSearch `2026 challenges Earth Information Jukebox` (dominio SAC) | La URL oficial existe. |
| 4 | WebFetch de la página oficial MODIS/VIIRS | **ENOTFOUND** (bloqueado, como anticipaba el BRIEF). |
| 5 | WebSearch `"Harmonization of MODIS and VIIRS" hot spots space apps challenge summary CONAE` | Nada vincula el desafío con CONAE. Devolvió literatura (Boschetti/Roy/Giglio, MIROVA). |
| 6 | WebSearch sobre títulos terrestres faltantes (clima, océano, agua, aire) | Sin títulos nuevos. |
| 7–8 | WebSearch `spaceappschallenge.org/2026/challenges/ flood drought…` y `… 14 challenges "Jukebox" "Field Shift" "MODIS"` | Repos de equipos de Field Shift y Jukebox. Artículo de therecursive.com: "6 de 14 sobre la Tierra", Jukebox de nivel principiante. |
| 9–10 | WebFetch a spacedata.swapniltamse.com y therecursive.com | ENOTFOUND. |
| 11 | curl a therecursive.com (.md), builder.aws.com y zilesinopti.ro | CONNECT 403 (proxy). |
| 12–14 | WebSearch `"six of this year's fourteen challenges"…`, `"Earth observation" "environmental and climate trends"`, Space Data Atlas | **Dos títulos nuevos**: "Be an Earth System Trend Detective" y "Dancing with the SARs". Solo [SNIPPET] de therecursive y AWS Builder Center. |
| 15–17 | WebSearch de los títulos nuevos (abiertas y con dominio SAC) | **Confirmadas las URL oficiales**: `/2026/challenges/be-an-earth-system-trend-detective/` y `/2026/challenges/dancing-with-the-sars/` (con imagen NISAR del Monte Rainier). |
| 18 | WebSearch `2026 challenges "Space Agency Partners" CONAE INPE ISRO` (dominio SAC) | CONAE e ISRO figuran como socios 2026. INPE no aparece por nombre. No hay vínculo desafío↔agencia. |
| 19–23 | WebSearch de repos en GitHub para cada desafío | **13 repos para MODIS/VIIRS, ~11 para Field Shift y 9 para Jukebox**. Detalle en §4. |
| 24 | `curl codeload.github.com/...tar.gz` | **403** en todos los casos (en esta sesión codeload quedó bloqueado). |
| 25 | `git ls-remote` y `git clone --depth 200` | **Funciona.** Se clonaron 14 repos; uno (`NASA-space-app-challenge-2026/shkim`) falló. |
| 26–28 | WebSearch sobre el fin de MODIS, de S-NPP y sobre FIRMS + NOAA-21 | **No se ejecutaron: se agotó el presupuesto de 200 búsquedas del turno, compartido entre agentes.** |
| 29 | WebFetch a earthdata.nasa.gov y nesdis.noaa.gov (las URL que citan los repos) | ENOTFOUND. |

No se buscaron repos ni alternativas para "Be an Earth System Trend Detective" ni para "Dancing with the SARs": el presupuesto se agotó antes. Quedan como **pendientes** y no deben leerse como "no hay competidores".

---

## 3. Inventario de desafíos terrestres 2026

| Desafío | URL oficial (existencia) | Qué se sabe del contenido | Etiqueta |
|---|---|---|---|
| Harmonization of MODIS and VIIRS Hot Spots ("Challenge 9", según varios repos) | `/2026/challenges/harmonization-of-modis-and-viirs-hot-spots/` | Según repos de equipos: una aplicación web que armonice los registros de focos activos de MODIS y VIIRS en un **burning activity calendar**, para alerta temprana, emergencias, científicos y gestores de tierras, que muestre patrones históricos, condiciones inusuales y períodos críticos de un área de interés elegida. Kiln Watch menciona una "build guide" que encuadra la demo en Asia del Sur. | URL [SNIPPET]; contenido [LEÍDO en repos de terceros, reconstruido por ellos, NO VERIFICADO contra la fuente oficial] |
| Field Shift: Adapting Farms with NASA Data ("Challenge 7", según RotaShift) | `/2026/challenges/field-shift-adapting-farms-with-nasa-data/` | Agricultura resiliente al clima. Todos los repos convergen en **rotación de cultivos + salud del suelo + adaptación climática**. Un snippet menciona "6 datasets". | URL [SNIPPET]; tema [SNIPPET] y [INFERENCIA desde repos] |
| The Earth Information Jukebox | `/2026/challenges/the-earth-information-jukebox/` | Según repos: emparejar visuales o datasets del **Earth Information Center (EIC)** con una **sonificación dinámica en tiempo real**, con foco en accesibilidad. Un artículo lo clasifica como principiante. | URL [SNIPPET]; contenido [LEÍDO en repos de terceros, NO VERIFICADO] |
| Be an Earth System Trend Detective | `/2026/challenges/be-an-earth-system-trend-detective/` | Buscar tendencias o cambios ambientales en datos de NASA, de nivel intermedio o avanzado. Probablemente es el desafío "avanzado de patrones de tendencias" que mencionaba el BRIEF. | URL [SNIPPET]; contenido [SNIPPET secundario] |
| Dancing with the SARs | `/2026/challenges/dancing-with-the-sars/` | Usar radar de NISAR (banda L) para seguir cambios en la superficie terrestre. | URL [SNIPPET]; contenido [SNIPPET secundario] |
| Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars | (listado en el BRIEF) | Usa datos de la Tierra, pero el objetivo es lunar o marciano. Puede ser el sexto desafío "terrestre". | [INFERENCIA] |

Con esto aparecen **5 desafíos claramente terrestres** más uno híbrido, lo que cuadra con "6 de 14" [INFERENCIA]. Los enunciados completos se publican el 28/10/2026. Todo lo anterior sale de resúmenes, snippets o repos de terceros. No se vinculó ningún desafío con CONAE; solo se verificó que CONAE es socio en 2026 [SNIPPET].

---

## 4. Hallazgos por desafío

Escala de nivel: **esqueleto** (solo documentación o plan), **prototipo** (código parcial o datos de demo), **prototipo avanzado** (pipeline real, demo en vivo, tests), **producto operativo** (servicio mantenido con usuarios), **evidencia científica** (publicación revisada).

"Comprobado" significa que leí el código o la estructura en el clon. **No ejecuté nada**, así que ninguna métrica se reprodujo.

### 4.1 Harmonization of MODIS and VIIRS Hot Spots

#### 4.1.1 Repos de equipos 2026 (13 distintos encontrados; 7 clonados)

| Repo | Fechas de commits (clon) | Declarado | Comprobado | Nivel |
|---|---|---|---|---|
| **Aalvee-Aarham/kiln-watch** | 47 commits, 2026-10-06 → 2026-10-10 | Calendario armonizado de Bangladesh (64 distritos, 560 calendarios). Tasa de cambio VIIRS→MODIS emparejada por región, mes y pasada día/noche. Normalización por fracción libre de nubes (Earth Engine). IC 95 % por bootstrap. Test de quiebre (p = 6×10⁻⁵ en crudo frente a 0,29 armonizado). Concordancia de Lin 0,62→0,98. Cadena NOAA-20/21 tras S-NPP. Pronóstico a 14 días (Brier skill 0,075). Agente Claude con guardas anti-alucinación. Sitio en vivo actualizado a diario. Extensión de hornos de ladrillo con Black Marble y Sentinel-1. Prerregistro. | Paquete `kilnwatch/` de 5.409 líneas de Python con `harmonize.py` (`fit_ratio`, `bootstrap_betas`, `fit_glm` Poisson), `stats.py` (`bootstrap_ci`, `chow_test`), `gee.py`, `nrt.py` y `ask.py`. 1.119 líneas de tests en 17 archivos. `PREREGISTRATION.md`. No se reprodujeron métricas. Sin LICENSE. | **Prototipo avanzado.** Metodológicamente el más fuerte. |
| **samuelakosaonyejekwe/firecal** | 73 commits, 2026-10-01 → 2026-10-04 | Cualquier país (208) o caja dibujada. Calibración por área y mes con contracción ("shrinkage") a un prior mundial, validada fuera de muestra. Tres eras de sensor. Alerta con NRT de los últimos 6 días. Perspectiva a 30 días. PWA, CSV, API. Sitio en GitHub Pages. | `app/analysis.py` y otros: 1.498 líneas en `app/`. Paridad Python↔JS testeada (`test_engine_parity.py`). Unos 6.700 archivos, sobre todo datos. LICENSE presente. | **Prototipo avanzado.** El más fuerte en cobertura global. |
| **shahmirkhan106/firelens** (team scikit) | 3 commits, 2026-10-12 | 5 regiones, 28,3 M detecciones, H3 de unos 0,7 km². OLS `MODIS ~ a + b·VIIRS` sobre el solape 2012→. R² entre 0,59 y 0,95. FastAPI + React, 20 tests, video. | `pipeline/harmonize.py` leído: OLS por región; usa MODIS cuando existe y VIIRS calibrado en los huecos. La debilidad de North India (R² 0,586) está declarada. LICENSE presente. | Prototipo avanzado. |
| **Hisernberg/ignis-public** | 1 commit (snapshot "sanitizado"), 2026-09-22 | Calendario de 26 años para 9 regiones + Bangladesh. DBSCAN en el navegador. 5 modelos (Hugging Face). Generador de SITREP con IA. Respaldo GIBS si FIRMS cae. App en Vercel. | 298 archivos, 123 de código. Historia de un solo commit, así que la evolución no se puede verificar. LICENSE presente. | Prototipo avanzado (declarado); vistoso. |
| **ImtiazIftii/NPC_SpaceApps** (fork en 1-abesh-1) | 42 commits, 2026-10-06 → 2026-10-09 | FireCalendar en Render. Deduplicación a 0,01°. Factor único `k = ΣMODIS/ΣVIIRS` (≈0,41–0,49, r > 0,97). Anomalías z > 2 por día del año. | README con la metodología completa; 31 archivos de código. | Prototipo. Método simple: un solo escalar. |
| **Mosharrof8097/nasa_space_app_challange_2026** (EmberSync, ASL NOVA) | 3 commits, 2026-10-07 | Clustering + algoritmo genético que calibra conteo y FRP a la vez. Inflación VIIRS:MODIS de 4,26:1. 83 k detecciones. | Scripts de descarga y construcción de dashboard (16 archivos de código). | Prototipo. |
| **shahedrayhan23/Chronofire** | 5 commits, 2026-10-10 | "Todo es planificado o propuesto". Demo crudo/armonizado sobre Asia del Sur. | 4 archivos, 0 de código. | Esqueleto. |
| Md-Sajeeb-Islam/FIREMAP-X | — (no clonado) | Streamlit con unas 100 observaciones. | — | [SNIPPET] prototipo chico. |
| SOHAM-0409/NASA-Space-App-Challenge | — | FastAPI + React con subida de CSV de FIRMS; reescala al sensor mejor cubierto. | — | [SNIPPET] |
| ehasanulhaque152/EarthFire | — | Solo descripción. | — | [SNIPPET] |
| nasifnaser06-cyber/Project_S.H.I.F.T | — | Florida, MIT. | — | [SNIPPET] |
| Aalvee-Aarham/kiln-watch-2026 | — | Concepto; dice que el código se escribirá en la hackatón. | — | [SNIPPET] esqueleto. |

**Hechos comprobados que importan:**

- **Saturación muy alta.** Hay al menos 13 repos y al menos 5 tienen un pipeline real con demo pública. El núcleo "calibrar VIIRS sobre MODIS en el solape 2012→ y dibujar un calendario mes×año o día×año" está **resuelto varias veces** (OLS, ratio único, ratio estratificado con bootstrap, GLM Poisson, algoritmo genético).
- **Todos los commits son anteriores a la hackatón** (2026-09-22 → 2026-10-14) [LEÍDO, fechas del clon]. Las fechas de commit se pueden falsear, así que esto es un indicio y no una prueba. Kiln Watch declara explícitamente que todo lo hecho hasta el 6/10 es previo y lo divulga como trabajo previo. La regla del FAQ ("no comenzar antes") no se sabe cómo se aplica en el juzgamiento [NO VERIFICADO].
- Diferenciadores que ya aparecen y por lo tanto **no son nuevos**: normalización por nubes, IC por bootstrap, test de quiebre estructural, encadenamiento NOAA-20/21, NRT y alerta temprana, agente LLM con trazabilidad, separación de hornos y quemas agrícolas, cobertura global con caja dibujada, PWA offline.

#### 4.1.2 Alternativas oficiales y literatura

| Alternativa | Qué hace | Etiqueta |
|---|---|---|
| **NASA FIRMS** | Distribuye focos activos NRT procesados por LANCE con los algoritmos estándar **MOD14/MYD14 (MODIS C6.1)** y **VIIRS 375 m (VNP14IMG / VJ114IMG / VJ214IMG)**. El mapa superpone las capas por sensor y el archivo se descarga por sensor (MODIS_SP, VIIRS_SNPP_SP, etc.). **No se encontró evidencia de que FIRMS publique una serie armonizada MODIS↔VIIRS**: mezcla visualmente pero no intercalibra. La API de área limita a 5 días por pedido y 5.000 transacciones cada 10 min (según FireLens). | Distribución por sensor: [SNIPPET wiki.earthdata] + [LEÍDO en el código de FireLens, `download_firms.py`]. "No armoniza": [INFERENCIA, no verificado contra la doc de FIRMS] |
| **Proyecto de armonización MODIS/VIIRS del equipo científico MODIS** (Boschetti, Roy, Giglio; presentación de la reunión de abril de 2022) | Objetivo: una serie armonizada de **área quemada** de 25 años a 0,25°, sin sesgo, con incertidumbres y calibrada con referencias Landsat 8 / Sentinel-2. Advierte un retraso del producto VIIRS de área quemada. **Es sobre área quemada, no sobre focos activos.** | [SNIPPET] (`modis.gsfc.nasa.gov/sci_team/meetings/202204/.../boschetti.pdf`) |
| Comparación de focos geoestacionarios (Himawari-8) con VIIRS y MODIS, *Remote Sensing* 2021 | El emparejamiento depende del umbral de FRP: 96 % VIIRS y 95 % MODIS. | [SNIPPET] |
| MIROVA, transición MODIS→VIIRS en volcanes (*Sensors* 2022, PMC8914890) | VIIRS da unas 60 % más alertas que MODIS (+30 % de pasadas). Propone VIIRS para complementar o reemplazar a MODIS. | [SNIPPET] |
| "Comparing Next-Day Wildfire Predictability of MODIS and VIIRS" (arXiv 2503.08580) | Comparación de predictibilidad entre sensores. | [SNIPPET] (título) |
| Giglio et al. 2016, algoritmo MODIS C6 de fuego activo; Schroeder et al. 2014, VIIRS 375 m | Base algorítmica de ambos productos. Son los papers que cualquier jurado técnico espera ver citados. | [NO VERIFICADO: conocimiento previo, no se pudo abrir] |
| INPE Programa Queimadas, "satélite de referência" | Para series comparables INPE usa un único satélite de referencia, históricamente Aqua MODIS de la tarde, en lugar de mezclar sensores. Es una alternativa operativa al problema de consistencia. | [NO VERIFICADO: conocimiento previo; no hubo búsquedas disponibles] |
| Copernicus EFFIS / GWIS | Muestran focos MODIS y VIIRS como capas. No se verificó si armonizan. | [NO VERIFICADO] |
| Paquete `nasa-wildfires` (PyPI) | CLI de descarga de FIRMS (MODIS, VIIRS S-NPP y NOAA-20). Solo descarga, no armoniza. | [SNIPPET] |
| Proyecto UAB "Development of a method and software for automatically obtain fire perimeters using MODIS-VIIRS hot-spots" | Perímetros a partir de focos de ambos sensores. | [SNIPPET] |

#### 4.1.3 Fin de vida de MODIS y S-NPP (clave para la utilidad)

| Afirmación | Fuente | Estado |
|---|---|---|
| "NASA plans to end MODIS data collection in 2027" | README de Kiln Watch, que cita `earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs` | [LEÍDO en el repo; la fuente primaria no se pudo abrir (ENOTFOUND)] |
| "Terra MODIS ends Jan 2027, Aqua ~Sep 2027" | Documentos de Kiln Watch (referencia [6]) | [LEÍDO en el repo; primaria NO VERIFICADA] |
| "S-NPP data delivery ends 1 Nov 2026 (NOAA notice: 2 Nov)" | Kiln Watch, FireLens y Chronofire; URL citada `nesdis.noaa.gov/news/cessation-of-suomi-national-polar-orbiting-partnership-s-npp-data-users-onafter-november-2-2026` | [LEÍDO en 3 repos independientes; la URL tiene forma de aviso oficial; primaria NO VERIFICADA (ENOTFOUND)] |
| "MODIS constellation planned to be retired late 2026/early 2027" y, en otra fuente, "Terra-MODIS operational until end of mission December 2025" | Resumen del buscador sobre papers | [SNIPPET, contradictorio entre fuentes] |

**Implicancia** [INFERENCIA]: si las fechas son correctas, la hackatón (14–15/11/2026) cae **después** del fin de entrega de S-NPP y **antes** del fin de MODIS. La "continuidad" ya no es MODIS↔S-NPP sino MODIS↔NOAA-20/21, y el solape útil con NOAA-21 es corto (desde 2023). Esto le da relevancia real al problema. Pero **Kiln Watch ya lo modela** (cadena NOAA-20→NOAA-21, uso de la climatología de nubes de S-NPP tras el 2/11), así que ni siquiera este ángulo está libre.

#### 4.1.4 Más fuerte y saturación

- **Competidor 2026 más fuerte verificado:** **Kiln Watch** por rigor (prerregistro, IC, test de quiebre, corrección por nubes, cadena de sensores), aunque cubre solo Bangladesh. **FireCal** es el más fuerte en cobertura global y producto usable. Los dos tienen código real leído, sitio público y más de 40 commits.
- **Alternativa institucional más fuerte:** el proyecto de armonización MODIS/VIIRS de Boschetti/Roy/Giglio [SNIPPET], aunque es de área quemada y no de focos. FIRMS **no** cubre la serie armonizada [INFERENCIA].
- **Saturación: MUY ALTA.** Es el desafío terrestre con más repos maduros encontrados.

### 4.2 Field Shift: Adapting Farms with NASA Data

#### 4.2.1 Repos de equipos 2026 (~11 encontrados; 4 clonados)

| Repo | Fechas (clon) | Declarado | Comprobado | Nivel |
|---|---|---|---|---|
| **samuelakosaonyejekwe/fieldshift** (mismo autor que FireCal) | 28 commits, 2026-10-03 → 2026-10-04 | App offline en GitHub Pages, 38 idiomas, 23 granjas demo. NASA POWER desde 1995, SoilGrids, NDVI MOD13Q1. "Rotation Time Machine" (reproduce cada año histórico). "Crop Shift" a 2040/2050. Simulación de 20 años: COS, RUSLE, N, agua, GEI. Web Worker. | 86 archivos, 47 de código, datos demo JSON. No se ejecutó; la calidad agronómica no se puede evaluar. Sin LICENSE. | **Prototipo avanzado** (declarado y muy amplio). |
| **sagar25446-prog/FieldShift-NASA** | 17 commits, 2026-10-13 → 2026-10-14 | Streamlit en vivo. 6 datasets NASA: POWER, NEX-GDDP-CMIP6 (5 GCM, SSP245 y SSP585), SMAP L4, MCD12Q2, MOD13Q1, GRACE, FIRMS. Optimización de Pareto. FAO-56 Penman-Monteith. Foco en Punjab. CI en GitHub. | 117 archivos, 52 de código. **CSV de CMIP6 descargados para la granja demo** (datos reales en el repo). LICENSE presente. | **Prototipo avanzado.** El más riguroso en datos. |
| **tejaswi-raghav/field-shift** | 2 commits, 2026-09-19 | Next.js + FastAPI. POWER, SoilGrids, SMAP como "adaptador sin datos" (lo marca UNAVAILABLE). MCDA determinista. Rotaciones de 3 años. Docker. | 131 archivos, 89 de código, tests de backend. | Prototipo. |
| **XtremeseOISHEE/RotaShift** | 5 commits, 2026-09-30 → 2026-10-07 | "Adaptation Margin": cuántos días puede correrse la temporada antes de que la rotación falle (haor y Barind, Bangladesh). | **2 archivos (README + un HTML).** Declara que todas las cifras son de muestra. | Esqueleto o maqueta. Idea original. |
| anirban-islam/farmstack; Spongly/FarmShift (Nepal); ameerul-muminin/anthropocene-spaceapps-2026 (juego); hamza0312615/AgriTwin (Android); imarwanmokhtar/fieldshift; xosirat/farmshift; ScriptySphere/Krishi-Bondhu ("coming soon") | — | Planificadores basados en POWER, un juego y una app Android. | No clonados. | [SNIPPET] |

Patrón común [LEÍDO + INFERENCIA]: NASA POWER + SoilGrids + reglas FAO (EcoCrop, FAO-56) + puntuación multicriterio de rotaciones. Se repite el foco en Asia del Sur (Punjab, Bangladesh, Nepal).

#### 4.2.2 Alternativas existentes

| Alternativa | Etiqueta |
|---|---|
| Desafíos agro de Space Apps 2024 ("Leveraging Earth Observation Data for Informed Agricultural Decision-Making") y 2025 ("NASA Farm Navigators") → cientos de proyectos previos equivalentes | [SNIPPET] (existencia de las URL) |
| NASA POWER (incluye su "Data Access Viewer" agroclimático); NASA Harvest / GEOGLAM Crop Monitor | [NO VERIFICADO: conocimiento previo; sin búsquedas] |
| Modelos de cultivo consolidados: FAO AquaCrop, DSSAT, APSIM (rotaciones y suelo con evidencia científica de décadas) | [NO VERIFICADO: conocimiento previo] |
| Herramientas comerciales y públicas de rotación o carbono (p. ej. COMET-Farm del USDA, plataformas agtech) | [NO VERIFICADO: conocimiento previo] |

#### 4.2.3 Más fuerte y saturación

- **Más fuerte 2026 verificado:** **sagar25446-prog/FieldShift-NASA** por profundidad de datos (CMIP6 real, Pareto, CI) y **samuelakosaonyejekwe/fieldshift** por alcance de producto (offline, multilingüe, simulación de 20 años). Ninguno de los dos se ejecutó.
- **Alternativa científica más fuerte:** AquaCrop, DSSAT y APSIM [NO VERIFICADO]. Un prototipo de 48 h no compite con ellos en validez agronómica. Su terreno es la accesibilidad y la explicabilidad.
- **Saturación: ALTA.** Además, el tema se repite en tres ediciones seguidas.

### 4.3 The Earth Information Jukebox

#### 4.3.1 Repos de equipos 2026 (9 encontrados; 3 clonados)

| Repo | Fechas (clon) | Declarado | Comprobado | Nivel |
|---|---|---|---|---|
| **Yoriichi-0u0/earth-fm** (BoboMimi) | 5 commits, 2026-10-14 | Sonificación de píxeles de frames del EIC (escaneo de 48 franjas, brillo→altura, RGB→armónicos, posición→paneo). "Trae tu frame" (imagen o video). 4 series climáticas (GISTEMP, CO₂ de Mauna Loa, nivel del mar, hielo NSIDC). Exportación WAV. Accesibilidad. | 51 archivos. `public/data/*.csv` con procedencia. Tests unitarios y E2E (Playwright). Docs `SONIFICATION.md` y `DATA.md`. Admite que no verificó los bytes oficiales del EIC (dominios bloqueados). | **Prototipo avanzado.** El más fuerte. |
| **ahsanur-official/The-Earth-Information-Jukebox** | 3 commits, 2026-09-18 | Motor web 1980–2025 con muchas variables y un narrador IA (Gemini). | `metadata.json` con `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`, que indica un andamiaje de Google AI Studio [INFERENCIA]. **Series cargadas a mano** en `src/data/nasaDatasets.ts`, con inconsistencias: 1985 = 0,16 por debajo del `min` 0,18 declarado. La única llamada a NASA es APOD. "Verified NASA data" es **sobredeclaración**. | Prototipo vistoso con datos débiles. |
| **jaherunhasanrimon/…Earth-Jukebox-Listen-to-a-Changing-Planet** | 1 commit, 2026-10-09 | GISTEMP v4 1880–2025 → melodía pentatónica, Web Audio, WCAG AA, demo en Vercel. | 45 archivos y 16 de código (`audioEngine.ts`, `mapping.ts`). Admite que no pudo leer el enunciado oficial. | Prototipo acotado y prolijo. |
| NASA-space-app-challenge-2026/shkim | (clon falló) | Globo 3D con audio espacial; Open-Meteo, NOAA, DONKI y USGS. | — | [SNIPPET] |
| Raiyan-Noor/team_spaced_out…; imtanjilsarkar/nabho-dhwani…; ritesh-sarkar/earth-616 (propuesta); AhmadZubayer/ByteAero… (Dhaka); Nephophile06/PrismTone (Tone.js + FastAPI; POWER, FIRMS, GRACE) | — | De CLI a WAV, hasta propuestas sin implementar. | — | [SNIPPET] |

#### 4.3.2 Alternativas existentes

| Alternativa | Etiqueta |
|---|---|
| Astronify (STScI): paquete Python de sonificación de series | [SNIPPET] |
| SonoUno, xSonify y Open Space Sonification (cráteres lunares → MIDI) | [SNIPPET] |
| Programas de sonificación de NASA ("A Universe of Sound" de Chandra; sonificaciones climáticas del SVS y Goddard); Highcharts Sonification Studio; TwoTone | [NO VERIFICADO: conocimiento previo; sin búsquedas] |
| Sonificaciones climáticas artísticas conocidas (p. ej. "A Song of Our Warming Planet") | [NO VERIFICADO: conocimiento previo] |

#### 4.3.3 Más fuerte y saturación

- **Más fuerte 2026 verificado:** **earth-fm**. Tiene tests, procedencia de datos y sonificación real de imágenes del EIC, que es lo que parece pedir el enunciado.
- **Alternativa más fuerte:** los programas propios de sonificación de NASA y herramientas genéricas como Highcharts Sonification Studio y TwoTone [NO VERIFICADO].
- **Saturación: ALTA en cantidad, media en calidad.** Es de nivel principiante, por lo que se esperan muchos equipos. La mayoría sonifica GISTEMP (anomalía de temperatura → altura). Ese mapeo es el más obvio y ya está repetido.

### 4.4 Be an Earth System Trend Detective / Dancing with the SARs

- Se confirmó solo la existencia de las URL oficiales [SNIPPET]. Contenido: detección de tendencias ambientales en datos de NASA, y radar NISAR para cambios en la superficie [SNIPPET secundario].
- **Repos de equipos, alternativas y saturación: NO INVESTIGADOS** (se agotó el presupuesto de búsqueda). [INFERENCIA, a validar]: para SAR existen herramientas maduras (ASF Vertex, HyP3/OPERA, ISCE, MintPy) y desafíos previos de Space Apps sobre SAR, como "InSAR Change Detectives" (2022) y "What on Earth is SAR" (2021), que aparecieron de pasada en una búsqueda [SNIPPET]. Las barreras técnicas (descargar y procesar NISAR en 48 h) probablemente reducen la cantidad de competidores maduros. Eso no está verificado.

---

## 5. Objeciones propias

1. **El enunciado de cada desafío lo reconstruyeron equipos competidores**, no lo leí en la fuente. Si el texto oficial del 28/10 cambia el foco (p. ej. pide área quemada en vez de focos, o una región concreta), parte del análisis de saturación se mueve.
2. **Las fechas de commit son indicio, no prueba.** Además, los repos son públicos y pueden reescribirse. Las métricas declaradas (R², Brier, Lin, ratios) **no se reprodujeron**.
3. **El sesgo de descubrimiento favorece a los repos bien indexados** (READMEs largos y en inglés). Puede haber competidores fuertes en otros idiomas o sin indexar. Los números de saturación son **mínimos**, no totales.
4. Las fechas de fin de vida de MODIS y S-NPP coinciden en tres repos independientes que citan URL con forma de aviso oficial, pero **no se abrió la fuente primaria**. Hay un snippet contradictorio (Terra "hasta diciembre de 2025").
5. La afirmación "FIRMS no armoniza" es inferencia por ausencia: no se pudo leer la documentación de FIRMS.
6. Varios desafíos tienen mucha actividad desde Bangladesh, India y Pakistán. Eso refleja dónde hay comunidades activas antes de la hackatón, no necesariamente dónde se concentrará la competencia de calidad.

---

## 6. Conclusiones

1. **MODIS/VIIRS es el desafío terrestre más saturado de propuestas maduras.** Hay al menos 13 repos; al menos 5 tienen pipeline real y demo pública, y uno (Kiln Watch) tiene un rigor estadístico difícil de superar en 48 h. El problema es real y urgente (S-NPP termina alrededor del 1–2/11/2026 y MODIS en 2027, según repos que citan avisos de NASA y NOAA), pero cualquier ángulo obvio ya está tomado: OLS o ratio en el solape, nubes, IC, NRT, NOAA-20/21, LLM, cobertura global.
2. **Field Shift está saturado y además es recurrente** (2024, 2025, 2026). Los mejores repos ya integran POWER, SoilGrids, CMIP6, SMAP y MODIS con optimización multicriterio. Frente a AquaCrop, DSSAT y APSIM, un equipo nuevo solo podría diferenciarse por usuario y explicabilidad, no por ciencia.
3. **Jukebox tiene mucha cantidad y calidad media.** El mapeo obvio (GISTEMP→altura) está repetido. El competidor más fuerte (earth-fm) ya sonifica píxeles de frames del EIC con tests. Es apto para principiantes y probablemente el que más equipos atraiga.
4. **Trend Detective y Dancing with the SARs quedaron sin relevar.** Por inferencia no verificada, SAR/NISAR podría tener menos competidores maduros por la barrera técnica. Es la mayor oportunidad potencial **no evaluada** de este bloque.
5. Todos los competidores relevantes muestran trabajo previo a la hackatón, pese a la regla del FAQ. Cómo trata esto el juzgamiento afecta directamente la competitividad de cualquier propuesta hecha "dentro de las reglas".

---

## 7. Tabla de fuentes

| URL | Qué afirma | Estado |
|---|---|---|
| https://www.spaceappschallenge.org/2026/challenges/harmonization-of-modis-and-viirs-hot-spots/ | El desafío existe | [SNIPPET]; WebFetch ENOTFOUND |
| https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/ | El desafío existe | [SNIPPET] |
| https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/ | El desafío existe | [SNIPPET] |
| https://www.spaceappschallenge.org/2026/challenges/be-an-earth-system-trend-detective/ | El desafío existe | [SNIPPET] |
| https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/ | El desafío existe (imagen NISAR) | [SNIPPET] |
| https://www.spaceappschallenge.org/2026/space-agency-partners/ | CONAE (desde 2021) e ISRO son socios en 2026 | [SNIPPET] |
| https://therecursive.com/nasa-space-apps-challenge-2026-where-to-join-it-in-cee | 14 desafíos con niveles; 6 terrestres; Jukebox principiante; Trend Detective y SARs | [SNIPPET]; proxy 403 |
| https://www.spaceappschallenge.org/2025/challenges/nasa-farm-navigators-using-nasa-data-exploration-in-agriculture/ y …/nasa-space-apps-2024/challenges/leveraging-earth-observation-data-for-informed-agricultural-decision-making/ | Antecedentes agro | [SNIPPET] |
| https://modis.gsfc.nasa.gov/sci_team/meetings/202204/presentations/session1/boschetti.pdf | Armonización MODIS/VIIRS de área quemada, 25 años a 0,25° | [SNIPPET] |
| https://pmc.ncbi.nlm.nih.gov/articles/PMC8914890 | Transición MODIS→VIIRS en volcanes; +60 % de alertas | [SNIPPET] |
| https://modis.gsfc.nasa.gov/sci_team/pubs/abstract_new.php?id=43566 | Himawari-8 frente a VIIRS y MODIS | [SNIPPET] |
| https://arxiv.org/pdf/2503.08580 | Predictibilidad MODIS frente a VIIRS | [SNIPPET] (título) |
| https://wiki.earthdata.nasa.gov/x/Co6rEQ | FIRMS/LANCE: MOD14/MYD14 + VIIRS 375 m | [SNIPPET] |
| https://pypi.org/project/nasa-wildfires/ | CLI de descarga de FIRMS | [SNIPPET] |
| https://www.earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs | MODIS termina en 2027 (según repos) | Citada en repos; ENOTFOUND; NO VERIFICADO |
| https://www.nesdis.noaa.gov/news/cessation-of-suomi-national-polar-orbiting-partnership-s-npp-data-users-onafter-november-2-2026 | Cese de S-NPP el 2/11/2026 | Citada en repos; ENOTFOUND; NO VERIFICADO |
| github.com/Aalvee-Aarham/kiln-watch | Ver §4.1.1 | [LEÍDO] clon (47 commits) |
| github.com/samuelakosaonyejekwe/firecal | Ver §4.1.1 | [LEÍDO] clon |
| github.com/shahmirkhan106/firelens | Ver §4.1.1 | [LEÍDO] clon, incluido `harmonize.py` |
| github.com/Hisernberg/ignis-public | Ver §4.1.1 | [LEÍDO] README y estructura |
| github.com/ImtiazIftii/NPC_SpaceApps | Ver §4.1.1 | [LEÍDO] README y estructura |
| github.com/Mosharrof8097/nasa_space_app_challange_2026 | Ver §4.1.1 | [LEÍDO] README y estructura |
| github.com/shahedrayhan23/Chronofire | Esqueleto | [LEÍDO] |
| github.com/Md-Sajeeb-Islam/FIREMAP-X, SOHAM-0409/NASA-Space-App-Challenge, ehasanulhaque152/EarthFire, nasifnaser06-cyber/Project_S.H.I.F.T, Aalvee-Aarham/kiln-watch-2026, 1-abesh-1/NPC_SpaceApps | Repos de MODIS/VIIRS | [SNIPPET] |
| github.com/samuelakosaonyejekwe/fieldshift | Ver §4.2.1 | [LEÍDO] clon |
| github.com/sagar25446-prog/FieldShift-NASA | Ver §4.2.1 | [LEÍDO] clon |
| github.com/tejaswi-raghav/field-shift | Ver §4.2.1 | [LEÍDO] clon |
| github.com/XtremeseOISHEE/RotaShift | Maqueta | [LEÍDO] clon |
| github.com/anirban-islam/farmstack, Spongly/FarmShift, ameerul-muminin/anthropocene-spaceapps-2026, hamza0312615/AgriTwin, imarwanmokhtar/fieldshift, xosirat/farmshift, ScriptySphere/Krishi-Bondhu | Repos de Field Shift | [SNIPPET] |
| github.com/Yoriichi-0u0/earth-fm | Ver §4.3.1 | [LEÍDO] clon |
| github.com/ahsanur-official/The-Earth-Information-Jukebox | Ver §4.3.1 | [LEÍDO] clon, incluido `nasaDatasets.ts` |
| github.com/jaherunhasanrimon/NasaSpaceApp1stPrototype_Earth-Jukebox-Listen-to-a-Changing-Planet | Ver §4.3.1 | [LEÍDO] clon |
| github.com/NASA-space-app-challenge-2026/shkim, Raiyan-Noor/team_spaced_out_earth_information_jukebox, imtanjilsarkar/nabho-dhwani-earth-jukebox, ritesh-sarkar/earth-616, AhmadZubayer/ByteAero-Earth-Jukebox-Guardian-of-Dhaka-NSAC-2026, Nephophile06/PrismTone | Repos de Jukebox | [SNIPPET]; el clon de shkim falló |
| astronify.readthedocs.io; ascl.net/1207.008 (xSonify); Pi-Kay/Open-Space-Sonification | Herramientas de sonificación | [SNIPPET] |

---

## 8. Pendientes

1. **Leer los enunciados oficiales el 28/10** y re-derivar el foco de cada desafío (en particular: qué exige el desafío MODIS/VIIRS sobre región, focos o área quemada, y NOAA-20/21).
2. **Trend Detective y Dancing with the SARs:** buscar repos 2026, herramientas (ASF Vertex, OPERA, HyP3, MintPy) y saturación. Requiere nuevo presupuesto de WebSearch.
3. Verificar en fuente primaria las fechas de fin de S-NPP (NOAA NESDIS) y de MODIS Terra y Aqua (Earthdata).
4. Verificar si FIRMS, GWIS o EFFIS ofrecen alguna serie armonizada o un "satélite de referencia" (como INPE Queimadas), y si CONAE propuso el desafío MODIS/VIIRS.
5. Si se considera alguno de estos desafíos: ejecutar (en sandbox) los 2–3 competidores más fuertes para comprobar sus métricas declaradas.
6. Aclarar cómo trata el juzgamiento el trabajo previo a la hackatón, ya que todos los competidores fuertes lo tienen.
