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

## Esquema y SQL

- **`CREATE OR REPLACE VIEW` preserva los grants de la vista.** Recrear una vista no la re-expone, pero tampoco la limpia: los privilegios que ya tenia sobreviven intactos al reemplazo. Una vista que nace con grants de mas los arrastra en silencio a traves de cada `CREATE OR REPLACE` posterior, y nada en el diff de la migracion lo muestra.
- Por eso: al crear una vista, declarar sus grants explicitamente —`REVOKE` de lo que no va, `GRANT SELECT` de lo que si— en la misma migracion que la crea. No confiar en que un reemplazo posterior corrija un grant de mas.
- Toda vista expuesta a `authenticated` lleva `security_invoker = true`. Sin eso evalua RLS como su dueno y expone las filas de todas las organizaciones.
- **Lo unico que detecta un grant de mas sobre una vista es `clasificacion-exposicion-contract.test.mjs`.** Ni el gate de replay ni la revision del diff lo ven: el grant no aparece en el texto de ninguna migracion, es un hecho del catalogo que se hereda. Si se agrega una vista, va clasificada.

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
