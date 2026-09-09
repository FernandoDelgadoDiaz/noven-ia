# Circuito de validación y ejecución centralizada de RAG

**Estado: CONTRATO APROBADO · IMPLEMENTACIÓN POR BLOQUES AUTORIZADA.**

Va después de la oferta central —bloques A, B y C—. Los principios normativos
que lo gobiernan viven en `PRODUCT_VISION.md`, sección "Recomendación,
autorización y ejecución"; acá está el detalle. Si algo de este documento
contradice esos principios, prevalecen ellos.

El estado ejecutable, la rama activa y el siguiente paso se mantienen en
`docs/CURRENT_WORK.md`; este documento conserva el contrato de producto.

---

## El problema real

La compañía no permite que un gerente de sucursal cambie precios. El circuito
actual es manual: cada gerente arma un Excel al final del día y se lo manda por
correo a la administrativa de precios zonal, que carga los cambios en el sistema
de la cadena. En Río Gallegos, una administrativa gestiona los precios de
dieciséis locales.

NoVen hoy calcula la sugerencia y ahí se detiene. El resto sigue siendo correo y
planilla.

Este circuito reemplaza ese tramo manual. **No cambia precios ni sustituye al
sistema de la cadena:** coordina quién pide qué, quién lo ejecuta y cuándo
empieza a medirse.

---

## Los tiempos reales, que definen todo el diseño

- El pedido tiene que estar **antes del mediodía**.
- La administrativa procesa **entre las dos y las cuatro** de la tarde.
- El cambio impacta en góndola **al día siguiente**.

Ese desfasaje de un día es el que obliga a separar tres momentos que hoy están
fundidos en un solo botón: **pedir**, **ejecutar** y **empezar a medir**.

---

## El circuito, paso a paso

**1 · El motor sugiere.** Aparece en la tarjeta del producto cuando alguien
registra un control y la cobertura queda por debajo de 1. Sin control nuevo no
hay sugerencia nueva.

**2 · El gerente o supervisor pide el cambio.** El botón dice **"Informar 50%"**
—no "usar", porque todavía no se puede usar—. Al apretarlo se crea una solicitud
y el botón queda en rojo: pedido, no ejecutado.

El operador ve todo esto pero no puede apretar. Su tarjeta muestra la sugerencia
con el botón deshabilitado y el texto "Requiere validación del gerente o
supervisor". Ve el estado, no la acción.

**3 · La administrativa ejecuta.** Ve la solicitud en su bandeja zonal, la carga
manualmente en el sistema de la cadena y marca **ejecutado** en NoVen. En la
pantalla de la sucursal no cambia nada todavía, porque el precio en góndola sigue
siendo el viejo.

**4 · Al día siguiente se habilita.** El botón pasa a verde y se puede apretar.
Las dos condiciones son necesarias: **ejecutado por la administrativa** *y*
**pasó el día**. Si la administrativa no ejecutó, mañana no se habilita nada — el
precio no está en góndola.

**5 · Alguien confirma que está aplicado.** Este segundo click lo puede hacer
cualquiera de los tres roles, **incluido el operador**. Confirmar que un precio
está en góndola no es una decisión, es mirar — y quien está parado frente al
producto suele ser el operador.

Recién ahí arranca el tramo del 50% y el motor empieza a medir.

**Consecuencia de diseño: el sistema nunca mide contra un precio supuesto.**
Siempre contra uno que una persona verificó en góndola. Eso es más fuerte que
cualquier automatismo.

---

## El caso que hay que cubrir: ejecutado pero no aplicado

Si al día siguiente el precio no está cargado —la administrativa marcó ejecutado
y algo falló— tiene que haber una salida para decir **"esto no está aplicado"**,
en vez de confirmar algo falso.

Sin esa salida, alguien va a apretar el verde igual y el tramo arranca sobre un
precio que no existe. Es la misma familia de problemas que venimos persiguiendo:
**dos situaciones distintas produciendo el mismo estado.**

---

## Contrato UX de las pantallas operativas (bloque C2)

La referencia visual son las pantallas actuales: la tarjeta de alerta priorizada
del Dashboard y el modal donde se registra el control. C2 **las extiende; no las
rediseña**. La mayoría de los usos diarios son de operadores en góndola, por lo
que cada estado debe responder rápidamente una sola pregunta: **qué tengo que
hacer ahora**.

### La verdad entra por el click

NoVen no infiere intervenciones ni reconstruye fechas anteriores al registro:

