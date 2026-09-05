# Benchmark de volumen · ítem 3.3

**Estado: medido. No se aplicó ningún cambio.** Este documento reporta lo que
las mediciones dicen, incluida la parte que contradice lo que este mismo
documento anticipaba en su primera versión.

Los planes crudos completos —siete caminos, tres escalas, con `ANALYZE` y
`BUFFERS`— están en `scripts/benchmark-volumen/real-{1,100,1000}.json`.

---

## 1. Cómo se midió, y por qué eso decide si el resultado vale

### La identidad

Todas las mediciones corren como `authenticated` con RLS activa. `medir.mjs`
verifica `current_user`, `row_security` y `auth.uid()` antes de medir y aborta
si alguno no es el esperado. Los tres quedan guardados en cada informe.

Medir como `postgres` es el error que invalida casi todo benchmark de Supabase:
con superusuario RLS no se aplica, y a la consulta medida le falta el predicado
de las políticas. No sería la consulta que corre en producción.

### La guardia que faltaba, y que este trabajo necesitó

La guardia de identidad **no alcanzaba**. En la primera corrida contra el
esquema real, el usuario no llegó a sembrarse —`usuarios.rol` es la columna
legada y sólo admite `admin`/`operador`/`supervisor`, mientras que el rol
multitenant vive en `usuario_accesos.rol`— y la medición siguió adelante igual:
`authenticated`, RLS activa, y **cero filas visibles**.

El benchmark reportó tiempos excelentes de no devolver nada.

Es el modo de fallo más traicionero de esta clase de medición: no da error, da
números buenos. Ahora `verificarQueVeDatos` aborta si el usuario medido no ve
filas en su sucursal, y el conteo queda registrado en cada informe.

### El entorno

| | |
|---|---|
| Esquema | baseline del repositorio + las cinco migraciones posteriores, en orden |
| Postgres | 16.13 local, **producción corre 17.6** |
| Corridas | 7 por camino, se descarta la primera (llena caché), se reporta la mediana |
| Reloj | fijo en `2026-09-01`; medir contra `now()` haría variar las filas y el plan |

**Lo que esta diferencia de versión cuesta.** Las latencias absolutas no son
transferibles a producción. Lo que sí transfiere es la forma del plan y el
conteo de buffers, y sobre eso se apoya todo lo que sigue. Ninguna conclusión
de este documento depende de un número de milisegundos.

Dos adaptaciones al aplicar la baseline localmente: `pg_net` y `supabase_vault`
no existen fuera de Supabase, y el privilegio `MAINTAIN` es de Postgres 17.
Ninguna toca planificación.

---

## 2. Resultado

Medianas en milisegundos.

| Camino | 1× | 100× | 1000× |
|---|---:|---:|---:|
| vencimientos · lista (vista) | 32,3 | 3.585,9 | 6.983,7 |
| vencimientos · tabla base | 15,7 | 1.505,7 | 3.047,8 |
| vencimientos · con producto | 29,6 | 3.486,9 | 7.036,1 |
| dashboard · agregado por familia | 19,4 | 1.853,5 | 3.831,7 |
| **scanner · por código de barras** | **0,9** | **3,2** | **3,2** |
| **scanner · por cod_art** | **0,9** | **3,1** | **3,1** |
| análisis · ventana trimestral | 18,8 | 1.773,2 | 4.089,0 |

Filas que el usuario medido ve en su sucursal: 22 → 2.428 → 4.883.

**El scanner no se mueve.** De 0,9 ms a 3,2 ms mientras el resto se multiplica
por doscientos. Resuelve por índice único sobre una fila y el volumen no lo
toca. Es el único camino con expectativa de latencia dura —lo usa una persona
parada frente a la góndola— y es el que mejor está.

**Todo lo demás llega a segundos con 4.883 filas visibles.** Cuatro mil filas
no es un volumen grande. Ahí está el problema.

---

## 3. El hallazgo: no es un problema de índices

Plan real, 1000×, consulta de vencimientos sobre la tabla base:

```
Limit  (rows=200)                                              3047 ms
  Sort
    Bitmap Heap Scan on vencimientos  (rows=4263)              3045 ms
       Filter: activo AND fecha_vencimiento >= '2026-09-01'
               AND noven_private.puede_leer_producto_sucursal(
                     sucursal_id, producto_id)
       Rows Removed by Filter: 620
      Bitmap Index Scan on idx_vencimientos_sucursal            0,066 ms
         Index Cond: (sucursal_id = '…')
```

