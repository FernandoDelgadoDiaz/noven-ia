import assert from 'node:assert/strict'
import fs from 'node:fs'

const parserSource = fs.readFileSync(new URL('../../src/lib/importar-0258.ts', import.meta.url), 'utf8')
const gatewaySource = fs.readFileSync(new URL('../../src/lib/importar-glaciar.ts', import.meta.url), 'utf8')

assert.match(parserSource, /split\('\|'\)/, '0258 debe parsearse como pipe-delimited')
assert.match(parserSource, /\^\\d\{7\}\$/, 'Cód.Art. debe preservarse como código de 7 dígitos')
assert.match(parserSource, /costo_unitario/, 'debe conservar Costo Unit.')
assert.match(parserSource, /costo_final/, 'debe conservar Costo Final sin inferir su semántica')
assert.match(parserSource, /per_ant_3/, 'debe conservar historia semanal')
assert.match(parserSource, /ultimo_periodo/, 'debe conservar último período')
assert.match(parserSource, /venta_media_diaria/, 'debe conservar Vta.Media')
assert.match(parserSource, /stock_transito/, 'debe conservar tránsito')
assert.match(parserSource, /\^stk\(\\d\{1,6\}\)\$/, 'debe derivar la sucursal desde el encabezado Stk NNN')
assert.match(parserSource, /dto_sec_fam/, 'debe preservar Dto-Sec-Fam como evidencia')
assert.match(parserSource, /codigoSector/, 'debe derivar un sector común cuando sea inequívoco')
assert.match(parserSource, /codigoFamilia/, 'debe derivar una familia común para la carga inicial')

assert.match(gatewaySource, /FuenteImportacionGlaciar = 'reposicion_asistida' \| '0258'/, 'la puerta de importación debe aceptar ambas fuentes durante la transición')
assert.match(gatewaySource, /El 0258 masivo debe corresponder a un único sector/, 'la carga masiva 0258 no debe mezclar sectores')
assert.match(gatewaySource, /Stk NNN/, 'la sucursal 0258 debe verificarse antes de escribir')

console.log('importar-0258 contract: ok')
