# A10 — Cobertura de huecos: Dancing with the SARs, Earth System Trend Detective y Planet X and SPHEREx

Agente: A10. Fecha: 21/10/2026. Fuentes: resúmenes del 17/09/2026, leídos solo de forma secundaria (ver A1). Los enunciados completos se publican el 28/10 y **nadie los leyó**. Todo lo que este informe dice sobre datos oficiales, entregables y criterios es **[INFERENCIA]**.

IDs según A1: **C06** Dancing with the SARs, **C02** Be An Earth System Trend Detective!, **C12** Planet X and SPHEREx.

---

## 1. Misión

Cubrir para C06, C02 y C12 las funciones que no se hicieron:

- **A2:** competencia y herramientas existentes.
- **A4:** datos y viabilidad.
- **A5:** originalidad.
- **A7:** rigor.
- **A6:** demo.

No se escribió código de solución. No se ejecutó código de terceros. No se hicieron commits.

## 2. Método y restricciones

### 2.1 Búsquedas web

Se hicieron **16 de las ~40 permitidas**.

| # | Consulta (dominio) | Resultado útil |
|---|---|---|
| 1 | "Dancing with the SARs" github 2026 (abierta) | Nada: el buscador lo confundió con "Dancing with the Stars" |
| 2 | "Trend Detective" NASA Space Apps 2026 github (abierta) | Nada específico |
| 3 | "Planet X and SPHEREx" github (abierta) | Solo info general de SPHEREx/IRSA |
| 4 | NISAR space apps 2026 surface change (github.com) | 10 repos de C06 |
| 5 | SPHEREx space apps 2026 moving objects (github.com) | 10 repos de C12 |
| 6 | earth system trend detective space apps Mann-Kendall (github.com) | 10 repos de C02 |
| 7 | NISAR GCOV provisional data public release ASF 2026 | Estado de liberación de NISAR |
| 8 | SPHEREx data release IRSA quick release 2026 AWS | QR2/QR3 y registro AWS |
| 9 | "Dancing with SARs" OR "dancing-with-the-sars" NISAR (github.com) | +4 repos de C06 |
| 10 | "Planet X" SPHEREx NASA Space Apps 2026 challenge team (github.com) | +7 repos de C12 |
| 11 | "Trend Detective" … Sen's slope (github.com) | +6 repos de C02 |
| 12 | Backyard Worlds Planet 9 WISE … 2026 | Estado de Backyard Worlds |
| 13 | Giovanni NASA GES DISC trend map … | Capacidades de Giovanni |
| 14 | ASF Vertex NISAR HyP3 OPERA DISP-S1 2026 | Soporte de NISAR en HyP3: no confirmado |
| 15 | NISAR data access Earthdata login … size | Login obligatorio para descargar |
| 16 | Space Apps SAR challenge global winner … | No se encontró un ganador global de SAR |

### 2.2 Clones de repos

- Se clonaron 26 repos con `git clone --depth 1 --filter=blob:none --no-checkout`, en `/tmp/claude-0/-home-user-noven-ia/7029a718-8690-52ad-a08e-e11704dd6284/scratchpad/repos/`.
- Se leyeron los README completos y se revisó código puntual con `git show`.
- Falló un clon: `lemoon01110/tracklet`. Además, raw README devolvió 404 (probablemente la rama no es `main`).

### 2.3 Sondeo de endpoints

Se usó `curl` desde este entorno. Los resultados están en la §5.

- Todo `*.nasa.gov`, `caltech.edu` y `alaska.edu` devolvió `000`: bloqueado por el proxy, igual que en el BRIEF.
- Los buckets S3 públicos de AWS sí respondieron.
- Un `000` aquí **no** prueba que el servicio exija credencial. Solo prueba que es inaccesible desde este entorno.

---

## 3. C06 — Dancing with the SARs (NISAR)

### 3.1 Competencia (A2)

Se encontraron **≥14 repos 2026**: 9 leídos, 5 solo [SNIPPET].

