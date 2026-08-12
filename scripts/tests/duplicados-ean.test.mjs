import { cargar, eq, seccion, resumen } from './_helpers.mjs'

const m = await cargar('src/lib/importar-reconciliacion.ts')


const FAM='1c4d345c-254a-4065-b111-f744f966faaa'
const fila=(c,d,s,v)=>({linea:1,cod_art:c,descripcion:d,marca:'',gramaje:null,stockCsv:s,ventaMediaCsv:v,sinVentaMedia:false})
const prod=(id,c,d,st,vm,fam,cb=null)=>({id,cod_art:c,codigo_barras:cb,descripcion:d,marca:null,gramaje:null,stock_actual:st,venta_media_diaria:vm,familia_id:fam})

seccion("PAR 2 REAL: la descripcion NO alcanza, el EAN si")
const glaciar  = prod('id-g','2319100','CHOCOLATE CONLECHE MILKA Un(240',44,0.24,FAM,'7622210795625')
const escaneado= prod('id-e','7622210795625','Chocolate leche',133,0,FAM)
// Se mide primero que la similaridad de descripción efectivamente NO alcanza:
// es la razón de ser del matcheo por código de barras.
const { similaridad } = await cargar('src/lib/importar-csv.ts')
const sim = similaridad('CHOCOLATE CONLECHE MILKA Un(240', 'Chocolate leche')
eq('la similaridad de descripcion queda BAJO el umbral', sim < 0.85, true)
console.log(`      (similaridad real: ${sim.toFixed(3)})`)

let r = m.reconciliar([fila('2319100','CHOCOLATE CONLECHE MILKA Un(240',44,0.24)],[glaciar,escaneado],FAM)
eq('detecta el duplicado por EAN', r.duplicadosPorEan.length, 1)
eq('el principal es el de Glaciar', r.duplicadosPorEan[0]?.principal.id, 'id-g')
eq('el duplicado es el escaneado', r.duplicadosPorEan[0]?.duplicado.id, 'id-e')
eq('NO se reporta ademas como huerfano', r.huerfanos.length, 0)
eq('el principal se actualiza igual', r.aActualizar[0]?.match.id, 'id-g')

seccion("PAR 1: Alfajor de maicena")
const g1=prod('id-g1','3210595','ALFAJORES DE MAICENA',38,0.68,FAM,'7798267200044')
const e1=prod('id-e1','7798267200044','Alfajor de maicena',27,0,FAM)
r = m.reconciliar([fila('3210595','ALFAJORES DE MAICENA',38,0.68)],[g1,e1],FAM)
eq('detecta el duplicado', r.duplicadosPorEan.length, 1)
eq('duplicado correcto', r.duplicadosPorEan[0]?.duplicado.cod_art, '7798267200044')

seccion("sin duplicado: no inventa pares")
const solo=prod('id-s','3210595','ALFAJORES DE MAICENA',38,0.68,FAM,'7798267200044')
r = m.reconciliar([fila('3210595','ALFAJORES DE MAICENA',38,0.68)],[solo],FAM)
eq('sin gemelo, sin duplicado', r.duplicadosPorEan.length, 0)

seccion("no se autorreporta cuando el EAN es su propio cod_art")
const mismo=prod('id-m','7790040003606','Galletitas sabor queso',9,0,FAM,'7790040003606')
r = m.reconciliar([fila('7790040003606','Galletitas sabor queso',9,0)],[mismo],FAM)
eq('no se reporta a si mismo', r.duplicadosPorEan.length, 0)

process.exit(resumen() === 0 ? 0 : 1)
