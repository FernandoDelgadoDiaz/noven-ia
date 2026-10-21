# A4 — Viabilidad técnica y disponibilidad de datos (NASA Space Apps 2026)

Agente: A4. Fechas de la investigación: 20 y 21/10/2026. Sigue `BRIEF.md`.

## Estado

**Completo, con alcance limitado.** La mayoría de los portales NASA están bloqueados desde este entorno. Los buckets S3 públicos de AWS Open Data sí responden y se verificaron a fondo. El cupo de WebSearch se agotó a mitad de la tarea (límite compartido de 200 búsquedas por turno), así que hay pendientes que necesitan búsqueda adicional (ver al final).

**Limitación de partida:** no leí ningún enunciado de desafío. spaceappschallenge.org devuelve `ENOTFOUND` vía WebFetch y 403 en el proxy. Los datos que asigno a cada desafío son **[INFERENCIA]** a partir del título; los recursos oficiales salen recién el 28/10/2026.

## Misión

Para cada desafío: qué datos oficiales usaría probablemente, cómo se accede a ellos (licencia, credenciales, volumen), qué tan difícil es para un equipo chico en 48 h, qué tan factible es una demo convincente (1–5), y si hay datos reales públicos para los desafíos de salud de astronautas y de combustión.

## Método y búsquedas realizadas

1. **Prueba de acceso a 46 endpoints con `curl`**, registrando el código HTTP. Resultado: 38×`000`, 5×`200`, 2×`403`, 1×`404`.
   - El proxy (`/__agentproxy/status`) registra `connect_rejected` con "gateway answered 403 to CONNECT (policy denial)" para spaceappschallenge.org, chandra.harvard.edu, planetarycomputer.microsoft.com, power.larc.nasa.gov y otros.
   - Por lo tanto, **`000` significa "bloqueado por la política de este entorno"**, no que el servicio esté caído ni que exija login.
2. **Listado anónimo (ListObjectsV2) de buckets S3** de AWS Open Data: nasa-osdr, nasa-power, asc-pds-services, astrogeo-ard, nasa-psi, noaa-nesdis-n20-pds, noaa-goes18/19, sentinel-cogs, copernicus-dem-30m, esa-worldcover, y los protegidos lp-prod-protected y gesdisc-cumulus-prod-protected.
3. **Lectura de fichas YAML del AWS Open Data Registry** vía raw.githubusercontent.com: nasa-osdr, nasa-power, nasa-psi, noaa-jpss, noaa-goes, nasa-hls, nasa-gedi, usgs-landsat, esa-worldcover, copernicus-dem, sentinel-2-l2a-cogs. No existen fichas con los nombres nasa-firms, nasa-chandra, nasa-clps ni nasa-lroc (404).
4. **Descarga e inspección de 2 CSV clínicos** de Inspiration4 (OSDR), sin ejecutar código de terceros.
5. **WebSearch, 6 consultas**:
   - "Harmonization of MODIS and VIIRS" en spaceappschallenge 2026 → desafío no encontrado; sí contexto sobre el fin de MODIS.
   - "Flame in Freefall" → desafío no encontrado; contexto sobre CIR/SoFIE.
   - Registro y descarga en PSI (combustión).
   - Lista 2026 con "Earth Information Jukebox" y "Field Shift" → ninguno de los dos títulos encontrado.
   - Límites de la API de FIRMS (MAP_KEY).
   - Acceso a datos de astronautas en LSDA.
   - Una séptima consulta (PSI en AWS) fue rechazada por cupo agotado.
6. **WebFetch** a spaceappschallenge.org: `ENOTFOUND`, registrado y no reintentado.

## Hallazgos de acceso (verificados en este entorno)

