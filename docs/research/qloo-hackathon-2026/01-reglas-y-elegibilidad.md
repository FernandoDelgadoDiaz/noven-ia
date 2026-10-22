# 01 — Reglas y elegibilidad (Qloo Agentic Hackathon 2026)

Fecha de consulta de todas las fuentes: **2026-10-22**.
Fuentes primarias: [qloo.devpost.com](https://qloo.devpost.com/) · [Reglas oficiales](https://qloo.devpost.com/rules) · [Updates](https://qloo.devpost.com/updates) · [Developer Guide](https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide).

Convención: **[H]** hecho confirmado en fuente primaria · **[I]** interpretación nuestra · **[NV]** no verificado.

## 1. Fechas (con conversión a Argentina, UTC−3)

| Hito | Hora oficial | Hora Argentina | Estado |
|---|---|---|---|
| Inicio inscripción y entrega | 30/09/2026 09:00 ET (EDT, UTC−4) | 30/09 10:00 | [H] |
| **Cierre inscripción y entrega** (mismo plazo) | **30/10/2026 23:45 ET (EDT)** | **31/10/2026 00:45** | [H] |
| Período de evaluación | 02/11 12:00 ET → 05/11 23:45 ET (EST, UTC−5, tras fin de DST 01/11) | 02/11 14:00 → 06/11 01:45 | [H] fechas; [I] conversión EST |
| Anuncio de ganadores | "on or around" 05/11/2026 15:00 ET | 05/11 17:00 | [H] |
| Final en vivo: top 3 presentan "on air" ante Jason Calacanis, Cedric the Entertainer y Alex Elias, que eligen al ganador | 05/11/2026 | — | [H] (update oficial del 21/10/2026) |

- Al 22/10/2026 la página indica **"8 more days to deadline"** [H].
- No existe una fecha límite separada para pedir credenciales; la clave se pide por formulario y "se emite normalmente en unos pocos días hábiles", con aprovisionamiento **manual** [H]. → **Es el principal riesgo de calendario** (ver 09).
- [I] Entre el 22/10 y el 30/10 hay 7 días hábiles (22, 23, 26, 27, 28, 29, 30). Si la clave tarda 3–4 días hábiles, llega el 27–28/10 y deja ~2–3 días de integración real.

## 2. Premios

| Puesto | Premio | Tipo | Estado |
|---|---|---|---|
| 1.º | US$ 15.000 | Efectivo | [H] |
| 2.º | US$ 6.000 | Efectivo | [H] |
| 3.º | US$ 4.000 | Efectivo | [H] |
| Bonus | Jason Calacanis "will personally invest an additional $25,000 into his favorite entry" | **Inversión, no premio** (no figura en la tabla de premios de las reglas) | [H] texto; [I] naturaleza: no es efectivo garantizado, implica términos de inversión no publicados |

- No hay premios en créditos. Cada proyecto puede ganar un solo premio [H].
- Pago: tras completar *affidavit* y formularios (W‑8BEN para no residentes en EE. UU.) dentro de **10 días hábiles** desde que se envían; entrega del premio **dentro de 60 días** de recibidos los formularios; transferencia o envío postal [H].
- Comisiones bancarias, cambio de moneda e impuestos a cargo del ganador; el sponsor puede retener una parte por normativa fiscal de EE. UU. [H]. [I] Para residente argentino: posible retención del 30% sobre premios de fuente EE. UU. si no aplica tratado (Argentina no tiene tratado de doble imposición con EE. UU.) — **[NV], consultar contador**. También cumplir normativa cambiaria argentina para ingreso de divisas [I].

## 3. Elegibilidad

- Abierto a: individuos mayores de edad en su país de residencia, equipos de individuos elegibles y organizaciones constituidas [H].
- Excluidos: residentes de jurisdicciones donde la ley de EE. UU. o local lo prohíba, "incluyendo Brasil, Quebec, Rusia, Crimea, Cuba, Irán, Corea del Norte" y sancionados por OFAC; empleados/familia de Qloo, Devpost, jueces y sus empleadores [H].
- **Argentina no aparece excluida** [H]. [I] Un desarrollador individual residente en Argentina es elegible, sujeto a la verificación de identidad del ganador.
- **No se requiere empresa constituida** [H] (se puede participar como individuo).
- [I] Riesgo de conflicto de interés: ninguno detectado para nosotros (no tenemos relación con Qloo ni con los jueces).

## 4. Equipos y cantidad de proyectos

- Equipos permitidos; un representante entrega [H]. Las reglas 2026 **no fijan un tamaño máximo** de equipo (en 2025 era hasta 4) [H para la ausencia en el texto consultado].
- Se permiten **múltiples entregas** si cada una es "única y sustancialmente diferente" [H]. [I] No recomendado para nosotros: diluye el tiempo.

## 5. Qué hay que construir

- "Working software application that integrates the Qloo API" y que (a) funcione como herramienta agéntica, (b) esté construida con un framework de agentes, o (c) integre Qloo en un agente existente [H].
- Mensaje del sponsor: "If your submission would work the same without Qloo, you're building the wrong thing" y "We're not looking for demos of what LLMs can already do" [H].
- Ejemplos sugeridos por el organizador (iluminación para clientes de electricistas, comidas para adultos mayores, enfermedades raras) [H] — [I] ya tienen múltiples clones en GitHub (ver 03).

## 6. Requisitos de entrega

1. Link a **demo funcional** probable de punta a punta, **hosteada externamente** (web, APK o TestFlight). No vale "solo local" ni acceso privado [H].
2. URL de **repositorio público** (GitHub, GitLab o Bitbucket) con todo el código, assets e instrucciones [H].
3. Descripción en texto de funcionalidades y qué la hace "Qloo-powered" [H].
4. **Licencia open source** con el archivo detectable y visible en la sección *About* del repo [H].
5. Todo en inglés o con traducción [H].
6. **Video NO requerido** [H]. Pero las reglas dicen: "Judges are not required to test the Project and may choose to judge based solely on the text description, images, and video" [H]. [I] Un video corto sigue siendo recomendable.
7. Si la app tiene login, incluir credenciales de prueba [H].

## 7. Disponibilidad de la aplicación

- Debe estar disponible **gratis y sin restricciones** para sponsor, administrador y jueces **hasta el fin del período de evaluación (05/11/2026 23:45 ET)** [H].
- Las claves de API de hackathon siguen activas hasta el fin del juzgamiento y luego se desactivan [H]. [I] Después del 05/11 la demo dejará de funcionar con Qloo; no hay obligación de mantenerla.

## 8. Reutilización de componentes preexistentes

- Proyectos nuevos o, si existían antes del 30/09/2026, deben haber incorporado Qloo después de esa fecha y explicar la actualización significativa [H] (el texto oficial tiene un error tipográfico: "must have Qloo 4after the start…").
- Se permite open source de terceros si se cumple la licencia y se construye algo que lo extienda [H].
- Se permite contratar asistencia técnica si el resultado es obra y propiedad del participante [H].
- [I] **No reutilizar código de NoVen IA, BarberOS u otros proyectos privados**: el repo debe ser público y open source, lo que expondría código propietario. Repositorio nuevo e independiente.

## 9. Propiedad intelectual y licencia

- La obra sigue siendo del participante [H].
- Qloo obtiene licencia no exclusiva para juzgar; Qloo y Devpost pueden promocionar la entrega y usar nombre, imagen y voz durante el hackathon y **3 años** después [H].
- La licencia open source obligatoria implica que **cualquiera puede reutilizar el código** [I].
- No publicar respuestas de Qloo en el repo público (la caché privada en servidor sí está permitida) [H, developer guide].

## 10. Criterios de evaluación

- **Etapa 1 (pass/fail):** encaja razonablemente con el tema y aplica razonablemente las APIs requeridas [H].
- **Etapa 2 — cuatro criterios con igual peso** (25% c/u) [H]:
  1. *Technological Implementation*: uso profundo y hábil de Qloo; implementación no trivial.
  2. *Design*: experiencia de producto completa y coherente, no una prueba de concepto.
  3. *Potential Impact*: caso creíble y específico de un problema real para una audiencia real, resuelto en lo demostrado.
  4. *Quality of the Idea*: uso creativo y no obvio de Qloo; comprensión genuina del dominio.
- Desempate: por orden de criterios (primero *Technological Implementation*) [H].
- El juzgamiento puede usar "expert panels, peer review, **automated AI-driven analysis**, or any combination" [H]. [I] Es probable un pre-filtro automatizado sobre ~2.189 inscriptos: la descripción y el README deben ser explícitos y fáciles de evaluar por un LLM.
- Jueces listados: Jason Calacanis, Mike Diolosa (CTO Qloo), Nicole Seligman, Todd Boehly, Cedric the Entertainer, Michael Abrams (Live Nation) [H]. La final menciona además a **Alex Elias** (no listado como juez en la página principal) [H].

## 11. Obligaciones posteriores

- Completar formularios y verificación de identidad y rol [H].
- **Finalistas: deben poder aparecer en vivo el 05/11 y estar disponibles para preparación previa** [H]. [I] Implica presentación oral en inglés ante una audiencia grande; es un requisito práctico para competir por el 1.º puesto.
- Publicidad: cesión de uso de nombre, imagen, opiniones y país de residencia sin compensación adicional [H].
- Disputas: arbitraje AAA, ley de Nueva York [H].

## 12. API Qloo: acceso, cuotas y costos

- Acceso por [formulario de Google](https://forms.gle/zz12orkLHTAneLGz6); se puede pedir sin idea definida [H].
- Base URL exclusiva `https://hackathon.api.qloo.com`; header `X-Api-Key` [H].
- Cuotas de tasa y mensuales "suficientemente altas"; ampliables pidiendo en Discord #api-help [H]. Valores numéricos **no publicados** [NV].
- Costo: no se menciona costo para participantes [H]. [I] Gratuita durante el hackathon.

## 13. Pendientes de verificar

- [NV] Tiempo real de emisión de la clave en esta semana de cierre (consultar Discord).
- [NV] Cuotas numéricas.
- [NV] Tratamiento fiscal concreto del premio para residente argentino.
- [NV] Formato exacto de la final en vivo (zona horaria, duración, idioma, si es remota).

## Acciones que requieren autorización del usuario (no ejecutadas)

- Registrarse en Devpost.
- Enviar el formulario de clave de API.
- Unirse al Discord del hackathon.
