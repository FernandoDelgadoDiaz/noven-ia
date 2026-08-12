import { cargar, eq, seccion, resumen } from './_helpers.mjs'

const m = await cargar('src/lib/importar-reconciliacion.ts')


const FAM_003 = '1c4d345c-254a-4065-b111-f744f966faaa'
const FAM_014 = '7391ec41-fac9-4d22-b7bf-738a59ac1c28'

const fila = (cod_art, descripcion, stockCsv, ventaMediaCsv) => ({
  linea: 1, cod_art, descripcion, marca: '', gramaje: null, stockCsv, ventaMediaCsv, sinVentaMedia: false,
})
const prod = (id, cod_art, descripcion, stock_actual, venta_media_diaria, familia_id, codigo_barras = null) => ({
  id, cod_art, codigo_barras, descripcion, marca: null, gramaje: null, stock_actual, venta_media_diaria, familia_id,
})

seccion("clasificarCodArt")
eq('placeholder de ceros', m.clasificarCodArt('0000000'), 'sin_asignar')
eq('vacio', m.clasificarCodArt(''), 'sin_asignar')
eq('EAN-13 en el campo equivocado', m.clasificarCodArt('7790310985236'), 'ean')
eq('cod_art valido de Glaciar', m.clasificarCodArt('3328533'), null)
eq('alfanumerico', m.clasificarCodArt('ABC12'), 'formato_invalido')

seccion("EL CASO TURROCKLETS (real, produccion)")
// La app tiene el duplicado: '0000000' (cargado a mano) y '3328533' (de Glaciar).
// El CSV de la familia 003 trae solo el 3328533.
const turroMano = prod('id-mano', '0000000', 'Turrocklets', 127, 0, FAM_003, '0000077993540')
const turroCsv  = prod('id-csv', '3328533', 'TURROCKLETS', 169, 3.15, FAM_003)
let r = m.reconciliar([fila('3328533', 'TURROCKLETS', 169, 3.15)], [turroMano, turroCsv], FAM_003)
eq('matchea el registro correcto por cod_art', r.aActualizar[0]?.match.id, 'id-csv')
eq('el duplicado a mano queda como huerfano', r.huerfanos.map(h => h.producto.id), ['id-mano'])
eq('huerfano marcado como cod_art sin asignar', r.huerfanos[0]?.motivoCodArt, 'sin_asignar')
eq('no se inserta como nuevo', r.nuevos.length, 0)

seccion("recuperacion por descripcion (cod_art desalineado)")
// Escenario: la app SOLO tiene el registro cargado a mano; el CSV trae el bueno.
// Sin match por descripcion se insertaria un duplicado nuevo.
r = m.reconciliar([fila('3328533', 'TURROCKLETS', 169, 3.15)], [turroMano], FAM_003)
eq('no lo da por nuevo', r.nuevos.length, 0)
eq('lo manda a confirmacion', r.aConfirmar.length, 1)
eq('propone el registro a mano', r.aConfirmar[0]?.match.id, 'id-mano')
eq('estrategia descripcion', r.aConfirmar[0]?.estrategia, 'descripcion')
eq('similaridad 1 (solo difiere mayusculas)', r.aConfirmar[0]?.similaridad, 1)
eq('no queda como huerfano (ya fue propuesto)', r.huerfanos.length, 0)

seccion("productos genuinamente nuevos")
r = m.reconciliar([fila('5555555', 'PRODUCTO INEDITO XYZ', 10, 1)], [turroCsv], FAM_003)
eq('se inserta como nuevo', r.nuevos.length, 1)
eq('no se confunde con otro', r.aConfirmar.length, 0)
eq('el no matcheado queda huerfano', r.huerfanos.map(h => h.producto.id), ['id-csv'])

seccion("conflicto de familia (el bug que movio Turrocklets a 014)")
const enOtraFamilia = prod('id-x', '3328533', 'TURROCKLETS', 169, 3.15, FAM_014)
r = m.reconciliar([fila('3328533', 'TURROCKLETS', 169, 3.15)], [enOtraFamilia], FAM_003)
eq('detecta el conflicto de familia', r.conflictosFamilia.length, 1)
eq('igual lo actualiza', r.aActualizar.length, 1)
eq('marca la bandera en la fila', r.aActualizar[0]?.conflictoFamilia, true)

seccion("mismo producto reclamado por dos filas")
const unico = prod('id-u', '1111111', 'PRODUCTO UNO', 5, 1, FAM_003, '7790000000001')
r = m.reconciliar(
  [fila('1111111', 'PRODUCTO UNO', 5, 1), fila('7790000000001', 'PRODUCTO UNO', 9, 2)],
  [unico],
  FAM_003,
)
eq('solo una fila lo toma', r.aActualizar.length, 1)
eq('la segunda queda como colision', r.colisiones.length, 1)
eq('no se duplica el update', r.aActualizar[0]?.match.id, 'id-u')

seccion("EAN-13 guardado como cod_art (10 casos reales)")
const papas = prod('id-p', '7790310985236', 'Papas fritas clásicas', 68, 0, FAM_003)
r = m.reconciliar([fila('3499999', 'PAPAS FRITAS CLASICAS', 80, 2.5)], [papas], FAM_003)
eq('lo recupera por descripcion', r.aConfirmar.length, 1)
eq('propone el de EAN-como-cod_art', r.aConfirmar[0]?.match.id, 'id-p')

r = m.reconciliar([fila('3499999', 'OTRA COSA DISTINTA', 80, 2.5)], [papas], FAM_003)
eq('si no se parece, queda huerfano con motivo ean', r.huerfanos[0]?.motivoCodArt, 'ean')

seccion("huerfanos ordenados por sospecha")
const sano = prod('id-s', '2222222', 'PRODUCTO SANO', 1, 1, FAM_003)
const ean  = prod('id-e', '7790310985267', 'NACHOS', 1, 1, FAM_003)
const cero = prod('id-c', '0000000', 'SIN CODIGO', 1, 1, FAM_003)
r = m.reconciliar([], [sano, ean, cero], FAM_003)
eq('primero los sin_asignar, despues ean, al final los sanos',
  r.huerfanos.map(h => h.motivoCodArt), ['sin_asignar', 'ean', null])

process.exit(resumen() === 0 ? 0 : 1)
