import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders, logServerError, serverErrorPayload } from './_auth'
import { SYSTEM_ADMIN, SYSTEM_OPERADOR } from './_analisis_policy'

const UMBRAL_RADAR = 45
const UMBRAL_URGENTE = 20
const TZ_OPERATIVA = 'America/Argentina/Buenos_Aires'

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

function diasRestantes(fechaVencimiento: string, hoyYmd: string): number {
  return Math.floor((fechaAEntero(fechaVencimiento) - fechaAEntero(hoyYmd)) / 86_400_000)
}

function trimestreOperacional(hoyYmd: string): { trimestre: number; anio: number } {
  const [anio, mes] = hoyYmd.split('-').map(Number)
  return { trimestre: Math.ceil(mes / 3), anio }
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

function accionDeterministica(nivel: string): string {
  switch (nivel) {
    case 'decomiso': return 'Retirar inmediatamente y registrar decomiso'
    case 'donacion': return 'Retirar de venta y gestionar donación hoy según política'
    case 'urgente': return 'Revisar/aplicar RAG en Glaciar y controlar estrechamente; no donar antes del umbral obligatorio'
    case 'radar': return 'Revisar/aplicar RAG en Glaciar cuando corresponda y monitorear cantidad comprometida'
    default: return 'Seguimiento normal; no indicar RAG obligatorio ni intervención extraordinaria'
  }
}

function fmtVelocidad(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v.toFixed(2)} u/día`
}

function resumirAcciones(acciones: AccionRow[], tipo: string) {
  const items = acciones.filter((a) => a.tipo === tipo)
  const total = items.reduce((s, a) => s + Number(a.cantidad ?? 0), 0)
  const porProducto = new Map<string, { cantidad: number; veces: number }>()
  for (const a of items) {
    const nombre = identidadArticulo(a.productos)
    const prev = porProducto.get(nombre) ?? { cantidad: 0, veces: 0 }
    porProducto.set(nombre, { cantidad: prev.cantidad + Number(a.cantidad ?? 0), veces: prev.veces + 1 })
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
    return json(500, serverErrorPayload(event, 'Configuración de servidor incompleta'))
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
    logServerError(event, 'analisis', 'auth_verify_failed', err)
    return json(502, serverErrorPayload(event, 'No se pudo validar la sesión.'))
  }

  let body: Body
  try {
    body = JSON.parse(event.body ?? '{}') as Body
  } catch {
    return json(400, { success: false, error: 'JSON inválido' })
  }
  const sucursalId = body.sucursal_id?.trim() ?? ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sucursalId)) {
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
    logServerError(event, 'analisis', 'perfil_read_failed', perfilError)
    return json(502, serverErrorPayload(event, 'No se pudo validar el perfil.'))
  }
  if (!perfil?.activo) return json(403, { success: false, error: 'La cuenta no está activa en Noven.' })
  if (sucursalError) {
    logServerError(event, 'analisis', 'sucursal_read_failed', sucursalError)
    return json(502, serverErrorPayload(event, 'No se pudo validar la sucursal.'))
  }
  if (!sucursal?.activa) return json(404, { success: false, error: 'La sucursal no existe o está inactiva.' })

  const { data: accesosRaw, error: accesosError } = await supabase
    .from('usuario_accesos')
    .select('rol, zona_id, sucursal_id')
    .eq('usuario_id', uid)
    .eq('organizacion_id', sucursal.organizacion_id)
    .eq('activo', true)
  if (accesosError) {
    logServerError(event, 'analisis', 'accesos_read_failed', accesosError)
    return json(502, serverErrorPayload(event, 'No se pudo validar el alcance.'))
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
      logServerError(event, 'analisis', 'familias_read_failed', familiasError)
      return json(502, serverErrorPayload(event, 'No se pudieron validar las familias.'))
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
    .select('id, cantidad, fecha_vencimiento, descripcion, marca, gramaje, cod_art, codigo_barras, venta_media_diaria, familia_id, categoria, sector_nombre, dias_donacion')
    .eq('activo', true)
    .eq('sucursal_id', sucursalId)
  if (vErr) {
    logServerError(event, 'analisis', 'vencimientos_read_failed', vErr)
    return json(502, serverErrorPayload(event, 'No se pudieron leer los vencimientos.'))
  }

  let vencs = (rows ?? []) as unknown as VencRow[]
  if (!scopeCompleto) vencs = vencs.filter((r) => r.familia_id != null && familiaIds.includes(r.familia_id))

  const famIds = Array.from(new Set(vencs.map((r) => r.familia_id).filter((x): x is string => Boolean(x))))
  const famNombre = new Map<string, string>()
  if (famIds.length > 0) {
    const { data: fams } = await supabase
      .from('familias')
      .select('id, nombre')
      .eq('organizacion_id', sucursal.organizacion_id)
      .in('id', famIds)
    for (const f of fams ?? []) famNombre.set(f.id as string, f.nombre as string)
  }

  const { data: ragRaw, error: ragError } = await supabase
    .from('v_seguimiento_rag_actual')
    .select('vencimiento_id, familia_id, rag_porcentaje, estado_seguimiento_rag, velocidad_observada, velocidad_necesaria, cantidad_observada, unidades_vendidas_observadas')
    .eq('sucursal_id', sucursalId)
  if (ragError) {
    logServerError(event, 'analisis', 'rag_read_failed', ragError)
    return json(502, serverErrorPayload(event, 'No se pudo leer el seguimiento RAG.'))
  }
  let rags = (ragRaw ?? []) as unknown as RagRow[]
  if (!scopeCompleto) rags = rags.filter((r) => r.familia_id != null && familiaIds.includes(r.familia_id))
  const ragPorVencimiento = new Map(rags.map((r) => [r.vencimiento_id, r]))

  const hoyYmd = fechaOperacionalYmd()
  const { trimestre: trimestreActual, anio: anioActual } = trimestreOperacional(hoyYmd)
  const trimestreAnterior = trimestreActual === 1 ? 4 : trimestreActual - 1
  const anioAnterior = trimestreActual === 1 ? anioActual - 1 : anioActual

  const accionSelect = 'tipo, cantidad, trimestre, anio, productos(descripcion, marca, gramaje, cod_art, codigo_barras, familia_id)'
  const [{ data: accActualRaw, error: accActualError }, { data: accAnteriorRaw, error: accAnteriorError }] = await Promise.all([
    supabase.from('acciones_operativas').select(accionSelect).eq('sucursal_id', sucursalId).eq('trimestre', trimestreActual).eq('anio', anioActual),
    supabase.from('acciones_operativas').select(accionSelect).eq('sucursal_id', sucursalId).eq('trimestre', trimestreAnterior).eq('anio', anioAnterior),
  ])
  if (accActualError || accAnteriorError) {
    const historyError = accActualError ?? accAnteriorError
    logServerError(event, 'analisis', 'historial_read_failed', historyError)
    return json(502, serverErrorPayload(event, 'No se pudo leer el historial operativo.'))
  }

  const filtrarAccion = (a: AccionRow) => scopeCompleto || (a.productos?.familia_id != null && familiaIds.includes(a.productos.familia_id))
  const accActual = ((accActualRaw ?? []) as unknown as AccionRow[]).filter(filtrarAccion)
  const accAnterior = ((accAnteriorRaw ?? []) as unknown as AccionRow[]).filter(filtrarAccion)

  const donActual = resumirAcciones(accActual, 'donacion')
  const decActual = resumirAcciones(accActual, 'decomiso')
  const donAnterior = resumirAcciones(accAnterior, 'donacion')
  const decAnterior = resumirAcciones(accAnterior, 'decomiso')
  const terminalActual = donActual.total + decActual.total
  const terminalAnterior = donAnterior.total + decAnterior.total

  const patronMap = new Map<string, { tipo: string; producto: string; veces: number; cantidad: number }>()
  for (const a of [...accActual, ...accAnterior]) {
    const producto = identidadArticulo(a.productos)
    const key = `${a.tipo}::${producto}`
    const prev = patronMap.get(key) ?? { tipo: a.tipo, producto, veces: 0, cantidad: 0 }
    patronMap.set(key, { ...prev, veces: prev.veces + 1, cantidad: prev.cantidad + Number(a.cantidad ?? 0) })
  }
  const patronesRepetidos = Array.from(patronMap.values())
    .filter((p) => p.veces >= 2)
    .sort((a, b) => b.veces - a.veces || b.cantidad - a.cantidad)
    .slice(0, 8)

  const procesados = vencs
    .filter((r): r is VencRow & { dias_donacion: number } => r.dias_donacion != null)
    .map((r) => {
      const dias = diasRestantes(r.fecha_vencimiento, hoyYmd)
      const nivel = calcularNivel(dias, r.cantidad, r.venta_media_diaria, r.dias_donacion)
      const comerciales = diasComerciales(dias, r.dias_donacion)
      const vendibles = r.venta_media_diaria * comerciales
      const riesgoUnidades = Math.max(0, r.cantidad - vendibles)
      const velocidadNecesaria = comerciales > 0 && r.cantidad > 0 ? r.cantidad / comerciales : Infinity
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
      }
    })
    .sort((a, b) => (ORDEN[a.nivel] - ORDEN[b.nivel]) || (a.dias - b.dias))
    .slice(0, 60)

  const lineas = procesados.map((r) => {
    const fam = r.familia_id ? (famNombre.get(r.familia_id) ?? '—') : '—'
    const vence = r.dias < 0 ? `vencido hace ${Math.abs(r.dias)} días` : r.dias === 0 ? 'vence hoy' : `vence en ${r.dias} días`
    const rag = r.rag
    const ragInfo = rag?.rag_porcentaje != null
      ? `RAG registrado en Noven: ${rag.rag_porcentaje}%. Estado: ${rag.estado_seguimiento_rag}. Velocidad observada: ${fmtVelocidad(rag.velocidad_observada)}. Velocidad necesaria: ${fmtVelocidad(rag.velocidad_necesaria)}.`
      : 'Noven no tiene RAG registrado. Esto no informa el estado de Glaciar; verificar allí si la acción lo requiere.'
    return [
      `Producto: ${identidadArticulo(r)}`,
      `Familia: ${fam} | Sector: ${r.sector_nombre ?? '—'} | Nivel: ${r.nivel}`,
      `${vence} | Retiro para donación: ${r.dias_donacion} días antes | Días comerciales: ${r.comerciales}`,
      `Cantidad comprometida: ${r.cantidad} | VMD Glaciar: ${r.venta_media_diaria > 0 ? `${r.venta_media_diaria} u/día` : 'sin rotación'}`,
      `Velocidad necesaria: ${fmtVelocidad(r.velocidadNecesaria)} | Vendibles antes del retiro: ${Math.round(r.vendibles)} | En riesgo: ${Math.round(r.riesgoUnidades)} (${r.riesgoPorcentaje.toFixed(1)}%)`,
      `Acción determinística: ${accionDeterministica(r.nivel)}`,
      ragInfo,
    ].join('\n  ')
  })

  const fmtTop = (top: Array<[string, { cantidad: number; veces: number }]>) => top.length
    ? top.map(([n, v]) => `· ${n}: ${v.cantidad} u (${v.veces} ${v.veces === 1 ? 'registro' : 'registros'})`).join('\n')
    : '· Sin registros'

  const bloqueTrimestre = (etiqueta: string, don: ReturnType<typeof resumirAcciones>, dec: ReturnType<typeof resumirAcciones>) => [
    etiqueta,
    `Donaciones: ${don.total} unidades en ${don.registros} registros`,
    fmtTop(topProductos(don.porProducto)),
    `Decomisos: ${dec.total} unidades en ${dec.registros} registros`,
    fmtTop(topProductos(dec.porProducto)),
    `Resultado terminal total (donación + decomiso): ${don.total + dec.total} unidades`,
  ].join('\n')

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
    `Vencimientos activos dentro del circuito (${procesados.length}):`,
    lineas.length ? lineas.join('\n\n') : '(sin vencimientos activos dentro del circuito)',
    '',
    '=== HISTÓRICO DE ACCIONES OPERATIVAS ===',
    bloqueTrimestre(`Trimestre ACTUAL (Q${trimestreActual} ${anioActual})`, donActual, decActual),
    '',
    bloqueTrimestre(`Trimestre ANTERIOR (Q${trimestreAnterior} ${anioAnterior})`, donAnterior, decAnterior),
    '',
    `Comparativa donaciones: ${comparativa(donActual.total, donAnterior.total)}`,
    `Comparativa decomisos: ${comparativa(decActual.total, decAnterior.total)}`,
    `Comparativa terminal combinada: ${comparativa(terminalActual, terminalAnterior)}`,
    'Una baja de donaciones no es por sí sola una mejora: evaluar junto con decomisos y total terminal.',
    '',
    'Patrones repetidos:',
    patronesRepetidos.length
      ? patronesRepetidos.map((p) => `- ${p.producto} — ${p.tipo} ${p.veces} veces (${p.cantidad} u)`).join('\n')
      : '- No se detectaron productos repetidos en los dos trimestres disponibles.',
    '',
    'Límite de inferencia: sólo hay dos trimestres comparables. No afirmar estacionalidad; hablar únicamente de recurrencia o concentración observada.',
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
        max_tokens: 1300,
        temperature: 0.2,
      }),
    })
    if (!dsRes.ok) {
      logServerError(event, 'analisis', 'model_http_failed', new Error(`HTTP ${dsRes.status}`), { provider_status: dsRes.status })
      return json(502, serverErrorPayload(event, `Error del modelo de análisis (${dsRes.status})`))
    }
    const dsData = await dsRes.json() as { choices?: Array<{ message?: { content?: string } }> }
    const contenido = dsData.choices?.[0]?.message?.content?.trim() ?? ''
    if (!contenido) {
      logServerError(event, 'analisis', 'model_empty_response', new Error('empty model response'))
      return json(502, serverErrorPayload(event, 'El modelo no devolvió contenido'))
    }
    return json(200, {
      success: true,
      analisis: contenido,
      generado_en: new Date().toISOString(),
      sucursal_id: sucursalId,
      sucursal_codigo: sucursal.codigo,
    })
  } catch (err) {
    logServerError(event, 'analisis', 'model_request_failed', err)
    return json(502, serverErrorPayload(event, 'Error al contactar el modelo.'))
  }
}

export { handler }