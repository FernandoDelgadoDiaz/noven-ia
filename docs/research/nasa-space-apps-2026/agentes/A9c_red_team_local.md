# A9c — Red team de los candidatos "locales" (sede Comodoro Rivadavia)

Fecha: 21/10/2026. Agente: A9c. Mandato: intentar **refutar y eliminar** tres candidatos locales (L1, L2, L3) y la premisa de que "el jurado de Comodoro valora lo local". No recibí preferencias.

Etiquetas (BRIEF): **[LEÍDO]** · **[CÓDIGO]** (leí el archivo en un clon) · **[SNIPPET]** · **[INFERENCIA]** · **[NO VERIFICADO]**.

Base leída: BRIEF, B1, B2, B3, A10 (§3 C06 y §4 C02), A9, 09.

---

## 1. Método y límites

- **33 WebSearch** (cupo ≤40). 1 WebFetch a `hyp3-docs.asf.alaska.edu`, que falló (`ENOTFOUND`).
- `curl` a `cmr.earthdata.nasa.gov`, `asf.alaska.edu`, `forum.earthdata.nasa.gov`, `ntrs.nasa.gov`, `mdpi.com` y `api.crossref.org` fue rechazado por el proxy (`connect_rejected`). **No pude consultar el catálogo NISAR ni leer ningún paper completo.** Todo lo que digo sobre papers y sobre NISAR es [SNIPPET].
- Clones `--depth 1 --filter=blob:none --no-checkout` en `/tmp/claude-0/-home-user-noven-ia/7029a718-8690-52ad-a08e-e11704dd6284/scratchpad/redteam3/`, solo lectura con `git show` y `git ls-tree`:
  - `mahdimahmud2006-coder/nasa_space-apps_challenge` (TerraPulse). Último commit: 14/10/2026.
  - `shahriarkhansakib/Hritu`. Último commit: 14/10/2026. Contiene una guía de terceros con los 14 desafíos.
- No escribí código de solución, no descargué datos y no hice commits.

---

## 2. L1 — C06 Dancing with the SARs + cerro Hermitte (Comodoro, enero de 2026)

### 2.1 Ataques

**A1. Lo más probable es que no haya NISAR sobre el evento al 14/11.**
- **BETA no es global.** El release BETA de febrero de 2026 fue "a sampling of locations around the world", no una cobertura global. Un usuario del foro de Earthdata encontró que faltaban pasadas ascendentes sobre Ecuador [SNIPPET, ASF notice + foro Earthdata p=26091/26356]. B2 suponía que BETA "cubre el período previo al evento". **Eso no está sostenido:** no hay evidencia de que Comodoro esté en la muestra.
- **PROVISIONAL empieza el 17/06/2026,** cinco meses después del evento (17–18/01/2026). Solo ve el movimiento residual.
- **El primer año se libera "en los próximos meses", con el registro completo "a fines de 2026"** [SNIPPET]. Puede que los datos de enero a junio aparezcan antes del 14/11, o puede que no [NO VERIFICADO]. **No se puede planificar con eso.**
- **Modo sobre Sudamérica:** una diapositiva de la misión muestra "Background Land 20 MHz" como modo estándar fuera de Norteamérica y zonas urbanas. En la pasada descendente, Sudamérica alterna cada 12 días con África [SNIPPET, diapositivas JPL 2023]. [INFERENCIA]: es probable que la resolución sea menor que la de 40 MHz y que, en una de las dos geometrías, el revisit efectivo sea de 24 días. No verifiqué tracks ni frames sobre Comodoro: los KMZ y el catálogo están bloqueados.

