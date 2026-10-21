# A7 — Rigor científico y riesgos de afirmaciones engañosas (NASA Space Apps 2026)

Fecha: 2026-10-21. Agente: A7. Estado: completo con limitaciones de acceso (ver "Pendientes").

## 1. Misión

Para cada desafío del brief: (1) identificar afirmaciones típicas que serían científicamente engañosas; (2) estimar el rigor alcanzable honestamente en 48 h con datos públicos y la validación mínima que haría creíble una afirmación; (3) ubicar literatura de estado del arte; (4) señalar dónde un resultado negativo honesto o una cuantificación de incertidumbre es un diferencial y dónde no le importa al jurado; (5) puntuar "rigor científico alcanzable" 1–5.

Advertencia de base: **ningún enunciado completo fue leído**. Los enunciados completos se publican el 28/10/2026; spaceappschallenge.org está bloqueado desde este entorno (curl → `CONNECT tunnel failed, 403`, 2026-10-21). Todo lo que sigue sobre "qué pide cada desafío" es **[INFERENCIA]** a partir de los títulos del brief y de un único snippet de prensa.

## 2. Búsquedas realizadas

| # | Consulta (WebSearch salvo indicación) | Resultado útil |
|---|---|---|
| 1 | Schroeder 2014 VIIRS 375 m active fire algorithm MODIS comparison | Sí (abstract/snippet) |
| 2 | MODIS VIIRS active fire continuity consistency Giglio | Sí (slides y abstracts, snippet) |
| 3 | microgravity flame spread dataset Saffire BASS ACME FLEX ISS open data | Parcial: Saffire/BASS sí; ACME/FLEX no aparecieron |
| 4 | terrestrial analog sites Mars criteria Atacama Haughton Rio Tinto analog fidelity | Parcial: no hay esquema formal de "fidelidad" |
| 5 | lunar south pole analog site Earth selection criteria illumination PSR | Solo criterios de sitios lunares reales; nada de análogos terrestres |
| 6 | NASA HRP astronaut health metrics HRV wearable validation | Parcial |
| 7 | NASA "Flame in Freefall" Space Apps 2026 | No encontrado |
| 8 | crop yield satellite spatial cross-validation Ploton/Meyer | Sí |
| 9 | ML microgravity flame spread prediction ISS neural network | Parcial (Xi et al. 2022, asimilación física) |
| 10 | Inspiration4 SOMA OSDR open data | Sí |
| 11 | Ploton 2020 Nature Communications spatial validation | Sí |
| 12 | sonification scientific data evaluation perceptual validity | Sí |
| 13 | Terra Aqua MODIS orbit drift end of mission VIIRS continuity | Sí |
| 14 | CTX DTM vertical precision HiRISE slope accuracy | Sí |
| 15 | Olson 2023 Combustion and Flame Saffire BASS | Sí |
| 16 | Mauna Kea PISCES / Black Point / Desert RATS analog validation | Parcial |
| 17 | Space Apps 2026 "Earth Information Jukebox" / "Field Shift" / "Harmonization of MODIS and VIIRS" | Confirma 2 títulos por una sola fuente de prensa; el de MODIS/VIIRS **no encontrado** |
| curl | spaceappschallenge.org/2026/challenges/, flame.sdsu.edu | Bloqueados (403 del proxy) |

## 3. Hallazgos transversales

