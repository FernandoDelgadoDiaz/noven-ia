# Decisiones tecnicas

## Vite vs Next.js
**Decision:** Vite + React SPA
**Razon:** App mobile-first tipo PWA, no necesita SSR. Vite es mas rapido para desarrollo y el deploy en Netlify es trivial con SPA redirect.

## cod_art vs codigo_barras
**Decision:** Usar `cod_art` como identificador primario del producto
**Razon:** El codigo de barras puede no estar disponible para todos los productos. El `cod_art` es el identificador interno del negocio y siempre existe. El scanner usa codigo de barras como lookup secundario.

## Administración jerárquica transitoria desde Sucursal 091 — 2026-08-31

**Decisión:** La capacidad de administración jerárquica de la organización se concede transitoriamente únicamente a una cuenta que combine `admin_organizacion` con `gerente_sucursal` activo de la sucursal código `091`.

**Motivo:** La Sucursal 091 es el entorno productivo actual y esta combinación permite administrar la jerarquía sin convertir `admin_organizacion` en un superusuario operativo ni ampliar el alcance de lectura/escritura fuera de los roles propios de la cuenta.

**Condición de salida:** Antes de incorporar una organización que requiera un administrador jerárquico distinto de un gerente de sucursal `091`, o antes de delegar la administración jerárquica a otra cuenta, reemplazar el literal de sucursal por una capacidad explícita a nivel organización. La capacidad jerárquica no deberá ampliar el alcance operativo del usuario.

## Desafío 5S archivado en frío dentro del proyecto Supabase de NoVen — 2026-09-01

**Decisión:** Mientras no se justifique el costo de un proyecto Supabase independiente para Desafío 5S, sus objetos y datos se conservan íntegramente dentro del mismo proyecto físico que NoVen, pero fuera de la superficie operativa: schema privado `desafio5s_archive`, bucket `desafio5s-imagenes` privado y sin acceso de `PUBLIC`, `anon`, `authenticated` ni `service_role` al schema archivado.

**Motivo:** Desafío 5S estaba activo sobre el mismo Supabase y varias RPC `desafio5s_*` eran ejecutables por `anon`. Revocar esos permisos sin más rompía un flujo real. Crear ahora otro proyecto agrega un costo mensual que no se justifica mientras 5S permanece inactivo. El archivo en frío elimina la superficie pública de 5S en NoVen sin perder las 7 tablas, 18 funciones, 2 vistas, datos históricos ni archivos de Storage, y su restauración fue verificada mediante un round-trip transaccional.

**Dependencia conocida:** `desafio5s_es_admin()` depende de `public.rol_actual()` y, por esa vía, de `public.usuarios` de NoVen. Esa dependencia se conserva únicamente para permitir una restauración futura en el proyecto actual; no debe trasladarse a un proyecto 5S independiente.

**Condición de salida:** Antes de reactivar Desafío 5S para uso real, crear su proyecto Supabase independiente cuando el costo sea aceptado, restaurar allí estructura/datos/Storage, reemplazar `public.rol_actual()` por autorización propia de 5S, validar el flujo participante y administrador, y recién después retirar el archivo frío del proyecto de NoVen.
