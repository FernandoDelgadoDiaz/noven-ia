# NoVen IA · Reglas de riesgo, donación y RAG V1

Este documento fija reglas de negocio confirmadas para que la refactorización multitenant no cambie la operación real.

## 1. Estados de riesgo

- **Seguro:** el stock comprometido puede venderse antes de la ventana obligatoria de donación.
- **Radar:** faltan 45 días o menos para vencer y, con la velocidad disponible, el stock comprometido no se vendería antes del retiro obligatorio.
- **Urgente:** faltan 20 días o menos y el riesgo persiste. Requiere intervención/revisión operativa.
- **Donación:** se alcanzó el umbral obligatorio del sector; el producto ya no debe seguir a la venta.
- **Decomiso:** el producto llegó o superó su vencimiento.

La cantidad evaluada es la **cantidad comprometida con esa fecha de vencimiento**, no el stock total informado por Glaciar.

## 2. Umbral de donación

### 2 días antes del vencimiento

Perecederos confirmados:

- Verdulería
- Carnicería
- Lácteos
- Panadería
- Rotisería

### 10 días antes del vencimiento

- Almacén
- Bebidas
- Limpieza
- Perfumería
- No comestibles
- Textil
- Congelados

La política se almacena en `sectores.dias_donacion`; no debe quedar hardcodeada como un único `10` global. Sectores nuevos deben declarar explícitamente su política.

En la base productiva actual LÁCTEOS/PANADERÍA pueden mapearse a 2 y los no perecederos confirmados existentes a 10. FIAMBRES e INSUMOS no se auto-clasifican hasta confirmar su política concreta.

## 3. Ventana comercial real

La capacidad de venta se compara contra los días que quedan **antes de donación**, no contra el día de vencimiento.

`dias_comerciales_restantes = max(dias_hasta_vencimiento - dias_donacion, 0)`

`velocidad_necesaria = cantidad_comprometida / dias_comerciales_restantes`

`dias_stock = cantidad_comprometida / venta_media_diaria`

Hay riesgo cuando `dias_stock > dias_comerciales_restantes`.

No redondear `dias_stock` hacia abajo: las fracciones importan en la frontera.

## 4. RAG — Retiro Anticipado de Góndola

Cuando un producto entra en **Radar**, Glaciar habilita la gestión RAG y sugiere un porcentaje de descuento para acelerar la venta.

NoVen no reemplaza inicialmente el algoritmo de descuento de Glaciar. Su función es cerrar el ciclo que hoy queda manual:

1. detectar que el producto necesita intervención;
2. registrar el porcentaje RAG aplicado;
3. conservar cada cambio de porcentaje como un evento nuevo;
4. observar si baja la cantidad comprometida;
5. comparar velocidad observada contra velocidad necesaria;
6. marcar el RAG como efectivo, insuficiente o sin movimiento;
7. alertar cuando requiere nueva intervención antes de llegar a donación.

Ejemplo: 30% aplicado y luego 50% aplicado son **dos intervenciones históricas**, nunca un único campo sobrescrito.

## 5. Dos velocidades distintas

### VMD histórica — Glaciar

Sirve para la detección predictiva y para conocer el comportamiento normal del SKU. Dos o tres días de venta pueden no modificarla materialmente porque se calcula sobre un histórico mayor.

### Velocidad observada reciente — operador

Se deriva de observaciones sucesivas de la cantidad comprometida.

Ejemplo:

- Día 1: 10 unidades, RAG 30%
- Día 2: 2 unidades, RAG 30%

La señal inmediata es 8 unidades vendidas desde el control anterior, aunque la VMD de Glaciar todavía no cambie.

Si en cambio el operador vuelve a registrar 10 unidades con el mismo RAG, NoVen tiene evidencia de **sin movimiento**.

## 6. Prioridad de señales para evaluar RAG

1. Si existe observación física posterior al RAG, esa señal tiene prioridad para medir la respuesta rápida del stock comprometido.
2. La VMD de Glaciar sigue siendo contexto histórico y recalcula el riesgo cada vez que entra un CSV nuevo.
3. Si no hay control posterior del operador, una VMD suficiente puede confirmar mejoría, pero una VMD que no cambió no prueba por sí sola que el RAG falló.
4. Sin una observación posterior y sin evidencia suficiente de Glaciar, el estado correcto es **pendiente de control**, no “RAG fallido”.

## 7. Invariantes

- No inventar un porcentaje RAG recomendado si no existe evidencia suficiente.
- No modificar los umbrales 45/20 ni las políticas 2/10 sin una decisión explícita de negocio.
- No confundir stock total de Glaciar con stock comprometido por vencimiento.
- No sobrescribir observaciones del operador ni intervenciones RAG: son historia auditable.
- La IA puede explicar/priorizar; la clasificación base debe ser determinística y reproducible.
