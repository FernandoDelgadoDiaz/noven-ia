# A2a — Inteligencia competitiva (parte 1): desafíos de espacio / exploración humana

Agente: A2a · Fecha: 2026-10-21 · Estado: completo dentro de las limitaciones descritas abajo (presupuesto de búsquedas agotado a mitad de la tarea).

## 1. Misión

Para 8 desafíos de NASA Space Apps 2026: (1) Interplanetary Survival Guide: Martian Map, (2) Abandoned but not Forgotten, (3) Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars, (4) CLPS Lunar Mission Browser, (5) Create Health Monitoring Software for Astronauts on Space Missions, (6) Build a Junior Astronaut Mission Trainer, (7) Space Mission Design Game, (8) Flame in Freefall. Para cada uno: encontrar repos públicos de equipos 2026 y alternativas institucionales o comerciales, inspeccionar código, identificar al competidor más fuerte que se pudo verificar y estimar la saturación.

Etiquetas de evidencia: **[LEÍDO]** (abrí el README o el archivo completo, o el fragmento citado), **[CÓDIGO]** (lo comprobé en archivos del repo, sin ejecutar nada), **[SNIPPET]** (solo resumen del buscador), **[INFERENCIA]**, **[NO VERIFICADO]**.

## 2. Método y búsquedas realizadas

**Acceso.** `api.github.com/search` y `github.com/search` devuelven 403 a través del proxy (probado una vez). `git` sí funciona: usé `git clone --filter=blob:none --no-checkout` (historial completo de commits, blobs bajo demanda) en `/tmp/claude-0/-home-user/7029a718-8690-52ad-a08e-e11704dd6284/scratchpad/a2a/git/`. Con eso obtuve, para 78 repos: fecha del primer y del último commit, cantidad de commits, autores distintos y archivos. Leí READMEs y archivos puntuales con `git show`. **No ejecuté código de terceros.** No usé herramientas `mcp__github__*`.

**Consultas WebSearch (en orden):**
1. `"Martian Map" Space Apps 2026 github` → sin repos 2026 (solo proyectos de 2013 a 2018).
2. `"CLPS Lunar Mission Browser" github` → sin repos. Apareció la herramienta "Lunar Browser" de NASA Ames (NTRS 20240005553).
3. `"Flame in Freefall" Space Apps github` → sin repos (una lección de PocketLab con el mismo nombre).
4. `"Abandoned but not Forgotten" NASA discarded equipment Moon Mars Space Apps` → sin repos (desafío de diseño TSGC sobre reciclaje de hardware lunar; catálogo de 2012).
5. `site:github.com "Interplanetary Survival Guide" Martian Map` → 10 repos.
6. `site:github.com "CLPS" lunar mission browser space apps 2026` → 9 repos.
7. `site:github.com "Space Mission Design Game" space apps` → 10 repos.
8. `site:github.com "Junior Astronaut" mission trainer space apps 2026` → 9 repos.
9. `site:github.com "Flame in Freefall" microgravity combustion` → 10 repos.
10. `site:github.com astronaut health monitoring "Space Apps" 2026` → 10 repos.
11. `site:github.com "Abandoned but not Forgotten" space apps 2026` → 10 repos.
12. `site:github.com Earth analog Moon base Mars locations "Space Apps" 2026` → 10 repos.
13 a 16. Bangladesh 2026 (fechas locales), For All Moonkind, Lunar QuickMap/PGDA, Astroskin/Bio-Monitor → **no se ejecutaron: se agotó el presupuesto de búsquedas de la sesión** (200 búsquedas compartidas entre todos los agentes). Por eso las alternativas institucionales y comerciales quedan **[NO VERIFICADO]**, salvo las que los propios repos citan.

**Límite importante:** cada consulta devuelve como máximo unos 10 resultados. Que salgan entre 9 y 11 repos por desafío en una sola consulta **es un piso, no un conteo**. La saturación real casi seguramente es mayor **[INFERENCIA]**.

## 3. Hallazgo transversal: casi todos los repos ya existen antes del hackatón (y por qué)

