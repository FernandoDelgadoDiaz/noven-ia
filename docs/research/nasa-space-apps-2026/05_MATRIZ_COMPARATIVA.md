# 05 — Matriz comparativa de los 14 desafíos

Script reproducible: `experimentos/matriz.py`; salida: `experimentos/matriz_salida.txt`. Ejecutar con `python3 -I experimentos/matriz.py`.

## 1. Escala y criterios

Escala de 1 a 5 por criterio: **5 = mejor para nosotros**. En los criterios de riesgo, 5 significa **menos** riesgo.

| Crit. | Nombre | Qué mide | Peso base | Por qué ese peso |
|---|---|---|---|---|
| A | Ajuste al enunciado | Qué tan bien la mejor dirección conocida responde al resumen publicado | 8 | Es necesario, pero casi todas las direcciones encajan; discrimina poco |
| B | Originalidad potencial | Si la mejor dirección es N (`04`) | 12 | Creativity es un criterio oficial |
| C | Diferenciación frente a competidores | Distancia entre lo que podríamos hacer en 48 h y el mejor competidor verificado (`03`) | **15** | Es el criterio dominante: todos los desafíos tienen rivales con semanas de ventaja |
| D | Valor para usuarios | Necesidad documentada de un usuario identificable | 12 | Impact es un criterio oficial y H1 lo respalda (`02`) |
| E | Factibilidad en 48 h | Probabilidad de terminar algo honesto empezando el 14/11 | 12 | La regla de trabajo previo nos obliga a empezar de cero |
| F | Disponibilidad de datos | Acceso sin fricción, verificado en S3 o API (A4, A10) | 8 | Necesaria; parcialmente redundante con E |
| G | Calidad de demo posible | Contraste legible en 30 s o 7 diapositivas (A6) | 10 | El jurado global ve primero el demo |
| H | Rigor científico alcanzable | Validación creíble posible en 48 h (A7) | 10 | Validity es un criterio oficial |
| I | Riesgo legal y reglamentario | Licencias, datos personales, sujetos humanos, trabajo previo | 5 | Bajo en casi todos; alto solo donde hay activo previo o personas |
| J | Potencial ante el jurado | Encaje con alguna de las 10 categorías y narrativa | 8 | Los premios son por categoría, no por desafío |

**Los activos de ASTRA no son un criterio.** No se inventan probabilidades de ganar.

## 2. Puntuaciones

Las celdas con `*` tienen **evidencia insuficiente**: dependen del enunciado del 28/10, de datos que no se pudieron probar desde aquí o de una logística no verificada.

| ID | A | B | C | D | E | F | G | H | I | J | Puntaje base (0–100) | Justificación breve |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C02 Trend Detective | 4 | 3 | 3 | 3 | 5 | 5 | 3 | 4 | 5 | 3 | **73,6** | Datos en S3 sin login; rigor 4 (A10); MK es commodity, pero las preguntas D1/D3 no aparecen en 15 repos; demo sutil en 30 s |
| C14 Jukebox | 4 | 3 | 3 | 4 | 4* | 4 | 3 | 3 | 4* | 4 | **70,6** | Accesibilidad con usuario real; la prueba con usuarios no aparece; *conseguir participantes y aspectos éticos; el audio cuesta en un video subtitulado |
| C09 MODIS/VIIRS | 5 | 3* | 2 | 4 | 3 | 3 | 4 | 4 | 5 | 4 | **70,2** | Necesidad fechada (fin de MODIS); literatura sólida; *la novedad de 9-A frente a Kiln Watch y FireCal es dudosa; credenciales FIRMS/Earthdata |
| C13 Mission Game | 4 | 2 | 2 | 3 | 4 | 5 | 3 | 4 | 5 | 3 | 65,8 | Fácil y con datos simples; Space Actuary y Δv Arquitecto ocupan el espacio |
| C01 Abandoned | 4 | 2 | 2 | 2 | 5 | 4 | 4 | 4 | 4 | 3 | 65,2 | Demo fácil; One-Way Manifest es muy fuerte |
| C03 Junior Trainer | 4 | 1 | 1 | 3 | 5 | 5 | 4 | 4 | 5 | 3 | 64,8 | Lo más fácil; Sol Keeper casi es un producto |
| C07 Field Shift | 4 | 2 | 2 | 4 | 4 | 4 | 3 | 3 | 5 | 3 | 64,6 | Necesidad real; tema premiado en 2024 y 2025; competidores con CMIP6 |
| C10 Analogs | 4 | 3 | 2 | 3 | 3 | 4 | 4 | 3 | 5 | 3 | 64,2 | El índice transparente ya está hecho; 3-B es N probable |
| C04 CLPS | 4 | 3 | 2 | 3 | 2 | 4 | 3 | 4 | 5 | 3 | 61,8 | Competidores validados contra PGDA; horizontes LOLA pesados |
| C06 SARs | 4 | 3 | 4 | 3 | 2* | 2* | 3 | 3 | 4 | 3 | 61,6 | Pocos rivales con datos reales; *pares, HDF5 y Earthdata no probados aquí |
| C11 Martian Map | 5 | 2 | 1 | 2 | 4 | 5 | 3 | 3 | 3 | 3 | 58,0 | Saturación máxima; E1 debilita la tesis de ruteo; I=3 por el riesgo de trabajo previo (si se rehace desde cero, I=4) |
| C05 Health | 4 | 2 | 3 | 2 | 4 | 2 | 3 | 2 | 4 | 3 | 56,6 | Datos simulados; rigor 2; afirmaciones médicas |
| C08 Flame | 4 | 3* | 2 | 2 | 2* | 2* | 3 | 3 | 5 | 3 | 54,2 | *Datos no verificables (PSI); el negativo honesto ya lo practican otros |
| C12 SPHEREx | 4 | 1 | 1 | 2 | 2 | 4 | 4 | 3 | 5 | 4 | 53,2 | Lo obvio ya está validado; "Planet X" no es sostenible |

