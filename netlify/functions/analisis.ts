import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from './_auth'

/**
 * analisis — genera un reporte en lenguaje natural (DeepSeek) sobre los
 * vencimientos del usuario. La clasificación y los cálculos son determinísticos;
 * el modelo sólo interpreta/prioriza los datos ya calculados.
 */

const SUCURSAL_LEGACY = '00000000-0000-0000-0000-000000000001'
const IDENTIDAD_REGLA = '- Siempre que nombre un artículo, identifíquelo como: Descripción — Marca | Gramaje: ... | Interno: ... | EAN: ...; no omita ninguno de esos datos aunque figure "Sin dato"'

const SYSTEM_OPERADOR = `Usted es un consultor especializado en gestión de vencimientos y control de pérdidas para comercios minoristas de alimentación.
Analiza datos actuales, históricos y seguimiento de acciones RAG para proporcionar recomendaciones constructivas y fundamentadas.

REGLAS:
- Utilice un tono formal y profesional en todo momento
- Base sus recomendaciones SIEMPRE en los cálculos determinísticos provistos
- La ventana comercial termina cuando el producto debe retirarse para DONACIÓN, no el día de vencimiento
- RAG significa Retiro Anticipado de Góndola y el porcentaje lo sugiere Glaciar
- NUNCA invente ni recomiende un porcentaje de descuento específico
- Si un RAG figura sin movimiento o insuficiente, indique que debe revisarse nuevamente en Glaciar
- Diferencie VMD histórica de Glaciar de velocidad observada por controles físicos del operador
- Identifique patrones históricos: productos que se repiten en donaciones o decomisos
- Compare el período actual con el anterior cuando haya datos disponibles
- Explique el razonamiento detrás de cada recomendación
${IDENTIDAD_REGLA}
- Máximo 350 palabras

Estructura del informe:
1. Situación actual (datos concretos de unidades en riesgo antes de donación)
2. Seguimiento RAG (qué acciones están funcionando y cuáles requieren revisión)
3. Análisis histórico (patrones detectados en trimestres anteriores)
4. Productos que requieren acción inmediata
5. Recomendaciones específicas y medibles sin inventar descuentos`

const SYSTEM_ADMIN = `Usted es un consultor estratégico especializado en gestión de pérdidas y vencimientos para cadenas de supermercados.
Analiza el desempeño operativo de la sucursal comparando riesgo actual, seguimiento RAG e histórico.

REGLAS:
- Utilice un tono formal y profesional en todo momento
- Base sus análisis en cálculos determinísticos y datos históricos provistos
- La ventana comercial termina en el umbral obligatorio de DONACIÓN del sector
- RAG significa Retiro Anticipado de Góndola y el porcentaje lo determina Glaciar
- NUNCA invente ni recomiende un porcentaje de descuento específico
- Destaque RAG sin movimiento o insuficientes y falta de seguimiento operativo
- Diferencie VMD histórica de Glaciar de velocidad observada por el operador
- Identifique tendencias entre trimestres y familias con problemas recurrentes
- Cuantifique el impacto en unidades cuando sea posible
${IDENTIDAD_REGLA}
- Máximo 450 palabras

Estructura del informe:
1. Estado general de la sucursal
2. Seguimiento RAG y productos que requieren nueva intervención
3. Comparativa trimestral
4. Familias con mayor riesgo estructural
5. Recomendaciones estratégicas con fundamento`

const UMBRAL_RADAR = 45
const UMBRAL_URGENTE = 20

function diasRestantes(fecha: string): number {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const v = new Date(fecha); v.setHours(0, 0, 0, 0)
  return Math.floor((v.getTime() - hoy.getTime()) / 86400000)
}

function diasComerciales(dias: number, diasDonacion: number): number {
  return Math.max(0, dias - diasDonacion)
}

function calcularNivel(dias: number, cantidad: number, venta: number, diasDonacion: number): string {
  if (dias <= 0) return 'decomiso'
  if (dias <= diasDonacion) return 'donacion'

  const disponibles = diasComerciales(dias, diasDonacion)
  const diasStock = venta <= 0 ? Infinity : cantidad / venta
  const hayRiesgo = diasStock > disponibles

  if (dias <= UMBRAL_URGENTE && hayRiesgo) return 'urgente'
  if (dias <= UMBRAL_RADAR && hayRiesgo) return 'radar'
  return 'seguro'
}

