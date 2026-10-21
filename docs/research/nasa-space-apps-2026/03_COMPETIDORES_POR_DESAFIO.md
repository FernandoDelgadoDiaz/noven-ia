# 03 — Competidores por desafío

Base: `agentes/A2a_competidores_espacio.md` (78 repos con historial de git), `A2b_competidores_tierra.md` (14 repos clonados), `A10_huecos_SAR_trends_SPHEREx.md` (26 repos clonados), A1 (unos 50 README) y A5 (alternativas institucionales).

**Método:**
- Los repos se descubrieron con WebSearch (`site:github.com` + título).
- Se clonaron con `git clone --filter=blob:none` y se leyeron README, código y `git log`. **No se ejecutó código de terceros.**
- La API de búsqueda de GitHub da 403 desde aquí.
- Etiquetas de evidencia:
  - **[CÓDIGO]**: se vio el archivo en el repo.
  - **[LEÍDO]**: README completo.
  - **[DECLARADO]**: métrica o función afirmada por el repo y no reproducida.

## 1. Hallazgos transversales (hechos)

1. **Ningún desafío está libre.** Cada búsqueda devuelve unos 10 resultados, así que los conteos son **pisos**, no totales:
   - entre 9 y 11 repos 2026 por desafío en los desafíos espaciales;
   - entre 9 y 13 en los terrestres;
   - 14 en C06, 15 en C02 y 17 en C12.
2. **Todos los repos fuertes son anteriores al hackatón** (primeros commits entre el 17/09 y el 20/10/2026) [CÓDIGO: git log].
   - **Causa documentada en 2 repos:** el evento local de Bangladesh tenía una "Etapa 1" que pedía repo público y video de 240 s antes del 7/10; solo los seleccionados pasan a la etapa presencial del 13–14/11 [LEÍDO: `WarRinOP/sightline`, `ABRUBAB/ShadowAstra_Atlas`].
   - Uno de esos equipos registra que esto choca con el FAQ global y que no tiene confirmación escrita.
   - 45 de 78 repos tienen zona horaria +0600.
   - **No se acusa a nadie.** No se sabe cómo trata esto el juzgamiento global.
3. **El pulido ya no es escaso.**
   - Al menos 19 de 78 repos tienen archivos de agentes de IA (`CLAUDE.md`, `.lovable/`, `.bolt/`) [CÓDIGO].
   - Varios declaran tests, validación contra referencias NASA y su propia sección de limitaciones.
   - Lo escaso es una decisión real del usuario, una validación contra una referencia independiente y una afirmación de alcance honesta.
4. **Hay afirmaciones infladas** (que no deben confundirse con calidad):
   - insignias de "Global Nominee 2026" antes del juzgamiento (`partofcosmos-site/lunarsite-compass`, `gmrafi/cfsbr-selensync`);
   - "Verified NASA data" con series cargadas a mano (`ahsanur-official/The-Earth-Information-Jukebox`);
   - desafíos inexistentes (`tiovene`).
5. **Los commits no miden calidad.** Lunar Horizon Wheel tiene 4 commits y una validación cuantitativa mejor que SelenSync, con 243 commits.

## 2. Competidor o alternativa más fuerte verificada, por desafío

