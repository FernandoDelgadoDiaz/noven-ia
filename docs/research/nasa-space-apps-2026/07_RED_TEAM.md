# 07 — Red team

Base: `agentes/A9_red_team.md` (primera ronda: 5 finalistas, 15 búsquedas, 11 repos clonados) y `agentes/A9b_red_team_C04_C10.md` (segunda ronda: candidatos que A9 señaló como infravalorados). Ambos agentes recibieron el material **sin ranking ni preferencia** y con el mandato de eliminar.

## 1. Veredictos

| Candidato | Veredicto | Motivo principal (evidencia) | Condición para sobrevivir o revivir |
|---|---|---|---|
| **C09** MODIS/VIIRS (9-A puente de referencia; 9-B silencio confiable) | **ELIMINADO** | Kiln Watch ya usa como unidad los "Aqua-MODIS-equivalent fire cell-days", con β por región, mes y pasada, IC por bootstrap y la cadena Aqua←S-NPP←NOAA-20 [CÓDIGO]. También tiene un campo `observed`: "a cloudy monsoon day with zero detections is 'not observed', not 'no fire'" [CÓDIGO]. FireCal calibra por área y mes para 208 países, Argentina incluida [CÓDIGO]. INPE ya planificaba la transición desde 2023 [SNIPPET]. No hay evidencia de que CONAE publique series con "satélite de referencia" | Revive solo si el enunciado del 28/10 pide continuidad con la serie oficial (por ejemplo, si CONAE es la autora) **y** se ataca un hueco que Kiln Watch declara abierto: el eslabón NOAA-21 sin calibrar o la no estacionariedad durante la deriva de Aqua |
| **C13** Mission Design Game (márgenes) | **ELIMINADO** | Los márgenes ya están en Space Actuary (carta "Mass Margin"), en Δv Arquitecto (`DESIGN_MARGIN = 0.10` y eventos con margen < 0) y en mission-control [CÓDIGO]. La guía de diseño que circula entre equipos propone como "killer demo" exactamente "the delta-v margin drops below zero" [CÓDIGO, `Hritu/Challanges`]. A5 ya lo había calificado N/V baja | Ninguna razonable |
| **C06** SARs (pares de control) | **Sobrevive con condiciones (débil)** | El método es DeVries et al. 2020, publicado y con código abierto (`s1flood`) [SNIPPET]. TerraPulse ya umbraliza por MAD de escena y analiza la consistencia en píxeles sin cambio [CÓDIGO]. Los datos son pesados y requieren credencial | Al menos 4–5 adquisiciones de la misma órbita sobre el AOI (verificable el 14/11 con `asf_search`); descarga y recorte en ≤8 h; presentarlo como "DeVries aplicado a NISAR banda L, con auditoría" |
| **C02** Trend Detective (tendencia o instrumento; años para detectar) | **Sobrevive con condiciones** | Ninguno de los 3 repos líderes tiene D1 ni D3 [CÓDIGO]. Pero ambos salen de Weatherhead 1998 (los años necesarios aumentan 50 % o más con los cambios de nivel por instrumento) y **se copian en horas**. D1 necesita un catálogo de transiciones que no existe listo | Datos con transiciones reales; usar como caso la deriva de Terra 2022–2024, documentada por FireCal; validar D3 con simulación AR(1); que el enunciado no entregue datos homogeneizados |
| **C14** Jukebox (prueba con personas ciegas o con baja visión) | **Sobrevive con condiciones** | Es el **único foso que un rival no copia a último momento**. Pero: (a) el resumen pide sonificar **frames del EIC en tiempo real**, y la tarea propuesta evaluaba series; (b) las pruebas con personas ciegas no son nuevas en el campo (Chandra / Arcand et al. 2024, 3.184 participantes; mapas meteorológicos con 5 usuarios), solo lo son entre los repos 2026 visibles; (c) n entre 2 y 5 no permite inferencia; (d) hay riesgos de logística, ética y reglas | Participantes confirmados por escrito antes del 14/11 (organización, no código) con el Local Lead informado; prueba sobre la sonificación de frames del EIC además de series; fidelidad del mapeo declarada; consentimiento informado |
| **C04** CLPS (4-B iluminación y DTE sobre la elipse) | **ELIMINADO** (A9b) | RootVandal/lunar-ops ya lo implementa: 19 puntos a ≤250 m con horizonte LOLA propio, % de puntos donde se cumple la ventana, peor punto, etiqueta ROBUST/FRAGILE, motivación IM-2, clones de error del DEM PGDA 78 y validación contra Barker 2021 [CÓDIGO]. Lunar Horizon Wheel publica una variación de 0–85,5 % dentro de 150 m del borde de Shackleton. Los profesionales trabajan con elipses desde 2012 [SNIPPET] | Solo queda sin cubrir una elipse orientada por vehículo, y no hay elipses CLPS públicas que la sostengan |
| **C10** Analogs, 3-A (índice descomponible) | **ELIMINADO** (A9b) | TerraNova, terrestrial-analog-finder y ShadowAstra ya tienen pesos editables y desglose por criterio [CÓDIGO] | — |
| **C10** Analogs, 3-B (análogos de iluminación polar) | **Sobrevive con condiciones (débil)** (A9b) | ShadowAstra ya tiene un calendario por elevación solar (por ejemplo, McMurdo en agosto ≈ Shackleton) y un laboratorio de sombras [CÓDIGO]. Para ensayar visión y navegación, NASA y la academia prefieren laboratorios (Ames Lunar Lab, CMU) [SNIPPET] | Superar a ShadowAstra en velocidad del Sol (≈15°/h en la Tierra contra ≈0,5°/h en la Luna), en efemérides reales con horizonte y en validación contra PGDA. Además, el 28/10 tiene que incluir la iluminación |