| Recurso | Endpoint probado | HTTP | Qué hay / formato / tamaño | Licencia | Credenciales | Estado |
|---|---|---|---|---|---|---|
| FIRMS API (MODIS/VIIRS hotspots) | firms.modaps.eosdis.nasa.gov/api/area/csv/... | 000 (bloqueado) | CSV por área y rango de días | Datos NASA abiertos [NO VERIFICADO] | MAP_KEY gratuita; 5.000 transacciones cada 10 min; los pedidos de varios días cuentan como varias transacciones [SNIPPET, foro Earthdata] | No accesible desde aquí |
| VIIRS fuego (NOAA Enterprise, NOAA-20) | s3 noaa-nesdis-n20-pds/VIIRS_EFIRE_VIIRSI_EDR/ | 200 | NetCDF por gránulo, ~0,8 MB c/u; 20/10/2026: ≥1.000 gránulos y ≥1,09 GB (listado truncado en 1.000). Hay carpeta del 21/10 (latencia <1 día) | NODD abierto, con atribución | No | [LEÍDO] listado. **No es VNP14IMG de NASA**: es el producto operativo NOAA y su algoritmo puede diferir [INFERENCIA] |
| VIIRS fuego SNPP / NOAA-21 | noaa-nesdis-snpp-pds, noaa-nesdis-n21-pds | 200 | SNPP tiene VIIRS_EFIRE_VIIRSI_EDR | NODD | No | [LEÍDO] listado |
| GOES-18/19 fuego (FDC) | noaa-goes19 ABI-L2-FDCC/FDCF/FDCM | 200 | NetCDF geoestacionario | NODD | No | [LEÍDO] listado |
| MODIS MCD14ML / MOD14, VIIRS VNP14IMG (NASA) | cmr.earthdata.nasa.gov, ladsweb | 000 | HDF/NetCDF; archivos FIRMS por país en CSV/SHP | Abiertos | Earthdata Login para LAADS [NO VERIFICADO aquí] | No se encontró espejo S3 público de MODIS fire |
| NASA POWER (MERRA-2, IMERG, GEOS-IT, FLASHFlux, SRB) | s3 nasa-power | 200 | **Zarr** diario/horario/mensual/climatología (p. ej. GWETROOT, GWETPROF, FROST_DAYS, EVPTRNS); `last_available.json`: GEOS-IT al 19/10/2026, FLASHFlux al 16/10/2026 | **CC BY 4.0**; piden citar | No | [LEÍDO]. La API REST (power.larc.nasa.gov) está bloqueada aquí, el S3 no |
| HLS (Landsat/Sentinel armonizado) | lp-prod-protected/HLSL30.020 | 403 | COG | CC BY 4.0 | **Sí, Earthdata Login** (bucket protegido) | [LEÍDO] ficha + 403 |
| GEDI | lp-prod-protected | 403 | HDF5 | CC BY 4.0 | Sí, Earthdata Login | [LEÍDO] ficha |
| Landsat C2 (USGS) | usgs-landsat | 403 | COG | Dominio público USGS [NO VERIFICADO] | **Requester-pays** (hace falta cuenta AWS que pague el egreso) | [LEÍDO] ficha |
| Sentinel-2 L2A COG | sentinel-cogs | 200 | COG + STAC (earth-search bloqueado aquí) | Copernicus abierto | No | [LEÍDO] listado |
| Copernicus DEM 30 m, ESA WorldCover | copernicus-dem-30m, esa-worldcover | 200 | COG | Copernicus / CC BY 4.0 [NO VERIFICADO] | No | [LEÍDO] listado |
| SMAP L3/L4 | nsidc.org | 000 | HDF5 | Abiertos | Earthdata Login (NSIDC) [NO VERIFICADO aquí] | No accesible; alternativa parcial: GWETROOT/GWETPROF de MERRA-2 en POWER [INFERENCIA] |
| GPM IMERG | gpm1.gesdisc | 000; gesdisc-cumulus-prod-protected 403 | HDF5/NetCDF | Abiertos | Earthdata Login | Alternativa: `nasa-power/imerg/` (200) |
| Marte: mosaicos CTX controlados por zona de exploración (USGS) | s3 asc-pds-services/mosaic/Mars/CTX_EZs/ | 200 | ~50 GeoTIFF de 1,2–4,4 GB (Jezero 1,6 GB; Gale 1,8 GB; Gusev 3,4 GB) | Productos USGS/PDS, dominio público [NO VERIFICADO] | No | [LEÍDO] listado |
| Marte: DTM CTX controlados y DTM HiRISE (USGS ARD) | s3 astrogeo-ard/mars/mro/ctx/controlled/usgs/…_dtm.tif; índices `collectionindices/mro_ctx_controlled_usgs_dtms.parquet`, `mro_hirise_socet_dtms.parquet` (modificados el 20/10/2026) | 200 | GeoTIFF por par estéreo (dtm, hillshade, intersection_error) + JSON STAC | Ídem | No | [LEÍDO] listado |
| Luna: polo sur LOLA y NAC | asc-pds-services/mosaic/Lunar_safed/LMAP/SouthPolar/ | 200 | `ldem_87s_5mpp_cog.tif` 4,2 GB (COG, con **Range 206** verificado); NAC 1 m 42–77 GB; ShadowCam 1 m 19,9 GB; DEM LOLA global 118 m 8,5 GB; LOLA+Kaguya 60N–60S 22,6 GB; `astrogeo-ard/moon/lro/lola/barker_south_pole_dems/` (tif + laz) | Ídem | No | [LEÍDO] listado y rango |
| Luna: Apollo 17 | asc-pds-services/mosaic/Apollo17/ | 200 | DTM 150 cm y orto 25 cm (TIFF) | Ídem | No | [LEÍDO] listado |
| Moon Trek WMTS | trek.nasa.gov/tiles/... | 000 | Teselas WMTS | — | No [NO VERIFICADO] | No accesible aquí |
| LROC (ASU) | pds.lroc.asu.edu, wms.lroc.asu.edu | 000 | — | — | — | No accesible aquí |
| CLPS manifiestos | — | — | No encontré un dataset estructurado de manifiestos de carga CLPS en el registro AWS (nasa-clps 404) | — | — | [NO VERIFICADO]; probablemente haya que armarlo a mano desde páginas NASA |
| OSDR / GeneLab (incluye Inspiration4) | s3 nasa-osdr | 200 | Carpetas OSD-*; OSD-569 = **hemograma (CBC) de I4**, 27 filas (4 tripulantes × ~7 puntos de muestreo, p. ej. L-92, L-44, L-3), con valor y rango de referencia por analito; OSD-575 = **panel metabólico (CMP)** + paneles de citoquinas, 27 filas; OSD-656 orina; OSD-570–574, 630 ómicas y metagenomas (FASTQ, GB) | "There are no restrictions on the use of this data" (ficha AWS) | No | [LEÍDO]: descargué y abrí los CSV |
| LSDA / LSAH (datos médicos de astronautas) | lsda.jsc.nasa.gov | 000 | — | — | **Pedido formal**, revisión de atribuibilidad, Privacy Act, LSAH Policy Board [SNIPPET, presentaciones NTRS 2012–2018] | Inviable en 48 h [INFERENCIA] |
| PSI (Physical Sciences Informatics) | psi.ndc.nasa.gov 000; s3 nasa-psi 200 | 200 en S3 | **El bucket S3 solo trae DSI, OASIS y pk4** (sin combustión). ACME, FLEX, BASS y SoFIE estarían solo en el portal PSI | "There are no restrictions" (ficha AWS) | Portal: **registro gratuito** [SNIPPET 2015, puede haber cambiado] | [LEÍDO] listado y ficha |
| Sonificaciones Chandra | chandra.harvard.edu/sound, chandra.si.edu/sound | 000 (proxy 403) | Audio/video | [NO VERIFICADO] | — | No accesible aquí |
| NASA Image & Video Library, APOD | images-api.nasa.gov, api.nasa.gov | 000 | — | — | DEMO_KEY | No accesible aquí |
| GIBS/Worldview | gibs.earthdata.nasa.gov | 000 | WMTS | Abierto | No | No accesible aquí |
| earthaccess (librería Python) | pypi.org | 200 | — | — | — | Instalable |

