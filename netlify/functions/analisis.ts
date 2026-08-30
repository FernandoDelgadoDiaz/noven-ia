import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from './_auth'
import { logServerError } from './_observability'
import { SYSTEM_ADMIN, SYSTEM_OPERADOR } from './_analisis_policy'

const UMBRAL_RADAR = 45
const UMBRAL_URGENTE = 20
const TZ_OPERATIVA = 'America/Argentina/Buenos_Aires'
const ENDPOINT = 'analisis'
const ESTADOS_RAG_INSUFICIENTES = new Set(['insuficiente', 'sin_movimiento'])

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
  costo_unitario: number | string | null
  observado_at: string | null
}

interface HistorialRow {
  tipo: string
  created_at: string
  producto_id: string
  producto_familia_id: string | null
  producto_descripcion: string | null
  producto_marca: string | null
  producto_gramaje: string | null
  producto_cod_art: string | null
  producto_codigo_barras: string | null
  unidades_recuperadas: number | string | null
  unidades_perdidas: number | string | null
  valor_recuperado_sin_iva: number | string | null
  valor_perdido_sin_iva: number | string | null
  resultado_ciclo_completo: boolean | null
  valorizacion_metodo: string | null
}

interface ResumenPeriodo {
  recuperadas: number
  perdidas: number
  protegidos: number
  perdidosPesos: number
  vendidos: number
  donaciones: number
  decomisos: number
  cierresSinCosto: number
  ciclosIncompletos: number
  valorizacionesRetrospectivas: number
}

interface Procesado extends VencRow {
  dias: number
  nivel: string
  comerciales: number
  vendibles: number
  riesgoUnidades: number
  riesgoPorcentaje: number
  velocidadNecesaria: number
  rag: RagRow | null
  costoUnitario: number | null
  dineroRiesgo: number | null
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

function enteroAFechaYmd(ms: number): string {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function sumarDiasYmd(ymd: string, dias: number): string {
  return enteroAFechaYmd(fechaAEntero(ymd) + dias * 86_400_000)
}

function diasEntreYmd(desde: string, hastaExclusivo: string): number {
  return Math.max(0, Math.round((fechaAEntero(hastaExclusivo) - fechaAEntero(desde)) / 86_400_000))
}

function diasRestantes(fechaVencimiento: string, hoyYmd: string): number {
  return Math.floor((fechaAEntero(fechaVencimiento) - fechaAEntero(hoyYmd)) / 86_400_000)
}

function trimestreOperacional(hoyYmd: string): { trimestre: number; anio: number } {
  const [anio, mes] = hoyYmd.split('-').map(Number)
  return { trimestre: Math.ceil(mes / 3), anio }
}

function inicioTrimestreYmd(hoyYmd: string): string {
  const [anio, mes] = hoyYmd.split('-').map(Number)
  const mesInicio = (Math.ceil(mes / 3) - 1) * 3 + 1
  return `${anio}-${String(mesInicio).padStart(2, '0')}-01`
}

function inicioTrimestreAnteriorYmd(hoyYmd: string): string {
  const actual = inicioTrimestreYmd(hoyYmd)
  const [anio, mes] = actual.split('-').map(Number)
  const d = new Date(Date.UTC(anio, mes - 4, 1))
  return enteroAFechaYmd(d.getTime())
}

function inicioDiaArgentinaIso(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 3, 0, 0)).toISOString()
}