**El índice tarda 0,066 ms. El predicado tarda el resto.**

Seis corridas útiles a 100×: 1512, 1520, 1486, 1531, 1499, 1489 ms. Sin
dispersión: no es ruido.

### Una hipótesis previa que se descarta

Una versión anterior de este análisis, hecha contra un modelo local en vez del
esquema real, afirmaba que el planificador **no** elegía un índice por
`sucursal_id` y sugería que `idx_vencimientos_sucursal` no hacía su trabajo.

**Era falso, y era artefacto del modelo:** aquel stub no tenía ese índice.
Contra el esquema real el índice se usa en los cuatro caminos de vencimientos y
resuelve en 0,066 ms. Queda descartado como sospechoso.

### La cadena real

```
puede_leer_producto_sucursal(sucursal_id, producto_id)   SECURITY DEFINER
  └── join productos × sucursales
  └── puede_leer_familia_sucursal(sucursal_id, familia_id)  SECURITY DEFINER
        └── join usuarios × sucursales × familias × usuario_accesos
        └── EXISTS sobre usuario_familias_sucursal (rol operador)
```

Dos funciones anidadas, cada una con su join, **una vez por fila candidata**.

### Por qué `STABLE` no alcanzó

`STABLE` y "se evalúa una sola vez" no son lo mismo, y esa confusión es la que
hace parecer suficiente al marcador.

`STABLE` dice que, dentro de una sentencia y **con los mismos argumentos**, el
resultado no cambia. No implica memoización entre valores distintos. Acá los
argumentos son `sucursal_id` y `producto_id` **de cada fila**: cambian siempre,
así que no hay nada que reusar.

Lo que falta es **inlining**. Postgres puede fundir una función SQL dentro de la
consulta, y entonces el planificador ve el `EXISTS` y lo convierte en un
semijoin ejecutado una vez. Pero sólo inlinea si la función **no** es
`SECURITY DEFINER` y **no** tiene cláusula `SET`.

Estas dos tienen ambas cosas. Son cajas negras para el planificador **por
construcción**, y las dos condiciones están ahí a propósito: son el patrón de
seguridad correcto del repositorio.

**Ese es el nudo: lo que hace segura a la función es exactamente lo que le
impide al planificador optimizarla.** No se resuelve sacando `SECURITY DEFINER`.

---

## 4. La forma del arreglo, medida — y su límite

Cambiar la pregunta: de una que se hace por fila a una que se hace una vez.

| | |
|---|---|
| Hoy | "¿esta fila es visible?" · N veces |
| Alternativa | "¿cuál es mi alcance?" · 1 vez, y después pertenencia por fila |

Se probó en la base descartable una función **sin argumentos de fila** —depende
sólo de `auth.uid()`— que devuelve los pares (sucursal, familia) legibles, con
la política reescrita como pertenencia a ese conjunto.

**Equivalencia verificada antes de medir: 4.883 filas visibles, idéntico al
original.** Una alternativa que devuelve otras filas no se compara, se descarta.

### El resultado, 1000×

| Camino | Original | Alternativa |
|---|---:|---:|
| vencimientos · tabla base | 3.048 ms | **68 ms** |
| vencimientos · lista (vista) | 6.984 ms | **7.809 ms** |

El mecanismo es el previsto. En el plan de la alternativa:

```
SubPlan 1
  ->  Nested Loop  (loops=4263)
        ->  Index Scan using productos_pkey on productos p  (loops=4263)
              Filter: familia_id IS NOT NULL
                      AND noven_private.tiene_acceso_organizacion(organizacion_id)
        ->  Function Scan on mi_alcance_lectura a  (loops=4263)
              actual time=0.001..0.002 rows=14
              Filter: (sucursal_id = vencimientos.sucursal_id)
```

`mi_alcance_lectura` aparece con 4.263 loops pero cuesta 0,001 ms cada uno:
Postgres materializa el resultado una vez y re-escanea el tuplestore. Eso es
exactamente lo que se buscaba.

### El límite, que importa más que la mejora

**La vista empeoró levemente: 6.984 → 7.809 ms.** Arreglar una política no
arregla el camino, porque la vista arrastra las políticas de `productos` y
`producto_sucursal`, que tienen su propio predicado `SECURITY DEFINER` por
fila. En el plan de arriba se ve sobreviviendo:
`tiene_acceso_organizacion(organizacion_id)` sobre `productos`.

