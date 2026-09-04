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
   INSERT INTO public.rag_escala_descuento (organizacion_id, escalon, porcentaje)
   SELECT o.id, e.escalon, e.porcentaje
   FROM public.organizaciones o
   CROSS JOIN (VALUES
     (1::smallint, 10::numeric),
     (2, 20),
     (3, 30),
     (4, 40),
     (5, 50),
     (6, 60),
     (7, 70)
   ) AS e(escalon, porcentaje)
   WHERE o.codigo = 'ORG001'   -- ← el código de la organización, siempre presente
   ON CONFLICT DO NOTHING;
   ```

4. Verificar que quedó cargada sólo donde corresponde:

   ```sql
   SELECT o.codigo, e.escalon, e.porcentaje
   FROM public.rag_escala_descuento e
   JOIN public.organizaciones o ON o.id = e.organizacion_id
   ORDER BY o.codigo, e.escalon;
   ```

### Reglas de la escala

- `escalon` es un entero ≥ 1 y ordena la escala. «Subir un escalón» significa moverse al `escalon` siguiente, no sumar un porcentaje fijo.
- Los porcentajes deben ser crecientes con el escalón, sin repetirse: un mismo porcentaje en dos escalones haría ambiguo «subir uno», y la constraint `UNIQUE (organizacion_id, porcentaje)` lo rechaza.
- `porcentaje` debe estar en (0, 100].
- **Nunca ejecutar la carga sin `WHERE`.** Sin esa cláusula el `INSERT` abanica sobre todas las organizaciones.
- Cambiar la escala de una organización que ya tiene intervenciones RAG cargadas altera cómo se leen los `escalones_aplicados` históricos, que se calcularon contra la escala vigente en ese momento. Es una decisión de negocio, no un ajuste de configuración.

### Escala vigente de La Anónima

`ORG001` — S.A. IMP. Y EXP. DE LA PATAGONIA: 10, 20, 30, 40, 50, 60, 70. Cargada el 2026-09-04 como operación de datos, con el SQL de arriba.