function fmtFechaYmd(ymd: string): string {
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

function identidadHistorial(p: HistorialRow): string {
  return identidadArticulo({
    descripcion: p.producto_descripcion?.trim() || '(sin descripción)',
    marca: p.producto_marca,
    gramaje: p.producto_gramaje,
    cod_art: p.producto_cod_art,
    codigo_barras: p.producto_codigo_barras,
  })
}

function accionDeterministica(nivel: string, ragEstado: string | null): string {
  if (nivel === 'decomiso') return 'Retirar inmediatamente y registrar decomiso'
  if (nivel === 'donacion') return 'Retirar de venta y gestionar donación hoy según política'
  if (ESTADOS_RAG_INSUFICIENTES.has(ragEstado ?? '')) {
    return 'Control físico hoy y revisar/escalar la intervención en Glaciar; no esperar una revisión semanal'
  }
  if (nivel === 'urgente') return 'Revisar/aplicar RAG en Glaciar y controlar hoy; no donar antes del umbral obligatorio'
  if (nivel === 'radar') return 'Revisar/aplicar RAG en Glaciar cuando corresponda y monitorear cantidad comprometida'
  return 'Seguimiento normal; no indicar RAG obligatorio ni intervención extraordinaria'
}

function fmtVelocidad(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v.toFixed(2)} u/día`
}

function fmtUnidades(v: number): string {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)
}

function fmtPesos(v: number): string {
  return `$ ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)}`
}

function numero(v: number | string | null | undefined): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function resumirPeriodo(rows: HistorialRow[]): ResumenPeriodo {
  const resumen: ResumenPeriodo = {
    recuperadas: 0,
    perdidas: 0,
    protegidos: 0,
    perdidosPesos: 0,
    vendidos: 0,
    donaciones: 0,
    decomisos: 0,
    cierresSinCosto: 0,
    ciclosIncompletos: 0,
    valorizacionesRetrospectivas: 0,
  }

  for (const row of rows) {
    const recuperadas = numero(row.unidades_recuperadas)
    const perdidas = numero(row.unidades_perdidas)
    const valorRec = row.valor_recuperado_sin_iva == null ? null : numero(row.valor_recuperado_sin_iva)
    const valorPerd = row.valor_perdido_sin_iva == null ? null : numero(row.valor_perdido_sin_iva)

    resumen.recuperadas += recuperadas
    resumen.perdidas += perdidas
    if (valorRec != null) resumen.protegidos += valorRec
    if (valorPerd != null) resumen.perdidosPesos += valorPerd

    if (row.tipo === 'vendido') resumen.vendidos += recuperadas
    if (row.tipo === 'donacion') resumen.donaciones += perdidas
    if (row.tipo === 'decomiso') resumen.decomisos += perdidas

    if ((recuperadas > 0 && row.valor_recuperado_sin_iva == null) || (perdidas > 0 && row.valor_perdido_sin_iva == null)) {
      resumen.cierresSinCosto += 1
    }
    if (row.resultado_ciclo_completo === false) resumen.ciclosIncompletos += 1
    if (row.valorizacion_metodo === 'retrospectiva_0258') resumen.valorizacionesRetrospectivas += 1
  }

  return resumen
}

function comparativaEquivalente(actual: number, anterior: number, unidad: string): string {
  const delta = actual - anterior
  if (anterior === 0) {
    return actual === 0 ? `0 ${unidad} en ambas ventanas` : `${fmtUnidades(actual)} ${unidad} actuales; sin base previa equivalente`
  }
  const pct = (delta / anterior) * 100
  const signo = delta > 0 ? '+' : ''
  return `${signo}${fmtUnidades(delta)} ${unidad} (${signo}${pct.toFixed(0)}%)`
}

function claveProductoHistorial(row: HistorialRow): string {
  return row.producto_id || row.producto_cod_art || identidadHistorial(row)
}

function recurrenciasEntrePeriodos(actual: HistorialRow[], anterior: HistorialRow[]): string[] {
  const porActual = new Map<string, HistorialRow[]>()
  const porAnterior = new Map<string, HistorialRow[]>()

  for (const row of actual) {
    const key = claveProductoHistorial(row)
    porActual.set(key, [...(porActual.get(key) ?? []), row])
  }
  for (const row of anterior) {
    const key = claveProductoHistorial(row)
    porAnterior.set(key, [...(porAnterior.get(key) ?? []), row])
  }

  const comunes = Array.from(porActual.keys()).filter((key) => porAnterior.has(key))
  return comunes.slice(0, 8).map((key) => {
    const a = porActual.get(key) ?? []
    const b = porAnterior.get(key) ?? []
    const identidad = identidadHistorial(a[0] ?? b[0])
    const tiposActual = Array.from(new Set(a.map((r) => r.tipo))).join(', ')
    const tiposAnterior = Array.from(new Set(b.map((r) => r.tipo))).join(', ')
    return `${identidad} | período actual: ${tiposActual || '—'} | período anterior equivalente: ${tiposAnterior || '—'}`
  })
}

const ORDEN_OPERATIVO: Record<string, number> = { decomiso: 0, donacion: 1, urgente: 2, radar: 3, seguro: 4 }

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
  const scopeCompleto = accesos.some((a) =>
    (a.rol === 'gerente_zonal' && a.zona_id === sucursal.zona_id)
    || ((a.rol === 'gerente_sucursal' || a.rol === 'supervisor') && a.sucursal_id === sucursalId),
  )
  const esOperadorLocal = accesos.some((a) => a.rol === 'operador' && a.sucursal_id === sucursalId)
  if (!scopeCompleto && !esOperadorLocal) {
    return json(403, { success: false, error: 'No tenés acceso a la sucursal seleccionada.' })
  }

  let familiaIds: string[] = []
  if (!scopeCompleto) {
    const { data: familiasAsignadas, error: familiasError } = await supabase
      .from('usuario_familias_sucursal')
      .select('familia_id')
      .eq('usuario_id', uid)
      .eq('sucursal_id', sucursalId)
      .eq('activo', true)

    if (familiasError) {
      logServerError(event, { endpoint: ENDPOINT, operation: 'load_operator_families', statusCode: 502, error: familiasError })
      return json(502, { success: false, error: 'No se pudieron validar las familias.' })
    }

    familiaIds = (familiasAsignadas ?? []).map((r) => r.familia_id as string)
    if (familiaIds.length === 0) {
      return json(200, {
        success: true,
        analisis: 'Todavía no tenés familias asignadas en esta sucursal, así que no hay datos autorizados para analizar.',
        generado_en: new Date().toISOString(),
        sucursal_id: sucursalId,
      })
    }
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

  let vencs = (rows ?? []) as unknown as VencRow[]
  if (!scopeCompleto) vencs = vencs.filter((r) => r.familia_id != null && familiaIds.includes(r.familia_id))

  const famIds = Array.from(new Set(vencs.map((r) => r.familia_id).filter((x): x is string => Boolean(x))))
  const productoIds = Array.from(new Set(vencs.map((r) => r.producto_id)))
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

  let rags = (ragRaw ?? []) as unknown as RagRow[]
  if (!scopeCompleto) rags = rags.filter((r) => r.familia_id != null && familiaIds.includes(r.familia_id))
  const ragPorVencimiento = new Map(rags.map((r) => [r.vencimiento_id, r]))

  const costoPorProducto = new Map<string, number>()
  if (productoIds.length > 0) {
    const { data: costosRaw, error: costosError } = await supabase
      .from('producto_costo_ultima_observacion')
      .select('producto_id, costo_unitario, observado_at')
      .in('producto_id', productoIds)

    if (costosError) {
      logServerError(event, { endpoint: ENDPOINT, operation: 'load_current_costs', statusCode: 502, error: costosError })
      return json(502, { success: false, error: 'No se pudo valorizar el riesgo actual.' })
    }

    for (const c of (costosRaw ?? []) as unknown as CostoRow[]) {
      const costo = c.costo_unitario == null ? NaN : Number(c.costo_unitario)
      if (Number.isFinite(costo)) costoPorProducto.set(c.producto_id, costo)
    }
  }

  const hoyYmd = fechaOperacionalYmd()
  const { trimestre: trimestreActual, anio: anioActual } = trimestreOperacional(hoyYmd)
  const inicioActualYmd = inicioTrimestreYmd(hoyYmd)
  const finActualExclusivoYmd = sumarDiasYmd(hoyYmd, 1)
  const diasComparables = diasEntreYmd(inicioActualYmd, finActualExclusivoYmd)
  const inicioAnteriorYmd = inicioTrimestreAnteriorYmd(hoyYmd)
  const finAnteriorExclusivoYmd = sumarDiasYmd(inicioAnteriorYmd, diasComparables)
  const trimestreAnterior = trimestreActual === 1 ? 4 : trimestreActual - 1
  const anioAnterior = trimestreActual === 1 ? anioActual - 1 : anioActual

  const historialSelect = 'tipo, created_at, producto_id, producto_familia_id, producto_descripcion, producto_marca, producto_gramaje, producto_cod_art, producto_codigo_barras, unidades_recuperadas, unidades_perdidas, valor_recuperado_sin_iva, valor_perdido_sin_iva, resultado_ciclo_completo, valorizacion_metodo'
  const [{ data: histActualRaw, error: histActualError }, { data: histAnteriorRaw, error: histAnteriorError }] = await Promise.all([
    supabase
      .from('v_acciones_operativas_historial')
      .select(historialSelect)
      .eq('sucursal_id', sucursalId)
      .gte('created_at', inicioDiaArgentinaIso(inicioActualYmd))
      .lt('created_at', inicioDiaArgentinaIso(finActualExclusivoYmd)),
    supabase
      .from('v_acciones_operativas_historial')
      .select(historialSelect)
      .eq('sucursal_id', sucursalId)
      .gte('created_at', inicioDiaArgentinaIso(inicioAnteriorYmd))
      .lt('created_at', inicioDiaArgentinaIso(finAnteriorExclusivoYmd)),
  ])

  if (histActualError || histAnteriorError) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'load_economic_history', statusCode: 502, error: histActualError ?? histAnteriorError })
    return json(502, { success: false, error: 'No se pudo leer el historial económico comparable.' })
  }

  const filtrarHistorial = (row: HistorialRow) => scopeCompleto || (row.producto_familia_id != null && familiaIds.includes(row.producto_familia_id))
  const histActual = ((histActualRaw ?? []) as unknown as HistorialRow[]).filter(filtrarHistorial)
  const histAnterior = ((histAnteriorRaw ?? []) as unknown as HistorialRow[]).filter(filtrarHistorial)

  const resumenActual = resumirPeriodo(histActual)
  const resumenAnterior = resumirPeriodo(histAnterior)
  const recurrentes = recurrenciasEntrePeriodos(histActual, histAnterior)

  const procesados: Procesado[] = vencs
    .filter((r): r is VencRow & { dias_donacion: number } => r.dias_donacion != null)
    .map((r) => {
      const dias = diasRestantes(r.fecha_vencimiento, hoyYmd)
      const nivel = calcularNivel(dias, r.cantidad, r.venta_media_diaria, r.dias_donacion)
      const comerciales = diasComerciales(dias, r.dias_donacion)
      const vendibles = r.venta_media_diaria * comerciales
      const riesgoUnidades = Math.max(0, r.cantidad - vendibles)
      const velocidadNecesaria = comerciales > 0 && r.cantidad > 0 ? r.cantidad / comerciales : Infinity
      const costoUnitario = costoPorProducto.get(r.producto_id) ?? null
      const dineroRiesgo = costoUnitario == null ? null : riesgoUnidades * costoUnitario
      return {
        ...r,
        dias,
        nivel,
        comerciales,
        vendibles,
        riesgoUnidades,
        riesgoPorcentaje: r.cantidad > 0 ? (riesgoUnidades / r.cantidad) * 100 : 0,
        velocidadNecesaria,
        rag: ragPorVencimiento.get(r.id) ?? null,
        costoUnitario,
        dineroRiesgo,
      }
    })

  const enRiesgo = procesados.filter((r) => r.nivel !== 'seguro')
  const seguros = procesados.filter((r) => r.nivel === 'seguro')
  const unidadesEnRiesgo = enRiesgo.reduce((sum, r) => sum + r.riesgoUnidades, 0)
  const valorizados = enRiesgo.filter((r) => r.dineroRiesgo != null)
  const dineroEnRiesgo = valorizados.reduce((sum, r) => sum + (r.dineroRiesgo ?? 0), 0)

  const accionesHoy = [...enRiesgo]
    .filter((r) => ['decomiso', 'donacion', 'urgente'].includes(r.nivel) || ESTADOS_RAG_INSUFICIENTES.has(r.rag?.estado_seguimiento_rag ?? ''))
    .sort((a, b) => {
      const orden = (ORDEN_OPERATIVO[a.nivel] ?? 99) - (ORDEN_OPERATIVO[b.nivel] ?? 99)
      if (orden !== 0) return orden
      return (b.dineroRiesgo ?? -1) - (a.dineroRiesgo ?? -1)
    })

  const prioridadEconomica = [...enRiesgo]
    .filter((r) => r.dineroRiesgo != null)
    .sort((a, b) => (b.dineroRiesgo ?? 0) - (a.dineroRiesgo ?? 0))

  const revisionEconomicaHoy = prioridadEconomica.slice(0, 3)

  const lineaResumenProducto = (r: Procesado): string => {
    const fam = r.familia_id ? (famNombre.get(r.familia_id) ?? '—') : '—'
    const rag = r.rag
    const ragInfo = rag?.rag_porcentaje != null
      ? `RAG ${rag.rag_porcentaje}% registrado en Noven | estado ${rag.estado_seguimiento_rag} | velocidad observada ${fmtVelocidad(rag.velocidad_observada)} | requerida ${fmtVelocidad(rag.velocidad_necesaria)} | cantidad observada ${rag.cantidad_observada ?? '—'}`
      : 'Noven no tiene RAG registrado. Esto no informa el estado de Glaciar; verificar allí si la acción lo requiere.'
    const dinero = r.dineroRiesgo == null ? 'costo pendiente' : `${fmtPesos(r.dineroRiesgo)} a costo s/IVA`
    return [
      identidadArticulo(r),
      `Familia ${fam} | Sector ${r.sector_nombre ?? '—'} | Nivel ${r.nivel.toUpperCase()} | vence en ${r.dias} días | días comerciales ${r.comerciales}`,
      `Comprometido ${fmtUnidades(r.cantidad)} un | VMD Glaciar ${fmtUnidades(r.venta_media_diaria)} u/día | expuesto ${fmtUnidades(r.riesgoUnidades)} un (${r.riesgoPorcentaje.toFixed(1)}%) | ${dinero}`,
      `Velocidad necesaria ${fmtVelocidad(Number.isFinite(r.velocidadNecesaria) ? r.velocidadNecesaria : null)} | Acción determinística: ${accionDeterministica(r.nivel, rag?.estado_seguimiento_rag ?? null)}`,
      ragInfo,
    ].join('\n  ')
  }

  const accionesHoyTexto = accionesHoy.length
    ? accionesHoy.map((r, i) => `${i + 1}. ${identidadArticulo(r)} | ${r.nivel.toUpperCase()} | ${fmtUnidades(r.riesgoUnidades)} un expuestas | ${r.dineroRiesgo == null ? 'costo pendiente' : fmtPesos(r.dineroRiesgo)} | ${accionDeterministica(r.nivel, r.rag?.estado_seguimiento_rag ?? null)}`).join('\n')
    : 'Sin casos de acción inmediata ni RAG insuficiente confirmados.'

  const prioridadEconomicaTexto = prioridadEconomica.length
    ? prioridadEconomica.slice(0, 5).map((r, i) => `${i + 1}. ${identidadArticulo(r)} | ${fmtUnidades(r.riesgoUnidades)} un expuestas | ${fmtPesos(r.dineroRiesgo ?? 0)} | Nivel ${r.nivel.toUpperCase()} | RAG ${r.rag?.rag_porcentaje != null ? `${r.rag.rag_porcentaje}% (${r.rag.estado_seguimiento_rag})` : 'no registrado en Noven'}`).join('\n')
    : 'Sin productos valorizados en riesgo.'

  const revisionEconomicaTexto = revisionEconomicaHoy.length
    ? revisionEconomicaHoy.map((r) => `- ${identidadArticulo(r)} | revisión prioritaria hoy por exposición económica: ${fmtPesos(r.dineroRiesgo ?? 0)}; mantener nivel operativo ${r.nivel.toUpperCase()}.`).join('\n')
    : '- Sin revisión económica valorizada disponible.'

  const detalleRiesgo = enRiesgo.length
    ? enRiesgo
      .sort((a, b) => {
        const orden = (ORDEN_OPERATIVO[a.nivel] ?? 99) - (ORDEN_OPERATIVO[b.nivel] ?? 99)
        if (orden !== 0) return orden
        return (b.dineroRiesgo ?? -1) - (a.dineroRiesgo ?? -1)
      })
      .map(lineaResumenProducto)
      .join('\n\n')
    : '(sin productos en riesgo activo)'

  const cautelasHistoricas = [
    resumenActual.cierresSinCosto + resumenAnterior.cierresSinCosto > 0
      ? `Hay ${resumenActual.cierresSinCosto + resumenAnterior.cierresSinCosto} cierres sin valorización económica entre ambas ventanas.`
      : 'Todos los cierres con unidades de resultado tienen valorización económica disponible en estas ventanas.',
    resumenActual.ciclosIncompletos + resumenAnterior.ciclosIncompletos > 0
      ? `Hay ${resumenActual.ciclosIncompletos + resumenAnterior.ciclosIncompletos} ciclos históricos incompletos; no inventar recuperaciones faltantes.`
      : 'No se detectan ciclos incompletos en las ventanas consultadas.',
    resumenActual.valorizacionesRetrospectivas + resumenAnterior.valorizacionesRetrospectivas > 0
      ? `Hay ${resumenActual.valorizacionesRetrospectivas + resumenAnterior.valorizacionesRetrospectivas} cierres con valorización retrospectiva 0258; indicarlo al interpretar $ históricos.`
      : 'No hay valorizaciones retrospectivas en las ventanas consultadas.',
  ].join(' ')

  const hoyTexto = new Intl.DateTimeFormat('es-AR', {
    timeZone: TZ_OPERATIVA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date())

  const datosFormateados = [
    `Fecha operacional: ${hoyTexto}`,
    `Sucursal analizada: ${sucursal.codigo} · ${sucursal.nombre}`,
    `Ámbito autorizado: ${scopeCompleto ? 'toda la sucursal' : 'familias asignadas al operador en esta sucursal'}`,
    '',
    '=== ESTADO ACTUAL DETERMINÍSTICO ===',
    `Vencimientos activos dentro del circuito: ${procesados.length}. En riesgo operativo: ${enRiesgo.length}. Seguro: ${seguros.length}.`,
    `Unidades expuestas actuales: ${fmtUnidades(unidadesEnRiesgo)} un.`,
    `Dinero en riesgo valorizado: ${fmtPesos(dineroEnRiesgo)} a costo s/IVA. Cobertura de costo: ${valorizados.length}/${enRiesgo.length} productos en riesgo.`,
    'No confundir porcentaje relativo de riesgo con impacto económico absoluto.',
    '',
    '=== ACCIÓN OPERATIVA HOY ===',
    accionesHoyTexto,
    '',
    '=== PRIORIDAD ECONÓMICA ===',
    prioridadEconomicaTexto,
    '',
    'Los siguientes productos deben tener revisión prioritaria hoy por exposición económica, aunque sigan en RADAR. Esto no cambia su nivel operativo:',
    revisionEconomicaTexto,
    '',
    '=== DETALLE DE PRODUCTOS EN RIESGO ===',
    detalleRiesgo,
    '',
    '=== RESULTADOS ECONÓMICOS EN VENTANAS COMPARABLES ===',
    `Ventana actual equivalente: Q${trimestreActual} ${anioActual}, ${fmtFechaYmd(inicioActualYmd)} a ${fmtFechaYmd(hoyYmd)} (${diasComparables} días).`,
    `Ventana anterior equivalente: Q${trimestreAnterior} ${anioAnterior}, ${fmtFechaYmd(inicioAnteriorYmd)} a ${fmtFechaYmd(sumarDiasYmd(finAnteriorExclusivoYmd, -1))} (${diasComparables} días).`,
    'La comparación es entre ventanas de igual duración; NO comparar el trimestre abierto contra el trimestre anterior completo.',
    `Actual: recuperadas por venta ${fmtUnidades(resumenActual.recuperadas)} un | protegidos ${fmtPesos(resumenActual.protegidos)} | perdidas ${fmtUnidades(resumenActual.perdidas)} un | perdidos ${fmtPesos(resumenActual.perdidosPesos)} | donación ${fmtUnidades(resumenActual.donaciones)} un | decomiso ${fmtUnidades(resumenActual.decomisos)} un.`,
    `Anterior equivalente: recuperadas por venta ${fmtUnidades(resumenAnterior.recuperadas)} un | protegidos ${fmtPesos(resumenAnterior.protegidos)} | perdidas ${fmtUnidades(resumenAnterior.perdidas)} un | perdidos ${fmtPesos(resumenAnterior.perdidosPesos)} | donación ${fmtUnidades(resumenAnterior.donaciones)} un | decomiso ${fmtUnidades(resumenAnterior.decomisos)} un.`,
    `Variación equivalente de unidades recuperadas: ${comparativaEquivalente(resumenActual.recuperadas, resumenAnterior.recuperadas, 'un')}.`,
    `Variación equivalente de unidades perdidas: ${comparativaEquivalente(resumenActual.perdidas, resumenAnterior.perdidas, 'un')}.`,
    `Variación equivalente de $ protegidos: ${comparativaEquivalente(resumenActual.protegidos, resumenAnterior.protegidos, '$')}.`,
    `Variación equivalente de $ perdidos: ${comparativaEquivalente(resumenActual.perdidosPesos, resumenAnterior.perdidosPesos, '$')}.`,
    `Cautelas de evidencia histórica: ${cautelasHistoricas}`,
    '',
    'Recurrencia demostrable entre ambas ventanas equivalentes:',
    recurrentes.length ? recurrentes.map((r) => `- ${r}`).join('\n') : '- No se detectaron productos presentes en ambos períodos equivalentes.',
    '',
    'Límite de inferencia: No afirmar estacionalidad. No afirmar mejora neta sólo porque bajó una clase de pérdida. Evaluar recuperado/protegido, perdido, dinero y mezcla donación/decomiso.',
  ].join('\n')

  try {
    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: scopeCompleto ? SYSTEM_ADMIN : SYSTEM_OPERADOR },
          { role: 'user', content: datosFormateados },
        ],
        max_tokens: 1600,
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
