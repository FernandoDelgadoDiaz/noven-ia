# NOVEN · VISIÓN DE PRODUCTO

> Este documento es la fuente de verdad normativa de producto de Noven. Debe utilizarse como referencia para evaluar futuras funcionalidades y decisiones de producto, separadamente de la documentación técnica, el roadmap y las decisiones de implementación.
>
> PRODUCT_VISION.md es la referencia normativa para evaluar futuras funcionalidades y decisiones de producto. No significa que cada implementación deba reflejar inmediatamente el estado final descrito aquí; Noven debe evolucionar progresivamente sin romper capacidades productivas existentes.

## Identidad

Noven · Gerente de Rentabilidad IA para supermercados

Noven no es una aplicación de vencimientos.

Noven no es un dashboard.

Noven no pretende reemplazar ERP, POS, Glaciar, Prisma ni los sistemas centrales del retailer.

Noven es una capa de inteligencia operacional orientada a detectar, evitar, recuperar y demostrar pérdidas económicas evitables en supermercados.

Su evolución estratégica corresponde a la categoría:

Agentic Retail Operations / Agentic Profitability

## Pregunta central del producto

Noven debe poder responder continuamente:

¿Dónde estoy perdiendo dinero hoy, por qué, qué tengo que hacer y se hizo?

Toda funcionalidad debe contribuir de manera demostrable a responder alguna parte de esa pregunta.

## Unidad fundamental

La unidad central de Noven NO es:

* el dato;
* el gráfico;
* la alerta;
* el vencimiento;
* el SKU;
* el reporte.

La unidad fundamental es:

un problema económico que debe resolverse.

Ejemplos:

* mercadería en riesgo de vencimiento;
* sobrestock;
* ruptura;
* stock inmovilizado;
* merma recurrente;
* mala reposición;
* compra incompatible con la demanda;
* precio inadecuado;
* oportunidad de transferencia entre sucursales;
* ejecución operativa pendiente.

## Ciclo operativo objetivo

Cada problema económico debería poder recorrer progresivamente este ciclo:

OBSERVAR → DETECTAR → CUANTIFICAR → INVESTIGAR → DECIDIR → ACTUAR → ASIGNAR → VERIFICAR → ESCALAR → MEDIR RESULTADO

El sistema no debería considerar terminado su trabajo simplemente porque mostró una alerta.

El problema termina cuando:

* fue resuelto;
* fue aceptado conscientemente;
* fue descartado con motivo válido;
* o fue escalado.

## Principio agentic

Noven debe evolucionar desde software que informa hacia software que persigue objetivos operativos.

Un agente de Noven debe poder:

1. detectar una situación;
2. reunir contexto;
3. evaluar impacto económico;
4. decidir o recomendar una acción;
5. identificar al responsable correcto;
6. generar o disparar la acción;
7. controlar si fue ejecutada;
8. volver a medir la situación;
9. escalar si continúa;
10. registrar el resultado económico.

La autonomía debe crecer progresivamente y conservar trazabilidad, permisos y human-in-the-loop donde corresponda.

## Arquitectura conceptual

Noven puede consumir información proveniente de:

* Supabase;
* CSV;
* reportes exportados;
* fotografías;
* formularios operativos;
* APIs;
* ERP/POS cuando exista integración;
* otras fuentes futuras.

La falta de integración directa con sistemas centrales NO debe impedir el desarrollo del modelo agentic.

La arquitectura conceptual es:

Sistemas existentes / reportes → Noven → agentes especializados → acciones → seguimiento → resultado económico

### Independencia del sistema fuente y portabilidad

Noven debe distinguir permanentemente entre el dominio universal del retail y las particularidades de cada organización.

Como ampliación de la arquitectura conceptual anterior, el flujo objetivo es:

SISTEMA DEL CLIENTE → ADAPTADOR / CONECTOR → MODELO UNIVERSAL NOVEN → AGENTES / MOTORES NOVEN → ACCIONES → SEGUIMIENTO → RESULTADO ECONÓMICO

Los adaptadores o conectores pueden obtener información mediante CSV, Excel, archivos exportados, APIs, bases de datos autorizadas de solo lectura, webhooks, SFTP, ERP/POS, MCP u otras fuentes futuras. MCP es una opción de integración, no una dependencia arquitectónica de Noven.

Los agentes y motores deben razonar sobre conceptos internos comunes del retail —por ejemplo SKU, producto, stock, velocidad de venta, costo, precio, margen, vencimiento, merma, sucursal, transferencia, ruptura, compra, acción, responsable y resultado económico— y no sobre nombres específicos de columnas, reportes o sistemas externos. Una vez normalizado el dato, el agente no debería necesitar conocer su fuente original.

Las reglas propias de un retailer —por ejemplo políticas de donación, RAG/markdown, sectores o familias, responsables, escalamiento, autorizaciones, transferencias, tolerancias, horarios o workflows— deben tratarse como configuración, política o adaptación en el nivel organización → zona/región → sucursal → familia/sector cuando corresponda y siempre que sea razonable.

