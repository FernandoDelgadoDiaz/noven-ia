import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

/**
 * enviar-push — disparada por el webhook de DB de Supabase cuando un
 * vencimiento transiciona a nivel 'urgente'.
 *
 * Autenticación: header `x-webhook-secret` debe coincidir con WEBHOOK_SECRET.
 * Destinatarios: operadores de la familia del producto + admins.
 */

interface WebhookBody {
  // Contrato directo (lo arma el trigger de la DB)
  vencimiento_id?: string
  producto_nombre?: string
  dias_restantes?: number
  familia_id?: string | null
  // Fallback: shape estándar de Supabase Database Webhook
  record?: { id?: string; producto_id?: string; fecha_vencimiento?: string }
}

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Método no permitido' }) }
  }

  // Auth: secreto compartido con el webhook de Supabase
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
    console.error('[enviar-push] Faltan variables de entorno')
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Config de servidor incompleta' }) }
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  let body: WebhookBody
  try {
    body = JSON.parse(event.body ?? '{}') as WebhookBody
  } catch {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'JSON inválido' }) }
  }

  // Resolver datos del producto (contrato directo o, si falta, desde el record)
  const vencimientoId = body.vencimiento_id ?? body.record?.id ?? null
  let familiaId = body.familia_id ?? null
  let productoNombre = body.producto_nombre ?? ''
  let diasRestantes = body.dias_restantes

  if ((!familiaId || !productoNombre || diasRestantes === undefined) && body.record?.producto_id) {
    const { data: prod } = await supabase
      .from('productos')
      .select('descripcion, familia_id')
      .eq('id', body.record.producto_id)
      .maybeSingle()
    if (prod) {
      productoNombre = productoNombre || (prod.descripcion as string)
      familiaId = familiaId ?? (prod.familia_id as string | null)
    }
    if (diasRestantes === undefined && body.record.fecha_vencimiento) {
      const venceMs = new Date(body.record.fecha_vencimiento).setHours(0, 0, 0, 0)
      diasRestantes = Math.floor((venceMs - new Date().setHours(0, 0, 0, 0)) / 86400000)
    }
  }

  // Destinatarios: operadores de la familia + admins
  const userIds = new Set<string>()
  if (familiaId) {
    const { data: ops } = await supabase
      .from('usuario_familias')
      .select('usuario_id')
      .eq('familia_id', familiaId)
    for (const o of ops ?? []) userIds.add(o.usuario_id as string)
  }
  const { data: admins } = await supabase.from('usuarios').select('id').eq('rol', 'admin')
  for (const a of admins ?? []) userIds.add(a.id as string)

  if (userIds.size === 0) {
    return { statusCode: 200, body: JSON.stringify({ success: true, sent: 0, note: 'sin destinatarios' }) }
  }

  // Suscripciones de esos usuarios
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, subscription')
    .in('usuario_id', Array.from(userIds))

  if (!subs || subs.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ success: true, sent: 0, note: 'sin suscripciones' }) }
  }

  const payload = JSON.stringify({
    title: '⚠️ Producto en riesgo',
    body: `${productoNombre || 'Un producto'} vence en ${diasRestantes ?? '?'} días — Acción requerida`,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: { url: '/vencimientos?filtro=riesgo', vencimiento_id: vencimientoId },
  })

  let sent = 0
  const expiradas: string[] = []
  await Promise.all(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription as webpush.PushSubscription, payload)
        sent++
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode
        // 410 Gone / 404 Not Found → suscripción expirada, eliminar de DB
        if (statusCode === 410 || statusCode === 404) {
          expiradas.push(row.id as string)
        } else {
          console.error('[enviar-push] error enviando push:', statusCode, (err as Error).message)
        }
      }
    }),
  )

  if (expiradas.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiradas)
  }

  return { statusCode: 200, body: JSON.stringify({ success: true, sent, expiradas: expiradas.length }) }
}

export { handler }
