# A6 — Diseño de producto, experiencia de usuario y demostración (NASA Space Apps 2026)

Agente: A6. Fecha: 2026-10-21. Sigue `BRIEF.md`. No contiene código de solución.

> **Advertencia de alcance.** Los enunciados completos se publican el 28/10/2026. Todo lo que digo sobre "usuario real" y "momento wow" se apoya en el **título** del desafío y, a lo sumo, en un resumen de prensa o de un README de terceros. Es diseño especulativo hasta leer el enunciado. Lo marco como [INFERENCIA].

## 1. Misión

Para cada desafío: (1) usuario real, momento de uso y "momento wow" creíble en el formato de envío; (2) riesgos de demo; (3) diferenciabilidad de la UX frente a lo que hacen cientos de equipos; (4) calidad de demo alcanzable en 48 h por 1–6 personas (escala 1–5); (5) dónde una interfaz vistosa podría confundirse con innovación.

## 2. Búsquedas realizadas

| # | Consulta / acción | Resultado |
|---|---|---|
| 1 | WebSearch "NASA Space Apps Challenge project submission requirements 30 second video seven slides" | Snippet de la guía de envío (ver §3) |
| 2 | WebFetch `spaceappschallenge.org/resources/project-submission-guide/` | **Falló: ENOTFOUND** (bloqueado, como prevé el brief). No reintenté. |
| 3 | WebSearch criterios de juzgamiento (Impact/Influence, Creativity, Validity, Relevance, Presentation) | Snippet |
| 4 | WebSearch ganadores globales 2025 | Snippet: 3 de 10 ganadores identificados |
| 5 | WebSearch `github "Space Apps 2026" challenge project` | Sin repos; solo info general |
| 6 | WebSearch CLPS lunar mission browser github | Sin repos 2026; Lunar Browser (NASA Ames) como herramienta interna |
| 7 | WebSearch "Earth Information Jukebox" sonification | No encontrado; antecedentes de sonificación en Space Apps 2022/2023 |
| 8 | WebSearch títulos "Flame in Freefall" / "Field Shift" / "Junior Astronaut Mission Trainer" / "Space Mission Design Game" en GitHub | No encontrados en GitHub; aparece "CRADLE" (summerengine.com), concepto de entrenador de astronauta 3D |
| 9 | WebSearch Martian Map demos vercel/netlify | Sin resultados nuevos; "Fly Me To The Mars" (2025, 3D) |
| 10 | WebSearch "Harmonization of MODIS and VIIRS" Space Apps | No encontrado el desafío; sí literatura de armonización y un equipo 2017 con MODIS+VIIRS |
| 11 | WebSearch ganadores por categoría 2024/2025 | Snippet: SpaceGenes+ (dashboard, Best Use of Science 2025) |
| 12 | WebSearch política de IA generativa en Space Apps | No encontrada la política oficial |
| 13 | WebSearch lista de 14 desafíos 2026 | Confirma temas (salud de astronautas, juego de base lunar/marciana para chicos, equipo abandonado); no la lista completa |
| 14 | WebSearch exoplanetas con IA 2025 ("A World Away") | Muestra cómo un desafío de IA atrae envíos casi idénticos |
| 15 | `curl` raw README de `AhsanulHoque22/Nasa-Space-Apps-Challenge-2026-Team-Protikriti` | **Leído completo** |
| 16 | `curl` a therecursive.com (.md) | Falló: proxy 403 |
| 17 | Lectura de notas previas ASTRA (A1_competitiva.md, 01_MAPA_COMPETITIVO.md en scratchpad) | Lista de ≥10 repos de Martian Map ya relevados |

## 3. Formato de envío y criterios (base para todo el análisis)