**A2. Físicamente, el evento no se mide con interferometría de fase.**
- Según la prensa, el movimiento inicial fue de unos 15 m (27/12/2025). El frente tiene unos 1.500 m y el sector activo, 300–350 m. Hubo viviendas destruidas [SNIPPET, B1].
- La fase se pliega (*aliasing*) cuando la deformación dentro de un píxel alcanza más o menos media longitud de onda [SNIPPET, Frontiers 2021]. En banda L (λ ≈ 24 cm) eso son unos 12 cm de gradiente por píxel entre adquisiciones [INFERENCIA]. Un salto de metros en días **decorrela**: el resultado sería un mapa de pérdida de coherencia o de cambio de amplitud, no un desplazamiento.
- Offset tracking tolera gradientes grandes, pero es menos preciso y empeora con superficies que cambian [SNIPPET]. A la resolución de GCOV/GUNW, con casas demolidas y obras de emergencia, no da metros fiables [INFERENCIA].
- **GUNW a 80 m:** el sector de 300–350 m ocupa unos 4 píxeles y el frente de 1,5 km, unos 19. Alcanza para "algo pasó acá", no para caracterizar.
- **Ionósfera:** la propia documentación PROVISIONAL dice que los productos "generally meet … requirements in lower-latitude areas". En latitudes medias pueden quedar residuos ionosféricos, sobre todo en las pasadas descendentes (de tarde) [SNIPPET, product-known-issues]. Comodoro está a unos 45,9 °S.
- **Lo que sí es medible en principio:** la reptación posterior, que un geólogo describe como de "velocidad baja" [SNIPPET, Diario Jornada]. Pero solo con series largas y coherentes. Entre junio y noviembre de 2026 habría como mucho unas 12 adquisiciones por geometría, y en una ladera urbana con demoliciones [INFERENCIA].

**A3. El "hueco" InSAR local es más chico de lo que dicen B1 y B2.**
- Euillades et al. (UNCuyo/CONICET), conferencia de 2018: **Sentinel-1 SBAS de octubre de 2014 a marzo de 2018** sobre el yacimiento **Piedra Clavada (cuenca del Golfo San Jorge)**. Encontraron más de 10 cm de subsidencia [SNIPPET, biblioteca IAPG Conexplor 2018]. Ya hay InSAR publicado en la cuenca de Comodoro. Sobre el Hermitte o el Chenque **no encontré** ninguno (3 búsquedas nuevas, más las 4 de B1 y las 3 de B2).
- Un geólogo local ya mostró **imágenes satelitales** con la reactivación y expansión de un frente delimitado 22 años antes. No se sabe qué sensor [SNIPPET, Diario Jornada 409713].
- El municipio trabaja con drones junto a la UNPSJB [SNIPPET, B1]. Los geólogos de la UNPSJB y del CONICET (Paredes, Richiano) tienen datos de campo mejores que un producto de 80 m.
- **Riesgo de jurado [INFERENCIA]:** si entre los mentores o jurados hay geólogos de la UNPSJB o del CONICET, van a evaluar con un estándar más alto justamente el tema que mejor conocen.

**A4. "Desastre local + antes/después" es el diseño por defecto.**
- La guía de terceros que circula entre equipos (`Hritu/Challanges/16-challenge-06-dancing-with-the-sars.md`) [CÓDIGO] propone para C06 un desastre local real con un *swipe* antes/después y un número en km². Dice: "Impact and Relevance are almost free if you pick a real [local] flood". También recomienda **descargar las escenas antes del evento**.
- Que el lugar sea local no diferencia el diseño. Lo que diferencia es el lugar elegido, y eso es copiable por cualquier equipo de Comodoro [INFERENCIA].
- **TerraPulse ya hace deslizamientos con NISAR:** tiene `config.landslide.json`, `data/context/landslide/nasa_glc_study_subset.csv` y `data/derived/nepal_case_01/landslide/*`. Usa un "Landslide Susceptibility Index" con topografía, lluvia y modificadores de radar, evaluado contra el NASA Global Landslide Catalog. Usa GCOV, no GUNW [CÓDIGO, README y árbol de archivos].
- No encontré ningún repo 2026 con NISAR sobre Argentina (2 búsquedas nuevas, más las de B2).

**A5. Riesgo ético y legal.** Hay unas 300 familias afectadas y una emergencia geológica declarada [SNIPPET]. Cualquier mapa que se lea como "esta zona es estable" o "esto se podía predecir" es una afirmación que el equipo no puede respaldar. Además expone a la sede a un conflicto público.

### 2.2 Qué se podría mostrar honestamente en 48 h [INFERENCIA]