- Los 78 repos clonados tienen su primer commit entre el **17/09/2026** y el **20/10/2026**, todos antes del hackatón global del 14 y 15/11 **[CÓDIGO: git log]**. 45 de los 78 tienen zona horaria +0600 (Bangladesh). También hay +0530 (India), +0800 (Taiwán/Malasia), +0500 (Pakistán), +0300, -0300, -0400 y -0500.
- **Explicación documentada en dos repos [LEÍDO]:** el evento local de Bangladesh tiene una preselección. Según `WarRinOP/sightline` (CLAUDE.md y README), la **Etapa 1 pedía un repo público de GitHub y un video de 240 s antes del 7/10**; solo los equipos seleccionados pasan a la etapa presencial del **13 y 14/11**. Según `ABRUBAB/ShadowAstra_Atlas` (docs/HANDOFF.md), "1 Oct 2026: Video 1 … submitted" y en octubre hay una "preliminary round, with the GitHub repo showing progress". Coincide con el pico de últimos commits entre el 6 y el 10/10.
- El mismo repo SIGHTLINE registra el conflicto de reglas sin resolverlo: "The global Participant FAQ says teams may not begin before the hackathon. The team says our Local Event (Bangladesh) lifted that, but nasaspaceappsbd.com says nothing about it either way (checked 2026-10-01)" **[LEÍDO]**. **No acuso a nadie:** parece un formato local organizado. Si NASA valida esos trabajos previos para el juzgamiento global, es una cuestión abierta **[NO VERIFICADO]**.
- **Consecuencia [INFERENCIA]:** los competidores más fuertes de 2026 llegan al 14/11 con **3 a 5 semanas de desarrollo** y, en varios casos, con cientos de commits, tests, validación contra referencias de NASA y demo en producción. Un equipo que empiece el 14/11 sin trabajo previo compite contra eso en el juzgamiento global, salvo que las reglas lo impidan.
- **Uso de IA:** muchos repos traen archivos de agentes de código (`CLAUDE.md`, `AGENTS.md`, `.claude/`, `.lovable/`, `.bolt/`). Lo detecté en al menos 19 de 78 **[CÓDIGO]**. Algunos declaran el uso de IA explícitamente (One-Way Manifest, FlameScope `docs/AI_USE.md`, IGNITE-AI `docs/AI_USE.md`) **[LEÍDO]**. La calidad de documentación del tipo "lo verificado y lo simulado" es alta en los mejores repos. La IA bajó mucho el costo de producir prototipos pulidos **[INFERENCIA]**.
- **Duplicados:** `KraKEn-bit/TerraNova` y `Yakiyo/terra-nova` comparten el primer commit (mismo proyecto). `jihadjp/nasa-junior-astronaut-trainer` y `jihadjp/outpost-app` tienen el mismo historial. `2NCE3/Game1` y `Royel-king-80/Game1` también. **[CÓDIGO]**
- **Clones fallidos** (posiblemente privados, renombrados o borrados): `ahsanur-official/Interplanetary-Survival-Guide-Martian-Map`, `iqbalhasanshanto-dev/TerraMatch`, `haXorFalcon/nsaspace`, `Tarek-Ahmed303/flame-in-freefall`.
- **Afirmaciones infladas:** dos repos usan insignias de "Global Nominee" (`gmrafi/cfsbr-selensync`: "Global Nominees 2025"; `partofcosmos-site/lunarsite-compass`: "2026 Global Nominee"), aunque el juzgamiento 2026 todavía no ocurrió **[LEÍDO]**. No son evidencia de nada.
- **Resúmenes de desafíos citados por los repos [LEÍDO, cita de segunda mano del resumen del 17/09; el enunciado completo sale el 28/10]:**
  - Analog (ShadowAstra): "…such terrestrial analog sites are not entirely well characterized. Your challenge is to use open Earth, Moon, and Mars data from NASA and other space agencies to identify and characterize new terrestrial analogs."
  - CLPS (`Hamzaslam1996/lunarwindow` docs/challenge.md): "…create an intuitive tool or application that lets mission planners, educators, and the public compare landing sites and dates quickly, visualizing Sun and Earth positions relative to the horizon to assess power generation potential and direct-to-Earth communication windows." Dificultad: Advanced/Intermediate.
  - Martian Map (`pollob-kumar` PROJECT_CONTEXT y Protikriti): "…create a layered, integrated view of a location or route on the Martian surface that pulls together data from multiple NASA science missions, to help a human explorer plan a successful Marswalk while doing new science along the way." RISHI-1453 lo etiqueta como "Intermediate".
  - Mission Design Game (`Gxxrazn21/Juego_Nasa`, paráfrasis): "diseñar, gestionar y simular una misión completa con compromisos de ingeniería". `arefinkhansiam/mission-forges` lo llama "Challenge 13".

## 4. Hallazgos por desafío

Fechas = primer → último commit (hora local del autor). "Nivel" = esqueleto / prototipo / prototipo avanzado / producto operativo. Los números de tests y de validación son **declarados** en el README salvo que diga [CÓDIGO]. No ejecuté ninguna suite.

### 4.1 Interplanetary Survival Guide: Martian Map

| Repo | Fechas | Commits | Declara | Comprobado | Nivel |
|---|---|---|---|---|---|
| AhsanulHoque22/…-Team-Protikriti | 29/09 → 21/10 | 241 | Globo 3D CesiumJS de todo Marte, "Street View" de rovers armado con 2.087 paradas Navcam, planificador de Marswalk A* con pendiente ≤15° y tarjeta GO/NO-GO, clima REMS/MEDA, capas HiRISE/CTX, 182 tests, demo en atlas-mars.vercel.app | `web/src/core/route.ts`: A* por tiempo de viaje con función de Tobler y tope de traje; 84 archivos `*.test.ts` y 31 en `pipeline/tests` [CÓDIGO]. README con sección honesta de "Limitations" (ritmo de marcha sin cita NASA, rutas solo en Jezero/Gale, MEDA archivado) [LEÍDO] | Prototipo avanzado, cerca de producto |
| RISHI-1453/…Martian_Map (Code Huzzlers) | 03/10 → 04/10 | 11 | Mapa por capas (WMTS de Mars Trek), DEM HRSC/MOLA global leído por HTTP range, presupuesto de O₂/CO₂/agua/batería del traje, validación contra JPL Horizons | Estructura backend Python y frontend JS acorde [CÓDIGO] | Prototipo |
| Abraham-K-Antony/Martian-Route-EVA-Planner | 30/09 → 08/10 | 31 | FastAPI + Leaflet en Jezero, costo metabólico de Minetti, 5 estrategias de ruta, línea de vista RF, briefing con Gemini, demo en Render | `core/pathfinder.py`, `eva_safety.py` y `ai_briefing.py` presentes [CÓDIGO]. Licencia "All Rights Reserved" [LEÍDO] | Prototipo |
| pollob-kumar/nasa-space-apps-martian-map | 25/09 → 06/10 | 24 | Andamiaje React/Leaflet; "Status (honest)": corre con **terreno sintético**, sin datos reales | Muchos docs (SRS, SDD) y poco dato [CÓDIGO] | Esqueleto |
| Otros: Jarin4649, Dipto2103/Project_Tuesday, Jamiulsunny/Demo-Ideas, lshtiaq, Aluchashi/Martialoy (1 archivo), sakshiingle0606-crypto/Martian-Map (2 archivos) | 22/09 → 20/10 | 1–12 | Varios | Martialoy y Martian-Map: casi vacíos [CÓDIGO] | Esqueleto a prototipo |

