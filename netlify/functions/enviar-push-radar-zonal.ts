import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

interface RadarZonalWebhookBody {
  alerta_zonal_id?: string
}

interface DestinoRow {
  id: string
  usuario_id: string | null
  stock_snapshot: number
  stock_actualizado_at: string | null
}

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
    console.error('[radar-zonal-push] Config de servidor incompleta')
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
    console.error('[radar-zonal-push] Error leyendo alerta', alertaError.message)
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No se pudo leer la alerta' }) }
  }
  if (!alerta) {
    return { statusCode: 404, body: JSON.stringify({ success: false, error: 'Alerta zonal inexistente' }) }
  }

  const [{ data: producto }, { data: sucursalOrigen }, { data: destinos, error: destinosError }] = await Promise.all([
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

  if (destinosError) {
    console.error('[radar-zonal-push] Error leyendo destinos', destinosError.message)
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No se pudieron resolver destinatarios' }) }
  }

  const pendientes = (destinos ?? []) as DestinoRow[]
  if (pendientes.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ success: true, sent: 0, destinos: 0 }) }
  }

  const userIds = Array.from(new Set(pendientes.map((d) => d.usuario_id).filter((id): id is string => Boolean(id))))
  const { data: subscriptions, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('id, usuario_id, subscription')
    .in('usuario_id', userIds)

  if (subsError) {
    console.error('[radar-zonal-push] Error leyendo suscripciones', subsError.message)
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
            console.error('[radar-zonal-push] Error enviando push', statusCode, (err as Error).message)
          }
        }
      }
    }),
  )

  if (expiradas.size > 0) {
    await supabase.from('push_subscriptions').delete().in('id', Array.from(expiradas))
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

  if (markError) {
    console.error('[radar-zonal-push] No se pudo marcar el despacho', markError.message)
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
