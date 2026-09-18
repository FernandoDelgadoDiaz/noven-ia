# Bandeja zonal RAG · especificación de la tabla

Esta pantalla se había implementado como tarjetas. El mockup que la definió era
una tabla y vivía fuera de Git, así que la tarjeta no contradecía nada escrito:
**este documento existe para que la próxima vez sí lo contradiga.**

## Para quién es la pantalla

La administrativa zonal de precios **no analiza: transcribe.** Recibe más de
treinta solicitudes diarias de distintas sucursales, las carga en el sistema de
la cadena y marca cada una como activa. Su trabajo es de lectura horizontal:
recorrer una fila de punta a punta y copiarla.

De ahí salen todas las decisiones de abajo. Una tarjeta sirve cuando hay una
solicitud; con treinta obliga a scrollear para hacer un trabajo que no es de
lectura vertical.

## El presupuesto de ancho

Anchos mínimos legibles a `text-xs`, medidos sobre el contenido real del
circuito —código de artículo de 13 dígitos, descripciones de producto de la
cadena, nombres de usuario completos—:

| # | Columna | Mínimo | Nota |
|---|---|---:|---|
| 1 | Sector / familia | 150 | admite dos renglones |
| 2 | Código | 110 | 13 dígitos, tabular |
| 3 | Producto | 220 | **absorbe el ancho sobrante** |
| 4 | Cambio RAG | 90 | `20% → 30%` |
| 5 | Vto. producto | 88 | |
| 6 | Fin de acción | 88 | |
| 7 | Stock comprometido | 80 | alineada a la derecha |
| 8 | Validado por | 130 | |
| 9 | Fecha de validación | 120 | con hora |
| 10 | Estado | 170 | etiqueta + fecha de habilitación |
| 11 | Acción | 130 | fija a la derecha |
| | **Total** | **1376** | |

**El hallazgo que ordena todo lo demás:** con el contenedor anterior
—`max-w-6xl`, 1152px, menos `px-8` = 1088px útiles— la tabla no entra **ni en
pantalla ancha**. El scroll horizontal no sería el caso raro de la pantalla
chica: sería el caso normal.

Por eso esta pantalla usa `max-w-[1600px]` y no el `max-w-6xl` del resto. **No
es una página de lectura, es una mesa de trabajo.** Con 1536px útiles las once
columnas entran completas en cualquier monitor de escritorio y «Producto»
respira.

## Qué pasa en pantalla angosta

| Viewport | Comportamiento |
|---|---|
| **≥ 1440px** · el caso real | Todo visible, sin scroll horizontal. |
| **768 – 1440px** · notebook chica | La **tabla** scrollea horizontal dentro de su propio bloque. `Código` y `Producto` quedan fijas a la izquierda y `Acción` a la derecha. El encabezado de zona, la línea de jornada, el título de sucursal y los botones de exportar **no scrollean**: viven fuera del contenedor. |
| **< 768px** · teléfono | La misma tabla y el mismo scroll, **sin columnas fijas**. |

### Por qué se fijan `Código` y `Producto`, y no `Sucursal`

Son las dos que **identifican la fila**. Si se van de pantalla, cada celda
restante queda sin dueño: es la falla clásica de las tablas anchas. `Sucursal`
no cumple ese papel acá porque el encabezado del grupo ya dice de qué sucursal
es cada bloque.

### Por qué `Acción` se fija a la derecha

Con scroll horizontal, el botón que resuelve la fila no puede quedar fuera de
vista. Es la única columna que produce un efecto, no un dato.

### Por qué en teléfono se suelta el anclaje

`Código` + `Producto` fijas son unos 330px. En un teléfono de 390px dejarían
60px de ventana para scrollear: el anclaje deja de ayudar y estorba. La
administrativa trabaja en escritorio, así que el teléfono es la excepción y se
resuelve como excepción.

## Lo que se decidió NO hacer

**Ocultar columnas por umbral.** Es lo más común y acá es lo peor. El trabajo es
transcribir: si a 1200px desaparece «Stock comprometido», no hay ninguna señal
de que falta, y la fila se copia incompleta. El error se descubre en el otro
sistema, no acá. **Un scroll se ve y se recupera; una columna ausente no.**

**Tarjeta en móvil y tabla en escritorio.** Dos renderizados de la misma
pantalla son exactamente el mecanismo que produjo el problema que este documento
corrige: el mockup decía tabla y se implementó tarjetas. **Un solo renderizado
no puede divergir.**

## La divergencia deliberada entre pantalla y archivo

La pantalla **no** tiene columna `Sucursal`; la exportación **sí**.

No es una inconsistencia: dentro de un grupo la columna repetiría el mismo valor
en todas las filas, y el encabezado del bloque ya lo dice. El archivo, en
cambio, se va de esta pantalla y pierde el contexto del agrupamiento, así que
necesita la columna para poder leerse solo.

Queda anotada en `ENCABEZADOS_EXPORTACION` y verificada por el contrato, para
que quien compare pantalla contra archivo no la lea como un defecto.

## Lo que la tabla conserva del diseño anterior

Estaba bien resuelto y no se toca:

- el agrupamiento por sucursal, con su encabezado y su contador;
- el orden `sucursal → sector/familia → fin de acción → llegada`;
- el encabezado con zona, pendientes y ventana de recepción;
- la línea de jornada con el estado de la ventana;
- los dos botones de exportar, por zona y por sucursal.

## Fuera de alcance · la ejecución en tanda

La **selección múltiple y la ejecución en tanda** pertenecen al paso 5 del
circuito —impresión y operación por lote—, que sigue abierto. La fila está
preparada para recibir una casilla como primera columna fija sin rehacer el
anclaje, pero hoy no la tiene.

**No es urgente.** Con el volumen de solicitudes que hay hoy, de a una funciona.
Se vuelve necesario cuando la zona entera empiece a generar volumen real.

**La pregunta central, para cuando se plantee: si falla la séptima de treinta,
qué ve la administrativa.** `ejecutar_solicitud_cambio_rag` opera de a una, así
que hay dos formas de armar la tanda y no son equivalentes:

- **Treinta transacciones con reporte por fila.** Las veintinueve que
  corresponden quedan cargadas; la que falló se marca y se reintenta.
- **Una RPC de lote transaccional.** Si una falla se revierten las
  veintinueve que sí correspondían.

La intuición del responsable del producto es que lo transaccional es peor acá,
por esa reversión. Queda escrito como intuición y no como decisión: se decide
con el dato —qué falla realmente en producción y con qué frecuencia—, no con la
intuición.

Nota de diseño que este documento ya aporta al planteo: **si la tanda reporta
por fila, la tabla es el lugar natural del reporte** —una columna de resultado,
o el estado de la propia fila cambiando—, y eso no obliga a inventar una
pantalla de resumen.
