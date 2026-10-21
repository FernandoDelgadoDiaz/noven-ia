# A5 — Originalidad y oportunidades no resueltas (NASA Space Apps 2026)

Fecha: 2026-10-21. Agente: A5. Sigue `agentes/BRIEF.md`.

## 1. Misión

Para cada desafío conocido, proponer hasta 3 **direcciones conceptuales** de diferenciación (no soluciones, no código), buscar alternativas existentes y necesidades no resueltas ("unmet needs") documentadas por usuarios reales, y separar **característica novedosa** de **ventaja competitiva real**.

Advertencias de partida:

- **No leí ningún enunciado oficial.** `spaceappschallenge.org` devuelve `CONNECT tunnel failed, response 403` por curl (probado una vez, 2026-10-21). Los enunciados completos salen el 28/10. Todo lo que sigue sobre el contenido de cada desafío es **[INFERENCIA] a partir del título**.
- Los títulos 8 ("Flame in Freefall"), 9 ("Harmonization of MODIS and VIIRS"), 10 ("Field Shift") y el desafío de sitios análogos **no aparecieron en ninguna búsqueda** que hice; sí aparecieron por fuente secundaria "Martian Map", "Earth Information Jukebox", "Abandoned but not Forgotten", el de salud de astronautas y el juego infantil de base lunar/marciana [SNIPPET]. Que no aparezcan no quiere decir que no existan.
- Todas las fuentes de este informe son **[SNIPPET]** (resumen del buscador). No pude abrir ninguna completa: nasa.gov, ntrs, arxiv y casi toda la prensa están bloqueados (WebFetch a startupcafe.ro: `ENOTFOUND`; curl a therecursive.com: 403). Ninguna afirmación de este informe está en estado [LEÍDO].
- Faltan 3 desafíos sin identificar. No los analizo.

## 2. Búsquedas realizadas (registro)

| # | Consulta (resumida) | Resultado útil |
|---|---|---|
| 1 | MODIS VIIRS active fire inconsistency duplicate harmonization fire managers | Sí: paper 2026 sobre fusión con corrección de duplicados; omisiones cruzadas MODIS/VIIRS; proyecto de armonización NASA (Boschetti) |
| 2 | CONAE focos de calor MODIS VIIRS falsos positivos brigadistas | Parcial: manual del visor de focos de CONAE; filtros de confianza >70 %; nada sobre brigadistas |
| 3 | Space Apps 2026 "Earth Information Jukebox" OR "Field Shift" | No confirma los títulos |
| 4 | Space Apps 2026 "Flame in Freefall" | No encontrado |
| 5 | Space Apps 2026 "Harmonization of MODIS and VIIRS" | No encontrado; sí la fecha de fin de MODIS |
| 6 | Space Apps 2026 "CLPS Lunar Mission Browser" | No encontrado; sí "Lunar Browser" (NASA Ames) |
| 7 | wildfire unmet needs satellite latency usability fire managers | Sí: taller de stakeholders NASA 2022, umbral de 3 h, testimonio NRCan |
| 8 | FIRMS "no detection does not mean no fire" overpass cloud | Sí: ARSET pide verificar a mano el paso del satélite y las nubes |
| 9 | INPE satélite de referência AQUA_M-T | **Sí, clave**: en 2026 INPE sigue usando Aqua MODIS como referencia |
| 10 | MODIS end of mission 2027 fire time series continuity | Sí: Terra ~ene/feb 2027, Aqua ~sep 2027; CAMS ya migra a VIIRS |
| 11 | INPE fim do Aqua novo satélite de referência | No encontré un anuncio de la transición |
| 12 | farmers barriers satellite data adoption | Sí: Murray-Darling, Ghana/Senegal, Países Bajos |
| 13 | OpenET/NASA Harvest farmer feedback | Solo material promocional |
| 14 | "Field Shift" Space Apps | No encontrado; NASA Acres FIAT |
| 15 | "Earth Information Jukebox" sonification | No encontrado; antecedentes de sonificación |
| 16 | Space Apps 2026 lista de 14 desafíos (extended) | Confirma Jukebox, Martian Map y Abandoned; nada más |
| 17 | spacecraft fire safety gaps NASA-STD-6001 Saffire | Sí: el Test 1 podría no ser el peor caso; no hubo comparación sistemática 1 g/µg |
| 18 | NASA PSI combustion data FLEX ACME reuse ML | Sí: ROSES E.12 financia reanálisis con IA de esos datos |
| 19 | exploration medical capability autonomous decision support | Sí: NASA CDS, brecha Medical-701, falta de requisitos definidos |
| 20 | wearables astronauts alarm fatigue explainable | No encontré nada específico sobre fatiga de alarmas |
| 21 | CLPS payload outcomes tracker | **No hay un rastreador consolidado de resultados por carga útil** (no encontrado) |
| 22 | lunar illumination comms planning tool CLPS Moon Trek | Moon Trek tiene iluminación y línea de vista; el software GRC es "U.S. Release Only" |
| 23 | catalog human artifacts Moon Mars For All Moonkind | Hay registro lunar (FAM, 2021); no encontré uno marciano |
| 24 | planetary analog sites database quantitative similarity | Sí: CAFE (ESA) es cualitativo; una revisión de 2013 dice que "no hay criterios definidos" |
| 25 | lunar south pole analog site criteria | Sin criterios de análogos |
| 26 | teachers barriers NASA resources | Encuesta de Texas: cuesta organizar y usar el contenido |
| 27 | space mission design serious game evaluation | Hay juegos serios (CONCEPTO, AeroQuest), sin evaluación rigurosa encontrada |
| 28 | Earth data sonification blind users evaluation | Hay estudios de mapas meteorológicos e iSonic; ninguno con datos climáticos |
| 29 | ISS smoke detector false alarms | Sí: falsas alarmas por polvo; el detector no ve el humo de teflón y kapton |
| 30 | crop suitability shift tools | USDA Future Crop Suitability (oeste de EE. UU., perennes), GAEZ, CropSuit, AgroClimate |
| 31 | Mars Trek traverse planning | El planificador de travesías se anunció en 2017; no confirmé que esté publicado |
| 32 | gas flares false alarms FIRMS static | **FIRMS ya incorpora una máscara de anomalías térmicas estáticas (feb 2025)** |
| 33 | SNMF Argentina validación de focos | No encontré nada del SNMF |
| 34 | Mission X Train Like an Astronaut | Programa NASA/ESA existente y masivo |
| 35 | Mars debris inventory | Catálogo informal de escombros EDL de Perseverance; cifra de "7,1 t" sin método verificado |
| 36 | harmonized MODIS VIIRS dedup open source / FEDS | FEDS (eventos con VIIRS); no encontré herramienta abierta de deduplicación cruzada |

