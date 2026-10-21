# 10 — Fuentes y limitaciones

## 1. Organización de la investigación (independencia real)

| Agente | Función | Ejecución | Informe |
|---|---|---|---|
| A1 | Análisis oficial de los 14 desafíos | Subagente independiente, en paralelo | `agentes/A1_desafios_oficiales.md` |
| A2a | Competidores: desafíos espaciales (8) | Subagente independiente, en paralelo | `agentes/A2a_competidores_espacio.md` |
| A2b | Competidores: desafíos terrestres | Subagente independiente, en paralelo | `agentes/A2b_competidores_tierra.md` |
| A3 | Ganadores anteriores y criterios | Subagente independiente, en paralelo | `agentes/A3_ganadores_criterios.md` |
| A4 | Viabilidad técnica y datos | Subagente independiente, en paralelo | `agentes/A4_viabilidad_datos.md` |
| A5 | Originalidad y oportunidades | Subagente independiente, en paralelo | `agentes/A5_originalidad.md` |
| A6 | Producto, UX y demo | Subagente independiente, en paralelo | `agentes/A6_producto_demo.md` |
| A7 | Rigor científico | Subagente independiente, en paralelo | `agentes/A7_rigor_cientifico.md` |
| A8 | Reglas, licencias, trabajo previo | Subagente independiente, en paralelo | `agentes/A8_reglas.md` |
| A10 | Cubrir los huecos (C02, C06, C12) | Subagente posterior. Los títulos no estaban en el brief inicial | `agentes/A10_huecos_SAR_trends_SPHEREx.md` |
| A9 | Red team | Subagente posterior. Recibió los finalistas sin ranking ni preferencia | `agentes/A9_red_team.md` |

**Independencia, con sus límites:**
- Todos recibieron el mismo brief (`agentes/BRIEF.md`) sin una conclusión predeterminada.
- El brief **sí** incluía hechos de partida: la lista parcial de títulos, el resultado E1 de ASTRA y la saturación de Martian Map. Eso puede haber orientado la atención de los agentes; se declara como sesgo posible.
- Los agentes A2–A8 no se leyeron entre sí.
- A9 y A10 leyeron los informes previos, como corresponde a su función.
- Los nueve agentes de la primera ronda se cortaron una vez por el límite de la API y se reanudaron desde su propio transcript. Ninguno había escrito su informe antes del corte.
- La síntesis, la matriz y los informes 01–10 los escribió el orquestador. **Las puntuaciones de la matriz son juicio del orquestador**, no de los agentes.

## 2. Limitaciones de acceso (entorno)

| Recurso | Estado | Efecto |
|---|---|---|
| `spaceappschallenge.org`, `nasa.gov`, `science.nasa.gov`, `earthdata.nasa.gov`, `ladsweb`, `firms`, `cmr`, ASF, IRSA web, arXiv, ADS, NTRS, prensa, Wikipedia, X, devpost, medium | Bloqueados (DNS `ENOTFOUND` / proxy 403) | **Ninguna regla, ningún resumen oficial y ningún paper se leyó completo.** Todo es [SNIPPET] |
| WebSearch | Disponible, con cupo de 200 búsquedas por turno compartido entre agentes; **se agotó** en la primera ronda | A1, A2a, A2b, A3 y A4 quedaron con búsquedas pendientes (alternativas institucionales, ganadores 2022–2023, fuego en ganadores) |
| `raw.githubusercontent.com`, `git clone` (proxy git) | Disponibles | Se leyó el código de más de 120 repos de competidores (lectura, sin ejecución) |
| API y búsqueda de GitHub, `codeload` | 403 | Descubrimiento solo vía WebSearch; conteos = pisos de ~10 por búsqueda |
| AWS Open Data (USGS Astrogeology, POWER, OSDR, NOAA JPSS/GOES, SPHEREx, Copernicus) | **200 / 206** | Disponibilidad verificada por prueba propia |
| Earthdata (DAAC protegidos), FIRMS, NISAR | No probados aquí | Credenciales de terceros; no verificados |

## 3. Qué se verificó por lectura directa