**Lectura general [INFERENCIA]:**
- **Funcionan desde este entorno sin credenciales:** los buckets AWS Open Data de USGS Astrogeology, OSDR, POWER, NOAA (JPSS/GOES) y Copernicus.
- **Necesitan Earthdata Login:** todo lo que está en DAAC "protected" (HLS, GEDI, GES DISC), además de LAADS y NSIDC.
- **Necesita MAP_KEY:** FIRMS.

Earthdata Login y MAP_KEY son gratuitos e inmediatos, pero hay que sacarlos **antes** del evento. Que gestionar credenciales cuente o no como "empezar a trabajar" es una **pregunta de reglas** (ver abajo).

## Evaluación por desafío

Escala de factibilidad de demo (para 48 h): **1** = muy riesgosa, **5** = muy segura. Los datos "probables" son **[INFERENCIA]** a partir del título hasta que se lean los enunciados del 28/10.

| # | Desafío | Datos probables | Acceso | Dificultad técnica 48 h | Riesgos de datos | Factibilidad demo | Factores críticos |
|---|---|---|---|---|---|---|---|
| 1 | Interplanetary Survival Guide: Martian Map | CTX/HiRISE DTM USGS, MOLA, mosaicos CTX_EZs, Mars Trek | S3 público, sin login (verificado) | Media: GeoTIFF de 1–4 GB; hay que recortar (COG/rango) y re-proyectar. GDAL/rasterio + web map | Bajo en acceso; alto en **diferenciación**: ≥10 repos 2026 ya existen (según el brief) y E1 de ASTRA mostró que el ruteo sobre CTX 20 m no mejora la exposición a pendientes | 4 técnica / 2 originalidad | Resolución (CTX 20 m vs HiRISE 1 m), validar contra "ground truth" (traverse de Perseverance) |
| 2 | Abandoned but not Forgotten (equipo descartado en Luna/Marte) | Coordenadas de sitios Apollo/Luna/landers; ortos LROC NAC; Apollo17 DTM 150 cm y orto 25 cm (verificado); HiRISE de hardware en Marte | Apollo17 en S3 público; LROC/Trek bloqueados aquí | Baja–media: storytelling + mapa; poco volumen si se usan recortes | Bajo; el catálogo de objetos probablemente haya que compilarlo a mano desde fuentes NASA (licencias de imágenes NASA: dominio público con excepciones [NO VERIFICADO]) | 4 | Calidad narrativa; imágenes precisas por sitio |
| 3 | Earth analogs de bases lunares y Marte | Copernicus DEM 30 m, ESA WorldCover, Sentinel-2, POWER (temperatura, radiación), LOLA polo sur (iluminación/pendiente), MOLA/CTX | Todo lo nombrado está en S3 sin login (verificado), salvo HLS/Landsat | Media–alta: definir métricas comparables Tierra↔Luna/Marte (pendiente, rugosidad, albedo, temperatura, radiación) y hacer búsqueda por similitud global = mucho volumen | Medio: escala global; hay que acotar región o resolución | 3 | Elegir 3–5 métricas defendibles; rigor de la analogía |
| 4 | CLPS Lunar Mission Browser | Manifiestos CLPS (cargas, landers, fechas, sitios), LOLA/LROC para contexto | **No encontré dataset estructurado de CLPS** [NO VERIFICADO]; LOLA en S3 | Baja: app web + JSON curado a mano | Alto en datos: el manifiesto se armaría a mano desde páginas NASA (bloqueadas aquí) y cambia seguido; riesgo de errores factuales | 4 técnica; rigor depende de la curación | Exactitud y fecha de corte del catálogo; posible feed oficial en el enunciado |
| 5 | Health Monitoring Software for Astronauts | OSDR (Inspiration4 CBC/CMP/citoquinas; ómicas); LSDA/LSAH; probablemente datos simulados de signos vitales | OSDR S3 público (verificado, sin restricciones). LSDA: pedido formal, inviable | Baja–media en software; **alta en rigor clínico** | **Crítico:** no encontré series temporales de signos vitales (FC, SpO₂, presión) de astronautas públicas. Los datos reales son de laboratorio, 4 sujetos, ~7 puntos. Lo continuo habrá que **simularlo** (p. ej. con datasets terrestres tipo PhysioNet, no verificados aquí) | 3 | Declarar qué es simulado; usar los rangos de referencia de OSDR para alertas; evitar claims médicos |
| 6 | Junior Astronaut Mission Trainer | Material educativo, imágenes NASA, quizzes; poca dependencia de datasets | Image Library bloqueada aquí, no es crítica | Baja | Bajo | 5 | Diseño pedagógico y UX; diferenciación |
| 7 | Space Mission Design Game | Parámetros de misión (Δv, masas), quizá GMAT/Horizons | JPL Horizons no probado [NO VERIFICADO] | Baja–media (lógica de juego + física simplificada) | Bajo | 4–5 | Fidelidad física vs. jugabilidad |
| 8 | Flame in Freefall (IA sobre combustión en microgravedad) | PSI: ACME (BRE, s-Flame, Flame Design, CLD Flame, E-FIT), FLEX/FLEX-2, BASS, SoFIE; videos de llama | **El bucket S3 nasa-psi no tiene combustión** (solo DSI/OASIS/pk4, verificado). El portal PSI está bloqueado aquí y requiere registro gratuito [SNIPPET 2015] | Alta: los datos de llama suelen ser video/imágenes + series (diámetro de gota, temperatura) en formatos heterogéneos; la "IA" necesita etiquetas | **Alto:** volumen y formato desconocidos; pocos experimentos (n chico) para ML; riesgo de tener que **simular** o usar solo papers | 2 (3 si el enunciado trae un dataset curado) | Ver qué paquete de datos trae el enunciado del 28/10; registrarse en PSI y bajar datos de antemano es una **pregunta de reglas** |
| 9 | Harmonization of MODIS and VIIRS Hot Spots | MCD14ML/MOD14/MYD14, VNP14IMG/VJ114IMG, FIRMS; VIIRS NOAA EFIRE como sustituto | FIRMS: MAP_KEY. LAADS/CMR: Earthdata Login. NOAA EFIRE: S3 abierto, ≥1 GB/día por satélite (verificado) | Media–alta: matching espacio-temporal (resolución 1 km vs 375 m, distinta hora de pasada, deriva orbital de Terra/Aqua [SNIPPET]), calibración FRP | Medio: FIRMS CSV resuelve el volumen si hay MAP_KEY; sin ella, queda el EFIRE de NOAA (otro algoritmo) | 3 | Tener MAP_KEY y Earthdata; definir validación (p. ej. pares coincidentes en ±N minutos); contexto: Terra/Aqua MODIS dejan de colectar en feb/sep 2027 [SNIPPET LAADS/Earthdata] |
| 10 | Field Shift: Adapting Farms with NASA Data | POWER (agroclimático, GWETROOT), SMAP, HLS/Landsat NDVI, GPM IMERG | POWER Zarr S3 abierto CC BY (verificado); IMERG vía POWER; Sentinel-2 COG abierto. SMAP y HLS requieren Earthdata | Media: series temporales puntuales son fáciles con POWER; NDVI por lote requiere STAC (bloqueado aquí, abierto en la internet normal [INFERENCIA]) | Bajo–medio | 4 | Caso de uso concreto (cultivo/región); validación agronómica |
| 11 | The Earth Information Jukebox (sonificación) | Series de POWER/MERRA-2, GOES, sonificaciones de Chandra como referencia | POWER/GOES S3 abiertos; Chandra bloqueado aquí | Baja–media (Web Audio/Tone.js + series) | Bajo | 4–5 | Mapeo dato→sonido que sea informativo, no decorativo; accesibilidad |
| 12+ | Faltantes (≥3 títulos; una fuente secundaria menciona tendencias ambientales/climáticas) | — | — | — | No encontrados: WebSearch sin resultados y cupo agotado | — | Revisar el 28/10 |