- **Más fuerte verificado:** Team Protikriti. Funcionalidad muy amplia, tests, datos NASA/USGS/IAU reales y limitaciones declaradas.
- **Alternativas institucionales [NO VERIFICADO, conocimiento previo]:** NASA Mars Trek (RISHI-1453 consume sus WMTS [CÓDIGO]), JMARS (ASU), visores HiRISE/CTX, Google Mars.
- **Saturación:** ≥11 repos en 1 consulta, más ≥10 ya listados en el BRIEF. **Muy alta.** El nicho "ruta A* con pendiente en Jezero" ya lo cubren al menos 4 equipos [CÓDIGO/LEÍDO].

### 4.2 Abandoned but not Forgotten

| Repo | Fechas | Commits | Declara | Comprobado | Nivel |
|---|---|---|---|---|---|
| tgalitzine/One-Way-Manifest | 22/09 → 24/09 | 3 | Sitio 3D de 10 capítulos para 12–16 años; atlas de 115 objetos (96 Luna según la tabla NSSDCA "Anthropogenic Impacts…", 19 Marte); verificación de datos en septiembre de 2026; sección "lo que NASA dice / no dice"; declaración de IA (Claude); MIT; GitHub Pages | Todo el sitio en un único `index.html` de unos 16 MB, con recursos incrustados [CÓDIGO] | Producto web terminado (contenido) |
| Sattwik777/abandoned-not-forgotten (Offworld Legacy) | 07/10 | 6 | Museo digital React, explorador de artefactos, relato de 9 pasos por objeto | Componentes React presentes [CÓDIGO] | Prototipo |
| samiulislam66200-alt/space-graveyard | 07/10 → 08/10 | 3 | Next.js, "Zero Fabricated Facts", línea de tiempo "Last Signal", mapas | Estructura Next.js [CÓDIGO] | Prototipo |
| ankur-maurya25/orbital-archive | 06/10 → 08/10 | 14 | PHP/MySQL, 18 reliquias, panel de administración | Endpoints `api/*.php` [CÓDIGO] | Prototipo |
| rakat2002/Team-Aether (Astrorelics) | 10/10 | 4 | Plataforma educativa infantil | Subido como zip descomprimido con `__MACOSX/`; README con artefactos "[cite: 1, 2]" de texto generado [CÓDIGO/LEÍDO] | Prototipo de calidad baja |
| Otros: SarowarSuman, Preetthee/Space-Trace, Ajlanalif/silent-voyagers, Vuz-Le/Light-of-Memories, tahmimsayeed | 03/10 → 15/10 | 1–9 | Narrativa, juego y museo | — | Esqueleto a prototipo |

- **Más fuerte verificado:** One-Way Manifest, por rigor de fuentes, atlas basado en NSSDCA y público definido. Offworld Legacy compite por amplitud.
- **Alternativas [NO VERIFICADO]:** tabla NSSDCA de objetos en la Luna (citada por One-Way Manifest [LEÍDO]), imágenes LROC de los sitios Apollo, For All Moonkind (registro de patrimonio), el "Catalogue of Manmade Material on the Moon" (KABK) que apareció en la búsqueda 4 [SNIPPET].
- **Saturación:** ≥10 en 1 consulta. **Alta.** Los repos convergen en "museo digital / línea de tiempo / quiz"; la diferenciación por rigor ya la ocupa One-Way Manifest.

### 4.3 Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars

| Repo | Fechas | Commits | Declara | Comprobado | Nivel |
|---|---|---|---|---|---|
| shishir-kuet/terrestrial-analog-finder | 09/10 → 10/10 | 22 | DEMs LOLA/CTX/Copernicus a 30 m, 12 regiones de referencia, 558 ventanas terrestres, capa térmica y mineral (ECOSTRESS, VIIRS, EMIT, TES, Diviner), FastAPI + React; aclara que el índice "no es una probabilidad" | `backend/app/similarity.py`: distancia RMS ponderada con escalado IQR, Wasserstein para el histograma de pendientes y penalización explícita por dato faltante; tests pytest y vitest [CÓDIGO] | Prototipo avanzado |
| Yakiyo/terra-nova = KraKEn-bit/TerraNova (DaRK_MATTER) | 27/09 → 20/10 | 39 (6 autores) | 78.247 celdas a 0,5°, perfiles Shackleton/Malapert/Haworth/Jezero/Gale, globo 3D, validación contra análogos conocidos, Apache-2.0 | Pipeline `src/acquire/*` (POWER, GIBS NDVI, landmask) y caché `.npy` versionada [CÓDIGO] | Prototipo avanzado |
| JimmyGuajan/twinworlds | 13/10 | 9 | Huella ambiental de 15 ejes, Diviner PRP, neutrones de Odyssey, SHARAD, NASA POWER 2001–2025, "campaña" de 3 sitios por set-cover, escaneo en vivo, ES/EN, GitHub Pages | `js/engine.js` (7 KB) con `fingerprint`, `compare`, `buildCampaign` [CÓDIGO] | Prototipo |
| ABRUBAB/ShadowAstra_Atlas | 10/10 → 19/10 | 7 | Puntaje según la tarea a ensayar, "false friends", laboratorio de sombras lunares, demo en Vercel | React 19 + three.js [CÓDIGO] | Prototipo |
| es-ratt/earthtwin (PLANEX) | 01/10 → 19/10 | 5 | Plataforma con "Data Center" de importación | README: **datos DEMO de relleno**, "NOT A VERIFIED SCIENTIFIC RESULT" [LEÍDO] | Prototipo (sin datos reales) |
| Otros: NishadIslamUtso/CosmoCode, clickTwice26/nasc, AshrafAbid078/terra-analog | 26/09 → 10/10 | 2–14 | — | — | Esqueleto a prototipo |