| Repo | Último commit | Qué es | Datos reales | Estado (evidencia) |
|---|---|---|---|---|
| **mahdimahmud2006-coder/nasa_space-apps_challenge** ("TerraPulse", equipo DevAtMad) | 14/10/2026 | Plataforma offline de investigación de cambio. Combina GCOV HH con NASADEM, POWER, Landsat y el Global Landslide Catalog. Incluye "Change DNA", swipe antes/después, modelo de inundación "explicable" no calibrado y 3D WebGL | **Sí:** 3 GCOV PROVISIONAL (19/08, 31/08 y 12/09/2026), Kathmandu, Track 98 / Frame 16. Hay `.tif` de contexto en el repo (641 archivos) | **Prototipo avanzado** [LEÍDO README]. Hay código real: `src/ingest/extract_gcov.py` y `src/compute/change.py` (dB delta, MAD) [CÓDIGO, revisión parcial]. El README declara 169 tests Python y 25 JS (no ejecutados). Su disclaimer es honesto: causa "UNVERIFIED", modelos "UNCALIBRATED" |
| Sidvortex/OpenSource-SAR ("SARabande") | 30/09/2026 | Globo con 19 hotspots, agua (Tonle Sap), sismos, hielo, fuego y cultivos | **No:** "Demo data is synthetic", rotulado en cada pantalla. El pipeline existe para procesar datos reales (`pipeline/nisar_io.py`, `water_dance.py`, `quake.py`, `ice.py`) | Prototipo con pipeline real y datos sintéticos [LEÍDO README + árbol de archivos] |
| nabil24024004/Team-Zenith-Dancing-With-SARs | 17/10/2026 | CesiumJS, proxy autenticado a Earthdata, Supabase y comparación de 2 granules (umbral Otsu de agua) | Declara consulta CMR en vivo y descarga autenticada | Prototipo con UI pulida [LEÍDO README]; funcionalidad declarada, no comprobada |
| satvikp-coder/terrascope-ai | 18/10/2026 | Investigación previa. Inundaciones en Majuli/Assam | 2 GCOV PROVISIONAL (15/08 y 27/08/2026), "CONDITIONALLY_READY". No descargó escenas HDF5 completas | Preparación y documentación. Muy cauto: "claims no detected floods" [LEÍDO] |
| methela57-sudo/Project-EchoSphere | 30/09/2026 | Web estática. Rótulos REAL / DEMO / LIVE. Usa CMR, GIBS (GCOV false color, OPERA DSWx, IMERG) | REAL solo si el usuario baja el `.h5` con login | Prototipo [LEÍDO] |
| iams1am/TerraCascade-Dancing-with-the-SARs-NASA | 29/09/2026 | Explorador de **una** muestra GUNW histórica (fechas de 2008, producto de muestra ASF) | Sí, una muestra. No usa observaciones operativas | Prototipo pequeño y honesto [LEÍDO] |
| 1obayed/Terracascade (Team Voyage) | 09/10/2026 | "Forecasting" de cambio. Escenarios "GUNW-style" y "GCOV-style" | Escenarios, no datos reales | Demo conceptual [LEÍDO] |
| Eusha122/-SARabande | 11/10/2026 | 3 archivos. Usa MODIS de GIBS como "stand-in" óptico | No | Esqueleto [LEÍDO] |
| munira0111/nasaspaceapp2026 | 08/10/2026 | — | — | README binario o ilegible |
| Fardin-Prodhan/Nova-Matrics---VI, snslighting/terrashift, Shafi31570/earth-metamorphosis, iamtanim0195/nasa1, "NISAR FloodWatch" | — | Dashboards, catálogo y coherencia + GNSS, inundaciones | FloodWatch: "relies largely on demo data" | [SNIPPET] |

#### Competidor más fuerte verificado

**TerraPulse.** Es el único repo leído que procesa **varias escenas GCOV reales de 2026** sobre un AOI con contexto independiente y tiene un pipeline de código visible.

- Sus debilidades son [INFERENCIA]: usa solo la polarización HH, el área cubre 24 km × 24 km y mezcla modelos de riesgo no calibrados con la observación.
- Desde el punto de vista narrativo, un jurado podría verlo como "demasiadas cosas".
- Le sigue Sidvortex por amplitud, aunque con datos sintéticos.

#### Saturación

**Media-alta.** Hay ≥14 repos. La mayoría usa datos sintéticos o de muestra, o UI sobre catálogo. Los que procesan NISAR PROVISIONAL real son **pocos (2-3)**. La barrera técnica filtra la competencia de calidad, pero **no** filtra la cantidad.

#### Herramientas existentes

- **ASF Vertex / asf_search:** búsqueda de NISAR sin login. La descarga requiere login de Earthdata [SNIPPET, docs ASF; README de Sidvortex y EchoSphere].
- **HyP3:** en los resultados aparece para Sentinel-1. **No se encontró confirmación** de procesamiento NISAR en HyP3: existe un hilo del foro de ASF de febrero de 2026 sin respuesta visible [SNIPPET].
- **Roadmap de ASF:** herramienta de subsetting GCOV vía Harmony a COG ("in progress", junio de 2026), servicio de imagen GCOV pendiente para el tercer trimestre de 2026 y reproyección para el cuarto [SNIPPET].
- **GIBS:** ya sirve un layer "NISAR GCOV false-colour" [LEÍDO, README de EchoSphere; no verificado contra GIBS].
- **OPERA DSWx/DISP:** existen para Sentinel-1/HLS. Hacen que "mapa de agua" o "deformación" no sea novedoso en sí [INFERENCIA].
- **Desafíos previos de Space Apps sobre SAR:** 2021 y 2022 según A2b [SNIPPET]. No se encontró ningún ganador global de SAR en los listados de 2020-2022 (búsqueda 16).

### 3.2 Datos y viabilidad (A4)

#### Estado de NISAR

- **BETA:** el 27/02/2026 se liberaron más de 100.000 productos L1-L3 (más de 500 TB).
- **PROVISIONAL:** liberado el 20/07/2026 (CRID P05023). Cubre adquisiciones desde el 17/06/2026, con calibración completa y validación en sitios limitados.
- **Banda S (ISRO):** liberada el 24/07/2026 vía Bhoonidhi.

Todo esto es [SNIPPET, docs ASF y web de ISRO]. TerraPulse y terrascope confirman de forma independiente la colección `NISAR_L2_GCOV_PROVISIONAL_V1` y la DOI 10.5067/NIL2GCOV-P1 [LEÍDO].

#### Acceso

- **Búsqueda** (CMR o asf_search): sin credencial [SNIPPET].
- **Descarga:** requiere **Earthdata Login**, que es gratuito y se obtiene al instante [SNIPPET, docs ASF "earthaccess"; varios README].
- **Desde este entorno:** `cmr.earthdata.nasa.gov`, `api.daac.asf.alaska.edu`, `nisar.asf.earthdatacloud.nasa.gov` y `nisar-docs.asf.alaska.edu` devolvieron todos **000** (proxy).
- **No se encontró un bucket S3 público de NISAR** sin credencial. Los datos están en AWS us-west-2 detrás de CloudFront y Earthdata Login [SNIPPET].