1. **Si el 14/11 a la mañana `asf_search` muestra ≥4 GCOV PROVISIONAL de la misma órbita y frame sobre Comodoro desde el 17/06:**
   - un mapa de estabilidad de backscatter y coherencia de **todas** las laderas urbanas (Hermitte, Chenque, Km 3), contra un control de terreno estable;
   - rotulado como "zonas donde el radar ve cambio por encima del ruido", **no** como riesgo.
2. **Contraste con Sentinel-1** (12 días, ambas geometrías en Patagonia según un paper de 2020 [SNIPPET]; archivo desde 2014; InSAR a demanda vía HyP3 con Earthdata Login):
   - es la única vía realista para mirar la reptación **previa** al evento;
   - es dato ESA, no NASA, y el desafío está centrado en NISAR.
3. **Qué no se puede mostrar:** desplazamiento co-evento en metros, predicción, ni seguridad de viviendas.

### 2.3 Veredicto L1: **SOBREVIVE CON CONDICIONES (muy débil)**. Como "medir el deslizamiento del Hermitte con NISAR" queda **ELIMINADO**.

- **Condiciones de supervivencia (todas):**
  1. ≥4 GCOV PROVISIONAL o GUNW de la misma órbita y frame sobre Comodoro, verificado con `asf_search` el 14/11 (o antes, solo como consulta de catálogo).
  2. Alguien del equipo con experiencia real en SAR.
  3. Reformularlo como "qué ve y qué no ve el radar en las laderas de Comodoro", sin causa ni riesgo.
  4. Un geólogo mentor (UNPSJB o CONICET) que lo revise durante el evento.
- **Invalidación:**
  - no hay frames NISAR sobre Comodoro;
  - el enunciado del 28/10 trae escenas curadas;
  - un equipo de la sede con más SAR elige el mismo caso;
  - el Local Lead desaconseja tocar un tema con familias evacuadas.
- **Efecto en la recomendación:** **no la mejora.** C06 sigue tercero. El caso Hermitte agrega impacto local, pero también agrega riesgo de datos (BETA no global), de física (decorrelación) y de ética.

---

## 3. L2 — C02 Trend Detective + Colhué Huapi / Musters / Senguer / polvo sobre Comodoro

### 3.1 Ataques

**A1. El lago está seco: su tendencia reciente es trivial.**
- Según la prensa, el Colhué Huapi se secó por completo hacia 2017. Otra nota dice que "hace cinco años" (2021) solo se veía tierra blanca [SNIPPET, Río Negro; Bichos de Campo]. No encontré ninguna recuperación en 2025–2026 (1 búsqueda).
- Una serie de área del lago 2017–2026 es casi cero. "Actualizar hasta 2026" no agrega información sobre el lago [INFERENCIA].
- La señal interesante es la de antes de 2017, y esa ya está publicada:
  - Scordo et al. 2017: Landsat 1998–2013 + índice de Palmer.
  - Water 2018 (MDPI 10/7/889): MODIS frente a Landsat, área de 105 a 797 km², MNDWI. **Ese paper ya compara instrumentos** (MODIS falla en el Musters profundo y acierta en el lago somero) [SNIPPET].

**A2. El ángulo "¿tendencia real o cambio de instrumento?" ya lo trabajaron los autores del polvo.**
- **Gassó & Torres 2019** (JGR, NASA GSFC) armaron un registro de 1964 a 2017 con **dos fuentes independientes**: códigos sinópticos de superficie y el **UV Aerosol Index de TOMS y OMI desde 1978**. Encontraron períodos activos en 1970–76, 1989–94, 1996–97 y 1999–2017 [SNIPPET].
- La serie TOMS→OMI es justamente una serie con transición de instrumento, y el registro sinóptico independiente sirve de control [INFERENCIA]. **No pude leer el paper** para ver si analizan explícitamente la costura TOMS/OMI [NO VERIFICADO].
- **Cosentino, Gaiero & Lambert 2021** (JGR 126(16), doi 10.1029/2020JD034459) ya vinculan polvo con **déficit hídrico de largo plazo**, con visibilidad, flujo de masa y reanálisis [SNIPPET]. La cadena causal "menos agua → más polvo" que B1 proponía como aporte **ya está publicada**.
- **Gassó et al., EGU21:** evaluación de AOD MODIS Dark Target y Deep Blue contra visibilidad de aeropuertos en Patagonia [SNIPPET]. Es la comparación satélite frente a independiente para el período MODIS.
- **Consecuencia:** hecho sobre 1964–2017, el proyecto es "repetir papers". El único espacio que queda es **2017–2026** (ver 3.2).

