import { cargar, eq, seccion, resumen } from './_helpers.mjs'

const {
  calcularDiasStock,
  calcularDiasComercialesRestantes,
  calcularVelocidadNecesaria,
  calcularNivelRiesgo,
  diasDonacionLegacyPorSector,
  sugerirAcciones,
} = await cargar('src/lib/riesgo.ts')

seccion('Política de donación por sector')
eq('Verdulería = 2 días', diasDonacionLegacyPorSector('VERDULERÍA'), 2)
eq('Carnicería = 2 días', diasDonacionLegacyPorSector('CARNICERIA'), 2)
eq('Lácteos = 2 días', diasDonacionLegacyPorSector('LACTEOS'), 2)
eq('Panadería = 2 días', diasDonacionLegacyPorSector('PANADERÍA'), 2)
eq('Rotisería = 2 días', diasDonacionLegacyPorSector('ROTISERIA'), 2)
eq('Almacén = 10 días', diasDonacionLegacyPorSector('ALMACEN'), 10)
eq('Bebidas = 10 días', diasDonacionLegacyPorSector('BEBIDAS'), 10)
eq('Limpieza = 10 días', diasDonacionLegacyPorSector('LIMPIEZA'), 10)
eq('Perfumería = 10 días', diasDonacionLegacyPorSector('PERFUMERIA'), 10)
eq('No comestibles = 10 días', diasDonacionLegacyPorSector('NO COMESTIBLES'), 10)
eq('Textil = 10 días', diasDonacionLegacyPorSector('TEXTIL'), 10)
eq('Congelados = 10 días', diasDonacionLegacyPorSector('CONGELADOS'), 10)
eq('Sector no configurado conserva fallback técnico 10', diasDonacionLegacyPorSector('FIAMBRES'), 10)

seccion('Umbral obligatorio de donación')
eq('No perecedero a 10 días => donación', calcularNivelRiesgo(10, 1, 100, 10), 'donacion')
eq('Perecedero a 2 días => donación', calcularNivelRiesgo(2, 1, 100, 2), 'donacion')
eq('Perecedero a 3 días puede seguir seguro si alcanza', calcularNivelRiesgo(3, 1, 100, 2), 'seguro')
eq('Vencido => decomiso sin importar política', calcularNivelRiesgo(0, 1, 100, 2), 'decomiso')

seccion('Radar usa ventana comercial, no fecha de vencimiento')
// 100 / 3 = 33,33 días de venta. A 40 días del vencimiento:
// - no perecedero tiene sólo 30 días comerciales (40-10) => RADAR
// - perecedero tiene 38 días comerciales (40-2) => SEGURO
eq('40 días, no perecedero: riesgo antes de donación => radar', calcularNivelRiesgo(40, 100, 3, 10), 'radar')
eq('40 días, perecedero: alcanza antes de donación => seguro', calcularNivelRiesgo(40, 100, 3, 2), 'seguro')

seccion('Urgente y frontera exacta')
eq('20 días, necesita 15 y dispone 10 => urgente', calcularNivelRiesgo(20, 30, 2, 10), 'urgente')
eq('20 días, necesita exactamente 10 y dispone 10 => seguro', calcularNivelRiesgo(20, 20, 2, 10), 'seguro')
eq('Sin rotación dentro de 45 días => radar', calcularNivelRiesgo(30, 5, 0, 10), 'radar')
eq('Sin rotación dentro de 20 días => urgente', calcularNivelRiesgo(15, 5, 0, 10), 'urgente')

seccion('Métricas operativas')
eq('Días stock conserva fracción (sin floor)', calcularDiasStock(5, 2), 2.5)
eq('Días comerciales 15-10', calcularDiasComercialesRestantes(15, 10), 5)
eq('Días comerciales nunca negativos', calcularDiasComercialesRestantes(5, 10), 0)
eq('Velocidad necesaria: 40 un / 5 días = 8', calcularVelocidadNecesaria(40, 15, 10), 8)
eq('Sin ventana comercial => velocidad infinita', calcularVelocidadNecesaria(1, 10, 10), Infinity)

seccion('Acciones RAG')
eq('Radar habilita RAG', sugerirAcciones('radar')[0], 'Gestionar RAG en Glaciar')
eq('Urgente exige revisar RAG', sugerirAcciones('urgente')[0], 'Revisar RAG en Glaciar')

process.exitCode = resumen()
