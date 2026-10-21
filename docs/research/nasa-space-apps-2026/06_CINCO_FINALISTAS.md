# 06 — Los cinco finalistas

Selección según `05` §5: los cuatro primeros con pesos base (C02, C14, C09, C13) más **C06**, que sube al 4.º puesto cuando la diferenciación pesa más. El red team (A9) los recibió en orden alfabético, sin ranking ni preferencia. Sus veredictos están en `07`.

## Ficha por finalista (antes del red team)

### C02 — Be An Earth System Trend Detective! (avanzado)

- **Oportunidad:** detectar si una tendencia es real o un cambio de instrumento.
  - Cruzar las rupturas de la serie con las fechas de transición de sensor o de versión de producto.
  - Contrastar contra una segunda fuente independiente.
  - Informar cuántos años más de datos harían falta para que una tendencia hoy no significativa sea detectable (potencia estadística).
- **Por qué llegó:**
  - Primer puesto en los 6 escenarios de pesos y 96 % de robustez.
  - Datos sin credenciales (POWER en S3, CC BY 4.0).
  - Rigor alcanzable 4/5.
  - Ninguno de los 15 repos leídos tiene esas dos preguntas (A10).
- **Debilidad conocida:**
  - Mann-Kendall + Sen es un método commodity.
  - La sutileza estadística cuesta explicarla en 30 s.
- **Competidor más fuerte:** EarthTrendTest (MK estacional con corrección por autocorrelación).

### C06 — Dancing with the SARs (NISAR)

- **Oportunidad:** distinguir cambio real de artefacto.
  - Pares de control sin evento por píxel.
  - Informar los km² que superan esa dispersión.
- **Por qué llegó:** es el único desafío donde la competencia de calidad es baja (2–3 de 14 repos o más procesan datos NISAR reales; A10).
- **Debilidad conocida:**
  - Requiere Earthdata Login.
  - Los HDF5 pesan del orden de GB.
  - El producto es PROVISIONAL.
  - Hace falta encontrar pares comparables durante el evento.
  - Factibilidad 3/5 con evidencia insuficiente.
- **Competidor más fuerte:** TerraPulse.

### C09 — Harmonization of MODIS and VIIRS Hot Spots

- **Oportunidad:** puente de la serie de referencia Aqua→VIIRS para organismos que publican conteos oficiales, con incertidumbre por región y estación. Complemento: el "silencio confiable".
- **Por qué llegó:**
  - La necesidad está fechada: S-NPP terminó el 1–2/11/2026, Terra deja de operar en febrero de 2027 y Aqua en septiembre de 2027.
  - Literatura sólida.
  - Rigor 4/5.
  - Posible ángulo argentino.
- **Debilidad conocida:** saturación máxima de prototipos rigurosos (Kiln Watch, FireCal).
- **Competidor más fuerte:** Kiln Watch.

### C13 — Space Mission Design Game

- **Oportunidad:** un juego que puntúe la gestión de márgenes con presupuestos de misiones reales.
- **Por qué llegó:** puntaje alto en factibilidad, datos y riesgo bajo.
- **Debilidad conocida:** A5 lo había calificado N baja / V baja. Llegó a finalista por facilidad, no por diferenciación (`05` §3, lectura 5).
- **Competidor más fuerte:** Space Actuary.

### C14 — The Earth Information Jukebox

- **Oportunidad:** una sonificación evaluada durante el hackatón con personas ciegas o con baja visión.
  - Tarea medible y tasa de acierto contra el azar.
  - Fidelidad del mapeo declarada.
- **Por qué llegó:**
  - 2.º con pesos base y 89 % de robustez.
  - Usuario real con necesidad clara (accesibilidad).
  - La prueba con personas es el único diferencial que un rival no copia en horas.
- **Debilidad conocida:**
  - Logística de participantes.
  - Un video subtitulado de 30 s transmite mal el audio.
- **Competidor más fuerte:** earth-fm.

## Qué cambió después del red team (resumen; detalle en `07`)

| Finalista | Veredicto A9 | Estado tras A9 |
|---|---|---|
| C02 | Sobrevive con condiciones | Finalista vigente |
| C06 | Sobrevive con condiciones (débil) | Finalista vigente, con riesgo alto |
| C09 | **Eliminado**: 9-A y 9-B ya están implementados (Kiln Watch, FireCal) | Fuera, salvo que el enunciado del 28/10 lo reabra |
| C13 | **Eliminado**: los márgenes ya están en 3 repos y en la guía de diseño por defecto | Fuera |
| C14 | Sobrevive con condiciones | Finalista vigente, con condición de encaje (frames del EIC) |

A9 también cuestionó la selección. C13 no debió entrar, y C04 (dirección 4-B) y C10 son candidatos infravalorados que nadie había atacado. Por eso se hizo una segunda ronda (A9b) sobre esos dos (ver `07` §3).

## Hechos, hipótesis y riesgos

- **Hechos:** competidores y código leídos (`03`).
- **Hipótesis:** el valor para el usuario y el encaje con el jurado (`02` §4).
- **Riesgos:** todo puede reordenarse con los enunciados del 28/10.
