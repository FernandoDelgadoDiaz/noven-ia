import { cargar, eq, seccion, resumen } from './_helpers.mjs'

const m = await cargar('src/lib/importar-glaciar.ts')
const T = '\t'
const L = (...c) => c.join(T)

function reporteValido(codigoSucursal = '091') {
  return [
    'Parámetros del Listado de Pedido de Reposición Asistida',
    codigoSucursal === null
      ? L('Grupo RA:', '1', 'Nro.Pedido:', '53008944')
      : L('Grupo RA:', '1', 'Nro.Pedido:', '53008944', 'Cod.Suc.Padrón:', codigoSucursal),
    L('Cód.Familia:', '003'),
    L('Período de Referencia Desde:', '06/08/2026', 'Período de Referencia Hasta:', '06/08/2026', 'Cod.Art.:'),
    '04/08/2026 - 19:24:40',
    'S.A. IMP. Y EXP. DE LA PATAGONIA',
    'Listado de Pedido de Reposición Asistida',
    L('', '', '', '', '', '', 'Fec.', 'Mín', 'Stock', 'Stock', 'Stock', 'Stock', '', 'Venta', 'Stk', '', 'Cant.', 'Cant.', 'Cant.'),
    L('Cod.Art.', 'Descripción', 'Marca', 'Bto', 'Cont', 'U/M', 'Disc.', 'Form', 'Suc.', 'Proc.', 'Trans.', 'CDR', 'Ins', 'Media', 'Mín', 'Rot.', 'Sug.', 'Btos.', 'Unid.'),
    L('3328533', 'TURROCKLETS', 'ARCOR', 'Un(25', '25', 'GR', '', '02', '169', '0', '0', '300', 'N', '3,15', '10', 'A', '0', '0', '0'),
  ].join('\r\n')
}

seccion('Reporte válido 091')
const ok = m.analizarReporteGlaciar(reporteValido())
eq('sucursal', ok.metadata.codigoSucursal, '091')
eq('familia', ok.parser.codigoFamilia, '003')
eq('filas', ok.parser.filas.length, 1)
eq('sin errores bloqueantes', ok.erroresBloqueantes, [])

seccion('Reporte válido pero sin identidad de sucursal')
const sinSucursal = m.analizarReporteGlaciar(reporteValido(null))
eq('metadata no inventa sucursal', sinSucursal.metadata.codigoSucursal, null)
eq('la grilla sigue siendo válida', sinSucursal.parser.filas.length, 1)
eq('queda bloqueado', sinSucursal.erroresBloqueantes.length, 1)
eq('mensaje apunta a Cod.Suc.Padrón', sinSucursal.erroresBloqueantes[0].includes('Cod.Suc.Padrón'), true)

seccion('Archivo ajeno al reporte esperado')
const ajeno = m.analizarReporteGlaciar('sku,descripcion,stock\n1,Producto,3')
eq('header ausente', ajeno.parser.headerAusente, true)
eq('sin sucursal', ajeno.metadata.codigoSucursal, null)
eq('múltiples razones de bloqueo', ajeno.erroresBloqueantes.length >= 2, true)

process.exit(resumen() === 0 ? 0 : 1)
