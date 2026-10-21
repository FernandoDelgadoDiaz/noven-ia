# B3 — Jurado local de Comodoro Rivadavia, antecedentes argentinos y huecos de formato

Fecha: 21/10/2026. Agente B3 (segunda fase). Base previa: `BRIEF.md`, `02_CRITERIOS_Y_GANADORES_ANTERIORES.md`, `09_RECOMENDACION_FINAL.md`.

## 0. Misión

1. Qué ganó o fue nominado en la sede de Comodoro Rivadavia (2024, 2025) y en otras sedes argentinas; quién juzga.
2. Ganadores y nominados globales argentinos 2022–2025.
3. Patrones de Local Impact y Galactic Impact.
4. Huecos de formato donde el trabajo previo no da ventaja.
5. Otros huecos estratégicos, separando hecho de hipótesis.

## 1. Método y limitaciones

- Se hicieron **40 búsquedas WebSearch** de un cupo de 45 compartido. Todo lo que sigue es **[SNIPPET]** salvo que se indique otra cosa: no se abrió ninguna fuente completa.
- **WebFetch falló** (`ENOTFOUND cholilaonline.ar`). `curl` a cholilaonline.ar, diariojornada.com.ar y spaceapps.conocimiento.gob.ar devolvió `CONNECT 403` (proxy). No se insistió.
- Los resúmenes del buscador a veces mezclan ediciones. Por eso, cuando dos fuentes no coinciden, se informan ambas.

Búsquedas realizadas, agrupadas por tema:
- **Comodoro (16):** ganadores 2024 y 2025, la nota "Una comodorense…", cholilaonline 430 participantes, spaceapps.conocimiento.gob.ar, "Othar recibió a los ganadores", viaje a Bariloche, El Patagónico, ADNSUR, Tiempo Sur, Instagram de la sede, GitHub de la sede, jurado (UNPSJB, INVAP, CONAE), edición 2026.
- **Argentina (7):** Aónikenk/SpaceBee, Mars 3D Home, finalistas argentinos 2024 y 2025, CONAE como jurado, Rosario 2025, CONAE como agencia socia 2026.
- **Patrones de premios (9):** Queñaris (×2), Team I.O. (×2), NVS-knot, Local Impact 2023, definiciones de premios (Local Impact, Global Connection, Galactic Impact), blog "Thinking globally…".
- **Reglas (3):** guía de juzgamiento y cantidad de nominados, FAQ sobre trabajo previo, datos de agencias socias.
- **Otros (1):** análogos marcianos en la Patagonia.
- El resto fueron reintentos tras un corte por límite de API.

## 2. Sede Comodoro Rivadavia

### 2.1 Hechos sobre la sede [SNIPPET]

