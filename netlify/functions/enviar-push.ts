import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

/**
 * enviar-push — disparada por el trigger de DB cuando un vencimiento entra en
 * nivel urgente.
 *
 * Seguridad:
 * - autenticación por WEBHOOK_SECRET;
 * - el vencimiento se vuelve a resolver en PostgreSQL por su id;
 * - los destinatarios se calculan por la sucursal exacta del vencimiento;
 * - gerentes/supervisores deben tener acceso local activo;
 * - operadores deben tener acceso local activo Y ser responsables de la familia
 *   en usuario_familias_sucursal.
 *
 * No usa usuarios.rol ni usuario_familias legacy para targeting.
 */
interface WebhookBody {
  vencimiento_id?: string
  sucursal_id?: string
  producto_nombre?: string
  dias_restantes?: number
  familia_id?: string | null
  // Compatibilidad con el shape estándar de Database Webhook.
  record?: { id?: string }
}

interface AccesoLocalRow {
  usuario_id: string
  rol: string
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
    console.error('[enviar-push] Faltan variables de entorno')
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Config de servidor incompleta' }) }
  }

  let body: WebhookBody
  try {
    body = JSON.parse(event.body ?? '{}') as WebhookBody
  } catch {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'JSON inválido' }) }
  }

  const vencimientoId = body.vencimiento_id ?? body.record?.id ?? ''
  if (!vencimientoId) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'vencimiento_id requerido' }) }
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  // El body del webhook no es la fuente de verdad para sucursal/familia.
  // Releemos el vencimiento y el producto con service role por el id exacto.
  const { data: vencimiento, error: vencimientoError } = await supabase
    .from('vencimientos')
    .select('id, producto_id, sucursal_id, fecha_vencimiento')
    .eq('id', vencimientoId)
    .maybeSingle()

  if (vencimientoError) {
    console.error('[enviar-push] No se pudo resolver el vencimiento:', vencimientoError.message)
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No se pudo resolver el vencimiento' }) }
  }
  if (!vencimiento) {
    return { statusCode: 404, body: JSON.stringify({ success: false, error: 'Vencimiento inexistente' }) }
  }

  const { data: producto, error: productoError } = await supabase
    .from('productos')
    .select('descripcion, familia_id')
    .eq('id', vencimiento.producto_id)
    .maybeSingle()

  if (productoError) {
    console.error('[enviar-push] No se pudo resolver el producto:', productoError.message)
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No se pudo resolver el producto' }) }
  }

  const sucursalId = vencimiento.sucursal_id as string
  const familiaId = (producto?.familia_id as string | null | undefined) ?? null
  const productoNombre = (producto?.descripcion as string | undefined) ?? body.producto_nombre ?? 'Un producto'
  const diasRestantes = body.dias_restantes

  // Accesos locales activos de ESTA sucursal. Admin de organización y gerente
  // zonal no se agregan globalmente: el push operativo urgente es local.
  const { data: accesosRaw, error: accesosError } = await supabase
    .from('usuario_accesos')
    .select('usuario_id, rol')
    .eq('sucursal_id', sucursalId)
    .eq('activo', true)
    .in('rol', ['gerente_sucursal', 'supervisor', 'operador'])

  if (accesosError) {
    console.error('[enviar-push] No se pudieron resolver accesos locales:', accesosError.message)
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No se pudieron resolver destinatarios' }) }
  }

  const accesos = (accesosRaw ?? []) as AccesoLocalRow[]
  const userIds = new Set<string>()
  const operadoresLocales = new Set<string>()

  for (const acceso of accesos) {
    if (acceso.rol === 'operador') operadoresLocales.add(acceso.usuario_id)
    else userIds.add(acceso.usuario_id)
  }

  // El operador recibe push únicamente si es responsable activo de la familia
  // en la misma sucursal. No se consulta usuario_familias legacy.
  if (familiaId && operadoresLocales.size > 0) {
    const { data: responsables, error: responsablesError } = await supabase
      .from('usuario_familias_sucursal')
      .select('usuario_id')
      .eq('sucursal_id', sucursalId)
      .eq('familia_id', familiaId)
      .eq('activo', true)

    if (responsablesError) {
      console.error('[enviar-push] No se pudo resolver responsable de familia:', responsablesError.message)
      return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No se pudo resolver responsable de familia' }) }
    }

    for (const responsable of responsables ?? []) {
      const usuarioId = responsable.usuario_id as string
      if (operadoresLocales.has(usuarioId)) userIds.add(usuarioId)
    }
  }

  if (userIds.size === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, sent: 0, note: 'sin destinatarios locales', sucursal_id: sucursalId }),
    }
  }

  const { data: subs, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('id, usuario_id, subscription')
    .in('usuario_id', Array.from(userIds))

  if (subsError) {
    console.error('[enviar-push] No se pudieron leer suscripciones:', subsError.message)
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'No se pudieron leer suscripciones push' }) }
  }

  if (!subs || subs.length === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, sent: 0, note: 'sin suscripciones', sucursal_id: sucursalId }),
    }
  }

  const payload = JSON.stringify({
    title: '⚠️ Producto en riesgo',
    body: `${productoNombre} vence en ${diasRestantes ?? '?'} días — Acción requerida`,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: { url: '/vencimientos?filtro=riesgo', vencimiento_id: vencimientoId, sucursal_id: sucursalId },
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

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      sent,
      expiradas: expiradas.length,
      destinatarios: userIds.size,
      sucursal_id: sucursalId,
    }),
  }
}

export { handler }
