# Desafío 5S · Archivo en frío reversible

**Estado:** preparado para retirar 5S de la superficie pública de NoVen sin perder sus datos.  
**Proyecto Supabase actual:** `meqvjabgyrgwkxpclqxp`  
**Motivo:** 5S comparte temporalmente el proyecto de NoVen, pero no debe permanecer expuesto dentro de su superficie operativa ni justificar un segundo proyecto pago mientras esté inactivo.

## 1. Inventario preservado

Snapshot verificado antes del archivo:

- 7 tablas `desafio5s_*`;
- 18 funciones `desafio5s_*`;
- 2 vistas de ranking;
- bucket Storage `desafio5s-imagenes`;
- 44 evaluaciones;
- 399 respuestas;
- 660 asignaciones evaluación-pregunta;
- 65 preguntas;
- 4 participantes;
- 1 registro de `desafio5s_asset_chunks`;
- 35 archivos en Storage.

Los datos operativos y personales permanecen únicamente en Supabase. **No se versionan datos personales, legajos, hashes de documento, access tokens ni respuestas de participantes en Git.**

## 2. Qué hace el archivo en frío

La migración `20260901103500_desafio5s_cold_archive_v1.sql`:

1. valida el inventario exacto de objetos 5S antes de actuar;
2. crea el schema privado `desafio5s_archive`;
3. mueve allí las 7 tablas, las 2 vistas y las 18 funciones;
4. conserva índices, constraints, tipos de fila, ACL y relaciones existentes;
5. vuelve privado el bucket `desafio5s-imagenes` sin eliminar archivos;
6. limita las tres policies Storage de 5S a `service_role` mientras el módulo está archivado;
7. revoca acceso al schema de archivo para `PUBLIC`, `anon`, `authenticated` y `service_role`;
8. compara conteos antes/después dentro de la misma migración y aborta si cambia alguna fila u objeto de Storage;
9. verifica que no quede ningún objeto `desafio5s_*` en `public`.

No se modifica ninguna tabla de negocio de NoVen.

## 3. Dependencia externa conocida

El módulo 5S no es totalmente autónomo respecto de NoVen en su estado actual.

`desafio5s_es_admin()` usa `auth.uid()` y también consulta `public.rol_actual()`. Esa función, a su vez, obtiene el rol desde `public.usuarios`, que pertenece a NoVen.

Esto no afecta el archivo en frío ni una restauración temporal dentro del mismo proyecto. Antes de levantar 5S en un **proyecto Supabase independiente**, esa dependencia debe reemplazarse por un mecanismo de administración propio de 5S.

No se implementa ahora una autenticación temporal porque sería trabajo descartable antes de la separación definitiva.

## 4. Restauración en el mismo proyecto

La restauración debe ejecutarse mediante una migración nueva o una operación de mantenimiento explícitamente aprobada. No se debe modificar la migración histórica de archivo.

Secuencia lógica:

```sql
-- 1. Mover las tablas archivadas nuevamente a public.
alter table desafio5s_archive.desafio5s_admins set schema public;
alter table desafio5s_archive.desafio5s_asset_chunks set schema public;
alter table desafio5s_archive.desafio5s_evaluacion_preguntas set schema public;
alter table desafio5s_archive.desafio5s_evaluaciones set schema public;
alter table desafio5s_archive.desafio5s_participantes set schema public;
alter table desafio5s_archive.desafio5s_preguntas set schema public;
alter table desafio5s_archive.desafio5s_respuestas set schema public;

-- 2. Mover las vistas nuevamente a public.
alter view desafio5s_archive.desafio5s_ranking_individual set schema public;
alter view desafio5s_archive.desafio5s_ranking_sectores set schema public;

-- 3. Mover todas las funciones desafio5s_* nuevamente a public.
-- Usar pg_get_function_identity_arguments para conservar exactamente sus firmas.

-- 4. Restaurar exposición del bucket si se decide reactivar la app.
update storage.buckets
set public = true
where id = 'desafio5s-imagenes';

-- 5. Restaurar roles de las policies Storage.
alter policy desafio5s_public_read
  on storage.objects to anon, authenticated;

alter policy desafio5s_admin_upload
  on storage.objects to authenticated;

alter policy desafio5s_admin_update
  on storage.objects to authenticated;
```

Después de restaurar:

- comprobar 7 tablas, 18 funciones y 2 vistas en `public`;
- comparar todos los conteos contra el snapshot previo;
- comprobar que el bucket conserva los 35 objetos originales;
- ejecutar smoke del flujo participante y del panel administrador;
- verificar que la app use la URL/anon key del proyecto esperado.

## 5. Restauración futura en un proyecto Supabase independiente

Cuando se decida volver a activar Desafío 5S en infraestructura propia:

1. crear el nuevo proyecto únicamente cuando se acepte su costo;
2. exportar desde `desafio5s_archive` estructura y datos de las siete tablas;
3. recrear las 18 funciones y las dos vistas;
4. copiar los objetos del bucket `desafio5s-imagenes` preservando sus paths;
5. recrear la configuración del bucket: límite 8 MiB y MIME permitidos `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`;
6. reemplazar la dependencia `public.rol_actual()` por autorización propia de 5S;
7. recrear las policies Storage dentro del nuevo proyecto;
8. apuntar `valeria-seguridad-alimentaria` al nuevo Supabase;
9. probar flujo participante, resultado, revisión, ranking y administración antes de publicar.

Mientras el proyecto independiente no exista, `desafio5s_archive` es la copia viva y restaurable dentro del proyecto actual. NoVen no debe consultar ni depender de ese schema.

## 6. Criterio de integridad

El archivo se considera válido únicamente si se cumplen simultáneamente:

- cero objetos `desafio5s_*` en `public`;
- 7 tablas, 18 funciones y 2 vistas dentro de `desafio5s_archive`;
- mismos conteos de filas antes y después del movimiento;
- mismo conteo de objetos del bucket;
- bucket no público;
- `anon` y `authenticated` sin acceso al schema de archivo;
- ninguna tabla, función, policy o RPC de NoVen modificada.

La aplicación 5S queda deliberadamente inactiva mientras permanezca archivada.