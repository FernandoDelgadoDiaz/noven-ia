# Reglas de codigo

## Estados: dos situaciones distintas no pueden producir el mismo valor

Este patron aparecio tres veces en dos dias —D-7, D-8 y el escalon cero del
item de intervenciones— y las tres veces costo lo mismo: nadie se entero.

**Cuando un fallo, o un caso raro, produce el mismo valor que una ausencia
legitima, hay que separarlos ANTES de que alguien los promedie juntos.**

Los tres casos que ya pasaron, para reconocer la forma:

- `instrumentar_sugerencia_rag` fallaba con `permission denied` y las columnas
  quedaban en `NULL`. Ese mismo `NULL` es el de una intervencion que
  legitimamente no fue instrumentada. "No pude escribir" y "no habia nada que
  escribir" quedaron indistinguibles (D-7).
- `useEscalaRag` hace `setEscala([])` cuando la lectura falla. Escala vacia
  significa "esta organizacion no tiene escala configurada", asi que un fallo de
  red se disfraza de configuracion ausente y la tarjeta se ve identica (D-8).
- Un descuento fuera de la escala deja `escalones_aplicados` en `NULL`, el mismo
  valor que una intervencion que nunca se midio.

**La regla.** Antes de devolver un valor neutro —`NULL`, `[]`, `0`, `false`—
preguntarse que otras situaciones producen ese mismo valor. Si alguna de ellas
es un fallo y la otra es normal, el valor neutro esta escondiendo informacion y
hace falta un estado propio.

**No alcanza con loguear mejor.** Un `console.error` deja registro para quien
mire la consola; no cambia lo que el motor calcula ni lo que la pantalla
muestra. La correccion es que el estado sea distinto, no que el error se
reporte mejor.

**No inventar un valor para tapar el hueco.** Interpolar, redondear al vecino
mas cercano o asumir un default convierte "no se" en un numero que despues nadie
puede distinguir de una medicion real. Estado propio y exclusion explicita del
agregado, con el motivo a la vista.

## Esquema y SQL

- **`CREATE OR REPLACE` CONSERVA EL ACL del objeto, tanto en vistas como en funciones.** Reemplazar la definicion no toca los grants: los privilegios que tenia antes los sigue teniendo despues. Verificado por fingerprint estructural en los dos casos, no leido de la documentacion — una vista reemplazada en el item 2.5 y `instrumentar_sugerencia_rag_impl` reemplazada en el item del escalon cero, ambas con **cero entradas de ACL** en el diff.

  **PERO NO CONSERVA LAS RELOPTIONS.** `security_invoker` de una vista se PIERDE al reemplazarla y vuelve al default, y una vista sin el evalua RLS como su DUENIO: cualquier usuario autenticado veria las filas de todas las organizaciones. Toda migracion que haga `CREATE OR REPLACE VIEW` tiene que volver a poner `ALTER VIEW ... SET (security_invoker = true)` a continuacion. Verificado en el bloque B, donde el verificador de exposicion lo cazo antes de llegar a produccion.

  Lo que sobrevive es el ACL; la configuracion no. Que las dos cosas suenen a "propiedades del objeto" es justo lo que hace facil el error.

  Se sigue de ahi que reemplazar una funcion NO repara un grant equivocado ni rompe uno correcto: si el permiso estaba mal, sigue mal despues del reemplazo, y hace falta un `GRANT` explicito —eso fue #162—. Repetir el `REVOKE`/`GRANT` junto al reemplazo es un no-op deliberado que deja el patron a la vista; lo que nunca hay que asumir es que el reemplazo por si solo arregle o rompa permisos.

