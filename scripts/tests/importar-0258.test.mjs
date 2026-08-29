import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../../src/lib/importar-0258.ts', import.meta.url), 'utf8')

assert.match(source, /split\('\|'\)/, '0258 debe parsearse como pipe-delimited')
assert.match(source, /\^\\d\{7\}\$/, 'Cód.Art. debe preservarse como código de 7 dígitos')
assert.match(source, /costo_unitario/, 'debe conservar Costo Unit.')
assert.match(source, /costo_final/, 'debe conservar Costo Final sin inferir su semántica')
assert.match(source, /per_ant_3/, 'debe conservar historia semanal')
assert.match(source, /ultimo_periodo/, 'debe conservar último período')
assert.match(source, /venta_media_diaria/, 'debe conservar Vta.Media')
assert.match(source, /stock_transito/, 'debe conservar tránsito')
assert.match(source, /codigoSector/, 'debe conservar metadata de sector')
assert.match(source, /codigoFamilia/, 'debe soportar la carga inicial por familia')

console.log('importar-0258 contract: ok')
