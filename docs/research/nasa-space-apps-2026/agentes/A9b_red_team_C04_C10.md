# A9b — Segundo red team: C04 (dirección 4-B) y C10 (direcciones 3-B y 3-A)

Fecha: 2026-10-21. Agente: A9b. Mandato: intentar **refutar y eliminar**. No recibí preferencias del orquestador.

Etiquetas (BRIEF): **[LEÍDO]** fuente completa · **[CÓDIGO]** archivo leído en un clon · **[SNIPPET]** resumen del buscador · **[INFERENCIA]** · **[NO VERIFICADO]**.

---

## 1. Misión y método

- Leí BRIEF, FINALISTAS, A9 completo y las secciones de C04 y C10 en A1, A2a (§4.3 y §4.4), A4, A5 (§3.3 y §3.4), A6 y A7.
- Hice **10 WebSearch** (cupo ≤35). No usé WebFetch.
- Cloné 11 repos con `git clone --depth 1 --filter=blob:none --no-checkout` y sparse-checkout de texto (`*.md`, `*.ts`, `*.tsx`, `*.py`, `*.js`…) en `/tmp/claude-0/-home-user-noven-ia/7029a718-8690-52ad-a08e-e11704dd6284/scratchpad/redteam2/`. Solo lectura y grep, **sin ejecutar nada**. Fecha del último commit de cada uno:

| Repo | Desafío | Último commit |
|---|---|---|
| NetRunnerXD/lunar-horizon-wheel | C04 | 2026-10-13 |
| samuelakosaonyejekwe/lunahorizon | C04 | 2026-10-03 |
| WarRinOP/sightline | C04 | 2026-10-10 |
| gmrafi/cfsbr-selensync | C04 | 2026-10-12 |
| partofcosmos-site/lunarsite-compass | C04 | 2026-10-02 |
| Hamzaslam1996/lunarwindow | C04 | 2026-09-26 |
| RootVandal/lunar-ops | C04 | 2026-10-09 |
| ABRUBAB/ShadowAstra_Atlas | C10 | 2026-10-19 |
| shishir-kuet/terrestrial-analog-finder | C10 | 2026-10-10 |
| KraKEn-bit/TerraNova | C10 | 2026-09-30 |
| JimmyGuajan/twinworlds | C10 | 2026-10-13 |

- Términos de grep en C04: `ellips|dispersion|uncertaint|3-sigma|landing error|landing accuracy|sensitiv|monte carlo|perturb|robust|within N m`.
- Términos de grep en C10: `sun elevation|low sun|grazing|illuminat|insolation|weight… slider|breakdown`.

---

## 2. C04 CLPS Lunar Mission Browser — dirección 4-B (iluminación y DTE sobre la elipse de aterrizaje)

### 2.1 Ataque principal: 4-B ya está implementada, con la misma motivación (IM-2)