interface RiesgoCalc {
  unidadesVendiblesAntesRetiro: number
  unidadesEnRiesgo: number
  riesgoPorcentaje: number
  diasComercialesRestantes: number
  velocidadNecesaria: number
}

function calcularRiesgoComercial(
  cantidad: number,
  ventaMedia: number,
  dias: number,
  diasDonacion: number,
): RiesgoCalc {
  const comerciales = diasComerciales(dias, diasDonacion)
  const unidadesVendiblesAntesRetiro = ventaMedia * comerciales
  const unidadesEnRiesgo = Math.max(0, cantidad - unidadesVendiblesAntesRetiro)
  const riesgoPorcentaje = cantidad > 0 ? (unidadesEnRiesgo / cantidad) * 100 : 0
  const velocidadNecesaria = comerciales > 0 && cantidad > 0 ? cantidad / comerciales : Infinity

  return {
    unidadesVendiblesAntesRetiro,
    unidadesEnRiesgo,
    riesgoPorcentaje,
    diasComercialesRestantes: comerciales,
    velocidadNecesaria,
  }
}

function accionDeterministica(nivel: string): string {
  switch (nivel) {
    case 'decomiso': return 'Retirar inmediatamente y registrar decomiso'
    case 'donacion': return 'Retirar de venta y gestionar donación según política'
    case 'urgente': return 'Revisar RAG en Glaciar y controlar cantidad comprometida'
    case 'radar': return 'Gestionar RAG en Glaciar y monitorear cantidad comprometida'
    default: return 'Monitorear; la proyección actual llega antes de la ventana de donación'
  }
}

interface IdentidadArticulo {
  descripcion: string
  marca: string | null
  gramaje: string | null
  cod_art: string | null
  codigo_barras: string | null
}

function identidadArticulo(p: IdentidadArticulo | null | undefined): string {
  if (!p) return '(sin producto) — Sin dato | Gramaje: Sin dato | Interno: Sin dato | EAN: Sin dato'
  return `${p.descripcion} — ${p.marca?.trim() || 'Sin dato'} | Gramaje: ${p.gramaje?.trim() || 'Sin dato'} | Interno: ${p.cod_art?.trim() || 'Sin dato'} | EAN: ${p.codigo_barras?.trim() || 'Sin dato'}`
}

interface VencRow extends IdentidadArticulo {
  id: string
  cantidad: number
  fecha_vencimiento: string
  venta_media_diaria: number
  familia_id: string | null
  categoria: string | null
  sector_nombre: string | null
  dias_donacion: number | null
}

interface RagRow {
  vencimiento_id: string
  familia_id: string | null
  rag_porcentaje: number | null
  estado_seguimiento_rag: string
  velocidad_observada: number | null
  velocidad_necesaria: number | null
  cantidad_observada: number | null
  unidades_vendidas_observadas: number | null
}

interface AccionRow {
  tipo: string
  cantidad: number
  trimestre: number
  anio: number
  productos: (IdentidadArticulo & { familia_id: string | null }) | null
}

function getTrimestre(): { trimestre: number; anio: number } {
  const hoy = new Date()
  return { trimestre: Math.ceil((hoy.getMonth() + 1) / 3), anio: hoy.getFullYear() }
}

function resumirAcciones(acciones: AccionRow[], tipo: string) {
  const items = acciones.filter((a) => a.tipo === tipo)
  const total = items.reduce((s, a) => s + (a.cantidad ?? 0), 0)
  const porProducto = new Map<string, { cantidad: number; veces: number }>()
  for (const a of items) {
    const nombre = identidadArticulo(a.productos)
    const prev = porProducto.get(nombre) ?? { cantidad: 0, veces: 0 }
    porProducto.set(nombre, { cantidad: prev.cantidad + (a.cantidad ?? 0), veces: prev.veces + 1 })
  }
  return { total, registros: items.length, porProducto }
}

function topProductos(porProducto: Map<string, { cantidad: number; veces: number }>, n = 5) {
  return Array.from(porProducto.entries())
    .sort((a, b) => b[1].cantidad - a[1].cantidad)
    .slice(0, n)
}