- **El diff estructural se compara POR CLAVE, nunca por conteo de valores.** El aplanado del fingerprint cuenta valores sin asociarlos a su objeto, asi que dos cambios opuestos se cancelan y el diff miente. Paso dos veces, y las dos la primera lectura era falsa:

  - La reparacion del grant de instrumentacion parecia cambiar **182 cosas**. Comparada como conjunto era **una sola** entrada nueva: un EXECUTE agregado. Una entrada nueva en un array ordenado corre de posicion a todas las de abajo, y el diff por indice reporta cada corrimiento como un cambio.
  - El bloque del tramo mostraba `AGREGA columns.not_null = False` sin ningun `SACA` de `True`, lo que leido de apuro decia que la columna `tipo` habia quedado nullable — habria sido un defecto real. Era artefacto: `tipo` SUMA un `not_null=True` y `porcentaje_descuento` PIERDE uno, asi que el conteo de `True` no se mueve. Verificado por nombre, `tipo` es `NOT NULL DEFAULT 'rag'`.

  Un ejemplo se lee como anecdota; dos se leen como forma. Indexar por `(schema, tabla, nombre)` —o `(schema, nombre)` para vistas y funciones— y comparar objeto contra objeto. El conteo sirve para el titular; nunca para el veredicto.

- **Y leer lo que el diff dice, no solo lo que se fue a buscar.** La vista `v_intervencion_tramos` aparecio en su diff con dieciseis entradas de ACL —ocho privilegios por dos roles, incluidos INSERT, UPDATE, DELETE y TRUNCATE— para una vista declarada de solo lectura. Estaban a la vista y no se leyeron, porque lo que se estaba buscando en ese diff era otra cosa. Lo cazo despues el verificador de exposicion contra la base real.

- **Un `GRANT` es un hecho del catalogo, no del texto de las migraciones.** Los permisos son ACUMULATIVOS: una migracion posterior puede devolver lo que otra revoco. Leer un archivo suelto para concluir que un permiso esta puesto es adivinar; hay que mirar el estado final, en el catalogo o reconstruido en orden sobre todas las migraciones.

- **Un wrapper `public.*` `SECURITY INVOKER` corre con los privilegios de QUIEN LLAMA**, asi que `authenticated` necesita `EXECUTE` sobre la implementacion `noven_private.*_impl`. Revocarselo —que parece mas seguro y se escribe solo— deja la RPC concedida y a la vez inutilizable: falla recien en runtime con `permission denied`. El aislamiento no lo da ese `REVOKE` sino que `noven_private` no este entre los esquemas expuestos por PostgREST.

## TypeScript

- Strict activo (`tsconfig.app.json`): no `any`, no type assertions sin justificacion.
- `noUnusedLocals`, `noUnusedParameters` y `noFallthroughCasesInSwitch` estan activos: el build falla, no avisa.
- Imports con el alias `@/` (por ejemplo `@/lib/riesgo`), nunca relativos con `../../../`.

## Seguridad

- **RLS es la autoridad.** Nunca bypassear Row Level Security. React puede ocultar por UX, jamas es la barrera.
- **El browser no escribe sobre tablas de negocio.** Nada de `supabase.from(...).insert()`, `.update()`, `.upsert()` ni `.delete()` desde `src/`. Toda escritura operativa pasa por una RPC `SECURITY DEFINER` o por una funcion Netlify que valida alcance server-side.
- El alcance se verifica siempre contra `usuario_accesos` en el servidor. El cliente no envia ni decide rol, sucursal ni familias.
- No hardcodear keys, URLs ni secrets: usar variables de entorno. Los secretos de servidor no llevan prefijo `VITE_`.

## Dominio

- La politica de donacion viene de `sectores.dias_donacion`. No inferirla en el cliente ni hardcodear un valor global.
- Las fechas y trimestres operativos se calculan en `America/Argentina/Buenos_Aires`, no en UTC ni en la zona del navegador.
- El riesgo se evalua sobre la cantidad comprometida con una fecha de vencimiento, no sobre el stock total del reporte.

## UI

- Mobile-first: disenar para 375px, luego escalar.
- Componentes: functional components con hooks.
- Naming: camelCase para variables y funciones, PascalCase para componentes y types.
- Manejo de errores: siempre manejar estados loading, error y empty.
- Los colores de nivel de riesgo salen de `src/lib/risk-config.ts`. No definirlos en otro lugar.