### Cálculo de volúmenes (referencia)

- **Un mosaico CTX de zona** pesa 1,2–4,4 GB. No es COG declarado: verificar antes de pedir rangos.
- **El DEM LOLA 87°S a 5 m** pesa 4,2 GB y sí es COG: rango HTTP verificado (respuesta 206), así que se puede leer de forma remota y recortada.
- **VIIRS EFIRE (NOAA-20)**: ≥1 GB/día. Para un estudio regional de varias semanas, conviene FIRMS CSV (unos KB–MB).
- **OSDR CBC/CMP**: unos KB. Las ómicas (FASTQ) son GB y no serían útiles para una demo de monitoreo.

## Datos de salud y de combustión: ¿reales o simulados?

**Salud de astronautas:**
- **Hay datos reales públicos, pero son escasos.**
  - OSDR (OSD-569, 575, 656) trae laboratorio clínico de Inspiration4: hemograma, panel metabólico, citoquinas en suero y orina. Son 4 personas, alrededor de 7 puntos pre y post vuelo, cada valor con su rango de referencia [LEÍDO].
  - También hay ómicas: scRNA, metabolómica, metagenoma, transcriptómica espacial de piel [LEÍDO, listado].
- **Señales fisiológicas continuas** (ECG, FC, sueño, actividad) de astronautas: **no encontré** datos públicos.
  - LSDA/LSAH requiere pedido formal y revisión de atribuibilidad, por la Privacy Act y por la dificultad de des-identificar a personas públicas [SNIPPET NTRS].
