# B2 — Datos de CONAE (SAOCOM) y de otras agencias socias como diferencial

Fecha: 21/10/2026. Agente B2, segunda fase. Base previa: `BRIEF.md`, `01_INVENTARIO_14_DESAFIOS.md`, `A10_huecos_SAR_trends_SPHEREx.md` §3 (C06), `A8_reglas.md`.

## 1. Misión

Testear (no confirmar) esta hipótesis: un participante de Comodoro Rivadavia podría diferenciarse usando datos de una agencia socia argentina, sobre todo **SAOCOM 1A/1B** (SAR banda L de CONAE), combinados con datos NASA, en especial en **C06 "Dancing with the SARs"** (NISAR también es banda L). También se evalúan otras agencias socias y la viabilidad real en 48 h.

## 2. Método y restricciones

- **Búsquedas:** 33 WebSearch (límite 45). Se listan en §9.
- **Acceso directo:** `argentina.gob.ar`, `catalogos.conae.gov.ar`, `registro.conae.gov.ar`, `earth.esa.int` y `dragon3.esa.int` devolvieron **403 en el túnel del proxy** (curl) o **ENOTFOUND** (WebFetch). `nisar-docs.asf.alaska.edu` dio ENOTFOUND. **Ningún documento de CONAE se leyó completo**: todo lo que sigue sobre SAOCOM es [SNIPPET].
- **Único endpoint leído:** el bucket S3 público de JAXA `jaxaalos2` (us-west-2). Se listaron prefijos sin descargar ninguna escena [LEÍDO, solo listado].
- **Repos:** no se encontró ningún repo 2026 relevante, así que no se clonó nada. No se escribió código ni se descargaron datos.

## 3. Hallazgos

### 3.1 SAOCOM: política de acceso en 2026

| Aspecto | Hallazgo | Evidencia |
|---|---|---|
| Catálogo | La búsqueda de productos y la consulta de metadatos son libres, sin registro. La descarga exige usuario registrado con permisos. | [SNIPPET] tutoriales v2 del catálogo y manual de usuario de febrero de 2023 |
| Licencia para el archivo | "Registrarse en el formulario y aceptar la licencia en línea habilita el acceso al archivo **sobre territorio argentino**". No cubre pedidos de adquisición nuevos. | [SNIPPET] argentina.gob.ar/productos-saocom |
| Plazo de aprobación | Los permisos se habilitan "dentro de la hora" si el registro se hace en horario de oficina, o a primera hora del día siguiente si se hace fuera de horario. | [SNIPPET] misma página. **No se verificó que siga vigente en 2026.** |
| Costo | El registro es gratuito según un tríptico de CONAE de 2018. ASI declara los productos gratuitos para uso institucional y de investigación (presentación de 2025). | [SNIPPET] |
| Términos | Los productos de nivel 2 o superior para usuarios argentinos están "protegidos por derechos de Propiedad Intelectual". Hay que incluir una leyenda de atribución en publicaciones y productos derivados. Hay restricciones sobre la disponibilidad hacia terceros y sobre el uso comercial. El incumplimiento puede cancelar el acceso. | [SNIPPET] Términos y Condiciones de Nivel 2 y superior (20/03/2020) y Términos generales |
| Usuarios extranjeros | Se accede por ESA (Third Party Mission) mediante una propuesta de proyecto evaluada por ESA y CONAE, con cupo de productos. La última convocatoria vista cerró el 30/04/2025. Europa es zona exclusiva de ASI. | [SNIPPET] |
| Niveles de producto | L1A (SLC, slant range), L1B, L1C y L1D (geocodificado con DEM). CONAE también publica un producto de humedad de suelo (MSM, hasta 50 cm) **solo para la región pampeana** (Buenos Aires, Córdoba, Santa Fe, Entre Ríos y La Pampa). No se encontró un producto InSAR distribuido por CONAE. | [SNIPPET] |
| Espejos | No se encontró SAOCOM en ASF, en el AWS Open Data Registry ni en Google Earth Engine. ASF lista datos de NASA, ESA, JAXA y CSA, pero no de CONAE. | [SNIPPET]. Que no se encontrara no prueba que no exista. |
| Estado de los satélites | La ficha de la Carta Internacional de Desastres da como fin de vida de SAOCOM-1 el **30/08/2025**. eoPortal (enero de 2025) los da como operativos. C5N (2026) dice que el presupuesto de CONAE se concentra en "la continuidad operativa de la misión SAOCOM". GlobalSecurity menciona en la prensa el riesgo de "perder por completo la capacidad radar". El presupuesto de CONAE cayó entre 20 % y 40 % nominal en 2026 según la fuente, y la planta de personal pasó de 294 a 254 agentes. | [SNIPPET], fuentes que se contradicen. **No se sabe si SAOCOM adquirió sobre Comodoro en 2026.** |
| Cobertura de Comodoro y Patagonia | No verificada. El modo por defecto (TOPSAR) apunta a mapas de humedad de suelo de la pampa; la interferometría es un objetivo secundario (UNCuyo). | [SNIPPET] + [INFERENCIA]: las adquisiciones en Patagonia podrían ser escasas |

