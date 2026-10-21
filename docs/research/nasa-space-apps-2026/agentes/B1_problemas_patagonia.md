# B1 — Problemas patagónicos reales que encajan en los 14 desafíos

Fecha: 21/10/2026. Agente B1 (segunda fase). Base: `BRIEF.md`, `01_INVENTARIO_14_DESAFIOS.md`, `09_RECOMENDACION_FINAL.md`.

## 0. Misión y alcance

- **Hipótesis a testear (no a confirmar):** un problema patagónico real, documentado y medible con datos NASA o de agencias socias, encajado en uno de los 14 desafíos, puede diferenciar al equipo ante el jurado local de Comodoro Rivadavia frente a equipos globales.
- **Qué no se hizo:** no se escribió código, no se descargaron datos y no se hizo ningún commit.
- **Límites:**
  - Se hicieron 33 llamadas a WebSearch (una falló por el límite de sesión) y 2 a WebFetch, que fallaron las dos con `ENOTFOUND` (revistas.unc.edu.ar y cholilaonline.ar).
  - **Casi todo lo que sigue es [SNIPPET]**: resúmenes del buscador, no lectura completa.
  - Los enunciados completos se publican el 28/10. Cualquier encaje con un desafío es [INFERENCIA] sobre el resumen del 17/09.

## 1. Contexto de la sede

- Comodoro Rivadavia es sede oficial **por tercer año consecutivo**. La organiza el Municipio, a través de la Agencia Comodoro Conocimiento, en el Centro de Encuentro de Km 8 [SNIPPET].
- En 2025 hubo 430 participantes, entre presenciales y virtuales, y se presentó como "la sede más austral del mundo" [SNIPPET].
- No se encontró a la UNPSJB como coorganizadora. Sí hay estudiantes de la UNPSJB entre los ganadores globales de 2023, con una app de mapeo lunar 3D [SNIPPET].
- **No se encontró la composición del jurado local ni sus criterios.** Que el jurado premie lo local es [INFERENCIA]. La categoría global "Local Impact" de 2025 (ver BRIEF) es el único apoyo indirecto.

## 2. Hallazgos por candidato

### 2.1 Deslizamiento del cerro Hermitte, enero de 2026 → C06 Dancing with the SARs

**Qué tan documentado está: muy documentado en prensa y con antecedentes técnicos.**
- El 18/01/2026 se evacuó a más de 90 familias de los barrios Sismográfica y El Marquesado (ladera sur del Hermitte). Hubo viviendas partidas y roturas de gas y agua. Según el municipio, el corrimiento abarcó **unos 1.500 m** [SNIPPET, noticiasnqn, canal26, diariodecuyo].
- El geólogo José Paredes (UNPSJB) dijo que el movimiento se detectó el **27/12/2025, con unos 15 m iniciales**, y que luego se extendió a un sector de 300–350 m [SNIPPET, cadena3].
- Hubo nuevos desplazamientos posteriores, con al menos 4 casas más destruidas [SNIPPET, rionegro.com.ar].
- **Antecedente:** un informe del **SEGEMAR de 2002** ya calificaba a Sismográfica como zona de alta peligrosidad geológica y recomendaba monitoreo permanente [SNIPPET, cronica.com.ar, diariojornada].
- Otros eventos en la ciudad:
  - Cerro Chenque: deslizamiento de 1995 que cortó la Ruta 3, con movimientos observados desde principios del siglo XX [SNIPPET, revista ASAGAI/UNC; autores y año no vistos].
  - Colapso de la Ruta 3 el 30/08/2023 [SNIPPET, lacapital].
  - Temporal del 29/03/2017 que afectó a San Cayetano, Moure, Ceferino y La Floresta [SNIPPET, La Gaceta, Río Negro]. La cifra de "232 mm" que circula **no se pudo verificar**.

**Usuarios locales:**
- Municipio y Defensa Civil.
- Centro de Estudios Geológicos y Ambientales de la UNPSJB, que describe desplazamientos lentos y persistentes en Altos del Km 3 [SNIPPET].
- SEGEMAR.
- Vialidad Nacional, por la Ruta 3.
- Vecinos. Se menciona una app "Grietas Comodoro" para reportar grietas: aparece en un titular de enero de 2026 [SNIPPET], pero una búsqueda directa no la confirmó.
- El municipio usa drones con la UNPSJB en Infiernillo, Chalet Huergo y Chenque [SNIPPET].