- **T1. La trampa de validación más frecuente en desafíos de observación terrestre es la autocorrelación espacial.** Ploton et al. 2020 (Nature Communications, DOI 10.1038/s41467-020-18321-y) reconstruyen un flujo típico de random forest sobre 11,8 M árboles en África central: con validación aleatoria el modelo "explica" mucha varianza; con validación espacial el poder predictivo es "casi nulo" [SNIPPET]. Hay debate metodológico (Wadoux et al. 2021 cuestionan la CV espacial para estimar exactitud de mapas) [SNIPPET]. Estudios agrícolas 2024–2025 con Sentinel-2/UAV encuentran que la CV estándar sobreestima sistemáticamente [SNIPPET]. Consecuencia: cualquier equipo que reporte "R² = 0,9" con k-fold aleatorio sobre píxeles vecinos está, con alta probabilidad, reportando un número inflado [INFERENCIA].
- **T2. Baseline trivial ausente.** El patrón ASTRA-E1 (la ruta "inteligente" no supera a la recta) es generalizable: en 48 h casi nadie compara contra el baseline trivial (persistencia, climatología, ruta más corta, umbral fijo, vecino más cercano). Reportar el baseline es el control más barato y más diferenciador [INFERENCIA].
- **T3. Resolución del dato vs. escala de la afirmación.** Ejemplo verificado: en DTM CTX de 20 m/post la mayoría de los cráteres de 300 m eran visibles pero muchos de 150 m no; colinas de 50–70 m quedaban ensanchadas; y eso es "probablemente el mejor caso" (documentación USGS CTX DTM) [SNIPPET]. Kirk et al. 2021 (Remote Sensing 13:3511): error de correlación 0,2–0,5 px, resolución horizontal efectiva 10–20 px de imagen, precisión y resolución inversamente correlacionadas [SNIPPET]. Cualquier afirmación de "seguridad" a escala de rover (obstáculos de decímetros a metros) sobre CTX es engañosa por construcción [INFERENCIA, consistente con ASTRA E1].
- **T4. IA generativa como "analista".** Un LLM que "explica" datos sin anclaje produce afirmaciones no verificables; el jurado no lo penaliza por defecto, pero un juez científico sí lo detecta si se le pide la cifra de origen [INFERENCIA].
- **T5. Cuándo un negativo honesto vende.** Solo cuando (a) la pregunta es la que el desafío pide, (b) el negativo reorienta una decisión ("no usen X para Y; usen Z"), y (c) se presenta con una alternativa operativa. Un negativo sin producto no compite en categorías de impacto/storytelling [INFERENCIA]. Las categorías 2025 "Best Use of Science" y "Best Use of Data" (brief) son las únicas donde el rigor es el criterio central [NO VERIFICADO para 2026; guías de juzgamiento salen 13/11].

## 4. Análisis por desafío

Formato: **Afirmaciones engañosas típicas** / **Rigor alcanzable en 48 h y validación mínima** / **Literatura** / **¿Negativo/incertidumbre como diferencial?** / **Puntaje 1–5**.

### 4.1 Interplanetary Survival Guide: Martian Map

- **Engañosas típicas:** "ruta segura" o "ruta óptima para astronautas/rover" sobre MOLA (463 m) o CTX (20 m); "zona habitable" por un índice ad hoc de pendiente+hielo+radiación sin pesos justificados; "recursos de O₂/agua" sobre mapas de hielo regionales presentados como locales; mapas 3D vistosos presentados como precisos.
- **Rigor alcanzable:** medio-bajo. Con HiRISE DTM (≈1 m/post, cobertura muy parcial) se puede validar lo que se calculó sobre CTX en la intersección; esa es la validación cruzada mínima (producto independiente de mayor resolución). Métrica: exposición a pendiente >15° medida en HiRISE para rutas planificadas en CTX vs. ruta recta/más corta. ASTRA ya ejecutó exactamente esto y obtuvo resultado nulo (brief, E1).
- **Literatura:** Kirk et al. 2021 Remote Sensing 13(17):3511 (calidad de DTM HRSC/CTX/HiRISE en sitios de aterrizaje) [SNIPPET]; documentación USGS de CTX DTM con ASP [SNIPPET].
- **Negativo como diferencial:** sí, moderadamente — "el DTM orbital de 20 m no sirve para rutear a escala humana; aquí está la cuantificación" es inusual entre ≥10 repos que afirman lo contrario. Pero el desafío parece orientado a "guía de supervivencia"/mapa (título), y un jurado general premiará utilidad/narrativa; el negativo necesita venir con un producto (p. ej. mapa de incertidumbre o "dónde se necesita HiRISE") [INFERENCIA].
- **Puntaje: 3/5.** Hay datos públicos de alta calidad y una validación cruzada factible; el techo lo pone la falta de verdad de terreno a escala de rover.

### 4.2 Abandoned but not Forgotten (storytelling sobre equipos descartados en Luna/Marte)

- **Engañosas típicas:** coordenadas o inventarios de objetos presentados como exhaustivos; masas/estados de conservación inventados por un LLM; "impacto ambiental" o "riesgo de contaminación" sin base.
- **Rigor alcanzable:** alto en la dimensión que importa (exactitud documental): cada objeto con fuente primaria (catálogos de NASA/NSSDCA, imágenes LRO/HiRISE). Validación mínima: tabla de procedencia por ítem y tasa de ítems verificados.
- **Literatura:** no buscada específicamente; el rigor aquí es de procedencia, no de modelo [INFERENCIA].
- **Negativo como diferencial:** no. Al jurado de storytelling no le interesa un negativo; sí le puede interesar "verificado vs. no verificado" como rasgo de confianza.
- **Puntaje: 4/5** (rigor documental fácil de lograr; poco espacio para afirmaciones científicas fuertes).

### 4.3 Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars

- **Engañosas típicas:** "este sitio es el mejor análogo de Shackleton/Jezero" por similitud visual o por un solo atributo (aridez, color); ranking con pesos arbitrarios presentados como objetivos; ignorar que un análogo lo es **para una pregunta** (geoquímica, operaciones, iluminación, psicología), no en general; equiparar iluminación polar lunar (sol rasante, PSRs) con latitudes altas terrestres sin modelar geometría.
- **Rigor alcanzable:** medio. Lo honesto es un análogo **multi-criterio por propósito** con criterios explícitos y análisis de sensibilidad de pesos (¿cambia el top-5 al perturbar pesos ±20 %?). Validación mínima: que el método recupere los análogos ya establecidos en la literatura (Atacama, Devon/Haughton, Río Tinto para Marte; Black Point/Desert RATS, Hawái/PISCES, Haughton para Luna) — una prueba de "recuperación de conocidos" — y explicar cualquier sitio nuevo propuesto.
- **Literatura:** definición operativa de análogo = ambiente con al menos una característica similar al cuerpo objetivo (aridez, salinidad, pH, materia orgánica, temperatura) [SNIPPET, fuente secundaria]; revisión 2022 (Frontiers in Astronomy and Space Sciences) que encuentra a Atacama y Devon Island como los más parecidos geoquímicamente a rocas Noeico tardío–Hespérico temprano de Gale [SNIPPET]; Río Tinto como análogo de Meridiani (pH≈2) [SNIPPET]; BP-1 de Black Point descrito por NASA KSC como simulante "de baja fidelidad pero económico" y un abstract GSA 2010 advierte que Black Point puede ser inadecuado como impulsor de requisitos científicos lunares [SNIPPET]; afirmaciones de PISCES sobre similitud con regolito son autorreportadas, sin validación independiente encontrada [SNIPPET]. Criterios de sitios Artemis III (pendiente, comunicación con Tierra, iluminación, proximidad a PSR) [SNIPPET] — sirven como lista de atributos a emparejar. **No se encontró** un esquema formal y aceptado de "fidelidad de análogo".
- **Negativo/incertidumbre como diferencial:** sí — mostrar que el ranking es estable o inestable bajo perturbación de pesos, y que ningún sitio terrestre es análogo en todas las dimensiones (p. ej. no hay PSR terrestre real), es científicamente honesto y poco común [INFERENCIA].
- **Puntaje: 3/5.**

### 4.4 CLPS Lunar Mission Browser

- **Engañosas típicas:** estados de misión desactualizados o inventados (CLPS tiene fallas y éxitos parciales); "resultados científicos" de cargas útiles resumidos por LLM sin fuente.
- **Rigor alcanzable:** alto en exactitud de datos (es un problema de curaduría). Validación mínima: fecha de corte y fuente por campo; tasa de campos verificados.
- **Literatura:** no aplica en sentido científico.
- **Negativo como diferencial:** no.
- **Puntaje: 4/5** (exactitud alcanzable; poco contenido de "ciencia" que puntúe en Best Use of Science).

### 4.5 Create Health Monitoring Software for Astronauts

- **Engañosas típicas:** "predicción de salud", "detección temprana de enfermedad" o "IA diagnóstica" sin datos clínicos de astronautas; validar con datos sintéticos generados por el propio equipo; usar umbrales de población general como si valieran en microgravedad (redistribución de fluidos, intolerancia ortostática); tratar HRV de PPG de muñeca como equivalente a ECG.
- **Rigor alcanzable:** bajo para predicción; medio para monitoreo/visualización. Datos públicos existen pero son de n muy pequeño: Inspiration4 (4 tripulantes) en OSDR, primer dataset abierto de biología humana de un vuelo comercial (junio 2024), mayormente ómico y fenotípico, no series continuas de wearables [SNIPPET]; Twins Study (n=1 par) en el portal SOMA [SNIPPET]. Con n=4 no se puede entrenar ni validar un predictor; cualquier "accuracy" sería sobreajuste.
- **Validación mínima creíble:** (a) que las reglas de alarma se basen en límites publicados y citados, no aprendidos; (b) si hay detección de anomalías, demostrarla en un dataset público terrestre con etiquetas (p. ej. arritmias en bases de ECG abiertas) y declarar explícitamente que no está validada en vuelo; (c) declarar calidad de señal.
- **Literatura:** estudio NASA JSC: monitores Bluetooth comerciales vs ECG de 12 derivaciones, 19 sujetos/30 sesiones, umbral ±5 lpm; bandas de pecho superan a ópticos; "la calidad de datos de FC en ISS tiene múltiples limitaciones e insuficiente para requisitos actuales" [SNIPPET]; Functional Task Test: HRV en 3 min de pie equivale a 5 min, CV <8 %, y el vuelo altera HRV/presión [SNIPPET]; HRP busca wearables off-the-shelf para actividad y sueño en ISS [SNIPPET]. Nature 2024 SOMA (Overbey et al., Jones et al.) [SNIPPET].
- **Negativo/incertidumbre como diferencial:** sí, si se formula como diseño seguro: "el sistema dice 'no sé' cuando la calidad de señal es baja" o "estas métricas no están validadas en microgravedad". Un jurado no especializado puede preferir la demo de "IA predice infarto", pero esa afirmación es fácilmente atacable por un juez con formación médica [INFERENCIA].
- **Puntaje: 2/5.**