**Compatibilidad con publicar resultados abiertos** [INFERENCIA]:

- Las figuras, los mapas derivados y las métricas con atribución parecen admisibles.
- **Subir escenas SAOCOM crudas o L1 a un repo Apache 2.0 probablemente viola** la cláusula sobre disponibilidad a terceros.
- Esto choca con el espíritu de reproducibilidad de Space Apps: un jurado no podría replicar el resultado sin registrarse en CONAE.

### 3.2 Antecedentes académicos con SAOCOM

- **InSAR en volcanes y tectónica:**
  - Primera evaluación interferométrica de SAOCOM-1A sobre el volcán Domuyo, Neuquén (J. South Am. Earth Sci., 2021).
  - Revisión en IEEE TGRS de deformación con datos stripmap (volcanes, tectónica, glaciares y deformación antrópica).
  - P-SBAS con SAOCOM en Campi Flegrei (IEEE JSTARS 2024–2025): diferencia con GNSS de unos 1 cm.
  - Todo [SNIPPET]. **No se encontró ningún estudio de deslizamientos con SAOCOM en Argentina.**
- **Humedad de suelo en la pampa:**
  - Producto operativo MSM, con asimilación en modelos de cultivo.
  - Validación con sensores in situ y triple colocación con SMOS y SMN (trabajos JAIIO/CAI).
  - Detección de cambios de humedad con SAOCOM y Sentinel-1 en el valle del Po (EGU24).
  - Todo [SNIPPET].
- **Polarimetría agrícola:** estudio en sitios argentinos replicado luego sobre ALOS-2 y UAVSAR [SNIPPET]. Es lo más cercano a una comparación SAOCOM–ALOS-2 que se encontró, y no da cifras de comparación.

### 3.3 SAOCOM frente a NISAR y acuerdos CONAE–NASA

- **No se encontró ningún estudio de intercomparación SAOCOM–NISAR** ni de calibración cruzada (3 búsquedas). La única señal es un genérico de CEOS WGCV (2025–2026): la multiplicación de misiones SAR "highlights the importance of cross-sensor calibration methods". Además, una diapositiva de CEOS menciona una "National L-band SAR mission ensuring continuity with SAOCOM" [SNIPPET].
- **No se encontró ningún acuerdo CONAE–NASA/JPL sobre NISAR** (cal/val ni sitios argentinos). Sí existe el acuerdo marco CONAE–NASA de 1991, con un anexo de heliofísica de 2015 [SNIPPET].
- **Precedente con otra agencia:** CONIDA (Perú) coordinó con NASA vuelos sobre ecosistemas andinos y amazónicos en 2026 [SNIPPET]. Hay precedente de cooperación regional, pero no con CONAE en NISAR.
- **"SAOCOM + NISAR" ya planteado:** no encontrado. Ese ángulo sería original, pero también **no tiene ninguna validación previa** de que las dos misiones sean comparables radiométricamente.
- **Diferencias técnicas conocidas** [SNIPPET + INFERENCIA]:
  - SAOCOM opera a 1275 MHz y es cuadripolarimétrico.
  - El repeat es de 16 días por satélite (8 días con la constelación).
  - NISAR tiene un repeat de 12 días, con productos GCOV y GUNW estandarizados.
  - Las geometrías, los ángulos de incidencia y los ciclos son distintos: **no se puede formar interferogramas cruzados**. Solo se puede comparar backscatter calibrado o desplazamientos ya derivados.

### 3.4 NISAR sobre Patagonia y Comodoro

