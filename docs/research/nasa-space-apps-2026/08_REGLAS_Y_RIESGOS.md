# 08 — Reglas y riesgos de participación

Base: `agentes/A8_reglas.md`, `A4_viabilidad_datos.md` ("Precarga y credenciales") y `A2a_competidores_espacio.md` §3.

> **Ninguna regla se leyó completa.** `spaceappschallenge.org` es inaccesible desde este entorno. Todo lo oficial es **[SNIPPET]**. Este documento **no autoriza nada**: separa lo que dicen los fragmentos, lo que se infiere y lo que hay que preguntar por escrito.

## 1. Respuestas a las preguntas de la consigna

| Pregunta | Qué dice la evidencia | Estado | Lectura prudente [INFERENCIA] |
|---|---|---|---|
| ¿Se permite investigar antes del hackatón? | FAQ 2026: "A summary of each challenge will be released on September 17, followed by challenge statements on October 28 … Teams are not allowed to begin working on the challenges prior to the [hackathon]". El snippet se corta en esa palabra. El mismo FAQ promueve formar equipos antes del evento | [SNIPPET] | Investigar, estudiar datos públicos y formar el equipo parece aceptable: los resúmenes se publican con 2 meses de anticipación. **No hay texto que lo diga expresamente** |
| ¿Qué significa "comenzar a trabajar en una solución"? | No se encontró ninguna definición. Las FAQ de otras sedes y años dicen "Prior to that, they can research and plan" (Sarawak) | No definido / sedes locales [SNIPPET], no normativo | Escribir código, pipelines o modelos de la solución de un desafío concreto antes del 14/11 encaja de lleno en la prohibición |
| ¿Se permite reutilizar código previo? | No se encontró ninguna regla 2026 explícita. Los términos 2026 tratan el material de terceros como un tema de **licencia OSI y cita** | [SNIPPET] / no encontrado | Las librerías open source genéricas, citadas, parecen compatibles. **Un prototipo propio que resuelve el desafío no lo es** sin autorización escrita |
| ¿Qué licencias se exigen? | Material de terceros libre o con licencia OSI. El contenido original queda abierto, bajo **Apache 2.0** si no se indica otra licencia. Hay que citar **todas** las fuentes, incluso las open source; sin citas se puede perder el premio | [SNIPPET] términos 2026 (07/08/2026) | — |
| ¿Qué documentación hay que presentar? | Demo de ≤30 s o ≤7 diapositivas (si se excede, el proyecto es inelegible para el juzgamiento global), enlace público, subtítulos en inglés; descripción del uso de IA ("SI tools" en el snippet 2026); marca visible en imágenes y video generados con IA | [SNIPPET] guía, probablemente de 2025; la guía 2026 sale el **13/11** | Verificarlo el 13/11 |
| ¿Cómo se evalúan los proyectos? | Ver `02` §1: proceso local → global y 5 criterios de 1 a 5 | [SNIPPET] | — |
| ¿Cuáles son las condiciones de participación? | Equipos de ≤6 personas, todos en el mismo Local Event (o en el Universal Event); menores con tutor; quedan excluidos los empleados federales civiles de EE. UU.; restricción por afiliación con China; inscripción gratuita | [SNIPPET] FAQ y términos 2026 | — |

## 2. Riesgos concretos

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R1 | **Reutilizar ASTRA (PR #1) en Martian Map.** Todos los commits del repo son del 20/10/2026, después del anuncio del 17/09. Es una app funcional de mapa y rutas en Jezero. El propio repo dice "previo al hackatón, no es una entrega" [LEÍDO, A8] | **Alta** | No reutilizar el código. Llevar solo lo aprendido y los datos públicos citados. Si se elige C11, rehacer todo desde cero, en un repo nuevo, durante el evento. Preguntar por escrito (consulta Q2) |
| R2 | **Competir contra trabajo previo de otros** (Etapa 1 de Bangladesh y otros) | Alta (competitiva, no legal para nosotros) | Ver la premisa estratégica en `09`. Que otros lo hagan **no habilita** a hacerlo |
| R3 | Sacar credenciales (Earthdata, FIRMS MAP_KEY, PSI) o **pre-descargar datos** | Media-baja | Preguntar por escrito (Q1). Mientras no haya respuesta: crear las cuentas, pero sin descargar ni procesar nada específico del desafío |
| R4 | **Reclutar personas ciegas o con baja visión** para una prueba perceptiva (C14) | Media (ética y reglas) | Contactar a una organización solo para coordinar disponibilidad, sin construir nada. Consentimiento informado y sin datos personales. No grabar caras ni voces de menores. Preguntar al Local Lead (Q7) |
| R5 | Afirmaciones científicas engañosas ("ruta segura", "IA predice", "Planet X") | Media (penaliza Validity) | Aplicar el protocolo A7: baseline trivial, validación independiente, n efectivo declarado |
| R6 | Imágenes y video generados con IA sin marca visible; uso de IA no declarado | Media | Declararlo según la guía 2026 |
| R7 | Sede: Palermo (CABA) abre solo el sábado de 9 a 18 h | Logística | Q5 al Local Lead |
| R8 | El repo de ASTRA es privado y no tiene LICENSE | Solo si se reutiliza | No aplica si se cumple R1 |

## 3. Consultas listas para enviar (en inglés, breves)

Para el Local Lead de la sede elegida, con copia al GO team (Space Apps Connect o `github.com/nasa/spaceapps/discussions`). **Guardar las respuestas por escrito.**

1. **Q1.** "The FAQ says teams may not begin working on the challenges prior to the hackathon. Does that allow pre-event research — reading the challenge summaries, studying public NASA datasets, creating free data accounts (Earthdata Login, FIRMS MAP_KEY) — as long as no project code or challenge-specific data processing happens before November 14?"
2. **Q2.** "Before the event, one of our members built a private personal prototype related to the 'Martian Map' challenge summary (an interactive Jezero terrain map with route computation). Are we allowed to reuse any of that code if we disclose it, or must all project code be written during November 14–15? Would reuse affect local or global eligibility?"
3. **Q3.** "May teams use pre-existing OSI-licensed open-source libraries, cited in the submission?"
4. **Q4.** "Is a team registered in the Universal Event eligible for global judging?"
5. **Q5.** "[Palermo] The venue is open Saturday 9:00–18:00. Can we continue remotely on Sunday and submit before 23:59 local time on November 15?"
6. **Q6.** "Will the 2026 Project Submission Guide keep the 30-second video / 7-slide limit and the AI-use disclosure?"
7. **Q7 (solo si se elige C14).** "Can we arrange, before the event, the availability of a few blind or low-vision volunteers to try our sonification during the hackathon (no code or design work before November 14, informed consent, no personal data recorded)?"
8. **Q8.** "Several public 2026 repositories (e.g., from local events with an earlier 'Stage 1') contain substantial pre-hackathon code. Will global judging consider work done before November 14?"

## 4. Qué no hacer hasta tener respuesta

- No escribir código, pipelines, notebooks ni modelos para ningún desafío.
- No descargar ni preprocesar datos para un desafío concreto.
- No desplegar nada.
- No reutilizar el PR #1 de ASTRA.
- No publicar el repo de ASTRA como "base" del proyecto.

## 5. Fuentes

`spaceappschallenge.org/resources/participant-faqs/`, `/legal/` (07/08/2026), `/resources/project-submission-guide/`, `/resources/judging-awards-guide/` y `/2026/`, todas [SNIPPET]. Repo de ASTRA (`refs/pull/1/head`) [LEÍDO]. Tabla completa en A8 §7.
