export const DESAFIO_5S_SECTORES = [
  'Gerencia',
  'Administración',
  'Línea de Cajas',
  'Salón',
  'Carnicería',
  'Verdulería',
  'Maestranza',
  'Lácteos',
  'Panadería',
] as const

export type Desafio5SSector = (typeof DESAFIO_5S_SECTORES)[number]

export const DESAFIO_5S = {
  nombre: 'Desafío 5S',
  cantidadPreguntas: 15,
  preguntasPorS: 3,
  permitirUnaEvaluacionOficialPorLegajo: true,
  rankingVisibleDespuesDeParticipar: true,
  administradorPruebaIlimitada: true,
  pruebasAdminComputanRanking: false,
} as const
