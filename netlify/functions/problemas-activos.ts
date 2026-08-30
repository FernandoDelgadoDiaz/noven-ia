import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from './_auth'
import { logServerError } from './_observability'

const ENDPOINT = 'problemas-activos'
const TZ_OPERATIVA = 'America/Argentina/Buenos_Aires'
const UMBRAL_RADAR = 45
const UMBRAL_URGENTE = 20

type Nivel = 'decomiso' | 'donacion' | 'urgente' | 'radar' | 'seguro'
type EstadoProblema =
  | 'requiere_cierre'
  | 'escalado_sin_respuesta'
  | 'requiere_revision'
  | 'requiere_intervencion'
  | 'intervencion_aplicada'
  | 'bajo_control'
  | 'dato_a_revisar'

interface Body { sucursalId?: string }

interface VencimientoVisibleRow {
  id: string
  producto_id: string
  cantidad: number
  fecha_vencimiento: string
  venta_media_diaria: number
  dias_donacion: number | null
  descripcion: string
  cod_art: string
  marca: string | null
  familia_id: string | null
}

interface SeguimientoRow {
  vencimiento_id: string
  rag_id: string | null
  rag_porcentaje: number | null
  rag_aplicado_at: string | null
  observada_at: string | null
  cantidad_actual_estimacion: number | null
  velocidad_observada: number | null
  velocidad_necesaria: number | null
  estado_seguimiento_rag: string
}

interface CostoRow { producto_id: string; costo_unitario: number | null }

interface EscalamientoRow {
  id: string
  vencimiento_id: string
  rag_id: string
  observacion_id: number
  estado_seguimiento: string
  detectado_at: string
  respondido_at: string | null
  respondido_por: string | null
  respuesta_tipo: string | null
  push_procesado_at: string | null
  push_destinatarios: number | null
  push_enviados: number | null
}

function hoyOperativoYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_OPERATIVA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function fechaMs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function calcularNivel(fechaVencimiento: string, cantidad: number, vmd: number, diasDonacion: number, hoy: string): {
  nivel: Nivel
  dias: number
  diasComerciales: number
  unidadesExpuestas: number
} {
  const dias = Math.floor((fechaMs(fechaVencimiento) - fechaMs(hoy)) / 86_400_000)
  const diasComerciales = Math.max(dias - diasDonacion, 0)
  const vendibles = Math.max(vmd, 0) * diasComerciales
  const unidadesExpuestas = Math.max(cantidad - vendibles, 0)

  if (dias <= 0) return { nivel: 'decomiso', dias, diasComerciales, unidadesExpuestas: Math.max(cantidad, 0) }
  if (dias <= diasDonacion) return { nivel: 'donacion', dias, diasComerciales, unidadesExpuestas: Math.max(cantidad, 0) }

  const diasStock = vmd <= 0 ? Infinity : cantidad / vmd
  const hayRiesgo = diasStock > diasComerciales
  if (dias <= UMBRAL_URGENTE && hayRiesgo) return { nivel: 'urgente', dias, diasComerciales, unidadesExpuestas }
  if (dias <= UMBRAL_RADAR && hayRiesgo) return { nivel: 'radar', dias, diasComerciales, unidadesExpuestas }
  return { nivel: 'seguro', dias, diasComerciales, unidadesExpuestas: 0 }
}

function resolverEstado(
  nivel: Nivel,
  seguimiento: SeguimientoRow | null,
  escalamientoAbierto: EscalamientoRow | null,
): EstadoProblema {
  if (nivel === 'decomiso' || nivel === 'donacion') return 'requiere_cierre'

  const estadoRag = seguimiento?.estado_seguimiento_rag ?? 'sin_rag'
  if (estadoRag === 'sin_movimiento' || estadoRag === 'insuficiente') {
    return escalamientoAbierto ? 'escalado_sin_respuesta' : 'requiere_revision'
  }
  if (estadoRag === 'dato_a_revisar') return 'dato_a_revisar'
  if (estadoRag === 'pendiente_control_operador') return 'intervencion_aplicada'
  if (estadoRag === 'efectivo' || estadoRag === 'efectivo_por_vmd') return 'bajo_control'
  return 'requiere_intervencion'
}

function motivoPrioridad(nivel: Nivel, estado: EstadoProblema): string {
  if (estado === 'requiere_cierre') return nivel === 'decomiso' ? 'Decomiso pendiente de cierre' : 'Donación pendiente de cierre'
  if (estado === 'escalado_sin_respuesta') return 'RAG insuficiente: escalado y todavía sin respuesta posterior'
  if (estado === 'requiere_revision') return 'RAG insuficiente: revisar y escalar en el día'
  if (estado === 'dato_a_revisar') return 'Control inconsistente: cantidad aumentó'
  if (estado === 'requiere_intervencion') {
    return nivel === 'urgente'
      ? 'Urgente sin RAG registrado en Noven: verificar en Glaciar hoy'
      : 'Riesgo activo sin RAG registrado en Noven: verificar en Glaciar'
  }
  if (estado === 'intervencion_aplicada') {
    return nivel === 'urgente'
      ? 'Urgente con intervención aplicada: falta control posterior'
      : 'Intervención aplicada: falta control posterior'
  }
  if (estado === 'bajo_control') {
    return nivel === 'urgente'
      ? 'Urgencia temporal bajo control: mantener seguimiento'
      : 'Intervención bajo control; el riesgo permanece abierto hasta resolverse'
  }
  return 'Problema activo pendiente de seguimiento'
}