- si un producto ya estaba físicamente en oferta central cuando se escanea, pero
  nadie toca **"Informar oferta central"**, para NoVen sigue sin intervención;
- al tocar ese botón se abre el tramo en la fecha y hora del click, usando el
  control con stock conocido como punto inicial. No se retrotrae al comienzo
  real de una oferta que NoVen no observó;
- **"Finalizar oferta central"** cierra solamente ese tramo en la fecha y hora
  del click;
- una transferencia se declara mediante su botón cuando el operador la observa.
  Las unidades transferidas no se cuentan como venta y la declaración no abre,
  reemplaza ni cierra un RAG o una oferta central;
- en el circuito centralizado de RAG, ni la solicitud del gerente ni la marca de
  ejecución administrativa abren el tramo. El RAG empieza cuando alguien en la
  sucursal toca **"Confirmar NN% en góndola"**.

Por lo tanto, una realidad que todavía no fue informada puede existir fuera de
NoVen, pero el sistema no la presenta ni la mide como si la conociera.

### Riesgo e intervenciones son dimensiones independientes

**Seguro, Radar y Urgente** describen el riesgo calculado. No dicen qué acción se
está aplicando. Un producto en cualquiera de esos estados puede tener:

- ninguna intervención;
- sólo RAG;
- sólo oferta central;
- RAG y oferta central simultáneamente;
- una transferencia declarada durante cualquiera de los estados anteriores.

RAG y oferta central conservan inicios y finales independientes. Iniciar o
finalizar uno nunca modifica el otro. Cuando se superponen, la pantalla puede
mostrar la respuesta combinada, pero el histórico no debe atribuirla falsamente
a una sola intervención.

Para el usuario son tres herramientas contra la pérdida —RAG, oferta central y
transferencia— aunque su persistencia interna pueda ser distinta: RAG y oferta
central tienen tramos de vigencia; la transferencia es un movimiento físico de
stock.

### Dashboard del operador

La tarjeta actual conserva su jerarquía: producto, urgencia, vencimiento, stock
comprometido, intervenciones y próximo paso. Es una superficie de lectura; no se
convierte en una bandeja administrativa.

- Las intervenciones se muestran como pastillas breves: **"RAG activo · 20%"**,
  **"Oferta central activa"** y **"Transferencia informada"**.
- Cuando no entren todas, se muestran hasta dos y luego **"Ver N más"**. Un
  **"+1"** aislado no alcanza porque obliga a adivinar qué está oculto.
- Debajo puede existir un solo aviso principal: control pendiente, revisar
  intervención, solicitud pendiente, listo para confirmar u otra próxima acción.
- El color nunca comunica por sí solo: cada estado lleva texto e icono.
- Las acciones se realizan al abrir el producto; no se agregan filas de botones
  a la tarjeta.

### Modal de control

Los campos actuales de stock, vencimiento y cantidad observada se mantienen. La
sección actual de RAG evoluciona a **Intervenciones** reutilizando la misma
estructura visual. No se apilan tres tarjetas. Puede haber controles compactos
independientes para RAG y oferta central —porque pueden convivir—, pero sólo una
acción se destaca como próximo paso principal. Ningún control válido se oculta
por estar activa otra intervención.

| Estado específico | Control visible |
|---|---|
| Sin oferta central informada | **Informar oferta central** |
| Oferta central activa | **Finalizar oferta central** |
| RAG vigente | **Finalizar RAG** |
| Transferencia observada | **Informar transferencia** |
| Sugerencia RAG · operador | **Requiere gerente o supervisor** — deshabilitada |
| Sugerencia RAG · gerente o supervisor | **Informar NN%** |
| Solicitud pendiente de ejecución | **Pendiente de ejecución** — sin acción |
| Ejecutada, todavía no habilitada | **Ejecutada · disponible mañana** — sin acción |
| Lista para verificar | **Confirmar NN% en góndola** |
| Ejecutada pero ausente en góndola | **No está aplicado** |

Los textos **"Usar NN%"** y **"elegir otro porcentaje"** quedan prohibidos en
este circuito: pedir no es aplicar y la sugerencia no se negocia. El porcentaje
se muestra, pero ningún cliente puede reemplazarlo silenciosamente por otro.

### Separación por rol

- El operador registra controles, informa una oferta central observable, declara
  una transferencia y confirma si el RAG ejecutado está realmente en góndola.
- El gerente o supervisor valida la sugerencia y crea la solicitud mediante
  **"Informar NN%"**.