- **Más fuerte verificado:** terrestrial-analog-finder, por método transparente y reproducible, con tests. TerraNova por cobertura global. TwinWorlds por narrativa y hallazgos concretos.
- **Alternativas [NO VERIFICADO]:** catálogos de análogos (NASA Analog Missions, Europlanet/PTAL, la literatura de análogos), NASA POWER, MODIS/Copernicus DEM.
- **Saturación:** ≥10 en 1 consulta. **Alta.** El patrón "puntaje multicriterio contra perfiles Shackleton/Jezero" está repetido en al menos 5 repos.

### 4.4 CLPS Lunar Mission Browser

| Repo | Fechas | Commits | Declara | Comprobado | Nivel |
|---|---|---|---|---|---|
| NetRunnerXD/lunar-horizon-wheel | 13/10 | 4 | Rueda de horizonte LOLA 40 m, tracks Sol/Tierra cada 10 min, contactos DSN, presupuesto de enlace, catálogo CLPS, capas Chandrayaan-3, exportaciones, GitHub Pages | `docs/validation.md` generado: contra PGDA de 18,6 años en una grilla de 3.721 nodos, sesgo −0,87 pp, RMSE 4,55, r 0,955. **Reporta también sus peores casos** (sitios contra PGDA 60 m: RMSE 25,34) [LEÍDO]. `src/physics.test.ts` y pipeline Python [CÓDIGO] | Prototipo avanzado (rigor alto) |
| samuelakosaonyejekwe/lunahorizon | 30/09 → 03/10 | 21 | PWA offline, mapas anuales 2026–2044, buscador de ventanas con .ics, sitios Artemis III y CLPS (IM-1, IM-2, Blue Ghost), relé, validación contra DE421/DE440 (error máx. 0,009°) | `tools/validate.py`, `tools/test.mjs`, teselas DEM versionadas; carpeta `submission/` con video y slides [CÓDIGO] | Prototipo avanzado / producto |
| WarRinOP/sightline | 01/10 → 10/10 | 113 (3 autores) | Motor SPICE + LOLA 5 m, verificado contra Horizons y Barker et al. 2021; al 3/10 declara que "Story mode, window finder, AI analyst are not built yet" | Monorepo con `packages/engine` (151 archivos), 40 archivos de test, CI [CÓDIGO] | Prototipo avanzado |
| gmrafi/cfsbr-selensync | 18/09 → 12/10 | 243 | Next.js, LOLA + DSN + MCDA, "15 papers" | Chat con Groq/Gemini en `app/api/chat` [CÓDIGO]; sin tests visibles; insignia "Global Nominees 2025" [LEÍDO] | Prototipo (afirmaciones infladas) |
| partofcosmos-site/lunarsite-compass | 01/10 → 02/10 | 31 | Next.js + Python, 720 épocas en noviembre de 2026, "27/27 tests", "Flight Decision Seal SHA-256" | Insignias de "Global Nominee" [LEÍDO] | Prototipo con marketing excesivo |
| Otros: suhaslord (funciones "planned"), 0Aaheed0/SeleneSight (1 archivo), MoriamChowdhury/LunnerCommand (juego), Hamzaslam1996/lunarwindow | 23/09 → 16/10 | 2–23 | — | — | Esqueleto a prototipo |

- **Más fuerte verificado:** empate técnico entre Lunar Horizon Wheel (validación cuantitativa contra PGDA, honesta con sus errores) y LunaHorizon (la más completa en funciones y UX: PWA, offline, buscador de ventanas, 19 años). SIGHTLINE le sigue de cerca.
- **Alternativas institucionales:** productos PGDA de NASA Goddard (visibilidad media de Sol y Tierra, product 69), usados como referencia por Lunar Horizon Wheel [LEÍDO en repo]. JPL Horizons y NAIF SPICE [LEÍDO en repo]. NASA Ames "Lunar Browser" (trayectorias; NTRS 20240005553) [SNIPPET]. Lunar QuickMap / Moon Trek / herramientas LROC [NO VERIFICADO]. El propio resumen del desafío reconoce que "tools … exist, but their complicated interfaces…" [LEÍDO, cita de segunda mano].
- **Saturación:** ≥9 en 1 consulta. **Muy alta y técnicamente madura**: al menos 3 equipos ya validan contra efemérides de JPL y LOLA/PGDA.

### 4.5 Create Health Monitoring Software for Astronauts on Space Missions