**A3. Monitoreo operativo: no encontrado. Es un hueco chico.**
- No encontré un monitoreo satelital operativo del IPA, de Recursos Hídricos de Chubut, del INTA ni del CENPAT (1 búsqueda nueva más las de B1).
- La CONAE tiene solo material educativo, una imagen Landsat 8 de 2014 [SNIPPET].
- Que no se encuentre no prueba que no exista.

**A4. Riesgo político y de jurado.**
- Las causas están en disputa: tomas ilegales, riego, petroleras, acueducto a Comodoro, clima. Las fuentes van desde Izquierda Diario hasta entrevistados que dicen "90 % cambio climático" [SNIPPET].
- En un jurado con perfil industrial (la UNPSJB tiene vínculos con la industria petrolera; un ganador comodorense de 2023 fue becario de PAE [SNIPPET, B3]), cualquier atribución es un riesgo.
- **El proyecto debe decir explícitamente que no atribuye causas.**

**A5. Competencia.** No encontré ningún repo 2026 sobre un lago patagónico, el Colhué Huapi o la Argentina en C02 (1 búsqueda nueva más las 2 de B2). La guía de terceros para C02 no menciona transiciones de instrumento [CÓDIGO, grep sin resultados para instrument/sensor/transition/homogen]. Que el ángulo D1 sea el por defecto **no** está demostrado.

### 3.2 ¿Hay transiciones de instrumento reales en el período 2000–2026? Sí [dato conocido/INFERENCIA; fechas NO VERIFICADAS aquí salvo las marcadas]

| Variable | Producto NASA | Transición o artefacto en el período |
|---|---|---|
| Área de agua | Landsat 5/7/8/9 (y HLS) | L7 SLC-off desde 2003 (Water 2018 lo cita como limitación [SNIPPET]); L5→L8 en 2013; L9 en 2021 |
| Área de agua / AOD | MODIS Terra/Aqua | Deriva de Terra desde 2022 (FireCal la documenta [CÓDIGO, A9]); fin de Terra en feb-2027 y de Aqua en sep-2027 (A9 V2) |
| AOD | MODIS DB/DT → VIIRS DB | Cambio de sensor S-NPP (desde 2012) → NOAA-20/21; S-NPP deja de entregarse el 1–2/11/2026 (A9 V1) |
| Índice de aerosol UV | TOMS → OMI → OMPS | Hueco de TOMS a mediados de los 90; anomalía de filas de OMI (conocida, NO VERIFICADA aquí) |
| Polvo (reanálisis) | MERRA-2 | Asimila AOD de MODIS: **no es independiente** del satélite que se quiere auditar |

**Única fuente independiente plausible:** la visibilidad o los códigos SYNOP de las estaciones, por ejemplo el aeropuerto de Comodoro, vía NOAA ISD [INFERENCIA; disponibilidad NO VERIFICADA]. Es el mismo diseño de control que usaron Gassó & Torres y Cosentino.

### 3.3 Veredicto L2: **SOBREVIVE CON CONDICIONES**, solo si se reformula. Como "tendencia del área del Colhué Huapi" queda **ELIMINADO**.

- **Condiciones:**
  1. La variable central tiene que ser el **polvo sobre Comodoro, 2004–2026** (OMI/OMPS, MODIS→VIIRS DB, MERRA-2 rotulado como reanálisis). El área del lago queda solo como contexto.
  2. La pregunta es "¿cambió el polvo desde que el lago se secó, o cambió el sensor?", con un control de superficie independiente.
  3. Hay que citar a Gassó & Torres 2019 y a Cosentino 2021 como punto de partida, no esconderlos.
  4. Sin atribución causal.
  5. El enunciado del 28/10 no restringe la región ni la variable.