| Dato | Detalle | Fuente |
|---|---|---|
| Organizador | Agencia Comodoro Conocimiento (municipal). En 2025 se sumó Ciencia y Técnica de la Provincia | comodoro.gov.ar; conocimiento.gob.ar |
| Años | 2024 (primero), 2025 y 2026 ("tercer año consecutivo") | cholilaonline 10/2026 |
| Lugar | Centro de Encuentro Km 8 | varias |
| 2024 | ~300 participantes, 5 y 6/10/2024 | comodoro.gov.ar 05/10/2024; La Opinión Austral |
| 2025 | Cifras que no coinciden: "430 participantes presenciales y virtuales", que incluyen equipos de otras provincias, Chile, Brasil, Colombia e India (cholilaonline); 312 presenciales + 81 virtuales; "400" (El Comodorense); "321 presenciales" el primer día. Los 300 cupos presenciales se agotaron | cholilaonline; El Comodorense; Diario Crónica; ADNSUR |
| Mentores 2025 | ">40" (cholilaonline) o "34, de INVAP, CONAE, CONICET, Comodoro Conocimiento y UNPSJB" (otra fuente del mismo resumen) | cholilaonline y otra, [SNIPPET] |
| Jurado | Solo se encontró la descripción del proceso: "un jurado de expertos que evaluará los proyectos y designará a los equipos ganadores que podrán participar de la instancia global". **No se encontraron los nombres ni las instituciones del jurado** | resumen de un anuncio local |
| Premio local | Viaje a Bariloche (Centro Atómico Bariloche, Instituto Balseiro, INVAP, CNEA) para el **1.º y el 2.º puesto** de 2024, del 9 al 12/12/2024. Un anuncio previo hablaba de "4 días a Bariloche" para el 1.er puesto. En 12/2025 el intendente recibió a los ganadores de 2024 y 2025, que habían hecho el viaje con los mentores | Diario Crónica 14/12/2024; othar.com.ar; ADNSUR / Crónica / comodoro.gov.ar 19/12/2025 |
| Ganadores locales 2024 y 2025 | **No encontrados por nombre ni por tema.** El sitio oficial tiene un titular ("¡YA TENEMOS A LOS GANADORES LOCALES DE SPACE APPS!") cuyo texto no está indexado. La nota del 19/12/2025 dice que "presentaron los proyectos con los que compitieron a nivel global", sin nombrarlos | spaceapps.conocimiento.gob.ar/contact; diariocronica 19/12/2025 |
| ¿Algún equipo de Comodoro fue finalista o ganador global? | **No encontrado.** No hay ninguna mención de un finalista ni de un ganador global de la sede en 2024 o 2025. "Compitieron a nivel global" sugiere que fueron **nominados globales** (los que la sede eleva) [INFERENCIA] | — |
| Repo 2024 | Un resumen menciona un repo de GitHub "para web de la Hackatón de Space Apps… 2024 en Comodoro Rivadavia" sobre exoplanetas habitables en 3D. No se sabe si fue premiado. URL no capturada | [SNIPPET] sin URL |

### 2.2 La nota de 2024 "Una comodorense entre los argentinos que ganaron un concurso de la NASA"

- **No trata de la sede de Comodoro.** Trata del **ganador global 2023 "Aónikenk/Ainoken"** (Best Use of Technology), del equipo **SpaceBee Technologies**. [SNIPPET, cholilaonline 04/2024; Diario Jornada; comodoro.gov.ar 04/04/2024]
- **Integrantes de Comodoro:** Sol Maldonado Betanzo, ingeniera electrónica egresada de la UNPSJB y ex becaria de Pan American Energy, y Santiago Núñez, ingeniero electrónico y analista programador de la UNPSJB.
- **Equipo:** 7 jóvenes (otra fuente dice 8) de 25 a 28 años, de 6 provincias, con egresados del Instituto Balseiro y un estudiante de UIC (EE. UU.).
- **Proyecto:**
  - Mapa 3D de la Luna con los lunamotos de los sismómetros Apolo, con simulación y chatbot.
  - Se combinó con **RoverTito**, un rover lunar de bajo costo que el equipo ya había presentado en el desafío "Moon Rover" de Open Space en **2021**, cuando tenía 21 integrantes de Argentina y Cuba.
- **Sede desde la que compitieron en 2023:** **no encontrada**. La sede de Comodoro no existía en 2023.
- **Lección [INFERENCIA]:** el único ganador global con vínculo comodorense fue un **equipo distribuido, con historia y activos anteriores** (RoverTito y la marca SpaceBee). No es evidencia de lo que premia el jurado local de Comodoro.

### 2.3 Otras sedes argentinas [SNIPPET]

- **Sedes 2024:** Bahía Blanca, Comodoro Rivadavia, Córdoba, Mendoza, Rafaela, Rosario, Salta, San Juan, Santa Rosa de Calamuchita y CABA (UCAECE/CAC).
- **Rosario 2025 (Polo Tecnológico):**
  - Temas: medio ambiente, exploración, sostenibilidad y cambio climático.
  - En ediciones anteriores, "2 finalistas por sede" pasaban a la instancia internacional.
  - No se encontraron los ganadores. El texto de la fuente está dañado.
- **San Juan y San Francisco (La Voz de San Justo), año sin confirmar:**
  - Jurado de EMBAP y CONADE, en parte virtual.
  - Premio local: un proyector para una institución y un smartwatch por integrante.
