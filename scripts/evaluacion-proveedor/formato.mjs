// Formato del prompt de análisis, replicado para el corpus.
//
// El corpus tiene que hablarle al modelo exactamente como le habla producción.
// Si el corpus usara un formato propio, mediría la adherencia a un texto que
// nadie envía, y un proveedor podría pasar la evaluación y fallar en vivo.
//
// Por eso estas funciones son las mismas de `netlify/functions/analisis.ts`,
// copiadas deliberadamente en vez de importadas: `analisis.ts` las tiene
// privadas dentro de un handler que abre cliente de Supabase, consume cuota y
// llama al proveedor. Importarlo desde un script de evaluación exigiría
// refactorizar producción para un test, que es exactamente el tipo de cambio
// que no conviene hacer por comodidad de la herramienta.
//
// La copia se paga con un riesgo: que producción cambie el formato y el corpus
// se quede viejo en silencio. Ese riesgo está cubierto por
// `scripts/tests/corpus-evaluacion-contract.test.mjs`, que compara los
// marcadores estructurales de este archivo contra los de `analisis.ts` y falla
// si se separan.

const TZ_OPERATIVA = 'America/Argentina/Buenos_Aires'

export function fmtUnidades(v) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(v)
}

export function fmtPesos(v) {
  if (v == null || !Number.isFinite(v)) return 'sin costo disponible'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(v)
}

