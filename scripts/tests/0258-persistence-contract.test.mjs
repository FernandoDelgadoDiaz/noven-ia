import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = fs.readFileSync(new URL('../../supabase/migrations/20260829220000_glaciar_0258_persistencia_v1.sql', import.meta.url), 'utf8')
const familia = fs.readFileSync(new URL('../../netlify/functions/importar-familia.ts', import.meta.url), 'utf8')
const masiva = fs.readFileSync(new URL('../../netlify/functions/importar-asistido-completo.ts', import.meta.url), 'utf8')

assert.match(migration, /glaciar_0258/, 'la importación debe distinguir 0258 de Reposición Asistida')
assert.match(migration, /importacion_0258_detalle/, 'debe persistir el detalle crudo por importación')
assert.match(migration, /producto_costo_observaciones/, 'debe conservar historial global de costos observados')
assert.match(migration, /producto_costo_ultima_observacion/, 'debe conservar la última observación global con procedencia')
assert.match(migration, /per_ant_3/, 'debe conservar los períodos semanales')
assert.match(migration, /stock_transito/, 'debe conservar stock en tránsito')
assert.match(migration, /REVOKE ALL ON FUNCTION public\.aplicar_importacion_0258_familia_v1[^;]+authenticated/s, 'el RPC 0258 de familia no debe ampliar la superficie browser')
assert.match(migration, /REVOKE ALL ON FUNCTION public\.aplicar_importacion_0258_masiva_v1[^;]+authenticated/s, 'el RPC 0258 masivo no debe ampliar la superficie browser')

assert.match(familia, /parsear0258/, 'la carga por familia debe enviar el detalle 0258')
assert.match(familia, /aplicar_importacion_0258_familia_v1/, 'la carga por familia debe usar el wrapper atómico 0258')
assert.match(masiva, /parsear0258/, 'la carga masiva debe enviar el detalle 0258')
assert.match(masiva, /aplicar_importacion_0258_masiva_v1/, 'la carga masiva debe usar el wrapper atómico 0258')

console.log('0258 persistence contract: ok')
