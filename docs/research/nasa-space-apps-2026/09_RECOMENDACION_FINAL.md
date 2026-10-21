# 09 — Recomendación final (PROVISIONAL)

Fecha: 21/10/2026. **Esta clasificación es provisional y depende de revisar los enunciados completos del 28/10/2026**, que hoy no existen. También depende de las guías de juzgamiento y envío (13/11) y de las respuestas escritas a las consultas de reglas (`08` §3).

## 0. Respuesta corta

**Ningún desafío ofrece una ventaja competitiva convincente para un premio global.** Los 14 tienen entre 7 y 17 repos públicos o más, con prototipos avanzados hechos semanas antes del evento. El red team eliminó tres de los cinco finalistas iniciales (C09 y C13) y los dos candidatos de reemplazo (C04-4B y C10-3A). Ninguno sobrevivió sin condiciones.

Si hay que competir, la mejor opción es **C14, The Earth Information Jukebox**, con una condición que se puede verificar antes del 14/11: tener confirmados participantes ciegos o con baja visión. Si esa condición falla, la alternativa es **C02, Trend Detective**.

**ASTRA queda 11.º de 14 y no se debe usar.**

## 1. Clasificación provisional verificable

| Puesto | Desafío | Estado tras el red team | Base verificable |
|---|---|---|---|
| 1 | **C14 The Earth Information Jukebox** | Sobrevive con condiciones | Matriz: 2.º con pesos base, 89 % de robustez. Único foso no copiable en horas (prueba con personas). A9 §2 |
| 2 | **C02 Be An Earth System Trend Detective!** | Sobrevive con condiciones | Matriz: 1.º en los 6 escenarios, 96 % de robustez. D1 y D3 ausentes en los líderes [CÓDIGO], pero se copian en horas. A9 §2 |
| 3 | C06 Dancing with the SARs | Sobrevive débil | Pocos rivales con datos reales; el método ya está publicado (DeVries 2020); riesgo de datos alto. A9 §2 |
| 3 (empate) | C10 Analogs, dirección 3-B (iluminación polar) | Sobrevive débil | ShadowAstra ya cubre gran parte. A9b |
| 5–7 | C01 Abandoned, C03 Junior Trainer, C07 Field Shift | **No atacados por el red team**; diferenciación baja (C ≤ 2) | Matriz `05`: puntaje por facilidad, no por diferenciación |
| 8 | C09 MODIS/VIIRS | **Eliminado** (revive solo si el 28/10 pide continuidad con la serie oficial) | Kiln Watch y FireCal [CÓDIGO] |
| 9 | C04 CLPS | Eliminado (4-B); 4-A no responde al resumen | lunar-ops [CÓDIGO] |
| 10 | C13 Space Mission Design Game | Eliminado | 3 repos con márgenes [CÓDIGO] |
| 11 | **C11 Martian Map (ASTRA)** | Fuera: no llegó a finalista | Matriz: 11.º con pesos base, nunca en el top 5, 2 % de robustez |
| 12 | C05 Health | Fuera | Datos simulados, rigor 2/5 |
| 13 | C08 Flame in Freefall | Fuera | Datos no verificables; 8-A ya implementada |
| 14 | C12 SPHEREx | Fuera | El líder ya validó con inyecciones; "Planet X" no es sostenible |

**Cómo leer la tabla:**
- Los puestos 1 y 2 están separados por un juicio, no por un número. C02 gana en la matriz; C14 gana después del red team porque su foso no se copia (`07` §3.1).
- Los puestos 5 a 14 no tienen un orden fino.

## 2. Respuestas a las 10 preguntas

**1. ¿Cuál elegiría con mi propio tiempo y dinero?**
- **No pondría dinero.** El tiempo lo pondría en **C14 solo si**, antes del 7/11, hay por escrito de 3 a 5 personas ciegas o con baja visión disponibles durante el evento y el Local Lead lo aprobó (consulta Q7).
- Si no se cumple, elegiría **C02**.
- Si el objetivo fuera solo un premio global, **no participaría con esa expectativa**: la tasa base (~0,1 %) no cambia con la elección del desafío.