| Repo | Fechas | Commits | Declara | Comprobado | Nivel |
|---|---|---|---|---|---|
| Nav33dCodes/vita-astronaut-health-monitor (VITA) | 17/10 | 4 | .NET 10 + Next.js + Postgres + SignalR; rangos NASA-STD-3001; puntaje de alerta temprana adaptado de NEWS2; escalamiento de alarmas; reportes PDF/Excel | `Domain/Vitals/EarlyWarning.cs`, `Simulation/TelemetrySimulator.cs` y suite `AstroHealth.Tests` (flujo, realtime, reportes) [CÓDIGO]. Datos **simulados** [CÓDIGO] | Prototipo avanzado (ingeniería de software sólida) |
| aliray-yan/astro-health | 03/10 | 1 | Línea base personal + Isolation Forest + explicación por LLM (OpenRouter); calibra el simulador con 2 datasets OSDR de Inspiration4 | `backend/anomaly.py`, `simulator.py`, `data/i4_biomarkers.json` [CÓDIGO] | Prototipo |
| mdrafsanjanee/Astronaut-Health-Monitor | 27/09 → 21/10 | 14 (4 autores) | Repetición de los datos biomédicos **reales** de Apollo 15 (Mission Report de 1971) y etiqueta lo que rellena | HTML/JS estático, `data/telemetry*`, `nasa-references.json` [CÓDIGO] | Prototipo (ángulo original: datos históricos reales) |
| adityabiswas108/AUREON | 25/09 | 14 | Panel con datos simulados, "no es diagnóstico" | Hecho con Bolt (`.bolt/`) [CÓDIGO] | Prototipo básico |
| Otros: cha9ticw9lf (1 archivo), mohammedyusuflab (se declara "proposal… no runnable code"), meherpurtv71-sketch (2 archivos), md-istiak (1 archivo), fahadaslam-dev (Gemini) | 28/09 → 07/10 | 1–5 | — | — | Esqueleto |

- **Más fuerte verificado:** VITA en ingeniería. El ángulo de datos reales (Apollo 15, OSDR) lo cubren mdrafsanjanee y astro-health.
- **Problema de fondo [INFERENCIA]:** no hay telemetría biomédica pública de tripulaciones actuales. Casi todos simulan datos, así que la diferenciación cae en UX y en reglas clínicas. Alto riesgo de "dashboard genérico".
- **Alternativas [NO VERIFICADO]:** Bio-Monitor/Astroskin (CSA), Hexoskin, NASA OSDR/GeneLab (citado por astro-health y AL-KASAV [LEÍDO]), NASA-STD-3001 (citado por VITA [LEÍDO]).
- **Saturación:** ≥10 en 1 consulta. **Alta**, pero con muchos esqueletos.

### 4.6 Build a Junior Astronaut Mission Trainer

| Repo | Fechas | Commits | Declara | Comprobado | Nivel |
|---|---|---|---|---|---|
| ridwanrifat13-afk/sol-keeper (Projonmo Apollo, CUET) | 18/09 → 07/10 | 152 | Juego de base lunar/marciana para 8–18 años; "Reality Dial" de 3 niveles; 3 misiones reales; cada parámetro con fuente y nivel de confianza; demo en Vercel; MVP con fecha límite 27/09 | Monorepo `packages/sim` (76 archivos, TS puro, RNG con semilla según el brief) y `apps/web` (333); 59 archivos `*.test.ts` [CÓDIGO] | Prototipo avanzado / producto |
| Yoriichi-0u0/little-orbit | 04/10 | 1 | 14 turnos, 8 módulos, 5 recursos acoplados, pronóstico del turno siguiente, 14 referencias, CI y QA de navegador, Vercel | `src/game/model.test.ts`, `docs/research.md`, `docs/verification.md` [CÓDIGO] | Prototipo avanzado |
| jihadjp/nasa-junior-astronaut-trainer (= outpost-app) | 06/10 → 11/10 | 18 | Three.js, PWA, bilingüe bengalí/inglés, "18 tests", 8 laboratorios | `docs/SOURCES.md`, `docs/TESTING.md` [CÓDIGO] | Prototipo |
| meetmehedi/Jr_AstroCamp | 27/09 → 07/10 | 7 | Simulador Pygame + portal React, "76 misiones" | `main.py`, `nasa_game/*` y documentos .docx [CÓDIGO] | Prototipo |
| Otros: Ratul-007 ("In Development"), Carolineamancio (5 archivos), MikeGyver-SME (7 archivos), obamaeverywhere | 23/09 → 20/10 | 2–18 | — | — | Esqueleto |

- **Más fuerte verificado:** Sol Keeper (profundidad de simulación, trazabilidad de parámetros, tests). Little Orbit le sigue por diseño pedagógico.
- **Alternativas [NO VERIFICADO]:** recursos educativos de NASA STEM / NASA Space Place, juegos comerciales de gestión de colonias (Surviving Mars, etc.).
- **Saturación:** ≥9 en 1 consulta. **Alta.** El concepto "gestión de recursos de una base en Luna/Marte" se repite en casi todos.

### 4.7 Space Mission Design Game

