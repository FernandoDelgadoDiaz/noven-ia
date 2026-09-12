# NOVEN · Agente 2 de Disponibilidad / Quiebres · Diseño V0.1

Estado: **diseño formal, no implementación**.

Este documento fija el alcance inicial del segundo agente de Noven sin introducir reglas de negocio todavía no validadas.

## 1. Objetivo

Detectar problemas estructurales de disponibilidad que puedan estar causando pérdida de venta o servicio, convertirlos en problemas económicos investigables y seguirlos hasta su resolución.

La señal inicial de mayor interés es la recurrencia de un SKU en el **Listado de Reposición Asistida de Glaciar**.

La pregunta no es:

> ¿Cuánto debería pedir Noven?

La pregunta es:

> ¿Por qué este SKU necesita corrección/reposición de forma recurrente y qué pérdida económica puede estar generando esa recurrencia?

## 2. Lo que este agente NO debe hacer

En V1, el agente no debe:

- reemplazar el algoritmo de Reposición Asistida de Glaciar;
- calcular una cantidad de pedido alternativa como propuesta central de valor;
- modificar pedidos de Glaciar;
- asumir que recurrencia implica una causa determinada;
- afirmar que un mínimo, una ejecución o un abastecimiento son incorrectos sin evidencia;
- inventar umbrales de recurrencia sin datos históricos;
- ampliar la superficie RPC del navegador sólo para facilitar la implementación;
- alterar el circuito ya cerrado del Agente 1 de Vencimientos.

## 3. Fuente primaria obligatoria

La fuente primaria deberá ser el archivo exacto que Glaciar genera como **Listado de Reposición Asistida**.

A la fecha de este diseño, ese archivo todavía no está verificado por contenido.

Por lo tanto:

- no se define todavía un parser;
- no se fijan nombres de columnas;
- no se adjudica esa semántica a otros archivos por parecido;
- no se reutilizan archivos de pedido de carnes, frutas/verduras ni Venta Asistida como sustitutos.

Antes de implementar ingestión se deberá validar una muestra real del reporte y documentar:

- formato;
- encoding;
- delimitador o estructura de planilla;
- columnas efectivas;
- granularidad temporal;
- identificación de sucursal;
- identificación de SKU;
- diferencia entre cantidad sugerida y cantidad finalmente enviada, si ambas existen;
- cualquier dato de mínimos, stock, tránsito, VMD u otros parámetros que realmente exponga el reporte.

## 4. Fuentes complementarias ya disponibles en Noven

Sin duplicar Glaciar, el agente podrá enriquecer el análisis con información ya existente en Noven:

- identidad global de producto;
- `producto_sucursal`;
- stock actual;
- venta media diaria;
- stock en tránsito;
- períodos de venta del 0258;
- costo unitario sin IVA;
- precio de venta cuando esté disponible;
- problemas económicos activos del Agente 1;
- historial de vencimientos/RAG cuando sea relevante.

La disponibilidad de una fuente complementaria no autoriza a inferir causalidad.

## 5. Persistencia mínima futura

La primera implementación, cuando se valide el archivo, debería priorizar **snapshots diarios trazables** antes que reglas de decisión.

Cada observación normalizada debería poder responder al menos:

- qué sucursal;
- qué fecha operativa;
- qué SKU;
- si el SKU apareció o no en el reporte;
- qué valores traía el archivo para ese SKU;
- de qué archivo/importación provino;
- cuándo fue importado;
- si ya había sido importada la misma evidencia.

La ingestión debe ser idempotente y conservar trazabilidad de origen.

No se debe transformar un snapshot diario en una afirmación económica por sí solo.

## 6. Señales analíticas iniciales

Antes de definir umbrales, Noven debería ser capaz de calcular para una ventana temporal configurable:

- cantidad de días observados;
- cantidad de días en que el SKU apareció en Reposición Asistida;
- tasa de recurrencia;
- racha consecutiva de apariciones;
- cantidades sugeridas acumuladas/promedio, sólo si el reporte efectivamente las contiene;
- stock, tránsito y VMD de contexto cuando estén disponibles;
- existencia simultánea de un problema activo de vencimiento para el mismo SKU/sucursal.