**Resultado neto:** de 7 candidatos atacados, 3 quedan eliminados en firme (C09, C13 y C04-4B, más C10-3A), 2 sobreviven con condiciones moderadas (C02, C14) y 2 sobreviven débiles (C06, C10-3B). **Ninguno sobrevive sin condiciones.**

## 2. Errores de los agentes detectados por el red team

| # | Afirmación | Agente | Resultado |
|---|---|---|---|
| V1 | S-NPP deja de entregar datos el 1–2/11/2026 | A2b | Confirmado (NOAA OSPO/NESDIS, Earthdata) [SNIPPET, 3 fuentes] |
| V2 | MODIS termina con Terra en febrero de 2027 y Aqua en septiembre de 2027 | A5, A7 | Confirmado con matiz: Aqua en "early Fall 2027", en deriva libre desde diciembre de 2021 |
| V3 | INPE usa AQUA_M-T como referencia | A5 | Confirmado. **Omisión de A5:** INPE (2023) ya planificaba la transición |
| V4 | FIRMS no armoniza focos | A2b | Sin contradicción, pero sigue siendo inferencia por ausencia |
| V5 | Nadie hizo pruebas perceptivas con personas ciegas | A5, A7 | **Falso fuera de Space Apps.** Cierto entre los repos 2026 visibles |
| V6 | Solo 2–3 repos NISAR con datos reales | A10 | Ni refutado ni ampliado |
| V7 | Ningún repo NISAR mide la variabilidad sin evento | A10 | **Parcialmente falso** (TerraPulse, MAD de escena) |
| V8 | No existe el estado "observado / no observado" | A5 | **Falso** respecto de competidores (Kiln Watch) |
| V9 | 9-A no está implementado | A5 | **Falso** (Kiln Watch) |
| — | C08 8-A como oportunidad | A5 | Ya implementada ("zona de riesgo oculto" en `samuelakosaonyejekwe/flame-in-freefall`) |
| — | C04 4-A como oportunidad | A5 | No responde al resumen del desafío |

**Lección metodológica:** A5 propuso oportunidades sin cruzarlas con el inventario de código de A2a, A2b y A10. Por eso una "N probable" basada en snippets cayó frente a la lectura de código. Este es el principal error de la primera ronda, y el red team lo corrigió.

## 3. Ataques a la selección y a la premisa

1. **Sesgo de los agentes.** A5, A7 y A10 premian "el negativo o la incertidumbre como diferencial". Pero A7 reconoce que no hay evidencia de que el jurado lo premie, y A3 muestra que los ganadores son mayormente apps para un usuario final (H1). La selección favoreció lo que los agentes saben auditar. **Se acepta la objeción.** Por eso la recomendación final (`09`) prioriza el foso con usuario real (C14) por sobre el foso estadístico (C02).
2. **La saturación por desafío está sobreponderada.** El primer filtro es el jurado **local** (Argentina), y los repos de Bangladesh compiten en su propio evento. Los premios globales son 10 categorías transversales: la competencia relevante en la etapa global son unos 40–45 finalistas de todos los desafíos. **Se acepta en parte.** La saturación sigue importando porque esos rivales pueden llegar a finalistas, pero el criterio C de la matriz (15 %) probablemente sobrestima el peso del competidor más fuerte por desafío.
3. **No apostar a la descalificación de otros.** No hay evidencia de que la regla de trabajo previo se aplique. Un equipo que la cumple parte siempre atrás, sobre todo en desafíos con datos pesados (C06).
4. **¿Conviene participar?** Con ~0,1 % de ganadores y ~0,4 % de finalistas, **ninguna elección de desafío cambia el orden de magnitud** de la probabilidad de un premio global. Participar tiene sentido como aprendizaje, nominación o premio local, y como vitrina.

## 4. Hechos, hipótesis y riesgos

- **Hechos:** el código de los competidores (los veredictos C09, C13, C04 y C10-3A se apoyan en [CÓDIGO]).
- **Hipótesis:** el valor del foso con personas en C14 y la velocidad con que se copia D1/D3 de C02.
- **Riesgos:**
  - el enunciado del 28/10 puede reabrir C09 o cerrar C02 y C06;
  - las métricas de los competidores no se reprodujeron.

## 5. Fuentes

Tablas completas en A9 §8 y A9b. Los clones están en el directorio de trabajo de la sesión (no versionado).
