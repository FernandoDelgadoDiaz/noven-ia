import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from './_auth'
import { logServerError } from './_observability'
import { SYSTEM_ADMIN } from './_analisis_policy'

const UMBRAL_RADAR = 45
const UMBRAL_URGENTE = 20
const TZ_OPERATIVA = 'America/Argentina/Buenos_Aires'
const ENDPOINT = 'analisis'
const MS_DIA = 86_400_000

type RolAcceso = 'admin_organizacion' | 'gerente_zonal' | 'gerente_sucursal' | 'supervisor' | 'operador'

interface Body {
  sucursal_id?: string
}

interface AccesoRow {
  rol: RolAcceso
  zona_id: string | null
  sucursal_id: string | null
}

interface IdentidadArticulo {
  descripcion: string
  marca: string | null
  gramaje: string | null
  cod_art: string | null
  codigo_barras: string | null
}

interface VencRow extends IdentidadArticulo {
  id: string
  producto_id: string
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

interface CostoRow {
  producto_id: string
  costo_unitario: number | null
}

interface HistorialRow {
  tipo: string
  created_at: string
  producto_id: string
  producto_descripcion: string | null
  producto_marca: string | null
  producto_gramaje: string | null
  producto_cod_art: string | null
  producto_codigo_barras: string | null
  producto_familia_id: string | null
  unidades_recuperadas: number
  unidades_perdidas: number
  valor_recuperado_sin_iva: number | null
  valor_perdido_sin_iva: number | null
  resultado_ciclo_completo: boolean
  valorizacion_metodo: string | null
}

interface ResultadoPeriodo {
  recuperadas: number
  perdidas: number
  protegidos: number
  perdidosPesos: number
  donacion: number
  decomiso: number
  cierresRecuperadosSinCosto: number
  cierresPerdidosSinCosto: number
  ciclosIncompletos: number
  valorizacionesRetrospectivas: number
}

function fechaOperacionalYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_OPERATIVA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function fechaAEntero(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function ymdDesdeEntero(ms: number): string {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function sumarDiasYmd(ymd: string, dias: number): string {
  return ymdDesdeEntero(fechaAEntero(ymd) + dias * MS_DIA)
}

function diasRestantes(fechaVencimiento: string, hoyYmd: string): number {
  return Math.floor((fechaAEntero(fechaVencimiento) - fechaAEntero(hoyYmd)) / MS_DIA)
}

function trimestreOperacional(hoyYmd: string): { trimestre: number; anio: number } {
  const [anio, mes] = hoyYmd.split('-').map(Number)
  return { trimestre: Math.ceil(mes / 3), anio }
}

function inicioTrimestreYmd(anio: number, trimestre: number): string {
  const mes = (trimestre - 1) * 3 + 1
  return `${anio}-${String(mes).padStart(2, '0')}-01`
}

function isoInicioDiaArgentina(ymd: string): string {
  return `${ymd}T00:00:00-03:00`
}

function fechaCorta(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
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

function identidadArticulo(p: IdentidadArticulo | null | undefined): string {
  if (!p) return '(sin producto) — Sin dato | Gramaje: Sin dato | Interno: Sin dato | EAN: Sin dato'
  return `${p.descripcion} — ${p.marca?.trim() || 'Sin dato'} | Gramaje: ${p.gramaje?.trim() || 'Sin dato'} | Interno: ${p.cod_art?.trim() || 'Sin dato'} | EAN: ${p.codigo_barras?.trim() || 'Sin dato'}`
}

function identidadHistorial(row: HistorialRow): string {
  return identidadArticulo({
    descripcion: row.producto_descripcion?.trim() || 'Sin dato',
    marca: row.producto_marca,
    gramaje: row.producto_gramaje,
    cod_art: row.producto_cod_art,
    codigo_barras: row.producto_codigo_barras,
  })
}

function esRagInsuficiente(estado: string | null | undefined): boolean {
  return estado === 'insuficiente' || estado === 'sin_movimiento'
}

function accionDeterministica(nivel: string, estadoRag?: string | null): string {
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

function fmtVelocidad(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v.toFixed(2)} u/día`
}

function fmtUnidades(v: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(v)
}

function fmtPesos(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return 'sin costo disponible'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(v)
}

function resumirPeriodo(rows: HistorialRow[]): ResultadoPeriodo {
  const out: ResultadoPeriodo = {
    recuperadas: 0,
    perdidas: 0,
    protegidos: 0,
    perdidosPesos: 0,
    donacion: 0,
    decomiso: 0,
    cierresRecuperadosSinCosto: 0,
    cierresPerdidosSinCosto: 0,
    ciclosIncompletos: 0,
    valorizacionesRetrospectivas: 0,
  }

  for (const row of rows) {
    const recuperadas = Number(row.unidades_recuperadas) || 0
    const perdidas = Number(row.unidades_perdidas) || 0
    const valorRec = row.valor_recuperado_sin_iva == null ? null : Number(row.valor_recuperado_sin_iva)
    const valorPer = row.valor_perdido_sin_iva == null ? null : Number(row.valor_perdido_sin_iva)

    out.recuperadas += recuperadas
    out.perdidas += perdidas
    if (row.tipo === 'donacion') out.donacion += perdidas
    if (row.tipo === 'decomiso') out.decomiso += perdidas

    if (recuperadas > 0) {
      if (valorRec != null && Number.isFinite(valorRec)) out.protegidos += valorRec
      else out.cierresRecuperadosSinCosto += 1
    }
    if (perdidas > 0) {
      if (valorPer != null && Number.isFinite(valorPer)) out.perdidosPesos += valorPer
      else out.cierresPerdidosSinCosto += 1
    }
    if (!row.resultado_ciclo_completo) out.ciclosIncompletos += 1
    if (row.valorizacion_metodo === 'retrospectiva_0258') out.valorizacionesRetrospectivas += 1
  }

  return out
}

function comparativa(actual: number, anterior: number, unidad: 'u' | '$'): string {
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

function patronesEntrePeriodos(actual: HistorialRow[], anterior: HistorialRow[]): string[] {
  const mapaActual = new Map<string, { identidad: string; veces: number }>()
  const mapaAnterior = new Map<string, { identidad: string; veces: number }>()

  const agregar = (mapa: Map<string, { identidad: string; veces: number }>, row: HistorialRow) => {
    const clave = row.producto_id || row.producto_cod_art || identidadHistorial(row)
    const prev = mapa.get(clave)
    mapa.set(clave, { identidad: identidadHistorial(row), veces: (prev?.veces ?? 0) + 1 })
  }

  actual.forEach((row) => agregar(mapaActual, row))
  anterior.forEach((row) => agregar(mapaAnterior, row))

  return Array.from(mapaActual.entries())
    .filter(([clave]) => mapaAnterior.has(clave))
    .map(([clave, a]) => {
      const b = mapaAnterior.get(clave)!
      return `${a.identidad} — ${b.veces} cierre(s) en ventana previa y ${a.veces} en ventana actual`
    })
    .slice(0, 8)
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
    logServerError(event, { endpoint: ENDPOINT, operation: 'server_config', statusCode: 500, error: 'Configuración de servidor incompleta' })
    return json(500, { success: false, error: 'Configuración de servidor incompleta' })
  }

  const authHeader = event.headers.authorization ?? event.headers.Authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return json(401, { success: false, error: 'No autorizado: token ausente' })

  let uid = ''
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    })
    if (!res.ok) return json(401, { success: false, error: 'No autorizado: sesión inválida o expirada' })
    const user = await res.json() as { id?: string }
    uid = user.id ?? ''
    if (!uid) return json(401, { success: false, error: 'No autorizado' })
  } catch (err) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'session_verify', statusCode: 502, error: err })
    return json(502, { success: false, error: 'No se pudo validar la sesión.' })
  }

  let body: Body
  try {
    body = JSON.parse(event.body ?? '{}') as Body
  } catch {
    return json(400, { success: false, error: 'JSON inválido' })
  }
  const sucursalId = body.sucursal_id?.trim() ?? ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sucursalId)) {
    return json(400, { success: false, error: 'Seleccioná una sucursal válida para generar el análisis.' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })

  const [{ data: perfil, error: perfilError }, { data: sucursal, error: sucursalError }] = await Promise.all([
    supabase.from('usuarios').select('activo').eq('id', uid).maybeSingle(),
    supabase.from('sucursales').select('id, codigo, nombre, organizacion_id, zona_id, activa').eq('id', sucursalId).maybeSingle(),
  ])
  if (perfilError) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'load_profile', statusCode: 502, error: perfilError })
    return json(502, { success: false, error: 'No se pudo validar el perfil.' })
  }
  if (!perfil?.activo) return json(403, { success: false, error: 'La cuenta no está activa en Noven.' })
  if (sucursalError) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'load_store', statusCode: 502, error: sucursalError })
    return json(502, { success: false, error: 'No se pudo validar la sucursal.' })
  }
  if (!sucursal?.activa) return json(404, { success: false, error: 'La sucursal no existe o está inactiva.' })

  const { data: accesosRaw, error: accesosError } = await supabase
    .from('usuario_accesos')
    .select('rol, zona_id, sucursal_id')
    .eq('usuario_id', uid)
    .eq('organizacion_id', sucursal.organizacion_id)
    .eq('activo', true)
  if (accesosError) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'load_access_scope', statusCode: 502, error: accesosError })
    return json(502, { success: false, error: 'No se pudo validar el alcance.' })
  }

  const accesos = (accesosRaw ?? []) as AccesoRow[]
  // El análisis gerencial es una capacidad de conducción, no de operación:
  // gerente zonal de la zona de la sucursal, o gerente de sucursal / supervisor
  // de esa sucursal exacta. El operador no genera análisis.
  //
  // `admin_organizacion` tampoco habilita por sí solo: hace falta además uno de
  // esos roles, en línea con la decisión registrada en ai/decisions.md de no
  // convertirlo en un superusuario operativo.
  const alcanceGerencial = accesos.some((a) =>
    (a.rol === 'gerente_zonal' && a.zona_id === sucursal.zona_id)
    || ((a.rol === 'gerente_sucursal' || a.rol === 'supervisor') && a.sucursal_id === sucursalId),
  )
  if (!alcanceGerencial) {
    return json(403, {
      success: false,
      error: 'El análisis gerencial está disponible para gerentes y supervisores.',
    })
  }

  const { data: rows, error: vErr } = await supabase
    .from('v_vencimientos_operativos')
    .select('id, producto_id, cantidad, fecha_vencimiento, descripcion, marca, gramaje, cod_art, codigo_barras, venta_media_diaria, familia_id, categoria, sector_nombre, dias_donacion')
    .eq('activo', true)
    .eq('sucursal_id', sucursalId)
  if (vErr) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'load_expiries', statusCode: 502, error: vErr })
    return json(502, { success: false, error: 'No se pudieron leer los vencimientos.' })
  }

  const vencs = (rows ?? []) as unknown as VencRow[]

  const famIds = Array.from(new Set(vencs.map((r) => r.familia_id).filter((x): x is string => Boolean(x))))
  const famNombre = new Map<string, string>()
  if (famIds.length > 0) {
    const { data: fams, error: famsError } = await supabase
      .from('familias')
      .select('id, nombre')
      .eq('organizacion_id', sucursal.organizacion_id)
      .in('id', famIds)
    if (famsError) {
      logServerError(event, { endpoint: ENDPOINT, operation: 'load_family_names', statusCode: 502, error: famsError })
      return json(502, { success: false, error: 'No se pudieron cargar los nombres de familias.' })
    }
    for (const f of fams ?? []) famNombre.set(f.id as string, f.nombre as string)
  }

  const { data: ragRaw, error: ragError } = await supabase
    .from('v_seguimiento_rag_actual')
    .select('vencimiento_id, familia_id, rag_porcentaje, estado_seguimiento_rag, velocidad_observada, velocidad_necesaria, cantidad_observada, unidades_vendidas_observadas')
    .eq('sucursal_id', sucursalId)
  if (ragError) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'load_rag', statusCode: 502, error: ragError })
    return json(502, { success: false, error: 'No se pudo leer el seguimiento RAG.' })
  }
  const rags = (ragRaw ?? []) as unknown as RagRow[]
  const ragPorVencimiento = new Map(rags.map((r) => [r.vencimiento_id, r]))

  const productoIds = Array.from(new Set(vencs.map((r) => r.producto_id)))
  const costoPorProducto = new Map<string, number>()
  if (productoIds.length > 0) {
    const { data: costosRaw, error: costosError } = await supabase
      .from('producto_costo_ultima_observacion')
      .select('producto_id, costo_unitario')
      .in('producto_id', productoIds)
    if (costosError) {
      logServerError(event, { endpoint: ENDPOINT, operation: 'load_current_costs', statusCode: 502, error: costosError })
      return json(502, { success: false, error: 'No se pudo leer la valorización económica actual.' })
    }
    for (const row of (costosRaw ?? []) as unknown as CostoRow[]) {
      const costo = row.costo_unitario == null ? null : Number(row.costo_unitario)
      if (costo != null && Number.isFinite(costo)) costoPorProducto.set(row.producto_id, costo)
    }
  }

  const hoyYmd = fechaOperacionalYmd()
  const { trimestre: trimestreActual, anio: anioActual } = trimestreOperacional(hoyYmd)
  const trimestreAnterior = trimestreActual === 1 ? 4 : trimestreActual - 1
  const anioAnterior = trimestreActual === 1 ? anioActual - 1 : anioActual
  const inicioActualYmd = inicioTrimestreYmd(anioActual, trimestreActual)
  const inicioAnteriorYmd = inicioTrimestreYmd(anioAnterior, trimestreAnterior)
  const diasTranscurridos = Math.floor((fechaAEntero(hoyYmd) - fechaAEntero(inicioActualYmd)) / MS_DIA) + 1
  const finActualExclusivoYmd = sumarDiasYmd(hoyYmd, 1)
  const finAnteriorExclusivoYmd = sumarDiasYmd(inicioAnteriorYmd, diasTranscurridos)
  const finAnteriorInclusivoYmd = sumarDiasYmd(finAnteriorExclusivoYmd, -1)

  const historialSelect = [
    'tipo',
    'created_at',
    'producto_id',
    'producto_descripcion',
    'producto_marca',
    'producto_gramaje',
    'producto_cod_art',
    'producto_codigo_barras',
    'producto_familia_id',
    'unidades_recuperadas',
    'unidades_perdidas',
    'valor_recuperado_sin_iva',
    'valor_perdido_sin_iva',
    'resultado_ciclo_completo',
    'valorizacion_metodo',
  ].join(', ')

  const [{ data: histActualRaw, error: histActualError }, { data: histAnteriorRaw, error: histAnteriorError }] = await Promise.all([
    supabase
      .from('v_acciones_operativas_historial')
      .select(historialSelect)
      .eq('sucursal_id', sucursalId)
      .gte('created_at', isoInicioDiaArgentina(inicioActualYmd))
      .lt('created_at', isoInicioDiaArgentina(finActualExclusivoYmd)),
    supabase
      .from('v_acciones_operativas_historial')
      .select(historialSelect)
      .eq('sucursal_id', sucursalId)
      .gte('created_at', isoInicioDiaArgentina(inicioAnteriorYmd))
      .lt('created_at', isoInicioDiaArgentina(finAnteriorExclusivoYmd)),
  ])
  if (histActualError || histAnteriorError) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'load_economic_history', statusCode: 502, error: histActualError ?? histAnteriorError })
    return json(502, { success: false, error: 'No se pudo leer el historial económico.' })
  }

  const histActual = (histActualRaw ?? []) as unknown as HistorialRow[]
  const histAnterior = (histAnteriorRaw ?? []) as unknown as HistorialRow[]
  const resultadoActual = resumirPeriodo(histActual)
  const resultadoAnterior = resumirPeriodo(histAnterior)
  const baseComparable = histAnterior.length > 0
  const recurrentes = baseComparable ? patronesEntrePeriodos(histActual, histAnterior) : []

  const procesados = vencs
    .filter((r): r is VencRow & { dias_donacion: number } => r.dias_donacion != null)
    .map((r) => {
      const dias = diasRestantes(r.fecha_vencimiento, hoyYmd)
      const nivel = calcularNivel(dias, r.cantidad, r.venta_media_diaria, r.dias_donacion)
      const comerciales = diasComerciales(dias, r.dias_donacion)
      const vendibles = r.venta_media_diaria * comerciales
      const riesgoUnidades = Math.max(0, r.cantidad - vendibles)
      const velocidadNecesaria = comerciales > 0 && r.cantidad > 0 ? r.cantidad / comerciales : Infinity
      const costoUnitario = costoPorProducto.get(r.producto_id) ?? null
      const problemaActivo = nivel !== 'seguro'
      const dineroRiesgo = problemaActivo && costoUnitario != null ? riesgoUnidades * costoUnitario : null
      return {
        ...r,
        dias,
        nivel,
        comerciales,
        vendibles,
        riesgoUnidades,
        riesgoPorcentaje: r.cantidad > 0 ? (riesgoUnidades / r.cantidad) * 100 : 0,
        velocidadNecesaria,
        costoUnitario,
        dineroRiesgo,
        problemaActivo,
        rag: ragPorVencimiento.get(r.id) ?? null,
      }
    })
    .sort((a, b) => (ORDEN[a.nivel] - ORDEN[b.nivel]) || (a.dias - b.dias))
    .slice(0, 60)

  const problemas = procesados.filter((r) => r.problemaActivo)
  const accionInmediata = problemas.filter((r) => r.nivel === 'decomiso' || r.nivel === 'donacion' || r.nivel === 'urgente')
  const fallosRag = problemas.filter((r) => esRagInsuficiente(r.rag?.estado_seguimiento_rag))
  const unidadesEnRiesgo = problemas.reduce((sum, r) => sum + r.riesgoUnidades, 0)
  const valorizados = problemas.filter((r) => r.dineroRiesgo != null)
  const dineroEnRiesgo = valorizados.reduce((sum, r) => sum + (r.dineroRiesgo ?? 0), 0)
  const topEconomico = [...valorizados].sort((a, b) => (b.dineroRiesgo ?? 0) - (a.dineroRiesgo ?? 0)).slice(0, 5)
  const prioridadTiempo = accionInmediata[0] ?? null
  const prioridadRag = [...fallosRag].sort((a, b) => (b.dineroRiesgo ?? 0) - (a.dineroRiesgo ?? 0))[0] ?? null
  const prioridadDinero = topEconomico[0] ?? null

  const lineaPrioridad = (etiqueta: string, r: typeof procesados[number] | null) => {
    if (!r) return `${etiqueta}: sin caso aplicable.`
    return `${etiqueta}: ${identidadArticulo(r)} | Nivel ${r.nivel.toUpperCase()} | ${fmtUnidades(r.riesgoUnidades)} un. expuestas | ${fmtPesos(r.dineroRiesgo)} en riesgo | ${r.comerciales} días comerciales.`
  }

  const lineas = procesados.map((r) => {
    const fam = r.familia_id ? (famNombre.get(r.familia_id) ?? '—') : '—'
    const vence = r.dias < 0 ? `vencido hace ${Math.abs(r.dias)} días` : r.dias === 0 ? 'vence hoy' : `vence en ${r.dias} días`
    const rag = r.rag
    let ragInfo = 'Noven no tiene RAG registrado. Esto no informa el estado de Glaciar; verificar allí si la acción lo requiere.'
    if (rag?.rag_porcentaje != null) {
      const respuesta = esRagInsuficiente(rag.estado_seguimiento_rag)
        ? 'Respuesta insuficiente confirmada: control físico y revisar/escalar la intervención hoy.'
        : rag.estado_seguimiento_rag === 'pendiente_control_operador'
          ? 'Pendiente de control posterior por operador; no evaluar efectividad hasta contar con observación.'
          : 'Usar el estado observado para decidir seguimiento.'
      ragInfo = `RAG registrado en Noven: ${rag.rag_porcentaje}%. Estado: ${rag.estado_seguimiento_rag}. Velocidad observada: ${fmtVelocidad(rag.velocidad_observada)}. Velocidad necesaria: ${fmtVelocidad(rag.velocidad_necesaria)}. ${respuesta}`
    }

    const riesgoInfo = r.problemaActivo
      ? `En riesgo activo: ${fmtUnidades(r.riesgoUnidades)} un. (${r.riesgoPorcentaje.toFixed(1)}%) | Costo unitario s/IVA: ${fmtPesos(r.costoUnitario)} | Dinero en riesgo s/IVA: ${fmtPesos(r.dineroRiesgo)}`
      : 'Estado SEGURO: no integrar este artículo al total de riesgo activo ni indicar intervención extraordinaria.'

    return [
      `Producto: ${identidadArticulo(r)}`,
      `Familia: ${fam} | Sector: ${r.sector_nombre ?? '—'} | Nivel: ${r.nivel}`,
      `${vence} | Retiro para donación: ${r.dias_donacion} días antes | Días comerciales: ${r.comerciales}`,
      `Cantidad comprometida: ${r.cantidad} | VMD Glaciar: ${r.venta_media_diaria > 0 ? `${r.venta_media_diaria} u/día` : 'sin rotación'} | Velocidad necesaria: ${fmtVelocidad(r.velocidadNecesaria)}`,
      riesgoInfo,
      `Acción determinística: ${accionDeterministica(r.nivel, rag?.estado_seguimiento_rag)}`,
      ragInfo,
    ].join('\n  ')
  })

  const resumenPeriodo = (nombre: string, r: ResultadoPeriodo) => [
    nombre,
    `Unidades recuperadas por venta: ${fmtUnidades(r.recuperadas)}`,
    `$ protegidos/recuperados a costo s/IVA: ${fmtPesos(r.protegidos)}`,
    `Unidades perdidas: ${fmtUnidades(r.perdidas)} (donación ${fmtUnidades(r.donacion)} + decomiso ${fmtUnidades(r.decomiso)})`,
    `$ perdidos a costo s/IVA: ${fmtPesos(r.perdidosPesos)}`,
    `Cierres recuperados sin costo: ${r.cierresRecuperadosSinCosto} | cierres perdidos sin costo: ${r.cierresPerdidosSinCosto}`,
    `Ciclos con evidencia histórica incompleta: ${r.ciclosIncompletos} | valorizaciones retrospectivas: ${r.valorizacionesRetrospectivas}`,
  ].join('\n')

  const comparacionHistorica = baseComparable
    ? [
        'Base comparable previa: SÍ. Las dos ventanas tienen igual cantidad de días operativos de calendario.',
        `Comparación recuperadas: ${comparativa(resultadoActual.recuperadas, resultadoAnterior.recuperadas, 'u')}`,
        `Comparación protegidos: ${comparativa(resultadoActual.protegidos, resultadoAnterior.protegidos, '$')}`,
        `Comparación perdidas: ${comparativa(resultadoActual.perdidas, resultadoAnterior.perdidas, 'u')}`,
        `Comparación $ perdidos: ${comparativa(resultadoActual.perdidosPesos, resultadoAnterior.perdidosPesos, '$')}`,
      ].join('\n')
    : 'Base comparable previa: NO. No hay cierres registrados en la ventana equivalente anterior. Prohibido afirmar porcentajes de mejora/deterioro contra el trimestre anterior.'

  const hoyTexto = new Intl.DateTimeFormat('es-AR', {
    timeZone: TZ_OPERATIVA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date())

  const topEconomicoTexto = topEconomico.length
    ? topEconomico.map((r, i) => `${i + 1}. ${identidadArticulo(r)} | ${fmtUnidades(r.riesgoUnidades)} un. | ${fmtPesos(r.dineroRiesgo)} | nivel ${r.nivel}`).join('\n')
    : 'Sin productos valorizados en riesgo.'

  const datosFormateados = [
    `Fecha operacional: ${hoyTexto}`,
    `Sucursal analizada: ${sucursal.codigo} · ${sucursal.nombre}`,
    'Ámbito autorizado: toda la sucursal',
    '',
    '=== RESUMEN GERENCIAL DETERMINÍSTICO ===',
    `Vencimientos activos dentro del circuito: ${procesados.length}`,
    `Productos con problema activo (DECOMISO + DONACIÓN + URGENTE + RADAR): ${problemas.length}`,
    `Productos con acción inmediata (DECOMISO + DONACIÓN + URGENTE): ${accionInmediata.length}`,
    `Productos RADAR: ${problemas.filter((r) => r.nivel === 'radar').length}`,
    `Unidades expuestas en problemas activos: ${fmtUnidades(unidadesEnRiesgo)}`,
    `$ en riesgo a costo s/IVA: ${fmtPesos(dineroEnRiesgo)} | cobertura de costo ${valorizados.length}/${problemas.length} productos`,
    '',
    'PRIORIDADES NO EXCLUYENTES:',
    lineaPrioridad('Urgencia temporal', prioridadTiempo),
    lineaPrioridad('Intervención RAG que no responde', prioridadRag),
    lineaPrioridad('Mayor exposición económica', prioridadDinero),
    'No convertir estas tres dimensiones en un único ranking opaco. Explicar por qué cada caso importa.',
    '',
    'TOP DE RIESGO ECONÓMICO ACTUAL:',
    topEconomicoTexto,
    '',
    `=== DETALLE DE VENCIMIENTOS ACTIVOS (${procesados.length}) ===`,
    lineas.length ? lineas.join('\n\n') : '(sin vencimientos activos dentro del circuito)',
    '',
    '=== RESULTADO ECONÓMICO · VENTANAS EQUIVALENTES ===',
    `Ventana actual: ${fechaCorta(inicioActualYmd)} a ${fechaCorta(hoyYmd)} (${diasTranscurridos} días calendario del trimestre).`,
    resumenPeriodo(`Actual Q${trimestreActual} ${anioActual} hasta hoy`, resultadoActual),
    '',
    `Ventana previa equivalente: ${fechaCorta(inicioAnteriorYmd)} a ${fechaCorta(finAnteriorInclusivoYmd)} (${diasTranscurridos} días).`,
    resumenPeriodo(`Previo Q${trimestreAnterior} ${anioAnterior}, misma extensión temporal`, resultadoAnterior),
    '',
    comparacionHistorica,
    '',
    'Productos recurrentes ENTRE ambas ventanas equivalentes:',
    recurrentes.length ? recurrentes.map((p) => `- ${p}`).join('\n') : '- No hay recurrencia demostrable entre ambas ventanas con los datos comparables disponibles.',
    '',
    'Límite de inferencia: no confundir trimestre abierto con trimestre completo. No afirmar estacionalidad. Si no existe base comparable previa, describir únicamente el resultado actual y su composición.',
  ].join('\n')

  try {
    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_ADMIN },
          { role: 'user', content: datosFormateados },
        ],
        max_tokens: 1500,
        temperature: 0.2,
      }),
    })
    if (!dsRes.ok) {
      logServerError(event, {
        endpoint: ENDPOINT,
        operation: 'deepseek_http',
        statusCode: 502,
        error: { name: 'DeepSeekHttpError', code: String(dsRes.status), message: 'El proveedor devolvió un estado HTTP no exitoso' },
      })
      return json(502, { success: false, error: 'No se pudo completar el análisis con el modelo.' })
    }
    const dsData = await dsRes.json() as { choices?: Array<{ message?: { content?: string } }> }
    const contenido = dsData.choices?.[0]?.message?.content?.trim() ?? ''
    if (!contenido) {
      logServerError(event, { endpoint: ENDPOINT, operation: 'deepseek_empty', statusCode: 502, error: 'El modelo devolvió contenido vacío' })
      return json(502, { success: false, error: 'El modelo no devolvió contenido.' })
    }
    return json(200, {
      success: true,
      analisis: contenido,
      generado_en: new Date().toISOString(),
      sucursal_id: sucursalId,
      sucursal_codigo: sucursal.codigo,
    })
  } catch (err) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'deepseek_request', statusCode: 502, error: err })
    return json(502, { success: false, error: 'No se pudo contactar el modelo de análisis.' })
  }
}

export { handler }