## 3. Hallazgos por desafío

Notación: **N** = característica novedosa (nadie lo hace, que yo haya encontrado); **V** = ventaja competitiva real (alguien con una necesidad concreta lo elegiría frente a la alternativa). Una idea puede ser N sin ser V.

### 3.9 Harmonization of MODIS and VIIRS Hot Spots (título no verificado)

Contexto [SNIPPET]:
- NASA dejará de recolectar datos científicos de Terra MODIS (~ene/feb 2027) y de Aqua MODIS (~sep 2027) (LAADS; CAMS). CAMS incorporó VIIRS a su sistema GFAS el 4/12/2025 como "inicio de una transición gradual".
- Según los boletines diarios de INEMA (Bahía, con datos del INPE) de marzo a agosto de 2026, **INPE sigue usando AQUA_M-T (Aqua MODIS, pasada temprana de la tarde) como "satélite de referencia"** para las series históricas. El 19/08/2026 NOAA-20 registró 204 focos en Bahía y Aqua 25.
- No encontré un anuncio oficial de INPE sobre el reemplazo del satélite de referencia (búsqueda 11). Una fuente secundaria anticipa que "será sustituido por S-NPP", sin fecha.
- Las omisiones son cruzadas: VIIRS detecta mucho que MODIS no ve, y MODIS omite 35-53 % de lo que ve VIIRS en órbitas superpuestas (estudio 2020, [SNIPPET]). Una serie que cambie de sensor sin más muestra un salto aunque el fuego no cambie.
- Ya existe trabajo de armonización: un proyecto NASA (Boschetti) con una serie calibrada a 0,25°; un paper de 2026 que fusiona Aqua MODIS y S-NPP VIIRS corrigiendo duplicados; FEDS agrupa detecciones VIIRS en eventos.
- FIRMS ya publica una máscara de anomalías térmicas estáticas (industria, antorchas de gas), desde febrero de 2025.

