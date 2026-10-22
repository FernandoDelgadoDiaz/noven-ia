# 05 — Ideas candidatas

Fecha: **2026-10-22**. Base: reglas (01), patrones 2025 (02), saturación 2026 (03) y capacidades de la API (04).
Todas las ideas son **hipótesis**; la viabilidad de cada una depende de las pruebas T1–T10 de 04.

## Descartadas de entrada (saturación o "chatbot + API")

| Idea | Motivo |
|---|---|
| Concierge cultural conversacional ("chat con gusto") | Chatbot + API; ~30 clones en 2025–2026 |
| Decisión grupal / "common ground" | ~35 repos en 2026; no ganó en 2025 |
| Ruteo de giras para artistas indie | ~25 repos en 2026 |
| Reminiscencia para demencia / adultos mayores | ~12 repos; es el ejemplo del organizador |
| Relocalización a otra ciudad | ~15 repos |
| Site selection / expansión de franquicias | Ganó GeoTaste en 2025 y hay ~8 repos en 2026 |
| Itinerarios de viaje | Categoría más saturada en ambos años |
| Regalos | ~10 repos |
| Booking de venues | ~20 repos |

## Ideas evaluadas (12)

### A. Green Room — agente de booking de invitados para podcasts y talk shows
1. **Problema:** los productores de entrevistas eligen invitados por intuición y contactos. Los invitados "obvios" ya pasaron por todos los shows; encontrar a quien tu audiencia ama y todavía no escuchó en tu show es trabajo manual de un *booker* (un rol pago).
2. **Por qué agente:** flujo de varios pasos con herramientas: leer el RSS → extraer invitados pasados → resolver IDs en Qloo → construir el perfil de gusto de la audiencia → buscar candidatos excluyendo los ya invitados → puntuar por afinidad × tendencia × novedad → verificar → redactar el pitch. Además decide qué hacer cuando un nombre no resuelve.
3. **Por qué Qloo es esencial:** la afinidad entre personas y entre audiencias (`person`, `podcast`, `tv_show`) es lo que un LLM inventa. La exclusión, `trending` y `explainability` permiten justificar cada elección.
4. **Originalidad:** 0 repos visibles en 2026 [H, ver 03]. Es la inversa de sponsor-scout (que busca marcas, no invitados).
5. **Competidores reales:** agencias de booking de podcasts y herramientas tipo PodMatch/MatchMaker.fm (marketplaces por categoría, sin grafo de gusto) [I; no investigados en profundidad].
6. **Demo impactante:** pegar el RSS de un talk show de entretenimiento real → en ~60 s, top 10 de invitados con razones, nivel de "momento" y borrador de invitación. Además un **backtest en vivo**: "ocultamos los últimos 10 invitados reales; el agente predijo N de ellos".
7. **¿Se puede antes del cierre?:** sí, si la clave llega ≤27/10 y T2–T5 aprueban. Es una sola vertical con datos públicos (RSS gratuito).
8. **Costos:** LLM ~US$ 5–20; Netlify gratis; Qloo gratis.
9. **Riesgos:** cobertura de `person` limitada a celebridades (T2); calidad de extracción de invitados desde el RSS; percepción de "adular" a los jueces.
10. **Por qué perdería:** si Qloo solo cubre a megacelebridades, las recomendaciones serán obvias y el valor se cae; o si un competidor con mejor diseño lanza la misma idea.

### B. Shelf Signal — surtido localizado para almacenes y supermercados independientes
1. **Problema:** el almacenero independiente decide qué marcas tener por intuición. Si se equivoca, inmoviliza capital y pierde mercadería (merma).
2. **Agente:** dirección de la tienda + lista actual de marcas → afinidad del barrio (heatmap) → marcas faltantes con alta afinidad local → marcas actuales de baja afinidad → plan de prueba (qué sumar y qué rotar) y pedido sugerido.
3. **Qloo:** `brand` + heatmap + `filter.references_brand`.
4. **Originalidad:** 0 repos de supermercado [H]; adyacentes: crowdpilot, Space y tasteshift.
5. **Competidores reales:** Nielsen/Circana, category management de distribuidores (caro e inaccesible para independientes) [I].
6. **Demo:** dos almacenes en barrios distintos de Chicago reciben recomendaciones opuestas y justificadas.
7. **Plazo:** factible si T6/T7 aprueban.
8. **Costos:** bajos.
9. **Riesgos:** cobertura de marcas de consumo masivo en Qloo (T6); afinidad cultural ≠ demanda de góndola; sin SKUs.
10. **Pierde si:** el jurado percibe que "qué vender" se resuelve mejor con datos de ventas que con gusto cultural. Es un argumento difícil de rebatir.
- **Nota de sesgo:** se relaciona con NoVen IA. Se evalúa con el mismo criterio que las demás; la experiencia de dominio sí cuenta para "Quality of the Idea" (comprensión del problema).

### C. Donor Pulse — campañas de recaudación para ONG
1. **Problema:** las ONG medianas no saben con qué embajadores, eventos y marcas conectar con su base de donantes potenciales.
2. **Agente:** causa + región → audiencias y afinidades → embajadores (`person`), sponsors (`brand`), temas de evento y barrios (heatmap) → plan y piezas.
3. **Qloo:** audiencias, persons, brands y heatmap.
4. **Originalidad:** 0 repos [H]; pero **la estructura es casi idéntica a Resonance AI (2025)** [I].
5. **Competidores:** consultoras de fundraising, Blackbaud [I].
6. **Demo:** campaña para un banco de alimentos.
7. **Plazo:** factible.
8. **Costos:** bajos.
9. **Riesgos:** no hay audiencia "donantes" en Qloo; parece derivado de un ganador previo.
10. **Pierde por** baja diferenciación frente a Resonance.