- **Demo = video ≤30 s O presentación ≤7 diapositivas (incluida la portada); si excede, queda inelegible para el juzgamiento global.** Hospedado fuera del sitio, enlace público. Video con subtítulos en inglés; diapositivas en inglés; identificar equipo, integrantes y desafío. [SNIPPET — guía de envío vigente, que referencia materiales 2025; las guías 2026 salen el 13/11]. Guías 2020 y de la CSA decían lo mismo (la CSA permitía solo 5 diapositivas). [SNIPPET]
- Además del demo, el formulario pide enlace al proyecto (repo/sitio) y descripción. [SNIPPET + INFERENCIA por envíos previos; no leí el formulario 2026].
- Criterios: **Influence/Impact, Creativity, Validity, Relevance, Presentation**. Creativity pregunta si es novedoso o una mejora incremental; Validity si es científicamente válido y funciona; Relevance si responde al desafío, si está completo y si es usable. [SNIPPET — Judging & Awards Guide]
- Política de IA generativa 2026: **no encontrada**. El brief dice "IA permitida con declaración (guía 2025)". [NO VERIFICADO]

**Consecuencia de diseño [INFERENCIA]:** el juez global ve primero 30 segundos o 7 diapositivas, no la app. En 30 s caben ~3 planos: problema (5 s), acción del usuario con resultado visible (15–20 s), dato/evidencia o cierre (5–10 s). Todo lo que necesite explicación de un modelo o de una interacción larga no entra. El demo en vivo casi nunca lo ve el juez global; sí lo ven los jueces locales. Por eso el "wow" debe ser **un antes/después o una decisión que cambia**, legible sin sonido (subtítulos obligatorios) y en una pantalla de celular.

## 4. Hallazgos transversales

1. **La vara visual ya está saturada en al menos un desafío.** El README de Team Protikriti (Martian Map) [LEÍDO] declara: globo 3D de todo Marte en CesiumJS, "Street View" con 2.087 paradas de rover cosidas desde Navcam, planificador de Marswalk con veredicto GO/NO-GO, anillos de alcance, línea de visión, modo "caminar en primera persona" con física marciana y tormentas de polvo, clima en vivo, 17 mosaicos HiRISE, 182 tests y demo en atlas-mars.vercel.app. Son funcionalidades **declaradas**, no comprobadas (no abrí la demo; Vercel bloqueado en el relevamiento previo). Las notas ASTRA registran commits del 17 al 20/10/2026, **antes** del hackatón [LEÍDO en notas previas; NO VERIFICADO por mí]. Implicación: en desafíos de mapa/3D, un equipo de 48 h no gana por cantidad de capas ni por espectacularidad; ya hay rivales con semanas de trabajo asistido por IA. (Si el trabajo previo viola la regla "no empezar antes", es problema de ellos, no una ventaja para nadie.)
2. **Las "limitaciones" de ese mismo README son la verdadera frontera de innovación.** Protikriti admite que la velocidad de marcha es un supuesto de equipo sin cita NASA, que no modela gravedad marciana en el costo, que el DEM de 20–32 m no ve rocas y que el tiempo por parada es un supuesto. [LEÍDO]. Es decir, la parte vistosa está resuelta y la parte con **validez** (criterio Validity) no. Esto coincide con el experimento E1 de ASTRA (rutear sobre CTX no reduce la exposición a pendientes >15°). [INFERENCIA]
3. **Un dashboard puede ganar si responde una pregunta científica concreta.** SpaceGenes+ (Alemania) ganó Best Use of Science 2025 con un "dashboard interactivo" sobre el efecto combinado de radiación y microgravedad en la salud de astronautas a nivel molecular. [SNIPPET]. La forma (dashboard) no fue el diferencial; la pregunta sí. [INFERENCIA]
4. **Los desafíos "con IA" en el título atraen envíos casi idénticos.** En 2025, "A World Away: Hunting for Exoplanets with AI" produjo múltiples envíos con la misma receta (ensamble de árboles sobre Kepler/K2/TESS + Flask/Streamlit + SHAP), reportando exactitudes sin comparabilidad. [SNIPPET: equipo HexaBits 78% en TESS; proyecto en Peerlist con LightGBM/RF/XGBoost+SHAP, nominado global]. "Flame in Freefall: AI-Powered…" corre el mismo riesgo. [INFERENCIA]
5. **Patrones de UX que hacen cientos de equipos** [INFERENCIA basada en los ≥10 repos de Martian Map relevados, ejemplos 2022–2025 y conocimiento general de hackatones]: (a) globo/mapa 3D (CesiumJS, Three.js, Mapbox/Leaflet), (b) chatbot "pregúntale a la NASA" sobre un LLM, (c) dashboard de KPIs con gráficos Chart.js/Plotly, (d) "juego educativo" de cuestionario con astronauta mascota, (e) sonificación "convierte imagen en música". Ninguno diferencia por sí mismo.
6. **Riesgo específico de 2026: proyectos generados con IA muy pulidos.** Tanto Protikriti como "Sol Atlas" (rama `claude/…`, según notas ASTRA) muestran que con asistentes de código el pulido visual dejó de ser escaso. Lo escaso es: una decisión real del usuario, una validación contra dato de referencia y una afirmación honesta de alcance. [INFERENCIA]