**Dirección 9-A — "Puente de la serie de referencia" para organismos nacionales (INPE/CONAE)**
- *Problema y usuario:* cuando Aqua deje de operar, los organismos que publican conteos oficiales de focos contra un satélite de referencia (INPE seguro; CONAE [NO VERIFICADO]) pierden la comparabilidad interanual en la que se apoyan sus boletines, sus informes de prensa y las políticas públicas.
- *Por qué no alcanzan las alternativas:* la armonización de NASA es una grilla global de 0,25° pensada para el clima, no un empalme de conteos por provincia o bioma en el formato operativo de "satélite de referencia". El paper de fusión de 2026 busca un registro más completo, no la continuidad con la serie histórica de Aqua. No encontré un método de transición publicado por INPE.
- *Diferencia:* una función de transferencia Aqua→VIIRS estimada en los años de solapamiento (2018-2026) **por región y estación**, con la incertidumbre explícita, que muestra cuánto del "récord" o del "descenso" de 2027-2028 sería un artefacto del cambio de sensor. Evidencia: la diferencia de 8× del 19/08/2026 y las omisiones cruzadas documentadas.
- *¿Demostrable en 48 h?* Sí, acotado a 1-2 regiones (por ejemplo, el Delta del Paraná o el Chaco) con archivos FIRMS de MODIS y VIIRS. El riesgo está en el volumen de descarga y en elegir bien la región.
- *Afirmaciones que NO se pueden hacer:* que la serie empalmada mida la "actividad de fuego real"; que el factor sirva fuera de la región y el período calibrados; que INPE o CONAE lo necesiten o lo vayan a usar (no hay evidencia de demanda directa); que sea "la" solución de la transición.
- *Lo que invalidaría la oportunidad:* (a) que INPE o CONAE ya hayan publicado su método de transición o su nueva referencia; (b) que el enunciado del 28/10 pida otra cosa, como deduplicar en tiempo casi real; (c) que la relación Aqua/VIIRS sea tan inestable entre años que ninguna función de transferencia tenga un error aceptable (eso se puede comprobar en el hackatón y, en tal caso, es un resultado negativo que también vale contar).
- *N vs V:* **N probable y V plausible**. Es la oportunidad mejor anclada de todo el informe: tiene fecha (2027), usuario institucional identificado y un dato público que muestra el problema.

**Dirección 9-B — Capa de "silencio confiable": ¿hubo observación o no?**
- *Problema y usuario:* el brigadista o el analista ve "sin focos" y no sabe si el satélite pasó, si el lugar quedó en el borde de la franja o si había nubes o humo. ARSET (capacitación oficial de FIRMS, 2025) **pide verificarlo a mano** con las capas de órbita y la imagen en color verdadero. NASA documentó el caso de Jasper (2024), donde las nubes ocultaron el fuego.
- *Por qué no alcanzan las alternativas:* FIRMS muestra las trazas orbitales y el "tiempo desde la detección", pero no encontré un estado automático por lugar del tipo "observado sin fuego / no observado / observado con mala calidad" (búsqueda 8). [NO VERIFICADO] que no exista dentro de FIRMS o de un producto de nivel 2.
- *Diferencia:* convertir la ausencia de detección en tres estados explícitos, combinando MODIS y VIIRS (y quizá geoestacionarios).
- *¿Demostrable en 48 h?* Parcialmente. Las máscaras de nubes y la geometría de pasada exigen productos de nivel 2 pesados. Para una región y un evento conocido sí.
- *NO afirmar:* que reduzca el tiempo de respuesta; que "observado sin fuego" garantice que no haya fuego (pueden ser fuegos chicos o fríos por debajo de 375 m).
- *Invalidaría:* que el campo de "píxel no observado/nube" de los productos de nivel 2 ya se muestre en FIRMS o en el visor de CONAE.
- *N vs V:* N incierto, V real si no existe (la necesidad está documentada por la propia capacitación de NASA).

**Dirección descartada:** "filtrar falsos positivos industriales y antorchas". FIRMS ya lo cubre con la máscara de anomalías estáticas (feb 2025). Sería una característica repetida, sin ventaja.

### 3.8 Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data (título no verificado)

Contexto [SNIPPET]: Olson (NASA Glenn) sostiene que el Test 1 de NASA-STD-6001 (llama ascendente en 1 g) "puede no ser el peor caso" y que su relación con el riesgo real en el espacio "no se entiende". Otro trabajo dice que **"no hubo un intento sistemático de comparar resultados de 1 g con materiales ardiendo en microgravedad en condiciones comparables"**. Saffire mostró propagación sostenida sobre superficies grandes en baja gravedad. ROSES E.12 (PSI) financia reanálisis con IA/ML de FLEX, FLEX-2 y ACME. Los detectores de humo de la ISS se diseñaron sin datos de humo en microgravedad, dan falsas alarmas por polvo y el estudio NIST/NASA indica que "no detectan bien las partículas chicas de teflón y kapton", materiales típicos de la electrónica.

**8-A — Mapa de discrepancias 1 g vs µg por material y condición de flujo**
- *Problema y usuario:* ingenieros de seguridad de materiales que aprueban un material con el Test 1 sin saber en qué condiciones de flujo y oxígeno ese test deja de ser conservador.
- *Alternativas insuficientes:* según la fuente citada, la comparación sistemática no se hizo.
- *Diferencia:* reunir en una sola vista las condiciones en que hay datos de µg y de 1 g para el mismo material o familia, y marcar dónde se contradicen y dónde no hay datos.
- *¿48 h?* Depende de que el enunciado entregue datasets con materiales comparables (no lo sé hasta el 28/10). Si solo vienen gotas FLEX, no aplica.
- *NO afirmar:* que un material sea seguro o inseguro; que el modelo sustituya un ensayo; que haya "IA" si lo que se hace es tabular y comparar.
- *Invalidaría:* una comparación sistemática ya publicada después de 2018 (Saffire-IV a VI) que no encontré.
- *N vs V:* N plausible; V solo si los datos lo permiten.