**RootVandal/lunar-ops (LUNAR//OPS)** [CÓDIGO: `README.md`, `docs/METHODS.md` §2.14 método B, `pipeline/lunarops/dispersion.py`, `web/app.js`, `docs/DECISIONS.md` D-008 y D-023]:

- **Qué calcula.** "Robustness to landing error": toma **19 puntos** (el centro, 6 a 125 m y 12 a 250 m). Cada punto tiene **su propio horizonte de terreno**, calculado con los mismos DEM LOLA anidados, y su propia serie de Sol y de DTE.
- **Motivación.** La declara textualmente: "IM-2 landed ≈ 250 m off target", con cita a Spaceflight Now del 2025-03-07. Es la misma motivación de 4-B.
- **Qué entrega.**
  - El porcentaje de puntos en que la ventana sigue cumpliendo los requisitos.
  - El **peor punto y por qué falla**.
  - Métricas pesimista y optimista.
  - Una etiqueta ROBUST / MARGINAL / FRAGILE.
  - En el mapa sitio × fecha, los días viables que se sostienen en ≥90 % de los puntos aparecen en verde oscuro.
  - Texto de la app: "None of the N feasible landing days survives a 250 m landing error … every solution is fragile."
- **Además (método A)** recalcula todo sobre los **clones Monte Carlo de error del DEM** que publica NASA (PGDA producto 78, Barker et al. 2021) y reproduce la Tabla 2 de Barker: 88,32 % frente a 88,12 % en el percentil 1.
- **Su limitación declarada** es el único resto de 4-B: "uniform sampling of the landing area (a real dispersion ellipse depends on the vehicle)". Muestrea un **círculo**, no una elipse orientada según el vehículo.
- **Estado.** Dice haber sido desarrollada en octubre de 2026, "not a hackathon submission". Aun así es pública, citable y copiable.

**Lunar Horizon Wheel** [CÓDIGO: `METHODS.md` l. 70 y l. 74] cuantifica el fenómeno, aunque no lo convierte en una función de la app:

- "PGDA 60 m values within 150 m of that point range from 0 to 85.5%" (borde de Shackleton).
- Pasar del DEM de 40 m al de 240 m cambia el % de horas de sol hasta en 26 pp.

O sea: que la iluminación cambia mucho en unos 100 m ya está medido y publicado por un competidor.

Otros repos de C04:

- **SIGHTLINE**: incertidumbre por Monte Carlo del DEM con los clones PGDA 78 (`DATA_VERIFICATION_REPORT.md` F2). No encontré dispersión del alunizaje [CÓDIGO].
- **lunarwindow**: valida "the best point within a stated search radius" (`validate_fincannon2007.py`) [CÓDIGO].
- **lunarsite-compass** menciona "Touchdown ellipse 3-sigma terrain slope" solo como criterio de pendiente [CÓDIGO].
- **LunaHorizon y SelenSync**: no encontré nada sobre la elipse ("ellipse" aparece solo en dibujos SVG) [CÓDIGO].

### 2.2 Los profesionales ya trabajan con elipses

- **Selección de sitios por elipse.** Es práctica estándar desde hace más de una década [SNIPPET]:
  - ESA Lunar Lander (arXiv 1208.5587): el área iluminada debe "contain the landing dispersion ellipse … usually 99.7%".
  - IAC 2021: elipses de 100 m puntuadas con 70 % de visibilidad solar media.
  - JDSE 2023: tasa de iluminación en un DEM de 20 m sobre 15 × 15 km.
- **Moon Trek** ofrece "ray-traced lighting analysis for user-specified areas over user-specified time/date ranges" (puede requerir cuenta) [SNIPPET].
- **LROC QuickMap** tiene TerrainShadows y "Compute Visibility" en una posición o a lo largo de una travesía [SNIPPET].
- **PGDA 78** publica mapas de iluminación de 5 m por región de interés, con su incertidumbre [SNIPPET]. Esos mapas ya muestran la variación dentro de una elipse de unos 100 m.
- **El requisito de precisión del HLS es de 100 m × 100 m** (presentación de NASA a Space Apps 2025) [SNIPPET]. Para Artemis la elipse es chica. Para CLPS, el único dato real es la desviación de IM-2 (unos 250 m) [SNIPPET].
- **No encontré** (3 búsquedas) elipses 3σ publicadas de CLPS (Griffin, Blue Moon MK1, Nova-C). Sin ellas, la "elipse del vehículo" que dejaría a 4-B por delante de lunar-ops sería un supuesto del equipo [NO VERIFICADO].

### 2.3 Viabilidad en 48 h

- **Cobertura del DEM** [INFERENCIA, a partir del nombre del archivo en A4]: el COG `ldem_87s_5mpp` (4,2 GB) cubre **al sur de 87° S**. IM-2 (84,79° S), Malapert y Nobile quedan fuera. Para esos sitios hay que usar los DEM por sitio de PGDA 78 o los regionales de 20/60 m, como hace lunar-ops.
- **Costo del cálculo** [INFERENCIA]:
  - Un horizonte confiable necesita terreno lejano, hasta unos 100–300 km. lunar-ops usa 1.440 azimuts y capas anidadas de 10 m a 480 m.
  - Con 19 a 100 puntos por sitio es factible durante el evento, en minutos u horas con numpy y lecturas por rango.
  - Una grilla densa de elipse (por ejemplo, 1 × 2 km a 20 m, unos 5.000 puntos) por varios sitios ya no entra cómodamente en 48 h sin GPU ni preprocesamiento.
  - Respetar la regla de no preprocesar antes del 14/11 obliga a pocos puntos, que es justamente lo que lunar-ops ya muestra.
- **Validación** [INFERENCIA]: contra el promedio PGDA por píxel (como Lunar Horizon Wheel) y contra la Tabla 2 de Barker et al. 2021 (como lunar-ops). Ambas ya las hicieron los competidores.
- **¿Se entiende en 30 s?** Sí: "aterrizás 250 m más allá y perdés X h de sol". Pero ese gancho ya es el paso 5 del demo guiado de lunar-ops [CÓDIGO].

### 2.4 Veredicto C04-4B: **ELIMINADO**

**Motivo.** La idea central (iluminación y DTE recalculados en varios puntos de la zona de alunizaje, con IM-2 como caso) ya está implementada y documentada en lunar-ops, con validación contra Barker 2021 y además con clones de error del DEM. Los profesionales trabajan con elipses desde 2012, y Moon Trek y PGDA 78 cubren el análisis por área.

**Residuo no cubierto (angosto).** Una elipse orientada y escalada según el vehículo, con una distribución gaussiana 2D en lugar de un muestreo uniforme. No hay elipses CLPS públicas que la sostengan, y lunar-ops la agrega en una tarde [INFERENCIA].

**Revive solo si** el enunciado del 28/10 pide explícitamente la incertidumbre del alunizaje **y** entrega elipses oficiales por vehículo o sitio. Aun así, compite contra un repo que ya lo hace [INFERENCIA].

---

## 3. C10 Analogs — direcciones 3-B (análogos de iluminación del polo sur) y 3-A (índice descomponible)

### 3.1 ¿Encaja 3-B con el resumen?

El resumen dice: "use open Earth, Moon, and Mars data … to identify and characterize new terrestrial analogs" (citado en el README de ShadowAstra) [CÓDIGO, segunda mano].

- Un análogo **de iluminación** es un análogo "para un propósito". Encaja formalmente.
- Hay un usuario real [SNIPPET]:
  - NASA y la Guardia Nacional de Colorado entrenan a los pilotos del HLS en las Rocosas porque "the sun angle is really low, so think of early morning or evening in the mountains, with long shadows".
  - JETT3 en Black Point simuló la iluminación del polo sur **de noche, con luces artificiales**.
- Datos: Copernicus DEM de 30 m sin login en S3 (A4) y efemérides solares analíticas. Disponibles [LEÍDO A4].

### 3.2 Ataque 1: 3-B ya está implementada en ShadowAstra Atlas

ShadowAstra [CÓDIGO: `src/lib/sun.ts`, `src/lib/terrain.ts` §illumination, `README.md`, `docs/PROJECT_PLAN.md`, `docs/HANDOFF.md`]:

- **Light Twin calendar.** Para cada mes compara la distribución de elevaciones solares diurnas en la Tierra con la del objetivo lunar o marciano, mediante la distancia de Wasserstein-1 (`sunSimilarity = 1 − W1/25°`), y devuelve los meses mejores. Ejemplo documentado: "McMurdo Dry Valleys in **August** … skims the horizon the way it does at Shackleton".
- **Shadow Lab.** Método de horizonte con 24 azimuts y un Sol de 1–2° de elevación, aplicado **a los dos terrenos**: SRTM en la Tierra y LOLA en la Luna. Calcula la fracción en sombra persistente.
- **Analog Fit.** Incluye "Lighting" como componente calculado en vivo.
- Lo que propone 3-B ("lugares y fechas en la Tierra con geometría solar rasante y relieve comparables") **es eso**.

TerraNova también trae un preset "**lunar low-sun**" en su vista 3D (README) [CÓDIGO].

**Debilidades reales de ShadowAstra** (de ahí sale el residuo de 3-B) [CÓDIGO + INFERENCIA]:

- La geometría es por latitud con órbita circular: no tiene efemérides reales ni horizonte en la parte del calendario.
- Compara solo la **elevación**. No compara la **velocidad del Sol**: en la Tierra el azimut barre unos 15°/h y en la Luna unos 0,5°/h, así que las sombras lunares se mueven unas 30 veces más lento.
- Tampoco compara la duración de la ventana rasante, ni la dirección de las sombras respecto del relieve.
- El Shadow Lab usa una elevación constante y 24 azimuts, con DEM de 118–237 m en la Luna.
- Ninguna salida se valida contra mapas PGDA de iluminación.

### 3.3 Ataque 2: el campo prefiere el laboratorio al terreno natural

Para ensayar **visión y navegación** con Sol rasante, NASA y la academia usan entornos controlados [SNIPPET]:

- el Lunar Lab de Ames, con simuladores solares de ángulo bajo, donde VIPER probó sus cámaras;
- el sitio de IPEx, con luces de alta potencia y captura de movimiento para tener verdad de terreno;
- el rig de iluminación de cine de MoonRanger (CMU);
- simulación virtual (la Lighting and Navigation Simulation, con 6 astronautas y 10 condiciones);
- campañas nocturnas con luces (JETT3).

Motivos que dan las fuentes: el Sol terrestre es difuso y tiene atmósfera, y la geometría no se puede repetir. No encontré **ningún** ensayo de campo con Sol natural en Svalbard, Islandia, Groenlandia ni la Antártida orientado a la iluminación lunar polar (2 búsquedas; "no encontrado" no significa "no existe").

La excepción es el entrenamiento de pilotos del HLS en las Rocosas al amanecer y al atardecer. Eso apoya el valor de 3-B, pero su usuario lo resolvió con una regla simple ("early morning or evening"), sin herramienta [SNIPPET].

Conclusión: el usuario "ensayar visión y navegación" tiene alternativas mejores que un lugar en la Tierra. El usuario "entrenamiento humano o de pilotos con terreno real" existe, pero ya tiene su respuesta [INFERENCIA].

### 3.4 Ataque 3: 3-A ya está tomada (confirma a A9)

- **TerraNova**: "weighted geometric mean … explainable per-criterion breakdown", con sliders de peso. Su `docs/REVIEW.md` dice que "already does what the guide's challenge #10 'build' section asks for: six criteria, fixed normalisation, weight sliders, and a per-criterion breakdown" [CÓDIGO].
- **terrestrial-analog-finder**: sliders de peso, y el gancho del video es "Nothing is weighted behind your back". Declara además "Illumination is still not represented" [CÓDIGO]. Le falta iluminación, pero ShadowAstra la cubre.
- **ShadowAstra**: pesos según la tarea y estados Computed / Demo / Reality gap [CÓDIGO].
- **Literatura**: un trabajo de 2026 (NHSJS, revista escolar) rankea análogos por textura con estabilidad bootstrap, y hay otro con deep learning para Qaidam [SNIPPET]. La "brecha de criterios" que cita A5 (revisión de 2013) se está cerrando, aunque sin un estándar.

### 3.5 Veredicto C10

- **3-A: ELIMINADO.** Al menos 3 repos 2026 la implementan con sliders y desglose por criterio, y es el "build" por defecto de la guía de terceros.
- **3-B: SOBREVIVE CON CONDICIONES (débil).**
  - **Condición 1.** El diferencial debe ir **más allá de ShadowAstra**, con las tres cosas siguientes:
    - efemérides reales y horizonte DEM, comparando elevación y azimut, **velocidad del Sol**, duración de la ventana rasante y fracción de terreno en sombra a igual elevación (Copernicus 30 m frente a LOLA/PGDA);
    - una salida operativa: "en tal lugar y tales fechas, entre tal y tal hora local, la geometría de sombras se parece a Connecting Ridge en X y difiere en Y (velocidad, difusión atmosférica)";
    - una validación mínima: el lado lunar contra los mapas PGDA de iluminación, y el lado terrestre contra imágenes Sentinel-2 o Landsat con ángulo solar bajo (las sombras observadas coinciden con las calculadas).
  - **Condición 2.** El enunciado del 28/10 debe incluir la iluminación o el polo sur (el título dice "Permanent Moon Base Locations") y no restringirse a geología o geoquímica.
  - **Invalidación.**
    - que ShadowAstra agregue efemérides reales, horizonte y validación antes o durante el evento (lo tiene en su plan como "Add LOLA illumination maps for validation");
    - que el jurado lo perciba como "una función de ShadowAstra";
    - que no aparezca un usuario concreto, porque los profesionales usan laboratorio.
  - **Riesgo científico** [INFERENCIA]: en la Tierra, la atmósfera (luz difusa, cielo azul) hace que la sombra no sea negra. La analogía visual es parcial por diseño, y hay que decirlo como "reality gap".

---

## 4. Comparación con los sobrevivientes de la primera ronda

- **C02 (tendencia o instrumento):** ninguno de mis dos candidatos la desplaza. Los diferenciales de C02 (D1 y D3) no aparecen en los repos líderes; en 4-B y 3-B el líder ya hizo el núcleo.
- **C06 (NISAR, cambio real o artefacto):** C10-3B no la desplaza con claridad. Los dos son débiles: C06 por la logística de datos y por DeVries 2020, 3-B por ShadowAstra. 3-B gana en datos livianos y en demo, y pierde en novedad frente al campo. Empate débil [INFERENCIA].
- **C14 (sonificación evaluada con personas):** no la desplaza. C14 tiene el único foso que no se copia (la prueba con personas). 4-B y 3-B se copian en horas.

---

## 5. Objeciones propias

- Hice 10 búsquedas y leí solo snippets de la literatura. No leí Barker 2021, De Rosa 2012 ni la presentación del HLS completos.
- Leí README, METHODS y el código de cálculo, pero **no ejecuté** lunar-ops ni ShadowAstra. No sé si las funciones declaradas andan en sus demos.
- Que el COG de 87° S no cubra IM-2 es una inferencia por el nombre del archivo.
- La regla de trabajo previo podría descalificar a lunar-ops ("developed in October 2026"), pero el repo dice que no es una entrega. Sigue siendo **arte previo público** que cualquier jurado o competidor puede ver.
- El enunciado del 28/10 puede cambiar el encaje de C04 (sitios y fechas oficiales) y de C10 (sitios base y variables).

## 6. Conclusiones

| Candidato | Veredicto | Motivo | Condición o invalidación |
|---|---|---|---|
| C04-4B (elipse) | **ELIMINADO** | lunar-ops ya implementa 19 puntos a ≤250 m, cada uno con su horizonte, con motivación IM-2, más clones de DEM; la práctica profesional usa elipses desde 2012; Moon Trek y PGDA cubren el análisis por área | Revive solo si el 28/10 entrega elipses oficiales por vehículo y pide la incertidumbre del alunizaje |
| C10-3A (índice descomponible) | **ELIMINADO** | TerraNova, terrestrial-analog-finder y ShadowAstra: sliders y desglose por criterio | — |
| C10-3B (iluminación) | **SOBREVIVE CON CONDICIONES (débil)** | El núcleo ya está en ShadowAstra (Light Twin + Shadow Lab); los profesionales prefieren el laboratorio | Superar a ShadowAstra en velocidad solar, horizonte real y validación; que el enunciado incluya la iluminación |

Ninguno desplaza a C02 ni a C14. 3-B empata débilmente con C06.

## 7. Tabla de fuentes

| URL / ruta | Qué afirma | Estado |
|---|---|---|
| github.com/RootVandal/lunar-ops (`README.md`, `docs/METHODS.md` §2.14, `pipeline/lunarops/dispersion.py`, `web/app.js`, `docs/DECISIONS.md`) | Robustez al error de alunizaje: 19 puntos ≤250 m, cada uno con su horizonte, motivación IM-2; clones de DEM PGDA 78; validación contra Barker 2021 | [CÓDIGO] |
| github.com/NetRunnerXD/lunar-horizon-wheel (`METHODS.md` l. 70 y 74) | Los valores PGDA 60 m a ≤150 m del borde de Shackleton van de 0 a 85,5 %; el DEM cambia el % de sol hasta 26 pp | [CÓDIGO] |
| github.com/WarRinOP/sightline (`docs/science/DATA_VERIFICATION_REPORT.md`) | 100 clones Monte Carlo por sitio en PGDA 78; incertidumbre del DEM, sin dispersión del alunizaje | [CÓDIGO] |
| github.com/Hamzaslam1996/lunarwindow (`scripts/validate_fincannon2007.py`) | Mejor punto dentro de un radio de búsqueda | [CÓDIGO] |
| github.com/partofcosmos-site/lunarsite-compass | "Touchdown ellipse 3-sigma" solo como criterio de pendiente | [CÓDIGO] |
| github.com/samuelakosaonyejekwe/lunahorizon · gmrafi/cfsbr-selensync | Sin elipse ni dispersión del alunizaje | [CÓDIGO] (grep) |
| github.com/ABRUBAB/ShadowAstra_Atlas (`src/lib/sun.ts`, `src/lib/terrain.ts`, `README.md`, `docs/PROJECT_PLAN.md`) | Light Twin calendar (W1 de elevaciones solares por mes), Shadow Lab (horizonte con 24 azimuts y Sol de 1–2°), McMurdo en agosto ≈ Shackleton | [CÓDIGO] |
| github.com/KraKEn-bit/TerraNova (`README.md`, `docs/REVIEW.md`) | Sliders, desglose por criterio, preset "lunar low-sun" | [CÓDIGO] |
| github.com/shishir-kuet/terrestrial-analog-finder (`README.md`, `docs/VIDEO.md`) | Sliders de peso; "Illumination is still not represented" | [CÓDIGO] |
| github.com/JimmyGuajan/twinworlds (`pipeline/planetary.py`) | Contraste de insolación estacional a partir de elementos orbitales | [CÓDIGO] |
| https://arxiv.org/pdf/1208.5587 | ESA Lunar Lander: el área iluminada debe contener la elipse de dispersión del 99,7 % | [SNIPPET] |
| https://p.iafastro.directory/iac/paper/id/65346/abstract-pdf/IAC-21,A3,IP,60,x65346.brief.pdf | Elipses de 100 m puntuadas por visibilidad solar media (70 %) | [SNIPPET] |
| https://journal.hep.com.cn/jdse/EN/1160128987848565435 | Tasa de iluminación en DEM de 20 m sobre 15 × 15 km; 8 áreas de alunizaje | [SNIPPET] |
| https://pgda.gsfc.nasa.gov/products/78 | DEM de 5 m por sitio; la iluminación dentro de las regiones de interés depende de la incertidumbre de altura | [SNIPPET] |
| https://ntrs.nasa.gov/api/citations/20205009660/downloads/Mike%20Barker_%20Paper_%20Improved%20Lola.pdf | Barker et al.: errores de LOLA y su impacto en la iluminación | [SNIPPET] |
| https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf | Precisión del HLS 100 m × 100 m; criterios de visibilidad de la Tierra y del Sol | [SNIPPET] |
| https://iafastro.directory/iac/archive/browse/IAC-17/A3/2A/39312/ | Moon Trek: análisis de iluminación por trazado de rayos sobre áreas y rangos de fechas | [SNIPPET] |
| https://www.actgate.com/examples/lroc-quickmap | QuickMap TerrainShadows; Compute Visibility en un punto o una travesía | [SNIPPET] |
| https://eos.org/articles/commercial-lander-touches-down-on-moon | IM-2 a unos 250 m del objetivo, dentro de un cráter | [SNIPPET] |
| https://www.nasa.gov/centers-and-facilities/ames/the-lunar-lab-and-regolith-testbeds/ | Lunar Lab de Ames: iluminación de ángulo bajo para VIPER | [SNIPPET] |
| https://ntrs.nasa.gov/citations/20240011393 | Estudios de iluminación y navegación con Sol de 1–2°; simulación con astronautas | [SNIPPET] |
| https://labs.ri.cmu.edu/moonranger/perception-testbed-and-lighting/ | La luz lunar es difícil de reproducir al aire libre; rig de cine | [SNIPPET] |
| https://www.space.com/artemis-astronauts-moonwalking-desert-simulation-2022 | JETT3: simulación nocturna con luces artificiales en Black Point | [SNIPPET] |
| https://www.nasa.gov/general/nasa-army-national-guard-partner-on-flight-training-for-moon-landing/ | Pilotos del HLS en las Rocosas: Sol bajo al amanecer y al atardecer | [SNIPPET] |
| https://nhsjs.com/?p=41960 | Ranking cuantitativo de análogos por textura (revista escolar, 2026) | [SNIPPET] |
| https://arxiv.org/pdf/2501.08584 | Selección de análogos marcianos con deep learning (Qaidam) | [SNIPPET] |

## 8. Pendientes

- Releer contra el enunciado del 28/10: ¿C04 trae sitios, fechas o elipses oficiales? ¿C10 pide iluminación o sitios base concretos?
- Si se sigue con 3-B, verificar si existe un catálogo de escenas Landsat o Sentinel-2 con ángulo solar bajo (en invierno de latitudes altas) que sirva como validación de sombras.
- Verificar la cobertura real de `ldem_87s_5mpp` (latitud mínima) y la disponibilidad de los DEM por sitio de PGDA 78 sin preprocesamiento.