- **Invalidación:**
  - leer Gassó & Torres o un trabajo posterior a 2019 muestra que ya extendieron la serie después de 2017 con OMPS o VIIRS;
  - no hay datos de visibilidad de superficie accesibles;
  - el enunciado entrega datos homogeneizados o globales fijos.
- **Efecto en la recomendación:** **mejora levemente a C02 ante el jurado local** (lugar con nombre propio, usuario en la ciudad sede, Local Impact). No cambia nada a nivel global. No desplaza a C14.

---

## 4. L3 — C14 Jukebox con participantes de Comodoro

### 4.1 Ataques y hallazgos

**A1. "Solo hay una escuela con menores" es falso: hay canales para adultos.** [SNIPPET]
- **Audioteca "Leer Escuchando"**, en la Biblioteca Pública y Popular municipal de Comodoro. La creó la ordenanza 981/11 y produce libros parlantes. Su responsable, Javier Ruiz, es una persona no vidente que se incorporó en 2009 y seguía al frente en octubre de 2024. Participa en actividades del Día del Bastón Blanco junto al **Centro "Luis Braille"** (proyecto del Senado S-4172/18; nota de 10/2024). La ubicación del Centro Luis Braille no está verificada.
- **Asociación Civil "Infinito Espacio Urbano"**: talleres de música, danza y teatro para personas con discapacidad visual en Comodoro (nota de 2022; vigencia no verificada). Que el taller sea de **música** es relevante para la sonificación [INFERENCIA].
- **Vecinos no videntes adultos** que reclamaron por las veredas (Diario Jornada 380742) [SNIPPET, solo el titular].
- **Escuela Provincial 515:** "ciento dos alumnos" (documento de la Cámara de Diputados de 2007; no es una cifra actual).
- Rawson tiene un taller de braille para mayores de 18 años (08/2025) y Trelew un centro de rehabilitación visual. Están a unos 380 km [SNIPPET].
- **Caleta Olivia:** no encontré nada (1 búsqueda).

**A2. Riesgo ético con menores: alto. Hay que excluirlos.**
- Probar con alumnos de la Escuela 515 exige consentimiento de los tutores, autorización de la escuela y probablemente del Ministerio de Educación provincial, todo para un fin de semana [INFERENCIA].
- A8/A9 indican que **no se pueden mostrar menores en el video** [SNIPPET vía A8].
- Con el canal adulto disponible, **no hay razón para incluir menores**. Recomendación: solo adultos, con consentimiento escrito, sin rostro en el video salvo autorización, registro anónimo.

**A3. Logística.**
- El Centro de Encuentro Km 8 queda fuera del centro. El traslado de personas ciegas un sábado tiene que estar resuelto (transporte y acompañante) [INFERENCIA].
- Probar fuera de la sede (por ejemplo, en la Biblioteca) puede no estar permitido si el equipo tiene que estar presente: hay que preguntarlo al Local Lead [NO VERIFICADO].

**A4. ¿El foso sigue en pie?** Sí, frente al diseño por defecto.
- La guía de terceros para C14 dice que la accesibilidad es "the argument" y propone "Test with the screen off" [CÓDIGO, `Hritu/Challanges/24-…jukebox.md`]. No propone probar con personas ciegas.
- El argumento de accesibilidad es el por defecto. La prueba con usuarios reales no lo es.
- Sigue en pie el ataque de A9: la novedad es relativa a Space Apps, no al campo (Arcand 2024).

### 4.2 Veredicto L3: **SOBREVIVE CON CONDICIONES**, y la condición es **más alcanzable** de lo que decía B1.

- **Condiciones:**
  1. Antes del 7/11, 3 a 5 adultos ciegos o con baja visión confirmados por escrito a través de la Audioteca, Espacio Urbano o el Centro Luis Braille, con el Local Lead informado (consulta Q7).
  2. Ningún menor.
  3. Transporte resuelto.
  4. Prueba sobre los frames del EIC.
- **Invalidación:**
  - ningún adulto disponible el fin de semana;
  - el Local Lead no autoriza;
  - el enunciado del 28/10 prioriza lo artístico.