- **Conclusión [INFERENCIA]:** un monitor "en tiempo real" se apoyará casi seguro en **datos simulados** o en datasets terrestres análogos. Para sostener el rigor:
  - etiquetar explícitamente qué es simulado;
  - anclar umbrales en fuentes reales (por ejemplo, los rangos de OSDR);
  - no presentar inferencias clínicas como validadas.
- El enunciado del 28/10 podría incluir un dataset propio (p. ej. de análogos como HERA o CHAPEA) [NO VERIFICADO].

**Combustión en microgravedad:**
- **Los datos reales existen en PSI**, pero no pude verificarlos desde aquí.
  - El espejo S3 público de PSI **no** contiene combustión [LEÍDO].
  - El portal requiere registro (gratuito según una fuente de 2015) [SNIPPET].
- **Riesgos [INFERENCIA]:**
  - formatos heterogéneos (video de alta velocidad, imágenes, tablas de diámetro de gota y tasa de quemado);
  - pocos ensayos para entrenar modelos de "IA";
  - un análisis serio de video en 48 h es difícil.
- **Si el enunciado no trae un paquete curado,** lo más probable es mezclar pocos casos reales con modelos físicos simplificados (p. ej. la ley d² de combustión de gotas) y simulación. Eso baja el rigor si no se declara.

