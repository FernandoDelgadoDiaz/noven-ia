# 02 — Edición 2025: ganadores y no ganadores relevantes

Fecha de consulta: **2026-10-22**. Convención: **[H]** hecho en fuente · **[I]** interpretación · **[NV]** no verificado.

## Contexto de la edición 2025 ("Qloo LLM Hackathon")

- 01/07/2025 → 01/08/2025; US$ 25.000: **Grand Prize US$ 10.000** + **3 Honorable Mentions de US$ 5.000** [H] ([qloo-hackathon.devpost.com](https://qloo-hackathon.devpost.com/)).
- Participantes: 2.847 según Devpost; 2.893 según el post de Qloo en X [H, cifras distintas]. 344 proyectos en la galería [H].
- Requería video < 3 min, demo y repo [H]. **En 2026 el video ya no es obligatorio** [H].
- Criterios 2025 (5): uso inteligente de LLMs, integración con Qloo, implementación técnica, originalidad, aplicación real [H]. **En 2026 cambian a 4**, con "Design" como criterio nuevo y sin criterio específico de LLM [H].
- Mismos jueces celebridad que en 2026 (Calacanis, Seligman, Cedric, Boehly, Abrams) [H].
- Ganadores anunciados por Qloo en X el 08/09/2025: **1.º GeoTaste**; menciones: **Alloy, Resonance AI, Zesty** [H vía extracto del resultado de búsqueda del [post de Qloo](https://x.com/Qloo/status/1965110790400151775); el post no se abrió directamente].

## Ganadores

### GeoTaste — 1.º puesto (US$ 10.000)
Fuente: [Devpost](https://devpost.com/software/geotaste-your-agentic-qloo-taste-business-consultant) · [repo](https://github.com/william-Dic/GeoTaste) · [video](https://www.youtube.com/watch?v=BYOVEVoBIzk)

1. **Problema:** el análisis de mercado de una ubicación lleva semanas [H].
2. **Propuesta:** "consultor de negocios agéntico" que analiza cualquier ubicación con 13+ tipos de insight [H].
3. **Arquitectura:** React 19 + Vite, Plotly.js, Mapbox GL, Material‑UI (glassmorphism); backend Flask; GPT‑4; deploy en Railway [H].
4. **Uso de Qloo:** "base de datos global de negocios" de Qloo; no detalla endpoints [H]. [I] Probablemente insights de `place` con filtros de ubicación.
5. **Agente:** chat de consultoría + prompts estructurados [H]. [I] Autonomía baja/moderada; más dashboard + LLM que agente.
6. **Interfaz:** mapa interactivo, 13+ gráficos, chat [H]. [I] Muy visual: probablemente pesó mucho.
7. **Debilidades declaradas:** problemas de build de Plotly, cambios de API de OpenAI, despliegue [H].
8. **Estado:** repo con 2 estrellas, 2 forks, última actualización 02/10/2026 [H]. [I] Sigue existiendo; no inferimos actividad comercial.
9. **Hipótesis de éxito [I]:** caso B2B claro ("consultor que no duerme"), mapa vistoso, demo inmediata con cualquier ciudad.

### Alloy — Mención (US$ 5.000)
Fuente: [Devpost](https://devpost.com/software/axiom-2bn391) · [video](https://www.youtube.com/watch?v=ceSU9R8ZyGw)

1. **Problema:** las fusiones y adquisiciones fallan por choque cultural, evaluado "a ojo" [H].
2. **Propuesta:** "Cultural Due Diligence Engine" con Cultural Compatibility Score, reporte de choque cultural y sinergias; exporta PDF [H].
3. **Arquitectura:** FastAPI + SQLModel + PostgreSQL; Next.js + Tailwind + shadcn; Gemini 2.5 Pro; Tavily [H].
4. **Qloo:** `/search` para encontrar *proxies* culturales (p. ej., Mickey Mouse o Marvel para Disney) [H].
5. **Agente:** ReAct explícito (razonar → actuar → observar) con herramientas web, cultura corporativa y Qloo; *fallback* a búsqueda web cuando Qloo no tiene datos [H].
6. **Autonomía:** la más alta de los ganadores [I].
7. **Solo founder** [H]. Repo y demo no enlazados en Devpost [H].
8. **Debilidades:** dependencia de búsqueda web cuando Qloo no cubre marcas de nicho [H]; [I] el score es difícil de validar.
9. **Hipótesis de éxito [I]:** problema de alto valor económico (M&A) y narrativa financiera que atrae a jueces inversores; agente "de verdad".

### Resonance AI — Mención (US$ 5.000)
Fuente: [Devpost](https://devpost.com/software/resonance-ai-1hjbf0) · [demo Streamlit](https://resonanceai.streamlit.app/) · [video](https://www.youtube.com/watch?v=ipUumI_GKU0)

1. **Problema:** campañas políticas con mensajes genéricos [H].
2. **Propuesta:** perfil cultural de segmentos geográficos → mensajes y piezas de campaña [H].
3. **Arquitectura:** Google ADK, Gemini 2.5 Flash, Imagen 4, wrapper Python de Qloo, Cloud Run [H].
4. **Qloo:** demografía → preferencias culturales; análisis de **heatmaps** [H].
5. **Agentes:** agente político + agente de contenido; pipeline análisis → mapeo cultural → contenido → paquete [H].
6. **Interfaz:** Streamlit y la UI de ADK; **sin frontend propio** [H]. Construido en 2 días [H].
7. **Hipótesis de éxito [I]:** ganó pese a la UI pobre → en 2025 la idea y el uso de Qloo pesaron más que el diseño. **En 2026 "Design" es un criterio del 25%**, así que una UI así penalizaría.

### Zesty — Mención (US$ 5.000)
Fuente: [Devpost](https://devpost.com/software/zesty) · [video](https://www.youtube.com/watch?v=j1WDxcDquS8)

1. **Problema:** burbuja de recomendaciones [H].
2. **Propuesta:** "Unrecommendation Engine": recomienda lo opuesto a tu gusto, más el "Taste Nemesis" [H].
3. **Arquitectura:** Next.js + Tailwind, Supabase, Gemini 1.5 Pro, Render [H].
4. **Qloo:** contenido en el "punto más lejano" de las preferencias [H]. [I] Uso creativo de la inversión de afinidad.
5. **Agente:** **no hay agente** declarado [H].
6. **Hipótesis de éxito [I]:** idea original y memorable, divertida; uso no obvio de Qloo. En 2026 sin agente no pasaría el filtro.

## No ganadores con problemas similares

| Proyecto | Qué hacía | Qloo | Por qué probablemente no ganó [I] |
|---|---|---|---|
| [QLOOTRA](https://devpost.com/software/qlootra) | Asistente de viaje en 5 fases (Streamlit + Gemini) | Predicción cross-domain (música → comida → moda) | Categoría viajes saturada; video privado; sin demo ni repo enlazados; UI Streamlit |
| [TasteJourney](https://devpost.com/software/tastejourney) | Destinos de viaje con ROI para creadores de contenido | Taste AI + 15 APIs | Alcance enorme, sin demo; métricas de ROI poco creíbles |
| [Duddle](https://devpost.com/software/duddle) | Decisión grupal de restaurantes | Preferencias de los participantes | Sin demo/repo/video público; MVP mínimo |
| [Voya](https://devpost.com/software/voya-travel-companion) | Astrocartografía + vuelos + Qloo | Recomendaciones de restaurantes y actividades | Qloo accesorio; premisa astrológica poco seria para inversores |

Otros temas 2025 visibles en la primera página de la galería: recomendadores culturales genéricos (Culturo, CultureAI, Taste Mirror), películas/libros (QlooMoodFlix, PersonaReads), moda (Taste Taylor), marketing (Marketly), roommates (Vybr), desastres (RescueEye) y wrappers de ChatGPT [H].

## Patrones (interpretación)

1. **3 de 4 premiados son B2B o "de alto riesgo"** (inversión inmobiliaria/expansión, M&A, campañas políticas). El jurado es de inversores y ejecutivos [I].
2. **El tema importa más que el pulido técnico**: Resonance ganó con Streamlit; Zesty sin agente [I]. En 2026 esto cambia: "Design" pesa 25% y el agente es obligatorio [H].
3. **Viajes, decisiones grupales y recomendadores genéricos no ganaron en 2025** [H en lista de premiados; I en la causa].
4. Los ganadores presentan **un número o veredicto concreto** (Compatibility Score, análisis de ubicación) y no solo listas [I].
5. **Lo que quedó sin resolver:** ningún ganador validó sus resultados contra un dato real (backtest). Todos son plausibles pero no demostrables [I]. Esa brecha es explotable.