## 3. Análisis de sensibilidad

**Rango de cada desafío bajo 6 juegos de pesos** (detalle en `experimentos/matriz_salida.txt`):

| ID | Base | Iguales | Demo/presentación | Rigor/ciencia | Competencia dura | Sin C (ignora rivales) |
|---|---|---|---|---|---|---|
| C02 | **1** | **1** | **1** | **1** | **1** | **1** |
| C14 | **2** | 3 | 3 | 3 | **2** | 4 |
| C09 | 3 | **2** | **2** | **2** | 3 | **2** |
| C13 | 4 | 4 | 6 | 4 | 5 | 5 |
| C01 | 5 | 8 | 5 | 6 | 7 | 6 |
| C03 | 6 | 5 | 4 | 5 | 10 | 3 |
| C07 | 7 | 7 | 8 | 9 | 8 | 7 |
| C10 | 8 | 6 | 7 | 8 | 6 | 8 |
| C04 | 9 | 9 | 10 | 7 | 9 | 9 |
| C06 | 10 | 11 | 12 | 10 | **4** | 12 |
| C11 | 11 | 10 | 9 | 11 | 13 | 10 |
| C05 | 12 | 14 | 13 | 14 | 11 | 14 |
| C08 | 13 | 13 | 14 | 12 | 12 | 13 |
| C12 | 14 | 12 | 11 | 13 | 14 | 11 |

**Robustez frente al error de puntuación.** Se hicieron 5.000 simulaciones con ±1 en el 40 % de las celdas, al azar y con los pesos base. Porcentaje de simulaciones en que cada desafío entra en el top 5: C02 96 %, C14 89 %, C09 85 %, C13 46 %, C01 40 %, C03 38 %, C07 37 %, C10 34 %, C04 16 %, C06 15 %, C11 2 %, C05 1,5 %, C08 0,2 %, C12 0,2 %.

**Lectura:**
1. **El top 3 es robusto** (C02, C14, C09) bajo todos los pesos probados y con ruido. Esto no significa que sean buenos en términos absolutos: ver el red team en `07`.
2. **Los puestos 4 a 8 son un empate técnico** (C13, C01, C03, C07, C10). Pequeños cambios de puntaje los reordenan, así que no se debe leer un orden entre ellos.
3. **C06 depende del peso de la competencia.** Es 4.º cuando la diferenciación pesa el 25 %, y 10.º a 12.º en los demás escenarios. Es una apuesta con riesgo de datos.
4. **C11 (Martian Map, desafío de ASTRA) no entra en el top 5 en ningún escenario** y aparece en el top 5 solo en el 2 % de las simulaciones. Queda 11.º con los pesos base.
5. **Los educativos (C03, C13, C01) puntúan alto por facilidad**, no por diferenciación. Cuando se ignora a los rivales, C03 sube al 3.º puesto. Es la trampa de "atractivo al inicio": fácil de hacer, difícil de destacar.

## 4. Limitaciones de la matriz

- Las puntuaciones son juicio del orquestador sobre los informes de los agentes, no mediciones.
- La escala es ordinal: tratarla como intervalo para sumar es una simplificación.
- Los criterios no son independientes (E, F y G están correlacionados).
- La diferencia entre el 3.º (70,2) y el 4.º (65,8) es de 4,4 puntos. Con ±1 en dos celdas de peso medio, la brecha se cierra.
- **Ninguna puntuación usa el texto de los enunciados completos.**

## 5. Selección de finalistas para el red team

Se tomaron los cuatro primeros con los pesos base (C02, C14, C09, C13) y **C06**, el único que sube al top 4 cuando la diferenciación pesa más. Los no finalistas se entregaron también al red team para que pudiera cuestionar la selección (`agentes/FINALISTAS_PARA_RED_TEAM.md`).