**Datos:**
- NISAR (banda L, NASA–ISRO): no se encontró evidencia de cobertura ni de productos sobre Comodoro [NO VERIFICADO].
- SAOCOM (CONAE, banda L): tiene antecedentes de InSAR de subsidencia en la cuenca neuquina (Euillades et al.) [SNIPPET].
- Sentinel-1 (ESA).
- NASA ARSET dictó en 2026 cursos sobre NISAR para deslizamientos [SNIPPET].

**¿Hay un estudio InSAR local?** **No encontrado.** Se hicieron 4 búsquedas en español e inglés (InSAR, Sentinel-1, SAOCOM, "imágenes satelitales Hermitte") y ninguna devolvió un estudio interferométrico del Hermitte ni del Chenque. "No encontrado" no significa que no exista.

**Encaje con C06:** alto en tema ("seguir y comunicar cambios de superficie"). Riesgo técnico alto [INFERENCIA]:
- La InSAR de fase mide movimientos de mm a cm. Un salto de 15 m en días **decorrelaciona** la señal. Para el evento mismo servirían pérdida de coherencia, amplitud u offset-tracking. Para la reptación previa o posterior y para otras laderas (Chenque, Km 3) sirven series InSAR.
- La pendiente pronunciada, la geometría de adquisición y el área urbana pueden dar layover o sombra.

**Qué NO se puede afirmar:**
- Que la InSAR "habría predicho" el evento.
- Que NISAR cubre el área con pares útiles antes y después del 27/12/2025.
- Que no existe trabajo local: puede haberlo en la UNPSJB o la CONAE sin indexar.
- Ninguna afirmación sobre la seguridad de viviendas: hay responsabilidad legal y familias evacuadas.

### 2.2 Secado del Colhué Huapi, sistema Musters–Senguer y polvo → C02 Trend Detective

**Qué tan documentado está: el mejor documentado de todos, con literatura científica y productos NASA.**

El lago:
- Superficie histórica de unos 800 km² y menos de 4 m de profundidad [SNIPPET, IAGLR]. Se secó por completo en la última década [SNIPPET, prensa].
- **Scordo et al. 2017** (Anuário do Instituto de Geociências, UFRJ) cruzó Landsat 1998–2013 con el índice de Palmer. Encontró retrocesos en 1998–2001 y 2007–2013 que coinciden con sequías [SNIPPET].
- **MDPI Water 2018 (10/7/889)** encontró que MODIS detecta mal el lago profundo (Musters) pero bien el somero. El área del Colhué Huapi varió entre 105 y 797 km², y el MNDWI fue el índice más preciso. El trabajo está también en el repositorio del CONICET (ri.conicet 11336/89650) [SNIPPET].

El polvo:
- **Gassó & Torres 2019**, JGR Atmospheres (NASA NTRS 20190002541), analizó 1964–2017 con observaciones sinópticas y aerosol satelital. Identificó períodos activos en 1970–76, 1989–94, 1996–97 y **1999–2017** [SNIPPET].
- La afirmación de un "aumento sostenido de días con polvo desde los 70" es de fuente secundaria (earth.com) [SNIPPET, no verificada contra el paper].
- NASA Earth Observatory publicó "Blowing in the Patagonian Wind" (04/04/2024, MODIS Aqua del 29/03/2024): el lecho es la principal fuente de polvo, con **15–30 eventos moderados o grandes por año** y un pico en verano [SNIPPET].

El agua:
- Un informe de emergencia hídrica del **CENPAT** (2022) dice que los caudales anuales del Senguer están **por debajo del promedio desde 2015** [SNIPPET].
- La Nación vincula el secado con el abastecimiento de agua a Comodoro Rivadavia [SNIPPET].
- Hay denuncias de tomas clandestinas y el IPA clausuró una derivación ilegal en 2014 [SNIPPET].

**Usuarios locales:** IPA Chubut, municipios de Sarmiento y Comodoro (agua y polvo en suspensión), productores del valle de Sarmiento y Defensa Civil y Vialidad por la visibilidad en la Ruta 3.

**Datos NASA:**
- Landsat (NASA/USGS) y HLS, para el área del lago a 30 m.
- MODIS/VIIRS, para área y aerosol.
- MERRA-2 (polvo), IMERG (lluvia), GRACE/GRACE-FO (almacenamiento, aunque la resolución es gruesa para una cuenca de este tamaño [INFERENCIA]) y POWER.

**Encaje con C02:** **muy alto** en "qué / dónde / cuánto / significancia". El hilo causal "menos caudal → lecho expuesto → más polvo sobre la ciudad" se puede medir con datos NASA [INFERENCIA].

