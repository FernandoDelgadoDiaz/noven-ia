# 01 — Inventario de los 14 desafíos de NASA Space Apps 2026

Fecha de corte: 21/10/2026. Base: `agentes/A1_desafios_oficiales.md`, `A2b_competidores_tierra.md` §3 y `A10_huecos_SAR_trends_SPHEREx.md`.

> **Estado de la evidencia.** Ningún texto oficial se leyó completo: `spaceappschallenge.org` es inaccesible desde este entorno (DNS `ENOTFOUND` / proxy 403). Las 14 URL oficiales sí aparecen en el índice del buscador [SNIPPET]. Los resúmenes del 17/09 se reconstruyeron con paráfrasis de terceros [LEÍDO, secundaria] y con citas casi literales copiadas por equipos [LEÍDO, cita de segunda mano]. **Los enunciados completos (datos, recursos y requisitos) se publican el 28/10/2026 y no existen todavía.** Todo lo que este informe dice sobre datos y entregables es inferencia hasta esa fecha.

## 1. Lista verificada

La dificultad sale del catálogo `SeCuReDmE-main-dev/nasa-space-apps-2026-research`, que declara haber leído el catálogo oficial el 22/09. Es coherente con las URL oficiales indexadas y con repos independientes, pero no se verificó contra la fuente primaria.

| ID | Título oficial | Dificultad | Ámbito | Resumen publicado (17/09), lo más literal disponible |
|---|---|---|---|---|
| C01 | Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars | Principiante–Intermedio | Narrativa | Explicar a público escolar la historia y el aporte científico del equipamiento NASA dejado en la Luna, Marte y otros cuerpos (paráfrasis) |
| C02 | Be An Earth System Trend Detective! | **Avanzado** | Tierra | "examine variables measured by NASA missions or produced by NASA models, visualize how they change over time, and determine: What… Where… How much… Whether the change is statistically significant" (cita de segunda mano, cpt9m0) |
| C03 | Build a Junior Astronaut Mission Trainer | Principiante–Intermedio | Educación | Experiencia interactiva para que estudiantes vivan los compromisos de recursos e ingeniería de una base lunar o marciana (paráfrasis) |
| C04 | CLPS Lunar Mission Browser | Intermedio–Avanzado | Luna | "…create an intuitive tool or application that lets mission planners, educators, and the public compare landing sites and dates quickly, visualizing Sun and Earth positions relative to the horizon to assess power generation potential and direct-to-Earth communication windows" (cita de segunda mano, lunarwindow) |
| C05 | Create Health Monitoring Software for Astronauts on Space Missions | Intermedio | Salud | Organizar indicadores de salud para que los astronautas evalúen su estado en misiones largas (paráfrasis) |
| C06 | Dancing with the SARs | Intermedio–Avanzado | Tierra (NISAR) | Usar observaciones de radar NISAR para seguir y comunicar uno o más tipos de cambio de la superficie (paráfrasis) |
| C07 | Field Shift: Adapting Farms with NASA Data | Intermedio–Avanzado | Tierra (agro) | Explorar opciones de rotación de cultivos con observaciones NASA, información local de suelos y prioridades agrícolas (paráfrasis) |
| C08 | Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data | Intermedio–Avanzado | ISS / combustión | Hacer que los hallazgos experimentales sobre combustión en microgravedad sean más fáciles de encontrar, comparar, rankear e interpretar mediante un dashboard asistido por IA (paráfrasis) |
| C09 | Harmonization of MODIS and VIIRS Hot Spots | Intermedio–Avanzado | Tierra (fuego) | Reconciliar historiales de focos por sensor en un **calendario** para explorar la actividad de quema histórica de un área elegida (paráfrasis + dossier) |
| C10 | Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars | Multinivel | Híbrido | "…such terrestrial analog sites are not entirely well characterized. Your challenge is to use open Earth, Moon, and Mars data from NASA and other space agencies to identify and characterize new terrestrial analogs" (cita de segunda mano, ShadowAstra) |
| C11 | Interplanetary Survival Guide: Martian Map | Intermedio | Marte | "build a layered, integrated view of a location or route on the Martian surface that pulls together data from multiple NASA science missions, to help a human explorer plan a successful Marswalk while doing new science along the way" (cita de segunda mano, Protikriti) |
| C12 | Planet X and SPHEREx | **Avanzado** | Astrofísica | Ayudar al público a inspeccionar cambios en imágenes repetidas del cielo de SPHEREx (paráfrasis) |
| C13 | Space Mission Design Game | Principiante–Intermedio | Educación | Que los aprendices exploren los objetivos y las restricciones de recursos de una misión espacial, y cómo interactúan (paráfrasis) |
| C14 | The Earth Information Jukebox | Principiante–Intermedio | Tierra (accesibilidad) | "building an interface, script, or application that pairs Earth Information Center (EIC) visual frames with dynamic sonifications generated in real time" [SNIPPET] |