export function fmtVelocidad(v) {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v.toFixed(2)} u/día`
}

export function identidadArticulo(p) {
  return `${p.descripcion} — ${p.marca?.trim() || 'Sin dato'} | Gramaje: ${p.gramaje?.trim() || 'Sin dato'} | Interno: ${p.cod_art?.trim() || 'Sin dato'} | EAN: ${p.codigo_barras?.trim() || 'Sin dato'}`
}

export function esRagInsuficiente(estado) {
  return estado === 'insuficiente' || estado === 'sin_movimiento'
}

export function accionDeterministica(nivel, estadoRag) {
  if ((nivel === 'urgente' || nivel === 'radar') && esRagInsuficiente(estadoRag)) {
    return 'Control físico hoy y revisar/escalar la intervención RAG; no limitarse a verificar el dato'
  }
  switch (nivel) {
    case 'decomiso': return 'Retirar inmediatamente y registrar decomiso'
    case 'donacion': return 'Retirar de venta y gestionar donación hoy según política'
    case 'urgente': return 'Revisar/aplicar RAG en Glaciar y controlar hoy; no donar antes del umbral obligatorio'
    case 'radar': return 'Verificar hoy en Glaciar si corresponde RAG y luego monitorear la cantidad comprometida'
    default: return 'Seguimiento normal; no indicar RAG obligatorio ni intervención extraordinaria'
  }
}

export function comparativa(actual, anterior, unidad) {
  const prefijo = unidad === '$' ? '$' : ''
  const sufijo = unidad === 'u' ? ' u' : ''
  if (anterior === 0) {
    return actual === 0
      ? 'sin variación (0 en ambos)'
      : `${prefijo}${Math.round(actual)}${sufijo} actuales; base previa = 0`
  }
  const delta = actual - anterior
  const pct = (delta / anterior) * 100
  const signo = delta > 0 ? '+' : ''
  return `${signo}${prefijo}${Math.round(delta)}${sufijo} (${signo}${pct.toFixed(0)}%)`
}

export function fechaCorta(ymd) {
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

export function fechaLarga(ymd) {
  const [y, m, d] = ymd.split('-')
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TZ_OPERATIVA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12)))
}

function lineaProducto(p) {
  const vence = p.dias < 0
    ? `vencido hace ${Math.abs(p.dias)} días`
    : p.dias === 0 ? 'vence hoy' : `vence en ${p.dias} días`

  const comerciales = Math.max(0, p.dias - p.diasDonacion)
  const velocidadNecesaria = comerciales > 0 ? p.cantidad / comerciales : null

  let ragInfo = 'Noven no tiene RAG registrado. Esto no informa el estado de Glaciar; verificar allí si la acción lo requiere.'
  if (p.rag?.porcentaje != null) {
    const respuesta = esRagInsuficiente(p.rag.estado)
      ? 'Respuesta insuficiente confirmada: control físico y revisar/escalar la intervención hoy.'
      : p.rag.estado === 'pendiente_control_operador'
        ? 'Pendiente de control posterior por operador; no evaluar efectividad hasta contar con observación.'
        : 'Usar el estado observado para decidir seguimiento.'
    ragInfo = `RAG registrado en Noven: ${p.rag.porcentaje}%. Estado: ${p.rag.estado}. Velocidad observada: ${fmtVelocidad(p.rag.velocidadObservada)}. Velocidad necesaria: ${fmtVelocidad(velocidadNecesaria)}. ${respuesta}`
  }

  const riesgoInfo = p.nivel === 'seguro'
    ? 'Estado SEGURO: no integrar este artículo al total de riesgo activo ni indicar intervención extraordinaria.'
    : `En riesgo activo: ${fmtUnidades(p.riesgoUnidades)} un. (${p.riesgoPorcentaje.toFixed(1)}%) | Costo unitario s/IVA: ${fmtPesos(p.costoUnitario)} | Dinero en riesgo s/IVA: ${fmtPesos(p.dineroRiesgo)}`

  return [
    `Producto: ${identidadArticulo(p)}`,
    `Familia: ${p.familia} | Sector: ${p.sector} | Nivel: ${p.nivel}`,
    `${vence} | Retiro para donación: ${p.diasDonacion} días antes | Días comerciales: ${comerciales}`,
    `Cantidad comprometida: ${p.cantidad} | VMD Glaciar: ${p.vmd > 0 ? `${p.vmd} u/día` : 'sin rotación'} | Velocidad necesaria: ${fmtVelocidad(velocidadNecesaria)}`,
    riesgoInfo,
    `Acción determinística: ${accionDeterministica(p.nivel, p.rag?.estado)}`,
    ragInfo,
  ].join('\n  ')
}

function resumenPeriodo(nombre, r) {
  return [
    nombre,
    `Unidades recuperadas por venta: ${fmtUnidades(r.recuperadas)}`,
    `$ protegidos/recuperados a costo s/IVA: ${fmtPesos(r.protegidos)}`,
    `Unidades perdidas: ${fmtUnidades(r.perdidas)} (donación ${fmtUnidades(r.donacion)} + decomiso ${fmtUnidades(r.decomiso)})`,
    `$ perdidos a costo s/IVA: ${fmtPesos(r.perdidosPesos)}`,
    `Cierres recuperados sin costo: ${r.cierresRecuperadosSinCosto} | cierres perdidos sin costo: ${r.cierresPerdidosSinCosto}`,
    `Ciclos con evidencia histórica incompleta: ${r.ciclosIncompletos} | valorizaciones retrospectivas: ${r.valorizacionesRetrospectivas}`,
  ].join('\n')
}

function lineaPrioridad(titulo, p) {
  return p ? `- ${titulo}: ${p}` : `- ${titulo}: sin caso destacado.`
}

/**
 * Arma el mensaje de usuario con la misma estructura que produce `analisis.ts`.
 * Recibe un escenario declarativo y devuelve el texto exacto.
 */
export function construirDatos(esc) {
  const problemas = esc.productos.filter((p) => p.nivel !== 'seguro')
  const accionInmediata = problemas.filter((p) => ['decomiso', 'donacion', 'urgente'].includes(p.nivel))
  const radar = problemas.filter((p) => p.nivel === 'radar')
  const valorizados = problemas.filter((p) => p.costoUnitario != null)

  const unidadesEnRiesgo = problemas.reduce((a, p) => a + p.riesgoUnidades, 0)
  const dineroEnRiesgo = valorizados.reduce((a, p) => a + p.dineroRiesgo, 0)

  const topEconomico = [...valorizados]
    .sort((a, b) => b.dineroRiesgo - a.dineroRiesgo)
    .slice(0, 5)
    .map((p, i) => `${i + 1}. ${identidadArticulo(p)} | ${fmtUnidades(p.riesgoUnidades)} un. | ${fmtPesos(p.dineroRiesgo)} | nivel ${p.nivel}`)

  const comparacionHistorica = esc.baseComparable
    ? [
        'Base comparable previa: SÍ. Las dos ventanas tienen igual cantidad de días operativos de calendario.',
        `Comparación recuperadas: ${comparativa(esc.actual.recuperadas, esc.anterior.recuperadas, 'u')}`,
        `Comparación protegidos: ${comparativa(esc.actual.protegidos, esc.anterior.protegidos, '$')}`,
        `Comparación perdidas: ${comparativa(esc.actual.perdidas, esc.anterior.perdidas, 'u')}`,
        `Comparación $ perdidos: ${comparativa(esc.actual.perdidosPesos, esc.anterior.perdidosPesos, '$')}`,
      ].join('\n')
    : 'Base comparable previa: NO. No hay cierres registrados en la ventana equivalente anterior. Prohibido afirmar porcentajes de mejora/deterioro contra el trimestre anterior.'

  return [
    `Fecha operacional: ${fechaLarga(esc.hoy)}`,
    `Sucursal analizada: ${esc.sucursal.codigo} · ${esc.sucursal.nombre}`,
    'Ámbito autorizado: toda la sucursal',
    '',
    '=== RESUMEN GERENCIAL DETERMINÍSTICO ===',
    `Vencimientos activos dentro del circuito: ${esc.productos.length}`,
    `Productos con problema activo (DECOMISO + DONACIÓN + URGENTE + RADAR): ${problemas.length}`,
    `Productos con acción inmediata (DECOMISO + DONACIÓN + URGENTE): ${accionInmediata.length}`,
    `Productos RADAR: ${radar.length}`,
    `Unidades expuestas en problemas activos: ${fmtUnidades(unidadesEnRiesgo)}`,
    `$ en riesgo a costo s/IVA: ${fmtPesos(dineroEnRiesgo)} | cobertura de costo ${valorizados.length}/${problemas.length} productos`,
    '',
    'PRIORIDADES NO EXCLUYENTES:',
    lineaPrioridad('Urgencia temporal', esc.prioridades.tiempo),
    lineaPrioridad('Intervención RAG que no responde', esc.prioridades.rag),
    lineaPrioridad('Mayor exposición económica', esc.prioridades.dinero),
    'No convertir estas tres dimensiones en un único ranking opaco. Explicar por qué cada caso importa.',
    '',
    'TOP DE RIESGO ECONÓMICO ACTUAL:',
    topEconomico.length ? topEconomico.join('\n') : 'Sin productos valorizados en riesgo.',
    '',
    `=== DETALLE DE VENCIMIENTOS ACTIVOS (${esc.productos.length}) ===`,
    esc.productos.length ? esc.productos.map(lineaProducto).join('\n\n') : '(sin vencimientos activos dentro del circuito)',
    '',
    '=== RESULTADO ECONÓMICO · VENTANAS EQUIVALENTES ===',
    `Ventana actual: ${fechaCorta(esc.ventana.inicioActual)} a ${fechaCorta(esc.hoy)} (${esc.ventana.dias} días calendario del trimestre).`,
    resumenPeriodo(`Actual Q${esc.ventana.trimestreActual} ${esc.ventana.anioActual} hasta hoy`, esc.actual),
    '',
    `Ventana previa equivalente: ${fechaCorta(esc.ventana.inicioAnterior)} a ${fechaCorta(esc.ventana.finAnterior)} (${esc.ventana.dias} días).`,
    resumenPeriodo(`Previo Q${esc.ventana.trimestreAnterior} ${esc.ventana.anioAnterior}, misma extensión temporal`, esc.anterior),
    '',
    comparacionHistorica,
    '',
    'Productos recurrentes ENTRE ambas ventanas equivalentes:',
    esc.recurrentes.length
      ? esc.recurrentes.map((p) => `- ${p}`).join('\n')
      : '- No hay recurrencia demostrable entre ambas ventanas con los datos comparables disponibles.',
    '',
    'Límite de inferencia: no confundir trimestre abierto con trimestre completo. No afirmar estacionalidad. Si no existe base comparable previa, describir únicamente el resultado actual y su composición.',
  ].join('\n')
}