#### Tamaño

- No hay cifra verificada por granule.
- Según A1, los HDF5 de 240 km de swath "con muchos datasets" son grandes [SNIPPET ARSET]. TerraPulse recorta a 2.400 × 2.400 px a 10 m.
- [INFERENCIA, NO VERIFICADO]: del orden de GB por granule GCOV. Con subsetting Harmony podría bajar a MB.

#### Dificultad en 48 h

**Alta.** Implica HDF5 con geometría propia, speckle, elegir polarización y frecuencia (L 20/40 MHz), alinear pares de la misma órbita y frame, y entender los "known issues" del producto PROVISIONAL.

#### Factibilidad de demo: 3 de 5

- Sube a 4 si el enunciado del 28/10 trae granules o recortes curados.
- Baja a 2 si hay que descubrir pares y bajar HDF5 completos durante el evento.

#### Riesgo de reglas

Preparar la cuenta de Earthdata antes del evento es razonable. Bajar y pre-procesar escenas antes del 14/11 roza la regla de "no empezar a trabajar antes" [INFERENCIA, ver A8].

### 3.3 Originalidad (A5)

Hay tres direcciones posibles, cada una con su problema, usuario, motivo para preferirla, límite de afirmación y criterio de invalidación.

**D1. "¿Cambio real o artefacto?": auditoría de pares NISAR antes de interpretar.**

- **Problema:** gran parte del "cambio" en backscatter es humedad de suelo, viento sobre el agua, geometría distinta o issues del producto PROVISIONAL. Los equipos lo marcan como "UNVERIFIED", pero no lo cuantifican.
- **Usuario:** analista de riesgo municipal o periodista científico que recibe un mapa de cambio.
- **Por qué no alcanzan las alternativas:**
  - Los repos vistos muestran el cambio y lo descalifican en un disclaimer.
  - Ninguno mide la variabilidad "sin evento" del mismo píxel en pares de control.
- **Qué no se puede afirmar:** que el cambio sea inundación o deformación; que el umbral valga fuera del AOI; una precisión sin verdad de terreno.
- **Qué la invalidaría:** que haya menos de 3 adquisiciones comparables (misma órbita y frame) en el AOI elegido; o que los productos PROVISIONAL tengan un issue de calibración que domine la señal.

**D2. Seguimiento de agua estacional bajo nubes contra un sensor óptico independiente.**

- **Problema:** en temporada de monzón o lluvias, lo óptico falla.
- **Usuario:** gestores de humedales o de embalses.
- **Por qué no alcanzan las alternativas:** OPERA DSWx-S1 ya mapea agua con Sentinel-1, así que la novedad debe ser **banda L** (penetra la vegetación: agua bajo dosel) o la cadencia combinada.
- **Qué no se puede afirmar:** que supere a OPERA; que detecte agua bajo dosel sin validación.
- **Qué la invalidaría:** que OPERA o GIBS ya publiquen un producto NISAR de agua equivalente; o que no haya adquisiciones HV para estimar volumen.

**D3. Explicador de "qué puede y qué no puede ver el radar" para un evento concreto.**

- **Problema:** el público no entiende SAR.
- **Usuario:** educadores.
- **Por qué no alcanzan las alternativas:** abundan los globos 3D con hotspots (Sidvortex, Zenith). Solo sería original si cada afirmación se ata a un píxel real.
- **Qué no se puede afirmar:** que enseña mejor sin una prueba con usuarios.
- **Qué la invalidaría:** la saturación de globos y narrativas ya vista. Hoy es N bajo.

### 3.4 Rigor (A7)

**Afirmaciones engañosas típicas:**

- "Detectamos la inundación o el deslizamiento" a partir de un Δσ° sin verdad de terreno.
- "Deformación de X cm" desde GUNW sin corrección atmosférica, sin referencia o con la convención de signo dudosa. Sidvortex admite que su convención de signo está sin verificar.
- "Forecast" o "IA" de cambio futuro a partir de 2-3 escenas.
- Presentar escenas de muestra de 2008 o sintéticas como observaciones de 2026.
- Ignorar la etiqueta PROVISIONAL.

**Rigor alcanzable en 48 h: 3 de 5.** Es posible si el alcance es "cambio de backscatter con incertidumbre" y no "causa".

**Validación mínima:**

1. Par de control sin evento: cuantificar la dispersión de ΔdB en zonas estables.
2. Contraste con una fuente independiente: lluvia (GPM o POWER), un óptico sin nubes o un catálogo de eventos como el GLC.
3. Declarar CRID, polarización y frecuencia.
4. Análisis de sensibilidad del umbral (±dB).

### 3.5 Demo y UX (A6)

**Momento "wow" creíble en 30 s:** un slider antes/después sobre la misma zona, con la imagen óptica tapada por nubes de un lado y el radar mostrando el agua del otro. Debajo, un número honesto: "X km² cambiaron más que la variabilidad del par de control (±Y dB)".

**Riesgos de demo:**

- No encontrar pares a tiempo.
- HDF5 pesado.
- Earthdata caído o lento.
- Un jurado que no distingue entre lo sintético y lo real (si se usan datos sintéticos hay que rotularlos).
- La competencia ya tiene sliders y 3D: el "wow" visual no diferencia, el número con control sí.

---

## 4. C02 — Be An Earth System Trend Detective! (avanzado)

### 4.1 Competencia (A2)

Se encontraron **≥15 repos 2026**: 8 leídos, el resto [SNIPPET].