La Anónima y Glaciar son el entorno operativo real de descubrimiento y validación actual, no la frontera del producto. Sus particularidades pueden originar capacidades generales, pero no deben convertirse silenciosamente en comportamiento universal de Noven.

Ante toda regla nueva debe preguntarse: ¿pertenece al supermercado como industria o a este cliente particular? Si pertenece al cliente, debe modelarse como configuración, política o adaptador siempre que sea razonable.

Principio de portabilidad: cambiar el sistema fuente sin cambiar el cerebro de Noven y cambiar las políticas del retailer sin crear otro producto.

## Motores o agentes futuros

Noven puede incorporar progresivamente agentes especializados como:

* Agente de Vencimientos.
* Agente de Merma.
* Agente de Inventario.
* Agente de Ruptura y Reposición.
* Agente de Transferencias entre sucursales.
* Agente de Compras.
* Agente de Pricing / Markdown.
* Agente de Ejecución.
* Agente de Auditoría Visual.
* Agente de Rentabilidad.

Estos NO deben transformarse necesariamente en módulos aislados.

Todos deben alimentar una capa superior común:

NOVEN PROFIT AGENT

Su responsabilidad es priorizar problemas según impacto económico y operativo.

## Priorización

Cuando existan múltiples problemas, Noven debe priorizar preferentemente por:

1. dinero potencialmente perdido;
2. urgencia;
3. probabilidad de ocurrencia;
4. capacidad real de intervención;
5. tiempo restante para actuar;
6. recurrencia;
7. impacto sobre disponibilidad o experiencia del cliente.

El objetivo no es mostrar más alertas.

El objetivo es indicar:

qué problema conviene resolver primero.

## Rentabilidad demostrable

Noven debe avanzar hacia la medición explícita de:

* dinero en riesgo;
* dinero efectivamente perdido;
* pérdida evitada;
* mercadería recuperada;
* ventas preservadas;
* ahorro generado;
* resultado por acción;
* resultado por sucursal;
* resultado por sector;
* resultado por agente.

A futuro una métrica fundamental debería ser:

$ protegidos / recuperados por Noven.

## Multisucursal y capa zonal

La arquitectura organización → región/zona → sucursal no es sólo administrativa.

Debe permitir inteligencia transversal.

Ejemplo:

Una sucursal detecta exceso o riesgo sobre un SKU.

Noven puede analizar otras sucursales y determinar:

* dónde existe mayor rotación;
* dónde falta producto;
* dónde ya existe sobrestock;
* dónde una transferencia podría reducir la pérdida.

El objetivo es convertir información distribuida en acción coordinada.

## Principio de diseño

Antes de agregar una funcionalidad nueva, debemos poder responder:

¿Qué pérdida económica ayuda a detectar, evitar, recuperar o demostrar?

Además:

Si agregamos un gráfico:

¿qué decisión cambia?

Si agregamos una tabla:

¿qué agente o decisión necesita esos datos?

Si agregamos una alerta:

¿qué acción dispara, quién debe actuar y cómo sabemos que se resolvió?

Si no existe una respuesta clara, la funcionalidad debe cuestionarse.

## Recomendación, autorización y ejecución

Noven separa recomendación, autorización y ejecución. Son tres actos distintos, con responsables distintos.

Noven no cambia precios ni sustituye al sistema de la cadena. Coordina el circuito; la ejecución sigue siendo del sistema del cliente.

La ejecución de precios es centralizada por decisión de la compañía, no del producto. Noven se adapta a esa decisión; no la presupone ni la impone.

Noven nunca mide contra un precio supuesto: un tramo arranca cuando una persona confirma que el precio está en góndola.

El circuito concreto que se desprende de estos principios —bandejas, roles, plazos y orden de impacto— vive en `docs/CIRCUITO_RAG_CENTRALIZADO_V1.md`. Acá van los principios; allá el detalle.

## Límites de producto

Noven NO debe convertirse en:

* ERP generalista;
* sistema contable;
* POS;
* software administrativo universal;
* BI tradicional lleno de dashboards;
* gestor genérico de tareas.

Puede integrarse o apoyarse en esos sistemas, pero su territorio es:

la pérdida económica evitable y la acción operacional necesaria para reducirla.

## Evolución del producto

Noven 1

Gestión inteligente de vencimientos.

Noven 2

Plataforma operacional multitenant para supermercados.

Noven 3

Gerente de Rentabilidad IA / Agentic Retail Operations.

Actualmente debemos proteger todo lo construido en Noven 1 y Noven 2 mientras hacemos que las próximas decisiones de producto converjan hacia Noven 3.

## Primer circuito agentic prioritario

No necesitamos crear todos los agentes simultáneamente.

El primer circuito completo debería demostrar:

detección de riesgo → cuantificación económica → análisis de alternativas → recomendación/acción → responsable → seguimiento → verificación → resultado económico.

Idealmente utilizando vencimientos, stock/VMD y Radar como primer dominio porque ya existe infraestructura desarrollada.

## Regla final

Noven debe evolucionar de:

“te muestro dónde existe un problema”

a:

“detecté dónde vas a perder dinero, determiné qué conviene hacer, activé el circuito correcto y voy a controlar que se resuelva.”
