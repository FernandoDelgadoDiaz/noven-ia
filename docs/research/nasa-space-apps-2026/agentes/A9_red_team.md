# A9 — Red team independiente: refutación de los 5 finalistas (NASA Space Apps 2026)

Fecha: 2026-10-21. Agente: A9. Mandato: intentar **eliminar** oportunidades, no apoyarlas. No recibí ranking ni preferencia.

Etiquetas de evidencia (BRIEF): **[LEÍDO]** fuente abierta completa · **[CÓDIGO]** leí el archivo en un clon · **[SNIPPET]** resumen del buscador · **[INFERENCIA]** · **[NO VERIFICADO]**.

---

## 1. Misión y método

- Leí BRIEF, FINALISTAS y las secciones pertinentes de A1, A2a, A2b, A3, A4, A5, A6, A7, A8 y A10.
- **15 WebSearch** (cupo ≤45). WebFetch no se usó. `catalogos5.conae.gov.ar` devolvió 403 desde el proxy (el manual del visor de focos de CONAE no se pudo leer).
- Clones `--depth 1 --filter=blob:none` en `/tmp/claude-0/-home-user-noven-ia/7029a718-8690-52ad-a08e-e11704dd6284/scratchpad/redteam/`. Solo lectura y grep, sin ejecutar nada:
  - C09: `Aalvee-Aarham/kiln-watch` (último commit 2026-10-10) y `samuelakosaonyejekwe/firecal` (2026-10-04).
  - C06: `mahdimahmud2006-coder/nasa_space-apps_challenge` (TerraPulse, 2026-10-14; checkout parcial de `*.py` y `*.md`).
  - C02: `Fibananagucchi/EarthTrendTest` (2026-10-15), `shahriarkhansakib/Hritu` (2026-10-14) y `nasa-earth-detectives/nasa-earth-trend-detective` (2026-10-02).
  - C13: `Gxxrazn21/Juego_Nasa` (2026-10-08), `dean50312-hub/space-mission-design-game` (2026-10-20) y `mariam2009m44-lab/mission-control` (2026-10-12).
  - C14: `Yoriichi-0u0/earth-fm` (2026-10-14).
- **Hallazgo lateral.** `Hritu/Challanges/*.md` trae una guía de terceros con los 14 desafíos, un "build" sugerido, una "killer demo" y un plan de 48 h para cada uno. Declara como origen el evento de Bangladesh y un artifact de claude.ai. **No es texto oficial.** Sirve para medir qué diseño es el "por defecto" que reciben cientos de equipos [CÓDIGO].

---

## 2. Veredictos por finalista

### C09 — Harmonization of MODIS and VIIRS Hot Spots → **ELIMINADO** (tal como está formulada la oportunidad)

**Ataque 1: la oportunidad 9-A ya está implementada, y con más rigor del que propone A5.**

Kiln Watch [CÓDIGO: `kilnwatch/research_dictionary.md`, `presentation/qa.md`, `slides_7.md`]:
- Su unidad es "**Aqua-MODIS-equivalent** fire cell-days per 1,000 cloud-free cells". Es exactamente la serie de referencia Aqua que 9-A propone "empalmar".
- Tiene la cadena de calibración **Aqua ← S-NPP ← NOAA-20** después del 2/11/2026.
- Sus β están estratificados por división (región), **mes** y pasada día/noche, con **IC 95 % por bootstrap de bloques de temporada**.
- El período de calibración termina **antes** de la deriva de Aqua (2022), y esa decisión está justificada.
- Hace validación leave-one-season-out y un test de quiebre (Chow) prerregistrado.

9-A ("función de transferencia Aqua→VIIRS por región y estación con incertidumbre explícita") **es eso**. Lo único que agrega es el usuario nombrado (INPE/CONAE) y otra región.

FireCal [CÓDIGO: README]:
- Calibra "per-area, per-month" con shrinkage a un prior mundial para **208 países o una caja dibujada**, así que la Argentina ya está cubierta.
- Distingue tres eras de sensor y valida fuera de muestra. Declara un error de 3,0 % para Brasil.
- Mide la deriva de Terra: el ratio VIIRS/Terra pasa de 6,71 a 7,90 entre 2022 y 2024.

Con esto, el diferencial queda en **reetiquetar una región y un destinatario**. Se copia en minutos y no aporta nada a "Best Use of Science".

**Ataque 2: el complemento 9-B ("silencio confiable") también está tomado.**

