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