- **Efecto en la recomendación:** **la refuerza. C14 sigue primero.**
  - Un contenido local sonificado (polvo sobre Comodoro) solo vale si cabe dentro de "frames del EIC". Si no, es un agregado secundario.

---

## 5. Premisa: "el jurado de Comodoro valora lo local"

**Veredicto: NO VERIFICADA. Tratarla como desempate, no como base.**

- **Evidencia directa: ninguna.** Hice 4 búsquedas nuevas sobre ganadores, temas y equipos de Comodoro 2024 y 2025, y ninguna los nombra. B3 hizo 16 con el mismo resultado.
- **Sobre la convocatoria 2026:** un titular de Cholila Online del 14/10/2026 sugiere que el municipio "invita a vecinos a aportar ideas" [SNIPPET, solo el titular; reportado por el buscador, sin texto]. Si se confirma, sería el **único indicio** de interés por problemas locales [NO VERIFICADO].
- **Indicios en contra o neutros:**
  1. Los ganadores argentinos globales de 2022 y 2023 no trataban temas locales (B3).
  2. El premio local es una visita a INVAP, el Balseiro y el CAB. Los mentores son de INVAP, CONAE, CONICET y la UNPSJB. Eso sugiere un sesgo hacia la vocación tecnológica y espacial, no necesariamente hacia lo local [INFERENCIA].
  3. La guía de terceros ya enseña que elegir un caso local hace que "Impact and Relevance [sean] casi gratis" [CÓDIGO]. Si muchos equipos de la sede siguen esa heurística, **lo local deja de diferenciar dentro de la sede**: pasa a ser el piso, no el techo [INFERENCIA].
- **Acción:** preguntar al Local Lead (Comodoro Conocimiento) por los criterios, los ganadores 2024–2025 con sus temas y la composición del jurado. Es la consulta más barata (B3 §6.3).

---

## 6. Efecto neto sobre `09`

| Candidato | Veredicto | ¿Cambia el orden? |
|---|---|---|
| L3 C14 Comodoro (adultos) | Sobrevive con condiciones; la condición es más alcanzable | **C14 sigue 1.º y se refuerza** |
| L2 C02 polvo sobre Comodoro (no lago) | Sobrevive con condiciones si se reformula; el lago como tendencia queda eliminado | C02 sigue 2.º; la variante local es opcional ante el jurado local |
| L1 C06 Hermitte | Muy débil; como medición NISAR del deslizamiento queda eliminado | C06 sigue 3.º o baja; no reemplaza a ninguno |
| Premisa "lo local premia" | No verificada | No debe decidir el desafío |

## 7. Objeciones propias

- No pude consultar ASF/CMR. La ausencia de BETA sobre Comodoro es una inferencia a partir de "sampling of locations", no una verificación. Es posible que Comodoro esté en la muestra.
- No leí ningún paper completo. La afirmación de que Gassó & Torres "ya responden" la pregunta de instrumento es [INFERENCIA] a partir del diseño (TOMS/OMI + SYNOP).
- Los canales para adultos de C14 vienen de notas de 2018–2024. Pueden no estar activos.
- El titular de la convocatoria 2026 a vecinos no se pudo abrir.

## 8. Tabla de fuentes

