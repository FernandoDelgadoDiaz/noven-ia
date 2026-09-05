# Reglas de codigo

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

## Politicas RLS y costo por fila

Medido en el item 3.3 (`docs/BENCHMARK_VOLUMEN_V1.md`). Leer esto ANTES de
escribir una politica nueva.

- **Una politica cuyo predicado llama a una funcion con argumentos DE LA FILA se ejecuta UNA VEZ POR FILA.** Sobre 4.883 filas visibles, el indice resolvio en 0,066 ms y el predicado consumio 3.045 ms. El cuello no era el acceso a datos: era el predicado.
- **`STABLE` no lo evita.** Garantiza el mismo resultado con LOS MISMOS argumentos dentro de una sentencia; no memoiza entre valores distintos. Si el argumento es una columna de la fila, cambia siempre y no hay nada que reusar.
- **Lo que haria falta es inlining, y `SECURITY DEFINER` con `SET search_path` lo impide por diseno.** Postgres solo funde una funcion SQL en la consulta si no es `SECURITY DEFINER` y no tiene clausula `SET`. Es una tension estructural, no un bug: lo que hace segura a la funcion es lo que impide optimizarla. La salida NO es sacar `SECURITY DEFINER`.
- Por eso, al escribir una politica: preferir la forma **"cual es mi alcance", evaluada una vez** —una funcion SIN argumentos de fila, que dependa solo de `auth.uid()`, mas una prueba de pertenencia— antes que **"es visible esta fila"**, evaluada por fila. La primera se materializa una vez; la segunda escala con el numero de filas.
- **No perseguir esto con indices.** Ningun indice sobre la tabla arregla un predicado que corre una vez por fila. Agregar uno aca trata el sintoma.
- Un efecto secundario que confunde al diagnosticar: los indices que usa el CUERPO de una funcion `SECURITY DEFINER` no aparecen en el `EXPLAIN` de la consulta externa. Van a mostrar contador alto y cero presencia en los planes sin que falte ningun camino por medir.