| Aspecto | Hallazgo | Evidencia |
|---|---|---|
| Plan de observación | Banda L en todos los ciclos de 12 días, ascendente y descendente, "over all land". Argentina queda incluida por la definición global. | [SNIPPET] docs de ASF. **No se verificaron tracks ni frames específicos sobre Comodoro** (los KMZ del plan son inaccesibles). |
| Huecos reales | Un usuario del foro de Earthdata informó que faltaban pasadas ascendentes del plan en el release pre-calibración para su región (no se dice cuál). | [SNIPPET], informe no oficial |
| BETA (pre-calibración) | Adquisiciones del **17/10/2025 al 20/01/2026**, liberadas en febrero de 2026. | [SNIPPET] docs de ASF |
| PROVISIONAL | Adquisiciones desde el **17/06/2026** (CRID P05023). No se superpone con BETA. Hay una salvedad: los productos "generally meet radiometric and geolocation requirements in lower-latitude areas where ionospheric variability is low". | [SNIPPET]. Comodoro está a unos 45,9° S, en latitud media: hay riesgo ionosférico para la fase en banda L [INFERENCIA]. |
| GUNW | Existe la colección **GUNW PROVISIONAL** en Earthdata con extensión global (N90 S-90). Según ARSET 2026, GUNW es un producto L2 de alcance "Global", con pares de vecinos cercanos a unos 12 días y geocodificado a **80 m**. | [SNIPPET]. No se confirmó que haya GUNW para cada adquisición ni sobre Comodoro. |
| Acceso | Búsqueda sin login; descarga con Earthdata Login (A10). CMR y ASF son inaccesibles desde este entorno. | [SNIPPET] |

**Caso local candidato** [SNIPPET, prensa]:

- **Qué pasó:** deslizamiento del **cerro Hermitte** (barrios Sismográfica, Marquesado y Los Tilos), el 17–18/01/2026.
- **Magnitud:** unos 1.500 m de frente, más de 90 familias evacuadas y unas 200 viviendas dentro del vallado.
- **Respuesta:** emergencia geológica y urbanística por 90 días.
- **Estado posterior:** el municipio advirtió que "el terreno sigue en movimiento". Hay antecedentes de inestabilidad en el cerro Chenque (artículo geotécnico de 2017).
- **InSAR previo:** no se encontró ningún estudio InSAR publicado sobre Hermitte ni Chenque, ni activación de la Carta Internacional o de Copernicus EMS.

**Implicancia temporal** [INFERENCIA]:

- **BETA:** cubre el período previo al evento y quizás una sola adquisición posterior (corta el 20/01).
- **PROVISIONAL:** cubre desde 5 meses después, es decir, el movimiento residual.
- **Hueco:** del 21/01 al 16/06/2026 **no hay release publicado** según lo encontrado.
- **Tamaño frente a resolución:** a 80 m de GUNW, un frente de 1,5 km son unos 19 píxeles. Alcanza para detectar, no para caracterizar.
- **Coherencia:** el ambiente semiárido y con poca vegetación favorece la coherencia en banda L. Las arcillas expansivas y la lluvia pueden degradarla.

### 3.5 Otras agencias socias con datos útiles

Socias 2026 confirmadas por snippet (lista de 17 de una sede de terceros): CSA, ESA, JAXA, ISRO, ASI, AEB, CONAE ("National Space Activities Commission of Argentina") y otras.