function comparativa(actual: number, anterior: number): string {
  if (anterior === 0) return actual === 0 ? 'sin variación (0 en ambos)' : `+${actual} u (sin base previa)`
  const delta = actual - anterior
  const pct = ((delta / anterior) * 100).toFixed(0)
  const signo = delta > 0 ? '+' : ''
  return `${signo}${delta} u (${signo}${pct}% vs. período anterior)`
}

function fmtVelocidad(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v.toFixed(2)} u/día`
}

const ORDEN: Record<string, number> = { decomiso: 0, donacion: 1, urgente: 2, radar: 3, seguro: 4 }

const handler: Handler = async (event: HandlerEvent) => {
  const cors = getCorsHeaders(event)
  const json = (statusCode: number, payload: unknown) => ({
    statusCode,
    headers: { ...cors, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { success: false, error: 'Método no permitido' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const deepseekKey = process.env.DEEPSEEK_API_KEY

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !deepseekKey) {
    console.error('[analisis] Faltan variables de entorno')
    return json(500, { success: false, error: 'Config de servidor incompleta' })
  }

  const authHeader = event.headers['authorization'] ?? event.headers['Authorization'] ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return json(401, { success: false, error: 'No autorizado: token ausente' })

  let uid: string
  try {
    const ures = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    })
    if (!ures.ok) return json(401, { success: false, error: 'No autorizado: token inválido' })
    const ud = (await ures.json()) as { id?: string }
    if (!ud.id) return json(401, { success: false, error: 'No autorizado' })
    uid = ud.id
  } catch (e: unknown) {
    return json(502, { success: false, error: `Error al verificar token: ${(e as Error).message}` })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('rol, sucursal_id')
    .eq('id', uid)
    .maybeSingle()
  const rol = (perfil?.rol as string) ?? 'operador'
  const sucursalId = (perfil?.sucursal_id as string | null) ?? SUCURSAL_LEGACY
  const esAdmin = rol === 'admin'

  let familiaIds: string[] = []
  if (!esAdmin) {
    const { data: ufs } = await supabase
      .from('usuario_familias')
      .select('familia_id')
      .eq('usuario_id', uid)
    familiaIds = (ufs ?? []).map((u) => u.familia_id as string)
    if (familiaIds.length === 0) {
      return json(200, {
        success: true,
        analisis: 'Todavía no tenés familias asignadas, así que no hay datos para analizar. Pedile al administrador que te asigne tus sectores.',
        generado_en: new Date().toISOString(),
      })
    }
  }

  const { data: rows, error: vErr } = await supabase
    .from('v_vencimientos_operativos')
    .select('id, cantidad, fecha_vencimiento, descripcion, marca, gramaje, cod_art, codigo_barras, venta_media_diaria, familia_id, categoria, sector_nombre, dias_donacion')
    .eq('activo', true)
    .eq('sucursal_id', sucursalId)
  if (vErr) return json(502, { success: false, error: `Error al leer vencimientos: ${vErr.message}` })

  let vencs = ((rows ?? []) as unknown as VencRow[])
  if (!esAdmin) {
    vencs = vencs.filter((r) => r.familia_id !== null && familiaIds.includes(r.familia_id))
  }

  const famIds = Array.from(new Set(vencs.map((r) => r.familia_id).filter((x): x is string => !!x)))
  const famNombre = new Map<string, string>()
  if (famIds.length > 0) {
    const { data: fams } = await supabase.from('familias').select('id, nombre').in('id', famIds)
    for (const f of fams ?? []) famNombre.set(f.id as string, f.nombre as string)
  }

  const { data: ragRaw } = await supabase
    .from('v_seguimiento_rag_actual')
    .select('vencimiento_id, familia_id, rag_porcentaje, estado_seguimiento_rag, velocidad_observada, velocidad_necesaria, cantidad_observada, unidades_vendidas_observadas')
    .eq('sucursal_id', sucursalId)

  let rags = ((ragRaw ?? []) as unknown as RagRow[])
  if (!esAdmin) {
    rags = rags.filter((r) => r.familia_id !== null && familiaIds.includes(r.familia_id))
  }
  const ragPorVencimiento = new Map(rags.map((r) => [r.vencimiento_id, r]))

  const { trimestre: trimestreActual, anio: anioActual } = getTrimestre()
  const trimestreAnterior = trimestreActual === 1 ? 4 : trimestreActual - 1
  const anioAnterior = trimestreActual === 1 ? anioActual - 1 : anioActual

  const accionSelect = 'tipo, cantidad, trimestre, anio, productos(descripcion, marca, gramaje, cod_art, codigo_barras, familia_id)'
  const [{ data: accActualRaw }, { data: accAnteriorRaw }] = await Promise.all([
    supabase.from('acciones_operativas').select(accionSelect)
      .eq('sucursal_id', sucursalId).eq('trimestre', trimestreActual).eq('anio', anioActual),
    supabase.from('acciones_operativas').select(accionSelect)
      .eq('sucursal_id', sucursalId).eq('trimestre', trimestreAnterior).eq('anio', anioAnterior),
  ])

  const scope = (a: AccionRow) =>
    esAdmin || (a.productos?.familia_id != null && familiaIds.includes(a.productos.familia_id))
  const accActual = ((accActualRaw ?? []) as unknown as AccionRow[]).filter(scope)
  const accAnterior = ((accAnteriorRaw ?? []) as unknown as AccionRow[]).filter(scope)

  const donActual = resumirAcciones(accActual, 'donacion')
  const decActual = resumirAcciones(accActual, 'decomiso')
  const donAnterior = resumirAcciones(accAnterior, 'donacion')
  const decAnterior = resumirAcciones(accAnterior, 'decomiso')

  const patronMap = new Map<string, { tipo: string; producto: string; veces: number; cantidad: number }>()
  for (const a of [...accActual, ...accAnterior]) {
    const producto = identidadArticulo(a.productos)
    const key = `${a.tipo}::${producto}`
    const prev = patronMap.get(key) ?? { tipo: a.tipo, producto, veces: 0, cantidad: 0 }
    patronMap.set(key, { ...prev, veces: prev.veces + 1, cantidad: prev.cantidad + (a.cantidad ?? 0) })
  }
  const patronesRepetidos = Array.from(patronMap.values())
    .filter((p) => p.veces >= 2)
    .sort((a, b) => b.veces - a.veces || b.cantidad - a.cantidad)
    .slice(0, 8)

  // NULL significa sector fuera del circuito (Electro/Insumos u otro no
  // configurado). No inferir 10 días tampoco en el análisis IA.
  const procesados = vencs
    .filter((r): r is VencRow & { dias_donacion: number } => r.dias_donacion !== null)
    .map((r) => {
      const dias = diasRestantes(r.fecha_vencimiento)
      const umbral = r.dias_donacion
      const nivel = calcularNivel(dias, r.cantidad, r.venta_media_diaria, umbral)
      const riesgo = calcularRiesgoComercial(r.cantidad, r.venta_media_diaria, dias, umbral)
      const rag = ragPorVencimiento.get(r.id) ?? null
      return { ...r, dias, umbral, nivel, riesgo, rag }
    })
    .sort((a, b) => (ORDEN[a.nivel] - ORDEN[b.nivel]) || (a.dias - b.dias))
    .slice(0, 60)

  const hoyStr = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())
  const lineas = procesados.map((r) => {
    const fam = r.familia_id ? (famNombre.get(r.familia_id) ?? '—') : '—'
    const ventaStr = r.venta_media_diaria > 0 ? `${r.venta_media_diaria} u/día` : 'sin rotación'
    const vence = r.dias < 0 ? `vencido hace ${Math.abs(r.dias)} días` : r.dias === 0 ? 'vence hoy' : `vence en ${r.dias} días`
    const riesgo = r.riesgo
    const rag = r.rag

    const detallesRag = rag?.rag_porcentaje != null
      ? [
          `  RAG vigente: ${rag.rag_porcentaje}% (porcentaje registrado desde Glaciar, no recomendado por Noven)`,
          `  Estado seguimiento RAG: ${rag.estado_seguimiento_rag}`,
          `  Velocidad observada operador: ${fmtVelocidad(rag.velocidad_observada)}`,
          `  Velocidad necesaria actual: ${fmtVelocidad(rag.velocidad_necesaria)}`,
          rag.unidades_vendidas_observadas != null ? `  Reducción observada desde RAG: ${rag.unidades_vendidas_observadas} unidades` : null,
        ].filter(Boolean)
      : ['  RAG: sin intervención registrada']

    return [
      `Producto: ${identidadArticulo(r)}`,
      `  Familia: ${fam} | Sector: ${r.sector_nombre ?? '—'} | Nivel: ${r.nivel}`,
      `  ${vence} | Retiro para donación: ${r.umbral} días antes`,
      `  Días comerciales restantes: ${riesgo.diasComercialesRestantes}`,
      `  Cantidad comprometida: ${r.cantidad} unidades`,
      `  VMD histórica Glaciar: ${ventaStr}`,
      `  Velocidad necesaria para llegar antes de donación: ${fmtVelocidad(riesgo.velocidadNecesaria)}`,
      `  Vendibles a VMD actual antes del retiro: ${Math.round(riesgo.unidadesVendiblesAntesRetiro)}`,
      `  Unidades en riesgo de no venderse: ${Math.round(riesgo.unidadesEnRiesgo)} (${riesgo.riesgoPorcentaje.toFixed(1)}%)`,
      `  Acción determinística: ${accionDeterministica(r.nivel)}`,
      ...detallesRag,
    ].join('\n')
  })

  const fmtTop = (top: Array<[string, { cantidad: number; veces: number }]>) =>
    top.length > 0
      ? top.map(([n, v]) => `    · ${n}: ${v.cantidad} u (${v.veces} ${v.veces === 1 ? 'registro' : 'registros'})`).join('\n')
      : '    · (sin registros)'

  const bloqueTrimestre = (
    etiqueta: string,
    don: ReturnType<typeof resumirAcciones>,
    dec: ReturnType<typeof resumirAcciones>,
  ) =>
    [
      etiqueta,
      `- Donaciones: ${don.total} unidades en ${don.registros} registros`,
      fmtTop(topProductos(don.porProducto)),
      `- Decomisos: ${dec.total} unidades en ${dec.registros} registros`,
      fmtTop(topProductos(dec.porProducto)),
    ].join('\n')

  const bloquePatrones = patronesRepetidos.length > 0
    ? patronesRepetidos
        .map((p) => `- ${p.producto} — ${p.tipo} ${p.veces} veces (total ${p.cantidad} u) en el período analizado`)
        .join('\n')
    : '- No se detectaron productos repetidos entre los registros disponibles.'

  const datosFormateados = [
    `Fecha de hoy: ${hoyStr}`,
    `Ámbito: ${esAdmin ? 'toda la sucursal' : 'familias asignadas del operador'}`,
    '',
    `Vencimientos activos (${procesados.length}${vencs.length > procesados.length ? ` de ${vencs.length}` : ''}):`,
    lineas.length > 0 ? lineas.join('\n\n') : '(sin vencimientos activos)',
    '',
    '=== HISTÓRICO DE ACCIONES OPERATIVAS ===',
    '',
    bloqueTrimestre(`Trimestre ACTUAL (Q${trimestreActual} ${anioActual}):`, donActual, decActual),
    '',
    bloqueTrimestre(`Trimestre ANTERIOR (Q${trimestreAnterior} ${anioAnterior}):`, donAnterior, decAnterior),
    '',
    'Comparativa trimestral (actual vs. anterior):',
    `- Donaciones: ${comparativa(donActual.total, donAnterior.total)}`,
    `- Decomisos: ${comparativa(decActual.total, decAnterior.total)}`,
    '',
    'Patrones repetidos detectados (mismo producto en ≥2 registros):',
    bloquePatrones,
  ].join('\n')

  let analisis: string
  try {
    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: esAdmin ? SYSTEM_ADMIN : SYSTEM_OPERADOR },
          { role: 'user', content: datosFormateados },
        ],
        max_tokens: 1300,
        temperature: 0.3,
      }),
    })
    if (!dsRes.ok) {
      const errTxt = await dsRes.text().catch(() => '')
      console.error('[analisis] DeepSeek error', dsRes.status, errTxt)
      return json(502, { success: false, error: `Error del modelo de análisis (${dsRes.status})` })
    }
    const dsData = (await dsRes.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const contenido = dsData.choices?.[0]?.message?.content?.trim() ?? ''
    if (!contenido) return json(502, { success: false, error: 'El modelo no devolvió contenido' })
    return json(200, { success: true, analisis: contenido, generado_en: new Date().toISOString() })
  } catch (e: unknown) {
    return json(502, { success: false, error: `Error al contactar el modelo: ${(e as Error).message}` })
  }
}

export { handler }