**Qué ya existe:** los papers de 2017, 2018 y 2019 ya cuantificaron el área hasta 2013–2017. El aporte posible es actualizar hasta 2026, formalizar la significancia y cruzar con polvo y caudal.

**Qué NO se puede afirmar:**
- La atribución causal (extracción petrolera o agrícola frente a clima). Es un tema politizado: una de las fuentes es Izquierda Diario, con posición editorial.
- Datos de PM10 locales: no se encontraron mediciones.
- Que el "aumento" del polvo sea estadísticamente significativo: no se leyó el paper.

### 2.3 Incendios de la cordillera chubutense (2025 y 2026) y antorchas de gas → C09 MODIS/VIIRS (y C02)

**Qué tan documentado está: muy documentado en prensa, con cifras inconsistentes.**
- **Enero de 2025, Epuyén:** de más de 2.000 a más de 5.000 ha según el día; unas 200 viviendas evacuadas [SNIPPET].
- **Enero de 2026, Puerto Patriada / El Hoyo / Epuyén:**
  - Superficie: 6.000 ha según la Secretaría de Bosques, 11.970 ha según la gobernación y más de 12.000 ha según El Litoral [SNIPPET].
  - Hubo otro fuego en la zona de Los Alerces con más de 5.500 ha [SNIPPET, Página/12].
  - La fiscalía lo calificó de intencional [SNIPPET].
  - Hubo activación de la **International Disasters Charter n.º 1010** [SNIPPET].
- **Que las cifras de superficie difieran por un factor de 2 entre organismos ya es un problema documentable** [INFERENCIA].

**Usuarios locales:** Servicio Provincial de Manejo del Fuego, Secretaría de Bosques de Chubut, Parques Nacionales (Los Alerces), CIEFAP, municipios de la Comarca Andina y la fiscalía.

**Qué ya existe localmente:** la **CONAE tiene un visor de focos MODIS+VIIRS** con manual (catalogos5.conae.gov.ar, ediciones e01 de marzo de 2024 y e02) que incluye totalización de focos y áreas quemadas [SNIPPET]. Es un competidor directo local de un "calendario de quema".

**Antorchas en el Golfo San Jorge:**
- Existe VIIRS Nightfire, con un catálogo global de antorchas 2012–2019 [SNIPPET].
- **FIRMS incorporó en febrero de 2025 una capa de "Static Thermal Anomalies"** que separa antorchas e industria de los fuegos de vegetación [SNIPPET, wiki Earthdata].
- No se encontró ninguna cifra de antorchas en Chubut o Santa Cruz.
- El gas de la cuenca es de bajo valor [SNIPPET]. Que eso implique más venteo o quema es [INFERENCIA].

**Encaje con C09:** alto en tema, pero la investigación previa eliminó C09 por saturación (Kiln Watch, FireCal). El ángulo local "la Comarca Andina con un calendario fiable y las antorchas de la meseta filtradas" es diferenciable ante un jurado local, no ante uno global [INFERENCIA].

**Qué NO se puede afirmar:**
- Que las antorchas de la cuenca contaminan los conteos de manera material: no se midió.
- Que la máscara de FIRMS cubre o no esas antorchas.
- Superficies quemadas a partir de focos. La propia CONAE dice que los focos no dan hectáreas [SNIPPET].

### 2.4 Análogos patagónicos → C10

- **Precedente encontrado:** Rodriguez et al. 2010 (Geomorphology; registros en USGS y el repositorio del Smithsonian) compara *wind streaks* asociados a cráteres en Arabia Terra (Marte) con estelas que salen de **playas dentro de maares del sur de la Patagonia**, presumiblemente del campo Pali Aike [SNIPPET; la identificación con Pali Aike es INFERENCIA].
- Pali Aike tiene unos 467 centros eruptivos en 4.500 km², maares y vientos persistentes [SNIPPET].
- El estudio de Brockmann Consult sobre las estelas de viento de Pali Aike es divulgación, no un estudio de análogo [SNIPPET].
- La Bajada del Diablo tiene estructuras circulares enigmáticas, pero no se encontró uso como análogo [SNIPPET].
- **No se encontró ningún programa de análogos dedicado a la Patagonia.** Los análogos argentinos citados son de la Puna (Europlanet TA1) [SNIPPET].
- Las playas o lechos deflacionados como el del Colhué Huapi son un candidato eólico posible para Marte [INFERENCIA, sin literatura encontrada].

