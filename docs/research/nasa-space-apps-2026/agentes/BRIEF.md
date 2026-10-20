# Brief común para los agentes investigadores — NASA Space Apps 2026

Fecha: 2026-10-20. Hackatón: 14–15/11/2026. Enunciados completos (con datos y recursos): 28/10/2026. Guías de juzgamiento y de envío 2026: 13/11/2026.

## Misión general

Determinar cuál de los 14 desafíos oficiales de NASA Space Apps 2026 ofrece la mejor oportunidad para una propuesta original, útil, técnicamente realizable en 48 h y competitiva. **No hay una conclusión predeterminada.** El equipo tiene un activo previo (ASTRA, ver abajo); **no es favorito** y su peso no debe influir en tu análisis.

## Hechos de partida (verificalos; no los des por ciertos)

Títulos de desafíos 2026 encontrados como URL en el índice de búsqueda de spaceappschallenge.org (no leídos completos):

1. Interplanetary Survival Guide: Martian Map — `/2026/challenges/interplanetary-survival-guide-martian-map/`
2. Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars
3. Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars
4. CLPS Lunar Mission Browser — `/2026/challenges/clps-lunar-mission-browser/`
5. Create Health Monitoring Software for Astronauts on Space Missions
6. Build a Junior Astronaut Mission Trainer
7. Space Mission Design Game — `/2026/challenges/space-mission-design-game/`
8. Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data
9. Harmonization of MODIS and VIIRS Hot Spots (posiblemente propuesto por CONAE, sin verificar)
10. Field Shift: Adapting Farms with NASA Data
11. The Earth Information Jukebox
12. (¿?) Faltan al menos 2-3 títulos. Una fuente secundaria dice que 6 de los 14 son sobre la Tierra; otra menciona un desafío avanzado de "analizar datos de observación terrestre para identificar patrones de tendencias ambientales y climáticas".

Investigación previa sobre ASTRA (rama `research/astra-adversarial-validation` del repo `FernandoDelgadoDiaz/astra-mars-explorer`):
- ASTRA = DTM CTX 20 m de Jezero con procedencia por hash + prototipo web de rutas A* con penalización por pendiente (PR #1).
- Experimento prerregistrado E1: la ruta con penalización por pendiente sobre CTX **no** reduce la exposición real a pendientes >15° frente a la ruta más corta; rutear sobre CTX tampoco mejora a la recta. Decisión vigente: E (detener inversión).
- Ya se identificaron ≥10 repos públicos de equipos 2026 para "Martian Map" (Jezero, Marswalk, rutas, O₂, 3D): Team Protikriti, sakshiingle0606-crypto/Martian-Map, Aluchashi/Martialoy, neuronexus-mars-survival, Code Huzzlers, etc.
- Regla (fragmento del FAQ oficial, no leído completo): "Teams are not allowed to begin working on the challenges prior to the hackathon." Términos 2026 (actualizados 07/08/2026): material de terceros con licencia OSI, citar fuentes, Apache 2.0 por defecto. IA permitida con declaración (guía 2025).
- Ganadores: 10 premios globales sobre 5.556 (2023), 9.996 (2024), >11.500 (2025) proyectos. Categorías 2025: Best Use of Science, Best Use of Data, Best Use of Technology, Galactic Impact, Best Mission Concept, Most Inspirational, Best Storytelling, Global Connection, Art & Technology, Local Impact.

## Restricciones del entorno (importantes)

- **Bloqueados** (DNS/proxy): spaceappschallenge.org, nasa.gov, arxiv.org, adsabs, archive.org, devpost.com, medium, reddit, linkedin, la mayoría de los sitios de prensa. WebFetch suele fallar con ENOTFOUND. Probalo una vez y, si falla, registralo; no insistas.
- **Accesibles:** WebSearch (devuelve títulos, URLs y un resumen; **eso es snippet, no lectura**), `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>` y `https://codeload.github.com/<owner>/<repo>/tar.gz/<branch>` vía `curl` en Bash (repos públicos), pypi.org, registry.npmjs.org, gitlab.com.
- **No uses las herramientas `mcp__github__*`** para buscar o leer repos de terceros (están fuera de alcance). Usá WebSearch para descubrir repos y `curl` a raw/codeload para leerlos.
- Para descargar un repo de terceros: creá un directorio nuevo vacío en `/tmp/claude-0/-home-user-noven-ia/7029a718-8690-52ad-a08e-e11704dd6284/scratchpad/repos/<owner>__<repo>/`, extraé ahí, **no ejecutes nada** de ese código, solo leelo. Python con `-I` si lo procesás.
- Para fechas de commits de un repo público sin API: el tar.gz no trae historial; podés intentar `git ls-remote https://github.com/<owner>/<repo>` (puede funcionar por el proxy git) o `git clone --depth 1 --filter=blob:none` en un directorio de scratchpad para ver la fecha del último commit. Si falla, registralo.

## Reglas de evidencia (obligatorias)

- Clasificá cada dato como: **[LEÍDO]** (abriste la fuente completa), **[SNIPPET]** (solo resumen de buscador), **[INFERENCIA]** (tu razonamiento), **[NO VERIFICADO]**.
- Separá: funcionalidad declarada / comprobada (leíste el código) / prototipo / producto operativo / evidencia científica / afirmación sin verificar.
- Nunca inventes fuentes, repos, URLs, ganadores ni resultados. Si no encontrás algo, listá las búsquedas hechas y decí "no encontrado", no "no existe".
- No confundas popularidad, cantidad de commits o UI vistosa con calidad.
- **No escribas código de solución para ningún desafío.** Solo investigación.
- Distinguí los resúmenes publicados (17/09) de los enunciados completos (28/10, aún no publicados).

## Entregable de cada agente

Un único archivo Markdown en `/home/user/noven-ia/docs/research/nasa-space-apps-2026/agentes/<Ax>_<tema>.md`, en español, con: misión, búsquedas realizadas, hallazgos (con etiquetas de evidencia), objeciones propias, conclusiones, tabla de fuentes (URL, qué afirma, estado), pendientes. No hagas commits ni modifiques otros archivos. Tu respuesta final al orquestador: un resumen de ≤300 palabras con tus conclusiones principales y las 3 incertidumbres más importantes.
