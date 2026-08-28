import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260828000190_scanner_catalog_missing_only_v1.sql'),
  'utf8',
)

const codStart = migration.indexOf('CREATE OR REPLACE FUNCTION public.completar_cod_art_producto_scanner_invoker_v1')
const eanStart = migration.indexOf('CREATE OR REPLACE FUNCTION public.vincular_ean_producto_scanner_invoker_v1')
assert.ok(codStart >= 0 && eanStart > codStart, 'Deben endurecerse ambas RPC de enriquecimiento')

const cod = migration.slice(codStart, eanStart)
const ean = migration.slice(eanStart)

assert.match(cod, /SELECT p\.cod_art[\s\S]*?INTO v_cod_actual/, 'Cod.Art debe leer el valor actual antes de escribir')
assert.match(cod, /NULLIF\(btrim\(COALESCE\(v_cod_actual, ''\)\), ''\) IS NOT NULL/, 'Cod.Art existente debe bloquear reemplazo')
assert.match(cod, /puede_ver_producto_sucursal/, 'Cod.Art debe conservar el gate de alcance')
assert.match(cod, /AND NULLIF\(btrim\(COALESCE\(cod_art, ''\)\), ''\) IS NULL/, 'UPDATE Cod.Art debe ser condicional para evitar carreras')
assert.match(cod, /IF NOT FOUND THEN[\s\S]*?otra operación/, 'Cod.Art debe fallar cerrado si otra operación ganó la carrera')

assert.match(ean, /SELECT p\.codigo_barras[\s\S]*?INTO v_codigo_actual/, 'EAN debe leer el valor principal actual')
assert.match(ean, /NULLIF\(btrim\(COALESCE\(v_codigo_actual, ''\)\), ''\) IS NOT NULL/, 'EAN principal existente debe bloquear enriquecimiento')
assert.match(ean, /FROM public\.producto_codigos pc[\s\S]*?pc\.activo = true/, 'EAN debe bloquear si ya existe un código activo del producto')
assert.match(ean, /puede_ver_producto_sucursal/, 'EAN debe conservar el gate de alcance')
assert.match(ean, /AND NULLIF\(btrim\(COALESCE\(codigo_barras, ''\)\), ''\) IS NULL/, 'UPDATE EAN debe ser condicional para evitar carreras')
assert.doesNotMatch(ean, /^\s*ON CONFLICT\b/m, 'EAN no debe absorber una carrera de unicidad con una cláusula ON CONFLICT ejecutable')
assert.match(ean, /INSERT INTO public\.producto_codigos/, 'EAN debe seguir registrando la identidad normalizada')

console.log('✓ Scanner sólo completa Cod.Art/EAN faltantes y la UNIQUE aborta carreras de identidad')