El ejemplo “9 de los últimos 10 días” es una hipótesis útil de producto, **no un umbral aprobado**.

## 7. Familias de problema candidatas

Estas categorías son hipótesis de investigación, no causas automáticas.

### A. Necesidad de reposición recurrente

Un SKU aparece repetidamente en Reposición Asistida durante una ventana significativa.

Interpretación permitida:

> Existe una recurrencia operativa que merece investigación.

Interpretación no permitida:

> El mínimo está mal.

### B. Recurrencia con stock aparente

El SKU aparece repetidamente mientras otras fuentes muestran stock positivo.

Posibles hipótesis a investigar:

- ejecución de reposición;
- exactitud del stock;
- ubicación del stock;
- parámetro operativo;
- frecuencia de abastecimiento.

Ninguna debe afirmarse como causa sólo por correlación.

### C. Recurrencia + riesgo de vencimiento

El mismo SKU aparece repetidamente como necesidad de reposición y, al mismo tiempo, mantiene mercadería en riesgo de vencimiento.

Esta contradicción puede ser una señal especialmente valiosa porque sugiere que el sistema está mostrando simultáneamente presión de disponibilidad y sobrestock/rotación problemática.

Hipótesis posibles:

- stock incorrecto;
- mala rotación física;
- exhibición/ejecución;
- parámetros inconsistentes;
- entradas/salidas no reflejadas correctamente.

Noven debe presentar la contradicción y reunir contexto, no inventar la causa.

### D. Quiebre verificable

Si el reporte real contiene evidencia suficiente para distinguir falta efectiva de producto, Noven podrá separar una recurrencia de reposición de un quiebre real.

Esta categoría queda pendiente hasta verificar el archivo y sus campos.

## 8. Investigación agéntica

Un problema de disponibilidad debería intentar recorrer el ciclo general de Noven:

OBSERVAR → DETECTAR → CUANTIFICAR → INVESTIGAR → DECIDIR → ACTUAR → ASIGNAR → VERIFICAR → ESCALAR → MEDIR RESULTADO.

En la fase de investigación, el agente debería reunir sólo evidencia disponible y etiquetar hipótesis, por ejemplo:

- recurrencia observada;
- stock aparente;
- tránsito;
- VMD;
- historial reciente;
- problema de vencimiento simultáneo;
- comportamiento posterior a una intervención registrada.

La recomendación debe explicar por qué se propone una verificación determinada.

## 9. Dimensión física

La V1 deberá mantener una dimensión física independiente de la económica.

Posibles métricas físicas, sujetas a la disponibilidad real del reporte:

- días con señal de reposición;
- días con quiebre verificable;
- unidades de demanda/reposición no cubiertas;
- duración de la recurrencia;
- frecuencia de repetición;
- unidades potencialmente afectadas.

No se inventará una unidad física que el reporte no permita sostener.

## 10. Dimensión económica · decisión de producto pendiente

El Agente 1 puede usar costo sin IVA porque el problema es mercadería expuesta a pérdida física.

En disponibilidad/quiebres, la semántica económica es distinta y **no debe copiarse automáticamente**.

Antes de implementar `$ en riesgo` para este agente se debe decidir qué representa la pérdida económica:

- venta potencial no realizada a precio de venta;
- margen bruto potencial perdido;
- otra medida de contribución validada por negocio.

Usar costo sin IVA como si fuera equivalente a pérdida por falta de disponibilidad sería conceptualmente incorrecto sin una decisión explícita.

Hasta resolver esta decisión, el agente puede detectar y priorizar evidencia física/operativa, pero no debe presentar un monto como pérdida económica cierta.

## 11. Prioridad

No se creará un score opaco.

Cuando existan datos suficientes, una prioridad deberá poder explicarse mediante factores observables como:

- recurrencia;
- duración;
- magnitud física;
- evidencia de quiebre;
- exposición económica validada;
- existencia simultánea de riesgo de vencimiento;
- capacidad de intervención;
- impacto cliente/venta cuando exista evidencia.

Los pesos o umbrales no se fijarán antes de analizar datos reales.

## 12. Ciclo de problema

La arquitectura deberá permitir distinguir episodios.