## 5. Análisis por desafío

Escala de calidad de demo alcanzable en 48 h (1–6 personas): **1** = solo concepto/maqueta; **2** = prototipo frágil con datos de juguete; **3** = prototipo funcional con datos reales precalculados y un flujo completo; **4** = flujo pulido, datos reales, una validación mostrada, sin dependencias en vivo; **5** = calidad casi de producto con evidencia cuantitativa. La nota mide lo **alcanzable**, no lo deseable.

### 5.1 Interplanetary Survival Guide: Martian Map
- **Resumen del desafío** [LEÍDO, citado en README de Protikriti]: "build a layered, integrated view of a location or route on the Martian surface that pulls together data from multiple NASA science missions, to help a human explorer plan a successful Marswalk while doing new science along the way."
- **Usuario real y momento** [INFERENCIA]: planificador de EVA / científico de traversa, la noche previa a una salida, eligiendo entre 2–3 recorridos. No es el astronauta caminando.
- **Wow creíble en 30 s**: "esta ruta parece segura en el mapa de 20 m; con el DTM de 1 m vemos que cruza N tramos >15°; esta alternativa cuesta +X min y elimina el riesgo". Un contraste cuantitativo, no una vista 3D.
- **Riesgos de demo**: teselas 3D y DTM pesados; Cesium en celulares de gama media; dependencia de servidores de teselas en vivo; modelos de costo (Tobler, factor de traje) presentados como si fueran datos NASA.
- **Diferenciabilidad UX: muy baja.** ≥10 repos 2026 ya públicos con mapa + ruta + pendiente + 3D (ver notas ASTRA y README Protikriti). El mapa 3D es el patrón por defecto.
- **Calidad alcanzable: 3–4.** Técnicamente fácil llegar a 3 con CesiumJS; 4 exige validación honesta, que es justo lo que E1 de ASTRA mostró difícil.
- **Vistosidad ≠ innovación**: "Street View de Marte", modo en primera persona, polvo animado. Impresiona en el video y no cambia ninguna decisión de EVA.

### 5.2 Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars
- Existencia confirmada solo por prensa: "documentar el equipamiento de NASA dejado en la Luna y Marte". [SNIPPET]
- **Usuario** [INFERENCIA]: público general, docentes, museos; consumo pasivo, 2–5 minutos.
- **Wow en 30 s**: es el desafío **más compatible con el formato**: un relato con un objeto concreto (p. ej., una pieza de un aterrizador) y su "por qué importa hoy". Un video de 30 s *es* el producto.
- **Riesgos**: derechos de imágenes (las de NASA suelen ser dominio público, pero las de terceros/compañías CLPS no necesariamente) [NO VERIFICADO]; ilustraciones o imágenes generadas por IA que parezcan fotos reales; errores históricos.
- **Diferenciabilidad UX: media.** El patrón típico será "mapa de la Luna con pines + tarjetas". Diferencia real: narrativa con una tesis (patrimonio, basura espacial, reutilización), no el visor.
- **Calidad alcanzable: 4.** Contenido + web estática; bajo riesgo técnico.
- **Vistosidad ≠ innovación**: scrollytelling animado y 3D de objetos; la innovación sería un dato nuevo (p. ej., inventario cruzado de fuentes) o una pregunta que el público no se hacía.