- **CONAE (nota de argentina.gob.ar, "décima edición": probablemente 2021):**
  - Primera vez como sponsor, junto a otras 8 agencias.
  - Aportó **15 jurados y 16 mentores a 12 sedes locales** argentinas.
  - **No se sabe** si en 2024, 2025 o 2026 hubo jurados de CONAE en Comodoro. En 2025 sí hubo **mentores** de CONAE (ver 2.1).

## 3. Ganadores y nominados globales argentinos 2020–2025

| Año | Equipo / proyecto | Premio | Qué hizo | ¿Tema local? | Estado |
|---|---|---|---|---|---|
| 2020 | Zonda Incorporated (Mendoza) | Ganador internacional (categoría no capturada) | No capturado | ? | [SNIPPET] mención en nota de UNCuyo |
| 2022 | **Mars 3D Home** (sede Mendoza) | Best Mission Concept | Hábitat impreso en 3D para 4 astronautas durante 1 año en Marte (desafío "Mars Habitat"). Equipo: Lara Gauna y Mariano Tassin (**estudiantes de Diseño**, Facultad de Artes y Diseño, UNCuyo) más 3 integrantes de San Luis | No | [SNIPPET]. Una nota lo llama "finalista, top 35", otras "top 10 / ganador" |
| 2023 | **Aónikenk/Ainoken** (SpaceBee) | Best Use of Technology | Ver 2.2: mapa 3D de lunamotos de Apolo + chatbot + rover RoverTito anterior | No (el nombre evoca a pueblos del sur) | [SNIPPET] |
| 2024 | — | — | No se encontró ningún finalista ni ganador argentino | — | Búsqueda sin resultados |
| 2025 | — | — | No se encontró ningún finalista ni ganador argentino. Una nota de UNCuyo sin fecha sobre "finalista top 35" corresponde a Mars 3D Home | — | Búsqueda sin resultados |

**Qué los diferenció [INFERENCIA, base débil]:**
- Ninguno de los dos ganadores argentinos recientes atacó un problema local.
- Los dos combinaron un **artefacto tangible o visual fuerte** (hábitat 3D, Luna 3D + rover) con un equipo **interdisciplinario o multiprovincial**: diseño en Mars 3D Home, electrónica/Balseiro/UIC en Aónikenk.
- Aónikenk además tenía trabajo y marca anteriores al evento.

## 4. Patrones de Local Impact y Galactic Impact

**Definiciones oficiales [SNIPPET, spaceappschallenge.org/2025/awards]:**
- **Local Impact:** "the project that demonstrates the greatest potential for local impact". La misma fórmula aparece en 2021.
- **Galactic Impact:** "most potential to improve life on Earth or in the universe".
- **Global Connection:** "best connects people around the world through technology".
- **Best Use of Data:** "best makes space data accessible or leverages it for a unique application".

| Año | Local Impact | Qué tenía | Estado |
|---|---|---|---|
| 2021 | Landslide Detection Squad (Perth, Australia) | Monitoreo de riesgo de deslizamientos integrable con sistemas de emergencia y de gobierno, con entrada de las comunidades afectadas | [SNIPPET] blog "Thinking Globally and Acting Locally" (28/02/2023) |
| 2023 | Equipo de Taiwán (nombre ilegible en el resumen) | Desafío "Explore a Biodiversity Hotspot with Imaging Spectroscopy": método para priorizar la protección de un hotspot de biodiversidad local | [SNIPPET] science.nasa.gov |
| 2024 | Team I.O. (Florianópolis) | Desafío **"Community Mapping"**: mapa con datos científicos abiertos sobre cómo la geografía física moldea un problema de **su** comunidad. Problema concreto no capturado | [SNIPPET]. La atribución a Local Impact viene de `02`; los resúmenes de este agente no la confirman |
| 2025 | Queñaris (Arequipa) | Restauración del bosque de queñua: datos satelitales de NASA (NDVI desde 2005, imágenes térmicas para incendios) + mapeo 3D + microorganismos nativos; apoyo técnico de Tecsup; coordinador Óscar Medina | [SNIPPET] El Peruano. La categoría no se confirmó en este agente (ya estaba en conflicto en `02`) |

