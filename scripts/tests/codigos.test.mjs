import { cargar, eq, seccion, resumen } from './_helpers.mjs'

const m = await cargar('src/lib/codigos.ts')


seccion("esCodArtValido: solo 7 digitos")
eq('cod_art real de Glaciar', m.esCodArtValido('3328533'), true)
eq('con ceros a la izquierda', m.esCodArtValido('0022354'), true)
eq('EAN-13 rechazado', m.esCodArtValido('7790310985236'), false)
eq('EAN-8 rechazado', m.esCodArtValido('77981912'), false)
eq('6 digitos rechazado', m.esCodArtValido('332853'), false)
eq('alfanumerico rechazado', m.esCodArtValido('ABC1234'), false)
eq('vacio rechazado', m.esCodArtValido(''), false)
eq('placeholder de ceros rechazado (caso Turrocklets)', m.esCodArtValido('0000000'), false)

seccion("esEanValido: 8, 12, 13, 14")
eq('EAN-8 (el caso Cofler)', m.esEanValido('77981912'), true)
eq('UPC-A 12', m.esEanValido('012345678905'), true)
eq('EAN-13', m.esEanValido('7790310985236'), true)
eq('GTIN-14', m.esEanValido('17790310985236'), true)
eq('7 digitos NO es EAN', m.esEanValido('3328533'), false)
eq('9 digitos NO es EAN', m.esEanValido('123456789'), false)
eq('con letras rechazado', m.esEanValido('779031098523X'), false)

seccion("INVARIANTE CRITICA: ningun EAN valido puede pasar como cod_art")
const muestras = ['77981912','012345678905','7790310985236','17790310985236','0000077993540','7622210795625','7798267200044']
let violaciones = muestras.filter((c) => m.esEanValido(c) && m.esCodArtValido(c))
eq('interseccion vacia entre EAN valido y cod_art valido', violaciones, [])
// Comprobacion exhaustiva por largo
const largosEan = m.LARGOS_EAN
eq('ningun largo de EAN coincide con el de cod_art', largosEan.filter(l => l === m.LARGO_COD_ART), [])

seccion("clasificarCodigoEscaneado")
eq('7 digitos -> cod_art', m.clasificarCodigoEscaneado('3328533'), 'cod_art')
eq('EAN-13 -> ean', m.clasificarCodigoEscaneado('7790310985236'), 'ean')
eq('EAN-8 -> ean (antes caia en desconocido)', m.clasificarCodigoEscaneado('77981912'), 'ean')
eq('UPC-A -> ean', m.clasificarCodigoEscaneado('012345678905'), 'ean')
eq('largo raro -> desconocido', m.clasificarCodigoEscaneado('12345'), 'desconocido')
eq('no numerico -> desconocido', m.clasificarCodigoEscaneado('ABC'), 'desconocido')

seccion("los 4 duplicados reales de produccion")
for (const [cod, desc] of [['0000000','Turrocklets'],['7798267200044','Alfajor de maicena'],['7622210795625','Chocolate leche'],['77981912','Chocolate blanco con mani']]) {
  const ok = !m.esCodArtValido(cod)
  console.log(`${ok?'PASS':'FAIL'}  hoy el alta rechazaria "${cod}" (${desc}) como cod_art`)
}

process.exit(resumen() === 0 ? 0 : 1)
