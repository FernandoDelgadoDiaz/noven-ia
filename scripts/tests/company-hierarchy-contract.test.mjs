import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const migrationPath = path.join(root, 'supabase/migrations/20260828000010_company_hierarchy_v1.sql')
const sql = fs.readFileSync(migrationPath, 'utf8')

const expectedRegions = ['NORTE', 'CENTRO', 'SUR', 'PAMPA_ANDINA', 'LIBERTAD']
const expectedZones = ['BA', 'CSF', 'LIT', 'NEI', 'RN', 'TRW', 'NEC', 'VIE', 'SCN', 'CR', 'SCS', 'TDF', 'LP', 'BAR', 'ESQ', 'LIBC', 'LIBN']

for (const region of expectedRegions) {
  assert.match(sql, new RegExp(`\\('${region}',`), `Falta la región ${region}`)
}
for (const zone of expectedZones) {
  assert.match(sql, new RegExp(`\\('${zone}',`), `Falta la zona ${zone}`)
}

const storeBlock = sql.match(/insert into public\.sucursales[\s\S]*?from public\.organizaciones o\njoin \(values([\s\S]*?)\) as v\(zona_codigo, sucursal_codigo\)/i)
assert.ok(storeBlock, 'No se encontró el bloque oficial zona → sucursal')

const pairs = [...storeBlock[1].matchAll(/\('([A-Z]+)',\s*'(\d{3})'\)/g)].map((m) => ({ zone: m[1], store: m[2] }))
assert.equal(pairs.length, 183, `Se esperaban 183 sucursales y hay ${pairs.length}`)

const stores = pairs.map((p) => p.store)
assert.equal(new Set(stores).size, 183, 'Hay códigos de sucursal repetidos entre zonas')

const byZone = new Map(expectedZones.map((z) => [z, []]))
for (const pair of pairs) byZone.get(pair.zone)?.push(pair.store)

assert.deepEqual(byZone.get('SCS'), ['033','043','072','091','124','131','138','161','183','198','199','200','204','205','360'])
assert.ok(byZone.get('CSF')?.includes('388'), 'La estructura vigente debe incluir sucursal 388 en Córdoba - Santa Fe')
assert.deepEqual(byZone.get('LIBC'), ['377','378','379','380','381','387'])
assert.deepEqual(byZone.get('LIBN'), ['382','383','384','385','386'])

assert.match(sql, /on conflict \(organizacion_id, codigo\)[\s\S]*?do update set\s+zona_id = excluded\.zona_id,\s+activa = true;/i, 'El upsert no debe reemplazar nombre/dirección de sucursales existentes')
assert.match(sql, /v_regiones <> 5/)
assert.match(sql, /v_zonas <> 17/)
assert.match(sql, /v_sucursales <> 183/)

console.log('Jerarquía corporativa: 5 regiones · 17 zonas · 183 sucursales — OK')