**8-B — Detectar humo pequeño: qué haría falta para no ser ciego al teflón y al kapton**
- *Problema:* alertas tempranas en fuegos de electrónica. *Alternativa:* los detectores por dispersión de luz actuales. La evidencia es antigua (2004-2007) y [NO VERIFICADO] que siga sin resolverse.
- *¿48 h?* Solo si el dataset SAME (o equivalente) viene incluido. *NO afirmar:* que se mejoró un detector real. *Invalidaría:* que ya haya un detector corregido en servicio.
- *N vs V:* característica atractiva, ventaja incierta.

**8-C — Riesgo genérico (anotado):** "IA que predice la propagación de llama" sobre FLEX es lo que la mayoría hará con este título. **No es diferenciador** [INFERENCIA].

### 3.5 Create Health Monitoring Software for Astronauts on Space Missions

Contexto [SNIPPET]: NASA ya tiene un proyecto de Clinical Decision Support (brecha Medical-701) que integra contexto de insumos, equipos y salud del vehículo. Un paper IAC de 2021 dice que "no hay un conjunto claro de requisitos" para la atención médica independiente de la Tierra. Thales y la Université Laval construyen una base de conocimiento de condiciones médicas y una herramienta de priorización. Astroskin no tenía alertas en esa versión. No encontré literatura sobre fatiga de alarmas en tripulaciones (búsqueda 20).

**5-A — Monitoreo que declara su propia tasa de falsas alarmas**
- *Problema y usuario:* tripulación sin soporte en tiempo real (de 3 a 24 min de demora con Marte), con alertas que no se pueden consultar con el control de tierra.
- *Alternativas:* los prototipos de wearables, ISRO incluido, hablan de "sistema de alarma"; el único que menciona falsas alarmas es un blog promocional (Ontario Tech).
- *Diferencia:* que el producto muestre al usuario un presupuesto explícito de alarmas (cuántas falsas alarmas por semana espera con el umbral actual) y por qué se dispara cada alerta respecto de la línea base personal.
- *¿48 h?* Sí, con datos fisiológicos públicos o simulados. Hay que decirlo así.
- *NO afirmar:* validez clínica; detección de condiciones médicas; uso en vuelo.
- *Invalidaría:* que los datos del enunciado no tengan etiquetas de eventos (sin etiquetas no se puede estimar la tasa de falsas alarmas).
- *N vs V:* N moderado; V baja frente a un jurado salvo que la demostración sea muy clara.

**5-B — Decisión médica con inventario finito**
Diferencia: recomendar sabiendo qué insumos y qué capacidad diagnóstica quedan a bordo. **NASA CDS ya lo plantea**, así que no es N. Solo vale como marco narrativo.

### 3.4 CLPS Lunar Mission Browser

Contexto [SNIPPET]: hay una página de entregas CLPS (JSC) con páginas por misión, pero **no encontré un balance consolidado de resultados por carga útil** (búsqueda 21). Los resultados fueron muy dispares: Peregrine no alunizó, pero sus cargas encendieron; IM-1 volcó y operó unos 7 días; IM-2 terminó a las ~13 h por quedar en sombra y MAPP no se desplegó; Blue Ghost 1 fue un éxito con 10 cargas. Moon Trek tiene iluminación y línea de vista. El software de sitios de GRC es solo para EE. UU. NASA Ames tiene un "Lunar Browser" de trayectorias (CLPS y Artemis), quizá relacionado con el título.

**4-A — Libro mayor de resultados por carga útil**
- *Usuario:* investigadores principales (PI) de futuras cargas CLPS, analistas de política espacial, periodistas.
- *Diferencia:* unidad de análisis = la carga útil, no la misión: encendió, operó en tránsito, operó en superficie, entregó datos y dónde están publicados, con la fuente de cada estado.
- *¿48 h?* Sí (unas 10 misiones; curación manual con citas).
- *NO afirmar:* tasas de éxito de proveedores con significación estadística (n muy chico); "datos oficiales" si se toman de prensa.
- *Invalidaría:* que el enunciado del 28/10 ya traiga un dataset así o que NASA publique uno.
- *N vs V:* N probable; V media (útil, pero con poco "wow" técnico).

**4-B — Sensibilidad de la iluminación a la dispersión del alunizaje**
- *Problema:* IM-2 terminó por quedar en sombra, en un cráter. ¿Cuánto cambian las horas de sol y la línea de vista con la Tierra dentro de la elipse de aterrizaje?
- *Alternativas:* Moon Trek calcula iluminación por punto. No encontré un análisis que integre la elipse.
- *¿48 h?* Arriesgado: hace falta un DEM LOLA de alta resolución y calcular horizontes. Solo para un sitio precalculado.
- *NO afirmar:* que habría salvado IM-2; precisión operativa.
- *Invalidaría:* que las herramientas de proveedores (LunaRay) o de NASA ya lo hagan; es probable que sí internamente [INFERENCIA]. Por eso V baja frente a profesionales y media como herramienta educativa o pública.

