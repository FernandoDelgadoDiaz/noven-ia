import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { logServerError } from './_observability'

interface EscalamientoWebhookBody {
  escalamiento_id?: string
}

interface AccesoLocalRow {
  usuario_id: string
  rol: 'gerente_sucursal' | 'operador'
}

interface EscalamientoRow {
  id: string
  sucursal_id: string
  producto_id: string
  vencimiento_id: string
  rag_id: string
  estado_seguimiento: 'insuficiente' | 'sin_movimiento'
  rag_porcentaje: number
  cantidad_actual: number
  unidades_expuestas: number
  velocidad_observada: number | null
  velocidad_necesaria: number | null
  dinero_en_riesgo_sin_iva: number | null
  push_procesado_at: string | null
}

const ENDPOINT = 'enviar-push-rag-escalamiento'

function numero(value: unknown, decimals = 1): string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return parsed.toLocaleString('es-AR', { maximumFractionDigits: decimals })
}

function pesos(value: unknown): string | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  })
}

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Método no permitido' }) }
  }

  const expected = process.env.WEBHOOK_SECRET
  const provided = event.headers['x-webhook-secret']
  if (!expected || provided !== expected) {
    return { statusCode: 401, body: JSON.stringify({ success: false, error: 'No autorizado' }) }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const vapidPublic = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:gerente091@gmail.com'

  if (!supabaseUrl || !serviceRoleKey || !vapidPublic || !vapidPrivate) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'server_config', statusCode: 500, error: 'Config de servidor incompleta' })
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Config de servidor incompleta' }) }
  }

  let body: EscalamientoWebhookBody
  try {
    body = JSON.parse(event.body ?? '{}') as EscalamientoWebhookBody
  } catch {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'JSON inválido' }) }
  }

  const escalamientoId = body.escalamiento_id?.trim()
  if (!escalamientoId) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'escalamiento_id requerido' }) }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const { data: escalamientoRaw, error: escalamientoError } = await supabase
    .from('rag_escalamientos')
    .select('id, sucursal_id, producto_id, vencimiento_id, rag_id, estado_seguimiento, rag_porcentaje, cantidad_actual, unidades_expuestas, velocidad_observada, velocidad_necesaria, dinero_en_riesgo_sin_iva, push_procesado_at')
    .eq('id', escalamientoId)
    .maybeSingle()

  if (escalamientoError) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'load_escalation', statusCode: 500, error: escalamientoError })
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No se pudo leer el escalamiento' }) }
  }
  if (!escalamientoRaw) {
    return { statusCode: 404, body: JSON.stringify({ success: false, error: 'Escalamiento inexistente' }) }
  }

  const escalamiento = escalamientoRaw as unknown as EscalamientoRow
  if (escalamiento.push_procesado_at) {
    return { statusCode: 200, body: JSON.stringify({ success: true, already_processed: true }) }
  }

  const [productoResult, sucursalResult, accesosResult] = await Promise.all([
    supabase
      .from('productos')
      .select('cod_art, descripcion, familia_id')
      .eq('id', escalamiento.producto_id)
      .maybeSingle(),
    supabase
      .from('sucursales')
      .select('codigo')
      .eq('id', escalamiento.sucursal_id)
      .maybeSingle(),
    supabase
      .from('usuario_accesos')
      .select('usuario_id, rol')
      .eq('sucursal_id', escalamiento.sucursal_id)
      .eq('activo', true)
      .in('rol', ['gerente_sucursal', 'operador']),
  ])

  if (productoResult.error) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'load_product', statusCode: 500, error: productoResult.error })
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No se pudo resolver el producto' }) }
  }
  if (sucursalResult.error) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'load_store', statusCode: 500, error: sucursalResult.error })
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No se pudo resolver la sucursal' }) }
  }
  if (accesosResult.error) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'load_local_accesses', statusCode: 500, error: accesosResult.error })
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No se pudieron resolver destinatarios' }) }
  }

  const producto = productoResult.data
  const accesos = (accesosResult.data ?? []) as AccesoLocalRow[]
  const gerentes = new Set<string>()
  const operadoresLocales = new Set<string>()

  for (const acceso of accesos) {
    if (acceso.rol === 'gerente_sucursal') gerentes.add(acceso.usuario_id)
    if (acceso.rol === 'operador') operadoresLocales.add(acceso.usuario_id)
  }

  // Decisión de producto: escalamiento simultáneo a gerencia + operador
  // responsable. El supervisor no forma parte de este circuito específico.
  const destinatarios = new Set<string>(gerentes)
  const familiaId = (producto?.familia_id as string | null | undefined) ?? null

  if (familiaId && operadoresLocales.size > 0) {
    const { data: responsables, error: responsablesError } = await supabase
      .from('usuario_familias_sucursal')
      .select('usuario_id')
      .eq('sucursal_id', escalamiento.sucursal_id)
      .eq('familia_id', familiaId)
      .eq('activo', true)

    if (responsablesError) {
      logServerError(event, { endpoint: ENDPOINT, operation: 'load_family_responsibles', statusCode: 500, error: responsablesError })
      return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No se pudo resolver el operador responsable' }) }
    }

    for (const responsable of responsables ?? []) {
      const usuarioId = responsable.usuario_id as string
      if (operadoresLocales.has(usuarioId)) destinatarios.add(usuarioId)
    }
  }

  async function marcarProcesado(enviados: number): Promise<void> {
    const { error: markError } = await supabase
      .from('rag_escalamientos')
      .update({
        push_procesado_at: new Date().toISOString(),
        push_destinatarios: destinatarios.size,
        push_enviados: enviados,
      })
      .eq('id', escalamientoId)
      .is('push_procesado_at', null)

    if (markError) {
      logServerError(event, { endpoint: ENDPOINT, operation: 'mark_dispatch_processed', statusCode: 500, error: markError })
    }
  }

  if (destinatarios.size === 0) {
    await marcarProcesado(0)
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, sent: 0, destinatarios: 0, note: 'sin gerente u operador responsable activo' }),
    }
  }

  const { data: subscriptions, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('id, usuario_id, subscription')
    .in('usuario_id', Array.from(destinatarios))

  if (subsError) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'load_push_subscriptions', statusCode: 500, error: subsError })
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No se pudieron leer suscripciones push' }) }
  }

  const nombre = (producto?.descripcion as string | undefined) ?? 'Producto'
  const codArt = (producto?.cod_art as string | undefined) ?? ''
  const sucursalCodigo = (sucursalResult.data?.codigo as string | undefined) ?? '—'
  const riesgoPesos = pesos(escalamiento.dinero_en_riesgo_sin_iva)
  const riesgoFisico = `${numero(escalamiento.unidades_expuestas)} un. expuestas`
  const velocidad = escalamiento.estado_seguimiento === 'sin_movimiento'
    ? 'sin movimiento observado'
    : `salida ${numero(escalamiento.velocidad_observada)} un/día vs ${numero(escalamiento.velocidad_necesaria)} requerida`
  const impacto = riesgoPesos ? `${riesgoPesos} en riesgo (costo s/IVA)` : riesgoFisico

  const payload = JSON.stringify({
    title: '⚠️ RAG requiere decisión',
    body: `Suc. ${sucursalCodigo} · ${nombre}${codArt ? ` · SKU ${codArt}` : ''} · RAG ${numero(escalamiento.rag_porcentaje, 0)}%: ${velocidad}. ${impacto}. Revisar ahora.`,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: {
      url: '/dashboard',
      vencimiento_id: escalamiento.vencimiento_id,
      rag_id: escalamiento.rag_id,
      escalamiento_id: escalamientoId,
    },
  })

  const expiradas = new Set<string>()
  let sent = 0

  // Todas las suscripciones de todos los destinatarios se despachan en el mismo
  // ciclo; no existe espera secuencial Operador -> Gerencia.
  await Promise.all(
    (subscriptions ?? []).map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription as webpush.PushSubscription, payload)
        sent++
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 410 || statusCode === 404) {
          expiradas.add(row.id as string)
        } else {
          logServerError(event, { endpoint: ENDPOINT, operation: 'send_notification', statusCode: 502, error: err })
        }
      }
    }),
  )

  if (expiradas.size > 0) {
    const { error: cleanupError } = await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', Array.from(expiradas))

    if (cleanupError) {
      logServerError(event, { endpoint: ENDPOINT, operation: 'delete_expired_subscriptions', statusCode: 500, error: cleanupError })
    }
  }

  await marcarProcesado(sent)

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      sent,
      destinatarios: destinatarios.size,
      expiradas: expiradas.size,
      simultaneous: true,
    }),
  }
}

export { handler }