- La administrativa zonal trabaja en su bandeja propia; no aparecen controles
  administrativos dentro del Dashboard del operador.

### Condiciones de aceptación de C2

1. Sin click no existe intervención para NoVen y no empieza ninguna medición.
2. Una oferta central ya vigente al primer escaneo empieza en NoVen cuando el
   operador la informa, nunca antes.
3. Iniciar o finalizar una intervención no altera las otras.
4. Solicitar o marcar ejecutado un RAG no abre un tramo; confirmarlo en góndola,
   sí.
5. La tarjeta del Dashboard mantiene su estructura actual y muestra estados, no
   una colección de botones.
6. El modal destaca una sola próxima acción inequívoca según rol y estado, sin
   ocultar los controles independientes necesarios para que dos intervenciones
   puedan convivir.
7. Cada transición conserva usuario, fecha y hora; nada se sobrescribe ni se
   deduce a partir del color de la interfaz.

---

## Bandeja del gerente

Contraparte de la bandeja de la administrativa. Sin ella, el gerente tendría que
entrar producto por producto para encontrar qué necesita validación, que es el
trabajo manual que NoVen existe para eliminar.

**Qué muestra:**

- Sugerencias esperando validación, de todos los operarios de su sucursal.
- Solicitudes ya validadas, con su estado: pendiente de ejecución / ejecutada /
  lista para activar.

Lo segundo importa tanto como lo primero: si el gerente valida y pierde de vista
qué pasó con su pedido, el envejecimiento silencioso vuelve por otro lado.

**Orden por impacto, con dos criterios EN SECUENCIA y no un score compuesto:**

1. **Urgencia** — días comerciales restantes, ascendente.
2. **Dinero en riesgo** — unidades comprometidas por costo, descendente.

La urgencia manda sobre el monto porque el dinero de un producto que ya venció es
cero.

**No inventar un índice que multiplique las dos cosas.** La fórmula de Comodoro
sumaba velocidades con porcentajes y no significaba nada; un score compuesto hay
que justificarlo con evidencia que todavía no existe.

**Señal aparte, no sugerencia:** productos sin control reciente cuya ventana se
está cerrando. El mensaje es "mandá a controlar esto", no un porcentaje calculado
sobre datos viejos. El motor no sugiere sin observación nueva.

---

## Bandeja de la administrativa zonal

Bandeja operacional, no dashboard analítico. Sólo solicitudes ya validadas de su
zona.

**Orden:** sucursal → sector/familia → fin de acción ascendente.

**Columnas:** sucursal, sector/familia, código, producto, RAG actual, nueva RAG,
vencimiento del producto, fin de acción, stock comprometido, validado por, fecha
de validación, estado.

**Dos fechas distintas que no hay que confundir:**

- **Vto producto** — la fecha real de vencimiento.
- **Fin acción** — el límite de la ventana comercial, derivado de
  `fecha_vencimiento − sectores.dias_donacion`. Diez días antes en masivos y
  congelados, dos en perecederos. **La fuente de verdad es la política existente,
  nunca constantes duplicadas en la pantalla nueva.**

**Exportar e imprimir**, porque la carga en el sistema de la cadena es manual y
necesita la lista en mano. El Excel respeta filtros, orden y agrupación de la
pantalla. No un CSV renombrado.

**Marcar como ejecutadas**, de a una o varias. Idempotente. La administrativa
sólo confirma la ejecución: **no puede modificar** el porcentaje propuesto, el
producto, el vencimiento, la sucursal ni el validador.

**Visibilidad de 24 horas:** los pendientes se muestran siempre, sin importar
antigüedad. Los ejecutados desaparecen de la bandeja activa 24 horas después.
**Desaparecen de la vista, no de la base — nada se borra.**

---

## Rol nuevo: administrativa de precios zonal

Alcance: organización y zona obligatorias, sucursal nula. **No es un gerente
zonal** y no debe ganar por accidente Scanner, escritura de vencimientos,
controles, análisis gerencial, importación, administración local ni Radar
operativo.

Su única capacidad es consultar y ejecutar solicitudes ya validadas de su zona.

Se da de alta desde Accesos y jerarquía, no desde la administración local de una
sucursal.

El alta debe exigir una zona concreta —por ejemplo, `Santa Cruz Sur`—. No existe
una administrativa de precios global ni una asignación directa a sucursal: su
bandeja reúne únicamente las sucursales que pertenecen a la zona seleccionada.
La interfaz de Accesos y jerarquía y su API deben aplicar esta misma regla antes
de habilitar la bandeja del bloque 3.