Kiln Watch normaliza por fracción libre de nubes y publica un campo `observed`. Su Q&A dice: "A cloudy monsoon day with zero detections is 'not observed', not 'no fire'" [CÓDIGO]. A5 afirmó que no encontraba ese estado. Fuera de FIRMS esa afirmación es falsa: un competidor visible ya lo hace.

**Ataque 3: el usuario institucional sabe del problema y lo está trabajando.**

- INPE pasó la referencia de NOAA-15 a Aqua el 22/08/2011 [SNIPPET, aviso INPE 2011].
- Según un artículo de 2024 que cita a INPE (2023), "será necesario integrar y ajustar los datos del AQUA al próximo satélite de referencia, el Suomi NPP" [SNIPPET]. También hay estudios brasileños que cuantifican las diferencias Aqua vs. S-NPP (UFPE JHRS; ICMBio, Amazonía) [SNIPPET].
- La "necesidad" existe, pero el usuario ya la tiene identificada y cuenta con especialistas. Una herramienta de 48 h no le resuelve nada que no esté haciendo [INFERENCIA].
- Para **CONAE** no encontré evidencia de una serie de "satélite de referencia". CONAE tiene su propio visor Aqua/Terra/NOAA-20 (manual de 2024) [SNIPPET]. Con eso, el usuario argentino de 9-A es especulativo, y el ángulo "Local Impact" Argentina se apoya en un supuesto.

**Ataque 4: ventaja que solo existe en la presentación.** El "récord o descenso artificial de 2027-2028" no se puede demostrar con datos el 14/11, porque Aqua sigue operando hasta el otoño boreal de 2027. Solo puede mostrarse como contrafáctico sobre el pasado, y eso Kiln Watch ya lo hace con la costura de 2012.

**Ataque 5: encaje con el resumen.** El resumen pide un **calendario de actividad de quema** para un área elegida (A1, paráfrasis). 9-A produce una serie nacional o regional empalmada. El calendario hay que construirlo igual, y Kiln Watch, FireCal, Ignis y NPC ya lo tienen. 9-A agrega una capa encima del entregable pedido; no lo reemplaza.

**Sobrevive solo si** se cumplen las dos condiciones:
- (a) el enunciado del 28/10 pide explícitamente continuidad con series oficiales o con un "satélite de referencia" (por ejemplo, por autoría de CONAE), **y**
- (b) el equipo apunta a un hueco que Kiln Watch declara abierto: el eslabón **NOAA-21** sin β calibrado ("not enough months … overlap" [CÓDIGO]) o la no estacionariedad de la relación durante la deriva de Aqua (2022-2026).

Ese hueco es angosto y otro equipo puede ocuparlo [INFERENCIA].

### C06 — Dancing with the SARs → **SOBREVIVE CON CONDICIONES** (débil)

**Ataque 1: el método no es nuevo.** Comparar el cambio contra la variabilidad "sin evento" del mismo píxel es el método de **DeVries et al. 2020 (RSE)**: línea base multitemporal con media y desviación estándar por píxel, y z-score por fecha. Tiene código abierto: el paquete `s1flood` (PyPI, con funciones `zscore` y `mapFloods`) y AutoFloods [SNIPPET]. La oportunidad D1 de A10 es aplicar un método publicado a NISAR banda L. Puede ser útil, pero no es original como ciencia.

**Ataque 2: A10 se equivoca al decir que "ninguno mide la variabilidad sin evento".** TerraPulse:
- normaliza el Δ dB por **MAD robusta de la escena** (`src/compute/time_series.py`, `threshold.py`; regla "abs(delta_db) ≥ k·1,4826·MAD") [CÓDIGO];
- tiene `temporal_consistency.py`, que "describe repeat-interval behavior on the unchanged 24-day region pixels", con clases fijadas antes de mirar los resultados [CÓDIGO].

No es una línea base por píxel con pares de control, pero se le acerca mucho. Lo que realmente queda como diferencial es más chico: una línea base temporal por píxel y "km² por encima del control".

**Ataque 3: datos y logística.**
- La descarga exige Earthdata Login; los HDF5 son del orden de GB [INFERENCIA A10, no verificado].
- Los productos son PROVISIONAL. Una guía secundaria anuncia una calibración final y un reprocesamiento para el otoño boreal de 2026 [SNIPPET secundario], que podrían caer cerca del evento.
- La sede de Palermo abre solo el sábado de 9 a 18 h (A8).
- La guía de terceros recomienda **bajar las escenas antes del evento** [CÓDIGO, Hritu/Challanges/16]. Un equipo que respeta la regla estricta empieza en desventaja.