- El repositorio de ASTRA (ramas `main`, `research/astra-adversarial-validation` y `prototype/jezero-interactive-map` = PR #1): informes 00–13, A8 de ASTRA y fechas de commit.
- Más de 120 repos públicos de equipos 2026: README, código y `git log`. Funcionalidad **comprobada como presente en el código**, no ejecutada.
- El catálogo `SeCuReDmE-main-dev/nasa-space-apps-2026-research` (paráfrasis de los 14 resúmenes, observadas el 22/09).
- Los listados de los buckets S3 y los CSV de OSDR (A4).

## 4. Fuentes principales por tema (estado)

| Tema | Fuente | Estado |
|---|---|---|
| Lista de desafíos | spaceappschallenge.org/2026/challenges/* (14 URL) | [SNIPPET], URL indexadas |
| Lista y dificultad | github.com/SeCuReDmE-main-dev/nasa-space-apps-2026-research | [LEÍDO], secundaria |
| Reglas | spaceappschallenge.org/resources/participant-faqs, /legal/ | [SNIPPET] |
| Envío y juzgamiento | /resources/project-submission-guide, /judging-awards-guide (2025) | [SNIPPET] |
| Ganadores 2024–2025 | nasa.gov, spaceappschallenge.org/2025/meet-the-2025-global-winners, prensa | [SNIPPET] |
| Fin de MODIS y S-NPP | ladsweb.modaps.eosdis.nasa.gov/learn/modis-to-viirs-transition; nesdis.noaa.gov (cese de S-NPP el 2/11/2026); CAMS | [SNIPPET] y citado en 3 repos; **no verificado en la fuente primaria** |
| INPE "satélite de referência" | Boletines INEMA/INPE de 2026 | [SNIPPET] |
| Literatura de fuego | Schroeder et al. 2014; Giglio et al. 2016; Csiszar et al. 2012; Boschetti/Roy/Giglio 2022 | [SNIPPET] |
| Rigor | Ploton et al. 2020 (Nat. Commun.); Kirk et al. 2021 | [SNIPPET] |
| NISAR | nisar-docs.asf.alaska.edu (PROVISIONAL 20/07/2026) | [SNIPPET] + READMEs coincidentes |
| SPHEREx | s3 nasa-irsa-spherex | [LEÍDO] curl 200/206 |
| POWER | s3 nasa-power | [LEÍDO] curl 200 |
| Competidores | Ver `03` y las tablas de A2a, A2b y A10 | [CÓDIGO] / [LEÍDO] |

Tablas completas: A1 §10, A2a §8, A2b §7, A3 §10, A4 (tabla de fuentes), A5 §6, A6 §10, A7 §8, A8 §7, A10 §8 y A9.

## 5. Lo que falta para declarar la investigación completa

1. **Los enunciados completos del 28/10/2026** (datos, requisitos y proponentes). Es la limitación principal: toda la clasificación es provisional.
2. Las guías de envío y juzgamiento 2026 (13/11).
3. La lectura completa del FAQ y de los términos 2026, desde una red sin bloqueo.
4. Las respuestas escritas a las consultas Q1–Q8 (`08`).
5. La verificación en fuente primaria del fin de MODIS (Terra y Aqua) y de S-NPP, y del uso que INPE y CONAE hacen de un satélite de referencia.
6. Las alternativas institucionales no verificadas: Mars Trek/JMARS, For All Moonkind, Mission X, Astroskin, herramientas del INTA y el SMN, Giovanni.
7. La ejecución en sandbox de los 2–3 competidores más fuertes del desafío elegido, para comprobar sus métricas.
8. La lista completa de ganadores 2022–2023 y una búsqueda de ganadores en temas de fuego y SAR.
9. Una nueva medición de la saturación cerca del evento (9/11) y en otras plataformas (GitLab, repos privados que se publiquen el 15/11).

## 6. Prohibiciones cumplidas

- No se inventaron fuentes, repos ni resultados. Cada repo citado se encontró por búsqueda y se clonó, o figura como [SNIPPET].
- Los snippets no se presentan como lectura completa.
- No se escribió ni ejecutó código de solución para ningún desafío. El único script nuevo es `experimentos/matriz.py`, que calcula la matriz.
- No se tocaron `main`/`master`, el repo `astra-mars-explorer`, su PR #1 ni producción.