| Agencia y dato | Acceso | Utilidad | Evidencia |
|---|---|---|---|
| **JAXA ALOS-2 PALSAR-2 ScanSAR L2.2** (banda L, gamma0 con RTC, HH/HV, 25 m, COG) | Bucket S3 público `jaxaalos2` sin cuenta. Listado comprobado: prefijos `2025/` (archivos planos con nombre de escena, por ejemplo `ALOS2010632250-140804_WBDR2.2GUD_HH_SLP.tif`), `Africa/`, `Asia/` y `For_STAC/`. **No existe un prefijo `SouthAmerica/`.** También está en GEE y en ASF (L1.1). La cobertura declarada va de 2014 a julio de 2025 en la página de JAXA y hasta el 15/06/2026 en el catálogo de ASF/NASA. | La mejor referencia **abierta** en banda L para comparar con NISAR (C06), y sin las trabas de licencia de SAOCOM. Es backscatter, no interferometría. | [LEÍDO listado S3] + [SNIPPET]. **La cobertura sobre Comodoro no está verificada.** |
| JAXA PALSAR-2 emergency observation | GEE, público desde el 01/01/2024 | Solo eventos de emergencia | [SNIPPET] |
| **ESA Sentinel-1C/1D** (banda C) | Abierto, en ASF y en Copernicus Data Space. 1D abierto desde el 17/04/2026. 1A terminó el 29/06/2026. Revisit de 6 días con el par C/D. | Contraste en banda C (C06), InSAR más denso en tiempo. OPERA DISP-S1 está solo sobre Norteamérica [INFERENCIA, de A10]. | [SNIPPET] |
| **CSA RCM ARD** (30 m, compact-pol, cada 12 días) | Abierto, con STAC en AWS. **Cubre solo la masa continental de Canadá.** | Nula para Argentina | [SNIPPET] |
| **ISRO NISAR banda S** | Bhoonidhi (ISRO), con registro | Secundaria. Cobertura sobre Argentina no verificada. | [SNIPPET] |
| CONAE SAC-D/Aquarius | No buscado en detalle por límite de búsquedas | Salinidad y humedad (2011–2015), histórico | [NO VERIFICADO] |
| CONAE MSM (humedad de suelo de la pampa) | Catálogo CONAE con licencia | Podría servir en **C07 Field Shift** si el AOI es pampeano, no Patagonia | [SNIPPET] |

**Repos 2026 que usan datos de agencias socias:** no se encontraron con SAOCOM ni con ALOS-2 (búsquedas 22–24). Los repos de C06 leídos en A10 usan NISAR, NASADEM, POWER, Landsat, OPERA y GIBS. Ninguno usa SAOCOM ni tiene un área de interés en Argentina.

### 3.6 Competencia con SAOCOM, CONAE, Argentina o Patagonia

- **Búsquedas:**
  - `site:github.com "Space Apps" 2026 SAOCOM` → 0 repos 2026.
  - `site:github.com "Space Apps" 2026 Argentina OR Patagonia OR CONAE` → 0 repos.
  - `github "Dancing with the SARs" Argentina OR "South America" OR Sentinel-1 OR ALOS-2 2026` → 0 repos.
- **Resultado:** **no encontrado.** La competencia directa con el ángulo "SAOCOM/Patagonia" parece nula, pero el conteo es un piso y los repos podrían publicarse durante el evento.
- **Contexto local** [SNIPPET]:
  - Comodoro es sede 2026: el municipio convoca, según una nota de octubre de 2026.
  - En 2025 la sede tuvo unos 430 participantes y se presentó como "la sede más austral del mundo".
  - Dos comodorenses integraron un equipo ganador global de la edición 2023 (RoverTito/Ainoken, desafío de sismos lunares).

### 3.7 Cómo trató el jurado el uso de datos de agencias socias

- **2020** [SNIPPET]: Zonda Incorporated (Mendoza) recibió un **premio aparte de ESA** para escalar el proyecto en Euro Data Cube. No consta que fuera ganador global por usar datos de ESA.
- **2023** [SNIPPET]: los ganadores fueron elegidos por "experts from NASA and 13 Space Agency Partners".
- **CONAE:** en su primer patrocinio (año no especificado en la nota, "décima edición") aportó mentores y jurados para 12 sedes locales, con foco en "datos libres y abiertos" [SNIPPET].
- **2021 y 2022:** se alentó el uso de datos de agencias socias [SNIPPET].
- **No se encontró ningún ganador global cuyo mérito declarado sea usar datos de una agencia socia.** El valor para el jurado es [INFERENCIA]: plausible en "Best Use of Data", "Global Connection" o "Local Impact", sin ninguna evidencia de bonificación.

## 4. Viabilidad en 48 h