## Precarga y credenciales: preguntas de reglas (no resueltas)

El FAQ dice "Teams are not allowed to begin working on the challenges prior to the hackathon" [SNIPPET, según el brief; no leído completo aquí]. Antes del evento, las reglas deberían aclarar si estas acciones están permitidas:

1. Crear cuentas gratuitas (Earthdata Login, FIRMS MAP_KEY, registro PSI).
2. Descargar y cachear datos públicos crudos (p. ej. un DTM CTX de 1,6 GB, el DEM LOLA de 4,2 GB, CSV de FIRMS).
3. Preparar entornos (instalar GDAL/rasterio/earthaccess) sin código específico del desafío.
4. Reutilizar código propio previo (p. ej. ASTRA) y cómo declararlo.

Separación propuesta para la consulta [INFERENCIA]:
- "datos públicos y herramientas" son material de terceros;
- "pipelines o modelos hechos para el desafío" son trabajo sobre la solución.

La decisión corresponde a los organizadores, no a este informe.

## Objeciones propias

- No leí ningún enunciado. Los datos esperados por desafío son inferencias y pueden estar mal (p. ej. el #9 puede traer un dataset curado de CONAE que cambie todo el análisis).
- Que algo esté bloqueado aquí no significa que esté bloqueado en el evento. En una red normal, FIRMS, POWER API, Moon/Mars Trek, GIBS y Chandra probablemente funcionan [INFERENCIA]. Los `000` miden este entorno, no el servicio.
- Las licencias de USGS Astrogeology, Copernicus y Chandra no las leí: quedan [NO VERIFICADO].
- Las afirmaciones sobre PSI y LSDA vienen de fuentes viejas (2012–2018) y son solo snippets.
- No evalué la calidad científica de cada demo, solo la disponibilidad de datos y el esfuerzo técnico.

## Conclusiones

1. **Datos más seguros (abiertos, sin login, verificados):**
   - Marte y Luna vía USGS en S3 (desafíos 1–4);
   - POWER Zarr CC BY 4.0 (10, 11, 3);
   - OSDR (5);
   - NOAA VIIRS/GOES fuego (9, como sustituto).
2. **Necesitan credenciales gratuitas obtenidas de antemano:** FIRMS (MAP_KEY), HLS/SMAP/GES DISC/LAADS (Earthdata) y PSI (registro).
3. **Mayor riesgo de datos:** #8 Flame in Freefall (datos no verificables y probablemente con poco n, formato video) y #5 Salud (sin señales continuas públicas; tocará simular).
4. **Menor riesgo de datos pero menor diferenciación técnica:** #6, #7, #11 (demo 4–5) y #4 (demo fácil, pero el catálogo CLPS se cura a mano).
5. **#1 Martian Map** es técnicamente factible, pero está saturado y E1 ya debilita la tesis de ruteo sobre CTX.

## Tabla de fuentes

| URL | Qué afirma | Estado |
|---|---|---|
| https://raw.githubusercontent.com/awslabs/open-data-registry/main/datasets/nasa-psi.yaml | PSI en s3://nasa-psi (us-west-2) con DSI y OASIS; sin restricciones de uso | [LEÍDO] |
| https://raw.githubusercontent.com/awslabs/open-data-registry/main/datasets/nasa-osdr.yaml | OSDR en s3://nasa-osdr; sin restricciones | [LEÍDO] (solo líneas License/ARN) |
| https://raw.githubusercontent.com/awslabs/open-data-registry/main/datasets/nasa-power.yaml | POWER CC BY 4.0, s3://nasa-power, sin requester-pays | [LEÍDO] (License/ARN) |
| https://raw.githubusercontent.com/awslabs/open-data-registry/main/datasets/nasa-hls.yaml | HLS en lp-prod-protected, CC BY 4.0 | [LEÍDO] (License/ARN) |
| https://raw.githubusercontent.com/awslabs/open-data-registry/main/datasets/usgs-landsat.yaml | Landsat C2 requester-pays | [LEÍDO] (ARN/RequesterPays) |
| https://raw.githubusercontent.com/awslabs/open-data-registry/main/datasets/noaa-jpss.yaml, noaa-goes.yaml | Datos NODD abiertos, con atribución | [LEÍDO] (License) |
| https://nasa-osdr.s3.us-west-2.amazonaws.com/ (OSD-569, 575, 656, 570–574, 630) | CBC/CMP/citoquinas de I4, 27 filas | [LEÍDO] |
| https://nasa-power.s3.us-west-2.amazonaws.com/last_available.json, LICENSE.txt | Fechas de última disponibilidad; CC BY 4.0 | [LEÍDO] |
| https://asc-pds-services.s3.us-west-2.amazonaws.com/ (mosaic/Mars/CTX_EZs, Lunar_safed, Apollo17) | Mosaicos y DEM, con tamaños | [LEÍDO] listado |
| https://astrogeo-ard.s3.us-west-2.amazonaws.com/ (mars/mro/ctx/controlled, moon/lro/lola, collectionindices) | DTM CTX/HiRISE, DEMs LOLA polo sur, índices parquet | [LEÍDO] listado |
| https://noaa-nesdis-n20-pds.s3.amazonaws.com/VIIRS_EFIRE_VIIRSI_EDR/ | VIIRS fuego NOAA, ≥1 GB/día, al día | [LEÍDO] listado |
| https://forum.earthdata.nasa.gov/viewtopic.php?p=23833 | FIRMS: 5.000 transacciones cada 10 min | [SNIPPET] |
| https://github.com/api-evangelist/nasa-firms | Endpoint area/csv y límite | [SNIPPET] |
| https://ladsweb.modaps.eosdis.nasa.gov/learn/modis-to-viirs-transition/ | Fin de colecta MODIS: Terra feb-2027, Aqua sep-2027 | [SNIPPET] |
| https://www.earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs | Transición MODIS→VIIRS; deriva orbital | [SNIPPET] |
| https://science.data.nasa.gov/learn/blog/psi-spotlight | PSI abierto; ACME BRE agregado | [SNIPPET] |
| https://www.infodocket.com/2015/04/01/science-nasa-creates-open-database-of-space-station-research-international-space-station-information-system/ | PSI requiere registro (2015) | [SNIPPET] |
| https://ntrs.nasa.gov/citations/20150020970 (y otros NTRS 2012–2018) | LSDA/LSAH: pedidos, revisión de atribuibilidad, Privacy Act | [SNIPPET] |
| https://svs.gsfc.nasa.gov/31394 | Estudios de llama en ISS (CIR, SoFIE) | [SNIPPET] |
| https://zilesinopti.ro/?p=892787, https://science.nasa.gov/?p=1490244 | 14 desafíos 2026, niveles de dificultad, tres áreas de foco | [SNIPPET] |
| https://www.spaceappschallenge.org/2026/challenges/ | Lista oficial | **No accesible** (ENOTFOUND / proxy 403) |

## Pendientes

1. Leer los enunciados completos el 28/10 y rehacer la columna "datos probables". Prioridad: #8 y #5, que podrían traer datasets curados.
2. Desde una red sin restricciones:
   - verificar el contenido de combustión de PSI (ACME, FLEX, BASS, SoFIE: formato, tamaño, licencia, registro);
   - verificar la API de FIRMS con una MAP_KEY de prueba;
   - verificar Moon/Mars Trek WMTS y las sonificaciones de Chandra.
3. Confirmar las licencias de USGS Astrogeology, Copernicus DEM y WorldCover.
4. Identificar los ≥3 desafíos faltantes (búsqueda bloqueada por cupo agotado).
5. Pedir a los organizadores una aclaración sobre credenciales y precarga de datos públicos (ver "Precarga y credenciales").
6. Buscar si existe un feed estructurado de cargas CLPS (NSSDCA, página CLPS de NASA).