**Ataque 4: demo.** "X km² por encima de ±Y dB" es honesto, pero en 30 s se pierde frente a los sliders y el 3D de la competencia [INFERENCIA].

**Condiciones para sobrevivir:**
- que haya **≥4-5 adquisiciones de la misma órbita y frame** sobre el AOI desde el 17/06/2026, verificable el 14/11 a la mañana con `asf_search`;
- que la descarga y el recorte de un par terminen en las primeras 8 h;
- que se presente como "DeVries aplicado a NISAR L, con auditoría", citando la fuente.

**Invalidación:**
- que el enunciado del 28/10 entregue escenas curadas (entonces todos hacen lo mismo);
- que el issue de calibración PROVISIONAL domine la señal;
- que TerraPulse publique una línea base por píxel.

### C02 — Be An Earth System Trend Detective! → **SOBREVIVE CON CONDICIONES**

**A favor (lo que no pude refutar).** En los 3 repos líderes que cloné no aparecen D1 (cruce de rupturas con fechas de transición de sensor o versión) ni D3 (años necesarios para detectar la tendencia):
- EarthTrendTest solo tiene `SHORT_RECORD_YEARS = 8 # warn about low statistical power` y un texto cualitativo: "More years make it easier…" [CÓDIGO].
- Hritu aplica Pettitt sin cruzarlo con transiciones [CÓDIGO].
- nasa-earth-detectives: sin coincidencias.

**Ataque 1: la novedad no es científica y se copia en horas.** Weatherhead et al. 1998 ya integra en una sola fórmula los dos elementos de la oportunidad: los años necesarios según σ_N y φ, y el efecto de los **cambios de nivel por instrumento**, que "pueden aumentar los años necesarios en 50 % o más" [SNIPPET]. Es una ecuación cerrada. Cualquier competidor con un agente de código la agrega el sábado a la tarde [INFERENCIA].

**Ataque 2: dificultad oculta.** D1 necesita un **catálogo curado de transiciones** (colecciones MODIS, Terra en deriva desde 2022, cambios del sistema de observación de MERRA-2 y otros). No busqué un catálogo NASA legible por máquina, así que queda [NO VERIFICADO] que exista. Armarlo a mano en 48 h tiene sus propios errores. Además, con series cortas, la coincidencia entre una ruptura de Pettitt y una fecha de transición tiene poca potencia y alta tasa de coincidencias espurias [INFERENCIA].

**Ataque 3: demo y jurado.** Es un desafío avanzado juzgado primero por un jurado local. "Harían falta N años" es contraintuitivo, pero puede leerse como "no encontramos nada" [INFERENCIA]. El entregable base (qué cambia, dónde, cuánto y si es significativo) igual hay que construirlo, y ahí la competencia es fuerte: 15 o más repos.

**A favor, como hallazgo útil.** FireCal documenta un artefacto real: el ratio VIIRS/Terra salta en 2022-2024 por la deriva de Terra [CÓDIGO, README]. Es un caso demostrable de "tendencia o instrumento" con productos MODIS de Terra (LST y NDVI incluidos), y le da a D1 un ejemplo concreto.

**Condiciones:** que el enunciado no restrinja la variable a un producto homogeneizado sin transiciones (por ejemplo, solo GISTEMP); que la demo arranque por el caso Terra 2022 y no por la teoría; que D3 se valide con simulación AR(1).

**Invalidación:** que el 28/10 entregue datos ya listos para analizar y homogeneizados, o que un repo líder agregue "years-to-detect" antes del 14/11.

### C13 — Space Mission Design Game → **ELIMINADO**

- **Contradice a su propio proponente.** A5 calificó 7-A con "N baja, V baja" (§3.7). Su inclusión entre los finalistas no se sostiene con la evidencia de A5.
- **Los márgenes ya están implementados:**
  - Space Actuary [CÓDIGO, `js/i18n.js`]: una carta "Mass Margin" que explica que se reserva 20-30 % en la fase de concepto, un evento "dry mass grows 15 %" que enseña por qué el margen existe, y propelente calculado automáticamente "con margen".
  - Δv Arquitecto [CÓDIGO, `src/mission.js`, `src/data/events.js`]: `DESIGN_MARGIN = 0.10`, más eventos que se disparan con `margin(ctx, sim) < 0` sobre los consumibles.
  - mission-control [CÓDIGO]: "Low power margin" como advertencia.