### 4.6 Build a Junior Astronaut Mission Trainer

- **Engañosas típicas:** física o fisiología incorrecta en contenidos educativos; "aprendizaje mejorado" sin evaluación.
- **Rigor alcanzable:** el rigor relevante es exactitud de contenido (verificable contra fuentes NASA) y, a lo sumo, una prueba de usabilidad con 3–5 niños (no evidencia de aprendizaje).
- **Negativo como diferencial:** no.
- **Puntaje: 4/5 en exactitud de contenido; ~1/5 en evidencia de eficacia pedagógica.** Se reporta 4 porque la ciencia exigible es la de contenido.

### 4.7 Space Mission Design Game

- **Engañosas típicas:** Δv, masas o tiempos de viaje "realistas" que no lo son; simplificaciones no declaradas.
- **Rigor alcanzable:** alto si el motor usa ecuaciones estándar (ecuación del cohete de Tsiolkovsky, transferencias de Hohmann) verificadas contra valores de referencia publicados. Validación mínima: tabla de 5–10 casos (p. ej. Δv LEO→Luna, Tierra→Marte) comparados con valores de literatura, con error porcentual.
- **Negativo como diferencial:** no; pero "nuestro Δv coincide con valores de referencia dentro de X %" es un sello de calidad barato.
- **Puntaje: 4/5.**

### 4.8 Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data

