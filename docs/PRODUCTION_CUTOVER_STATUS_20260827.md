# NOVEN · ESTADO DE CUTOVER PRODUCTIVO · 2026-08-27

## Estado actual

La arquitectura multitenant validada fue mergeada a `master` y la **Fase A** de base de datos fue aplicada en Supabase producción hasta `20260827000260_operational_private_writers_v1` inclusive.

La **Fase C NO está aplicada**. No ejecutar todavía:

1. `20260827000270_rls_cutover_v1.sql`
2. `20260827000275_rls_grants_hardening_v1.sql`
3. `20260827000280_advisor_hardening_v1.sql`

El motivo es exclusivamente el gate de frontend/hosting: el sitio `https://noven-ia.netlify.app` continúa sirviendo un build anterior y no recibe los pushes actuales del repositorio.

## Checkpoint de producción

Última verificación antes del cutover final:

- productos: 659
- estados `producto_sucursal` para 091: 659
- vencimientos históricos: 122
- acciones históricas: 15
- importaciones nuevas: 0
- pendientes globales: 0
- observaciones nuevas: 0
- intervenciones RAG nuevas: 0

Las migraciones de Fase A no inventaron actividad operativa.

## Diagnóstico Netlify

Se probó despliegue desde `master` y desde una rama `main` espejo.

En ambos casos el smoke test falló porque `https://noven-ia.netlify.app/deploy-marker.txt` no publicó el marcador del commit nuevo y devolvió la SPA existente por el redirect catch-all.

El sitio responde HTTP 200 y sigue sirviendo estos assets del build anterior:

- `/assets/index-CSHDhrnD.js`
- `/assets/index-nMJ8265m.css`

El site ID observado en headers es:

`1e8b0a22-0e86-4d43-8d38-58740f2b8a7a`

La API de Netlify para ese sitio responde `401 Access Denied` sin autenticación.

El repositorio GitHub no tiene configurado `NETLIFY_AUTH_TOKEN`, por lo que GitHub Actions no puede forzar el deploy por API.

## Acción necesaria en Netlify

Dentro de la cuenta propietaria del sitio `noven-ia`:

1. Abrir el sitio `noven-ia`.
2. Ir a la configuración de **Build & deploy / Continuous deployment**.
3. Confirmar o reconectar el repositorio `FernandoDelgadoDiaz/noven-ia`.
4. Usar rama de producción `master`.
5. Build command: `npm run build`.
6. Publish directory: `dist`.
7. Las Functions siguen definidas por `netlify.toml` en `netlify/functions`.
8. Disparar un deploy del HEAD actual de `master`.

No pegar tokens o secretos en GitHub, issues, chats o archivos del repositorio.

## Gate para continuar

Sólo después de comprobar que el build nuevo está efectivamente publicado:

1. smoke test de login / Dashboard / Scanner / cierre vendido / Importar / Historial / Admin;
2. aplicar `00270`;
3. aplicar `00275`;
4. aplicar `00280`;
5. ejecutar advisors Supabase nuevamente;
6. smoke test final con RLS cerrado.

## Nota Supabase

Los advisors antes del cutover muestran warnings esperables de policies legacy duplicadas/permisivas que Fase C elimina. También muestran advertencias de tablas/funciones `desafio5s_*`, que pertenecen a otro sistema y no deben modificarse como parte del cutover Noven.
