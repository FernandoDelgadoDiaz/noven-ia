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

## Análisis gerencial limitado a roles de conducción — 2026-09-02

**Decisión:** `netlify/functions/analisis.ts` sólo se concede a `gerente_zonal` de la zona de la sucursal, y a `gerente_sucursal` o `supervisor` de esa sucursal exacta. El rol `operador` deja de generar análisis. `admin_organizacion` sigue sin habilitar por sí solo.

**Motivo:** el análisis es una capacidad de conducción, no de operación: compara el trimestre en curso contra la ventana equivalente previa y prioriza dónde interviene la gestión. El operador trabaja sobre su propia bandeja de familias, donde el Dashboard y Vencimientos ya le dan lo que necesita para actuar.

Como efecto secundario deseado, reduce la población que puede disparar costo en el proveedor de inferencia y enviarle datos operativos. No lo reemplaza: sigue haciendo falta el límite por actor del ítem C2/C3, porque una sola cuenta de conducción alcanza para consumir sin techo.

**Consecuencia:** desaparece el ámbito parcial por familias dentro del análisis. Con un único ámbito posible —toda la sucursal— se eliminan el filtrado por `usuario_familias_sucursal`, la variante `SYSTEM_OPERADOR` del prompt y la bifurcación `scopeCompleto`. Queda un solo system prompt, lo que además simplifica la evaluación de guardarraíles del ítem 1.5.

**Condición de salida:** si en el futuro un perfil operativo necesita análisis de su propio ámbito, no reintroducir la bifurcación dentro de este endpoint. Debe ser una capacidad separada, con su propio prompt y su propio alcance declarado.

## Expectativa móvil del replay y pérdida diferida del ancla — 2026-09-02

**Decisión:** el gate de replay pasa de comparar contra una foto estática del catálogo productivo a comparar contra una expectativa móvil, atada por hash al conjunto exacto de migraciones posteriores al cutoff. `expected-fingerprint.json` se conserva como ancla de producción y sólo se re-materializa de forma explícita y periódica.

**Motivo:** el gate anterior sólo podía estar verde con el schema congelado. El replay aplica baseline más migraciones posteriores, pero comparaba contra una foto que sólo contenía el baseline; la primera migración nueva —cualquiera— lo rompía por diseño, no por deriva.

La alternativa obvia, regenerar el ancla desde la base replicada, era peor que el problema: la convertía en «lo que produjo el replay» en vez de «lo que hay en producción», dejando el gate verde y sin capacidad de detectar deriva.

**Qué se cede:** el gate deja de responder, en cada corrida, si el repositorio reconstruye lo que hay en producción. Pasa a verificar reproducibilidad y cambio declarado. El ancla se mantiene viva únicamente por la re-materialización periódica.

**Cuándo se cede, que es lo que hace aceptable el intercambio:** hoy no se cede nada. Con cero migraciones posteriores al cutoff el verificador exige que la expectativa móvil sea idéntica al ancla, así que el gate sigue respondiendo la pregunta completa. La pérdida se materializa recién con la primera migración —la del contador de cuota y caché de `analisis.ts`— y llega en el mismo momento en que se cobra el beneficio: la protección de un endpoint que hoy permite costo ilimitado en un tercero y salida de datos operativos sin techo.

No es «aceptamos perder el ancla», es «la perdemos cuando ganamos otra cosa a cambio», y ambas cosas ocurren en el mismo PR y quedan visibles en el mismo diff.

**Condición de salida:** scriptar la extracción de los fragmentos desde el catálogo productivo. Hoy es el único paso manual del procedimiento y es justamente el que sostiene el ancla: cuanto más caro es el camino legítimo, más tentador es mover la fecha del tripwire y seguir. Debería resolverse antes de la primera re-materialización real.