- **Tierra/espacio:** 5 desafíos terrestres (C02, C06, C07, C09, C14) y uno híbrido (C10), lo que coincide con la fuente secundaria que hablaba de "6 de 14 sobre la Tierra".
- **Fuente contaminada:** el README `tiovene/nasa-spaceapps` lista tres desafíos inexistentes (ISRU Explorer, Orbital Debris Tracker, Biodiversity & Ocean Watch) y omite tres reales. No se usa.
- **Proponentes:** no verificados para ninguno. El rumor de que CONAE propone C09 no tiene confirmación. CONAE sí figura como socia 2026 [SNIPPET].

## 2. Ficha comparativa (12 dimensiones pedidas)

Escalas 1–5 [INFERENCIA de los agentes]. "Cien." y "Téc." miden dificultad (5 = más difícil). "Demo" es la factibilidad de una demo convincente en 48 h (5 = más segura).

| ID | Problema | Usuario | Requisitos y entregables publicados | Datos oficiales probables (acceso verificado aquí) | Cien. | Téc. | Demo | Innovación posible | Riesgo principal | Qué ya existe (más fuerte) | Qué faltaría demostrar |
|---|---|---|---|---|---|---|---|---|---|---|---|
| C01 | El hardware abandonado no se reconoce como patrimonio científico | Escolares, docentes | Relato o app (no publicado) | NSSDCA, LROC, HiRISE; Apollo 17 DTM en S3 (200) | 1 | 2 | 4–5 | Gazetteer marciano con nivel de certeza por objeto | Indiferenciación, juicio subjetivo | One-Way Manifest (115 objetos, NSSDCA) | Que el relato supere al de decenas de museos digitales |
| C02 | Detectar tendencias robustas y su significancia | Público, decisores, docentes | Qué, dónde, cuánto, significancia | POWER (S3 200, CC BY 4.0), MERRA-2, IMERG, GRACE, MODIS | 4 | 3 | 5 | Tendencia vs cambio de instrumento; potencia estadística | Método commodity (MK + Sen); se parece a otros dashboards | EarthTrendTest (MK estacional con autocorrelación) | Que la pregunta estadística no trivial se entienda en 30 s |
| C03 | Enseñar compromisos de ingeniería de una base | Niños, jóvenes, docentes | Juego o app (no publicado) | ECLSS, MOXIE, RAD, DONKI | 2 | 2–3 | 5 | Kit listo para el aula en castellano | Saturación por juegos pulidos | Sol Keeper (152 commits, 59 archivos de test) | Valor pedagógico (no medible en 48 h) |
| C04 | Planificar sitio y fecha según Sol y Tierra | Planificadores CLPS, docentes, público | Comparar sitios y fechas; Sol y Tierra respecto del horizonte | LOLA polo sur COG (S3 206), SPICE, PGDA | 3 | 4 | 3–4 | Sensibilidad de la iluminación a la elipse de aterrizaje | Competidores ya validados contra PGDA y DE440 | Lunar Horizon Wheel (RMSE 4,55 pp contra PGDA), LunaHorizon | Superar una validación ya publicada |
| C05 | Autonomía médica en misiones largas | Astronautas, cirujanos de vuelo | No publicado | OSDR Inspiration4 (S3 200): 4 personas, unos 7 puntos de muestreo; LSDA inviable | 3 | 2 | 2–3 | Presupuesto explícito de falsas alarmas | Datos simulados, afirmaciones médicas | VITA (NEWS2 adaptado, datos simulados) | Utilidad clínica, imposible en 48 h |
| C06 | Hacer comprensible el cambio superficial medido por SAR | Analistas de riesgo, periodistas, público | Seguir y comunicar el cambio | NISAR GCOV/GUNW PROVISIONAL (ASF, Earthdata Login; no probado aquí) | 4 | 4 | 3 | Auditoría de artefactos con pares de control | Pares disponibles, HDF5 pesados, credenciales | TerraPulse (3 GCOV reales, Kathmandu) | Que haya ≥3 adquisiciones comparables en el área de interés |
| C07 | Rotación de cultivos adaptada al clima | Productores, extensionistas | Rotación + suelo local + prioridades | POWER, SMAP, IMERG, MOD13Q1, SoilGrids | 4 | 3 | 4 | Lo que ya cambió (observado) frente a lo proyectado | Validez agronómica; tema ganador en 2024 y 2025 | FieldShift-NASA (CMIP6, Pareto) | Validación agronómica |
| C08 | Conocimiento de combustión disperso y poco usable | Ingenieros de seguridad, investigadores | Dashboard asistido por IA | PSI (portal con registro; el S3 público no tiene combustión), FLEX, BASS-II | 3–4 | 3 | 2–3 | Mapa de discrepancias 1 g / µg; IA contra baseline físico | n chico, IA que alucina | FlameScope, IGNITE-AI (CV 0,73 contra 0,61 de mayoría) | Que el enunciado entregue datos comparables |
| C09 | Salto artificial de la serie al cambiar de sensor (1 km a 375 m) | Gestores de fuego, analistas regionales | Calendario de actividad de quema en un área elegida | FIRMS (MAP_KEY), LAADS (Earthdata); VIIRS de NOAA en S3 (200, otro algoritmo) | 4 | 3 | 3–4 | Puente de la serie de referencia (Aqua→VIIRS); "silencio confiable" | Saturación de prototipos muy maduros | Kiln Watch (bootstrap, test de quiebre, prerregistro), FireCal (208 países) | Que el ángulo de "satélite de referencia" no esté ya cubierto |
| C10 | Análogos terrestres poco caracterizados | Planificadores de campañas análogas | Identificar y caracterizar análogos nuevos | Copernicus DEM, WorldCover, POWER, LOLA (todo S3 200) | 3 | 3 | 3–4 | Análogos de iluminación del polo sur | Puntuaciones arbitrarias | terrestrial-analog-finder (RMS ponderado, IQR, Wasserstein), TerraNova | Validez de la analogía |
| C11 | Planificar una Marswalk con capas integradas | Exploradores humanos, educación | Vista integrada en capas | MOLA, CTX/HiRISE en S3 (200) | 3 | 3–4 | 4 | Mapa que muestra dónde no se puede confiar en él | Saturación extrema; "ruta segura" engañosa (E1); trabajo previo de ASTRA | Team Protikriti (241 commits, A* ≤15°, 182 tests declarados) | Ver `09` §7 |
| C12 | Abrir los datos multiépoca de SPHEREx al público | Público, ciencia ciudadana | Inspeccionar cambios | SPHEREx QR2/QR3 (S3 200/206, FITS de ~68 MiB) | 4–5 | 4–5 | 4 (1 si se promete "Planet X") | Bajo | Sensacionalismo, falsos positivos | spherex-moving-sky (inyecciones; dice recuperar Makemake y Haumea) | Superar a un competidor que ya validó |
| C13 | Enseñar diseño de misiones | Estudiantes, público | Juego | NSSDC, ecuación del cohete, DONKI | 2 | 2–3 | 4 | Puntuar la gestión de márgenes | Saturación, solapamiento con C03 | Space Actuary (valor esperado contra óptimo), Δv Arquitecto (en español) | Que el juego enseñe algo distinto |
| C14 | La comunicación del EIC es casi solo visual | Personas ciegas o con baja visión, público | "interface, script, or application" que empareje frames del EIC con sonificación dinámica en tiempo real | EIC (earth.gov), GISTEMP, GIBS; POWER | 2 | 2–3 | 4 | Prueba perceptiva con usuarios ciegos durante el hackatón | Sin validación con usuarios; juicio subjetivo | earth-fm (píxeles de frames del EIC, tests, procedencia) | Conseguir participantes y una tarea medible |