- **Es el diseño por defecto.** La guía de terceros que circula entre los equipos de Bangladesh propone como "killer demo" literalmente "the delta-v margin drops below zero … closes with 4 percent margin" [CÓDIGO, Hritu/Challanges/23]. La oportunidad es la idea más obvia del desafío, no un hueco.
- **No hay condición razonable que la rescate.** Solo la salvaría que el enunciado del 28/10 exigiera algo distinto, como un tipo de misión o un dato concreto.

### C14 — The Earth Information Jukebox → **SOBREVIVE CON CONDICIONES** (la condición es logística y de encaje)

**Ataque 1: desajuste con el requisito.** El resumen pide "pair **EIC visual frames** with dynamic sonifications generated in **real time**" [SNIPPET, y README de earth-fm]. La tarea de prueba de 11-A ("¿subió o bajó la anomalía?") evalúa la sonificación de **series de datos**, no de frames del EIC. Los frames del EIC son en buena parte fotos y animaciones de exhibición, "not a scientific map" (earth-fm `docs/FRAMES.md`) [CÓDIGO]. Si la prueba no se hace sobre la sonificación de frames, el diferencial evalúa algo que el desafío no pide.

**Ataque 2: "nadie probó con ciegos" es falso fuera de Space Apps.**
- Chandra y "A Universe of Sound" probaron con expertos y no expertos ciegos o con baja visión. Arcand et al. 2024 (Frontiers) tiene 3.184 participantes, sighted y BLV [SNIPPET].
- Hay prototipos de mapas meteorológicos sonificados evaluados con 5 usuarios ciegos, y un estudio de IEEE VIS 2024 con 5 participantes no videntes [SNIPPET].
- La novedad es solo relativa a los repos 2026 visibles. En earth-fm no hay pruebas con usuarios (el grep no encontró "blind", "participant" ni "usability") [CÓDIGO].

**Ataque 3: riesgos de reglas y de ética (A8).**
- Contactar participantes antes del evento es organizar, no programar. Aun así, si el protocolo y los estímulos se diseñan antes del 14/11, eso roza "begin working".
- Hace falta consentimiento para filmar y no se pueden mostrar menores de 18 en el video.
- Un n de 2 a 5 no permite inferencia: a lo sumo es una tasa de acierto descriptiva con test binomial por ensayos.

**Ataque 4: la logística es frágil.** Conseguir personas ciegas un sábado o domingo en la sede es el punto único de falla. Al mismo tiempo, es el **único foso real** entre los 5 finalistas: un competidor no lo copia a último momento [INFERENCIA].

**Condiciones:**
- participantes confirmados por escrito, con el Local Lead informado, antes del 14/11 (organización, no código);
- prueba sobre la sonificación de **frames del EIC** (por ejemplo, "¿dónde está la zona más brillante o caliente del frame?"), además de una serie;
- fidelidad del mapeo declarada.

**Invalidación:** que no haya participantes el sábado al mediodía, o que el enunciado del 28/10 priorice lo artístico sobre la accesibilidad.

---

## 3. Ataque a la selección

1. **C13 no debería estar.** Ver §2. Su lugar quedó libre.
2. **C08 Flame in Freefall no debe entrar por 8-A.** La "zona de riesgo oculto" (pasa el test de 1 g pero arde en µg) ya la implementa `samuelakosaonyejekwe/flame-in-freefall` (A2a §4.8 [LEÍDO]). A5 no cruzó su propia oportunidad con el inventario de A2a.
3. **C04 CLPS con 4-A no responde al resumen.** El resumen citado en `lunarwindow/docs/challenge.md` pide comparar sitios y fechas según la posición del Sol y de la Tierra respecto del horizonte, para estimar energía y ventanas de comunicación directa con la Tierra (A2a §3 [LEÍDO]). El "libro mayor por carga útil" no hace eso. En cambio **4-B** (sensibilidad de la iluminación a la elipse de aterrizaje) sí responde. Fue descartado por "arriesgado", pero es un candidato infravalorado. No encontré un repo 2026 con elipse (1 búsqueda) [SNIPPET]. Su riesgo: LunaHorizon y Lunar Horizon Wheel ya validaron contra PGDA y DE440 (A2a), y el Lunar Browser de Ames tiene ventanas con restricción de iluminación (NTRS 2024, sin código público).
4. **C10 Análogos (3-A)** es el sustituto más plausible si C13 sale: tiene una brecha de criterios documentada (A5) y rigor diferenciable (A7). No lo ataqué a fondo y queda **sin red-team**.
5. **Sesgo sistemático de los agentes.** A5, A7 y A10 premian "el negativo o la incertidumbre como diferencial". A7 mismo reconoce que no hay evidencia de que el jurado lo premie (§6.4), y A3 encuentra que los ganadores son mayormente apps para un usuario final (H1). La selección favorece lo que los agentes saben auditar, no lo que el jurado premia.