| Opción | Datos | Tiempo crítico | Riesgo | Viabilidad |
|---|---|---|---|---|
| A. Solo NISAR GUNW/GCOV sobre Comodoro/Hermitte | NASA, abierto con Earthdata | Descubrir pares (1–3 h), bajar GUNW a 80 m (más liviano que GCOV) e interpretar la fase | Que no haya GUNW o pares sobre el área; ionósfera en latitud media; hueco ene–jun 2026 | **Media** [INFERENCIA] |
| B. A + ALOS-2 ScanSAR (JAXA) como contraste abierto en banda L | S3 sin cuenta | Encontrar una escena sobre el área en un bucket de nombres planos (hay que usar STAC o GEE) | Cobertura incierta; ScanSAR a 25 m sirve para backscatter, no para movimiento lento | **Media-baja** |
| C. A + SAOCOM L1D (backscatter) | CONAE, licencia en línea y archivo argentino | Registro (horas o día siguiente), pedido y descarga de GB | Que no haya adquisiciones en 2026 sobre Comodoro; no se puede redistribuir; el backscatter no detecta un deslizamiento lento | **Baja** |
| D. A + SAOCOM L1A SLC → InSAR propio | CONAE | Procesamiento InSAR stripmap de cero (SNAP o ISCE con soporte SAOCOM [NO VERIFICADO]), corregistro, desenrollado | Sin un pipeline preparado antes, muy probable que no termine | **Muy baja** |
| E. SAOCOM MSM + NASA (SMAP, POWER) en C07 (pampa) | CONAE, licencia | Producto L2 listo en GeoTIFF | Lejos de Comodoro; C07 está saturado (A2b) | Media, fuera del foco local |

**Reglas** [INFERENCIA, base A8]:

- Crear la cuenta de CONAE antes del 14/11 es análogo a sacar el Earthdata Login: es preparación de acceso, no "trabajar en el desafío". El riesgo es bajo, pero no está escrito.
- Consultar la disponibilidad en el catálogo, que es libre y sin registro, también parece investigación.
- **Descargar o pedir escenas de Comodoro antes del 14/11 sí cae en "empezar".**
- Conviene preguntar por escrito al Local Lead de Comodoro: (1) si la cuenta de CONAE cuenta como empezar; (2) si los datos con licencia restringida son aceptables siendo una agencia socia.

## 5. Objeciones propias

1. **El diferencial "SAOCOM" puede no existir en la práctica.** Si SAOCOM-1 no adquirió sobre Comodoro en 2026 (fin de vida nominal y recorte presupuestario), solo queda el archivo previo, que no se superpone con NISAR.
2. **La licencia restringida contradice la apertura.** Un jurado que intente reproducir el resultado no podrá. Space Apps valora el código abierto y la cita de fuentes.
3. **Sin un estudio previo de comparabilidad SAOCOM–NISAR,** cualquier "intercomparación" hecha en 48 h es exploratoria. Las diferencias de frecuencia, ángulo y procesador dominan.
4. **El ángulo fuerte es el AOI, no el sensor.** Hermitte es un caso real, local, reciente y sin InSAR público encontrado. Su valor no depende de SAOCOM.
5. **El sesgo de confirmación del brief:** "nadie más tiene SAOCOM" es cierto en parte porque es difícil de usar, no porque sea mejor.

## 6. Conclusiones

1. **Hipótesis "SAOCOM como diferencial central en C06": débil en 48 h.**
   - **Lo que juega a favor:** el acceso es posible para un argentino (licencia en línea, archivo nacional, aprobación en horas [SNIPPET]).
   - **Lo que juega en contra:**
     - Estado operativo en 2026 dudoso.
     - Cobertura de Comodoro desconocida.
     - Licencia restringida que impide la redistribución.
     - No hay espejos.
     - Procesar InSAR desde L1A no es factible sin un pipeline previo, y prepararlo antes estaría prohibido.
2. **Lo más defendible** [INFERENCIA]:
   - Usar NISAR (NASA) como núcleo sobre un caso local real: el **cerro Hermitte** (enero de 2026, terreno todavía en movimiento).
   - SAOCOM y ALOS-2 serían **contraste opcional en banda L**, solo si el catálogo muestra escenas útiles el mismo día del evento.
   - El diferencial real es el **caso local verificable + Local Impact**, más que la agencia.
3. **Competencia:** no se encontró ningún repo 2026 con SAOCOM, CONAE, Argentina o Patagonia (piso de búsqueda).
4. **Jurado:** no hay evidencia de que los datos de agencias socias den puntos extra. Hay jueces de las agencias socias, CONAE entre ellas en sedes argentinas.

## 7. Incertidumbres principales

1. ¿SAOCOM-1A/1B adquirió sobre Comodoro entre 2025 y 2026? (Se puede consultar en el catálogo CONAE sin registro; el participante puede hacerlo desde su red).
2. ¿Hay GUNW/GCOV NISAR sobre Comodoro, y en qué tracks? ¿El hueco de enero a junio de 2026 se completará en un release posterior? ¿Cuánto afecta la ionósfera a 46° S?
3. ¿Qué dicen el enunciado de C06 del 28/10 y la guía del 13/11 sobre los datos de socias con licencia restringida y sobre las cuentas creadas antes?

