import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { logServerError } from './_observability'

interface RadarZonalWebhookBody {
  alerta_zonal_id?: string
}

interface DestinoRow {
  id: string
  usuario_id: string | null
  stock_snapshot: number
  stock_actualizado_at: string | null
}

const ENDPOINT = 'enviar-push-radar-zonal'

function formatFecha(fecha: string): string {
  const [year, month, day] = fecha.split('-')
  if (!year || !month || !day) return fecha
  return `${day}/${month}/${year}`
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

  let body: RadarZonalWebhookBody
  try {
    body = JSON.parse(event.body ?? '{}') as RadarZonalWebhookBody
  } catch {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'JSON inválido' }) }
  }

  const alertaId = body.alerta_zonal_id?.trim()
  if (!alertaId) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'alerta_zonal_id requerido' }) }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const { data: alerta, error: alertaError } = await supabase
    .from('alertas_zonales')
    .select('id, producto_id, sucursal_origen_id, fecha_vencimiento')
    .eq('id', alertaId)
    .maybeSingle()

  if (alertaError) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'load_alert', statusCode: 500, error: alertaError })
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No se pudo leer la alerta' }) }
  }
  if (!alerta) {
    return { statusCode: 404, body: JSON.stringify({ success: false, error: 'Alerta zonal inexistente' }) }
  }

  const [productoResult, sucursalResult, destinosResult] = await Promise.all([
    supabase
      .from('productos')
      .select('cod_art, descripcion')
      .eq('id', alerta.producto_id)
      .maybeSingle(),
    supabase
      .from('sucursales')
      .select('codigo')
      .eq('id', alerta.sucursal_origen_id)
      .maybeSingle(),
    supabase
      .from('alertas_zonales_destinos')
      .select('id, usuario_id, stock_snapshot, stock_actualizado_at')
      .eq('alerta_id', alertaId)
      .eq('estado', 'pendiente')
      .not('usuario_id', 'is', null)
      .is('notificada_at', null),
  ])

  if (productoResult.error) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'load_product', statusCode: 500, error: productoResult.error })
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No se pudo resolver el producto de la alerta' }) }
  }
  if (sucursalResult.error) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'load_origin_store', statusCode: 500, error: sucursalResult.error })
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No se pudo resolver la sucursal origen' }) }
  }
  if (destinosResult.error) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'load_destinations', statusCode: 500, error: destinosResult.error })
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No se pudieron resolver destinatarios' }) }
  }

  const producto = productoResult.data
  const sucursalOrigen = sucursalResult.data
  const pendientes = (destinosResult.data ?? []) as DestinoRow[]
  if (pendientes.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ success: true, sent: 0, destinos: 0 }) }
  }

  const userIds = Array.from(new Set(pendientes.map((d) => d.usuario_id).filter((id): id is string => Boolean(id))))
  const { data: subscriptions, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('id, usuario_id, subscription')
    .in('usuario_id', userIds)

  // Un fallo técnico al consultar suscripciones NO equivale a "el usuario no
  // tiene suscripción". Si continuáramos, terminaríamos marcando notificada_at
  // sin haber podido determinar si había un push pendiente y perderíamos el
  // reintento en una ejecución posterior.
  if (subsError) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'load_push_subscriptions', statusCode: 500, error: subsError })
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No se pudieron leer suscripciones push' }) }
  }

  const subsPorUsuario = new Map<string, Array<{ id: string; subscription: webpush.PushSubscription }>>()
  for (const row of subscriptions ?? []) {
    const usuarioId = row.usuario_id as string
    const list = subsPorUsuario.get(usuarioId) ?? []
    list.push({ id: row.id as string, subscription: row.subscription as webpush.PushSubscription })
    subsPorUsuario.set(usuarioId, list)
  }

  const expiradas = new Set<string>()
  let sent = 0
  const origen = (sucursalOrigen?.codigo as string | undefined) ?? 'otro local'
  const nombre = (producto?.descripcion as string | undefined) ?? 'Producto'
  const codArt = (producto?.cod_art as string | undefined) ?? ''
  const fecha = formatFecha(alerta.fecha_vencimiento as string)

  await Promise.all(
    pendientes.map(async (destino) => {
      if (!destino.usuario_id) return
      const userSubs = subsPorUsuario.get(destino.usuario_id) ?? []
      const payload = JSON.stringify({
        title: `🔎 Radar Zonal · Suc. ${origen}`,
        body: `${nombre}${codArt ? ` · SKU ${codArt}` : ''} · vence ${fecha}. Tu último stock: ${destino.stock_snapshot} un. ¿Lo tenés con esta fecha?`,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        data: { url: '/dashboard?radar_zonal=1', alerta_zonal_id: alertaId, destino_id: destino.id },
      })

      for (const sub of userSubs) {
        try {
          await webpush.sendNotification(sub.subscription, payload)
          sent++
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number }).statusCode
          if (statusCode === 410 || statusCode === 404) {
            expiradas.add(sub.id)
          } else {
            logServerError(event, { endpoint: ENDPOINT, operation: 'send_notification', statusCode: 502, error: err })
          }
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

  // `notificada_at` significa que el despacho push fue procesado. Aunque el
  // usuario todavía no haya habilitado Web Push, la alerta permanece visible en
  // la bandeja de la campana y evitamos reintentos repetitivos en cada import.
  const destinoIds = pendientes.map((d) => d.id)
  const { error: markError } = await supabase
    .from('alertas_zonales_destinos')
    .update({ notificada_at: new Date().toISOString() })
    .in('id', destinoIds)
    .eq('estado', 'pendiente')

  // Los pushes ya pudieron haberse enviado: responder 500 en este punto podría
  // provocar un reintento inmediato y duplicar notificaciones. Registramos el
  // fallo para diagnóstico; al quedar notificada_at en null, una ejecución
  // posterior vuelve a tener oportunidad de procesar el destino.
  if (markError) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'mark_dispatch_processed', statusCode: 500, error: markError })
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      destinos: pendientes.length,
      sent,
      expiradas: expiradas.size,
    }),
  }
}

export { handler }