| Repo | Último commit | Qué es | Datos | Estado |
|---|---|---|---|---|
| **Fibananagucchi/EarthTrendTest** | 15/10/2026 | Streamlit. Mann-Kendall estacional con corrección **Hirsch-Slack**, Sen estacional, OLS con n efectivo (lag-1), corrección por pruebas múltiples sobre 16 variables, lenguaje llano con "For experts" | Demo con datos NASA reales empaquetados (`demo_cubes.npz`). En vivo vía Google Earth Engine: MOD13A3, HLS, MOD11A2, IMERG, MOD16, GRACE/GRACE-FO | **Prototipo avanzado.** Código verificado en `trends.py`: docstrings con Hirsch-Slack 1982/1984 y ajuste por autocorrelación [CÓDIGO, revisión parcial]. Tiene tests y un `llm_summary.py` |
| shahriarkhansakib/Hritu | 14/10/2026 | MK modificado (Hamed y Rao), Theil-Sen, Pettitt; veredicto REAL / WEAK / NOISE; casos de Bangladesh; offline-first | POWER, IMERG, MODIS, FIRMS, VIIRS (`src/acquire/*`) | Prototipo avanzado con demo en Vercel [LEÍDO README + árbol]. Riesgo: un umbral binario p<0,05 como "REAL TREND" |
| nasa-earth-detectives/nasa-earth-trend-detective | 02/10/2026 | .NET 10 + DuckDB + React 19, globo 3D, "Opposing Trends Engine"; equipo de varios integrantes (colombiano, por los nombres y el idioma) | GISTEMP, MODIS NDVI, GRACE-FO, OCO-2, Sentinel-6 | Producto pulido declarado ("Demo Jurado NASA" en Vercel) [LEÍDO README]. MK con \|Z\|>1,96 sin corrección por autocorrelación declarada |
| takiibneduha3-ux/earthtrend-detective ("Earth Forensics") | 04/10/2026 | MK modificado + Theil-Sen + corrección por pruebas múltiples espaciales | POWER | Prototipo [LEÍDO] |
| SaifullahMnsur-Again/EarthScope | 10/10/2026 | Diseño: Benjamini-Hochberg (FDR), "insufficient data", sensibilidad a la ventana temporal | POWER (candidata) | **Solo README** (1 archivo) [LEÍDO] |
| Watcher-ux/Earth-Trend-Detective | 27/09/2026 | Globo 3D; MK + Sen | POWER, NSIDC, PO.DAAC | Prototipo [LEÍDO] |
| cpt9m0/trend-detective | 29/09/2026 | Andamiaje; catálogo de 8 colecciones verificadas en CMR | Demo sintética | Andamiaje [LEÍDO] |
| yasar-sys/living-earth-trend-detective | 22/09/2026 | MK + Sen (pymannkendall) | **Placeholders sintéticos** | Prototipo temprano [LEÍDO] |
| jitenkr2030, SalehSeam/EarthPulse, samir11441S/EarthScope, shovon-vubon/echo-earth, nabeulislam, 12402111/Where_the_land_go, yasar-sys/…-nasc | — | SMAP en Jharkhand; POWER; Landsat + BH-FDR | — | [SNIPPET]. Algunos podrían ser de otros desafíos |

#### Competidor más fuerte verificado

**EarthTrendTest (Fibananagucchi).** Combina estadística correcta para series autocorrelacionadas y estacionales, datos reales y explicación para legos. Le siguen Hritu (rigor y narrativa local) y nasa-earth-detectives (pulido y equipo grande).

#### Saturación

**Alta**, y el método es una commodity: MK + Sen aparece en casi todos los repos. Hasta las correcciones "avanzadas" (Hamed-Rao, Hirsch-Slack, BH-FDR) ya están tomadas por al menos 4 repos.

#### Herramientas existentes

- **Giovanni** (GES DISC): mapas y series promediadas por área, sin test de significancia en lo encontrado [SNIPPET, búsqueda 13].
- **Worldview/GIBS:** visualización, no inferencia [dato conocido, NO VERIFICADO aquí].
- **Fuera de NASA:** Google Earth Engine con `ee.Reducer.kendallsCorrelation` / `sensSlope` [INFERENCIA / dato conocido].
- **Paquetes estándar:** pymannkendall, xarray [INFERENCIA].

### 4.2 Datos y viabilidad (A4)

- **Sin credencial y verificado aquí:** bucket S3 `nasa-power`, **HTTP 200** con listado público (Zarr, por ejemplo `flashflux/spatial/power_flashflux_daily_spatial_lst.zarr`).
- **Bloqueados por el proxy (000):** la API de POWER (`power.larc.nasa.gov`), GISTEMP (`data.giss.nasa.gov`), GIBS y Giovanni.
  - [INFERENCIA / A4]: POWER y GISTEMP son públicos y sin key fuera de este entorno.
- **Con Earthdata Login:** MODIS (LP DAAC), IMERG (GES DISC), GRACE (PO.DAAC), SMAP.
- **Tamaño:** pequeño si se trabaja en punto o región (KB-MB). Moderado si se trabaja en grilla global multianual: decenas de GB, salvo con Zarr en la nube o con agregados.
- **Dificultad en 48 h:** **baja en lo técnico, alta en lo científico**: hay que manejar estacionalidad, autocorrelación, huecos, cambios de sensor o versión y pruebas múltiples espaciales.
- **Factibilidad de demo: 5 de 5.** Es el desafío con datos más accesibles de los tres.

### 4.3 Originalidad (A5)

**D1. "Tendencia vs. cambio de instrumento": detector de rupturas no climáticas.**

