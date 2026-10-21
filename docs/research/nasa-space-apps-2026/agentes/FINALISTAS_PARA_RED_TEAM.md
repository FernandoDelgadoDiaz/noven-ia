# Finalistas entregados al red team (A9)

Orden alfabético por ID. **No se indica ranking ni preferencia.** Cada finalista viene con la oportunidad de diferenciación que propusieron los agentes A5 y A10. El red team ataca el desafío y la oportunidad juntos.

Contexto común: todos los desafíos tienen entre 7 y 17 repos públicos 2026 o más, varios con prototipos avanzados hechos antes del hackatón (A1, A2a, A2b, A10). El equipo propio respetaría la regla del FAQ: no escribe código de la solución antes del 14/11/2026 (A8). Tiene 48 h, entre 1 y 6 personas y sede en Argentina.

## C02 — Be An Earth System Trend Detective! (avanzado)
- **Oportunidad (A10 D1 + D3):** "¿tendencia real o cambio de instrumento?". Las rupturas detectadas en series NASA se cruzan con las fechas de transición de sensor o versión de producto y con una segunda fuente independiente. Además, la herramienta muestra cuántos años más de datos harían falta para que una tendencia no significativa sea detectable (potencia estadística, al estilo Weatherhead 1998).
- Evidencia: `agentes/A10_huecos_SAR_trends_SPHEREx.md` §4.

## C06 — Dancing with the SARs (NISAR)
- **Oportunidad (A10 D1):** "¿cambio real o artefacto?". Antes de interpretar un mapa de cambio de backscatter NISAR, se audita la variabilidad del mismo píxel en pares de control sin evento y se informan los km² que superan esa dispersión.
- Evidencia: `agentes/A10_huecos_SAR_trends_SPHEREx.md` §3.

## C09 — Harmonization of MODIS and VIIRS Hot Spots
- **Oportunidad (A5 9-A, más 9-B como complemento):** un "puente de la serie de referencia" para organismos que publican conteos oficiales contra un satélite de referencia (INPE usa Aqua MODIS; CONAE sin verificar). Consiste en una función de transferencia Aqua→VIIRS por región y estación, con incertidumbre explícita, para una región argentina o sudamericana, que muestre cuánto de un "récord" o un "descenso" de 2027–2028 sería un artefacto del cambio de sensor. Complemento: estado "observado sin fuego / no observado / mala calidad" en lugar de un vacío ambiguo.
- Evidencia: `agentes/A5_originalidad.md` §3.9, `A2b_competidores_tierra.md` §4.1, `A7_rigor_cientifico.md` §4.9.

## C13 — Space Mission Design Game
- **Oportunidad (A5 7-A):** un juego que puntúa la gestión de márgenes (masa, potencia, datos) con presupuestos de misiones reales y explica cada fallo según el margen que se consumió.
- Evidencia: `agentes/A5_originalidad.md` §3.7, `A2a_competidores_espacio.md` §4.7.

## C14 — The Earth Information Jukebox
- **Oportunidad (A5 11-A):** una sonificación de contenido del Earth Information Center evaluada durante el propio hackatón con personas ciegas o con baja visión (n = 2–5, tarea concreta, tasa de acierto contra el azar), con fidelidad del mapeo declarada.
- Evidencia: `agentes/A5_originalidad.md` §3.11, `A2b_competidores_tierra.md` §4.3, `A7_rigor_cientifico.md` §4.11.

## No finalistas (para que el red team pueda cuestionar la selección)
C01 Abandoned, C03 Junior Trainer, C04 CLPS, C05 Health, C07 Field Shift, C08 Flame in Freefall, C10 Analogs, C11 Martian Map (desafío de ASTRA), C12 SPHEREx.
