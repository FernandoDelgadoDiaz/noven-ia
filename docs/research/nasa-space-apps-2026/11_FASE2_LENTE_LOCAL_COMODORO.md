# 11 — Fase 2: lente local (sede Comodoro Rivadavia)

Fecha: 21/10/2026. Base:
- `agentes/B1_problemas_patagonia.md`: problemas patagónicos y su encaje en los 14 desafíos.
- `agentes/B2_datos_CONAE_socias.md`: SAOCOM y otros datos de agencias socias.
- `agentes/B3_jurado_local_y_huecos.md`: sede de Comodoro y ganadores argentinos.
- `agentes/A9c_red_team_local.md`: red team independiente de los candidatos locales.

**Por qué esta fase.** La fase 1 midió la competencia global, sobre todo repos de Bangladesh y de India. Pero el participante compite en **Comodoro Rivadavia**, y ahí el primer filtro es el jurado local. La hipótesis a probar era si un problema patagónico real, medible con datos NASA, da un diferencial que los equipos globales no tienen.

**Estado de la evidencia.** Casi todo es [SNIPPET]: los sitios de noticias, de CONAE, de ASF y los papers estaban bloqueados desde este entorno.

## 1. La sede de Comodoro (B3)

- **Historia y organización:** es sede desde 2024 y la organiza la Agencia Comodoro Conocimiento (municipal). En 2025 tuvo ~430 participantes y entre 34 y más de 40 mentores de INVAP, CONAE, CONICET y UNPSJB. El premio local para el 1.º y el 2.º puesto es un viaje a Bariloche (CAB, Balseiro, INVAP) [SNIPPET].
- **Resultados previos:** los ganadores de 2024 y 2025 "compitieron a nivel global" (probablemente como nominados). **No se encontraron sus nombres ni sus temas, ni la composición del jurado.**
- **Ganadores globales argentinos:**
  - Mars 3D Home (2022) y Aónikenk (2023).
  - **Ninguno trabajó un tema local.** Los dos combinaron un artefacto visual fuerte con un equipo interdisciplinario.
  - Aónikenk tenía trabajo previo propio (RoverTito, 2021).
- **Local Impact global (2021–2025):** los ganadores atacaron problemas de un lugar concreto con datos de observación de la Tierra. Se premió el "potencial", sin validación en campo.
- **No hay criterios que neutralicen el trabajo previo ni bonus por usar datos de agencias socias.**
- **Hueco práctico (hipótesis):** ganar la sede tiene una tasa base mucho mayor que el ~0,1 % global. Además, los mentores presentes pueden servir como revisores expertos durante el evento.

## 2. Candidatos locales y veredicto del red team (A9c)

| Candidato | Hallazgo de la fase 2 | Veredicto A9c | Por qué |
|---|---|---|---|
| **L1. C06 SAR/NISAR + deslizamiento del cerro Hermitte** (17–18/01/2026, más de 90 familias evacuadas) | Problema real y reciente; no se encontró InSAR publicado sobre el Hermitte (B1, B2) | **Sobrevive muy débil.** "Medir el deslizamiento con NISAR" queda **eliminado** | El BETA de NISAR fue una muestra de sitios, sin evidencia de que cubra Comodoro. PROVISIONAL empieza el 17/06/2026, 5 meses después. Un movimiento de ~15 m en días decorrelaciona la interferometría. A 80 m, la zona activa ocupa unos 4 píxeles. Ya hay InSAR en la cuenca (Euillades et al. 2018, Piedra Clavada). TerraPulse ya hace deslizamientos con NISAR. "Desastre local + antes/después" es el diseño por defecto de la guía que circula entre equipos |
| **L2. C02 Trend Detective + Colhué Huapi / Musters / Senguer / polvo** | Bien documentado (Landsat y MODIS 2017/2018; Gassó & Torres 2019; NASA EO 2024: 15–30 eventos de polvo por año) | **Eliminado como "tendencia del área del lago".** **Sobrevive** reformulado como **polvo sobre Comodoro de 2017 a 2026** | El lago está seco desde ~2017, así que la serie reciente es trivial. Gassó & Torres ya cruzaron registros de superficie con TOMS y OMI. Cosentino et al. 2021 vincularon el polvo con el déficit hídrico. Lo que queda abierto es 2017–2026: hay cambios de sensor reales (MODIS→VIIRS, OMI/OMPS, deriva de Terra) y se puede validar con la **visibilidad medida en tierra**. No se encontró monitoreo operativo ni repos 2026 sobre el tema |
| **L3. C14 Jukebox con participantes de Comodoro** | Existe la Escuela Especial 515 (alumnos ciegos y con baja visión), pero son menores | **Sobrevive con condiciones, reforzado** | Hay canales de adultos: la Audioteca "Leer Escuchando" (a cargo de una persona ciega), Espacio Urbano (talleres de música) y el Centro Luis Braille [SNIPPET; vigencia no confirmada]. **Hay que excluir a los menores** |
| SAOCOM (CONAE) como diferencial central | Licencia en línea para argentinos; aprobación en menos de 1 h según una página oficial [SNIPPET] | **Débil** (B2) | Estado de los satélites contradictorio (una ficha da fin de vida el 30/08/2025). No hay espejos en ASF, AWS ni GEE. La licencia restringe la redistribución. InSAR desde imágenes crudas en 48 h sin flujo previo es inviable. No hay antecedentes SAOCOM–NISAR |