**Encaje:** medio y solo con Marte. A unos 46–52 °S **no sirve como análogo de base lunar polar** (iluminación) [INFERENCIA]. La frase del desafío "not entirely well characterized" favorece a sitios poco estudiados como estos.

**Usuario local:** débil, porque la comunidad de planetología de la región es incierta.

**Qué NO se puede afirmar:** que la Patagonia sea un "análogo reconocido por NASA".

### 2.5 Riego, rotación y sequía en el valle de Sarmiento y el VIRCh → C07 Field Shift

**Valle de Sarmiento:**
- Oasis de riego de unas 42.000 ha según Wikipedia [SNIPPET, cifra a verificar].
- Produce sobre todo alfalfa, además de frutales y hortalizas, con 80–100 mm de lluvia anual [SNIPPET].
- Depende del Senguer, con caudales bajo el promedio desde 2015 (CENPAT) y un mínimo exigido para el sistema de riego [SNIPPET].

**VIRCh:**
- El INTA documenta una **rotación con alfalfa, pasturas perennes y verdeos de cereales** [SNIPPET, INTA SIPAS].
- Riego gravitacional entre septiembre/octubre y marzo/abril, 180 mm de lluvia, suelos con limitaciones por salinidad y napa [SNIPPET].

**Usuarios:** INTA EEA Chubut, la AER VIRCh, el IPA, la Compañía de Riego del VIRCh [NO VERIFICADO el nombre] y productores.

**Encaje con C07:** medio. Hay rotación real, pero dominada por forrajeras. El dato limitante es el agua, no el clima del cultivo [INFERENCIA]. SMAP (9 km) es demasiado grueso para chacras; HLS/Landsat sí alcanza para la parcela.

**Qué NO se puede afirmar:** recomendaciones agronómicas sin el INTA. La validez de la rotación no se puede comprobar en 48 h.

### 2.6 Desertificación y sobrepastoreo ovino → C02 (o C07)

- El INTA identificó el sobrepastoreo, la extracción de leña y **los movimientos de suelo petroleros** como causas de deterioro. Es una fuente de 2000 [SNIPPET].
- El CENPAT lleva casi 40 años de estudios de pastoreo, incluidos collares GPS [SNIPPET].
- Existe la metodología **MARAS** de monitoreo [SNIPPET].
- El programa **Chubut Regenera** abarca 24 campos y 285.000 ha [SNIPPET, sin fecha].
- No se encontró monitoreo satelital reciente (2024–2025) ni emergencias por sequía de esos años.

**Encaje:** medio con C02 (tendencias de NDVI). La atribución entre pastoreo y clima no se resuelve con NDVI [INFERENCIA]. C07 no encaja: esto es ganadería extensiva, no rotación de cultivos.

### 2.7 Glaciares → C02 (débil)

- El Inventario Nacional de Glaciares (IANIGLA) tiene informes de 2018 para las cuencas Futaleufú, Senguer y Chubut. Carrenleufú-Pico suma 217 cuerpos y 10,38 km² [SNIPPET].
- No se encontraron series de retroceso en Chubut, ni siquiera del glaciar Torrecillas.
- **Encaje bajo:** los cuerpos son pequeños, hay que trabajar con Landsat y la competencia de estudios del IANIGLA es fuerte.

### 2.8 Accesibilidad en Comodoro → C14

- **Escuela Especial n.º 515 para alumnos ciegos y con baja visión**, en la calle San Martín de Comodoro Rivadavia. Tuvo actividad por el Día del Bastón Blanco en octubre de 2024, con Susana Ulloa como referente citada [SNIPPET, diariojornada]. También la reconoció una resolución de la Cámara de Diputados de 2007 [SNIPPET].
- En Rawson hay talleres de braille y movilidad [SNIPPET].
- **No se encontró** una asociación de ciegos ni una biblioteca parlante en Comodoro o Caleta Olivia.

**Implicancia para la condición de C14 en `09`** (conseguir de 3 a 5 participantes ciegos o con baja visión):
- Existe una institución local con la que hablar [INFERENCIA].
- **Pero los alumnos probablemente sean menores.** Eso exige autorización de los tutores y de la escuela y vuelve más compleja la prueba con personas.
- Docentes o egresados adultos serían más viables [INFERENCIA].
- Un tema sonificable con valor local sería el polvo del Colhué Huapi o la serie del lago [INFERENCIA].

### 2.9 Patrimonio espacial → C01