**Galactic Impact 2024:** NVS-knot / "2Plant or not 2Plant" (Kiev). Ventana de siembra con SMAP + OpenET para agricultores ante sequías e inundaciones. [SNIPPET]

**Qué tienen en común:**
- **Hecho [SNIPPET]:** los 4 Local Impact tienen un **lugar con nombre propio** y un **problema ambiental o de riesgo** de ese lugar, resuelto con **datos de observación de la Tierra**.
- **Hecho [SNIPPET]:** 2 de los 4 respondían a un desafío que ya pedía un foco local: "Community Mapping" y "Biodiversity Hotspot".
- **Actor local identificado:** solo en Queñaris (Tecsup, y el problema del queñual con SERFOR como contexto, no como socio) y en Landslide (sistemas de emergencia).
- **Validación en campo durante el evento: no se encontró evidencia en ninguno.** Las descripciones hablan de "potencial", no de pruebas con usuarios.
- **[INFERENCIA]:** Local Impact parece premiar **la especificidad geográfica y la plausibilidad de uso por un actor local**, no la evidencia de uso.

## 5. Huecos de formato: ¿dónde no da ventaja el trabajo previo?

| Hipótesis de hueco | Evidencia encontrada | Estado |
|---|---|---|
| Un criterio o premio que valore la validación con usuarios reales durante el evento | **Ninguna.** Ningún criterio oficial (Impact, Creativity, Validity, Relevance, Presentation, según `02`) ni ninguna descripción de premio la menciona. Ningún ganador revisado la documenta | No encontrado |
| Un premio por colaborar con actores locales | Solo "Local Impact = potencial de impacto local". No pide colaboración | Parcial: el premio existe, la colaboración no se exige |
| Global Connection premia la colaboración entre sedes o países | No. Su definición es "conectar personas en el mundo mediante tecnología" (ganador 2025: Gaia+LEO, infraestructura de cómputo en órbita) | Refutado [SNIPPET] |
| Bonus por usar datos de agencias socias (CONAE, etc.) | No se encontró ningún bonus. Las agencias socias aportan datos a los desafíos y expertos al juzgamiento global. No se encontró ningún desafío 2026 de CONAE ni con SAOCOM | No encontrado |
| Regla sobre trabajo previo | Solo la frase del FAQ ya conocida ("not allowed to begin… prior"). No se encontró la guía de juzgamiento de 2025 ni la de 2026 sobre cómo se fiscaliza | Sin cambios respecto de `08` |
| Cuántos nominados eleva cada sede | En 2013 y 2014, hasta 2 por sede. En Rosario, "2 por sede" en ediciones anteriores. Wikipedia: "depende de la cantidad de proyectos". No se encontraron las reglas de 2025 ni de 2026 | [SNIPPET], desactualizado |
| Criterios del jurado local | Históricamente los fija cada sede (2013, 2014). Italia 2021 usó Impact/Creativity/Validity/Relevance. **No se encontraron los de Comodoro** | No encontrado |

**Conclusión del punto 4:**
- **No hay evidencia** de ninguna categoría o criterio que neutralice el trabajo previo.
- La validación con usuarios durante el evento sigue siendo un **diferencial de credibilidad (hipótesis H1 de `02`), no un criterio escrito.**

## 6. Otros huecos estratégicos

