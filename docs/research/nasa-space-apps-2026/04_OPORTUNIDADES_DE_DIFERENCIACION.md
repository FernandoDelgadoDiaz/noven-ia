# 04 — Oportunidades de diferenciación

Base: `agentes/A5_originalidad.md` (36 búsquedas, todas [SNIPPET]), `A10_huecos_SAR_trends_SPHEREx.md` §3.3, §4.3 y §5.3, contrastadas con los competidores de `03`.

**Regla de esta etapa:** son direcciones conceptuales. No hay soluciones ni código. Nada de esto se construye antes del 14/11 (ver `08`).

**Notación:**
- **N:** característica novedosa (no se encontró a nadie que la haga).
- **V:** ventaja competitiva real (alguien con una necesidad concreta la elegiría).
- Una idea puede ser N sin ser V. "No encontrado" no significa que no exista.

## 1. Tabla por desafío (hasta 3 direcciones)

| ID | Dirección | Problema y usuario | Por qué las alternativas no alcanzan | Diferencia y evidencia | ¿Demostrable en 48 h? | Qué NO se puede afirmar | Qué la invalidaría | N / V |
|---|---|---|---|---|---|---|---|---|
| C01 | 2-A Gazetteer marciano con certeza por objeto | Público escolar: "¿qué sabemos realmente que está ahí?" | For All Moonkind cubre la Luna; para Marte no se encontró un catálogo [SNIPPET] | Cada objeto se marca como observado (imagen identificada), inferido o desconocido | Sí | Masa total precisa; exhaustividad | Que exista un catálogo marciano | N probable / V baja (Storytelling) |
| C01 | 2-B Del objeto al relato (retrorreflectores, etc.) | Público | Muchos museos digitales | — | Sí | — | Saturación | N baja |
| C02 | D1 ¿Tendencia o cambio de instrumento? | Analistas y docentes | Ninguno de los 15 repos cruza los puntos de cambio con fechas de transición de sensor o versión ni con una segunda fuente [LEÍDO A10] | La ruptura detectada se contrasta con el calendario de productos y con una fuente independiente | Sí (POWER en S3 sin login) | Que una ruptura coincidente sea un artefacto: solo sospecha | Que el enunciado restrinja a una variable de un solo sensor sin cambios de versión | N media / V media |
| C02 | D3 ¿Cuántos años más hacen falta? (potencia, tamaño de efecto detectable) | Público y prensa | Solo un repo dice "insufficient data" | Estimar los años necesarios dados la varianza y la autocorrelación | Sí | Predicciones de la tendencia futura | Que se perciba como demasiado abstracto | N media / V media |
| C02 | D2 Concordancia entre productos NASA de la misma variable | Docentes, decisores | Cada repo elige una sola fuente | — | Sí | Cuál producto es "el verdadero" | Fuentes no independientes (MERRA-2 y POWER) | N baja-media |
| C03 | 6-A Entrenador listo para el aula, sin conexión, en castellano | Docentes de habla hispana | La barrera documentada de los docentes es organizar el contenido [SNIPPET] | Actividad de 40 min con rúbrica | Sí | Mejora de aprendizaje | Mission X en castellano | N baja / V baja-media |
| C04 | 4-B Sensibilidad de la iluminación a la elipse de aterrizaje | Planificadores, educación | Moon Trek calcula por punto; IM-2 terminó por la sombra [SNIPPET] | La elipse se integra al análisis | Arriesgado (horizontes LOLA) | Que habría salvado IM-2 | Herramientas internas de proveedores o NASA | N media / V baja |
| C04 | 4-A Libro mayor de resultados por carga útil CLPS | PI, prensa | No hay un balance consolidado [SNIPPET] | Unidad de análisis = carga útil | Sí | Tasas de éxito con significación | **Encaje dudoso con el resumen** (sitios y fechas) | N probable / V media / ajuste bajo |
| C05 | 5-A Monitor que declara su tasa de falsas alarmas | Tripulación, cirujanos | Los prototipos hablan de "alarmas" sin presupuesto | Falsas alarmas esperadas por semana con el umbral actual | Con datos simulados | Validez clínica | Datos sin etiquetas | N moderada / V baja |
| C06 | D1 ¿Cambio real o artefacto? (pares de control) | Analista municipal, periodista | Los repos lo descalifican con un disclaimer pero no lo cuantifican [LEÍDO A10] | Dispersión ΔdB "sin evento" del mismo píxel; km² que superan esa dispersión | Sí, si hay ≥3 adquisiciones comparables | Causa (inundación o deformación) | <3 adquisiciones comparables; issue de calibración PROVISIONAL dominante | N media / V media |
| C06 | D2 Agua estacional bajo nubes con banda L | Gestores de humedales | OPERA DSWx-S1 ya mapea agua | Agua bajo dosel (banda L) | Difícil | Superar a OPERA | Producto NISAR de agua publicado | N baja-media |
| C07 | 10-A "Lo que ya cambió en tu campo" (observado) | Productores con desconfianza de las proyecciones | Las herramientas apuntan a proyecciones [SNIPPET]; no se buscó INTA | Registro observado de 20–40 años verificable con la memoria del productor | Sí | Recomendaciones de cultivo | Herramientas del INTA o del SMN equivalentes (no buscadas) | N moderada / V plausible |
| C08 | 8-A Mapa de discrepancias 1 g / µg | Ingenieros de seguridad de materiales | "No hubo comparación sistemática" [SNIPPET] | Muestra dónde el Test 1 deja de ser conservador | Solo si el enunciado trae datos comparables | Que un material sea seguro | Comparación publicada después de 2018 | N plausible / V condicional |
| C09 | 9-A Puente de la serie de referencia (Aqua→VIIRS) | Organismos con conteos oficiales (INPE seguro; CONAE no verificado) | La armonización NASA es de área quemada a 0,25°; el paper de fusión de 2026 busca completitud, no continuidad [SNIPPET] | Función de transferencia por región y estación con incertidumbre; cuánto del "récord" de 2027–2028 sería artefacto | Sí, en 1–2 regiones | Actividad de fuego real; validez fuera de la región; demanda de INPE o CONAE | Método de transición publicado por INPE o CONAE; un enunciado que pida otra cosa; **un competidor que ya estratifique por región y mes (FireCal y Kiln Watch lo hacen en parte)** | N **dudosa** frente a `03` / V plausible |
| C09 | 9-B "Silencio confiable" (observado / no observado / mala calidad) | Brigadista o analista | ARSET pide verificarlo a mano [SNIPPET] | Tres estados explícitos | Parcial (nivel 2 pesado) | Que "observado sin fuego" garantice ausencia | Que FIRMS o el visor de CONAE ya lo muestren | N incierta / V real si no existe |
| C10 | 3-B Análogos de iluminación del polo sur lunar | Ensayos de visión y navegación | No se encontró nada | Geometría solar y relieve comparables | Sí | Equivalencia térmica o de vacío | Literatura existente | N probable / V incierta |
| C10 | 3-A Índice descomponible | Planificadores de campañas | — | **Ya tomado** por terrestrial-analog-finder y ShadowAstra ("false friends", puntaje según la tarea) [CÓDIGO A2a] | — | — | — | N baja |
| C11 | 1-A Mapa que muestra dónde no se puede confiar en él | Planificadores, educación | Ningún repo cuantifica la incertidumbre por resolución [INFERENCIA] | Se apoya en el negativo de E1 | Sí | Seguridad de ruta | **Riesgo de reglas** (análisis previo); saturación | N media / V baja |
| C12 | — | — | — | Lo obvio ya está validado (inyecciones, recuperación) | — | "Planet X" | — | N baja |
| C13 | 7-A Juego que puntúa la gestión de márgenes | Estudiantes | Space Actuary puntúa valor esperado contra óptimo | Falla explicada por el margen consumido | Sí | Fidelidad de ingeniería; aprendizaje | Que Space Actuary o Δv Arquitecto ya lo hagan (parcialmente) | N baja / V baja |
| C14 | 11-A Sonificación evaluada con personas ciegas o con baja visión durante el hackatón | Personas con discapacidad visual | No se encontró una evaluación con datos climáticos [SNIPPET]; los equipos admiten no haber validado | Prueba pequeña (n = 2–5) con tarea medible y tasa de acierto | Solo si se consiguen participantes | Validez estadística; "accesible" en general | Que el enunciado apunte a lo artístico; que ya exista una prueba así | N probable / V real (Galactic Impact, Art & Tech) |

