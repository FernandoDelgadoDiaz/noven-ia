import { cargar, eq, seccion, resumen } from './_helpers.mjs'

const m = await cargar('src/lib/glaciar-metadata.ts')
const T = '\t'

seccion('Reporte real: Cod.Suc.Padrón es la fuente principal')
const real = [
  'Parámetros del Listado de Pedido de Reposición Asistida',
  ['', '', 'Cod.Suc.Padrón:', '091'].join(T),
  ['Cód.Familia:', '003'].join(T),
  '04/08/2026 - 19:24:40',
  'S.A. IMP. Y EXP. DE LA PATAGONIA - Sucursal: 999',
].join('\r\n')
const r1 = m.extraerMetadataGlaciar(real)
eq('sucursal estructurada gana al fallback', r1.codigoSucursal, '091')
eq('familia', r1.codigoFamilia, '003')
eq('fecha/hora textual', r1.fechaReporteTexto, '04/08/2026 - 19:24:40')

seccion('Variante sin tilde y código corto')
const variante = [
  ['Cod.Suc.Padron:', '7'].join(T),
  ['Cod.Familia:', '014'].join(T),
].join('\n')
const r2 = m.extraerMetadataGlaciar(variante)
eq('sucursal normalizada a tres dígitos', r2.codigoSucursal, '007')
eq('familia variante', r2.codigoFamilia, '014')

seccion('Fallback de leyenda Sucursal')
const fallback = [
  'S.A. IMP. Y EXP. DE LA PATAGONIA - Sucursal: 115',
  'Listado de Pedido de Reposición Asistida',
].join('\n')
const r3 = m.extraerMetadataGlaciar(fallback)
eq('sucursal desde leyenda', r3.codigoSucursal, '115')
eq('familia ausente', r3.codigoFamilia, null)

seccion('Archivo sin identidad de sucursal')
const sinSucursal = 'Listado de Pedido de Reposición Asistida\nCód.Familia:\t003'
const r4 = m.extraerMetadataGlaciar(sinSucursal)
eq('sucursal ausente no se inventa', r4.codigoSucursal, null)
eq('familia sí se conserva', r4.codigoFamilia, '003')

seccion('No aceptar valores no numéricos')
const invalido = 'Cod.Suc.Padrón:\tABC\nSucursal: RGL'
const r5 = m.extraerMetadataGlaciar(invalido)
eq('código inválido', r5.codigoSucursal, null)

process.exit(resumen() === 0 ? 0 : 1)