**El patrón es sistémico, no local.** Un arreglo camino por camino daría
exactamente esta figura: una mejora espectacular en la consulta que se tocó y
ningún cambio en la pantalla que el usuario abre.

Por eso **no se propone todavía**. Lo que este documento sostiene es el
diagnóstico y la dirección; el rediseño del conjunto de políticas es una pieza
propia, con su propia verificación de equivalencia fila por fila, y no debería
decidirse desde una mejora medida en un solo predicado.

---

## 5. Índices: qué dice la evidencia y qué no

Cruce entre el inventario y los índices que aparecen en los planes medidos.

| Escala | `en_plan` | `contador_sin_plan` | `sin_uso` |
|---:|---:|---:|---:|
| 1× | 8 | 3 | 183 |
| 100× | 7 | 4 | 183 |
| 1000× | 6 | 5 | 183 |

### `contador_sin_plan` — hay una tercera causa

| Accesos | Índice |
|---:|---|
| 435.162 | `sucursales.sucursales_id_organizacion_uk` |
| 217.581 | `productos.productos_id_organizacion_uk` |
| 84 | `producto_sucursal.producto_sucursal_producto_org_idx` |
| 70 | `vencimientos.idx_vencimientos_producto` |
| 28 | `sectores.sectores_pkey` |

Contador altísimo, ausente de todo plan. **No es un camino que falte medir:** es
el cuerpo de las funciones `SECURITY DEFINER` de las políticas. El plan interno
de una función no aparece en el `EXPLAIN` de la consulta externa.

Son, de hecho, la contracara del hallazgo de la sección 3: 435.162 accesos a
`sucursales` es la huella de las llamadas por fila.

Hay entonces tres causas para este grupo, no dos, y confundirlas llevaría a
conclusiones opuestas: un camino no medido, un índice usado dentro de una
función, o un uso interno del motor.

### `sin_uso` — 183, y ninguno es candidato a retiro

Aquí la lectura obvia es la equivocada, y conviene decirlo antes que la lista:
**183 sobre 194 no significa que el esquema tenga 183 índices de más.**

El benchmark mide **siete caminos de lectura**. No mide escrituras, ni
importación, ni las pantallas de administración, ni las RPC del scanner, ni
problemas, ni historial. Un índice que ninguno de esos siete caminos usa está
casi siempre sirviendo a algo que no se midió.

**El criterio "contador en cero y ausente de los planes es el caso limpio para
retirar" exige que el benchmark cubra los caminos que usarían ese índice.** Con
siete caminos sobre una aplicación mucho más grande, ese grupo está dominado por
la cobertura del instrumento, no por la inutilidad de los índices.

**Este documento no propone retirar ningún índice.** Hacerlo con esta evidencia
sería exactamente el error que el ítem 3.3 existe para prevenir, sólo que en la
dirección contraria: sacar por falta de prueba en vez de agregar por las dudas.

Para que el retiro sea decidible hace falta ampliar el benchmark a los caminos
de escritura y a las pantallas restantes. Es trabajo propio y está fuera del
alcance de esta medición.

### Lo que sí queda establecido sobre índices

`idx_vencimientos_sucursal`, `idx_productos_codigo_barras`,
`idx_productos_cod_art`, `producto_sucursal_producto_sucursal_uk`,
`productos_pkey` y `familias_pkey` aparecen en los planes medidos y hacen su
trabajo. Ninguno es candidato a nada.

**No se propone ningún índice nuevo.** Ningún plan medido muestra un `Seq Scan`
ni un `Sort` costoso que un índice resolvería. El tiempo está en otro lado, y
agregar un índice acá sería tratar el síntoma.

---

## 6. Conclusión

1. **El scanner está bien** y el volumen no lo afecta.
2. **Los demás caminos llegan a segundos con 4.883 filas visibles**, que es poco
   volumen.
3. **La causa no son los índices.** El índice resuelve en 0,066 ms; el predicado
   de RLS consume el resto, ejecutándose una vez por fila.
4. **`STABLE` no alcanza porque el problema es el inlining**, y `SECURITY
   DEFINER` más `SET search_path` lo impiden por diseño.
5. **La forma del arreglo funciona donde se aplica** —3.048 ms a 68 ms— **y no
   alcanza sola**: el camino real de la pantalla arrastra otras políticas con el
   mismo patrón.
6. **No se propone ningún índice**, ni para agregar ni para retirar, y la razón
   de no proponer retiros es una limitación del instrumento que queda registrada
   como tal.
