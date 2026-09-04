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

## 8. Escala de descuentos RAG — carga por organización

La escala de porcentajes RAG autorizados vive en `public.rag_escala_descuento`, con clave `(organizacion_id, escalon)`. **Es política comercial de cada organización, no una constante del producto.** El motor de sugerencia nunca propone un valor fuera de esta escala, y una organización sin filas cargadas no recibe sugerencias: sin escala no hay porcentaje autorizado que proponer, y §7 prohíbe inventar uno. Nunca hay un default.

### Por qué esto no va en una migración

Una migración corre en **todo** deployment de NoVen. Un `INSERT` de escala ahí le impone los porcentajes de un retailer a organizaciones que nunca los eligieron, y una vez aplicada no se puede sacar sin borrar datos. Por eso la carga es una **operación de datos**, acotada a una organización, ejecutada una vez por cliente.

Esto ya pasó: la migración `20260904120000_rag_cobertura_escala_e_instrumentacion_v1` traía una semilla con `CROSS JOIN` sobre `public.organizaciones` sin acotar. Se sacó en el PR #154, antes de aplicarla. El contrato `rag-cobertura-esquema-contract` ahora falla si alguien la repone.

### Procedimiento para una organización nueva

1. Conseguir de la organización su escala autorizada — los porcentajes que su política comercial admite, en orden creciente. No inferirla de los descuentos ya usados: un porcentaje aplicado alguna vez no prueba que esté autorizado.
2. Verificar que la organización exista y anotar su `codigo`:

   ```sql
   SELECT id, codigo, nombre FROM public.organizaciones ORDER BY created_at;
   ```

3. Cargar la escala acotada a esa organización. El `WHERE` es lo que impide que toque a las demás, y el `ON CONFLICT DO NOTHING` la hace repetible sin pisar una escala ya configurada:

   ```sql
   BEGIN;

   -- La escala se REEMPLAZA entera, no se completa. Los escalones tienen que
   -- quedar numerados 1..N sin huecos: la RPC de instrumentación calcula
   -- `escalones_aplicados` restando números de escalón, y un hueco haría que un
   -- movimiento de un escalón se registre como dos.
   DELETE FROM public.rag_escala_descuento
   WHERE organizacion_id = (SELECT id FROM public.organizaciones WHERE codigo = 'ORG001');

   INSERT INTO public.rag_escala_descuento (organizacion_id, escalon, porcentaje)
   SELECT o.id, e.escalon, e.porcentaje
   FROM public.organizaciones o
   CROSS JOIN (VALUES
     (1::smallint, 20::numeric),
     (2, 30),
     (3, 50),
     (4, 70)
   ) AS e(escalon, porcentaje)
   WHERE o.codigo = 'ORG001';   -- ← el código de la organización, siempre presente

   COMMIT;
   ```

   Correrlo dos veces deja las mismas cuatro filas: es idempotente por
   construcción. El `DELETE` está acotado por `organizacion_id`; sin esa
   cláusula borraría la escala de todas.

4. Verificar que quedó cargada sólo donde corresponde:

   ```sql
   SELECT o.codigo, e.escalon, e.porcentaje
   FROM public.rag_escala_descuento e
   JOIN public.organizaciones o ON o.id = e.organizacion_id
   ORDER BY o.codigo, e.escalon;
   ```

### Reglas de la escala

- `escalon` es un entero ≥ 1 y ordena la escala. «Subir un escalón» significa moverse al `escalon` siguiente, no sumar un porcentaje fijo. **Los escalones van numerados 1..N sin huecos**, porque la RPC de instrumentación deriva `escalones_aplicados` restando números de escalón.
- **El motor sugiere siempre UN escalón por vez.** La regla anterior subía dos ante un déficit severo, y se diseñó para una escala de incrementos parejos de diez, donde saltar dos era subir veinte puntos. Con saltos desiguales, subir dos desde 30 sería ir a 70: cuarenta puntos de una. No se pierde reacción porque el tiempo ya está dentro del cálculo de cobertura — si el producto no se mueve, la ventana se achica, la necesaria sube, la cobertura cae y en el próximo control vuelve a sugerir. Se pasa por cada escalón intermedio, que es exactamente lo que un salto doble se saltea.
- Cuando el déficit es severo —sin movimiento, o cobertura por debajo de 0,5— la tarjeta **avisa que ese escalón probablemente no alcance**. Es un aviso, no una predicción: Noven no modela cuánto acelera la salida un punto más de descuento. Mostrar el límite es honesto; saltar dos por cuenta propia no lo sería.
- Un porcentaje que quedó **fuera de la escala** —cargado a mano, o sobreviviente de una escala anterior— no rompe nada: el motor se ancla en el escalón más alto que no lo supere y sube uno desde ahí. Un RAG en 40 con la escala 20/30/50/70 sugiere 50.
- Los porcentajes deben ser crecientes con el escalón, sin repetirse: un mismo porcentaje en dos escalones haría ambiguo «subir uno», y la constraint `UNIQUE (organizacion_id, porcentaje)` lo rechaza.
- `porcentaje` debe estar en (0, 100].
- **Nunca ejecutar la carga sin `WHERE`.** Sin esa cláusula el `INSERT` abanica sobre todas las organizaciones.
- Cambiar la escala de una organización que ya tiene intervenciones RAG cargadas altera cómo se leen los `escalones_aplicados` históricos, que se calcularon contra la escala vigente en ese momento. Es una decisión de negocio, no un ajuste de configuración.

### Escala vigente de La Anónima

`ORG001` — S.A. IMP. Y EXP. DE LA PATAGONIA: **20, 30, 50, 70**. Escala corporativa, con saltos desiguales de 10, 20 y 20 puntos.

La primera carga (10/20/30/40/50/60/70) se reemplazó el 2026-09-04 al confirmarse la escala corporativa real. No había ninguna intervención RAG activa en 10, 40 ni 60, ni instrumentación histórica que reinterpretar.