| Repo | Fechas | Commits | Declara | Comprobado | Nivel |
|---|---|---|---|---|---|
| dean50312-hub/space-mission-design-game (太空精算師 Space Actuary) | 20/09 → 20/10 | 58 (3 autores) | Pixel art; 5 tipos de misión mapeados a satélites reales; 4 lanzadores con confiabilidad estimada de su historial; puntaje = valor esperado / óptimo exhaustivo; ZH/EN; GitHub Pages | `js/mission.js`: ecuación del cohete (`isp*G0*ln(wet/dry)`) y confiabilidad exponencial por grado de componente [CÓDIGO]. GDD y referencias [CÓDIGO] | Prototipo avanzado / juego jugable |
| Gxxrazn21/Juego_Nasa (Δv · Arquitecto de Misiones) | 08/10 | 7 | Juego 3D en español; nave modular; Tsiolkovsky por etapa; 14 chequeos tipo PDR; eventos de clima espacial con datos DONKI del mes; informe "¿qué pasaría si…?" | `src/physics.js`; `api/nasa.js` es un proxy a api.nasa.gov/DONKI [CÓDIGO] | Prototipo avanzado |
| arefinkhansiam/mission-forges (Team Ghost Hunter, BD) | 29/09 → 18/10 | 20 | Nave + ruta Hohmann + lanzamiento 3D; demo en Vercel; "Challenge 13" | Hecho con Lovable (`.lovable/plan/…`) [CÓDIGO] | Prototipo |
| Tayebbb/RED-FRONTIER | 03/10 → 08/10 | 20 | Rover a Marte; Godot + Blender; README admite que hoy es solo un "facility-and-rover-configuration prototype" [LEÍDO] | 783 archivos, sobre todo arte [CÓDIGO] | Prototipo parcial |
| Otros: mariam2009m44-lab/mission-control (72 commits, React, leaderboard), MahiAlAraf/NASA (4 archivos), 2NCE3 = Royel-king-80/Game1, sahandurairaj (2 archivos), Bee92-exe/what-if | 25/09 → 12/10 | 3–72 | — | — | Esqueleto a prototipo |

- **Más fuerte verificado:** Space Actuary (mecánica original de valor esperado contra óptimo, física real, pulido). Δv Arquitecto le sigue por profundidad y por estar en español (relevante para un equipo hispanohablante: el nicho del idioma ya está ocupado).
- **Alternativas comerciales [NO VERIFICADO]:** Kerbal Space Program 1/2, SimpleRockets/Juno, Spaceflight Simulator, NASA Eyes.
- **Saturación:** ≥10 en 1 consulta. **Alta.** El patrón "constructor de nave + presupuesto + Δv" está muy repetido.

### 4.8 Flame in Freefall

| Repo | Fechas | Commits | Declara | Comprobado | Nivel |
|---|---|---|---|---|---|
| ShuvroShimuL/FlameScope ("Will It Burn?") | 21/09 → 10/10 | 24 (3 autores) | Explorador de evidencia BASS-II: 20 ensayos PMMA más tablas de tela y Nomex, todo trazado a una página del NASA/TM-20210011385; servidor MCP con herramientas deterministas; modo offline; "112 checks" | `data/bass-*.csv` y `bass-ii-tables.provenance.json`; 20 archivos de test; `src/agents/mcp-server.mjs` [CÓDIGO]. Bitácora de IA [LEÍDO] | Prototipo avanzado (rigor alto) |
| shaharia179/flame-in-freefall | 08/10 → 10/10 | 27 | ML sobre la Tabla IX de FLEX (NASA/TP-2015-216046): 276 ensayos; clasificación de extinción y regresión de tasa de quemado; SHAP; Streamlit | `data/flex_clean.csv` = 276 filas + encabezado [CÓDIGO]. RF con exactitud 0,82 contra 0,67 de línea base (validación aleatoria) [LEÍDO] | Prototipo (honesto, pequeño) |
| banglapoly/ignite-ai-app (IGNITE-AI) | 25/09 → 30/09 | 11 | Clasificador entrenado en 143 experimentos NASA publicados; RAG local sobre NTRS; Apache-2.0 | `model_card.json`: GradientBoosting, n=143, CV 0,734 contra mayoría 0,608, "leave-reports-out" 0,692; 123 de 143 en 0 g [CÓDIGO] | Prototipo avanzado (métricas honestas) |
| samuelakosaonyejekwe/flame-in-freefall | 03/10 → 04/10 | 13 | Panel con envolvente de inflamabilidad y "zona de riesgo oculto" (pasa el test 1 g pero arde en µg), feed en vivo de NTRS/OpenAlex/Crossref vía Cloudflare Worker, offline | `assets/engine.js`, `relay/` [CÓDIGO] | Prototipo avanzado |
| FarhanS7/IGNIS | 30/09 → 07/10 | 85 | Constructor de escenarios de hábitat; "AI is not the source of truth"; video demo | Insignia "Status: Interactive Landing Page" [LEÍDO] | Prototipo / landing |
| meherabmehu/Flame_On (CinderLens) | 07/10 → 11/10 | 76 | Explorador basado en preguntas | README: **todas las filas son de demostración e inventadas** [LEÍDO] | Prototipo sin datos reales |
| Otros: KhalidHasan03, sayeedalsahab12517-collab (3 archivos), chaimaachk (descripción ajena al tema: "cybersecurity pipeline", primer commit 17/09; posible coincidencia de nombre [INFERENCIA]), Tarek-Ahmed303 (clon fallido) | 17/09 → 06/10 | 2–5 | — | — | Esqueleto |

- **Más fuerte verificado:** FlameScope (trazabilidad a página de reporte, MCP, tests). IGNITE-AI es el más sólido en ML honesto. shaharia179 es el único sobre FLEX, con limpieza documentada.
- **Fuentes de datos ya extraídas por competidores [LEÍDO]:** BASS-II (TM-20210011385), FLEX Tabla IX (TP-2015-216046), repositorio NASA PSI (psi.nasa.gov, PSI-25), Saffire, NTRS. Los datos "fáciles" ya están transcritos y versionados en repos públicos.
- **Alternativas [NO VERIFICADO]:** NASA PSI (Physical Sciences Informatics), NASA-STD-6001 (ensayos de inflamabilidad de materiales), literatura de combustión en microgravedad.
- **Saturación:** ≥10 en 1 consulta. **Alta.** Patrón dominante: "explorador de evidencia + clasificador pequeño + chat".