La existencia previa de un gerente zonal **no es requisito** para crear la
administrativa. Si la zona todavía no tiene esa cobertura, el alta debe ofrecer
invitarlo ahora o continuar y completar la estructura después. La ausencia se
registra y se muestra como pendiente de jerarquía, pero no bloquea a la
administrativa ni su trabajo.

---

## La decisión de modelo que sostiene todo

**Una solicitud no es una intervención.** `solicitudes_cambio_rag` va separada de
`intervenciones_rag`.

Si se mezclaran, el motor mediría contra un precio que todavía no está en
góndola, y todo el trabajo de tramos y cobertura quedaría midiendo humo. La
intervención se crea recién en el paso 5, cuando alguien confirma que el precio
está aplicado.

Vínculo opcional: la intervención resultante puede referenciar la solicitud que
la originó, con FK nullable y sin tocar las intervenciones históricas.

---

## Trazabilidad completa

Tiene que poder reconstruirse:

qué sugirió NoVen → quién validó y cuándo → qué RAG estaba vigente → qué se
solicitó → quién ejecutó y cuándo → cuándo entró en vigencia → cuándo se confirmó
en góndola → qué pasó después.

**Nada se sobrescribe.**

---

## Un dato de producto que cambia el peso del motor

Definición explícita: **si el cálculo está bien hecho, la sugerencia no se
discute.** Si el sistema dice 50%, se pone 50%. Nadie negocia un 40%.

Eso simplifica el circuito —el botón es confirmación, no decisión— y a la vez
sube la apuesta: el número que sugiere el motor tiene más peso del que parecía, y
calibrar bien los umbrales importa más de lo que se pensaba.

---

## Secuencia de implementación y evidencia

**Primero hay que cerrar la oferta central** (bloques A, B y C): declararla desde
el inicio, finalizarla, que conviva con RAG, y las salidas que no son venta.

**Decisión del 2026-09-08:** la evidencia no se inventa ni se reemplaza con datos
fabricados, pero tampoco se obtiene esperando fuera del circuito. El propio
flujo operativo —sugerir, validar, ejecutar, confirmar y volver a controlar— es
el mecanismo que la produce. Por eso la implementación empieza una vez cerrados
A, B y C, condición que ya se cumplió.

La muestra de **veinte a treinta sugerencias aceptadas y medidas** conserva otro
papel: es condición para afirmar efectividad histórica, recalibrar umbrales,
recomendar a partir de antecedentes o aumentar autonomía. No es condición para
construir la coordinación y trazabilidad que permiten obtener esa muestra.

Hasta que exista evidencia suficiente:

- el porcentaje proviene únicamente del motor determinístico vigente;
- ningún histórico aislado modifica la sugerencia;
- la interfaz distingue “evidencia insuficiente” de “intervención inefectiva”;
- toda solicitud, ejecución, confirmación y control queda registrada para formar
  la muestra real.

La implementación se divide en bloques acumulativos:

1. modelo de solicitud, máquina de estados y permisos;
2. validación gerencial y seguimiento desde la sucursal;
3. bandeja zonal y ejecución individual;
4. confirmación o rechazo en góndola y apertura del tramo sólo al confirmar;
5. exportación, impresión y ejecución por lote.

---

## Un punto abierto que toca el trabajo en curso

Si la RAG entra en vigencia al día siguiente, la fecha de inicio del tramo no es
el momento de un click de autorización. Hoy los tramos arrancan con el click.

Este circuito lo resuelve haciendo que el tramo arranque en el **paso 5** —la
confirmación en góndola—, que también es un click. Así que el modelo de tramos no
necesita cambiar.

**Pero conviene tenerlo presente al cerrar el bloque B, para no cerrar esa
puerta.**

---

## Lo que esto significa comercialmente

Hoy NoVen es una herramienta que usa un gerente en su sucursal. Con este circuito
pasa a ser **la capa de coordinación entre sucursal y zona**.

Una vez que la administrativa trabaja desde esa bandeja, la cadena depende de
NoVen para operar: deja de ser un "nice to have" de un local y pasa a ser el
proceso.

Y ataca un dolor concreto con dueño identificable — un circuito manual de Excel y
correo que ya existe y que molesta a dieciséis personas. Eso es mucho más
vendible que proponer una mejora que nadie pidió.