- La roca lunar de "buena voluntad" del Apolo 11 entregada a la Argentina está en el **Planetario de Buenos Aires** [SNIPPET, Tiempo Argentino]. No tiene vínculo patagónico.
- No se encontró equipamiento NASA ni patrimonio espacial relevante en Chubut.
- **Encaje local: nulo** con lo encontrado.

### 2.10 Desafíos sin problema patagónico plausible

C03, C04, C05, C08, C11, C12 y C13 no tienen un problema patagónico medible que encaje con su resumen [INFERENCIA, no se buscó a fondo]:
- **C08:** la cercanía temática con los incendios es superficial, porque el desafío trata de combustión en microgravedad.
- **C03 y C13:** una ambientación local (por ejemplo, logística antártica o patagónica) sería solo escenografía.
- Las bases antárticas argentinas como análogo para C05 o C03 no se investigaron.

## 3. Tabla por desafío

| ID | Mejor candidato patagónico | Documentación del problema | Usuario local | Datos NASA/socios (resolución) | Encaje con el resumen | Trabajo local existente | Fuerza del encaje |
|---|---|---|---|---|---|---|---|
| C01 | Ninguno (la roca lunar está en Buenos Aires) | Baja | — | — | Nulo | — | 0 |
| C02 | Colhué Huapi–Musters–Senguer + polvo sobre Comodoro | **Alta (3 papers + NASA EO)** | IPA, municipios de Sarmiento y CR, productores | Landsat/HLS 30 m, MODIS, MERRA-2, IMERG (suficiente para el lago) | Muy alto | Papers 2017–2019 (hasta 2013–2017) | **Fuerte** |
| C03 | — | — | — | — | Escenografía | — | 0 |
| C04 | — | — | — | — | Nulo | — | 0 |
| C05 | (Antártida, no investigado) | — | — | — | — | — | 0 |
| C06 | Cerro Hermitte (01/2026), Chenque, Km 3 | **Alta (prensa + SEGEMAR 2002 + UNPSJB)** | Municipio, Defensa Civil, UNPSJB, SEGEMAR, Vialidad | NISAR (cobertura NO VERIFICADA), SAOCOM, Sentinel-1 | Alto en tema; técnicamente difícil | No se encontró InSAR local; drones municipio+UNPSJB | **Fuerte (riesgo alto)** |
| C07 | Valle de Sarmiento / VIRCh (alfalfa + verdeos, agua limitante) | Media | INTA, IPA, productores | HLS/Landsat sí; SMAP 9 km no | Medio | INTA (ensayos, rotación) | Medio |
| C08 | — | — | — | — | Superficial | — | 0 |
| C09 | Calendario de quema de la Comarca Andina + antorchas de la cuenca del Golfo San Jorge | Alta (incendios); baja (antorchas) | SPMF, Bosques, PN Los Alerces, CIEFAP | FIRMS MODIS/VIIRS, capa estática 2025, VIIRS Nightfire | Alto | **Visor de focos de la CONAE** | Medio (localmente) |
| C10 | Maares de Pali Aike (*wind streaks*), playas deflacionadas | Media (1 paper 2010) | Débil | Copernicus DEM, Landsat; MOLA/CTX | Medio (solo Marte) | Rodriguez et al. 2010 | Medio |
| C11 | — | — | — | — | Nulo | — | 0 |
| C12 | — | — | — | — | Nulo | — | 0 |
| C13 | — | — | — | — | Escenografía | — | 0 |
| C14 | Escuela Especial 515 (ciegos y baja visión, CR) como socia de prueba | Media (existe la institución) | Alumnos, docentes | EIC + serie local (polvo/lago) | Alto si hay usuarios | — | Medio-alto (condicionado) |

## 4. Ranking de los encajes más fuertes [INFERENCIA]

1. **C02 + sistema Colhué Huapi–Musters–Senguer–polvo.**
   - Es el mejor documentado, con datos NASA verificables y resolución suficiente. NASA ya contó la historia (Earth Observatory 2024; Gassó & Torres, autores NASA).
   - El usuario es claro y el impacto llega a la ciudad sede (agua y polvo).
   - Riesgo: replicar papers existentes. Hay que aportar la actualización hasta 2026 y la significancia, sin atribuir causas.