## 5. Resumen comparativo

| # | Desafío | Repos 2026 hallados (piso) | Más fuerte verificado | Madurez del líder | Saturación |
|---|---|---|---|---|---|
| 1 | Martian Map | 11 (+ ≥10 del BRIEF) | Team Protikriti | Muy alta (241 commits, 182 tests declarados, demo) | Muy alta |
| 2 | Abandoned but not Forgotten | 10 | One-Way Manifest | Alta en contenido y rigor | Alta |
| 3 | Earth Analogs | 10 (9 únicos) | terrestrial-analog-finder / TerraNova | Alta (método reproducible y testeado) | Alta |
| 4 | CLPS Browser | 9 | Lunar Horizon Wheel / LunaHorizon | Muy alta (validados contra PGDA y DE440) | Muy alta |
| 5 | Health Monitoring | 10 | VITA | Alta en ingeniería, con datos simulados | Alta (muchos esqueletos) |
| 6 | Junior Trainer | 9 (8 únicos) | Sol Keeper | Muy alta (152 commits, 59 archivos de test) | Alta |
| 7 | Mission Design Game | 10 (9 únicos) | Space Actuary | Alta | Alta |
| 8 | Flame in Freefall | 10 | FlameScope / IGNITE-AI | Alta (trazabilidad, ML con métricas honestas) | Alta |

Lectura [INFERENCIA]: en los 8 desafíos hay ya **al menos un competidor de nivel "prototipo avanzado"** construido con semanas de ventaja, y en 1, 4 y 6 hay competidores cercanos a producto. Ninguno de los 8 está "libre". Los espacios relativamente menos ocupados (en calidad, no en cantidad) parecen ser **5 (Health)**, donde casi todos simulan datos y el rigor clínico es bajo, y **2 (Abandoned)**, donde fuera de One-Way Manifest predominan museos genéricos. Ambos son desafíos donde la diferenciación por "dato real" es difícil por naturaleza.

## 6. Objeciones propias (autocrítica)

1. **Sesgo del buscador:** cada consulta devuelve ~10 resultados, sesgados hacia repos con nombres o descripciones explícitas. Repos con nombres opacos, privados o en GitLab no aparecen. El conteo es un piso.
2. **Sesgo geográfico:** la sobrerrepresentación de Bangladesh se explica por su Etapa 1 local (repo público obligatorio). En otros países los equipos pueden estar trabajando en privado o no haber empezado. La competencia global real del 14/11 puede ser distinta de lo observable hoy.
3. **Fechas de commit:** son marcas puestas por el cliente git y se pueden alterar. Las tomo como indicio, no como prueba.
4. **"Comprobado" ≠ "funciona":** verifiqué la presencia y el contenido de archivos (algoritmos, datos, tests), pero **no ejecuté** nada. Las cifras de tests y de validación son declaradas salvo donde digo [CÓDIGO].
5. **Alternativas institucionales y comerciales casi sin verificar** por el agotamiento de búsquedas. Solo cuentan como verificadas las que los repos citan y usan.
6. **Calidad ≠ volumen de commits:** Lunar Horizon Wheel tiene 4 commits y una validación mejor que SelenSync con 243. Lo tuve en cuenta.
7. Los enunciados completos (28/10) pueden cambiar el alcance (datos obligatorios, público objetivo) y volver obsoletos algunos de estos proyectos, o favorecerlos.

## 7. Conclusiones

1. Los 8 desafíos de este bloque están **saturados** (≥9 repos públicos 2026 cada uno, con una sola consulta) y en todos hay un competidor fuerte con semanas de ventaja.
2. La causa principal de los repos previos al hackatón, documentada, es la **Etapa 1 local de Bangladesh** (repo + video antes del 7/10). Uno de esos equipos señala por escrito que choca con el FAQ global. Cómo trata NASA ese trabajo previo en el juzgamiento global no está verificado.
3. **Martian Map** (relevante para ASTRA): Team Protikriti cubre y supera el alcance de ASTRA (rutas por pendiente en Jezero, más capas, Street View, tests y demo). Al menos otros 3 equipos hacen A* con pendiente en Jezero. Esto refuerza la decisión E vigente **[INFERENCIA]**.
4. **CLPS** es el desafío más maduro técnicamente: ya hay validaciones cuantitativas contra PGDA y DE440. Competir ahí exige superar un nivel científico alto.
5. En **Flame in Freefall**, los datasets clave (BASS-II, FLEX, PSI) ya están transcritos y modelados con métricas honestas (exactitud de 0,69 a 0,82 sobre líneas base de 0,61 a 0,67). El techo de "IA" con n≈143–276 es bajo. Un modelo más grande no es una ventaja creíble.

## 8. Tabla de fuentes

