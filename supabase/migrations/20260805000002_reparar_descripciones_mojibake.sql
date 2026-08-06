-- ═══════════════════════════════════════════════════════════════════════════
-- Reparación de descripciones corrompidas por decodificación errónea del CSV
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CAUSA RAÍZ (auditoría 2026-08-05, src/pages/Importar.tsx:109):
--   El importador leía el CSV con `File.text()`, que decodifica SIEMPRE como
--   UTF-8. Los reportes de Glaciar vienen en Windows-1252/Latin-1, así que cada
--   byte no-ASCII (0xD1 = Ñ) se convirtió en el carácter de reemplazo U+FFFD
--   ('�', el rombo con signo de pregunta) y se INSERTÓ así en la base.
--   El fix del parser ya está aplicado en el frontend; esta migración repara
--   las filas que quedaron mal ANTES del fix.
--
-- ALCANCE: 6 filas de `productos` verificadas manualmente una por una. Todas
--   tienen exactamente 1 carácter U+FFFD y en las 6 el carácter original es
--   inequívocamente una Ñ (BAÑO, CASTAÑAS, SUEÑOS, BAÑO, BAÑADA, JALAPEÑO).
--   No se aplica un reemplazo ciego a toda la tabla: el UPDATE está acotado por
--   una lista explícita de descripciones para que no pueda tocar filas nuevas
--   cuyo carácter corrupto no sea una Ñ.
--
-- NO DESTRUCTIVO: solo corrige texto ya corrupto. No borra filas, no toca
--   cod_art, stock, venta media, familia ni ninguna columna del motor de riesgo.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- Snapshot de auditoría previo al cambio (queda como registro histórico).
create table if not exists public.productos_descripcion_backup_20260805 (
  producto_id     uuid primary key,
  descripcion_old text not null,
  reparado_at     timestamptz not null default now()
);

insert into public.productos_descripcion_backup_20260805 (producto_id, descripcion_old)
select id, descripcion
from public.productos
where descripcion like '%' || chr(65533) || '%'
on conflict (producto_id) do nothing;

-- Reparación acotada: solo filas con exactamente 1 U+FFFD donde el carácter
-- original es una Ñ. La condición de conteo evita tocar descripciones con
-- múltiples caracteres corruptos, que requerirían revisión manual.
update public.productos
set descripcion = replace(descripcion, chr(65533), 'Ñ'),
    updated_at  = now()
where descripcion like '%' || chr(65533) || '%'
  and length(descripcion) - length(replace(descripcion, chr(65533), '')) = 1
  and replace(descripcion, chr(65533), 'Ñ') in (
    'ALFAJOR C/BAÑO AZUCAR X 6',
    'CHOCOLATE C/LECHE CASTAÑAS Y CARAM',
    'CHOCOLATE TRES SUEÑOS',
    'GALLETITA RELLENA S/LIMON BAÑO CHOC',
    'OBLEA RELLENA BAÑADA CON CHOCOLATE',
    'PAPAS TUBO SABOR JALAPEÑO'
  );

-- Aviso si quedaron descripciones corruptas fuera del alcance de esta migración
-- (por ejemplo, importaciones hechas entre esta migración y el deploy del fix).
do $$
declare
  v_restantes int;
begin
  select count(*) into v_restantes
  from public.productos
  where descripcion like '%' || chr(65533) || '%';

  if v_restantes > 0 then
    raise warning 'Quedan % descripciones con caracteres corruptos que requieren revisión manual. Ver: select id, descripcion from productos where descripcion like ''%%''||chr(65533)||''%%'';', v_restantes;
  end if;
end $$;

commit;

-- Rollback manual, si hiciera falta:
--   update public.productos p
--   set descripcion = b.descripcion_old
--   from public.productos_descripcion_backup_20260805 b
--   where p.id = b.producto_id;