Un SKU puede presentar una recurrencia, resolverse y volver a presentar el problema semanas después. Eso debe constituir un nuevo ciclo, no la reapertura artificial del anterior.

La semántica exacta de apertura/cierre queda pendiente de validar:

- frecuencia real del reporte;
- cantidad de días de observación necesaria;
- qué evidencia demuestra resolución sostenida.

No se usará una ausencia aislada de un día como cierre automático sin validar el comportamiento operativo real.

## 13. Arquitectura recomendada

Para no poner en riesgo el Agente 1, la primera implementación de disponibilidad debería ser **aditiva y separada**.

Principios:

- tablas server-only para snapshots/importaciones cuando corresponda;
- ledger/ciclo propio del dominio de disponibilidad si hace falta persistir episodios;
- integración con el concepto global de problema mediante vistas/servicios, no mediante una refactorización destructiva del ledger de vencimientos;
- reutilizar identidad de producto y `producto_sucursal`;
- no crear nuevas RPC browser salvo necesidad demostrada y revisión explícita de seguridad;
- funciones Netlify/server-only para ingestión o enriquecimiento cuando sea apropiado;
- RLS/grants siguiendo el patrón productivo actual.

Una abstracción común entre agentes se hará sólo cuando existan al menos dos dominios reales y se conozcan sus diferencias, no antes.

## 14. Estrategia de implementación

### Fase 0 · Verificar fuente

Obtener y abrir una muestra real del Listado de Reposición Asistida.

Resultado esperado: contrato de archivo validado.

### Fase 1 · Snapshot histórico

Persistir evidencia diaria de manera idempotente, sin decisiones automáticas.

Resultado esperado: serie temporal confiable por SKU/sucursal.

### Fase 2 · Analítica descriptiva

Calcular recurrencia, rachas y contradicciones con stock/vencimientos.

Resultado esperado: ranking explicable de patrones para validar con operación.

### Fase 3 · Validar reglas

Usar datos reales para decidir qué patrón merece abrir un problema y con qué umbral.

Resultado esperado: reglas aprobadas y testeables.

### Fase 4 · Ciclo agéntico

Abrir problema, investigar, recomendar, asignar, controlar, reabrir/escalar y cerrar.

Resultado esperado: circuito operativo completo.

### Fase 5 · Resultado económico

Incorporar la métrica económica aprobada y medir dinero protegido/recuperado sin atribuciones causales no demostradas.

## 15. Tests obligatorios futuros

Cuando comience la implementación se deberán cubrir al menos:

- importación idempotente;
- aislamiento por organización/sucursal;
- ceros iniciales de SKU;
- fechas en `America/Argentina/Buenos_Aires`;
- ausencia de duplicación de snapshots;
- recurrencia calculada sólo sobre días realmente observados;
- no confundir falta de archivo con ausencia del SKU;
- no hardcodear el ejemplo 9/10 como regla sin aprobación;
- cruce con vencimientos sin modificar datos del Agente 1;
- ciclos nuevos después de una resolución real;
- seguridad: ninguna expansión accidental de RPC browser;
- trazabilidad completa desde problema hasta observaciones fuente.

## 16. Bloqueos reales antes de implementar reglas

1. **Archivo exacto de Reposición Asistida**: falta una muestra validada por contenido.
2. **Semántica económica de disponibilidad**: falta decidir qué dinero representa una venta/quiebre evitado.
3. **Regla de apertura**: debe derivarse de datos reales, no del ejemplo 9/10.
4. **Regla de resolución sostenida**: depende de la frecuencia y comportamiento real del reporte.

Estos puntos no son detalles técnicos. Modifican el comportamiento del negocio y deben resolverse con evidencia antes de codificarlos.

## 17. Criterio de éxito del Agente 2

El agente no estará terminado porque muestre un ranking de faltantes.

Estará completo cuando pueda sostener, con evidencia trazable:

> Este SKU tiene un problema persistente de disponibilidad; ésta es la evidencia; éste es el impacto físico y económico que podemos justificar; ésta es la causa confirmada o la hipótesis a verificar; ésta es la acción responsable; y Noven controló después si el problema realmente dejó de ocurrir.