- **Estado del desafío:** título del brief; búsqueda dirigida **no encontró** el enunciado ni el dataset [búsqueda #7]. Datos que probablemente se ofrezcan: [NO VERIFICADO].
- **Engañosas típicas:** "IA que predice incendios en naves" entrenada con un puñado de experimentos; extrapolar de cotón/fibra de vidrio o PMMA a cualquier material; extrapolar de flujo forzado de ducto a cabina real; métricas de clasificación con fuga entre entrenamiento y test (frames del mismo video en ambos lados); confundir "extinción" de gotas (FLEX/ACME, combustión de gotas y llamas frías) con propagación sobre sólidos (Saffire/BASS) — son fenómenos distintos.
- **Rigor alcanzable:** medio-bajo para "IA predictiva"; medio-alto para análisis físico-guiado. Lo honesto en 48 h: (a) agrupar por experimento (leave-one-experiment-out), nunca por frame; (b) comparar contra un baseline físico simple (p. ej. escalamiento de velocidad de propagación con O₂ y velocidad de flujo) antes de cualquier red; (c) reportar n efectivo = número de ensayos independientes, no de frames.
- **Literatura:** Olson et al. 2023, Combustion and Flame 248:112559 — datos de propagación concurrente de Saffire y BASS en 3 tamaños de ducto, 5 tamaños de muestra, 2 materiales y 2 atmósferas; la velocidad y longitud de llama dependen fuertemente del tamaño del ducto incluso >30 cm (manuscrito aceptado abierto en UCL Discovery) [SNIPPET]. Saffire I y III: muestra de algodón-fibra de vidrio de 94 × 40,6 cm; Saffire II: arreglo de muestras de 29 × 5 cm [SNIPPET]. BASS-II: datos catalogados en flame.sdsu.edu [SNIPPET; el sitio está bloqueado desde aquí, no verificado]. Xi, Torero y Guibaud 2022 (Combustion and Flame): asimilación de datos + modelo físico para pronosticar propagación concurrente, validado con datos de microgravedad a gran escala — el estado del arte "predictivo" es físico-guiado, no una red neuronal [SNIPPET]. Revisión "Flame spread: Effects of microgravity and scale" (Urban, Ferkul, Fernandez-Pello, Torero et al.) [SNIPPET]. **No se encontró** ningún trabajo publicado que entrene una red neuronal sobre datos de propagación de la ISS (búsqueda #9). ACME y FLEX: no aparecieron en las búsquedas; su descripción como experimentos de gotas/llama en el CIR es conocimiento previo [NO VERIFICADO].
- **Negativo/incertidumbre como diferencial:** **sí, fuerte.** Dado que el propio título promete "AI-powered insights", la mayoría de equipos sobreafirmará. "Con N experimentos independientes, un modelo simple de escalamiento iguala/supera a la red; la IA no agrega poder predictivo aún, pero sí sirve para extraer frente de llama de video" es exactamente un hallazgo de "Best Use of Science". Además, el efecto del tamaño de ducto (Olson 2023) es un argumento concreto contra la extrapolación a cabina [INFERENCIA].
- **Puntaje: 3/5** (datos reales de alta calidad pero n muy pequeño; rigor alto posible solo si se renuncia a la afirmación predictiva fuerte).

### 4.9 Harmonization of MODIS and VIIRS Hot Spots

- **Estado:** el título no apareció en la búsqueda #17 ([NO VERIFICADO] que exista con ese nombre; posible origen CONAE, sin verificar).
- **Engañosas típicas:** "serie armonizada" que solo concatena productos o reescala conteos con un factor global; tratar diferencias de detección como sesgo constante cuando dependen de tamaño/temperatura de fuego, bioma, hora de paso y ángulo de escaneo; ignorar la deriva orbital de Terra/Aqua desde 2022; reportar acuerdo de conteos agregados sin validación espacial independiente; afirmar "detecta más incendios" (VIIRS 375 m detecta más píxeles, no necesariamente más incendios distintos).
- **Rigor alcanzable:** **alto** — es el desafío con mejor infraestructura de validación pública. Validación mínima creíble: (a) usar pares casi simultáneos (Aqua MODIS 13:30 vs S-NPP/NOAA-20 VIIRS 13:30 locales, ahora afectados por deriva) para estimar funciones de transferencia estratificadas por bioma/FRP/ángulo; (b) validar en un período o región retenidos (CV espacial/temporal, T1); (c) comparar contra un producto independiente: perímetros de área quemada (MCD64A1 / VNP64A1) o detecciones de mayor resolución (Landsat/Sentinel-2 activos), como hacen Csiszar, Schroeder, Giglio et al. con ASTER/Landsat [SNIPPET]; (d) baseline trivial: factor de escala único global; (e) métricas de omisión/comisión, no solo correlación de conteos.
- **Literatura:** Schroeder, Oliva, Giglio y Csiszar 2014, RSE 143:85–96: VIIRS 375 m detecta ≈3× píxeles diurnos y ≈25× nocturnos vs VIIRS 750 m; comisión <1,2 % para confianza nominal; artefactos por saturación y Anomalía del Atlántico Sur [SNIPPET; el PDF está en earthdata.nasa.gov, bloqueado]. Oliva y Schroeder 2015: área quemada con 375 m, mejor en bosques, peor en pastizales/sabanas/agricultura [SNIPPET]. Csiszar et al. 2012 (AMS): órbitas compatibles pero tamaño de píxel, agregación along-scan y ancho de barrido producen diferencias inherentes [SNIPPET]. Giglio GOFC 2024: VIIRS 375 m es mejora significativa; se mantiene 750 m por continuidad; VIIRS Collection 2 vigente, MODIS C6.1 [SNIPPET]. Fin de MODIS: LAADS indica fin de colección científica feb-2027 (Terra) y sep-2027 (Aqua), con reprocesamiento final v8.0; CAMS cita enero 2027 para Terra; deriva orbital desde 2022; CAMS incorporó VIIRS a GFAS el 04/12/2025; **no hay reemplazo del paso matutino de Terra** [SNIPPET]. Li et al. (JGR Atmospheres) comparación FRP VIIRS–MODIS [SNIPPET, sin cifras]. Giglio et al. 2016 (algoritmo MODIS C6) [NO VERIFICADO en esta sesión].
- **Negativo/incertidumbre como diferencial:** **sí, máximo.** La pregunta científica real del desafío es "¿cuánto de la tendencia de hot spots es cambio de sensor y no cambio de fuego?". Una banda de incertidumbre de la serie armonizada, y mostrar dónde la armonización falla (pastizales, fuegos pequeños, noche, paso matutino perdido), es el entregable científicamente valioso y, si CONAE es el proponente, relevante para Argentina (Local Impact) [INFERENCIA].
- **Puntaje: 4/5** (datos abiertos maduros, literatura sólida, validación cruzada posible; techo por volumen de datos en 48 h y por la deriva orbital, que complica la simultaneidad).

### 4.10 Field Shift: Adapting Farms with NASA Data

- **Estado:** título confirmado por una fuente de prensa ("clima-resiliencia agrícola") [SNIPPET].
- **Engañosas típicas:** "aumenta el rendimiento X %" o "impacto en agricultura" sin validación de campo; modelos de rendimiento con CV aleatoria sobre píxeles autocorrelacionados (T1); recomendaciones de cultivo/riego por LLM sin modelo agronómico; confundir anomalía de NDVI/SMAP con pérdida de rendimiento.
- **Rigor alcanzable:** medio. Validación mínima creíble: (a) usar estadísticas oficiales de rendimiento a nivel departamento/condado como verdad (p. ej. USDA NASS o, para Argentina, estimaciones agrícolas públicas — [NO VERIFICADO] disponibilidad/formato); (b) validación espacial o por año retenido (leave-one-year-out); (c) baseline trivial = tendencia lineal o promedio histórico; (d) declarar que no hay validación a nivel lote.
- **Literatura:** Ploton et al. 2020 [SNIPPET]; crítica 2024 en Precision Agriculture (Springer, s11119-024-10212-2) sobre validación de un solo campo con k-fold aleatorio [SNIPPET]; estudios maíz Sentinel-2 2025 y UAV 2024 que muestran sobreoptimismo de la CV estándar [SNIPPET]; EGU24 trigo Marruecos (1.329 lotes) "la CV espacial es esencial" [SNIPPET].
- **Negativo/incertidumbre como diferencial:** sí, parcialmente: "nuestro modelo supera la tendencia histórica en X departamentos y no en Y" es creíble y raro. Pero el jurado de "impacto" premia la herramienta para el productor; el negativo debe ser una capa de confianza dentro del producto, no el producto [INFERENCIA].
- **Puntaje: 3/5.**

### 4.11 The Earth Information Jukebox

- **Estado:** título confirmado por una fuente de prensa ("convierte datos e imágenes de la Tierra en sonido") [SNIPPET].
- **Engañosas típicas:** "la sonificación permite entender/detectar el cambio climático" sin prueba perceptiva; mapeos que exageran o invierten tendencias (escalas no lineales, normalización por ventana que borra la tendencia); "accesible para personas ciegas" sin pruebas con usuarios.
- **Rigor alcanzable:** medio, y de tipo distinto: fidelidad del mapeo (monotonía, escala declarada, reproducibilidad dato→sonido) y una mini-prueba perceptiva (¿oyentes detectan la dirección de la tendencia por encima del azar?). Validación mínima: test de "ida y vuelta" — oyentes clasifican tendencia sube/baja/estable en clips con verdad conocida, con n pequeño reportado honestamente.
- **Literatura:** estudio 2024 con astrónomos y no astrónomos: lo visual supera a lo auditivo; la sonificación produce sesgo de respuesta más liberal, pero la detección de tránsitos por sonido supera el azar [SNIPPET, arXiv 2402.09953 bloqueado]; revisión: la mayoría de publicaciones de sonificación se centran en técnica, no en evaluar usabilidad; evaluaciones a menudo no estándar y no publicadas [SNIPPET]; Arcand et al. 2024 (Frontiers in Communication, 10.3389/fcomm.2024.1288896) sobre respuesta del público a sonificaciones NASA [SNIPPET, sin hallazgos leídos].
- **Negativo/incertidumbre como diferencial:** sí en forma de "hicimos una prueba perceptiva" (casi nadie la hará). Un resultado negativo puro ("el sonido no transmite la tendencia") no le interesaría a un jurado de Art & Technology salvo como iteración de diseño [INFERENCIA].
- **Puntaje: 3/5.**

### 4.12 Desafíos faltantes (≥2–3 títulos)

No identificados. Para un eventual desafío "patrones de tendencias ambientales y climáticas" (brief), aplican T1 y T2 con fuerza: detección de tendencias exige control de autocorrelación temporal, cambios de sensor/versión de producto y pruebas de significancia (p. ej. Mann-Kendall con corrección por autocorrelación) [INFERENCIA; literatura no buscada].

## 5. Tabla resumen

| Desafío | Afirmación engañosa más probable | Validación mínima creíble | ¿Negativo/incertidumbre diferencia? | Rigor 1–5 |
|---|---|---|---|---|
| Martian Map | "ruta segura" sobre CTX/MOLA | Cruce con HiRISE + baseline ruta recta | Sí (moderado, con producto) | 3 |
| Abandoned but not Forgotten | Inventario inventado/incompleto | Procedencia por ítem | No | 4 |
| Análogos Luna/Marte | "mejor análogo" por similitud superficial | Criterios por propósito + sensibilidad de pesos + recuperación de análogos conocidos | Sí | 3 |
| CLPS Browser | Estados/resultados desactualizados | Fuente y fecha por campo | No | 4 |
| Salud de astronautas | "predicción de salud" sin datos clínicos | Límites citados; detección probada solo en dataset terrestre etiquetado; declarar no validado en vuelo | Sí (diseño seguro) | 2 |
| Junior Astronaut Trainer | Contenido incorrecto / "mejora aprendizaje" | Verificación de contenido | No | 4 |
| Mission Design Game | Δv "realista" incorrecto | Tabla vs valores de referencia | No (sello de calidad) | 4 |
| Flame in Freefall | "IA predice incendios" con n≈decenas de ensayos | Leave-one-experiment-out + baseline físico | **Sí, fuerte** | 3 |
| MODIS–VIIRS | "armonización" sin validación cruzada | Funciones de transferencia estratificadas + validación independiente + baseline factor único | **Sí, máximo** | 4 |
| Field Shift | "impacto en rendimiento" sin campo; CV aleatoria | Estadística oficial + CV espacial/temporal + baseline tendencia | Sí (como capa de confianza) | 3 |
| Earth Info Jukebox | "se entiende el clima por sonido" sin prueba | Fidelidad del mapeo + mini-test perceptivo | Parcial | 3 |

Lectura: los puntajes 4 de desafíos "blandos" (CLPS, Trainer, Game, Abandoned) reflejan que la exactitud exigible es fácil de lograr, **no** que ofrezcan oportunidades para ganar "Best Use of Science". Los desafíos donde el rigor es **a la vez alcanzable y diferenciador** son, en orden: MODIS–VIIRS, Flame in Freefall, Análogos.

## 6. Objeciones propias

1. Ningún enunciado completo leído: si el 28/10 los desafíos piden otra cosa (p. ej. Flame in Freefall con un dataset curado de cientos de ensayos), los puntajes cambian.
2. Toda la literatura está en nivel [SNIPPET]; nada fue leído completo (arxiv, nasa.gov, earthdata bloqueados). Las cifras de Schroeder 2014 y Olson 2023 deben verificarse en el PDF antes de citarse en un pitch.
3. El puntaje mezcla "rigor posible" con "rigor relevante"; un jurado general puede valorar poco el rigor (las guías 2026 salen 13/11).
4. "Negativo como diferencial" es un juicio [INFERENCIA]; no tengo evidencia de que jurados Space Apps hayan premiado resultados negativos. ASTRA demuestra que el negativo es real, no que sea premiable.
5. Sesgo posible a favor de Tierra/MODIS-VIIRS por mayor madurez de datos que conozco; lo compensé exigiendo validación igual de estricta.

## 7. Conclusiones

1. El riesgo de afirmación engañosa es máximo en Salud de astronautas (n clínico ≈ 0–4), Flame in Freefall (n de ensayos pequeño, título que invita a sobreafirmar "IA") y Martian Map (resolución del DTM incompatible con "seguridad").
2. El desafío con mejor relación "rigor alcanzable / valor de la incertidumbre" es **Harmonization of MODIS and VIIRS** (4/5), condicionado a que exista con ese nombre (no verificado) y a la fecha de fin de MODIS (2027, deriva desde 2022), que hace la pregunta oportuna.
3. **Flame in Freefall** es el segundo candidato desde el rigor: un hallazgo honesto del tipo "la IA no supera a un baseline físico con estos N ensayos; el tamaño de ducto domina" sería diferencial — si el dataset publicado permite agrupar por experimento.
4. La lección de ASTRA se generaliza en un protocolo barato para cualquier desafío: baseline trivial + validación espacial/por grupo + producto independiente + declarar n efectivo.

## 8. Tabla de fuentes

| URL | Qué afirma (resumido) | Estado |
|---|---|---|
| https://earthdata.nasa.gov/s3fs-public/imported/Schroeder_et_al_2014b_RSE.pdf | Algoritmo VIIRS 375 m; 3×/25× píxeles vs 750 m; comisión <1,2 % | SNIPPET (PDF bloqueado) |
| https://ams.confex.com/ams/92Annual/webprogram/Paper203393.html | Csiszar/Schroeder/Giglio 2012: diferencias inherentes MODIS–VIIRS; referencia ASTER/Landsat | SNIPPET |
| https://gofcgold.org/sites/default/files/2024-11/Giglio_GOFC_2024_NASA_Fire.pdf | Estado de productos de fuego NASA 2024; 750 m por continuidad | SNIPPET |
| https://modis.gsfc.nasa.gov/sci_team/meetings/201911/presentations/land/giglio.pdf | VIIRS 375 m más sensible; problema C1 corregido en C2 | SNIPPET |
| https://geog.umd.edu/sites/geog.umd.edu/files/pubs/1-s2.0-S0034425725004109-main.pdf | Continuidad área quemada MCD64A1 → VNP64A1 (2025) | SNIPPET |
| https://ladsweb.modaps.eosdis.nasa.gov/learn/modis-to-viirs-transition/ | Fin MODIS feb-2027 (Terra), sep-2027 (Aqua); deriva orbital | SNIPPET |
| https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system | CAMS añade VIIRS a GFAS 04/12/2025; Terra ene-2027 | SNIPPET |
| https://www.earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs | Sin reemplazo del paso matutino de Terra | SNIPPET |
| https://discovery.ucl.ac.uk/id/eprint/10164340/ | Olson et al. 2023 C&F 248:112559, Saffire+BASS, efecto del ducto | SNIPPET |
| https://discovery-pp.ucl.ac.uk/id/eprint/10145279 | Xi, Torero, Guibaud 2022: asimilación de datos para pronóstico de propagación | SNIPPET |
| https://hal.sorbonne-universite.fr/hal-02042950 | Revisión "Flame spread: effects of microgravity and scale" | SNIPPET |
| https://ntrs.nasa.gov/api/citations/20170002628/downloads/20170002628.pdf | Saffire (dimensiones de muestras, planes de análisis) — atribución a este PDF específico incierta | SNIPPET |
| https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7486894/ | Ploton et al. 2020: validación espacial revela poder predictivo casi nulo | SNIPPET |
| https://link.springer.com/10.1007/s11119-024-10212-2 | Crítica a validación de modelos de rendimiento | SNIPPET |
| https://www.mdpi.com/2673-4117/6/10/270 | Maíz Sentinel-2: CV estándar sobreestima | SNIPPET |
| https://www.mdpi.com/2072-4292/16/4/683 | UAV maíz: CV espacial detecta sobreajuste | SNIPPET |
| https://meetingorganizer.copernicus.org/EGU24/EGU24-22153.html | Trigo Marruecos: CV espacial esencial | SNIPPET |
| https://pubs.usgs.gov/publication/70225507 | Kirk et al. 2021: calidad DTM HRSC/CTX/HiRISE | SNIPPET |
| https://stac.astrogeology.usgs.gov/docs/data/mars/ctxdtms | Límites de detección de cráteres/colinas en CTX DTM 20 m | SNIPPET |
| https://www.frontiersin.org/journals/astronomy-and-space-sciences/articles/10.3389/fspas.2022.1031832/pdf | Revisión 2022: Atacama y Devon más similares a Gale | SNIPPET |
| https://www.isa.au.dk/networks/euroPlanet/facilities/tna1/overview.html | Río Tinto pH≈2; red de análogos Europlanet | SNIPPET |
| https://bmsis.org/mars-analog-environments-what-and-where/ | Definición de análogo por atributo | SNIPPET |
| https://gsa.confex.com/gsa/2010AM/webprogram/Paper181719.html | Black Point: lecciones correctas e incorrectas de análogos | SNIPPET |
| https://ntrs.nasa.gov/api/citations/20100024529/downloads/20100024529.pdf | BP-1 simulante de baja fidelidad (atribución probable) | SNIPPET |
| https://arxiv.org/html/2406.19863v1 | Multi-criterio para sitios Artemis III | SNIPPET |
| https://ntrs.nasa.gov/citations/20150021215 | Monitores FC Bluetooth vs ECG (atribución probable) | SNIPPET |
| https://core.ac.uk/works/15256855 | Validación cardiovascular Functional Task Test | SNIPPET |
| https://www.nasa.gov/osdr-latest-news-i4-mission-datasets/ | Datos Inspiration4 abiertos en OSDR | SNIPPET |
| https://soma.weill.cornell.edu/apps/SOMA_Browser/ | Portal SOMA (I4, Twins) | SNIPPET |
| https://arxiv.org/pdf/2206.13536 | Revisión sonificación en astronomía; evaluación escasa | SNIPPET |
| https://web3.arxiv.org/abs/2402.09953 | Visual vs auditivo en detección de tránsitos | SNIPPET |
| https://therecursive.com/nasa-space-apps-challenge-2026-where-to-join-it-in-cee | Títulos Jukebox y Field Shift; 14 desafíos; 14–15/11 | SNIPPET (fuente única de prensa) |
| https://www.spaceappschallenge.org/2026/challenges/ | Enunciados | NO ACCESIBLE (403) |
| https://flame.sdsu.edu/ | Catálogo de datos BASS-II | NO ACCESIBLE (403) |

## 9. Pendientes

1. Leer los enunciados completos el 28/10 y recalibrar puntajes, especialmente Flame in Freefall (tamaño real del dataset) y MODIS–VIIRS (existencia, proponente, alcance regional).
2. Verificar en texto completo las cifras de Schroeder 2014 (comparación cuantitativa con MODIS, que no se vio en el snippet) y Olson 2023.
3. Confirmar qué datos de ACME/FLEX son públicos (no encontrados).
4. Buscar evaluaciones formales de fidelidad de análogos lunares (polares/PSR) — no encontrado.
5. Leer las guías de juzgamiento 2026 (13/11) para saber cuánto pesa el rigor.
6. Identificar los 2–3 desafíos faltantes.