## 8. Tabla de fuentes

| URL | Qué afirma | Estado |
|---|---|---|
| https://www.argentina.gob.ar/productos-saocom | Licencia en línea, archivo sobre territorio argentino, permisos en ≤1 h hábil; producto MSM pampeano | [SNIPPET] (WebFetch ENOTFOUND; curl 403) |
| https://catalogos.conae.gov.ar/catalogo/docs/SAOCOM/Catalogo-SAOCOM_Inicio-de-sesion_Descarga-de-productos_v2.pdf | Búsqueda libre; la descarga requiere registro y permisos | [SNIPPET] (curl 403) |
| https://catalogos.conae.gov.ar/catalogo/docs/SAOCOM/Catalogo-SAOCOM_Busqueda-en-catalogo_v2.pdf | Niveles L1A (SLC) a L1D (GEC) | [SNIPPET] |
| https://catalogos.conae.gov.ar/catalogo/docs/SAOCOM/Manual_Usuario_SAOCOM_Feb-2023.pdf | Manual del catálogo, sistema en actualización | [SNIPPET] |
| https://catalogos.conae.gov.ar/catalogo/Docs/Terminos-y-Condiciones-Productos-Nivel2-y-Superior-CONAE_20mar20.pdf | Atribución obligatoria, propiedad intelectual, usuarios nacionales | [SNIPPET] (curl 403) |
| https://registro.conae.gov.ar/docs/TERMINOS_Y_CONDICIONES.pdf | Restricciones a terceros y al uso comercial | [SNIPPET] |
| https://argentina.gob.ar/sites/default/files/2018/05/triptico_unidad_de_atencion_al_usuario_-_conae.pdf | Registro gratuito | [SNIPPET] |
| https://earth.esa.int/eogateway/missions/saocom/data | Acceso de extranjeros vía propuesta ESA/CONAE con cupo | [SNIPPET] (curl 403) |
| https://www.asi.it/wp-content/uploads/2025/06/Sacco_ASI_SAOCOM.pdf | Gratuito para investigación e instituciones; zona ASI | [SNIPPET] |
| https://docs.disasterscharter.org/missions/sar/saocom-1/ | SAOCOM-1, fin de vida 30/08/2025 | [SNIPPET] |
| https://www.eoportal.org/satellite-missions/saocom | Vida de diseño 5 años; operativo (página de enero de 2025) | [SNIPPET] |
| https://www.globalsecurity.org/space/world/argentina/saocom.htm | Recorte de mayo de 2026, renuncia del director técnico, riesgo de perder la capacidad radar | [SNIPPET], fuente secundaria |
| https://www.c5n.com/politica/festejo-ajeno-y-motosierra-la-verdad-oculta-detras-del-satelite-argentino-la-mision-la-nasa-n235030 | Presupuesto CONAE 2026 (−25 % nominal), continuidad operativa de SAOCOM | [SNIPPET], prensa crítica |
| https://rest.hcdn.gob.ar/web/tramites-parlamentarios/render/adjunto/6a10bd312658f.pdf | Partida de 70.018 M$ (2025) a 42.014 M$ (2026); DA 20/2026 | [SNIPPET] |
| https://fcen.uncuyo.edu.ar/upload/1325234abd519dbdea424d01c8d617a1.pdf | TOPSAR por defecto para humedad; InSAR como objetivo secundario | [SNIPPET] |
| https://doaj.org/article/1177a5ed45354119ab835449fde4fbf8 | P-SBAS con SAOCOM, unos 1 cm frente a GNSS (Campi Flegrei) | [SNIPPET] |
| https://meetingorganizer.copernicus.org/EGU24/EGU24-16418.html | Humedad de suelo SAOCOM frente a Sentinel-1 (Po) | [SNIPPET] |
| https://ojs.sadio.org.ar/index.php/JAIIO/article/download/957/789 | MSM: asimilación y validación in situ | [SNIPPET] |
| https://45jaiio.sadio.org.ar:443/sites/default/files/CAI-05.pdf | Cinco provincias pampeanas; triple colocación con SMOS | [SNIPPET] |
| https://earth.esa.int/eogateway/documents/20142/2986799/SAOCOM_Calibration_and_Validation_Activities_Results_and_Way_Forward.pdf/a50079d7-09f9-0058-d572-e4c6381145d6 | Cal/val de SAOCOM (1275 MHz, cuadripolarimétrico) | [SNIPPET] |
| https://ceos.org/document_management/Working_Groups/WGCV/Meetings/WGCV-56_LSI-VC-19/Presentations/W2.1_SAR_Subgroup_Report_Guedtner.pdf | Necesidad de calibración cruzada; misión nacional en banda L de continuidad | [SNIPPET] |
| https://www.argentina.gob.ar/ciencia/conae/misiones-satelitales/participacion-internacional-0 | Acuerdo marco CONAE–NASA de 1991; nada sobre NISAR | [SNIPPET] |
| https://nisar-docs.asf.alaska.edu/observation-plan/ | Plan global de banda L, 12 días, toda la tierra emergida | [SNIPPET] (WebFetch ENOTFOUND) |
| https://nisar-docs.asf.alaska.edu/availability-overview/ | BETA del 17/10/2025 al 20/01/2026; PROVISIONAL desde el 17/06/2026; salvedad de baja latitud | [SNIPPET] |
| https://www.earthdata.nasa.gov/data/catalog/asf-nisar-l2-gunw-provisional-v1-1 | Colección GUNW PROVISIONAL, extensión global, 80 m | [SNIPPET] |
| https://www.earthdata.nasa.gov/s3fs-public/2026-07/arset-2026-nisar-part2.pdf | GUNW de alcance global, pares de unos 12 días | [SNIPPET] |
| https://forum.earthdata.nasa.gov/viewtopic.php?p=26091 | Pasadas ascendentes faltantes en el release pre-calibración (usuario) | [SNIPPET] |
| https://gestion.pe/peru/nasa-realizara-vuelos-cientificos-sobre-pacaya-samiria-y-huascaran-en-2026-noticia | Coordinación NISAR–CONIDA (Perú) | [SNIPPET] |
| https://www.noticiasnqn.com.ar/noticias/2026/01/18/326776-mas-de-90-familias-evacuadas-por-un-grave-desplazamiento-del-cerro-hermitte-en-comodoro-rivadavia | Hermitte, 18/01/2026: más de 90 familias, unos 1.500 m | [SNIPPET] |
| https://www.c5n.com/sociedad/declararon-la-emergencia-geologica-y-urbanistica-comodoro-rivadavia-el-desplazamiento-tierras-el-cerro-hermitte-n227042 | Emergencia geológica por 90 días | [SNIPPET] |
| https://www.diariolibre.com/mundo/america-latina/2026/01/18/deslizamiento-de-tierra-en-comodoro-rivadavia-provoca-evacuacion/3408374 | Unas 300 familias afectadas, "el terreno sigue en movimiento" | [SNIPPET] |
| https://revistas.unc.edu.ar/index.php/revista-asagai/article/download/45871/46042/188071 | Estabilización del cerro Chenque (2017) | [SNIPPET] |
| https://registry.opendata.aws/jaxa-alos-palsar2-scansar/ | Bucket `jaxaalos2`, sin cuenta, L2.2 gamma0 | [SNIPPET] |
| https://jaxaalos2.s3.us-west-2.amazonaws.com/?list-type=2&prefix=palsar2/L2.2/ | Prefijos `2025/`, `Africa/`, `Asia/`, `For_STAC/`; sin `SouthAmerica/` | **[LEÍDO]** (solo listado, 21/10/2026) |
| https://www.eorc.jaxa.jp/ALOS/en/dataset/palsar2_l22_e.htm | Archivo de agosto de 2014 a julio de 2025, actualización periódica | [SNIPPET] |
| https://catalog.data.gov/dataset/alos-2-palsar-2-level-1-scansar-product | ScanSAR L1.1 abierto en ASF, hasta el 15/06/2026 | [SNIPPET] |
| https://asf.alaska.edu/notices/sentinel-1d-data-are-available-for-download-at-asf-daac/ | Sentinel-1D en ASF | [SNIPPET] |
| https://dataspace.copernicus.eu/node/3949 | Reconfiguración 1C/1D, fin de 1A el 29/06/2026 | [SNIPPET] |
| https://app.geo.ca/en-ca/map-browser/record/eodms-rcm-ard-dc7905a3-dcc3-4a7f-a97f-9ecb668d4546 | RCM ARD a 30 m, solo Canadá | [SNIPPET] |
| https://www.isro.gov.in/ISRO_EN/NISARS_Band_SAR_Data_Products_Release.html | Banda S en Bhoonidhi | [SNIPPET] |
| https://www.therecursive.com/nasa-space-apps-challenge-2026-where-to-join-it-in-cee.md | 17 socias 2026 | [SNIPPET] |
| https://astrobiology.com/event/nasa-space-apps-challenge-2026/ | Lista de socias, incluida la Comisión Nacional de Actividades Espaciales | [SNIPPET] |
| https://www.argentina.gob.ar/noticias/nasa-space-apps-un-desafio-alcanzado-junto-la-conae | CONAE patrocinadora: mentores y jurados en 12 sedes | [SNIPPET] |
| https://www.earthdata.nasa.gov/news/2020-space-apps-challenge-winners | Zonda (Mendoza): premio aparte de ESA (Euro Data Cube) | [SNIPPET] |
| https://science.nasa.gov/directorates/smd/2023-nasa-international-space-apps-challenge-announces-10-global-winners | Jurado de NASA + 13 socias (2023) | [SNIPPET] |
| https://cholilaonline.ar/2026/10/nasa-space-apps-challenge-comodoro-rivadavia-2026.html | Comodoro sede 2026 | [SNIPPET], solo titular |
| https://diariojornada.com.ar/365918/magazine/dos_chubutenses_y_sus_companeros_ganaron_un_concurso_de_la_nasa | Comodorenses en un equipo ganador global (edición 2023) | [SNIPPET] |