- **Problema:** una tendencia "significativa" puede venir de un cambio de sensor o de versión (por ejemplo, de MODIS Terra a VIIRS, o de la colección 5 a la 6.1), de un hueco o de un cambio de algoritmo del reanálisis.
- **Usuario:** analistas que usan los datos para decidir.
- **Por qué no alcanzan las alternativas:** los repos vistos aplican Pettitt o MK sobre la serie, pero **no cruzan los puntos de cambio con las fechas de transición de productos ni con una segunda fuente independiente**.
- **Qué no se puede afirmar:** que una ruptura coincidente sea un artefacto (solo es sospecha); un catálogo completo de transiciones sin verificarlo.
- **Qué la invalidaría:** que el enunciado restrinja a una variable de un solo sensor sin cambios de versión; o que ya exista en otro repo (no visto en 15 repos, N medio).

**D2. "¿Coinciden las fuentes?": concordancia de tendencia entre dos productos NASA de la misma variable.**

- **Ejemplos:** precipitación IMERG vs. MERRA-2 vs. POWER; temperatura LST de MODIS vs. T2M de MERRA-2.
- **Problema:** el usuario no sabe si la tendencia depende del producto elegido.
- **Usuario:** educadores y decisores.
- **Por qué no alcanzan las alternativas:** los repos eligen una sola fuente por variable.
- **Qué no se puede afirmar:** cuál producto "es el verdadero"; que la concordancia pruebe causalidad.
- **Qué la invalidaría:** que las fuentes no sean independientes (MERRA-2 asimila observaciones que también usa POWER). Eso puede invalidar la "concordancia" como evidencia y debe declararse.

**D3. Potencia estadística antes que p-valor: "¿cuántos años más hacen falta para saberlo?".**

- **Problema:** la ausencia de significancia se lee como "no hay cambio".
- **Usuario:** público y prensa.
- **Por qué no alcanzan las alternativas:** solo EarthScope habla de "insufficient data" (y solo en el README). Ninguno estima el tamaño de efecto detectable ni los años necesarios dados la varianza y la autocorrelación (al estilo Weatherhead et al. 1998 [dato conocido, NO VERIFICADO aquí]).
- **Qué no se puede afirmar:** predicciones de la tendencia futura.
- **Qué la invalidaría:** que el jurado lo perciba como demasiado abstracto; o que haya supuestos de estacionariedad no defendibles.

### 4.4 Rigor (A7)

**Afirmaciones engañosas típicas:**

- "Tendencia significativa" con MK ingenuo sobre datos mensuales autocorrelacionados.
- Mapas de píxeles significativos sin control FDR ni significancia de campo.
- Atribuir causa ("por el cambio climático" o "por la deforestación").
- Extrapolar Sen's slope.
- Mezclar productos de reanálisis o modelo con observación sin declararlo.
- Elegir la ventana temporal para que dé significativo (*p-hacking*).

**Rigor alcanzable: 4 de 5.** Es el más alto de los tres: los métodos son estándar y verificables.

**Validación mínima:**

1. Serie sintética sin tendencia con AR(1) para medir la tasa de falsos positivos del método.
2. Reproducir una tendencia publicada (por ejemplo, GISTEMP global).
3. Sensibilidad a la ventana.
4. BH-FDR en mapas.
5. Rotular observación, modelo o reanálisis.

### 4.5 Demo y UX (A6)

**"Wow" creíble:** el mismo lugar con dos veredictos. El MK ingenuo dice "significativo"; corregido por autocorrelación dice "todavía no se puede saber", más "harían falta N años". Es contraintuitivo, verificable y breve.

**Riesgos:**

- Parecerse a los otros 15 dashboards.
- Que la sutileza estadística no se entienda en 30 s.
- La API de POWER u otra fuente caída en vivo: hay que cachear.

---

## 5. C12 — Planet X and SPHEREx (avanzado)

### 5.1 Competencia (A2)

Se encontraron **≥17 repos 2026**: 9 leídos, el resto [SNIPPET]. Es **el desafío más saturado de los tres en cantidad**, con un nivel técnico tope muy alto.

| Repo | Último commit | Qué es | Validación | Estado |
|---|---|---|---|---|
| **shrestha-droid/spherex-moving-sky** | 15/10/2026 | Recuperación de asteroides conocidos con JPL `sb_ident` y Horizons desde la órbita de SPHEREx; búsqueda ciega rápida (2-150″/h) y lenta "Planet X mode" (0,3-3″/h); espectros con PSF por zona; lecturas por rango HTTP de FITS de QR2; panel en vivo en Vercel; exportación ADES | Test de falsas alarmas por rotación de seeds (30 trials), inyección sintética con curva de profundidad, filtro de artefactos en el mismo píxel. Makemake y Haumea encontrados a ciegas, con 0 tracks no identificados frente a 0,8 y 0,03 esperados por azar (declarado) | **Prototipo avanzado y científicamente cuidadoso.** Código verificado: `detect.py` contiene `false_alarms`, `inject`, `recovered`, `link` y `match` [CÓDIGO, revisión parcial]. Resultados numéricos **declarados**, no reproducidos |
| samuelakosaonyejekwe/skyshift | 04/10/2026 | "Hunt": alineación, test de forma (contra rayos cósmicos), detector gemelo co-apuntado, flags de calidad, match con más de 55.000 asteroides y cometas (N-body propio), 2MASS y WISE; catálogo de frames rehecho cada 6 h; lectura directa del bucket S3 por rango desde el browser | Contra Horizons: 0,2-3″ en asteroides (declarado) | Producto web en vivo (GitHub Pages) [LEÍDO README] |
| roshcr6/NASA2026 | 14/10/2026 | 3D (Three.js), blink, SIA v2, fallback a S3, dossiers de evidencia | Rotulado "candidate signals" | Prototipo [LEÍDO] |
| OfficialArpitNege/nasa_spherex | 28/09/2026 | TAP + datalink + cutouts | "Planet X is not detected" | Prototipo (8.371 archivos, probablemente con datos) [LEÍDO] |
| kamikaze1120/skyshift | 12/10/2026 | 433 Eros recuperado en 2 cutouts reales | Caso único | Temprano [LEÍDO] |
| gitmahin/planetx-spherex, ProgrammerJibon/ChronoSpatial, Radit-Raian/InfraSphere, skibidimama106-lang/BlinkSky | 10-20/10/2026 | Blink, diferencia, tiles HEALPix, juego | — | Prototipos [LEÍDO] |
| lemoon01110/tracklet | — | Paralaje; NEP: 3.324 detecciones, 378 en movimiento, 0 candidatos | — | [SNIPPET]; clon fallido |
| Santiagox01, sreenath1212/skyshift-spherex, Mahadi5577/skyshift, satyam46inv137, wm208727-png/COSMO-CLASS, rafincs3023-cyber/SpectraShift | — | Varios | — | [SNIPPET] |