| URL / fuente | Qué afirma | Estado |
|---|---|---|
| github.com/AhsanulHoque22/Nasa-Space-Apps-Challenge-2026-Team-Protikriti | Atlas de Marte, A* ≤15°, 182 tests | [LEÍDO] README; [CÓDIGO] route.ts y tests |
| github.com/RISHI-1453/NASA_Space-Apps_Challenge_Martian_Map | Capas Mars Trek, DEM global por range, presupuesto del traje | [LEÍDO] README |
| github.com/Abraham-K-Antony/Martian-Route-EVA-Planner | Minetti, 5 rutas, Gemini | [LEÍDO] README |
| github.com/pollob-kumar/nasa-space-apps-martian-map | Andamiaje con terreno sintético; cita el resumen del desafío | [LEÍDO] |
| github.com/tgalitzine/One-Way-Manifest | 115 objetos, NSSDCA, declaración de IA | [LEÍDO]; [CÓDIGO] index.html de 16 MB |
| github.com/Sattwik777/abandoned-not-forgotten · samiulislam66200-alt/space-graveyard · ankur-maurya25/orbital-archive · rakat2002/Team-Aether_NasaSpaceAppChallenge2026 | Museos y archivos digitales | [LEÍDO] READMEs |
| github.com/shishir-kuet/terrestrial-analog-finder | Similitud reproducible con DEM; nota sobre fechas 14–15/11 | [LEÍDO]; [CÓDIGO] similarity.py y tests |
| github.com/Yakiyo/terra-nova (= KraKEn-bit/TerraNova) | 78.247 celdas, validación contra análogos | [LEÍDO]; [CÓDIGO] |
| github.com/JimmyGuajan/twinworlds | Huella de 15 ejes, set-cover | [LEÍDO]; [CÓDIGO] engine.js |
| github.com/ABRUBAB/ShadowAstra_Atlas | Cita del resumen Analog; cronograma de Dhaka | [LEÍDO] README y HANDOFF.md |
| github.com/es-ratt/earthtwin | Datos DEMO de relleno | [LEÍDO] |
| github.com/NetRunnerXD/lunar-horizon-wheel | Validación contra PGDA y Horizons | [LEÍDO] README y validation.md |
| github.com/samuelakosaonyejekwe/lunahorizon | PWA, 2026–2044, validación contra DE421/DE440 | [LEÍDO]; [CÓDIGO] tools/ |
| github.com/WarRinOP/sightline | Etapa 1 de Bangladesh (7/10), conflicto con el FAQ, motor SPICE/LOLA | [LEÍDO] README y CLAUDE.md; [CÓDIGO] |
| github.com/gmrafi/cfsbr-selensync · partofcosmos-site/lunarsite-compass | Insignias de "Global Nominee" | [LEÍDO] |
| github.com/Hamzaslam1996/lunarwindow (docs/challenge.md) | Texto del resumen del desafío CLPS | [LEÍDO] (cita de segunda mano) |
| github.com/Nav33dCodes/vita-astronaut-health-monitor | NEWS2 adaptado, NASA-STD-3001, .NET | [LEÍDO]; [CÓDIGO] |
| github.com/aliray-yan/astro-health · mdrafsanjanee/Astronaut-Health-Monitor · adityabiswas108/AUREON | Isolation Forest + OSDR; repetición de Apollo 15; panel simulado | [LEÍDO]; [CÓDIGO] |
| github.com/ridwanrifat13-afk/sol-keeper | Reality Dial, parámetros con fuente, MVP 27/09 | [LEÍDO] README y PROJECT_BRIEF; [CÓDIGO] |
| github.com/Yoriichi-0u0/little-orbit · jihadjp/nasa-junior-astronaut-trainer · meetmehedi/Jr_AstroCamp | Entrenadores de base | [LEÍDO] |
| github.com/dean50312-hub/space-mission-design-game | Space Actuary, ecuación del cohete | [LEÍDO]; [CÓDIGO] mission.js |
| github.com/Gxxrazn21/Juego_Nasa · arefinkhansiam/mission-forges · Tayebbb/RED-FRONTIER-NASA-SPACE-APPS · mariam2009m44-lab/mission-control | Juegos de diseño de misión | [LEÍDO]; [CÓDIGO] parcial |
| github.com/ShuvroShimuL/FlameScope | BASS-II trazado, MCP, 112 checks | [LEÍDO]; [CÓDIGO] data y tests |
| github.com/shaharia179/flame-in-freefall | FLEX Tabla IX, 276 ensayos, RF 0,82 | [LEÍDO]; [CÓDIGO] CSV |
| github.com/banglapoly/ignite-ai-app | GB n=143, CV 0,734 | [CÓDIGO] model_card.json |
| github.com/samuelakosaonyejekwe/flame-in-freefall · FarhanS7/IGNIS · meherabmehu/Flame_On | Paneles y exploradores | [LEÍDO] |
| ntrs.nasa.gov/citations/20240005553 | "Lunar Browser" de NASA Ames (trayectorias, CLPS/Artemis) | [SNIPPET] |
| ig.utexas.edu (TDC-109) · kabk.nl (Catalogue of Manmade Materials on the Moon) | Reciclaje de hardware lunar; catálogo de materiales | [SNIPPET] |
| Archivo de fechas: /tmp/claude-0/-home-user/7029a718-8690-52ad-a08e-e11704dd6284/scratchpad/a2a/dates.txt | Primer y último commit, commits, autores y archivos de 78 repos | [CÓDIGO] |

## 9. Pendientes

1. **Reglas:** confirmar en el FAQ y los términos globales (bloqueados desde este entorno) si el trabajo previo autorizado por un evento local es elegible para el juzgamiento global. Es decisivo para evaluar a estos competidores.
2. **Alternativas institucionales y comerciales** (Mars Trek/JMARS, Lunar QuickMap/PGDA, For All Moonkind, Bio-Monitor/Astroskin, NASA PSI, KSP): verificar cuando haya presupuesto de búsqueda.
3. Repetir las consultas el 28/10 (enunciados completos) y en la semana del 9/11 para medir el crecimiento. Probar variantes de consulta (sin `site:`, en otros idiomas, GitLab) para superar el tope de 10 resultados.
4. Ejecutar (en un entorno aislado y solo si el orquestador lo aprueba) las demos públicas de los líderes de cada desafío para verificar funcionalidad, no solo código.
5. Revisar los clones fallidos (4 repos).