2. **C06 + cerro Hermitte / laderas de Comodoro.**
   - Es el problema más saliente para un jurado local: es reciente, de la ciudad y con familias evacuadas. No se encontró InSAR local.
   - Pero tiene tres riesgos de datos y método: la cobertura NISAR no está verificada, el salto de varios metros decorrelaciona la fase y la topografía es urbana y empinada. También tiene riesgo ético (no sugerir predicción ni seguridad).
   - Necesita verificar antes del 14/11 que haya adquisiciones NISAR o Sentinel-1 sobre el área de interés. Eso es mirar catálogos, no descargar.
3. **C14 + Escuela 515** (refuerza la recomendación de `09`).
   - La institución existe en la ciudad.
   - La condición de usuarios adultos y con consentimiento sigue abierta.
   - Se puede combinar con contenido local (sonificar el polvo del Colhué Huapi).
4. **C09 + Comarca Andina / antorchas.** Hay necesidad local real, pero la CONAE ya tiene un visor MODIS+VIIRS y el desafío está saturado a nivel global.
5. **C10 + maares de Pali Aike.** Tiene precedente científico, pero el usuario local es débil y solo aplica a Marte.

**Sobre la hipótesis:** se sostiene parcialmente.
- Hay al menos dos problemas patagónicos documentados y medibles (lago y polvo; laderas de Comodoro) que los repos globales revisados no tocan [INFERENCIA, basada en que `01`/`09` solo citan AOI de Asia y globales].
- Pero ninguno elimina el riesgo de método. Que el jurado local valore lo local no está verificado.

## 5. Objeciones propias

- Casi toda la evidencia es de snippets, a veces de prensa con fechas inconsistentes en los encabezados.
- La ausencia de un estudio InSAR del Hermitte puede ser un artefacto del buscador (sin acceso a Google Scholar ni a los repositorios de la UNPSJB).
- C02 local puede verse como "un estudio de caso", no como una herramienta. El resumen pide responder qué, dónde, cuánto y significancia, cosa que un caso puede cumplir, pero la rúbrica es desconocida.
- Las regla de no trabajar antes del hackatón aplica: esto es investigación de contexto, no diseño de solución.

## 6. Búsquedas realizadas (33 WebSearch, 2 WebFetch fallidos)

1. Deslizamiento Hermitte + InSAR (es)
2. Colhué Huapi + satelital
3. Incendios Epuyén/El Hoyo/Cholila
4. Hermitte + Sentinel-1
5. InSAR Comodoro (en)
6. Temporal 2017 + Chenque
7. SAOCOM + Comodoro
8. Remoción en masa + UNPSJB
9. Colhué Huapi + Landsat + papers
10. Polvo + PM10
11. Antorchas + VIIRS Nightfire
12. FIRMS + fuentes estáticas
13. Análogo marciano en Patagonia (en)
14. Análogo + Pali Aike/Payunia (es)
15. Wind streaks / Bajada del Diablo
16. VIRCh + rotación
17. Desertificación + MARAS
18. CONAE/CIEFAP + severidad
19. Asociaciones de ciegos en CR/Caleta Olivia
20. Valle de Sarmiento (falló por el límite)
21. Escuela 515
22. Valle de Sarmiento + Senguer
23. NISAR en Argentina
24. Sede Space Apps de Comodoro
25. Glaciares de Chubut
26. Roca lunar en Argentina
27. Earth Observatory Colhué Huapi
28. Mapa de riesgo geológico de CR
29. Hermitte + radar
30. App "Grietas Comodoro"
31. Focos MODIS/VIIRS + CONAE
32. Gassó & Torres 2019

WebFetch: revistas.unc.edu.ar y cholilaonline.ar fallaron las dos con `ENOTFOUND`.

## 7. Fuentes