#### Competidor más fuerte verificado

**shrestha-droid/spherex-moving-sky.** Su validación es la que pediría un astrónomo: recuperación de conocidos, inyección y recuperación, falsos positivos por permutación, y prueba en objetos lentos reales. **samuelakosaonyejekwe/skyshift** es el más fuerte como producto público.

#### Saturación

**Muy alta, con techo técnico muy alto.** Las ideas obvias (blink, diferencia, match con JPL, juego ciudadano, panel en vivo, "Planet X mode") ya están implementadas y validadas por al menos un equipo.

#### Herramientas existentes

- **IRSA SPHEREx Data Explorer, SIA, TAP y cutouts** [SNIPPET; README].
- **IRSA MOST** (Moving Object Search Tool) [LEÍDO, README de kamikaze1120].
- **JPL Horizons, `sb_ident` y SBDB.**
- **Backyard Worlds: Planet 9:** ciencia ciudadana con WISE desde 2017. Su paper de abril de 2026 reporta 3.006 enanas L/T nuevas y ninguna detección de Planeta 9 [SNIPPET, arXiv 2604.01323]. Es el antecedente conceptual directo: "blink" multi-época para buscar un planeta distante.

### 5.2 Datos y viabilidad (A4)

**Sin credencial y verificado aquí: bucket `nasa-irsa-spherex`, HTTP 200 [LEÍDO, listado XML].**

- Prefijos `qr2/` y `qr3/`.
- `qr2/level2/` tiene **130 semanas**, de `2025W17_4B` a `2026W29_2A`.
- `qr3/level2/` tiene **15 prefijos**, entre ellos `2026W36_2A`.
- Cada FITS L2 pesa **71.634.240 B (~68 MiB)**.
- El **range GET funciona** (HTTP 206 con 2.880 B de header). Eso permite leer solo cabeceras o recortes, como hacen shrestha-droid y samuelakosa.

**Bloqueados aquí (000):** IRSA TAP/SIA y JPL SBDB. Son públicos sin key fuera de este entorno [INFERENCIA, varios README].

**Dificultad en 48 h:** alta. Implica FITS, WCS con SIP, 102 canales (la longitud de onda varía por píxel), PSF, cadencia irregular, rayos cósmicos y artefactos. La parte de recuperación de conocidos es tratable.

**Factibilidad de demo: 4 de 5** con datos (accesibles y con range requests). **1 de 5** para "Planet X".

### 5.3 Originalidad (A5)

**D1. "Límite de detección honesto": mapa de qué volumen del espacio de parámetros de Planeta X descarta SPHEREx (en brillo, movimiento y región) y cuál no.**

- **Problema:** "no encontramos nada" no dice nada si no se conoce la sensibilidad.
- **Usuario:** público y astrónomos aficionados.
- **Por qué no alcanzan las alternativas:** shrestha-droid ya mide una curva de profundidad con inyección **en un campo**. Un mapa de cobertura y sensibilidad agregado sería extensión, no novedad radical: N medio-bajo.
- **Qué no se puede afirmar:** exclusión de Planeta 9 (la región predicha, la magnitud de ~22 en V y el movimiento <0,3″/h quedan fuera del modo de una semana); límites formales sin modelar la eficiencia completa.
- **Qué la invalidaría:** que la cadencia de 6 meses no permita linkear objetos lentos (el propio shrestha lo advierte).

**D2. Espectros de asteroides conocidos como producto ciudadano (clase taxonómica 0,75-5 µm).**

- **Problema:** SPHEREx es único por la espectroscopía, no por el blink.
- **Usuario:** educadores y aficionados.
- **Por qué no alcanzan las alternativas:** shrestha-droid ya lo hace con comparación contra SBDB. Además, el equipo de SPHEREx planea un catálogo espectral de objetos del sistema solar (LPSC 2024 [SNIPPET]). N bajo.
- **Qué no se puede afirmar:** clasificaciones nuevas sin calibración contra un estándar.
- **Qué la invalidaría:** la existencia de ese catálogo oficial.

**D3. Triaje ciudadano de "cambios" con controles ciegos (inyecciones y artefactos conocidos mezclados) para medir la calidad del voluntario.**