## 4. Ataque a la premisa estratégica

- **La saturación por desafío está sobreponderada.**
  - El primer filtro es el **jurado local** (Argentina), no el campo global (A8 §3.5).
  - Los repos de Bangladesh compiten en su propio evento local.
  - Los premios globales son **10 categorías transversales**, no uno por desafío (A3). La competencia relevante en la etapa global son unos 40-45 finalistas de todos los desafíos, no los 13 repos de C09.
  - [INFERENCIA] El análisis de "competidor más fuerte por desafío" responde a una pregunta secundaria.
- **Si la regla de trabajo previo se aplica estrictamente:** los 78 de 78 repos de A2a y todos los clonados aquí tienen commits previos al 14/11. Quedarían fuera o con sospecha, y el equipo que empieza el 14/11 sería de los pocos elegibles "limpios". Pero no hay evidencia de que se aplique: el equipo SIGHTLINE dice que el evento local de Bangladesh "lifted" la regla, y A8 no encontró una definición. [INFERENCIA] No conviene apostar la estrategia a la descalificación ajena.
- **¿Conviene participar?** La tasa base es de ~0,1 % de ganar y ~0,4 % de llegar a finalista (A3), con o sin competidores adelantados. Si el objetivo es ganar un premio global, ninguna elección de desafío cambia ese orden de magnitud. Si el objetivo es aprender, obtener una nominación local o un premio local, participar sigue teniendo sentido, y conviene elegir donde el **jurado local** valore el diferencial [INFERENCIA].
- **Asimetría del método respecto de las reglas.** La guía de terceros recomienda pre-descargar datos y armar tablas antes del evento en todos los desafíos. Un equipo que respeta la regla parte siempre detrás, sobre todo en C06 (GB de HDF5) y menos en C14 y C02 (datos chicos).

## 5. Verificaciones de afirmaciones de otros agentes

| # | Afirmación (agente) | Resultado | Estado |
|---|---|---|---|
| V1 | Fin de la entrega de datos de S-NPP el 1/11/2026 (A2b, citando repos) | **Confirmado.** NOAA OSPO y NESDIS: 1/11/2026 a las 13:00 UTC, permanente; se recomienda pasar a NOAA-21 (primario) y NOAA-20. El alerta de Earthdata del 5/10/2026 dice 2/11 | [SNIPPET, coherente entre 3 fuentes] |
| V2 | Fin de MODIS: Terra en feb-2027 y Aqua en sep-2027 (A5, A7) | **Confirmado con matiz.** LAADS: Terra feb-2027, Aqua sep-2027. Aqua.nasa.gov: Aqua termina "early Fall 2027"; deriva libre desde dic-2021. Una versión anterior de la web decía pasivación en otoño de 2026 | [SNIPPET] |
| V3 | INPE usa AQUA_M-T como satélite de referencia (A5) | **Confirmado** en boletines INEMA de jun y ago de 2026, y en el aviso INPE de 2011 (Aqua desde el 22/08/2011). **Matiz no reportado por A5:** INPE (2023) ya planificaba la transición a S-NPP, que dejó de entregar datos en nov-2026 | [SNIPPET] |
| V4 | "FIRMS no armoniza" (A2b) | **Sin contradicción.** No apareció un producto de focos activos armonizado. FIRMS sí aloja el área quemada VIIRS como continuidad de MCD64A1 | [SNIPPET]; sigue siendo inferencia por ausencia |
| V5 | "Nadie hizo test perceptivo con ciegos" (A5, A7) | **Falso en el campo** (Chandra/Arcand 2024; 5 usuarios ciegos en mapas meteorológicos; VIS 2024). Sin contradicción en Space Apps 2026 (earth-fm no tiene pruebas con usuarios) | [SNIPPET] + [CÓDIGO] |
| V6 | Solo 2-3 repos NISAR con datos reales (A10) | **No refutado ni ampliado.** Una búsqueda no trajo repos nuevos. TerraPulse está confirmado | [SNIPPET] + [CÓDIGO] |
| V7 | "Ningún repo mide la variabilidad sin evento" (A10, C06) | **Parcialmente falso.** TerraPulse usa umbral por MAD de escena y analiza píxeles sin cambio por intervalo | [CÓDIGO] |
| V8 | "No hay estado observado / no observado" (A5, 9-B) | **Falso respecto de los competidores.** Kiln Watch tiene `observed` y normalización por nubes | [CÓDIGO] |
| V9 | 9-A no implementado (A5) | **Falso.** Kiln Watch convierte todo a unidades equivalentes a Aqua, por región, mes y pasada, con IC | [CÓDIGO] |