function ordenPrioridad(nivel: Nivel, estado: EstadoProblema): number {
  if (estado === 'requiere_cierre') return 0
  if (estado === 'escalado_sin_respuesta') return 1
  if (estado === 'requiere_revision') return 2
  if (estado === 'dato_a_revisar') return 3
  if (estado === 'requiere_intervencion') return nivel === 'urgente' ? 4 : 5
  if (estado === 'intervencion_aplicada') return nivel === 'urgente' ? 6 : 7
  if (estado === 'bajo_control') return nivel === 'urgente' ? 8 : 9
  return 10
}

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
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'server_config', statusCode: 500, error: 'Configuración incompleta' })
    return json(500, { success: false, error: 'Configuración de servidor incompleta' })
  }

  const authHeader = event.headers.authorization ?? event.headers.Authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return json(401, { success: false, error: 'No autorizado' })

  let body: Body
  try {
    body = JSON.parse(event.body ?? '{}') as Body
  } catch {
    return json(400, { success: false, error: 'JSON inválido' })
  }

  const sucursalId = body.sucursalId?.trim() ?? ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sucursalId)) {
    return json(400, { success: false, error: 'Sucursal inválida' })
  }

  // El alcance se obtiene con el JWT real del actor sobre la vista operativa.
  // El service role sólo enriquece esos vencimientos ya autorizados con ledger,
  // costo y escalamientos server-only.
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: visiblesRaw, error: visiblesError } = await userClient
    .from('v_vencimientos_operativos')
    .select('id, producto_id, cantidad, fecha_vencimiento, venta_media_diaria, dias_donacion, descripcion, cod_art, marca, familia_id')
    .eq('sucursal_id', sucursalId)
    .eq('activo', true)

  if (visiblesError) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'scope_visible_expiries', statusCode: 502, error: visiblesError })
    return json(502, { success: false, error: 'No se pudo validar el alcance operativo' })
  }

  const visibles = ((visiblesRaw ?? []) as unknown as VencimientoVisibleRow[])
    .filter((row) => row.dias_donacion != null)

  if (visibles.length === 0) {
    return json(200, {
      success: true,
      resumen: { abiertos: 0, sin_respuesta: 0, bajo_control: 0, requieren_accion: 0, unidades_expuestas: 0, dinero_en_riesgo_sin_iva: 0, valorizados: 0 },
      problemas: [],
      criterio: 'problema_economico_activo_v1',
    })
  }

  const hoy = hoyOperativoYmd()
  const calculados = visibles.map((row) => ({
    row,
    ...calcularNivel(row.fecha_vencimiento, Number(row.cantidad), Number(row.venta_media_diaria), Number(row.dias_donacion), hoy),
  }))
  const problemasBase = calculados.filter((item) => item.nivel !== 'seguro')
  if (problemasBase.length === 0) {
    return json(200, {
      success: true,
      resumen: { abiertos: 0, sin_respuesta: 0, bajo_control: 0, requieren_accion: 0, unidades_expuestas: 0, dinero_en_riesgo_sin_iva: 0, valorizados: 0 },
      problemas: [],
      criterio: 'problema_economico_activo_v1',
    })
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const vencimientoIds = problemasBase.map((item) => item.row.id)
  const productoIds = Array.from(new Set(problemasBase.map((item) => item.row.producto_id)))

  const [seguimientoResult, costosResult, escalamientoResult] = await Promise.all([
    serviceClient
      .from('v_seguimiento_rag_actual')
      .select('vencimiento_id, rag_id, rag_porcentaje, rag_aplicado_at, observada_at, cantidad_actual_estimacion, velocidad_observada, velocidad_necesaria, estado_seguimiento_rag')
      .in('vencimiento_id', vencimientoIds),
    serviceClient
      .from('producto_costo_ultima_observacion')
      .select('producto_id, costo_unitario')
      .in('producto_id', productoIds),
    serviceClient
      .from('rag_escalamientos')
      .select('id, vencimiento_id, rag_id, observacion_id, estado_seguimiento, detectado_at, respondido_at, respondido_por, respuesta_tipo, push_procesado_at, push_destinatarios, push_enviados')
      .in('vencimiento_id', vencimientoIds)
      .order('detectado_at', { ascending: false }),
  ])

  if (seguimientoResult.error || costosResult.error || escalamientoResult.error) {
    const err = seguimientoResult.error ?? costosResult.error ?? escalamientoResult.error
    logServerError(event, { endpoint: ENDPOINT, operation: 'enrich_problem_ledger', statusCode: 502, error: err })
    return json(502, { success: false, error: 'No se pudo cargar el seguimiento de problemas' })
  }

  const seguimientoPorVenc = new Map(
    ((seguimientoResult.data ?? []) as unknown as SeguimientoRow[]).map((row) => [row.vencimiento_id, row]),
  )
  const costoPorProducto = new Map<string, number>()
  for (const row of (costosResult.data ?? []) as unknown as CostoRow[]) {
    const costo = row.costo_unitario == null ? NaN : Number(row.costo_unitario)
    if (Number.isFinite(costo) && costo >= 0) costoPorProducto.set(row.producto_id, costo)
  }

  const escalPorVenc = new Map<string, EscalamientoRow[]>()
  for (const row of (escalamientoResult.data ?? []) as unknown as EscalamientoRow[]) {
    const list = escalPorVenc.get(row.vencimiento_id) ?? []
    list.push(row)
    escalPorVenc.set(row.vencimiento_id, list)
  }

  const problemas = problemasBase.map(({ row, nivel, dias, diasComerciales, unidadesExpuestas }) => {
    const seguimiento = seguimientoPorVenc.get(row.id) ?? null
    const escalas = escalPorVenc.get(row.id) ?? []
    const escalamientoAbierto = seguimiento?.rag_id
      ? (escalas.find((e) => e.rag_id === seguimiento.rag_id && e.respondido_at == null) ?? null)
      : null
    const ultimoEscalamiento = escalas[0] ?? null
    const estado = resolverEstado(nivel, seguimiento, escalamientoAbierto)
    const costo = costoPorProducto.get(row.producto_id) ?? null
    const dinero = costo == null ? null : unidadesExpuestas * costo

    return {
      vencimiento_id: row.id,
      producto_id: row.producto_id,
      descripcion: row.descripcion,
      cod_art: row.cod_art,
      marca: row.marca,
      familia_id: row.familia_id,
      nivel,
      estado_problema: estado,
      motivo_prioridad: motivoPrioridad(nivel, estado),
      prioridad_orden: ordenPrioridad(nivel, estado),
      dias_hasta_vencimiento: dias,
      dias_comerciales_restantes: diasComerciales,
      cantidad_comprometida: Number(row.cantidad),
      unidades_expuestas: unidadesExpuestas,
      costo_unitario_sin_iva: costo,
      dinero_en_riesgo_sin_iva: dinero,
      rag_porcentaje: seguimiento?.rag_porcentaje == null ? null : Number(seguimiento.rag_porcentaje),
      estado_seguimiento_rag: seguimiento?.estado_seguimiento_rag ?? 'sin_rag',
      velocidad_observada: seguimiento?.velocidad_observada == null ? null : Number(seguimiento.velocidad_observada),
      velocidad_necesaria: seguimiento?.velocidad_necesaria == null ? null : Number(seguimiento.velocidad_necesaria),
      ultimo_control_at: seguimiento?.observada_at ?? null,
      escalamiento_id: escalamientoAbierto?.id ?? null,
      escalado_at: escalamientoAbierto?.detectado_at ?? null,
      notificado: Number(escalamientoAbierto?.push_enviados ?? 0) > 0,
      push_destinatarios: escalamientoAbierto?.push_destinatarios ?? null,
      push_enviados: escalamientoAbierto?.push_enviados ?? null,
      ultima_respuesta_at: ultimoEscalamiento?.respondido_at ?? null,
      ultima_respuesta_por: ultimoEscalamiento?.respondido_por ?? null,
      ultima_respuesta_tipo: ultimoEscalamiento?.respuesta_tipo ?? null,
    }
  })

  problemas.sort((a, b) =>
    a.prioridad_orden - b.prioridad_orden
    || (b.dinero_en_riesgo_sin_iva ?? -1) - (a.dinero_en_riesgo_sin_iva ?? -1)
    || a.dias_comerciales_restantes - b.dias_comerciales_restantes,
  )

  const resumen = problemas.reduce((acc, p) => {
    acc.abiertos += 1
    acc.unidades_expuestas += p.unidades_expuestas
    if (p.dinero_en_riesgo_sin_iva != null) {
      acc.dinero_en_riesgo_sin_iva += p.dinero_en_riesgo_sin_iva
      acc.valorizados += 1
    }
    if (p.estado_problema === 'escalado_sin_respuesta') acc.sin_respuesta += 1
    if (p.estado_problema === 'bajo_control') acc.bajo_control += 1
    if (['requiere_cierre', 'escalado_sin_respuesta', 'requiere_revision', 'requiere_intervencion', 'dato_a_revisar'].includes(p.estado_problema)) {
      acc.requieren_accion += 1
    }
    return acc
  }, {
    abiertos: 0,
    sin_respuesta: 0,
    bajo_control: 0,
    requieren_accion: 0,
    unidades_expuestas: 0,
    dinero_en_riesgo_sin_iva: 0,
    valorizados: 0,
  })

  return json(200, {
    success: true,
    generado_en: new Date().toISOString(),
    resumen,
    problemas: problemas.slice(0, 20),
    criterio: 'problema_economico_activo_v1',
    prioridad: 'terminal > RAG sin respuesta > RAG insuficiente > dato a revisar > intervención requerida (urgente antes que radar) > control pendiente > bajo control; dentro del mismo estado, $ en riesgo y tiempo comercial',
  })
}

export { handler }
