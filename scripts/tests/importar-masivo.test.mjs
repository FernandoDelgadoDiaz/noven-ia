import { cargar, eq, seccion, resumen } from './_helpers.mjs'

const { planificarImportacionMasiva } = await cargar('src/lib/importar-masivo.ts')

const fila = (cod_art, descripcion = cod_art) => ({
  linea: 1,
  cod_art,
  descripcion,
  marca: '',
  gramaje: null,
  stockCsv: 10,
  ventaMediaCsv: 1,
  sinVentaMedia: false,
})

const producto = (id, cod_art, familia_id) => ({
  id,
  cod_art,
  codigo_barras: null,
  descripcion: cod_art,
  marca: null,
  gramaje: null,
  stock_actual: 0,
  venta_media_diaria: 0,
  familia_id,
})

seccion('Importación masiva aprendida: sólo cod_art exacto')
const plan = planificarImportacionMasiva(
  [
    fila('1000001', 'Golosina conocida'),
    fila('2000002', 'Bebida conocida'),
    fila('3000003', 'Producto conocido sin familia'),
    fila('9999999', 'Producto completamente nuevo'),
  ],
  [
    producto('p1', '1000001', 'fam-golosinas'),
    producto('p2', '2000002', 'fam-bebidas'),
    producto('p3', '3000003', null),
    // Descripción muy parecida pero código distinto: el masivo NO debe adivinar.
    { ...producto('p4', '8888888', 'fam-golosinas'), descripcion: 'Producto completamente nuevo' },
  ],
)

eq('dos SKU conocidos y ruteables', plan.actualizables.length, 2)
eq('conocido sin familia queda fuera de escritura automática', plan.conocidosSinFamilia.length, 1)
eq('SKU nuevo queda en cola sin mapear', plan.sinMapear.length, 1)
eq('no usa similitud de descripción para adivinar', plan.sinMapear[0].cod_art, '9999999')
eq('dos familias detectadas en preview', plan.porFamilia.length, 2)
eq('primera familia tiene un producto', plan.porFamilia[0].productos, 1)

seccion('La clasificación aprendida sigue al producto, no al archivo')
const planMixto = planificarImportacionMasiva(
  [fila('4000004'), fila('5000005'), fila('6000006')],
  [
    producto('p4', '4000004', 'fam-almacen'),
    producto('p5', '5000005', 'fam-limpieza'),
    producto('p6', '6000006', 'fam-textil'),
  ],
)

eq('un único CSV puede rutear tres familias', planMixto.porFamilia.length, 3)
eq('todos quedan listos para actualización', planMixto.actualizables.length, 3)
eq('sin pendientes', planMixto.sinMapear.length + planMixto.conocidosSinFamilia.length, 0)

process.exitCode = resumen()