## 3. Resumen publicado frente a enunciado completo

| | Resumen (17/09) | Enunciado completo (28/10) |
|---|---|---|
| Estado | Publicado, texto literal no legible desde aquí | **No publicado** |
| Contiene | Título, dificultad y 1–2 párrafos | Datos y recursos oficiales, requisitos [INFERENCIA por ediciones previas] |
| Impacto en este informe | Base de toda la clasificación | **Puede invalidar o reordenar cualquier conclusión** (ver `09` §8) |

## 4. Hechos, hipótesis y riesgos

- **Hechos:**
  - Existen 14 URL oficiales indexadas.
  - Cada desafío tiene entre 7 y 17 repos públicos 2026 o más. El conteo es un piso: cada búsqueda devuelve unos 10 resultados.
  - Los prototipos más fuertes tienen commits de entre el 17/09 y el 20/10.
- **Hipótesis:**
  - Las dificultades del catálogo secundario coinciden con las oficiales.
  - Los datos probables por desafío son los indicados.
- **Riesgos:**
  - El 28/10 puede cambiar el alcance, por ejemplo con datos curados en C08 y C06 o con otro foco en C09.
  - Algunas paráfrasis pueden omitir requisitos.

## 5. Fuentes

Ver `10_FUENTES_Y_LIMITACIONES.md` y las tablas de fuentes de A1, A2a, A2b y A10.