## 9. Búsquedas realizadas (33)

1. SAOCOM catálogo, acceso libre, L1A/L1D, registro 2026
2. SAOCOM data policy, free access, license
3. SAOCOM NISAR L-band intercomparison → no encontrado
4. Estado de SAOCOM 1A/1B en 2026, vida extendida
5. argentina.gob.ar, licencia de uso SAOCOM en línea
6. CONAE–NASA/JPL NISAR, calibración → no encontrado
7. Licencia SAOCOM: productos derivados y redistribución
8. SAOCOM en ASF, AWS o GEE → no encontrado
9. SAOCOM InSAR Patagonia/Comodoro → no encontrado (aparece el evento Hermitte)
10. Hermitte e interferometría CONAE → no encontrado
11. DInSAR SAOCOM en deslizamientos de Argentina → solo volcanes
12. Plan NISAR para Sudamérica/Argentina
13. NISAR PROVISIONAL GUNW, regiones
14. Primeras imágenes NISAR en Argentina/Andes → no encontrado
15. SAOCOM frente a ALOS-2 → no hay comparación directa
16. Humedad de suelo SAOCOM en la pampa
17. ALOS-2 ScanSAR abierto
18. Bucket AWS de ALOS-2 L2.2
19. Agencias socias 2026
20. GitHub Space Apps 2026 SAOCOM → 0
21. GitHub Space Apps 2026 Argentina/Patagonia/CONAE → 0
22. GitHub "Dancing with the SARs" Argentina/S1/ALOS-2 → 0
23. Ganadores con datos de ESA/JAXA/CSA
24. Desafío propuesto por CONAE con SAOCOM → no encontrado
25. Recorte presupuestario de CONAE en 2026
26. Space Apps 2026 en Comodoro
27. Rango del release NISAR BETA
28. InSAR en Comodoro/Chenque → no encontrado
29. RCM open data
30. Hermitte, Carta Internacional o EMS → no encontrado
31. Cobertura Sentinel-1C/1D
32. Ganadores comodorenses 2024
33. NISAR–SAOCOM, calibración cruzada en CEOS → no encontrado

Además se hicieron pruebas de conectividad (curl y 2 WebFetch fallidos) y 3 listados del bucket S3 de JAXA.

## 10. Pendientes

- Lo puede hacer el participante desde su red, sin descargar nada:
  - Consultar el catálogo CONAE (sin registro) para ver si hay adquisiciones SAOCOM sobre Comodoro en 2025–2026.
  - Buscar en ASF Vertex frames NISAR y GUNW sobre Comodoro.
- Leer el enunciado de C06 del 28/10: datos sugeridos, socias mencionadas, áreas de interés curadas.
- Consulta escrita al Local Lead de Comodoro sobre la cuenta CONAE previa y la licencia restringida.
- No verificado: soporte de SAOCOM en SNAP o ISCE; tamaño de los productos L1A y L1D; cobertura sudamericana del bucket `jaxaalos2` (vía STAC).