## 6. Objeciones propias

- Las 15 búsquedas son pocas. "No encontrado" no significa "no existe".
- Leí documentación y grep del código de los competidores, **no ejecuté nada**. Las métricas declaradas (por ejemplo, Kiln Watch 0,62→0,98) no están reproducidas.
- El enunciado completo del 28/10 puede reabrir C09 (si pide continuidad oficial) o cerrar C02/C06 (si entrega datos curados).
- No ataqué C10 ni C04-4B con la misma profundidad que a los finalistas.
- La guía de Hritu es de terceros. Su influencia sobre otros equipos es [INFERENCIA].

## 7. Conclusiones

| Finalista | Veredicto | Motivo principal | Condición de invalidación o de supervivencia |
|---|---|---|---|
| C09 | **ELIMINADO** | 9-A y 9-B ya implementados (Kiln Watch, FireCal); INPE ya planificaba la transición; CONAE como usuario sin evidencia | Revive solo si el 28/10 pide continuidad con la serie oficial **y** se ataca el eslabón NOAA-21 o la deriva de Aqua |
| C06 | **Sobrevive con condiciones (débil)** | Método DeVries 2020 ya publicado; TerraPulse cerca; logística de datos pesada | ≥4-5 adquisiciones de la misma órbita en el AOI; descarga en ≤8 h |
| C02 | **Sobrevive con condiciones** | D1 y D3 ausentes en los líderes, pero son Weatherhead 1998 y se copian en horas | Datos con transiciones reales (caso Terra 2022); que no lleguen datos homogeneizados |
| C13 | **ELIMINADO** | Márgenes ya implementados en 3 repos y en la guía por defecto; A5 lo calificó N/V baja | — |
| C14 | **Sobrevive con condiciones** | Único foso difícil de copiar (prueba con personas), pero hay desajuste con "frames EIC" | Participantes confirmados; prueba sobre frames del EIC |

## 8. Tabla de fuentes