| ID | Repos 2026 (piso) | Competidor 2026 más fuerte | Qué se comprobó (no se ejecutó) | Nivel | Alternativa institucional o comercial | Saturación |
|---|---|---|---|---|---|---|
| C01 | 10 | `tgalitzine/One-Way-Manifest` | Atlas de 115 objetos sobre la tabla NSSDCA, sección "qué dice y qué no dice NASA", declaración de IA [CÓDIGO: index.html de 16 MB] | Producto de contenido terminado | Tabla NSSDCA de objetos en la Luna; registro For All Moonkind (2021) [SNIPPET] | Alta |
| C02 | 15 | `Fibananagucchi/EarthTrendTest` | MK estacional de Hirsch-Slack con corrección por autocorrelación [CÓDIGO parcial] | Prototipo avanzado | Giovanni (series y mapas, sin test de significancia) [SNIPPET] | Alta; método commodity |
| C03 | 9 | `ridwanrifat13-afk/sol-keeper` | 152 commits, simulación TS con semilla, 59 archivos de test, cada parámetro con fuente [CÓDIGO] | Prototipo avanzado / producto | NASA Mission X (masivo) [SNIPPET] | Alta |
| C04 | 9 | `NetRunnerXD/lunar-horizon-wheel` y `samuelakosaonyejekwe/lunahorizon` | Validación contra PGDA (sesgo −0,87 pp, RMSE 4,55, r 0,955; reporta también sus peores casos) [LEÍDO validation.md]; PWA 2026–2044 validada contra DE440 [CÓDIGO tools/] | Prototipos avanzados con rigor alto | PGDA (Goddard), JPL Horizons, "Lunar Browser" de NASA Ames [SNIPPET] | **Muy alta y técnicamente madura** |
| C05 | 10 | `Nav33dCodes/vita-astronaut-health-monitor` | NEWS2 adaptado, NASA-STD-3001, .NET + tests; **datos simulados** [CÓDIGO] | Prototipo avanzado (en ingeniería) | NASA Clinical Decision Support; Astroskin (CSA) [SNIPPET / NO VERIFICADO] | Alta (muchos esqueletos) |
| C06 | 14 | `mahdimahmud2006-coder/nasa_space-apps_challenge` (TerraPulse) | 3 GCOV PROVISIONAL reales (Kathmandu), `extract_gcov.py`, `change.py`; 169 tests declarados [CÓDIGO parcial] | Prototipo avanzado | ASF Vertex; capa NISAR en GIBS; OPERA DSWx (Sentinel-1) [SNIPPET] | Media-alta en cantidad; **solo 2–3 con datos reales** |
| C07 | 11 | `sagar25446-prog/FieldShift-NASA` | POWER, CMIP6 (CSV en el repo), SMAP, Pareto, FAO-56, CI [CÓDIGO] | Prototipo avanzado | AquaCrop, DSSAT, APSIM, GAEZ [NO VERIFICADO / SNIPPET] | Alta y recurrente (2024, 2025, 2026) |
| C08 | 10 | `ShuvroShimuL/FlameScope`; `banglapoly/ignite-ai-app` | BASS-II trazado a la página del NASA TM, servidor MCP, 20 tests [CÓDIGO]; GB con n = 143, CV 0,734 contra 0,608 de mayoría, leave-reports-out 0,692 [CÓDIGO model_card] | Prototipos avanzados con métricas honestas | NASA PSI; NASA-STD-6001 [SNIPPET] | Alta; el ángulo del "negativo honesto" ya está parcialmente tomado |
| C09 | 13 | `Aalvee-Aarham/kiln-watch`; `samuelakosaonyejekwe/firecal` | 5.409 líneas de Python: ratio estratificado + bootstrap + test de Chow + GLM Poisson + prerregistro + cadena NOAA-20/21 [CÓDIGO]; FireCal: 208 países, contracción hacia un prior global, validación fuera de muestra [CÓDIGO] | Prototipos avanzados, los más rigurosos de todo el relevamiento | FIRMS (distribuye por sensor; no se encontró una serie armonizada [INFERENCIA]); armonización de área quemada de Boschetti/Roy/Giglio [SNIPPET]; INPE "satélite de referencia" [SNIPPET A5] | **Muy alta** |
| C10 | 10 | `shishir-kuet/terrestrial-analog-finder`; TerraNova | Distancia RMS ponderada con escalado IQR y Wasserstein, penalización por dato faltante, tests [CÓDIGO]; 78.247 celdas [CÓDIGO] | Prototipos avanzados | Catálogo CAFE (ESA, cualitativo) [SNIPPET] | Alta |
| C11 | ≥11 (+10 del brief) | `AhsanulHoque22/…Team-Protikriti` | 241 commits, A* con Tobler y pendiente ≤15°, 84 tests TS + 31 de pipeline [CÓDIGO], Street View de 2.087 paradas [DECLARADO] | Prototipo avanzado, cerca de producto | Mars Trek, JMARS [NO VERIFICADO] | **Muy alta**; al menos 4 hacen A* con pendiente en Jezero |
| C12 | 17 | `shrestha-droid/spherex-moving-sky` | Recuperación de asteroides conocidos, inyecciones para falsos positivos, dice recuperar Makemake y Haumea a ciegas [CÓDIGO parcial + DECLARADO] | Prototipo avanzado | IRSA; Backyard Worlds [SNIPPET] | **Muy alta**; lo obvio ya está validado |
| C13 | 10 | `dean50312-hub/space-mission-design-game` (Space Actuary) | Ecuación del cohete, confiabilidad por componente, puntaje = valor esperado / óptimo exhaustivo [CÓDIGO]; Δv Arquitecto en español | Prototipo avanzado / juego jugable | KSP, SimpleRockets [NO VERIFICADO] | Alta |
| C14 | 9 | `Yoriichi-0u0/earth-fm` | Sonificación de píxeles de frames del EIC, CSV con procedencia, tests unitarios y E2E [CÓDIGO] | Prototipo avanzado | Astronify, Chandra "A Universe of Sound", Highcharts Sonification Studio [SNIPPET / NO VERIFICADO] | Alta en cantidad, media en calidad |

## 3. Alternativas que parecen atractivas pero pierden frente a la competencia

- **C11 Martian Map:** el desafío del activo propio (ASTRA). Team Protikriti y al menos otros 3 equipos ya cubren y superan el alcance de ASTRA. E1 mostró además que el diferencial técnico de ASTRA (ruteo por pendiente sobre CTX) no reduce la exposición real.
- **C04 CLPS:** es el desafío técnicamente más interesante, pero ya hay dos equipos validados contra PGDA y DE440 con semanas de ventaja.
- **C12 SPHEREx:** tiene el mayor "wow" posible, pero el competidor más fuerte ya hizo inyecciones y recuperación de objetos conocidos.
- **C09 MODIS/VIIRS:** el problema es real y fechado, pero el núcleo (calibrar en el solape y dibujar un calendario) está resuelto cinco veces o más, una de ellas con prerregistro y bootstrap.
- **C08 Flame:** el "negativo honesto con baseline" ya lo practican IGNITE-AI y shaharia179.

## 4. Búsquedas sin resultado (no implican inexistencia)

- Repos para "Abandoned", "Flame in Freefall", "CLPS Lunar Mission Browser" y "Martian Map" **sin** `site:github.com`: no aparecieron. Con `site:` sí.
- Alternativas institucionales de C01, C03, C05 y C11 (For All Moonkind, Mission X, Astroskin, Mars Trek): no verificadas, por el cupo de búsqueda agotado.
- Repos fuera de GitHub o privados: no buscados.

## 5. Riesgos de esta sección

- **Sesgo de descubrimiento:** predominan READMEs en inglés y equipos de Bangladesh, por su Etapa 1 pública. Puede haber competidores fuertes privados que aparezcan recién el 15/11.
- **Fechas de git:** las fija el autor. Son un indicio, no una prueba.
- **Métricas:** ninguna se reprodujo.

## 6. Fuentes

Tablas completas en A2a §8, A2b §7 y A10 §8. Los repos citados son `github.com/<owner>/<repo>`, leídos por clon.