### 5.3 Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars
- Título del brief; no lo encontré en mis búsquedas. [NO VERIFICADO]
- **Usuario** [INFERENCIA]: planificadores de campañas análogas (geólogos, agencias), y secundariamente educación.
- **Wow en 30 s**: "elegí un sitio lunar → el sistema devuelve los 5 lugares de la Tierra más parecidos según variables explícitas (pendiente, albedo, temperatura, iluminación) con un puntaje explicado". Un ranking explicable, comparando dos mapas lado a lado.
- **Riesgos**: índice de similitud arbitrario (mismo problema que el costo de ASTRA); rásters globales pesados (precalcular); presentar "análogo" como validado cuando es una métrica de equipo.
- **Diferenciabilidad UX: media-alta** si el puntaje es transparente y se valida contra análogos conocidos (p. ej., sitios usados históricamente) [INFERENCIA]. Baja si es "dos globos 3D".
- **Calidad alcanzable: 3.**
- **Vistosidad ≠ innovación**: globos gemelos sincronizados; el aporte real es la métrica y su validación.

### 5.4 CLPS Lunar Mission Browser
- URL listada en el brief; no leí el enunciado. Antecedente: "Lunar Browser" de NASA Ames es una herramienta GUI interna de trayectorias [SNIPPET, NTRS]. No encontré repos 2026.
- **Usuario** [INFERENCIA]: entusiasta, periodista, docente o investigador que quiere saber qué carga útil viaja en qué misión, a dónde y con qué resultado.
- **Wow en 30 s**: búsqueda facetada "¿qué instrumentos midieron X en el polo sur?" → línea de tiempo + mapa filtrados al instante. Bueno para 7 diapositivas, mediocre para video.
- **Riesgos**: datos de misiones dispersos y cambiantes (lanzamientos, fallos); scraping en vivo; dato desactualizado en el demo.
- **Diferenciabilidad UX: baja-media.** Es un catálogo; muchos equipos harán línea de tiempo + mapa. Diferencia posible: vínculo payload→dato científico publicado.
- **Calidad alcanzable: 4** (problema de datos curados, no de algoritmo).
- **Vistosidad ≠ innovación**: animación de trayectorias 3D Tierra–Luna (Ames ya tiene herramienta de trayectorias; reproducirla vistosamente no es aporte).

### 5.5 Create Health Monitoring Software for Astronauts on Space Missions
- Tema confirmado por prensa ("app para monitorear la salud de astronautas"). [SNIPPET]
- **Usuario** [INFERENCIA]: cirujano de vuelo en tierra o el propio tripulante; momento: revisión diaria o alerta ante desvío.
- **Wow en 30 s**: "la tendencia individual se desvía de la línea base del tripulante 3 días antes de que un umbral fijo dispare" — una alerta temprana explicada.
- **Riesgos (altos)**: **datos simulados que parecen reales** (no hay datos fisiológicos públicos de astronautas en tiempo real [INFERENCIA]); IA que "diagnostica"; implicaciones médicas sin validación. Wearables en vivo fallan en el escenario.
- **Diferenciabilidad UX: muy baja.** El patrón será dashboard de signos vitales + chatbot médico. Antecedente positivo: SpaceGenes+ ganó con un dashboard porque respondía una pregunta científica sobre datos ómicos reales (GeneLab) [SNIPPET + INFERENCIA].
- **Calidad alcanzable: 2–3** si es honesta (datos sintéticos rotulados como tales); 4 solo si se usa un dataset NASA real y una pregunta acotada.
- **Vistosidad ≠ innovación**: gráficos en tiempo real con latidos animados y un avatar 3D del cuerpo.