**Premisa "el jurado de Comodoro valora lo local":** **no verificada.** Además, si muchos equipos eligen casos locales, lo local deja de diferenciar.

## 3. Efecto sobre la recomendación (`09`)

| Desafío | Antes de la fase 2 | Después de la fase 2 |
|---|---|---|
| **C14 Jukebox** | 1.º, condicionado a conseguir participantes | **1.º, reforzado.** La condición es más alcanzable de lo pensado: hay canales con adultos en Comodoro. Igual hay que confirmarlos antes del 7/11 y excluir a los menores |
| **C02 Trend Detective** | 2.º, con un ángulo copiable en horas | **2.º, con mejor historia local:** "¿cuánto del polvo que llega a Comodoro desde 2017 es real y cuánto es cambio de satélite?", validado con la visibilidad medida en tierra. Mejora levemente, solo ante el jurado local |
| **C06 SARs** | 3.º débil | **Sin cambio o peor:** el caso Hermitte no tiene datos NISAR utilizables para el evento, salvo que la cobertura se verifique |
| SAOCOM / datos de agencias socias | No evaluado | Diferencial débil para 48 h; queda como contraste opcional |

**Diferencial combinado posible (hipótesis, para el red team del 28/10):** C14 con una pieza local. Por ejemplo, sonificar el frame del EIC más una serie de polvo o viento sobre la Patagonia, probado con adultos ciegos de Comodoro. Une el foso no copiable (la prueba con personas) con la historia local. **Esta combinación no pasó por ningún red team.** También hay que confirmar que el enunciado del 28/10 permite sumar series además de los frames del EIC.

## 4. Verificaciones que el participante puede hacer desde su red (sin "empezar a trabajar")

1. **Catálogo de ASF/Vertex:** buscar NISAR sobre Comodoro (solo mirar, sin descargar).
2. **Catálogo de CONAE:** buscar SAOCOM sobre Comodoro (se consulta sin registro, según B2).
3. **Contactos de C14:** consultar a la Audioteca "Leer Escuchando", a Espacio Urbano y al Centro Luis Braille sobre la disponibilidad de adultos ciegos o con baja visión el 14 y 15/11. Solo coordinar disponibilidad, sin diseñar nada.
4. **Local Lead de Comodoro:**
   - pedir los ganadores 2024–2025 y sus temas, los criterios y la composición del jurado;
   - preguntar si se puede hacer la prueba con participantes fuera de la sede (consulta Q7 de `08`).

## 5. Fuentes

Tablas en B1, B2, B3 y A9c. Las principales [SNIPPET]:
- noticias de Comodoro sobre el cerro Hermitte (enero de 2026);
- informe SEGEMAR 2002;
- Gassó & Torres 2019;
- Cosentino et al. 2021;
- NASA Earth Observatory 2024 (polvo patagónico);
- Euillades et al. 2018;
- nisar-docs.asf.alaska.edu (BETA y PROVISIONAL);
- argentina.gob.ar (catálogo de CONAE);
- cholilaonline.ar (sede de Comodoro 2024–2026).