## 2. Novedad sin ventaja (descartadas)

| Idea | Por qué no es ventaja |
|---|---|
| Filtrar focos industriales en C09 | FIRMS ya tiene una máscara de anomalías estáticas desde febrero de 2025 [SNIPPET] |
| Decisión médica según el inventario a bordo (C05) | NASA CDS ya lo plantea [SNIPPET] |
| Más capas, 3D o Street View en C11 | Protikriti ya lo tiene |
| Calibración VIIRS↔MODIS con IC y test de quiebre (C09) | Kiln Watch ya lo tiene |
| Clasificador de extinción de llama con SHAP (C08) | Hay al menos 3 repos con eso |
| Mann-Kendall + Sen (C02) | Commodity: casi todos los repos lo usan |
| Chatbot "pregúntale a la NASA" | Patrón repetido; aporta riesgo de alucinación |

## 3. Lección transversal (hipótesis)

Con semanas de ventaja de los competidores y el pulido abaratado por la IA, el único diferencial que **no se puede copiar en días** es responder una pregunta que los demás no se hicieron y **mostrar un número validado contra una referencia independiente**. Esto aplica el protocolo de A7: baseline trivial, validación por grupo o espacial, producto independiente y n efectivo declarado. **Ninguna dirección cumple las dos condiciones con evidencia fuerte.** Las mejor posicionadas son C02-D1/D3, C06-D1, C14-11-A y C09-9-A/9-B (ver `05` y `07`).

## 4. Fuentes

Tablas completas en A5 §6 y A10 §8. Todas son [SNIPPET] salvo los repos [CÓDIGO].