### 3.3 Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars

Contexto [SNIPPET]: el catálogo CAFE (ESA) prioriza con criterio experto y cualitativo. La revisión de 33 sitios análogos (Int. J. Astrobiology, 2013) afirma que **"no hay criterios claramente definidos y seguidos para evaluarlos"** y que hace falta una base de datos abierta global. MASS (NASA, años 90) usó teledetección con prueba ciega.

**3-A — Índice de analogía transparente y descomponible**
- *Usuario:* planificadores de campañas de campo análogas y de ensayos de equipos.
- *Diferencia:* puntuación por variable (pendiente, albedo, temperatura, iluminación por latitud, geoquímica disponible) con el peso visible y editable. Responde "¿análogo en qué?", no un único número.
- *¿48 h?* Sí, con pocas variables globales (DEM, MODIS LST, albedo) y un objetivo lunar o marciano definido.
- *NO afirmar:* que sea un análogo "validado"; que la similitud remota implique fidelidad operativa (polvo, regolito, vacío y radiación no tienen análogo terrestre).
- *Invalidaría:* que exista un índice cuantitativo publicado; mi búsqueda no fue exhaustiva (no busqué "analogue similarity index").
- *N vs V:* N moderado, V moderada. La justificación documental es buena.

**3-B — Análogos de iluminación del polo sur lunar (sol rasante y sombras largas)**
- Problema: el sol bajo y las sombras largas del polo sur (de ahí las "dramatic lighting conditions" que NASA describe en sus materiales de Moon Base). Diferencia: buscar en la Tierra lugares y fechas con geometría solar y relieve comparables para ensayar visión y navegación. *¿48 h?* Sí, conceptualmente simple. *NO afirmar:* equivalencia térmica ni de vacío. N probable, V incierta.

### 3.2 Abandoned but not Forgotten (equipos descartados en la Luna y Marte)

Contexto [SNIPPET]: For All Moonkind publicó en 2021 un registro lunar gratuito con objetos por misión. Para Marte no encontré un catálogo equivalente (búsqueda 35). Hay un catálogo operativo informal de escombros EDL de Perseverance (unas 6 piezas en Hogwallow Flats, al sol 508) y una cifra popular de "15.694 libras" sin método verificado.

**2-A — Gazetteer marciano con nivel de certeza por objeto**
- Diferencia: cada objeto marcado como observado en una imagen identificada, inferido o desconocido, con su fuente. Responde con honestidad a "¿qué sabemos realmente que está ahí?".
- *¿48 h?* Sí (curación, mapa y narrativa).
- *NO afirmar:* masa total precisa; exhaustividad.
- *Invalidaría:* que ya exista un catálogo de Marte (por ejemplo, de UNOOSA o de algún académico) que no encontré.
- *N vs V:* N probable. V ligada a la categoría Best Storytelling; utilidad práctica baja.

**2-B — Del objeto al relato:** contar la historia del equipo que siguió funcionando o que sirvió para la ciencia después del abandono (retrorreflectores de Apolo, por ejemplo). Es narrativo, de diferenciación débil; muchos equipos lo harán [INFERENCIA].

### 3.6 Build a Junior Astronaut Mission Trainer

Contexto [SNIPPET]: Mission X (NASA/ESA, 8-12 años, 15.000 niños en 2013) ya existe y es masivo. En la encuesta de Texas (316 docentes), el contenido en línea resultó difícil de usar por falta de organización y fue difícil encontrar actividades que desarrollen el pensamiento crítico.

**6-A — Entrenador listo para el aula**, sin conexión y en castellano, con una actividad de 40 min, una rúbrica y una pregunta de pensamiento crítico basada en datos reales. La diferencia está en lo que reclaman los docentes, no en la tecnología. *¿48 h?* Sí. *NO afirmar:* que haya mejoras de aprendizaje (no se puede medir en 48 h). *Invalidaría:* que Mission X ya ofrezca exactamente eso en castellano. N baja, V baja-media.

### 3.7 Space Mission Design Game

Contexto [SNIPPET]: hay juegos serios de ingeniería de sistemas (CONCEPTO, con 105 estudiantes; AeroQuest, ASEE 2009; Decision Pathways). No encontré una evaluación rigurosa.

**7-A — Juego donde se puntúa la gestión de márgenes** (masa, potencia, datos) con presupuestos de misiones reales, y donde el fallo se explica según el margen que se consumió. *¿48 h?* Sí. *NO afirmar:* fidelidad de ingeniería; resultados educativos. N baja, V baja: es un espacio con muchos juegos [INFERENCIA].

### 3.10 Field Shift: Adapting Farms with NASA Data (título no verificado)