**2. ¿Cuáles son los tres mejores y por qué?**
- **C14:** usuario real con una necesidad clara (accesibilidad), datos sin fricción y la única diferencia que un rival no copia el sábado a la tarde.
- **C02:** datos abiertos verificados (POWER en S3), rigor alcanzable 4/5 y preguntas (D1, D3) que ningún líder hace hoy.
- **C06:** la competencia de calidad es baja (2 o 3 rivales con datos reales), pero los datos son pesados, hay que sacar credenciales y el método ya está publicado.

**3. ¿Qué alternativas parecen atractivas pero pierden frente a la competencia existente?**
- **C09 MODIS/VIIRS:** la necesidad es real y tiene fecha, pero Kiln Watch ya hizo la serie "equivalente a Aqua", con IC y el estado "no observado".
- **C04 CLPS:** técnicamente es el más atractivo, pero lunar-ops ya tiene la elipse con robustez, y otros dos competidores están validados contra PGDA.
- **C12 SPHEREx:** tiene el mayor "wow", pero el líder ya validó con inyecciones.
- **C11 Martian Map:** es el desafío del activo propio. Protikriti y al menos otros tres equipos lo superan.
- **Los educativos (C03, C13, C01):** son fáciles de hacer y por eso suben en la matriz, pero están saturados de juegos pulidos.

**4. ¿Qué proyecto podríamos presentar que realmente se diferencie?**

Un **Jukebox validado con sus usuarios**: sonificación en tiempo real de frames del Earth Information Center, con el mapeo del dato al sonido declarado, **probada durante el hackatón** con personas ciegas o con baja visión.
- La prueba tiene **dos rondas**: diseño inicial → resultados → rediseño → segunda ronda.
- Se usan tareas sobre el frame ("¿dónde está la zona más caliente o brillante?") y sobre una serie ("¿sube o baja?").
- El protocolo se escribe y se fecha la mañana del 14/11, antes de la primera prueba.
- El demo muestra el número: "aciertos en la ronda 1 → ronda 2, contra el 50 % del azar, con n participantes". También muestra lo que no funcionó.
- Esto **no se construye ni se diseña antes del 14/11**. Antes solo se organiza la disponibilidad de los participantes, con la autorización escrita del Local Lead.

**5. ¿Qué habría que demostrar para que esa diferencia sea creíble?**
1. Que la prueba ocurrió con personas reales, con consentimiento y sin datos personales: registro anónimo y fechado.
2. Que la tarea mide lo que pide el desafío (frames del EIC), no solo series.
3. Que el mapeo es fiel: es monótono, la escala está declarada y es reproducible.
4. Que hay una mejora entre rondas o, si no la hay, que se informa así.
5. Que no se afirma más de lo que el n permite: es una tasa descriptiva con test binomial por ensayos, no "accesible en general".
6. Que todo lo anterior entra en 30 s o 7 diapositivas.

**6. ¿Qué desafío tiene el mejor equilibrio entre originalidad, utilidad y viabilidad?**
- **C14**, condicionado a los participantes.
- Sin esa condición, **C02** tiene mejor viabilidad, pero su originalidad es frágil: se copia en horas.

**7. ¿Dónde queda ASTRA, sin favorecerlo?**
- **11.º de 14** con los pesos base, entre el 9.º y el 13.º en los escenarios de sensibilidad, y en el top 5 solo en el 2 % de las simulaciones.
- No llegó a finalista.
- **Motivos verificados:**
  1. Saturación máxima: Team Protikriti tiene 241 commits, A* con pendiente ≤15°, tests y demo, y al menos otros 3 equipos hacen ruteo por pendiente en Jezero [CÓDIGO].
  2. E1 mostró que el diferencial técnico de ASTRA (ruteo por pendiente sobre CTX 20 m) no reduce la exposición real.
  3. **Riesgo de reglas alto:** el PR #1 es una app de Martian Map con fecha del 20/10/2026, posterior al anuncio [LEÍDO].
- Lo único reutilizable con riesgo bajo es lo aprendido (E1, protocolo de validación), no el código.
- La decisión E de la investigación anterior **sigue vigente** y esta evaluación la refuerza.

**8. ¿Qué cambiaría el 28 de octubre?**