### D. Listing Lens — posicionamiento de avisos inmobiliarios
1. Avisos genéricos → reescribirlos según el gusto del barrio.
2. Agente: dirección → heatmap y places cercanos → narrativa, amenities y fotos a destacar.
3. Qloo: places + heatmap.
4. 0 repos [H].
5. Competidores: herramientas de IA para inmobiliarias [I].
6. Demo: un mismo departamento posicionado de dos formas.
7. Factible.
8. Bajo costo.
9. **Riesgo legal:** segmentar por demografía en vivienda choca con la Fair Housing Act de EE. UU. [I, riesgo serio].
10. Pierde por el riesgo legal y por un uso superficial de Qloo.

### E. Cruce — localizar publicaciones de e-commerce entre países de LatAm
1. Vendedores que exportan a otros países con publicaciones no localizadas culturalmente.
2. Agente: publicación → mercado destino → referencias culturales y marcas afines → reescritura.
3. Qloo: brands y destinations por país.
4. 0 repos de LatAm [H].
5. Competidores: traductores y herramientas de Mercado Libre [I].
6. Demo: el mismo producto en AR, MX y CO.
7. Factible si la cobertura de LatAm existe (T8).
8. Bajo.
9. **Cobertura de LatAm desconocida y advertida por Qloo**; la diferencia cultural puede ser difícil de mostrar.
10. Pierde si los datos de LatAm vienen vacíos.

### F. Plate Fit — reducir el desperdicio de platos en comedores institucionales
1. Comedores (escuelas, hospitales) desperdician comida que la población no acepta.
2. Agente: perfil del comedor → afinidades de cocina por edad y región → rotación de menú → plan de prueba.
3. Qloo: tags de cocina en places + demografía.
4. Adyacentes: SeniorPalate, PalateCare, second-helping [H].
5. Competidores: nutricionistas, software de food service [I].
6. Demo: menú semanal antes y después.
7. Factible.
8. Bajo.
9. Qloo no tiene platos; el vínculo con el desperdicio no es demostrable en 8 días.
10. Pierde por Qloo débil y por similitud con proyectos de salud.

### G. Matchday — noches temáticas y sponsors para clubes deportivos de ligas menores
1. Fechas de baja asistencia.
2. Agente: mercado del club → afinidades → temas, artistas y marcas → calendario.
3. Qloo: heatmap, artists, brands.
4. Ya existen [homestand](https://github.com/ramenprotokol/homestand) y [Theme-Night-GM](https://github.com/ZNLong2203/Theme-Night-GM) [H].
5–8. Factible y barato.
9. Ya explorado y con estudio pre-registrado de un competidor.
10. Pierde por falta de originalidad.

### H. Taste Backtest Lab — "¿predice Qloo esto?" para cualquier decisión de negocio
1. Las empresas no saben si los datos de gusto predicen sus resultados.
2. Agente: hipótesis → diseño de backtest → consultas a Qloo → métrica → veredicto.
3. Qloo: todo.
4. Parcialmente explorado (homestand, crossover, Blindspot) [H].
5. Competidores: consultoras de datos [I].
6. Demo poco visual.
7. Riesgoso: necesita *ground truth* por caso.
8. Bajo.
9. Abstracto; "Design" e "Impact" débiles.
10. Pierde ante productos con usuario concreto. **Se conserva como técnica** (el backtest) para la idea ganadora.

### I. Concierge pre-arribo para hoteles chicos
1. Los hoteles boutique no personalizan la estadía.
2. Agente: datos de la reserva y semillas de gusto → plan local.
3. Qloo: places.
4. Existe [bellhop-concierge](https://github.com/StankyDanko/bellhop-concierge) y decenas de concierges [H].
5–8. Factible.
9. Saturado (variante de itinerarios).
10. Descartada.

### J. Launch Market — qué ciudad o país elegir para lanzar una marca de consumo
1. Pymes que lanzan productos sin saber dónde.
2. Agente: marca → afinidad geográfica → ranking de ciudades → plan.
3. Qloo: brand + heatmap.
4. Ya existen [bridgescout](https://github.com/dongwei-polyred/bridgescout), [tastebound](https://github.com/thenameisomm/tastebound) y GeoTaste en 2025 [H].
5–8. Factible.
9. Saturado.
10. Descartada.

### K. Comps para pitch de startups — "qué inversores aman lo que aman tus clientes"
1. Founders que no saben a qué inversor apuntar.
2. Ya existe [pitchprep](https://github.com/teawa-b/pitchprep) [H].
3. Qloo débil: no hay datos de inversores [I].
4–10. Descartada por Qloo accesorio.

### L. Talk-show segment planner (variante de A para TV)
- Igual que A, aplicado a segmentos de TV. Comparte riesgos. **Se fusiona con A** como extensión ("podcasts y talk shows").

## Resultado de la fase

Pasan a la matriz (06): **A, B, C, E, G** (G como control de "idea correcta pero ya explorada").
Descartadas: D (riesgo legal), F (Qloo débil), H (se conserva como técnica), I, J, K (saturadas o con Qloo accesorio), L (fusionada en A).
