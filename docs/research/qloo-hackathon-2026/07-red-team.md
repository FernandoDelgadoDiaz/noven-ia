# 07 — Red team

Fecha: **2026-10-22**. Objetivo: intentar demostrar por qué cada propuesta del top 5 **perdería**. Si no sobrevive, se descarta.

## Riesgos transversales (aplican a todas)

1. **Clave de API tardía.** Aprovisionamiento manual, "unos pocos días hábiles" [H]. Hay repos de competidores en "sample mode / live validation pending" [H], lo que sugiere demoras reales. Si llega el 29–30/10, no hay tiempo para integrar y validar.
2. **Volumen:** 2.189 inscriptos [H]. Si entrega el 15–20% (como en 2025, 344 proyectos sobre 2.847 inscriptos, ~12%) [I], serán ~250–450 entregas. Ganar exige quedar en el top 3 y luego ganar un pitch en vivo.
3. **Piso de calidad alto:** las entregas visibles ya incluyen evidencia por recomendación, servidores MCP y baselines sin Qloo [H]. Nuestro "pulido" no será diferencial por sí solo.
4. **Final en vivo en inglés (05/11)** ante celebridades [H]. Si no podemos presentar con fluidez, perdemos ventaja en el último paso. **Pregunta abierta para el usuario.**
5. **Juzgamiento asistido por IA** posible [H] → el README y la descripción deben ser legibles para un evaluador automático.
6. **Solo dev, 8 días.** Cualquier imprevisto personal o técnico consume el margen.

## A. Green Room — invitados para podcasts y talk shows

| Ataque | Evaluación | Mitigación | ¿Sobrevive? |
|---|---|---|---|
| "Qloo `person` solo tiene celebridades; un podcast de startups no tendrá resultados" | **Probable** [I] | Posicionarla para entrevistas de **entretenimiento, deportes y cultura** (donde los invitados son celebridades). Validar con T2 antes de escribir código de producto | Sí, condicionado a T2 ≥70% |
| "Las recomendaciones serán obvias (los más famosos)" | Plausible | Penalizar la popularidad (`filter.popularity.max`), premiar la tendencia (`trending`) y la novedad (que no haya estado en shows similares) | Sí, a probar en T4 |
| "Es adulación al jurado (Calacanis tiene un podcast; Cedric es host)" | Riesgo real de percepción | Demo principal con un show **que no sea de un juez**; usar el del juez solo como guiño opcional y nunca en la descripción | Sí |
| "Un LLM solo ya sugiere invitados" | Es la objeción central del sponsor | **Baseline medido**: mismo prompt sin Qloo vs. con Qloo en el backtest de invitados reales ocultos. Si no hay mejora medible, no presentarla | Sí, solo si T5 muestra mejora |
| "El RSS no trae los nombres de los invitados de forma estructurada" | Probable en algunos feeds | Extracción con LLM desde títulos y descripciones + confirmación con `/search`; elegir feeds de demo con títulos limpios | Sí |
| "Impacto pequeño: ¿a quién le importa?" | Moderado | Narrativa: ~4M+ de podcasts, bookers pagos y crecimiento de audiencia ligado al invitado [NV: cifras a verificar antes de citarlas] | Sí, sin cifras inventadas |
| "Ya existe en el mercado" (marketplaces de invitados) | Existen por categoría, no por grafo de gusto [I] | Diferenciar: "afinidad de audiencia, no categoría" | Sí |
| "Alguien privado presentará lo mismo" | Desconocido | Ninguna mitigación posible; la ventaja es la ejecución y el backtest | Riesgo aceptado |

**Veredicto: sobrevive, condicionada a T2, T4 y T5.**

## B. Shelf Signal — almacenes

| Ataque | Evaluación | ¿Sobrevive? |
|---|---|---|
| "Qloo no tiene marcas de góndola (lavandina, yerba, galletitas)" | Probable para marcas locales; dudoso para CPG de EE. UU. (Oreo, Tide sí existen como marcas en grafos culturales [NV]) | Condicionado a T6 |
| "Gusto cultural ≠ demanda de góndola; la decisión real se basa en ventas, margen y proveedor" | **Fuerte**: como especialistas en retail sabemos que surtido es margen, rotación y crédito del proveedor. El gusto es una señal secundaria | **Debilita "Impact"** |
| "No podemos mostrar validación sin datos de ventas reales" | Cierto: no usaremos datos de NoVen ni de clientes | Debilita la credibilidad |
| "Es NoVen disfrazado" | Riesgo de sesgo del equipo | Ya penalizada en la matriz |

**Veredicto: sobrevive solo como alternativa (plan B) si A falla en T2/T4 y B aprueba T6/T7.** No es la recomendación principal.

## E. Cruce — LatAm

| Ataque | Evaluación | ¿Sobrevive? |
|---|---|---|
| "El entorno de hackathon no tiene datos de todas las regiones" | Advertencia explícita de Qloo [H] | Condicionado a T8 |
| "El jurado es de EE. UU.; LatAm no le resuena" | Plausible | Debilita "Impact" percibido |
| "Diferencias culturales entre países LatAm difíciles de mostrar en una demo" | Probable | Débil |

**Veredicto: descartada.** Dependencia de datos con advertencia explícita y beneficio incierto.

## G. Matchday — deportes

| Ataque | Evaluación | ¿Sobrevive? |
|---|---|---|
| "Ya existe homestand, con estudio pre-registrado (más riguroso que lo que haríamos en 8 días)" | Cierto [H] | No |
| "Boehly (dueño de clubes) es juez" | Ventaja percibida pero compartida con competidores | — |

**Veredicto: descartada** por falta de diferenciación.

## C. Donor Pulse — ONG

| Ataque | Evaluación | ¿Sobrevive? |
|---|---|---|
| "Es Resonance AI con otra etiqueta" | Probable percepción del jurado (mismos jueces que 2025) | No |
| "No hay audiencia 'donantes' en Qloo" | Cierto [H por ausencia en docs] | Debilita "Tech" |

**Veredicto: descartada.**

## Resultado

| Idea | Resultado |
|---|---|
| A. Green Room | **Sobrevive (condicionada)** |
| B. Shelf Signal | Sobrevive como plan B |
| C, E, G | Descartadas |

El auditor nota que **ninguna idea sobrevive sin condiciones**: todas dependen de recibir la clave a tiempo y de pruebas de cobertura que no podemos ejecutar hoy.
