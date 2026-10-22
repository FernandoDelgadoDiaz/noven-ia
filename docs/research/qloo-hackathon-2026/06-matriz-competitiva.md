# 06 — Matriz competitiva

Fecha: **2026-10-22**.

## Método y nivel de incertidumbre

- Escala 1–5. Los cuatro criterios oficiales pesan 25% cada uno [H, reglas]. Los criterios operativos (riesgo, tiempo, costo) **no suman puntaje**: actúan como filtros de viabilidad.
- Los puntajes son **juicios cualitativos** basados en la evidencia de 02–04, **no probabilidades**. La incertidumbre es alta: no hay clave de API, no se conocen las entregas privadas y el jurado incluye celebridades con criterios no observables.
- "Uso de Qloo" se puntúa **condicionado a que aprueben las pruebas de 04**. Si fallan, la idea cae.

## Criterios oficiales (25% c/u)

| Idea | Tech. Implementation (profundidad de Qloo) | Design (producto completo, factible en 8 días) | Potential Impact (problema y audiencia real creíbles) | Quality of Idea (no obvia + dominio) | Promedio oficial |
|---|---|---|---|---|---|
| **A. Green Room** (podcasts/talk shows) | 4 — person/podcast/tv_show + exclusión + trending + explainability + backtest | 4 — flujo único y lineal, fácil de pulir | 4 — booker es un rol real; mercado de podcasts grande | 4 — 0 competidores visibles; no obvia | **4,0** |
| **B. Shelf Signal** (almacenes) | 3 — brand + heatmap; sin SKU | 4 | 3 — problema real, pero el vínculo gusto→ventas es discutible | 4 — 0 competidores; dominio propio genuino | **3,5** |
| **C. Donor Pulse** (ONG) | 3 | 3 — alcance amplio | 3 | 2 — se parece a Resonance AI 2025 | **2,75** |
| **E. Cruce** (LatAm) | 2 — cobertura incierta | 3 | 3 | 4 — hueco geográfico | **3,0** |
| **G. Matchday** (deportes) | 3 | 4 | 3 | 2 — ya existen ≥2 | **3,0** |

Fundamento de las diferencias clave:
- A vs. B en Impact: el valor de A se puede **demostrar en vivo** con datos públicos (backtest con RSS). El de B requiere datos de ventas que no tenemos y que no podemos exponer.
- A en Design: el flujo "pegar link → resultado" es el formato que mejor funciona con jueces que quizá no prueban la app [I].

## Criterios operativos (filtros)

| Idea | Riesgo de incumplimiento | Tiempo estimado (con IA asistida) | Costo | Dependencia crítica | Diferenciación vs 2025 | Diferenciación vs 2026 visible |
|---|---|---|---|---|---|---|
| A | Medio (cobertura de `person`) | 3–4 días | < US$ 20 | Clave + T2/T4 | Alta (ningún ganador en medios) | Alta (0 repos) |
| B | Medio-alto (cobertura de `brand` CPG) | 3–4 días | < US$ 20 | Clave + T6/T7 | Media | Alta (0 repos) |
| C | Medio | 4–5 días | < US$ 20 | Clave | Baja | Alta |
| E | Alto (datos LatAm) | 3–4 días | < US$ 20 | Clave + T8 | Alta | Alta |
| G | Bajo | 3 días | < US$ 20 | Clave | Media | Baja |

Riesgo común a todas (no diferencia entre ideas): **la clave de API**. Sin clave no hay entrega posible (las reglas exigen integrar Qloo).

## Top 5 que pasan al red team

1. A — Green Room
2. B — Shelf Signal
3. E — Cruce
4. G — Matchday
5. C — Donor Pulse