Contexto [SNIPPET]: hay herramientas de aptitud futura de cultivos: USDA Future Crop Suitability (solo oeste de EE. UU. y perennes; promedio de 20 GCM), FAO GAEZ (supuestos de manejo), FAO CropSuit y AgroClimate (variabilidad, no proyección). Barreras documentadas en Murray-Darling: exceso de información, dificultad para traducir datos en decisiones, desconfianza en las imágenes y frecuencia de revisita inadecuada. En Ghana y Senegal: falta de smartphones (20 % de los hombres y 3 % de las mujeres en el norte de Ghana) y de alfabetización digital.

**10-A — "Lo que ya cambió en tu campo" (observado) antes que "lo que cambiará" (proyectado)**
- *Problema:* la desconfianza y la incertidumbre de los modelos frenan la adopción. Un registro observado de 20-40 años (NASA POWER, MODIS LST, SMAP) del propio lote sobre heladas, ondas de calor y ventana de siembra es verificable por el productor con su memoria.
- *Alternativas:* las herramientas citadas se centran en proyecciones o no cubren el Cono Sur [INFERENCIA, no verificado para Argentina: no busqué herramientas del INTA].
- *¿48 h?* Sí, para una región.
- *NO afirmar:* recomendaciones de cultivo; rendimientos; que el cambio observado vaya a continuar.
- *Invalidaría:* que existan herramientas del INTA o SMN equivalentes (no buscadas; **pendiente**).
- *N vs V:* N moderado; V plausible por la evidencia de desconfianza.

**10-B — Salida para productores sin smartphone** (SMS o radio rural). Responde a una barrera documentada. Es difícil de demostrar con usuarios reales en 48 h. N moderado, V real pero poco demostrable.

### 3.11 The Earth Information Jukebox

Contexto [SNIPPET]: la sonificación tiene antecedentes en Chandra, EGU 2023 y en un equipo de Space Apps 2018 ("Artify the Earth"). Hay estudios con usuarios ciegos sobre mapas meteorológicos (5 usuarios), iSonic (7) y Susurrus (12), pero **no encontré evaluaciones con datos climáticos** (búsqueda 28).

**11-A — Sonificación que se evalúa con personas ciegas o con baja visión dentro del propio hackatón**
- La diferencia no está en el sonido sino en presentar una prueba pequeña (n = 2-5), con una tarea concreta como "¿subió o bajó la anomalía?" y la tasa de acierto. Casi nadie en un hackatón mide [INFERENCIA].
- *¿48 h?* Solo si el equipo consigue participantes. Es un riesgo logístico.
- *NO afirmar:* validez estadística; "accesible" en general.
- *Invalidaría:* que el enunciado apunte a lo artístico y no a la accesibilidad.
- *N vs V:* V real en categorías como Galactic Impact o Art & Technology, condicionada a conseguir participantes.

### 3.1 Interplanetary Survival Guide: Martian Map

Contexto: el brief registra ≥10 repos públicos de equipos 2026 sobre Jezero, rutas, O₂ y 3D. El planificador de travesías de Mars Trek se anunció en 2017 y no confirmé que se haya publicado [SNIPPET].

**1-A — Mapa que muestra dónde no se puede confiar en él**
Mostrar, junto a la ruta, la incertidumbre de transitabilidad debida a la resolución del DEM. La motivación es el resultado negativo E1 (con CTX a 20 m la penalización por pendiente no reduce la exposición real). Es N frente a los repos vistos [INFERENCIA, no auditado], pero: (a) el brief pide no darle peso a ASTRA; (b) **riesgo de reglas**: usar un análisis previo podría chocar con "no empezar a trabajar antes del hackatón" (la redacción completa del FAQ no está leída). V baja por la saturación del desafío.

## 4. Objeciones propias

1. **Todo descansa en snippets.** Ninguna fuente fue leída completa. Algunas cifras (el 8× de Bahía, las fechas de fin de MODIS, "no hay comparación sistemática 1 g/µg") pueden estar mal resumidas por el buscador.
2. **"No encontré" no es "no existe".** Hice 1-3 búsquedas por tema, en inglés y a veces en castellano o portugués. Cada "N probable" debe revalidarse.
3. **Los enunciados del 28/10 pueden cambiar todo.** Si "Harmonization" pide deduplicar en tiempo casi real y no continuidad de series, la dirección 9-A pierde encaje.
4. **El sesgo hacia lo documentable** favorece los desafíos de la Tierra con literatura de usuarios (incendios, agro) sobre los creativos o educativos, donde las necesidades se documentan menos. No implica que esos sean peores para ganar.
5. **No verifiqué la autoría de CONAE** en el desafío 9; la dirección 9-A se apoya en INPE (Brasil), no en CONAE.
6. **Ventaja ≠ premio.** Premios como Storytelling o Most Inspirational pueden favorecer direcciones de V práctica baja.

## 5. Conclusiones