| URL / ruta | Qué afirma | Estado |
|---|---|---|
| https://asf.alaska.edu/notices/nisar-l-band-data-now-publicly-available/ | PROVISIONAL desde el 17/06/2026; registro completo a fines de 2026 | [SNIPPET]; curl rechazado |
| https://forum.earthdata.nasa.gov/viewtopic.php?p=26356 | BETA = "sampling of locations around the world"; el release calibrado será global | [SNIPPET]; curl rechazado |
| https://forum.earthdata.nasa.gov/viewtopic.php?p=26091 | Faltan pasadas ascendentes sobre Ecuador en BETA | [SNIPPET] |
| https://hyp3-docs.asf.alaska.edu/nisar-docs/availability-overview/ | Disponibilidad NISAR | WebFetch ENOTFOUND |
| https://nisar-docs.asf.alaska.edu/provisional-known-issues/ | Salvedad de bajas latitudes; degradación en altas latitudes | [SNIPPET] |
| https://nisar-docs.asf.alaska.edu/product-known-issues | Residuos ionosféricos en latitudes medias, pasadas descendentes | [SNIPPET] (página de la era BETA) |
| https://www.earthdata.nasa.gov/data/alerts-outages/nisar-l-band-data-now-publicly-available | Operación científica desde ene-2026; el primer año se libera en los meses siguientes | [SNIPPET] |
| https://nisar.jpl.nasa.gov/documents/75/8-NISAR_Rosen_Countdown_to_NISAR_v4.pdf | Background Land 20 MHz; descendente alternando Sudamérica/África | [SNIPPET] |
| https://www.frontiersin.org/journals/earth-science/articles/10.3389/feart.2021.724965/full | Aliasing con ~½ λ por píxel | [SNIPPET] |
| https://dspace.ncl.ac.uk/jspui/handle/10443/5868 | Offset tracking frente a InSAR con gradientes grandes | [SNIPPET] |
| https://biblioteca.iapg.org.ar/ArchivosAdjuntos/Conexplor2018/SDH/1437.pdf | Euillades et al.: Sentinel-1 SBAS 2014–2018; Piedra Clavada (Golfo San Jorge), >10 cm de subsidencia | [SNIPPET] |
| https://revistas.unc.edu.ar/index.php/revista-asagai/article/download/45871/46042/188071 | Estabilización del Chenque (2017), sin InSAR visible | [SNIPPET] |
| https://diariojornada.com.ar/409713/magazine/geologo_se_sabia_que_era_una_zona_de_alto_riesgo_geologico | Geólogo con imágenes satelitales: reactivación del frente; velocidad baja | [SNIPPET] |
| https://www.lmneuquen.com/patagonia/derrumbe-comodoro-rivadavia-ya-son-300-los-evacuados-mientras-la-tierra-todavia-se-mueve-n1225240/amp | 300 evacuados, "la tierra todavía se mueve" | [SNIPPET] |
| https://isprs-annals.copernicus.org/articles/IV-3-W2-2020/137/2020/ | Sentinel-1: 12 días en Patagonia, ascendente y descendente | [SNIPPET] |
| github.com/mahdimahmud2006-coder/nasa_space-apps_challenge | Índice de susceptibilidad a deslizamientos con GCOV + NASA GLC, caso Nepal | [CÓDIGO] (README y árbol) |
| github.com/shahriarkhansakib/Hritu `Challanges/16-…sars.md` | Diseño por defecto: desastre local + swipe; descargar antes del evento | [CÓDIGO] |
| github.com/shahriarkhansakib/Hritu `Challanges/24-…jukebox.md` | Accesibilidad como argumento; "Test with the screen off" | [CÓDIGO] |
| github.com/shahriarkhansakib/Hritu `Challanges/12-…trend-detective.md` | Sin mención de transiciones de instrumento | [CÓDIGO] (grep) |
| https://ntrs.nasa.gov/api/citations/20190002541/downloads/20190002541.pdf | Gassó & Torres 2019: SYNOP 1964–2017 + UV-AI TOMS/OMI 1978–2017 | [SNIPPET]; curl rechazado |
| https://ri.conicet.gov.ar/handle/11336/173879 | Cosentino, Gaiero & Lambert 2021: polvo y déficit hídrico de largo plazo | [SNIPPET] |
| https://meetingorganizer.copernicus.org/EGU21/EGU21-7805.html | Gassó et al.: AOD MODIS DT/DB frente a visibilidad en Patagonia | [SNIPPET] |
| https://acp.copernicus.org/articles/10/8287/2010/ | Emisión de polvo desde las orillas del Colhué Huapi (feb-2005), multisensor | [SNIPPET] |
| https://www.mdpi.com/2073-4441/10/7/889 | MODIS frente a Landsat; 105–797 km²; limitación de L7 | [SNIPPET]; curl rechazado |
| https://revistas.ufrj.br/index.php/aigeo/article/download/27103/14786 | Scordo 2017: Landsat 1998–2013 | [SNIPPET] |
| https://www.rionegro.com.ar/voy-turismo/colhue-huapi-el-enorme-lago-de-la-patagonia-que-desaparecio-donde-esta-y-como-llegar-3868379/?amp=1 | Seco por completo en 2017; el Musters retrocede | [SNIPPET] |
| https://bichosdecampo.com/un-lago-ya-desaparecio-productores-del-sur-de-chubut-alertan-que-la-crisis-hidrica-compromete-no-solo-el-riego-sino-tambien-el-abastecimiento-de-agua-a-las-ciudades | "Hace cinco años se secó por completo" | [SNIPPET] |
| https://www.argentina.gob.ar/ciencia/conae/educacion-y-formacion-masiva/materiales-educativos/lagos-musters-y-colhue-huapi-chubut-landsat-8-oli-26-de-septiembre-de-2014 | Material educativo de la CONAE (Landsat 8, 2014) | [SNIPPET] |
| https://ar.vlex.com/vid/proyecto-declaracion-expresa-beneplacito-906503854 | Audioteca "Leer Escuchando", ordenanza 981/11, Javier Ruiz | [SNIPPET] |
| https://www.diariojornada.com.ar/322426/magazine/crecer_desde_el_arte_con_los_ojos_del_corazon | Espacio Urbano: talleres para personas con discapacidad visual | [SNIPPET] |
| https://www.diariojornada.com.ar/380742/magazine/no_videntes_piden_que_reparen__veredas_para_circular_mejor | Vecinos no videntes adultos en Comodoro | [SNIPPET] (titular) |
| https://www4.hcdn.gob.ar/dependencias/dcomisiones/periodo-125/125-2830.pdf | Escuela 515: 102 alumnos (2007) | [SNIPPET] |
| https://cholilaonline.ar/2025/08/rawson-mantiene-abiertas-las-inscripciones-al-taller-de-braille-y-movilidad-para-personas-con-discapacidad-visual.html | Taller para mayores de 18 en Rawson | [SNIPPET] |
| https://cholilaonline.ar/2026/10/nasa-space-apps-challenge-comodoro-rivadavia-2026.html | Sede 2026; posible convocatoria a vecinos | [SNIPPET] (solo el titular) |