## Tests

- Cada invariante que no debe volver atras se protege con un contrato en `scripts/tests/*.test.mjs`.
- Los tests no dependen de la fecha real: si el caso involucra ventanas de riesgo, fijar el reloj.

- **Un contrato que no se verifico por mutacion no protege nada todavia.** Romper a proposito lo que el contrato dice cuidar, y confirmar que falla, es la unica prueba de que la asercion mira donde dice mirar. Escribir la asercion es la mitad del trabajo.

- **Antes de concluir que un contrato NO caza una mutacion, verificar que la mutacion ENTRO.** Un mutante que no se aplica —un `sed` con un espacio donde el archivo tiene varios, un patron que no matchea— se lee EXACTAMENTE IGUAL que un contrato que no protege, y la conclusion natural es la equivocada: se debilita o se reescribe una asercion que estaba bien. Hacer que la mutacion falle ruidosamente si no reemplaza nada (contar los reemplazos y abortar en cero) en vez de confiar en que entro.

  Del mismo tipo: cuando un mutante SI es cazado, mirar QUE asercion lo cazo. Si fue otra distinta de la que lo apuntaba, la asercion apuntada sigue sin probarse y hay que rehacer el mutante hasta que dispare sola.

- **La asercion de AUSENCIA se hace sobre el cuerpo, no sobre el archivo entero.** Las cabeceras citan a proposito el defecto que se esta corrigiendo, y una busqueda ingenua confunde la cita con el defecto vivo. Distinguir "tocar" de "mencionar": prohibir el DDL contra un objeto, no que su nombre aparezca.

- **Un contrato de texto no puede verificar un hecho del catalogo.** "No hay ningun GRANT de escritura en la migracion" puede ser cierto y el privilegio estar puesto igual, porque lo dan los defaults del schema. Para esa clase de invariante el contrato de texto llega antes, y el verificador contra la base decide.

## Politicas RLS y costo por fila

Medido en el item 3.3 (`docs/BENCHMARK_VOLUMEN_V1.md`). Leer esto ANTES de
escribir una politica nueva.

- **Una politica cuyo predicado llama a una funcion con argumentos DE LA FILA se ejecuta UNA VEZ POR FILA.** Sobre 4.883 filas visibles, el indice resolvio en 0,066 ms y el predicado consumio 3.045 ms. El cuello no era el acceso a datos: era el predicado.
- **`STABLE` no lo evita.** Garantiza el mismo resultado con LOS MISMOS argumentos dentro de una sentencia; no memoiza entre valores distintos. Si el argumento es una columna de la fila, cambia siempre y no hay nada que reusar.
- **Lo que haria falta es inlining, y `SECURITY DEFINER` con `SET search_path` lo impide por diseno.** Postgres solo funde una funcion SQL en la consulta si no es `SECURITY DEFINER` y no tiene clausula `SET`. Es una tension estructural, no un bug: lo que hace segura a la funcion es lo que impide optimizarla. La salida NO es sacar `SECURITY DEFINER`.
- Por eso, al escribir una politica: preferir la forma **"cual es mi alcance", evaluada una vez** —una funcion SIN argumentos de fila, que dependa solo de `auth.uid()`, mas una prueba de pertenencia— antes que **"es visible esta fila"**, evaluada por fila. La primera se materializa una vez; la segunda escala con el numero de filas.
- **No perseguir esto con indices.** Ningun indice sobre la tabla arregla un predicado que corre una vez por fila. Agregar uno aca trata el sintoma.
- Un efecto secundario que confunde al diagnosticar: los indices que usa el CUERPO de una funcion `SECURITY DEFINER` no aparecen en el `EXPLAIN` de la consulta externa. Van a mostrar contador alto y cero presencia en los planes sin que falte ningun camino por medir.
