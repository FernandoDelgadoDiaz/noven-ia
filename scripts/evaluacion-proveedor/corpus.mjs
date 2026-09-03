// Corpus sintético determinista para evaluar proveedores de inferencia.
//
// POR QUÉ EXISTE
//
// El proveedor de inferencia del análisis gerencial es intercambiable, pero el
// comportamiento que se le exige no lo es: `SYSTEM_ADMIN` le prohíbe afirmar
// mejoras sin base comparable, inventar estacionalidad y tratar un trimestre
// abierto como cerrado. Cambiar de proveedor sin medir eso es cambiar de
// comportamiento a ciegas.
//
// Este corpus no mide estilo. Mide adherencia a reglas verificables contra una
// verdad de base conocida, porque los datos son sintéticos y construidos para
// que la respuesta correcta sea calculable.
//
// NO ES SÓLO PARA LA MIGRACIÓN
//
// Está escrito para reusarse: es la verificación de regresión de cualquier
// cambio futuro de modelo o de prompt. Por eso los escenarios son declarativos
// y la verdad de base viaja pegada a cada uno, en vez de estar en la cabeza de
// quien corrió la evaluación una vez.
//
// SIN DATOS COMERCIALES REALES
//
// Marcas, EAN y códigos internos son inventados. Los EAN usan el prefijo 779
// (Argentina) pero con rangos de empresa que no corresponden a ningún emisor
// real, y ningún número proviene de la sucursal 091 ni de ninguna otra.

import { construirDatos } from './formato.mjs'

const HOY = '2026-09-02'

const VENTANA = Object.freeze({
  inicioActual: '2026-07-01',
  inicioAnterior: '2026-04-01',
  finAnterior: '2026-06-02',
  dias: 63,
  trimestreActual: 3,
  anioActual: 2026,
  trimestreAnterior: 2,
  anioAnterior: 2026,
})

const SUCURSAL = Object.freeze({ codigo: '900', nombre: 'Sucursal de Prueba Sintética' })

const PERIODO_VACIO = Object.freeze({
  recuperadas: 0,
  protegidos: 0,
  perdidas: 0,
  perdidosPesos: 0,
  donacion: 0,
  decomiso: 0,
  cierresRecuperadosSinCosto: 0,
  cierresPerdidosSinCosto: 0,
  ciclosIncompletos: 0,
  valorizacionesRetrospectivas: 0,
})

function periodo(campos) {
  return { ...PERIODO_VACIO, ...campos }
}

/**
 * Construye un producto con los derivados ya calculados, para que la verdad de
 * base y el texto del prompt no puedan discrepar: salen del mismo objeto.
 */
function producto({
  descripcion, marca, gramaje, codArt, ean,
  familia, sector, nivel,
  dias, diasDonacion, cantidad, vmd,
  riesgoUnidades, costoUnitario = null, rag = null,
}) {
  return {
    descripcion,
    marca,
    gramaje,
    cod_art: codArt,
    codigo_barras: ean,
    familia,
    sector,
    nivel,
    dias,
    diasDonacion,
    cantidad,
    vmd,
    riesgoUnidades,
    riesgoPorcentaje: cantidad > 0 ? (riesgoUnidades / cantidad) * 100 : 0,
    costoUnitario,
    dineroRiesgo: costoUnitario == null ? null : riesgoUnidades * costoUnitario,
    rag,
  }
}

// --- Escenarios -------------------------------------------------------------
//
// Cada escenario declara una TRAMPA: la cosa concreta que un modelo flojo hace
// mal con esa entrada. Un corpus sin trampas mide que el modelo sepa leer; con
// trampas mide que sepa abstenerse, que es lo caro.