### 5.6 Build a Junior Astronaut Mission Trainer
- Tema confirmado por prensa ("juego donde los chicos gestionan una base lunar o marciana" — podría ser este o el 5.7). [SNIPPET]. Aparece "CRADLE" en summerengine.com, concepto de entrenador 3D para 10–16 años con un puzzle de energía en un puesto lunar; parece arte conceptual generado, no un proyecto publicado. [SNIPPET, NO VERIFICADO]
- **Usuario** [INFERENCIA]: niño/a de 8–14 años con docente o familia; sesión de 5–15 min.
- **Wow en 30 s**: un niño tomando una decisión con consecuencia física real (p. ej., racionar oxígeno → ver el efecto) y aprendiendo el concepto. Grabación de un usuario real > animación.
- **Riesgos**: 3D (Unity/Three.js) que cae en Chromebooks escolares y celulares; gamificación sin contenido científico; voz/ilustración generada por IA.
- **Diferenciabilidad UX: baja** (quiz + mascota astronauta es el patrón dominante). Diferencia: una mecánica basada en un dato NASA real y una prueba con usuarios reales durante el fin de semana.
- **Calidad alcanzable: 3–4** (juegos 2D web son alcanzables; 3D baja la nota por riesgo).
- **Vistosidad ≠ innovación**: arte 3D y cinemáticas.

### 5.7 Space Mission Design Game
- URL confirmada en el brief; prensa rumana describe "un juego para planificar misiones". [SNIPPET]
- **Usuario** [INFERENCIA]: estudiante secundario/universitario o aficionado; aprende compromisos (masa, delta-v, energía, presupuesto).
- **Wow en 30 s**: "agregaste un instrumento de 20 kg → ya no llegás a Marte con este lanzador; elegí: quitar instrumento o cambiar trayectoria". Un compromiso visible.
- **Riesgos**: física simplificada presentada como precisa; balance de juego imposible de probar en 48 h; motor 3D pesado.
- **Diferenciabilidad UX: media.** Juegos de construcción de cohetes abundan (Kerbal como referente cultural [INFERENCIA]); diferencia: usar parámetros de misiones reales y mostrar la fuente.
- **Calidad alcanzable: 3.**
- **Vistosidad ≠ innovación**: lanzamientos animados en 3D.

### 5.8 Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data
- Título del brief; no lo encontré. [NO VERIFICADO]
- **Usuario** [INFERENCIA]: ingeniero de seguridad contra incendios de vehículos espaciales o investigador en combustión; momento: elegir materiales o condiciones de ventilación.
- **Wow en 30 s**: "con estos parámetros (O₂, flujo, material), el modelo predice extinción/propagación y aquí está el experimento real más cercano que lo respalda". Predicción + evidencia.
- **Riesgos (altos)**: datasets de combustión en microgravedad probablemente pequeños [INFERENCIA]; sobreajuste; **LLM que alucina "insights"**; métricas de exactitud sin validación cruzada.
- **Diferenciabilidad UX: baja.** Patrón 2025 de exoplanetas: modelo + Streamlit + SHAP + chatbot. [SNIPPET + INFERENCIA]
- **Calidad alcanzable: 2–3** como interfaz; la validez es lo difícil.
- **Vistosidad ≠ innovación**: chatbot "pregúntale a la llama", visualizaciones de llamas esféricas animadas.

### 5.9 Harmonization of MODIS and VIIRS Hot Spots
- Desafío no encontrado con ese título; existe literatura de armonización (MODIS/VIIRS, burned area; VIIRS detecta ~60% más alertas volcánicas con MIROVA) y un envío Space Apps 2017 con ambos sensores. [SNIPPET]. Autoría CONAE sin verificar.
- **Usuario** [INFERENCIA]: analista de incendios / servicio meteorológico / brigada; momento: serie histórica comparable para tendencias o alerta.
- **Wow en 30 s**: "la serie cruda muestra un salto artificial de focos en 2012 al entrar VIIRS; la serie armonizada lo elimina y la tendencia real cambia de signo/magnitud" — un gráfico antes/después. Muy fuerte para jueces científicos, poco "espectacular".
- **Riesgos**: volumen de datos FIRMS (precalcular por región); confundir corrección estadística con verdad de campo; mapa de calor llamativo que oculta el método.
- **Diferenciabilidad UX: alta** porque el patrón típico será "otro mapa de incendios"; quien muestre la corrección cuantitativa se distingue.
- **Calidad alcanzable: 3–4** si se acota región y período.
- **Vistosidad ≠ innovación**: globo con focos parpadeando en tiempo real (FIRMS ya lo ofrece).