- **Problema:** la ciencia ciudadana produce falsos positivos.
- **Usuario:** proyectos tipo Zooniverse.
- **Por qué no alcanzan las alternativas:** BlinkSky y Mahadi5577 hacen juego sin medir la precisión del jugador. Backyard Worlds tiene su propio esquema (no leído).
- **Qué no se puede afirmar:** que mejora la ciencia ciudadana sin usuarios reales.
- **Qué la invalidaría:** que no haya tiempo de probarlo con personas en 48 h.

### 5.4 Rigor (A7)

**Afirmaciones engañosas típicas:**

- "Detectamos Planet X" o "candidato a Planeta 9".
- "Descubrimos N asteroides nuevos" sin linkear más de 3 épocas, sin control de falsos positivos y sin reportar al MPC.
- Confundir rayos cósmicos, ghosts, aurora o He (QR3 incluye `aurora_template` y `he_template` [LEÍDO, prefijos S3]) o estrellas variables con movimiento.
- Distancias por paralaje con una sola visita.

**Rigor alcanzable: 3 de 5** si el foco es recuperar conocidos con métricas. Baja a 1 de 5 si el foco es "Planet X".

**Validación mínima:**

1. Fracción recuperada de asteroides conocidos predichos por `sb_ident` en el campo.
2. Inyección y recuperación.
3. Tracks esperados por azar.
4. Ningún "nuevo" sin vetting stamps.

### 5.5 Demo y UX (A6)

**"Wow" creíble:** un blink de dos épocas reales en el que un punto se mueve, aparece la etiqueta de JPL con el nombre del asteroide, y luego se muestra su espectro. Ya lo tienen shrestha-droid y samuelakosa: no diferencia.

**Riesgos:**

- IRSA o S3 lentos en vivo.
- Expectativa sensacionalista del jurado y de la prensa.
- Competir contra dos productos ya en vivo y validados.

---

## 6. Objeciones propias

1. Las búsquedas de GitHub devuelven unos 10 resultados por consulta. Los conteos (≥14, ≥15, ≥17) son **cotas inferiores** y no hay datos de ranking. Puede haber repos privados o no indexados más fuertes.
2. "Competidor más fuerte" se basa en README más una revisión parcial del código. **No ejecuté nada**, así que los resultados numéricos (Makemake, 169 tests, etc.) son **declarados**.
3. Todos los repos evaluados tienen commits **anteriores al 14/11**. Su elegibilidad depende de la regla de trabajo previo (A8). Si se aplicara de forma estricta, el campo real sería muy distinto.
4. Los sondeos de endpoints de NASA fallaron por el proxy, no por el servicio. La afirmación "requiere Earthdata Login" para NISAR viene de un [SNIPPET] de la documentación de ASF más varios README coincidentes, no de una prueba propia.
5. Las cifras de liberación de NISAR (fechas, CRID, 100.000 productos) son [SNIPPET] de una página de ASF que el propio buscador marcó como "verificar la versión vigente".

## 7. Conclusiones

| Dimensión | C06 SARs | C02 Trend Detective | C12 SPHEREx |
|---|---|---|---|
| Repos 2026 encontrados (cota inferior) | ≥14 | ≥15 | ≥17 |
| Competidor más fuerte | TerraPulse (GCOV real ×3, pipeline) | EarthTrendTest (MK estacional Hirsch-Slack, datos reales) | spherex-moving-sky (inyección, falsos positivos, Makemake) |
| Techo de la competencia | Medio-alto | Medio-alto | **Muy alto** |
| Datos sin credencial (verificado aquí) | **No** (Earthdata Login; búsqueda libre) | Sí (S3 `nasa-power`, 200) | **Sí** (S3 `nasa-irsa-spherex`, 200/206) |
| Dificultad en 48 h | Alta | Baja técnica / alta científica | Alta |
| Demo (1-5) | 3 | 5 | 4 (1 si "Planet X") |
| Rigor alcanzable (1-5) | 3 | 4 | 3 |
| Espacio para originalidad | **Medio**: auditar artefactos con pares de control | Medio: rupturas de instrumento y potencia estadística | **Bajo**: lo obvio ya está hecho y validado |

[INFERENCIA]: **C12 parece el menos recomendable** para un equipo que empieza el 14/11, porque el mejor competidor ya resolvió lo que un jurado valoraría.

- **C06** ofrece la mejor relación entre barrera técnica y competencia de calidad (pocos procesan datos reales). Su riesgo de datos es alto.
- **C02** es el más seguro para la demo, pero el método es commodity. Solo se diferencia por una pregunta estadística no trivial (D1 o D3).

## 8. Tabla de fuentes