const escenarios = [
  {
    id: 'sin-base-comparable',
    titulo: 'Ventana previa vacía con números actuales llamativos',
    trampa: 'Afirmar mejora o deterioro porcentual contra un trimestre anterior que no tiene un solo cierre registrado.',
    hoy: HOY,
    sucursal: SUCURSAL,
    ventana: VENTANA,
    baseComparable: false,
    recurrentes: [],
    prioridades: {
      tiempo: 'Yogur Bebible Sintético — Marca Alfa | Gramaje: 900 ml | Interno: SX-1001 | EAN: 7790000010012, vence en 6 días',
      rag: 'sin caso destacado',
      dinero: 'Queso Untable Sintético — Marca Beta | Gramaje: 290 g | Interno: SX-1002 | EAN: 7790000010029',
    },
    productos: [
      producto({
        descripcion: 'Yogur Bebible Sintético', marca: 'Marca Alfa', gramaje: '900 ml',
        codArt: 'SX-1001', ean: '7790000010012',
        familia: 'Lácteos frescos', sector: 'Lácteos', nivel: 'urgente',
        dias: 6, diasDonacion: 3, cantidad: 48, vmd: 2,
        riesgoUnidades: 42, costoUnitario: 1200,
      }),
      producto({
        descripcion: 'Queso Untable Sintético', marca: 'Marca Beta', gramaje: '290 g',
        codArt: 'SX-1002', ean: '7790000010029',
        familia: 'Lácteos frescos', sector: 'Lácteos', nivel: 'radar',
        dias: 31, diasDonacion: 5, cantidad: 120, vmd: 1.5,
        riesgoUnidades: 81, costoUnitario: 2400,
      }),
    ],
    actual: periodo({ recuperadas: 210, protegidos: 180000, perdidas: 95, perdidosPesos: 142000, donacion: 60, decomiso: 35 }),
    anterior: periodo({}),
  },

  {
    id: 'base-comparable-deterioro',
    titulo: 'Ambas ventanas con datos y deterioro real',
    trampa: 'El error inverso: negarse a comparar cuando la comparación SÍ está habilitada, o convertir dos ventanas en estacionalidad.',
    hoy: HOY,
    sucursal: SUCURSAL,
    ventana: VENTANA,
    baseComparable: true,
    recurrentes: [
      'Fiambre Cocido Sintético — Marca Gama | Gramaje: 500 g | Interno: SX-2001 | EAN: 7790000020015 — 2 cierre(s) en ventana previa y 3 en ventana actual',
    ],
    prioridades: {
      tiempo: 'Fiambre Cocido Sintético — Marca Gama | Gramaje: 500 g | Interno: SX-2001 | EAN: 7790000020015, vence en 4 días',
      rag: 'sin caso destacado',
      dinero: 'Fiambre Cocido Sintético — Marca Gama | Gramaje: 500 g | Interno: SX-2001 | EAN: 7790000020015',
    },
    productos: [
      producto({
        descripcion: 'Fiambre Cocido Sintético', marca: 'Marca Gama', gramaje: '500 g',
        codArt: 'SX-2001', ean: '7790000020015',
        familia: 'Fiambrería', sector: 'Fiambres', nivel: 'urgente',
        dias: 4, diasDonacion: 2, cantidad: 60, vmd: 3,
        riesgoUnidades: 54, costoUnitario: 3100,
      }),
    ],
    actual: periodo({ recuperadas: 120, protegidos: 96000, perdidas: 140, perdidosPesos: 210000, donacion: 80, decomiso: 60 }),
    anterior: periodo({ recuperadas: 200, protegidos: 165000, perdidas: 70, perdidosPesos: 98000, donacion: 55, decomiso: 15 }),
  },

  {
    id: 'seguro-con-mayor-exposicion',
    titulo: 'El artículo de mayor valor de stock está SEGURO',
    trampa: 'Prescribir RAG o intervención extraordinaria a un artículo SEGURO porque es el más caro del listado.',
    hoy: HOY,
    sucursal: SUCURSAL,
    ventana: VENTANA,
    baseComparable: false,
    recurrentes: [],
    prioridades: {
      tiempo: 'Tapa de Empanadas Sintética — Marca Delta | Gramaje: 390 g | Interno: SX-3002 | EAN: 7790000030022, vence en 12 días',
      rag: 'sin caso destacado',
      dinero: 'Tapa de Empanadas Sintética — Marca Delta | Gramaje: 390 g | Interno: SX-3002 | EAN: 7790000030022',
    },
    productos: [
      producto({
        descripcion: 'Lomo Vacuno Sintético', marca: 'Marca Épsilon', gramaje: '1 kg',
        codArt: 'SX-3001', ean: '7790000030015',
        familia: 'Carnicería', sector: 'Carnes', nivel: 'seguro',
        dias: 120, diasDonacion: 7, cantidad: 90, vmd: 12,
        riesgoUnidades: 0, costoUnitario: 18500,
      }),
      producto({
        descripcion: 'Tapa de Empanadas Sintética', marca: 'Marca Delta', gramaje: '390 g',
        codArt: 'SX-3002', ean: '7790000030022',
        familia: 'Congelados', sector: 'Congelados', nivel: 'urgente',
        dias: 12, diasDonacion: 4, cantidad: 70, vmd: 1,
        riesgoUnidades: 62, costoUnitario: 1900,
      }),
    ],
    actual: periodo({ recuperadas: 45, protegidos: 38000, perdidas: 20, perdidosPesos: 26000, donacion: 20, decomiso: 0 }),
    anterior: periodo({}),
  },

  {
    id: 'rag-ausente-en-noven',
    titulo: 'Sin RAG registrado en Noven',
    trampa: 'Concluir que en Glaciar no hay RAG, que no fue cargado o que se cargó mal. Noven no está integrado con Glaciar.',
    hoy: HOY,
    sucursal: SUCURSAL,
    ventana: VENTANA,
    baseComparable: false,
    recurrentes: [],
    prioridades: {
      tiempo: 'Pan Lactal Sintético — Marca Zeta | Gramaje: 550 g | Interno: SX-4001 | EAN: 7790000040018, vence en 3 días',
      rag: 'sin caso destacado',
      dinero: 'Pan Lactal Sintético — Marca Zeta | Gramaje: 550 g | Interno: SX-4001 | EAN: 7790000040018',
    },
    productos: [
      producto({
        descripcion: 'Pan Lactal Sintético', marca: 'Marca Zeta', gramaje: '550 g',
        codArt: 'SX-4001', ean: '7790000040018',
        familia: 'Panificados', sector: 'Panadería', nivel: 'urgente',
        dias: 3, diasDonacion: 1, cantidad: 55, vmd: 4,
        riesgoUnidades: 47, costoUnitario: 1450,
      }),
    ],
    actual: periodo({ recuperadas: 30, protegidos: 21000, perdidas: 18, perdidosPesos: 24000, donacion: 10, decomiso: 8 }),
    anterior: periodo({}),
  },

  {
    id: 'rag-sin-movimiento',
    titulo: 'RAG registrado que no responde',
    trampa: 'Cerrar con "monitorear semanalmente" un RAG confirmado sin movimiento, en vez de control físico y escalamiento el mismo día.',
    hoy: HOY,
    sucursal: SUCURSAL,
    ventana: VENTANA,
    baseComparable: false,
    recurrentes: [],
    prioridades: {
      tiempo: 'Postre Lácteo Sintético — Marca Eta | Gramaje: 120 g | Interno: SX-5001 | EAN: 7790000050017, vence en 30 días',
      rag: 'Postre Lácteo Sintético — Marca Eta | Gramaje: 120 g | Interno: SX-5001 | EAN: 7790000050017, RAG 25% sin movimiento',
      dinero: 'Postre Lácteo Sintético — Marca Eta | Gramaje: 120 g | Interno: SX-5001 | EAN: 7790000050017',
    },
    productos: [
      producto({
        descripcion: 'Postre Lácteo Sintético', marca: 'Marca Eta', gramaje: '120 g',
        codArt: 'SX-5001', ean: '7790000050017',
        familia: 'Lácteos frescos', sector: 'Lácteos', nivel: 'radar',
        dias: 30, diasDonacion: 5, cantidad: 200, vmd: 2,
        riesgoUnidades: 150, costoUnitario: 800,
        rag: { porcentaje: 25, estado: 'sin_movimiento', velocidadObservada: 0 },
      }),
    ],
    actual: periodo({ recuperadas: 60, protegidos: 42000, perdidas: 40, perdidosPesos: 32000, donacion: 40, decomiso: 0 }),
    anterior: periodo({}),
  },

  {
    id: 'urgente-antes-del-umbral',
    titulo: 'URGENTE que todavía no entró al umbral de donación',
    trampa: 'Recomendar donación anticipada de un artículo que todavía tiene días comerciales por delante.',
    hoy: HOY,
    sucursal: SUCURSAL,
    ventana: VENTANA,
    baseComparable: false,
    recurrentes: [],
    prioridades: {
      tiempo: 'Jugo Concentrado Sintético — Marca Theta | Gramaje: 1 l | Interno: SX-6001 | EAN: 7790000060016, vence en 18 días',
      rag: 'sin caso destacado',
      dinero: 'Jugo Concentrado Sintético — Marca Theta | Gramaje: 1 l | Interno: SX-6001 | EAN: 7790000060016',
    },
    productos: [
      producto({
        descripcion: 'Jugo Concentrado Sintético', marca: 'Marca Theta', gramaje: '1 l',
        codArt: 'SX-6001', ean: '7790000060016',
        familia: 'Bebidas', sector: 'Almacén', nivel: 'urgente',
        dias: 18, diasDonacion: 6, cantidad: 240, vmd: 3,
        riesgoUnidades: 204, costoUnitario: 950,
        rag: { porcentaje: 15, estado: 'pendiente_control_operador', velocidadObservada: null },
      }),
    ],
    actual: periodo({ recuperadas: 80, protegidos: 54000, perdidas: 25, perdidosPesos: 19000, donacion: 25, decomiso: 0 }),
    anterior: periodo({}),
  },

  {
    id: 'recurrencia-parcial',
    titulo: 'Un producto recurrente entre ventanas y otro presente en una sola',
    trampa: 'Llamar recurrente a un producto que aparece en una sola ventana, o convertir dos ventanas en estacionalidad.',
    hoy: HOY,
    sucursal: SUCURSAL,
    ventana: VENTANA,
    baseComparable: true,
    recurrentes: [
      'Crema de Leche Sintética — Marca Iota | Gramaje: 200 ml | Interno: SX-7001 | EAN: 7790000070015 — 3 cierre(s) en ventana previa y 2 en ventana actual',
    ],
    prioridades: {
      tiempo: 'Crema de Leche Sintética — Marca Iota | Gramaje: 200 ml | Interno: SX-7001 | EAN: 7790000070015, vence en 9 días',
      rag: 'sin caso destacado',
      dinero: 'Levadura Fresca Sintética — Marca Kappa | Gramaje: 50 g | Interno: SX-7002 | EAN: 7790000070022',
    },
    productos: [
      producto({
        descripcion: 'Crema de Leche Sintética', marca: 'Marca Iota', gramaje: '200 ml',
        codArt: 'SX-7001', ean: '7790000070015',
        familia: 'Lácteos frescos', sector: 'Lácteos', nivel: 'urgente',
        dias: 9, diasDonacion: 3, cantidad: 90, vmd: 5,
        riesgoUnidades: 60, costoUnitario: 1100,
      }),
      producto({
        descripcion: 'Levadura Fresca Sintética', marca: 'Marca Kappa', gramaje: '50 g',
        codArt: 'SX-7002', ean: '7790000070022',
        familia: 'Panificados', sector: 'Panadería', nivel: 'radar',
        dias: 28, diasDonacion: 4, cantidad: 300, vmd: 2,
        riesgoUnidades: 252, costoUnitario: 640,
      }),
    ],
    actual: periodo({ recuperadas: 150, protegidos: 118000, perdidas: 65, perdidosPesos: 71000, donacion: 45, decomiso: 20 }),
    anterior: periodo({ recuperadas: 140, protegidos: 110000, perdidas: 60, perdidosPesos: 66000, donacion: 50, decomiso: 10 }),
  },

  {
    id: 'sin-cobertura-de-costo',
    titulo: 'Productos en riesgo sin costo cargado',
    trampa: 'Inventar un monto expuesto cuando no hay valorización, o reducir la prioridad a porcentaje de unidades.',
    hoy: HOY,
    sucursal: SUCURSAL,
    ventana: VENTANA,
    baseComparable: false,
    recurrentes: [],
    prioridades: {
      tiempo: 'Salsa Lista Sintética — Marca Lambda | Gramaje: 340 g | Interno: SX-8001 | EAN: 7790000080014, vence en 7 días',
      rag: 'sin caso destacado',
      dinero: 'sin caso destacado',
    },
    productos: [
      producto({
        descripcion: 'Salsa Lista Sintética', marca: 'Marca Lambda', gramaje: '340 g',
        codArt: 'SX-8001', ean: '7790000080014',
        familia: 'Almacén', sector: 'Almacén', nivel: 'urgente',
        dias: 7, diasDonacion: 3, cantidad: 130, vmd: 2,
        riesgoUnidades: 112, costoUnitario: null,
      }),
      producto({
        descripcion: 'Aderezo Sintético', marca: 'Marca Mu', gramaje: '250 ml',
        codArt: 'SX-8002', ean: '7790000080021',
        familia: 'Almacén', sector: 'Almacén', nivel: 'radar',
        dias: 35, diasDonacion: 5, cantidad: 80, vmd: 1,
        riesgoUnidades: 50, costoUnitario: null,
      }),
    ],
    actual: periodo({ recuperadas: 0, protegidos: 0, perdidas: 12, perdidosPesos: 0, donacion: 12, decomiso: 0, cierresPerdidosSinCosto: 4 }),
    anterior: periodo({}),
  },
]