| URL / ruta | Qué afirma | Estado |
|---|---|---|
| https://www.nesdis.noaa.gov/news/cessation-of-suomi-national-polar-orbiting-partnership-s-npp-data-users-onafter-november-01-2026 | S-NPP deja de entregarse el 1/11/2026 a las 13:00 UTC | [SNIPPET] |
| https://ospo.noaa.gov/data/messages/2026/08/MSG_20260803_1600.html | Aviso OSPO del 3/8/2026; pasar a NOAA-21 y NOAA-20 | [SNIPPET] |
| https://www.earthdata.nasa.gov/data/alerts-outages/suomi-npp-observations-cease-november-2-2026 | Fecha 2/11/2026 (actualizada al 5/10) | [SNIPPET] |
| https://ladsweb.modaps.eosdis.nasa.gov/learn/modis-to-viirs-transition/ | Fin de MODIS: Terra feb-2027, Aqua sep-2027 | [SNIPPET] |
| https://aqua.nasa.gov/ | Aqua termina "early Fall 2027"; deriva libre desde dic-2021 | [SNIPPET] |
| https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system | CAMS incorporó VIIRS a GFAS el 4/12/2025 | [SNIPPET] |
| https://www.earthdata.nasa.gov/news/blog/viirs-global-burned-area-product-added-firms | FIRMS aloja área quemada VIIRS (continuidad de MCD64A1) | [SNIPPET] |
| https://www.ba.gov.br/inema/sites/site-inema/files/2026-08/Boletim%20Di%C3%A1rio%20de%20Focos%20de%20Calor%20%2805-08-2026%29.pdf | AQUA_M-T sigue siendo la referencia en ago-2026 | [SNIPPET] |
| https://dataserver-coids.inpe.br/queimadas/queimadas/Publicacoes-Impacto/documentos/20110824_Aviso_Ref_Mudoup_Aqua.pdf | INPE cambió la referencia a Aqua el 22/08/2011 | [SNIPPET] |
| https://chs.inpa.gov.br/fasciculos/54-3/PDF/AA-2024-0068.pdf | INPE (2023): habrá que ajustar Aqua al próximo satélite de referencia (S-NPP) | [SNIPPET] |
| https://periodicos.ufpe.br/revistas/jhrs/article/view/256618 | Diferencias cuantitativas Aqua/MODIS vs. S-NPP/VIIRS (Brasil) | [SNIPPET] |
| https://catalogos5.conae.gov.ar/catalogofocos/Docs/035_CONAE_AQUA_TERRA_NOAA20_MODIS_VIIRS_FC_VISOR_ManualUsuarios_e02.pdf | Visor de focos de CONAE (Aqua/Terra/NOAA-20) | [SNIPPET]; curl 403 |
| github.com/Aalvee-Aarham/kiln-watch | Unidades equivalentes a Aqua; β por región, mes y pasada con bootstrap; cadena hasta NOAA-20; campo `observed` | [CÓDIGO] (docs y diccionario) |
| github.com/samuelakosaonyejekwe/firecal | Calibración por área y mes para 208 países; deriva de Terra 2022-2024 | [CÓDIGO] (README) |
| github.com/mahdimahmud2006-coder/nasa_space-apps_challenge | Umbral por MAD de escena; consistencia temporal en píxeles sin cambio | [CÓDIGO] |
| https://pypi.org/project/s1flood | Implementación del z-score de DeVries 2020 | [SNIPPET] |
| github.com/Fibananagucchi/EarthTrendTest | Solo advertencia cualitativa de potencia (umbral de 8 años) | [CÓDIGO] |
| github.com/shahriarkhansakib/Hritu (`src/compute/trend.py`, `Challanges/*.md`) | Pettitt sin transiciones; guía de terceros con diseños por defecto para los 14 desafíos | [CÓDIGO] |
| https://statistics.fas.harvard.edu/files/statistics-2/files/xlm_jgeophysres103-d14atmo_17149-17161_1998.pdf | Weatherhead 1998: años necesarios; los cambios de nivel suman ≥50 % | [SNIPPET] |
| github.com/dean50312-hub/space-mission-design-game | Carta "Mass Margin", evento de crecimiento de masa | [CÓDIGO] |
| github.com/Gxxrazn21/Juego_Nasa | `DESIGN_MARGIN = 0.10`; eventos por margen de consumibles | [CÓDIGO] |
| github.com/mariam2009m44-lab/mission-control | Advertencias de margen de potencia | [CÓDIGO] |
| github.com/Yoriichi-0u0/earth-fm | Sonificación de frames del EIC en tiempo real; sin pruebas con usuarios; frames de exhibición | [CÓDIGO] |
| https://www.frontiersin.org/news/2024/03/25/communication-nasa-scientists-space-data-sounds | Arcand 2024: 3.184 participantes, sighted y BLV | [SNIPPET] |
| https://uxpa.org/?p=3707 | Mapas meteorológicos sonificados evaluados con 5 usuarios ciegos | [SNIPPET] |
| https://ntrs.nasa.gov/citations/20240005553 | Lunar Browser de Ames: ventanas de aterrizaje con restricción de iluminación | [SNIPPET] |
| https://spacepolicyonline.com/news/im-2-mission-ends-one-day-after-lunar-landing/ | IM-2 terminó a las ~13 h en sombra | [SNIPPET] |

## 9. Pendientes

- Releer todo contra los enunciados del 28/10, sobre todo C09 (¿pide continuidad oficial? ¿autoría de CONAE?) y C14 (¿qué frames del EIC?).
- Red-team de C10 (3-A) y de C04 (4-B, elipse e iluminación) antes de usarlos como sustitutos.
- Confirmar con el Local Lead si contactar participantes para C14 antes del 14/11 es aceptable.
- Verificar la cobertura de NISAR (track y frame) sobre un AOI argentino con `asf_search` desde una red sin proxy.
