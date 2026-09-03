# NOVEN · Archivo frío de respaldos de agosto

**Corte del inventario:** 2026-09-03.

**Proyecto:** `meqvjabgyrgwkxpclqxp`.
**Migración:** `20260903103749_archive_august_backups_v1.sql`.

## Decisión

Los tres respaldos históricos de agosto se conservan íntegramente, pero salen
de `public` y pasan al schema privado `noven_archive`:

| Relación | Filas | Tamaño total al corte |
|---|---:|---:|
| `dedup_turrocklets_backup_20260805` | 19 | 65.536 bytes |
| `productos_descripcion_backup_20260805` | 6 | 32.768 bytes |
| `productos_familia_backup_20260806` | 88 | 24.576 bytes |

Son 113 filas preservadas. No son tablas operativas ni forman parte de la
baseline core. Mantenerlas en `public` agrandaba la superficie visible y hacía
que un inventario físico de 36 tablas pareciera contradecir el inventario core
actual de 33.

## Evidencia previa

La revisión de catálogo productivo confirmó:

- cero foreign keys hacia o desde los respaldos;
- cero vistas, funciones o triggers dependientes;
- cero membresías en publicaciones;
- cero referencias desde el código activo de la aplicación;
- RLS habilitado en las tres tablas;
- sólo `service_role` conserva privilegios de relación;
- dos policies históricas de lectura administrativa, sin grants directos a
  `authenticated`, sobre los respaldos de deduplicación y descripción.

La migración vuelve a verificar ese inventario dentro de su propia transacción.
Si falta una tabla, aparece una dependencia o cambia la superficie de permisos,
aborta sin realizar un archivo parcial.

## Estado de acceso archivado

`noven_archive` no concede `USAGE` a `PUBLIC`, `anon`, `authenticated` ni
`service_role`. Las relaciones tampoco conservan privilegios para esos roles.
Las policies y RLS se preservan como evidencia histórica y para facilitar una
restauración controlada, pero quedan inaccesibles desde la aplicación.

El owner `postgres` conserva la capacidad de recuperación. No se versionan las
filas ni se copian datos comerciales a Git.

## Replay y fingerprint

Una base nueva no contiene estos respaldos porque están excluidos de la
baseline. En ese escenario la migración crea el schema privado vacío y sigue
sin fabricar datos. `noven_archive` está fuera de los schemas comparados por el
fingerprint core.

## Restauración controlada

Una restauración futura exige una migración nueva y una revisión de permisos;
no se modifica esta migración. El ensayo mínimo debe ejecutarse primero en una
transacción reversible:

```sql
begin;

alter table noven_archive.dedup_turrocklets_backup_20260805 set schema public;
alter table noven_archive.productos_descripcion_backup_20260805 set schema public;
alter table noven_archive.productos_familia_backup_20260806 set schema public;

-- Verificar conteos, RLS, policies y grants antes de cualquier restauración real.
rollback;
```

La restauración real sólo corresponde si existe una necesidad operativa
concreta y después de reconstruir el acceso mínimo requerido.