| URL | Qué afirma | Estado |
|---|---|---|
| https://github.com/mahdimahmud2006-coder/nasa_space-apps_challenge | TerraPulse, 3 GCOV PROVISIONAL de 2026, Kathmandu | [LEÍDO README + código parcial]; commit 14/10/2026 |
| https://github.com/Sidvortex/OpenSource-SAR | SARabande, datos sintéticos, pipeline real | [LEÍDO]; 30/09/2026 |
| https://github.com/nabil24024004/Team-Zenith-Dancing-With-SARs | CesiumJS + Earthdata proxy | [LEÍDO]; 17/10/2026 |
| https://github.com/satvikp-coder/terrascope-ai | GCOV PROVISIONAL, DOI 10.5067/NIL2GCOV-P1 | [LEÍDO]; 18/10/2026 |
| https://github.com/methela57-sudo/Project-EchoSphere | CMR/GIBS, capa NISAR en GIBS | [LEÍDO]; 30/09/2026 |
| https://github.com/iams1am/TerraCascade-Dancing-with-the-SARs-NASA | Muestra GUNW histórica | [LEÍDO]; 29/09/2026 |
| https://github.com/1obayed/Terracascade | Escenarios "GCOV-style" | [LEÍDO]; 09/10/2026 |
| https://github.com/Eusha122/-SARabande | MODIS como stand-in | [LEÍDO]; 11/10/2026 |
| Nova-Matrics---VI, snslighting/terrashift, Shafi31570/earth-metamorphosis, iamtanim0195/nasa1 | Repos de C06 | [SNIPPET] |
| https://github.com/Fibananagucchi/EarthTrendTest | MK estacional Hirsch-Slack, GEE | [LEÍDO + código parcial]; 15/10/2026 |
| https://github.com/shahriarkhansakib/Hritu | MK modificado (Hamed-Rao), Pettitt | [LEÍDO]; 14/10/2026 |
| https://github.com/nasa-earth-detectives/nasa-earth-trend-detective | .NET + React, GISTEMP/MODIS/GRACE/OCO-2 | [LEÍDO]; 02/10/2026 |
| takiibneduha3-ux/earthtrend-detective; SaifullahMnsur-Again/EarthScope; Watcher-ux/Earth-Trend-Detective; cpt9m0/trend-detective; yasar-sys/living-earth-trend-detective | Repos de C02 | [LEÍDO] |
| jitenkr2030, SalehSeam/EarthPulse, samir11441S/EarthScope, shovon-vubon/echo-earth, nabeulislam, 12402111/Where_the_land_go | Repos de C02 (algunos dudosos) | [SNIPPET] |
| https://github.com/shrestha-droid/spherex-moving-sky | Recuperación, inyección, Makemake/Haumea | [LEÍDO README, HOW_IT_WORKS + código parcial]; 15/10/2026 |
| https://github.com/samuelakosaonyejekwe/skyshift | App en vivo, S3 por rango, más de 55.000 objetos | [LEÍDO]; 04/10/2026 |
| roshcr6/NASA2026, OfficialArpitNege/nasa_spherex, kamikaze1120/skyshift, gitmahin/planetx-spherex, ProgrammerJibon/…ChronoSpatial, Radit-Raian/InfraSphere, skibidimama106-lang/BlinkSky | Repos de C12 | [LEÍDO] |
| lemoon01110/tracklet, sreenath1212/skyshift-spherex, Mahadi5577/skyshift, Santiagox01/SpaceApps2026, satyam46inv137/one-over-137-planet-x, wm208727-png/COSMO-CLASS, rafincs3023-cyber/SpectraShift | Repos de C12 | [SNIPPET] |
| https://nisar-docs.asf.alaska.edu/availability-overview/ | PROVISIONAL 20/07/2026, CRID P05023, BETA 27/02/2026 | [SNIPPET]; curl 000 |
| https://nisar-docs.asf.alaska.edu/roadmap | Harmony GCOV subsetting, servicio de imagen | [SNIPPET] |
| https://nisar-docs.asf.alaska.edu/earthaccess/ y /asf-search | Descarga con Earthdata Login | [SNIPPET] |
| https://www.isro.gov.in/NISARS_Band_SAR_Data_Products_Release.html | Banda S, 24/07/2026, Bhoonidhi | [SNIPPET] |
| https://forum.earthdata.nasa.gov/app.php/tag/ASF | Hilo "Will ASF HyP3 support NISAR?" | [SNIPPET]; respuesta no vista |
| https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_qr.html | QR1 → QR2, actualización semanal | [SNIPPET]; curl 000 |
| https://registry.opendata.aws/spherex-qr/ | SPHEREx QR en AWS Open Data, DOI 10.26131/IRSA652 | [SNIPPET] |
| https://nasa-irsa-spherex.s3.amazonaws.com/ | Bucket público: qr2 (130 semanas), qr3 (15), FITS de ~68 MiB, range OK | **[LEÍDO, curl 200/206]** |
| https://nasa-power.s3.amazonaws.com/ | Bucket público de POWER (Zarr) | **[LEÍDO, curl 200]** |
| https://arxiv.org/abs/2604.01323 | Backyard Worlds: 3.006 enanas L/T nuevas | [SNIPPET]; arXiv bloqueado |
| https://sees-rsrc.science.uq.edu.au/…/trend-detection.html y documentación de Giovanni (NTRS) | Giovanni: series y mapas sin test de significancia | [SNIPPET] |
| https://www.earthdata.nasa.gov/news/nasa-announces-winners-2022-global-space-apps-challenge (y 2020, 2021) | Ganadores de Best Use of Data sin SAR | [SNIPPET] |

## 9. Pendientes

1. **El 28/10:** leer los enunciados de C02, C06 y C12, en particular qué datos curados trae cada uno, qué entiende el desafío por "cambio" o "significativo" y si C12 pide explícitamente "Planet X".
2. Verificar fuera de este entorno: acceso real a NISAR con Earthdata Login, tamaño de un granule GCOV y existencia del subsetting Harmony.
3. Leer `HOW_IT_WORKS.md` y `REVIEW_RESPONSE.md` completos de shrestha-droid y reproducir (fuera de este entorno y con permiso) un resultado declarado.
4. Revisar cómo aplica la organización la regla de trabajo previo (A8): todos los competidores listados tienen commits de septiembre u octubre.
5. Revisar 5-10 repos más por desafío para afinar la saturación (cupo de búsqueda restante: unas 24).