| URL | Qué afirma | Estado |
|---|---|---|
| https://www.noticiasnqn.com.ar/noticias/2026/01/18/326776-mas-de-90-familias-evacuadas-por-un-grave-desplazamiento-del-cerro-hermitte-en-comodoro-rivadavia | Más de 90 familias evacuadas; Sismográfica y El Marquesado | SNIPPET |
| https://www.diariodecuyo.com.ar/argentina/mas-de-90-familias-evacuadas-por-el-desplazamiento-del-cerro-hermitte-en-comodoro-rivadavia-1821596.html | Corrimiento de unos 1.500 m según el municipio | SNIPPET |
| https://www.cadena3.com/noticia/radioinforme-3/cerro-hermitte-un-geologo-advirtio-que-el-area-no-era-apta-para-urbanizar_510215 | Paredes: inicio el 27/12, 15 m, sector de 300–350 m | SNIPPET |
| https://www.rionegro.com.ar/sociedad/fuerte-explosion-el-cerro-desmoronado-de-chubut-volvio-a-desplazarse-y-destruyo-cuatro-casas-4451020/ | Nuevo desplazamiento, 4 casas destruidas | SNIPPET |
| https://www.cronica.com.ar/sociedad/esto-se-va-a-volver-a-caer-el-informe-que-anticipo-el-derrumbe-en-comodoro-rivadavia-y-la-advertencia-de-los-especialistas-20260119-0064.html | Informe del SEGEMAR de 2002: alta peligrosidad y monitoreo recomendado | SNIPPET |
| https://www.diariojornada.com.ar/409739/sapiens/un_informe_de_2002_revelaba_la_peligrosidad_geologica_en_comodoro | Ídem | SNIPPET |
| https://cholilaonline.ar/2026/01/riesgo-geologico-sismografica-comodoro.html | Informe de la UNPSJB; desplazamientos en Altos del Km 3 | SNIPPET (WebFetch falló) |
| https://cholilaonline.ar/2026/01/lanzan-grietas-comodoro-una-app-para-reportar-movimientos-del-suelo-en-la-ciudad.html | App "Grietas Comodoro" | SNIPPET (solo el título; una búsqueda directa no la confirmó) |
| https://revistas.unc.edu.ar/index.php/revista-asagai/article/download/45871/46042/188071 | Deslizamientos históricos del Chenque; 1995 corte de la Ruta 3 | SNIPPET (WebFetch falló) |
| https://www.lacapital.com.ar/informacion-general/colapso-la-ruta-3-comodoro-rivadavia-la-caida-un-cerro-n10086115.html | Colapso de la Ruta 3 (30/08/2023) | SNIPPET |
| https://www.lagaceta.com.ar/nota/723993/actualidad/videos-fuerte-temporal-convirtio-rios-calles-comodoro-rivadavia.html | Temporal del 29/03/2017 | SNIPPET |
| https://www.earthdata.nasa.gov/s3fs-public/2026-07/arset-2026-nisar-part2-spanish.pdf | ARSET 2026 NISAR (deslizamientos) | SNIPPET |
| https://www.eoportal.org/satellite-missions/saocom | SAOCOM, banda L, interferometría y desastres | SNIPPET |
| https://pubs.usgs.gov/publication/70256160 | Resumen global de InSAR con SAOCOM | SNIPPET (no confirmado que incluya Comodoro) |
| https://revistas.ufrj.br/index.php/aigeo/article/view/27103 | Scordo et al. 2017: Landsat 1998–2013, sequía y retroceso | SNIPPET |
| https://www.mdpi.com/2073-4441/10/7/889 | Water 2018: MODIS/MNDWI, Colhué Huapi entre 105 y 797 km² | SNIPPET |
| https://ri.conicet.gov.ar/handle/11336/89650 | Ídem en el repositorio del CONICET | SNIPPET |
| https://earthobservatory.nasa.gov/images/152649/blowing-in-the-patagonian-wind | Polvo del Colhué Huapi; 15–30 eventos al año | SNIPPET |
| https://ntrs.nasa.gov/api/citations/20190002541/downloads/20190002541.pdf | Gassó & Torres 2019: 1964–2017, períodos activos | SNIPPET |
| https://www.earth.com/image/dust-storm-across-the-central-patagonia-desert | "Aumento sostenido de días con polvo" (secundaria) | SNIPPET |
| https://cenpat.conicet.gov.ar/wp-content/uploads/sites/91/2022/03/Informe_Emergencia_Hidrica_Web1.pdf | Caudales del Senguer bajo el promedio desde 2015 | SNIPPET |
| https://www.lanacion.com.ar/sociedad/con-84-anos-sobrevive-en-el-lago-que-se-seco-para-dar-agua-a-comodoro-rivadavia-nid15032021/ | 810 km²; vínculo con el agua de Comodoro | SNIPPET |
| https://bichosdecampo.com/un-lago-ya-desaparecio-productores-del-sur-de-chubut-alertan-que-la-crisis-hidrica-compromete-no-solo-el-riego-sino-tambien-el-abastecimiento-de-agua-a-las-ciudades | Crisis hídrica, riego y ciudades | SNIPPET |
| https://en.wikipedia.org/wiki/Valle_de_Sarmiento | Oasis de unas 42.000 ha, alfalfa | SNIPPET |
| https://www.lanacion.com.ar/sociedad/incendios-en-chubut-viviendas-quemadas-y-devastacion-tambien-en-el-vallecito-el-loteo-que-ayer-fue-nid11012026/ | 2026: 6.000 ha (Bosques) frente a 11.970 ha (gobernación) | SNIPPET |
| https://disasterscharter.org/es/activations/wildfire-in-argentina-activation-1010- | Disasters Charter, Epuyén/El Hoyo | SNIPPET |
| https://www.pagina12.com.ar/2026/01/25/chubut-reenciende-todas-las-alarmas | Los Alerces, más de 5.500 ha | SNIPPET |
| https://catalogos5.conae.gov.ar/catalogofocos/Docs/035_CONAE_AQUA_TERRA_NOAA20_MODIS_VIIRS_FC_VISOR_ManualUsuarios_e02.pdf | Visor de focos MODIS+VIIRS de la CONAE | SNIPPET |
| https://wiki.earthdata.nasa.gov/spaces/FIRMS/blog/2025/02/28/425855667/FIRMS+incorporates+static+thermal+anomalies+data+to+help+users+differentiate+between+vegetation+and+non+vegetation+fires. | Capa de anomalías térmicas estáticas de FIRMS (02/2025) | SNIPPET |
| https://eogdata.mines.edu/download_global_flare.html | VIIRS Nightfire, antorchas globales | SNIPPET |
| https://pubs.usgs.gov/publication/70037501 | Rodriguez et al. 2010: *wind streaks* Arabia Terra frente a Patagonia | SNIPPET |
| https://www.europlanet-society.org/?p=14039 | Análogos argentinos en la Puna (no Patagonia) | SNIPPET |
| https://sipas.inta.gob.ar/sites/default/files/archivos/Evaluacion_cultivares_chacra_productor_VIRCh_0.pdf | Rotación alfalfa/pasturas/verdeos en el VIRCh | SNIPPET |
| https://repositorio.inta.gob.ar/xmlui/handle/20.500.12123/6878 | Tesis sobre pastoreo y MARAS en el suroeste de Chubut | SNIPPET |
| https://conicet.gov.ar/wp-content/uploads/destacadas-divulgacion/2012/11/Gacetilla-Chubut.-Analizan-el-impacto-del-pastoreo-ovino-en-la-Patagonia.pdf | CENPAT: pastoreo ovino, collares GPS | SNIPPET |
| https://www.glaciaresargentinos.gob.ar/wp-content/uploads/legales/informe_tecnico_2015.pdf | Carrenleufú-Pico: 217 cuerpos, 10,38 km² | SNIPPET |
| https://www.diariojornada.com.ar/380268/magazine/dia_del_baston_blanco_actividades_de_experiencias_vivenciales | Escuela Especial 515 de Comodoro (10/2024) | SNIPPET |
| https://www4.hcdn.gob.ar/dependencias/dcomisiones/periodo-125/125-2830.pdf | Resolución de 2007 sobre la Escuela 515 de CR | SNIPPET |
| https://www.tiempoar.com.ar/ta_article/lo-que-nos-quedo-de-la-luna-un-regalo-de-nixon-para-ongania/ | Roca lunar del Apolo 11 en el Planetario de Buenos Aires | SNIPPET |
| https://cholilaonline.ar/2026/10/nasa-space-apps-challenge-comodoro-rivadavia-2026.html | CR sede por tercer año, Km 8 | SNIPPET (WebFetch falló) |
| https://cholilaonline.ar/2025/10/nasa-space-apps-2025-comodoro-rivadavia-430-participantes.html | 430 participantes en 2025 | SNIPPET |

## 8. Pendientes

1. **C06:** verificar en el catálogo de ASF (sin descargar) si hay adquisiciones NISAR o Sentinel-1 sobre Comodoro entre 11/2025 y 03/2026. Consultar a la UNPSJB (Paredes, Centro de Estudios Geológicos y Ambientales) y a la CONAE si ya hay InSAR o SAOCOM del Hermitte.
2. **C02:** leer completos Scordo 2017, Water 2018 y Gassó & Torres 2019 para no repetirlos. Confirmar si existe una serie pública de niveles del Musters (IPA).
3. **C14:** contactar a la Escuela 515 y a la Dirección de Discapacidad del municipio para identificar participantes **adultos**, con la autorización del Local Lead (consulta Q7 de `08`).
4. Preguntar al Local Lead de Comodoro (Agencia Comodoro Conocimiento) si el jurado local tiene criterio de impacto local y quién lo integra.
5. Repetir todo después del 28/10: el enunciado completo puede fijar las AOI o los datos y anular estos encajes.
