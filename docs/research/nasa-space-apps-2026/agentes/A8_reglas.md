# A8 — Estrategia de participación, reglas, licencias y trabajo previo (NASA Space Apps 2026)

Agente: A8. Fecha de la investigación: 2026-10-20/21. Brief: `agentes/BRIEF.md`.

> **Advertencia de evidencia, válida para todo el informe.** Ninguna página de `spaceappschallenge.org` pudo leerse completa: `WebFetch` falló con `getaddrinfo ENOTFOUND www.spaceappschallenge.org`. Todo lo atribuido a fuentes oficiales es **[SNIPPET]**: el resumen que devuelve el buscador, redactado por un modelo intermedio. Las frases entre comillas son el texto que el snippet presenta como literal; **no se pudo cotejar con la página ni ver su contexto**. Ninguna conclusión de este informe debe tratarse como una lectura de las reglas.

## 1. Misión

1. ¿Está permitido investigar antes del hackatón? ¿Qué significa "begin working on the challenges"?
2. ¿Se puede reutilizar código o componentes previos, propios u open source? ¿Con qué condiciones?
3. Licencias, propiedad intelectual y Apache 2.0 por defecto.
4. Qué hay que documentar en el envío.
5. Evaluación y elegibilidad.
6. Sedes confirmadas en Argentina para 2026.
7. Riesgo concreto del caso ASTRA (PR #1 con un prototipo de "Martian Map").
8. Consultas para el Local Lead / GO team donde haya ambigüedad.

## 2. Búsquedas y accesos realizados

| # | Acción | Resultado |
|---|---|---|
| 1 | `WebFetch` de `https://www.spaceappschallenge.org/resources/participant-faqs/` | Falla: `ENOTFOUND`. No se reintentó, como pide el brief. |
| 2 | WebSearch con la frase literal "Teams are not allowed to begin working on the challenges prior to the hackathon" | Sin la página oficial; solo reglas de otros hackatones. |
| 3 | WebSearch: `Space Apps participant FAQ "begin working on the challenges"` (extended) | Snippet del FAQ oficial, **cortado justo en el punto clave** ("prior to the ..."). |
| 4 | WebSearch: `"prior to the hackathon" research brainstorm form team ... October 28` (spaceappschallenge.org) | Snippet del FAQ 2026: fechas, equipos, regla de no empezar antes. |
| 5 | WebSearch: legal / OSI / Apache 2.0 / terceros (dos consultas, spaceappschallenge.org) | Snippets de `/legal/` (2026) y de términos 2017–2020. |
| 6 | WebSearch: reutilización de un proyecto previo (spaceappschallenge.org, y web abierta) | **No encontrado** ningún texto que lo regule de forma explícita. |
| 7 | WebSearch: guía de envío, video de 30 s, IA | Snippet de `/resources/project-submission-guide/`, posiblemente de 2025 (el buscador la marca con unos 383 días de antigüedad). |
| 8 | WebSearch: guía de juzgamiento | Snippet de `/resources/judging-awards-guide/` (versión 2025). |
| 9 | WebSearch: elegibilidad, equipo, edad, países; Universal Event | Snippets del FAQ y de `/legal/` 2026. |
| 10 | WebSearch: guía de uso de IA | Snippet del FAQ 2026 (aparece "SI tools"; ver §3.4). |
| 11 | WebSearch: sedes de Argentina 2026 | Prensa y sitios institucionales (snippets). `WebFetch` de palermo.edu: `ENOTFOUND`. |
| 12 | `git clone --depth 1 https://github.com/nasa/spaceapps` | **[LEÍDO]** Solo contiene `README.md`; las Discussions no están en archivos. |
| 13 | `WebFetch https://github.com/nasa/spaceapps/discussions` | Funcionó. Solo hay títulos visibles en la primera página y ninguno trata reglas, trabajo previo, licencias ni IA. No se abrieron los hilos. |
| 14 | Clon sin blobs de `FernandoDelgadoDiaz/astra-mars-explorer` y de la ref `refs/pull/1/head`; `git log --all`; `git grep` | **[LEÍDO]** Fechas de commit y textos del repo (§3.7). |
| 15 | `curl` a `raw.githubusercontent.com/FernandoDelgadoDiaz/astra-mars-explorer/main/README.md` | HTTP 404 sin autenticación. El clon funcionó por el proxy git autenticado. [INFERENCIA] Es probable que el repo sea **privado**. |

## 3. Hallazgos

### 3.1 Trabajo previo al hackatón: "begin working on the challenges"

- **[SNIPPET]** FAQ 2026 (`/resources/participant-faqs/`): "A summary of each challenge will be released on September 17, followed by challenge statements on October 28, which include the full details, resources, and requirements. Teams are not allowed to begin working on the challenges prior to the ..." El snippet **se corta** antes del término de comparación. Otro snippet de la misma página lo reproduce como "prior to the hackathon".
- **[SNIPPET]** El mismo FAQ: "Local Leads are available to answer questions and help connect you to potential teammates prior to the hackathon". La formación de equipos abre el 17/09/2026. Cada participante puede estar en un solo equipo y cada equipo puede trabajar en un solo desafío. Se puede cambiar de equipo o de evento hasta el cierre del 15/11.
- **[NO VERIFICADO]** No se encontró ningún texto oficial que defina "working on the challenges", ni que distinga investigar, aprender o preparar datos de construir la solución.
- **[SNIPPET, otras sedes, no normativo]** Space Apps Sarawak: "Teams should start work on their projects from 9 PM on October 4th. Prior to that, they can research and plan." Space Apps Asia: "contestants can prepare in advance". Son FAQs locales de otros años. Muestran cómo se suele interpretar la regla, pero **no autorizan nada en 2026**.
- **[INFERENCIA]** La lectura más prudente es que investigar, estudiar datasets públicos y formar el equipo antes del evento es razonable: el propio FAQ publica resúmenes con 2 meses de anticipación y promueve armar equipos antes. En cambio, escribir código de la solución de un desafío concreto antes del 14/11 encaja de lleno en "begin working on the challenges". Esto **no es una autorización**: es una interpretación sin respaldo textual completo.

### 3.2 Reutilización de código o componentes previos

- **[NO VERIFICADO / no encontrado]** No se halló una regla 2026 que diga expresamente si se puede reutilizar código propio previo. Búsquedas 6 y 7.
- **[SNIPPET]** Términos 2026 (`/legal/`, actualizados el 07/08/2026 según el snippet): si la solución usa material no-NASA, "you are responsible for ensuring that your Solution Materials are freely and publicly available without restriction or, at a minimum, are also licensed as open source". El snippet remite a opensource.org (OSI) para las licencias aceptables.
- **[SNIPPET]** Términos 2026: el participante declara que tiene los derechos necesarios para publicar la solución y para que otros usen sus materiales, sean propios o de terceros (sección "Use of Third Party Materials").
- **[SNIPPET, términos 2018/2020; en 2026 no confirmado]** "Any licenses applicable to your Solution Materials must be identified in the documentation that you submit with your Solution. NASA will not accept or post any Solutions that do not include appropriate license documentation." El snippet de 2026 **no** mostró esta frase. Podría estar en una parte no devuelta.
- **[INFERENCIA]** Las reglas parecen tratar el material de terceros como un problema de **licencia y cita**, mientras que el trabajo previo propio sobre el desafío es un problema de **cronología** (§3.1). Usar librerías open source (por ejemplo, un A* genérico o una librería de mapas) es habitual y parece compatible si tienen licencia OSI y se citan. Un prototipo propio que ya resuelve el desafío es otra cosa.

### 3.3 Licencias y propiedad intelectual

- **[SNIPPET]** Términos 2026: el contenido original debe ser "freely available without restriction or ... licensed as open source as defined by the Open Source Initiative". Si no se especifica licencia OSI, NASA lo distribuye bajo **Apache 2.0**.
- **[SNIPPET]** Términos 2026: "You must cite every source that is used in the creation of your project, even if it is open source or freely available". NASA puede retirar materiales sin citas y quitar premios o la condición de ganador.
- **[SNIPPET]** Los videos deben ser obra original sin infracción de derechos de terceros. No deben aparecer imágenes o voces reconocibles de menores de 18.
- **[SNIPPET, 2018]** El equipo es responsable si la solución infringe propiedad intelectual de terceros.
- **[LEÍDO]** `nasa/spaceapps/README.md`: participar en las Discussions implica estar registrado en 2026 y haber aceptado los Terms & Conditions (`/legal/`).

### 3.4 Documentación del envío

- **[SNIPPET, guía probablemente 2025]** Demo: "either in the form of a 7-slide presentation or a 30-second video presentation", subida a un sitio externo (YouTube, Google Drive, GitHub, etc.) con enlace público y sin login. Un video en otro idioma "MUST include English language subtitles".
- **[SNIPPET, guía probablemente 2025]** IA: preguntan si se usó IA, cuál y cómo. Imágenes y video generados con IA requieren marca visible. Audio, código y datos, reconocimiento en el texto descriptivo y en la metadata. Los jueces consideran originalidad, intención y ejecución.
- **[SNIPPET, FAQ 2026]** Los participantes "may use SI tools to accelerate innovation..." y "each team's project submission must include a description of how SI tools were used". El snippet dice "SI", no "AI". Puede ser un error de la página o del snippet ([NO VERIFICADO]).
- **[SNIPPET, página 2026]** El envío abre el sábado 14/11 a las 9:00 y cierra el domingo 15/11 a las 23:59, hora local.
- **[NO VERIFICADO]** Campos exactos del formulario 2026 (título, descripción, enlaces, datos de NASA y socios usados, recursos). El brief indica que la guía 2026 se publica el **13/11/2026**, un día antes del evento.

### 3.5 Evaluación y elegibilidad

- **[SNIPPET, guía 2025]** Para el juzgamiento global hay que responder a un desafío oficial, y **todos los integrantes, incluido el Team Owner, deben estar registrados en el mismo Local Event**. Además hay una revisión ligada a la restricción de NASA respecto de China.
- **[SNIPPET, guía 2025]** Criterios puntuados de 1 a 5: impacto, creatividad, validez (científicamente sólido y técnicamente factible), relevancia e integración de datos de NASA, y presentación o storytelling.
- **[SNIPPET, guía 2025]** Fases: (1) jueces locales o, en el Universal Event, expertos y Navigators nominan; (2) jueces globales eligen finalistas y menciones honoríficas, que no avanzan; (3) un comité ejecutivo de NASA y agencias socias elige 10 premios globales.
- **[SNIPPET, FAQ 2026]** Nominados, finalistas y menciones: diciembre de 2026. Ganadores: enero de 2027.
- **[SNIPPET, FAQ y términos 2026]** Equipos de hasta **6** integrantes, todos en el mismo Local Event o en el Universal Event. El evento está abierto a todas las edades: los menores de 18 los registra y acompaña en todo momento un padre o tutor. No pueden registrarse como participantes los empleados civiles del Gobierno Federal de EE. UU.; los contratistas solo de forma voluntaria y fuera del horario laboral.
- **[SNIPPET]** Países: la única restricción encontrada es la de **China** (incluye Hong Kong y Macao), basada en la **afiliación** con una entidad china o de propiedad china, no en la nacionalidad. No se encontró otra lista de países restringidos ([NO VERIFICADO] que no exista).
- **[SNIPPET + INFERENCIA]** Universal Event: virtual y asíncrono, 14–15/11. Un snippet sugiere que la regla de "mismo Local Event" limitaría a los equipos del Universal Event, pero la guía 2025 dice que los proyectos del Universal Event los juzgan expertos con los mismos criterios. [INFERENCIA] Probablemente el Universal Event cuenta como "evento" a estos efectos. Conviene confirmarlo.

### 3.6 Argentina: sedes 2026

Todo **[SNIPPET]** de prensa o sitios institucionales; nada contra el listado oficial, que no fue accesible.

| Sede | Fuente | Detalle |
|---|---|---|
| CABA, Universidad de Palermo | palermo.edu (página de nov. 2026) | Sábado 14/11, de 9 a 18 h, virtual y presencial; premiación el 19/11. Se presenta como el 10.º aniversario en Argentina. |
| Córdoba, General San Martín, Chaco, Santa Rosa de Calamuchita, Bahía Blanca | La Gaceta | Listadas como "eventos locales habilitados". |
| Santiago del Estero | meducacionsantiago.gob.ar (31/07/2026) | "Sede oficial". |
| Misiones | cambioclimatico.misiones.gob.ar | Sede o participación 2026. |
| San Juan | El Sol de San Juan (15/09/2026) | Sede, formato híbrido. |
| Comodoro Rivadavia | comodoro.gov.ar (14/10/2026), cholilaonline.ar | Sede 2026. |

- **[INFERENCIA]** Si la sede de Palermo solo trabaja el sábado de 9 a 18 h, el equipo tendrá que coordinar con el Local Lead cómo trabajar y enviar el domingo (el envío cierra el 15/11 a las 23:59).
- **[SNIPPET]** argentina.gob.ar menciona un desafío alcanzado junto a CONAE. Esto es coherente con que CONAE proponga un desafío ("MODIS/VIIRS hot spots"), pero **no lo verifica**.

### 3.7 Caso ASTRA: riesgo concreto

**Hechos comprobados [LEÍDO]** en el clon de `FernandoDelgadoDiaz/astra-mars-explorer`:

- **Todos** los commits del repo, incluido el inicial `b6be59a` ("ASTRA Mars Explorer: DTM CTX de Jezero validado...", 2026-10-20 13:40 UTC), tienen fecha del **20/10/2026**. Eso es posterior al anuncio de los resúmenes (17/09) y anterior a los enunciados completos (28/10) y al hackatón (14–15/11).
- La rama `prototype/jezero-interactive-map` = `refs/pull/1/head` (`3929e06`, 22:13 UTC) contiene: `app/` (mapa interactivo de Jezero, rutas A* con penalización por pendiente, E2E), configuración de despliegue en Netlify con `noindex` (commits `68b618d`, `ab7247a`, `bafe801`) y documentación de fases 2 a 2.2.2.
- El propio repo se autodescribe como previo al hackatón. `app/index.html` muestra en pantalla: "Prototipo de investigación previo al hackatón · no es una entrega de NASA Space Apps". `docs/PHASE2_PROTOTYPE.md` dice: "No es una entrega del NASA Space Apps Challenge 2026 ni debe presentarse como trabajo hecho durante el evento."
- **Contradicción interna:** `docs/NEXT_PHASE.md` (línea 20) fijaba que "El código de la aplicación (mapa, rutas, interfaz) se escribe **durante el evento**, en un repositorio o rama nueva con commits fechados dentro de la ventana del hackatón". El PR #1 hizo precisamente eso **antes** del evento.
- No hay archivo `LICENSE` en la rama del PR. `raw.githubusercontent.com` devuelve 404 sin autenticación, lo que sugiere un repo privado [INFERENCIA].

**Análisis [INFERENCIA]:**

1. El PR #1 no es "investigación" en el sentido débil: es una aplicación funcional que aborda el núcleo de "Interplanetary Survival Guide: Martian Map" (mapa navegable de Marte con rutas). Con la regla del FAQ tal como aparece en el snippet, presentar ese código, o un derivado directo, como proyecto del hackatón tiene **riesgo alto de incumplimiento**, aunque sea privado y aunque se declare.
2. Declararlo es necesario pero probablemente no suficiente. La transparencia evita el agravante de ocultamiento; no convierte en permitido un trabajo que la regla prohíbe. No hay ningún texto oficial que avale "lo declaro y lo uso".
3. Que el repo sea privado no reduce el riesgo normativo; solo la probabilidad de que alguien lo detecte. Si se publica o se reutiliza, las fechas de git son evidencia inmediata. Además, las reglas de licencia y cita **obligan** a enlazar o citar el material usado, así que esconderlo y cumplir a la vez es imposible.
4. Lo que sí parece de bajo riesgo:
   - Lo aprendido: el conocimiento sobre el DTM CTX y el hallazgo negativo del experimento E1.
   - Los datasets públicos de USGS, citados.
   - Las librerías open source de terceros.
5. Opciones, de menor a mayor riesgo:
   - (a) No usar ASTRA. Si se elige "Martian Map", rehacer desde cero en el evento, con repo nuevo y commits dentro de la ventana, y sin copiar el código del PR.
   - (b) Consultar por escrito al Local Lead o al GO team antes del 14/11 (ver §5) y seguir la respuesta.
   - (c) Reutilizar el código declarándolo. **No recomendable** sin una autorización escrita.
6. Esto encaja con la decisión vigente E (detener la inversión en ASTRA) y con que hay ≥10 repos públicos de otros equipos para el mismo desafío. Varios de ellos también tienen código previo al evento: [NO VERIFICADO] en este informe, a cargo de otros agentes. Que otros lo hagan no lo convierte en permitido.

## 4. Objeciones propias

- Toda la evidencia normativa es snippet. Es posible que el FAQ completo matice "begin working", por ejemplo permitiendo explícitamente investigar o reutilizar con declaración. No pude descartarlo.
- La guía de envío y la de juzgamiento leídas en snippet son, probablemente, de 2025. Las de 2026 salen el 13/11 y pueden cambiar campos, criterios o la regla de IA.
- Los resúmenes de buscador reformulan. Algunas comillas pueden no ser literales.
- Las fechas de git las fija el autor y son manipulables. Juego en contra: alterar fechas sería fraude y queda descartado. Pero también implica que, para un juez, las fechas "dentro de la ventana" no prueban nada por sí solas.
- La lista de sedes argentinas sale de la prensa. Puede haber sedes canceladas o no listadas.

## 5. Consultas sugeridas (en inglés, breves)

Para el Local Lead de la sede elegida, con copia al GO team (Space Apps Connect o `https://github.com/nasa/spaceapps/discussions`):

1. *"The FAQ says teams may not begin working on the challenges prior to the hackathon. Does that allow pre-event research, such as reading the challenge summary, studying public NASA/USGS datasets and learning tools, as long as no project code is written before November 14?"*
2. *"Before the event, one of our members built a private personal prototype related to the 'Martian Map' challenge summary (an interactive Jezero terrain map with route computation). Are we allowed to reuse any of that code if we disclose it, or must all project code be written during November 14–15? Would reusing it make us ineligible for local or global judging?"*
3. *"May teams use pre-existing open-source libraries (OSI-licensed) and their own previously published generic utilities, provided they are cited and licensed in the submission?"*
4. *"Is a team registered in the Universal Event eligible for global judging, given the 'same Local Event' requirement?"*
5. *"[For the Palermo venue] The venue is open Saturday 9:00–18:00. Can our team continue working remotely on Sunday and submit before 23:59 local time on November 15?"*
6. *"Will the 2026 Project Submission Guide keep the 30-second video / 7-slide demo limit and the AI-use disclosure requirements from 2025?"*

Recomendación [INFERENCIA]: obtener la respuesta por escrito (email o Discussion) y guardarla junto con el envío.

## 6. Conclusiones

1. **[SNIPPET]** El FAQ 2026 prohíbe empezar a trabajar en los desafíos antes del hackatón. No se encontró una definición del alcance ni una excepción para trabajo previo declarado.
2. **[INFERENCIA]** Investigar y preparar el conocimiento parece aceptable. Construir antes la aplicación que resuelve el desafío, no.
3. **[SNIPPET]** El material de terceros debe tener licencia OSI o ser libre, todo debe citarse, y el contenido original va bajo licencia OSI con Apache 2.0 por defecto. La falta de citas puede costar el premio.
4. **[SNIPPET, 2025]** Envío: demo de ≤30 s o 7 slides, enlace público, subtítulos en inglés y declaración del uso de IA. La guía 2026 llega el 13/11.
5. **[LEÍDO + INFERENCIA]** ASTRA PR #1 (todo fechado el 20/10/2026, posterior al 17/09) es una aplicación de "Martian Map" hecha antes del evento. Su reutilización tiene **riesgo alto** sin autorización escrita. Lo que se puede llevar con bajo riesgo son los datos públicos citados y lo aprendido, no el código.
6. **[SNIPPET]** Hay múltiples sedes argentinas 2026 (CABA/Palermo, Córdoba, San Juan, Santiago del Estero, Comodoro Rivadavia, Bahía Blanca, entre otras), sin confirmar en el listado oficial.

## 7. Tabla de fuentes

| URL | Qué afirma (según lo obtenido) | Estado |
|---|---|---|
| https://www.spaceappschallenge.org/resources/participant-faqs/ | Resúmenes el 17/09 y enunciados el 28/10; "Teams are not allowed to begin working on the challenges prior to the [hackathon]"; equipos ≤6 en el mismo evento; un equipo por persona y un desafío por equipo; IA ("SI tools") con descripción obligatoria; resultados en dic. 2026 y ene. 2027. | [SNIPPET] (WebFetch: ENOTFOUND) |
| https://www.spaceappschallenge.org/legal/ | Términos 2026 (07/08/2026): licencia OSI, Apache 2.0 por defecto, materiales de terceros libres u OSI, citar todo, menores con tutor, exclusión de empleados federales de EE. UU., restricción China. | [SNIPPET] |
| https://2020.spaceappschallenge.org/legal/ y http://2018.spaceappschallenge.org/legal/ | Identificar las licencias en la documentación; NASA no publica soluciones sin ella; responsabilidad por infracción de PI. | [SNIPPET] |
| https://www.spaceappschallenge.org/resources/project-submission-guide/ | Demo de 7 slides o video de 30 s, enlace público, subtítulos en inglés, reglas de IA. | [SNIPPET], probablemente de 2025 |
| https://www.spaceappschallenge.org/resources/judging-awards-guide/ | Mismo Local Event, criterios de 1 a 5, 3 fases, 10 premios. | [SNIPPET], versión 2025 |
| https://www.spaceappschallenge.org/2026/ | Envío del 14/11 a las 9:00 al 15/11 a las 23:59, hora local; equipos ≤6. | [SNIPPET] |
| https://legacy.spaceappschallenge.org/resources/faq/ | Compartir el código y citar las fuentes (edición 2022). | [SNIPPET], no normativo para 2026 |
| https://spaceappssarawak.com/faqs/ | Investigar y planificar antes; trabajar desde el inicio local. | [SNIPPET], sede local de otro año, no normativo |
| https://raw.githubusercontent.com/nasa/spaceapps/main/README.md (clon) | Participar en las Discussions implica registro 2026 y aceptación de los Terms. | [LEÍDO] |
| https://github.com/nasa/spaceapps/discussions | Ningún título sobre reglas, trabajo previo, licencias ni IA en la primera página. | [LEÍDO parcial] (solo títulos) |
| https://www.palermo.edu/ingenieria/2026/noviembre/nasa-space-apps-challenge.html | Sede en CABA, 14/11 de 9 a 18 h, híbrida, premiación el 19/11. | [SNIPPET] (WebFetch: ENOTFOUND) |
| https://www.lagaceta.com.ar/nota/1155880/... | Sedes: Córdoba, General San Martín, Chaco, Santa Rosa de Calamuchita, Bahía Blanca; Universal Event. | [SNIPPET] |
| https://www.meducacionsantiago.gob.ar/2026/07/31/... | Santiago del Estero, sede oficial 2026. | [SNIPPET] |
| https://elsoldesanjuan.com.ar/sanjuan/15/09/2026/... | San Juan, sede 2026 híbrida. | [SNIPPET] |
| https://www.comodoro.gov.ar/2026/10/14/... | Comodoro Rivadavia, convocatoria 2026. | [SNIPPET] |
| https://cambioclimatico.misiones.gob.ar/misiones-mundo-nasa-space-apps-challenge-2026/ | Misiones, participación 2026. | [SNIPPET] |
| https://www.argentina.gob.ar/noticias/nasa-space-apps-un-desafio-alcanzado-junto-la-conae | Desafío vinculado a CONAE (año no confirmado). | [SNIPPET] |
| github.com/FernandoDelgadoDiaz/astra-mars-explorer (clon por proxy git; `refs/pull/1/head`) | Commits del 20/10/2026, app de Jezero con A*, autodescripción como previa al hackatón, sin LICENSE, probablemente privado. | [LEÍDO] |

## 8. Pendientes

- Leer completos `/resources/participant-faqs/` y `/legal/` desde una red sin bloqueo, y copiar el texto literal del párrafo de "begin working" con su contexto.
- Revisar la guía de envío y la de juzgamiento 2026 cuando salgan (13/11).
- Enviar las consultas del §5 y archivar las respuestas.
- Confirmar las sedes argentinas, sus horarios y su Local Lead en el listado oficial `/2026/locations/`.
- Verificar (otro agente) las fechas de creación de los repos de terceros de "Martian Map", para medir la práctica real, sin tomarla como permiso.
- Decidir explícitamente el destino del PR #1. Este informe no lo modifica.