| # | Hueco | Hecho | Hipótesis |
|---|---|---|---|
| 1 | **Ganar la sede es un objetivo propio, con premio tangible** | 1.º y 2.º puesto de Comodoro 2024 (y los de 2025) viajaron a Bariloche (CAB, Balseiro, INVAP), con recepción del intendente [SNIPPET] | Con ~300–430 participantes, la tasa base de ganar la sede es mucho mayor que el ~0,1 % global. Conviene fijarlo como meta primaria [INFERENCIA] |
| 2 | **Mentores de CONAE, INVAP, CONICET y UNPSJB presentes durante el evento** | 34 a >40 mentores en 2025 [SNIPPET] | Se pueden usar como **revisores expertos durante el evento** (validez científica), y eso no se copia antes. Hay que confirmar con el Local Lead si están en 2026 |
| 3 | **Pedir al Local Lead (Comodoro Conocimiento) los criterios, la composición del jurado, la cantidad de nominados y los ganadores 2024 y 2025** | Esos datos no son públicos en el índice [búsquedas sin resultado] | Es la consulta más barata y de mayor valor de toda la lista. Se suma a Q1–Q8 de `08` |
| 4 | **Idioma** | El demo global exige subtítulos en inglés (`02`) | El jurado local probablemente evalúa en español [NO VERIFICADO]. Conviene preparar un pitch local en español y el demo global en inglés |
| 5 | **Equipo interdisciplinario** | Mars 3D Home tenía estudiantes de diseño. Aónikenk mezclaba electrónica, Balseiro y UIC [SNIPPET] | La presentación o diseño pesa en las categorías y en el criterio Presentation. Sumar a alguien de diseño o comunicación (por ejemplo, de la UNPSJB) [INFERENCIA] |
| 6 | **Integrantes virtuales en la sede** | En 2025 la sede aceptó participantes virtuales de otras provincias y países [SNIPPET] | Permite sumar perfiles sin que se muden, siempre que todos estén inscriptos en la **misma** sede (regla de `02`) |
| 7 | **C14: reclutar participantes ciegos o con baja visión en Comodoro** | No se buscó ninguna organización local (fuera de cupo) | Hay que verificarlo con el Local Lead y con organizaciones locales antes del 7/11 (condición de `09`) |
| 8 | **C10 Analogs con un análogo patagónico** | La búsqueda "análogo marciano Patagonia Chubut" no encontró nada relevante | No hay base. No se recomienda sin otra fuente |
| 9 | **Relevancia local para el jurado de Comodoro** (petróleo y gas, viento, costa, incendios de Chubut) | Los temas de los ganadores de Comodoro son desconocidos | Un problema regional con datos NASA podría pesar más en el jurado local que en el global [INFERENCIA, sin evidencia] |

## 7. Objeciones propias

- No se conoce **ningún** proyecto ganador de Comodoro. Cualquier afirmación sobre "qué premia el jurado local" es inferencia.
- Las atribuciones de Local Impact 2024 y 2025 no se reconfirmaron. La muestra de patrones es de 4 casos descritos en una frase.
- La nota de CONAE con 15 jurados probablemente es de 2021, no de 2024–2026.
- Las cifras de participantes 2025 no coinciden (321, 393, 400 o 430).

## 8. Conclusiones

1. La sede de Comodoro existe desde 2024. La organiza la Agencia Comodoro Conocimiento y premia al 1.º y 2.º puesto con un viaje a Bariloche. Hubo ganadores locales en 2024 y 2025 que "compitieron a nivel global", pero **no se encontraron sus nombres ni temas, ni ningún finalista o ganador global de la sede**.
2. La nota "Una comodorense…" es sobre **Aónikenk (ganador global 2023)**, un equipo distribuido con trabajo previo (RoverTito, 2021) y dos integrantes egresados de la UNPSJB. No es un logro de la sede.
3. Los ganadores argentinos (Mars 3D Home 2022, Aónikenk 2023) **no fueron de temas locales**. Ganaron con un artefacto visual fuerte y equipos interdisciplinarios.
4. Local Impact premia **un problema ambiental geolocalizado con datos de observación de la Tierra y un "potencial" de uso local**. No se encontró evidencia de validación en campo en ningún ganador.
5. **No hay evidencia de huecos de formato** que neutralicen el trabajo previo. El mayor hueco práctico es **ganar la sede**, y para eso hay que pedir al Local Lead los criterios y los ganadores anteriores.

## 9. Pendientes

