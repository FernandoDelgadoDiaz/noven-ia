# 10 — Fuentes y evidencias

Todas consultadas el **2026-10-22** salvo indicación. Método: scraping vía Firecrawl (`qloo.devpost.com` no resolvía por DNS desde WebFetch), búsqueda web y búsqueda de repositorios de GitHub (API de búsqueda).

## Concurso 2026 (primarias)

| Fuente | Qué respalda |
|---|---|
| [qloo.devpost.com](https://qloo.devpost.com/) | Cierre 30/10/2026 23:45 EDT; 2.189 participantes; premios US$ 15k/6k/4k; bonus de inversión de Calacanis; requisitos (demo, repo, licencia; video no requerido); jueces; criterios |
| [qloo.devpost.com/rules](https://qloo.devpost.com/rules) | Fechas exactas, elegibilidad y exclusiones, proyectos nuevos o existentes, propiedad intelectual, licencia, testing hasta fin del juzgamiento, criterios con igual peso y etapas, desempate, pago (W‑8BEN, 10 días hábiles, 60 días), impuestos, publicidad 3 años, arbitraje y ley de NY |
| [qloo.devpost.com/updates](https://qloo.devpost.com/updates) · [update 47166](https://qloo.devpost.com/updates/47166-top-3-finalists-to-appear-live-for-final-judging) | Final en vivo del top 3 el 05/11 con Calacanis, Cedric y Alex Elias (publicado ~21/10) |
| [qloo.devpost.com/project-gallery](https://qloo.devpost.com/project-gallery) | Galería 2026 **no publicada** |
| [Developer Guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide) (modif. 07/10/2026) | Formulario de clave, emisión manual en "pocos días hábiles", base URL, endpoints soportados, tipos de entidad, errores, caché, cuotas, desactivación de claves |
| [Formulario de clave](https://forms.gle/zz12orkLHTAneLGz6) | Enlace (no abierto ni enviado) |

## API Qloo

| Fuente | Qué respalda |
|---|---|
| [API Overview](https://docs.qloo.com/reference/api-overview) | Insights, lookup (search, entities, audiences, tags), analysis compare, trending |
| [Parameter Reference](https://docs.qloo.com/reference/parameters) (modif. 08/07/2026) | Señales con weight, demografía, exclusiones, filtros geográficos, de places y de contenido, explainability, heatmap, take ≤ 50 |
| [Heatmaps](https://docs.qloo.com/reference/heatmaps-use-case) | `filter.type=urn:heatmap`, campos affinity, affinity_rank y popularity |
| [Analysis Compare](https://docs.qloo.com/reference/analysis-compare-1) | `/v2/analysis/compare` con grupos a y b; límites |

## Edición 2025

| Fuente | Qué respalda |
|---|---|
| [qloo-hackathon.devpost.com](https://qloo-hackathon.devpost.com/) | Fechas 2025, premios, 2.847 participantes, criterios 2025, video obligatorio |
| [Galería 2025](https://qloo-hackathon.devpost.com/project-gallery) | 344 proyectos; listado de la primera página |
| [Post de Qloo en X (08/09/2025)](https://x.com/Qloo/status/1965110790400151775) | Ganadores: 1.º GeoTaste; menciones Alloy, Resonance AI, Zesty; 2.893 participantes. **Conocido vía extracto del buscador; no abierto directamente** |
| [GeoTaste](https://devpost.com/software/geotaste-your-agentic-qloo-taste-business-consultant) · [repo](https://github.com/william-Dic/GeoTaste) | Arquitectura, uso de Qloo, estado del repo (actualizado 02/10/2026; 2★, 2 forks) |
| [Alloy](https://devpost.com/software/axiom-2bn391) | ReAct, Gemini, Tavily, `/search` de Qloo |
| [Resonance AI](https://devpost.com/software/resonance-ai-1hjbf0) · [demo](https://resonanceai.streamlit.app/) | ADK, heatmaps, Streamlit, hecho en 2 días |
| [Zesty](https://devpost.com/software/zesty) | Unrecommendation, sin agente |
| [QLOOTRA](https://devpost.com/software/qlootra) · [TasteJourney](https://devpost.com/software/tastejourney) · [Duddle](https://devpost.com/software/duddle) · [Voya](https://devpost.com/software/voya-travel-companion) | No ganadores comparables |

## Competidores 2026 (evidencia secundaria)

| Fuente | Qué respalda |
|---|---|
| Búsqueda de GitHub `qloo agentic hackathon` | 177 repos |
| Búsqueda de GitHub `qloo created:>2026-09-25` (4 páginas) | 387 repos; clasificación de 03 |
| Búsqueda de GitHub `qloo podcast OR qloo grocery OR qloo supermarket OR qloo booker` | 9 resultados; ninguno de invitados para podcasts ni de supermercados |
| [startupgrantsindia.com](https://www.startupgrantsindia.com/competitions/qloo-agentic-hackathon), [AINave](https://ainave.com/events/hackathons/qloo-agentic-hackathon), [hacklist.io](https://hacklist.io/hackathon/15a10c51-6785-4e91-810e-1eea545efabe) | Agregadores (secundarios; no se usaron como fuente de reglas) |

Los enlaces a repos individuales están en [03-competidores-2026.md](./03-competidores-2026.md).

## Limitaciones de la evidencia

- Sin clave de API: ninguna capacidad fue probada en vivo.
- La muestra de GitHub no representa las entregas privadas.
- No se abrieron los videos de los ganadores 2025; el análisis de UI se basa en las descripciones de Devpost.
- El post de ganadores 2025 en X se conoce por el extracto del buscador.
- El tratamiento fiscal en Argentina no fue verificado con un profesional.