| Desafío | Si el enunciado completo… | Efecto |
|---|---|---|
| C14 | Prioriza lo artístico sobre la accesibilidad, o no permite contenido EIC en tiempo real | C14 cae; pasa C02 |
| C14 | Nombra la accesibilidad o a usuarios con discapacidad visual | C14 se refuerza |
| C02 | Entrega datos ya homogeneizados o una sola variable sin transiciones de sensor | D1 pierde sentido; C02 baja |
| C09 | Pide continuidad con series oficiales o un "satélite de referencia", o lo firma CONAE | C09 revive solo atacando NOAA-21 o la deriva de Aqua |
| C06 | Entrega escenas curadas | Todos hacen lo mismo; C06 baja |
| C06 | No hay pares comparables sobre un AOI argentino | C06 cae |
| C10 | Incluye la iluminación como criterio | 3-B mejora |
| C04 | Trae elipses o sitios oficiales | Reabrir con cautela: lunar-ops ya tiene robustez espacial |
| Todos | Trae datos curados para C08 o C05 | Reevaluar su factibilidad (hoy 2/5) |

**9. ¿Qué evidencia podría hacer cambiar la recomendación?**
1. No conseguir de 3 a 5 participantes confirmados antes del 7/11, o una respuesta negativa del Local Lead a Q7 → C02.
2. Un repo 2026 que ya haga pruebas con personas ciegas, o que lo publique antes del 14/11 → C14 pierde su foso.
3. Un líder de C02 que agregue "years-to-detect" o el cruce con transiciones → C02 baja.
4. Una respuesta de NASA a Q8 diciendo que el trabajo previo no se considera en el juzgamiento global → el campo se vacía y suben los desafíos con mayor valor de usuario (C09, C07).
5. Que el equipo tenga a alguien con experiencia real en SAR → C06 sube.
6. Las guías del 13/11 con una rúbrica que pondere Validity o la integración de datos NASA por encima del impacto en el usuario → C02 sobre C14.

**10. ¿Cuál es la decisión final y qué no deberíamos construir?**

**Decisión provisional:**
- Inscribirse en NASA Space Apps 2026 con **C14 como opción principal condicionada** y **C02 como alternativa**.
- Enviar ya las consultas Q1–Q8 (`08` §3).
- Reevaluar el 28/10 con los enunciados y el 13/11 con las guías.
- Mantener la decisión E sobre ASTRA.

**No construir:**
- **Nada antes del 14/11**: ni código, ni pipelines, ni descargas específicas, ni el diseño del protocolo de prueba.
- Un planificador de rutas para Martian Map, ni reutilizar el PR #1 de ASTRA.
- Un calendario o calibrador MODIS/VIIRS (Kiln Watch, FireCal).
- Un juego de diseño de misión con márgenes (Space Actuary, Δv Arquitecto).
- Un explorador de iluminación por elipse en CLPS (lunar-ops).
- Un dashboard de salud con telemetría simulada presentado como monitoreo.
- Una "IA que predice incendios en microgravedad" con decenas de ensayos.
- Un "cazador de Planet X".
- Más globos 3D o chatbots como diferencial.
- Un dashboard de Mann-Kendall sin una pregunta propia.

## 3. Hechos, hipótesis y riesgos de esta recomendación

- **Hechos:**
  - la saturación y los competidores, leídos en código;
  - los veredictos del red team basados en código;
  - las fechas de fin de MODIS y S-NPP (3 fuentes coherentes, [SNIPPET]).
- **Hipótesis:**
  - que el jurado valora a un usuario real por sobre una pregunta estadística (H1, `02`);
  - que conseguir participantes es factible en Argentina.
- **Riesgos:**
  - logística y ética de la prueba con personas;
  - desajuste con "frames del EIC";
  - el audio se transmite mal en un video subtitulado de 30 s (mitigación: mostrar el número y el gesto del participante, con consentimiento);
  - todo puede cambiar el 28/10.

## 4. Pendientes obligatorios antes de decidir en firme

1. **28/10:** leer los 14 enunciados y aplicar la tabla de la pregunta 8.
2. Enviar Q1–Q8 y archivar las respuestas.
3. Antes del 7/11: confirmar o descartar a los participantes para C14 (solo organización).
4. **13/11:** leer las guías de envío y juzgamiento 2026.
5. Volver a medir la saturación de C14 y C02 la semana del 9/11.