### 5.10 Field Shift: Adapting Farms with NASA Data
- Título del brief; no lo encontré. [NO VERIFICADO]
- **Usuario** [INFERENCIA]: productor o asesor agronómico; momento: decisión de siembra/cultivo/riego de la próxima campaña.
- **Wow en 30 s**: "en este lote, las condiciones de los últimos 20 años se desplazaron; el cultivo X pasa de apto a marginal; alternativa Y". Una recomendación con incertidumbre.
- **Riesgos**: escala (píxel de 250 m–9 km vs. lote); proyecciones climáticas presentadas como certezas; LLM que da consejos agronómicos.
- **Diferenciabilidad UX: baja-media.** Patrón dominante: mapa + NDVI + chatbot "asistente agrícola". Diferencia: hablarle a un productor real durante el fin de semana y mostrar su decisión.
- **Calidad alcanzable: 3.**
- **Vistosidad ≠ innovación**: capas NDVI coloridas; dashboards de clima.

### 5.11 The Earth Information Jukebox
- No encontrado. Antecedentes de sonificación en Space Apps 2022 (Team Artemis: brillo→volumen) y 2023 (Varsovia), JAXA EarthCARE 2024, revisión Russo et al. 2023. [SNIPPET]
- **Usuario** [INFERENCIA]: público general y **personas con baja visión** (accesibilidad); museos.
- **Wow en 30 s**: escuchar una serie climática (p. ej., hielo marino) y "oír" la tendencia sin mirar el gráfico. Riesgo: el video exige subtítulos y los jueces pueden verlo sin sonido.
- **Riesgos**: mapeo arbitrario dato→sonido que no transmite información; audio en navegadores móviles (autoplay bloqueado).
- **Diferenciabilidad UX: media.** Ya hubo varias sonificaciones; diferencia: prueba de comprensión (¿la gente identifica la tendencia de oído?).
- **Calidad alcanzable: 4** (técnicamente liviano: Web Audio + series precalculadas).
- **Vistosidad ≠ innovación**: visualizadores musicales animados.