- **La oportunidad mejor anclada:** 9-A, el puente de la serie de referencia ante el fin de Aqua MODIS. Tiene necesidad fechada (sep 2027), usuario institucional identificable (INPE; CONAE sin verificar), dato público del problema (AQUA_M-T sigue siendo la referencia en 2026; 25 vs 204 focos un mismo día), alternativas que no apuntan a ese uso, y se puede demostrar en 48 h sobre una región. La demanda directa no está verificada.
- **Segundo nivel:** 9-B (silencio confiable; la necesidad está en la propia capacitación ARSET), 4-A (libro mayor por carga útil CLPS; no encontré nada consolidado), 3-A (índice de analogía descomponible; hay una brecha de criterios documentada) y 8-A (discrepancias 1 g/µg, solo si los datos del enunciado lo permiten).
- **Características sin ventaja:** filtrar fuentes industriales (FIRMS ya lo hace), decisión médica según inventario (NASA CDS), juegos y entrenadores educativos (Mission X, juegos serios existentes), rutas en Marte (desafío saturado).
- Los desafíos educativos y artísticos pueden ganar por categoría aunque su "unmet need" sea débil. Este informe no mide eso.

## 6. Tabla de fuentes (todas [SNIPPET] salvo indicación)

| URL | Qué afirma | Estado |
|---|---|---|
| https://www.ba.gov.br/inema/sites/site-inema/files/2026-08/Boletim%20Di%C3%A1rio%20de%20Focos%20de%20Calor%20%2820-08-2026%29.pdf | Satélite de referencia = AQUA_M-T; NOAA-20 204 vs Aqua 25 focos (19/08/2026, Bahía) | SNIPPET |
| https://dataserver-coids.inpe.br/queimadas/queimadas/Infoqueima/2025/2025_09_infoqueima.pdf | INPE usa ~200 imágenes por día de 11 satélites; solo el de referencia para comparar | SNIPPET |
| https://ladsweb.modaps.eosdis.nasa.gov/learn/modis-to-viirs-transition/ | Fin de recolección: Terra feb 2027, Aqua sep 2027 | SNIPPET |
| https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system | CAMS incorpora VIIRS desde el 4/12/2025; fechas de fin de MODIS | SNIPPET |
| https://mdpi-res.com/d_attachment/remotesensing/remotesensing-18-01650/article_deploy/remotesensing-18-01650.pdf | Fusión de Aqua MODIS y S-NPP VIIRS con corrección de duplicados (2026) | SNIPPET |
| https://modis.gsfc.nasa.gov/sci_team/meetings/202204/presentations/session1/boschetti.pdf | Proyecto de armonización MODIS/VIIRS, serie calibrada a 0,25° | SNIPPET |
| https://www.mdpi.com/2072-4292/13/9/1627/htm (u otro de la búsqueda 1) | Omisiones cruzadas MODIS/VIIRS | SNIPPET (atribución exacta no verificada) |
| https://www.earthdata.nasa.gov/s3fs-public/2026-06/arset-firmsintro2025-homework.pdf | Verificar a mano la pasada y las nubes ante la falta de detección | SNIPPET |
| https://www.earthdata.nasa.gov/news/blog/impact-cloud-cover-active-fire-detections | Las nubes y el humo impiden detectar (Jasper) | SNIPPET |
| https://wiki.earthdata.nasa.gov/spaces/FIRMS/blog/2025/02/28/425855667/ | FIRMS incorpora una máscara de anomalías térmicas estáticas | SNIPPET |
| https://cce.nasa.gov/firesense/documents/NASA_Wildfire_Stakeholder_Workshop_Findings_Summary-10122022.pdf | Los gestores piden menor latencia; combustibles con 2 años de latencia | SNIPPET |
| https://cabinradio.ca/153790/news/environment/wildfires/from-space-a-new-system-will-help-canadians-fight-wildfires/ | NRCan: los datos pierden valor táctico en un par de horas | SNIPPET |
| https://catalogos5.conae.gov.ar/catalogofocos/Docs/035_CONAE_AQUA_TERRA_NOAA20_MODIS_VIIRS_FC_VISOR_ManualUsuarios_e02.pdf | Visor de focos de CONAE con MODIS y VIIRS | SNIPPET |
| https://link.springer.com/article/10.1038/s41597-022-01343-0 | FEDS: eventos de fuego a partir de VIIRS | SNIPPET |
| https://ntrs.nasa.gov/citations/20170001636 (y otros de la búsqueda 17) | El Test 1 podría no ser el peor caso; no hubo comparación sistemática 1 g/µg | SNIPPET (atribución exacta por URL no verificada) |
| https://science.nasa.gov/physical-sciences-informatics-psi/nasa-psi-research-opportunity/ | ROSES E.12: reanálisis con IA/ML de FLEX y ACME | SNIPPET |
| https://www.techbriefs.com/component/content/article/32872-nist-nasa-study-shows-one-detector-doesn-t-fit-all-for-smoke-in-spacecraft | El detector de la ISS falla con el humo de teflón y kapton | SNIPPET |
| https://spaceflightnow.com/station/stage5a1/010319falsealarm | Falsa alarma por polvo en Destiny (2001) | SNIPPET |
| https://ntrs.nasa.gov/citations/20220017856 | NASA Clinical Decision Support; contexto de insumos | SNIPPET |
| https://iafastro.directory/iac/paper/id/63236/abstract-pdf/IAC-21,A1,4,7,x63236.brief.pdf | No hay requisitos claros para atención independiente de la Tierra | SNIPPET |
| https://www.thalesgroup.com/en/news-centre/press-releases/thales-and-universite-laval-improve-astronauts-medical-autonomy-future | Base de conocimiento médica y priorización | SNIPPET |
| https://external.jsc.nasa.gov/clps-landing-sites | Páginas por misión CLPS | SNIPPET |
| https://spacepolicyonline.com/news/im-2-mission-ends-one-day-after-lunar-landing/ | IM-2 terminó a las ~13 h por la sombra | SNIPPET |
| https://software.nasa.gov/software/LEW-20529-1 | Software GRC de sitios lunares, "U.S. Release Only" | SNIPPET |
| https://ntrs.nasa.gov/api/citations/20240005553/downloads/Lunar%20Browser%20trajectory%20tool_SMD_workshop.pdf | Lunar Browser (Ames), aplicado a CLPS y Artemis | SNIPPET |
| https://www.space.com/for-all-moonkind-moon-registry | Registro lunar de For All Moonkind (2021) | SNIPPET |
| https://science.nasa.gov/blogs/images-of-edl-debris | Escombros EDL de Perseverance catalogados | SNIPPET |
| https://core-cms.cambridgecore.org/core/services/aop-cambridge-core/content/view/244C9EB88B74D6905133DD2228DD3112/S1473550413000396a.pdf/planetary-habitability-lessons-learned-from-terrestrial-analogues.pdf | No hay criterios definidos; hace falta una base de datos abierta de análogos | SNIPPET |
| https://www.esa.int/Our_Activities/Preparing_for_the_Future/Discovery_and_Preparation/Cataloguing_otherworldly_landscapes_on_Earth | CAFE: criterio experto cualitativo | SNIPPET |
| https://uh-ir.tdl.org/items/08e45177-43e9-44bb-ad22-76dd6ba8febe/full | Docentes de Texas: el contenido en línea es difícil de usar | SNIPPET |
| https://iafastro.directory/iac/archive/browse/IAC-11/E1/7.-A1.8/11043/ | Piloto de Mission X | SNIPPET |
| https://peer.asee.org/5655 | AeroQuest, juego serio de diseño aeroespacial | SNIPPET |
| https://uxpa.org/?p=3707 | Sonificación de mapas meteorológicos con 5 usuarios ciegos | SNIPPET |
| https://www.cs.umd.edu/projects/hcil/audiomap | iSonic, 7 usuarios ciegos | SNIPPET |
| https://www.climatehubs.usda.gov/hubs/northwest/tools/future-crop-suitability-tool | Aptitud futura de cultivos: perennes, oeste de EE. UU. | SNIPPET |
| https://eprints.qut.edu.au/239856/1/Marshall_RURAL_DATA_DIVIDES.pdf (o fuente de la búsqueda 12) | Barreras en Murray-Darling | SNIPPET (atribución exacta no verificada) |
| https://www.tropentag.de/2025/abstracts/posters/126.pdf | Barreras en Ghana y Senegal; posesión de smartphones | SNIPPET |
| https://meetingorganizer.copernicus.org/EPSC2017/EPSC2017-99.pdf | Planificador de travesías de Mars Trek anunciado (2017) | SNIPPET |
| https://www.spaceappschallenge.org/2026/challenges/ | Enunciados oficiales | **Bloqueado (403)** |

## 7. Pendientes

1. Releer los 14 enunciados el 28/10 y descartar o ajustar cada dirección. Prioridad: confirmar que existen los desafíos 8, 9, 10 y el de análogos, y quién propone el 9.
2. Comprobar si INPE o CONAE publicaron un método de transición de la serie de referencia (sitio de Queimadas, Infoqueima 2026, CONAE). Esto valida o invalida 9-A.
3. Comprobar si FIRMS o el visor de CONAE ya muestran un estado de "no observado" (invalida o valida 9-B).
4. Buscar herramientas del INTA y el SMN sobre cambios agroclimáticos observados (10-A).
5. Buscar "analogue similarity index" (3-A) y Saffire-IV a VI con conclusiones sobre el Test 1 (8-A).
6. Identificar los 3 desafíos faltantes.
7. Leer completo el FAQ sobre trabajo previo (afecta a 1-A y a cualquier reutilización).