- Pedir a Comodoro Conocimiento: criterios y jurado 2026, cantidad de nominados globales, lista y temas de los ganadores 2024 y 2025, mentores 2026, y si admiten testers externos (C14).
- Leer la guía de juzgamiento 2026 (13/11) para ver si hay algo sobre validación o datos de agencias socias.
- Confirmar las categorías de Team I.O. y Queñaris en una fuente primaria.
- Buscar organizaciones de personas ciegas en Comodoro (C14).

## 10. Tabla de fuentes

| URL | Qué afirma | Estado |
|---|---|---|
| https://cholilaonline.ar/2024/04/una-comodorense-entre-los-argentinos-que-ganaron-un-concurso-de-la-nasa.html | Sol Maldonado Betanzo (Comodoro, UNPSJB) en el equipo ganador 2023 Ainoken | [SNIPPET]; fetch falló (ENOTFOUND / 403) |
| https://diariojornada.com.ar/365918/magazine/dos_chubutenses_y_sus_companeros_ganaron_un_concurso_de_la_nasa | Núñez y Maldonado; RoverTito; el intendente los recibe; viaje autofinanciado | [SNIPPET]; curl 403 |
| https://www.comodoro.gov.ar/2024/04/04/othar-se-reunio-con-los-ingenieros-comodorenses-convocados-por-la-nasa/ | Reunión de 2024 con los ingenieros del proyecto de lunamotos | [SNIPPET] |
| https://www.anbariloche.com.ar/noticias/2024/03/20/93319-ingenieros-del-balseiro-resultaron-ganadores-de-una-competencia-organizada-por-la-nasa | Equipo SpaceBee, egresados del Balseiro, aonikenk.spacebeetech.com | [SNIPPET] |
| https://www.anbariloche.com.ar/noticias/2021/09/02/81771-un-barilochense-es-parte-del-equipo-que-gano-el-desafio-internacional-moon-rover | RoverTito, Moon Rover 2021, 21 integrantes de Argentina y Cuba | [SNIPPET] |
| https://www.conclusion.com.ar/?p=1139098 | 7 jóvenes de 6 provincias, ~8.715 equipos | [SNIPPET] |
| https://www.unidiversidad.com.ar/con-una-app-y-un-robot-lunar-un-equipo-con-egresados-del-balseiro-se-lucio-en-la-nasa | Equipo de 8; premiación en julio en Washington | [SNIPPET] |
| https://today.uic.edu/uic-student-designs-moon-app-as-part-of-winning-nasa-competition-team/ | Aónikenk, Best Use of Technology 2023; Luna 3D + chatbot | [SNIPPET] |
| https://cholilaonline.ar/2025/10/nasa-space-apps-2025-comodoro-rivadavia-430-participantes.html | 430 participantes (presenciales y virtuales, varios países); >40 mentores | [SNIPPET]; WebFetch ENOTFOUND |
| https://cholilaonline.ar/2025/10/comenzo-en-comodoro-rivadavia-el-nasa-space-apps-challenge-2025-la-sede-mas-austral-del-mundo.html | "Sede más austral"; 321 presenciales | [SNIPPET] |
| https://cholilaonline.ar/2026/10/nasa-space-apps-challenge-comodoro-rivadavia-2026.html | Tercer año consecutivo; 14–15/11 en Km 8 | [SNIPPET] |
| https://spaceapps.conocimiento.gob.ar/ (y /contact/) | Sitio oficial de la sede; titular "ganadores locales" sin detalle | [SNIPPET]; curl 403 |
| https://www.diariocronica.com.ar/noticias/2024/12/14/107902-los-ganadores-del-space-apps-visitaron-centros-tecnologicos-en-bariloche | Viaje a Bariloche para el 1.º y 2.º puesto 2024, del 9 al 12/12 | [SNIPPET] |
| https://www.diariocronica.com.ar/noticias/2025/12/19/130250-othar-recibio-a-los-ganadores-comodorenses-de-la-nasa-space-apps-challenge | Ganadores 2024 y 2025 "compitieron a nivel global"; viaje con mentores | [SNIPPET] |
| https://www.adnsur.com.ar/sociedad/macharashvili-recibio-a-los-ganadores-comodorenses-del-nasa-space-apps-challenge_a6945d2339a0e276960e8118d | Ídem; ganadores de las ediciones 2024 y 2025 | [SNIPPET] |
| https://www.comodoro.gov.ar/2025/12/19/othar-recibio-a-los-ganadores-comodorenses-de-la-nasa-space-apps-challenge/ | Ídem; Rubén Zárate (Comodoro Conocimiento) | [SNIPPET] |
| https://www.comodoro.gov.ar/2024/10/05/300-jovenes-participan-de-la-space-apps-challenge-comodoro-rivadavia/ | ~300 participantes en 2024 | [SNIPPET] |
| https://www.diariocronica.com.ar/noticias/2025/10/04/125631-comodoro-brilla-en-el-nasa-space-apps-challenge-con-record-de-participacion | Récord de participación en 2025 | [SNIPPET] (solo título) |
| https://www.elcomodorense.net/400-participantes-dijeron-presente-en-la-nasa-space-apps-challenge-2025/ | 400 participantes | [SNIPPET] (solo título) |
| https://www.argentina.gob.ar/noticias/nasa-space-apps-un-desafio-alcanzado-junto-la-conae | CONAE sponsor por primera vez; 15 jurados y 16 mentores en 12 sedes ("décima edición") | [SNIPPET] |
| https://www.lavozdesanjusto.com.ar/nasa-international-space-apps-propuesta-ganadora-local-sera-evaluada-por-la-nasa--127159 | Jurado de EMBAP y CONADE; premio local | [SNIPPET], año sin confirmar |
| https://www.conclusion.com.ar/?p=1347641 | Rosario 2025; "2 finalistas por sede" en ediciones anteriores | [SNIPPET], texto dañado |
| https://www.cac.com.ar/noticias/la-hackaton-nasa-space-apps-challenge-2024-ya-tiene-sus-ganadores-y-menciones | Lista de sedes argentinas 2024 | [SNIPPET] |
| https://www.unidiversidad.com.ar/dos-estudiantes-de-la-uncuyo-ganaron-un-concurso-en-la-nasa-por-disenar-una-casa-para-habitar-en-marte | Mars 3D Home, estudiantes de diseño de UNCuyo, Best Mission Concept 2022 | [SNIPPET] |
| https://2022.spaceappschallenge.org/challenges/2022-challenges/mars-habitat/teams/mars-3d-home/members | Página del equipo, sede Mendoza | [SNIPPET] |
| https://www.spaceappschallenge.org/2025/awards/ | Definiciones de Local Impact, Galactic Impact, Global Connection y Best Use of Data | [SNIPPET] |
| https://www.spaceappschallenge.org/blog/thinking-globally-and-acting-locally | Landslide Detection Squad (Local Impact 2021) | [SNIPPET] |
| https://science.nasa.gov/directorates/smd/2023-nasa-international-space-apps-challenge-announces-10-global-winners | Local Impact 2023: Taiwán, Biodiversity Hotspot | [SNIPPET], nombre del equipo ilegible |
| https://olhardigital.com.br/2025/02/14/ciencia-e-espaco/estudantes-brasileiros-brilham-e-vencem-desafio-global-da-nasa/ | Team I.O., Florianópolis; integrantes | [SNIPPET] |
| https://elperuano.pe/noticia/286482-nasa-premia-equipo-arequipeno-por-disenar-un-sistema-inteligente-para-la-reforestacion | Queñaris: datos NASA, NDVI, microorganismos, Tecsup | [SNIPPET] |
| https://en.ain.ua/2025/01/17/ukrainian-team-wins-nasa-space-apps-challenge-hackathon | NVS-knot, Galactic Impact 2024, SMAP + OpenET | [SNIPPET] |
| https://spaceappschallenge.org/resources/judging-awards-guide | Guía 2024: requisitos mínimos; jueces locales y SME | [SNIPPET] |
| https://2014.spaceappschallenge.org/about/judging/ | Hasta 2 nominados por sede (2014) | [SNIPPET], histórico |