### 5.12–5.14 Desafíos no identificados
No encontrados en mis búsquedas (ver §2, #13). La prensa menciona un desafío avanzado de análisis de tendencias de observación terrestre [SNIPPET vía brief]. No los evalúo.

## 6. Tabla resumen

| Desafío | Wow compatible con 30 s / 7 slides | Riesgo de demo | Diferenciabilidad UX típica | Demo alcanzable 48 h (1–5) |
|---|---|---|---|---|
| Martian Map | Medio (contraste de rutas) | Alto (3D, teselas) | Muy baja (saturado) | 3–4 |
| Abandoned but not Forgotten | **Alto** (el relato es el producto) | Bajo | Media | 4 |
| Análogos Tierra–Luna/Marte | Medio-alto (ranking explicado) | Medio | Media-alta | 3 |
| CLPS Mission Browser | Medio (mejor en slides) | Medio (datos desactualizados) | Baja-media | 4 |
| Salud de astronautas | Medio | **Alto** (datos simulados, médico) | Muy baja | 2–3 |
| Junior Astronaut Trainer | Alto si hay usuario real grabado | Medio-alto (3D en escuelas) | Baja | 3–4 |
| Mission Design Game | Medio-alto (compromiso visible) | Medio | Media | 3 |
| Flame in Freefall | Medio | **Alto** (IA, datos pequeños) | Baja | 2–3 |
| MODIS/VIIRS | Alto para jueces científicos (antes/después) | Medio (volumen) | **Alta** | 3–4 |
| Field Shift | Medio | Medio-alto (escala, consejos IA) | Baja-media | 3 |
| Earth Info Jukebox | Medio (subtítulos/sin sonido) | Bajo-medio (audio móvil) | Media | 4 |

## 7. Recomendaciones de diseño de demo, independientes del desafío [INFERENCIA]

1. **Cero dependencias en vivo en el demo grabado**: datos precalculados y versionados; si hay API, cachear el resultado y declararlo.
2. **Rotular siempre lo simulado** en pantalla ("datos sintéticos", "supuesto del equipo"). Un juez que descubre que un dato "en vivo" era inventado penaliza Validity.
3. **Funcionar en celular sin WebGL obligatorio**: vista 2D por defecto, 3D opcional.
4. **IA generativa solo detrás de evidencia**: cada frase generada debe citar el registro/dato que la respalda; si no hay cita, no se muestra.
5. **El momento wow es una decisión que cambia**, con un número: "antes X, ahora Y, por esta razón".
6. **Validación visible en 1 diapositiva** (aunque sea pequeña): es lo que separa a los ~10 ganadores de miles de interfaces parecidas.

## 8. Objeciones propias

- Mi lectura del "patrón típico" se basa en un desafío bien relevado (Martian Map) y en extrapolación de años anteriores; para los demás desafíos **no encontré repos 2026** y la diferenciabilidad es inferida.
- Los envíos públicos visibles hoy (octubre) son anteriores al hackatón; los de noviembre pueden ser distintos. Además, la abundancia de repos pre-hackatón en Martian Map puede deberse a que el título es atractivo, no a que ese desafío sea más competido en el juzgamiento.
- No pude abrir ninguna demo en vivo; todas las capacidades de terceros son declaradas.
- Las guías de envío/juzgamiento 2026 (13/11) podrían cambiar el formato (p. ej., duración del video). Lo usé como si fuera igual a 2025.
- La escala 1–5 es juicio propio; no hay datos que vinculen calidad de demo con premios.

## 9. Conclusiones

1. El formato (≤30 s o ≤7 diapositivas, en inglés, con subtítulos) premia **un contraste cuantitativo legible sin sonido**, no la amplitud de funcionalidades. [SNIPPET + INFERENCIA]
2. En **Martian Map** la UX está saturada: un equipo 2026 ya declara globo 3D, Street View, GO/NO-GO, modo a pie y 182 tests. Competir ahí por interfaz es perder; solo una validación honesta diferenciaría. [LEÍDO + INFERENCIA]
3. Mejor relación "wow creíble / riesgo de demo / diferenciación" (desde UX, no desde ciencia): **MODIS/VIIRS** (antes/después de la serie), **Abandoned but not Forgotten** (el relato es el producto) y **Análogos Tierra–Luna/Marte** (ranking explicable). [INFERENCIA]
4. Peor relación: **Salud de astronautas** y **Flame in Freefall** (datos simulados o pequeños + IA que puede alucinar + patrón chatbot/dashboard). [INFERENCIA]
5. Los lugares donde lo vistoso más se confunde con innovación: 3D/Street View/modo a pie (Martian Map), chatbots de "insights" (Flame, Field Shift, Salud), latidos y avatares (Salud), globos con focos (MODIS/VIIRS), visualizadores musicales (Jukebox).

## 10. Tabla de fuentes

| URL | Qué afirma | Estado |
|---|---|---|
| https://www.spaceappschallenge.org/resources/project-submission-guide/ | Video ≤30 s o ≤7 slides; si excede, inelegible; inglés/subtítulos; hosting externo | [SNIPPET]; WebFetch ENOTFOUND |
| https://2020.spaceappschallenge.org/assets/documents/460/Space_Apps_2020_Project_Submission_Guide.pdf | Mismos límites en 2020 | [SNIPPET] |
| https://www.asc-csa.gc.ca/eng/events/2020/space-apps-2020-eligibility-for-awards.asp | Variante CSA con 5 slides | [SNIPPET] |
| https://spaceappschallenge.org/resources/judging-awards-guide | Criterios Influence, Creativity, Validity, Relevance, Presentation | [SNIPPET] |
| https://www.spaceappschallenge.org/2025/meet-the-2025-global-winners/ | Ganadores 2025 (SpaceGenes+, Resonant Exoplanets, Photonics Odyssey) | [SNIPPET] |
| https://www.newsonair.gov.in/indian-satellite-internet-concept-wins-top-honour-at-nasa-space-apps-challenge-2025 | Photonics Odyssey, Most Inspirational 2025 | [SNIPPET] |
| https://zilesinopti.ro/?p=892787 | 14 desafíos 2026; temas salud, base lunar/marciana, equipamiento abandonado | [SNIPPET] |
| https://astrobiology.com/2026/09/04/registration-is-now-open-for-the-2026-nasa-space-apps-challenge/ | Enunciados completos el 28/10 | [SNIPPET] |
| https://raw.githubusercontent.com/AhsanulHoque22/Nasa-Space-Apps-Challenge-2026-Team-Protikriti/main/README.md | Resumen del desafío Martian Map; funcionalidades y limitaciones declaradas | [LEÍDO] (funcionalidad declarada, no comprobada) |
| https://ntrs.nasa.gov/citations/20240005553 | Lunar Browser (Ames), herramienta GUI de trayectorias CLPS/Artemis | [SNIPPET] |
| https://2022.spaceappschallenge.org/challenges/2022-challenges/steam/teams/team-artemis-2 | Sonificación imagen→sonido, 2022 | [SNIPPET] |
| https://eng.pw.edu.pl/News/An-app-that-allows-you-to-hear-images-from-space | Sonificación 3D, Space Apps 2023 | [SNIPPET] |
| https://www.satnavi.jaxa.jp/en/news/2024/08/26/9702/ | JAXA sonifica EarthCARE | [SNIPPET] |
| https://modis.gsfc.nasa.gov/sci_team/meetings/202204/presentations/session1/boschetti.pdf | Armonización de registros de fuego MODIS/VIIRS | [SNIPPET] |
| https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8914890/ | VIIRS+MIROVA ~60% más alertas que MODIS | [SNIPPET] |
| https://2017.spaceappschallenge.org/challenges/warning-danger-ahead/and-you-can-help-fight-fires/teams/firefindereu | Envío 2017 con MODIS y VIIRS | [SNIPPET] |
| https://www.fbu.edu.tr/en/news/fenerbahce-university-students-achieve-outstanding-success-at-nasa-space-apps-724 | HexaBits, exoplanetas 2025, 78% en TESS | [SNIPPET] |
| https://peerlist.io/makazanalpamys/project/nasa-exoplanet-detection-ai | Ensamble + SHAP, nominado global 2025 | [SNIPPET] |
| https://www.summerengine.com/asset-store/ (varias, "CRADLE") | Concepto de entrenador de astronauta 3D 10–16 años | [SNIPPET], [NO VERIFICADO] como proyecto real |
| Notas previas ASTRA (A1_competitiva.md, 01_MAPA_COMPETITIVO.md) | ≥10 repos Martian Map 2026, fechas de commits, Sol Atlas | [LEÍDO] (notas internas, fuentes secundarias) |

## 11. Pendientes

- Leer los enunciados completos (28/10) y rehacer usuario/wow por desafío con el texto oficial.
- Leer la guía de envío y la de juzgamiento 2026 (13/11): confirmar video ≤30 s / ≤7 slides y la política de IA generativa.
- Abrir en vivo atlas-mars.vercel.app y sol-atlas.netlify.app (bloqueados desde aquí) para comprobar si las funciones declaradas existen y cómo se comportan en celular.
- Buscar repos 2026 de los demás desafíos después del 28/10 (hoy no encontrados).
- Identificar los 3 títulos faltantes de los 14.
- Obtener la lista completa de ganadores globales 2024–2025 para ver qué formas de demo ganan por categoría.