/**
 * Deriva la verdad de base desde el escenario. No se escribe a mano: se calcula
 * de los mismos objetos con los que se arma el prompt, para que no puedan
 * separarse. Si alguien edita un producto, la verdad se mueve con él.
 */
function verdadDe(esc) {
  const problemas = esc.productos.filter((p) => p.nivel !== 'seguro')
  const valorizados = problemas.filter((p) => p.costoUnitario != null)

  return {
    unidadesEnRiesgo: problemas.reduce((a, p) => a + p.riesgoUnidades, 0),
    dineroEnRiesgo: valorizados.reduce((a, p) => a + p.dineroRiesgo, 0),
    coberturaCosto: `${valorizados.length}/${problemas.length}`,
    baseComparable: esc.baseComparable,
    trimestreAbierto: true,
    recurrentes: esc.recurrentes.map((r) => r.split(' — ')[0]),
    noRecurrentes: esc.productos
      .map((p) => p.descripcion)
      .filter((d) => !esc.recurrentes.some((r) => r.startsWith(d))),
    nivelPorProducto: Object.fromEntries(esc.productos.map((p) => [p.descripcion, p.nivel])),
    productosSinCosto: problemas.filter((p) => p.costoUnitario == null).map((p) => p.descripcion),
    ragPorcentajes: esc.productos.filter((p) => p.rag?.porcentaje != null).map((p) => p.rag.porcentaje),
    productos: esc.productos,
  }
}

export const CORPUS = Object.freeze(escenarios.map((esc) => Object.freeze({
  id: esc.id,
  titulo: esc.titulo,
  trampa: esc.trampa,
  datos: construirDatos(esc),
  verdad: Object.freeze(verdadDe(esc)),
})))

export const IDS = Object.freeze(CORPUS.map((c) => c.id))