## 9. Búsquedas (33)

1–4. InSAR/Sentinel-1/SAOCOM sobre Comodoro, Hermitte y Chenque (es/en); informe técnico del Hermitte.
5–8. Plan de observación NISAR en Sudamérica; cobertura de GUNW BETA; ionósfera PROVISIONAL; decorrelación y offset tracking.
9–11. Subsidencia en la cuenca del Golfo San Jorge; Euillades y Lomas del Cuy; geólogo e imágenes satelitales del Hermitte.
12–13. Repos 2026 de NISAR con deslizamientos o "Dancing with the SARs".
14–21. Colhué Huapi: Landsat reciente, Gassó & Torres, papers 2023–2025, monitoreo IPA, MERRA-2 y polvo, repos 2026, Cosentino 2021, estado en 2026.
22–26. Ciegos y baja visión en Comodoro y Caleta Olivia; Centro de Rehabilitación; Audioteca.
27–30. Ganadores de Comodoro 2024 y 2025; equipos de la sede; convocatoria 2026.
31–33. Velocidad del Hermitte; primeras imágenes NISAR en Sudamérica; cobertura de Sentinel-1 en Patagonia.

## 10. Pendientes (sin trabajar en la solución)

1. **El participante, desde su red:** consultar con `asf_search` o Vertex (sin descargar) si hay frames NISAR BETA o PROVISIONAL sobre Comodoro, y si ya se liberó enero–junio de 2026.
2. Leer completo Gassó & Torres 2019 y buscar trabajos posteriores a 2019 que extiendan la serie de polvo (¿OMPS o VIIRS?).
3. Contactar a la Audioteca "Leer Escuchando", a Espacio Urbano y al Centro Luis Braille (solo para organizar, antes del 7/11), y preguntar al Local Lead por la prueba fuera de la sede y por el transporte.
4. Preguntar al Local Lead por los criterios, los ganadores 2024–2025 con sus temas, la presencia de geólogos en el jurado y la convocatoria a vecinos de 2026.
