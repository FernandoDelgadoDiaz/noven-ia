import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders, logServerError, publicRpcErrorPayload, serverErrorPayload } from './_auth'

type Canal = 'link' | 'email'
type TipoListado = 'jerarquia' | 'local'
type RolInvitacion = 'gerente_zonal' | 'gerente_sucursal' | 'supervisor' | 'operador'

interface ListBody {
  accion: 'listar'
  tipo?: TipoListado
  sucursalId?: string | null
}
interface CancelBody {
  accion: 'anular'
  invitacionId?: string
}
interface RegenerateBody {
  accion: 'regenerar'
  invitacionId?: string
}
type Body = ListBody | CancelBody | RegenerateBody

interface InvitacionDetalle {
  id: string
  usuario_id: string | null
  organizacion_id: string
  email: string
  nombre: string
  rol: RolInvitacion
  zona_id: string | null
  sucursal_id: string | null
  familias_ids: string[]
  canal: Canal
  estado: string
  created_at: string
  expires_at: string
}

function jsonResponse(event: HandlerEvent, statusCode: number, payload: unknown) {
  return {
    statusCode,
    headers: { ...getCorsHeaders(event), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
}

function statusRpc(message: string): number {
  if (/permiso|prohibido|administrar/i.test(message)) return 403
  if (/inexistente|no encontr/i.test(message)) return 404
  if (/inválid|obligatori|aceptada/i.test(message)) return 400
  if (/duplicate|unique|responsable|registrada/i.test(message)) return 409
  return 502
}

async function validarSesion(
  event: HandlerEvent,
  supabaseUrl: string,
  anonKey: string,
): Promise<{ uid: string } | { error: string; statusCode: 401 | 502 }> {
  const authHeader = event.headers.authorization ?? event.headers.Authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return { error: 'No autorizado: token ausente', statusCode: 401 }
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    })
    if (!res.ok) return { error: 'No autorizado: sesión inválida o expirada', statusCode: 401 }
    const user = await res.json() as { id?: string }
    if (!user.id) return { error: 'No autorizado: usuario no resoluble', statusCode: 401 }
    return { uid: user.id }
  } catch (err) {
    logServerError(event, 'admin-invitaciones', 'auth_verify_failed', err)
    return { error: 'No se pudo verificar la sesión.', statusCode: 502 }
  }
}

async function crearInvitacionAuth(
  supabase: ReturnType<typeof createClient>,
  email: string,
  nombre: string,
  canal: Canal,
  redirectTo: string,
): Promise<{ usuarioId: string; link: string | null }> {
  if (canal === 'link') {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo, data: { nombre } },
    })
    if (error) throw error
    const link = data.properties.action_link
    if (!data.user?.id || !link) throw new Error('Supabase no devolvió la invitación completa')
    return { usuarioId: data.user.id, link }
  }

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { nombre },
  })
  if (error) throw error
  if (!data.user?.id) throw new Error('Supabase no devolvió el usuario invitado')
  return { usuarioId: data.user.id, link: null }
}

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: getCorsHeaders(event), body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(event, 405, { success: false, error: 'Método no permitido' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(event, 500, serverErrorPayload(event, 'Configuración de servidor incompleta'))
  }

  const sesion = await validarSesion(event, supabaseUrl, anonKey)
  if ('error' in sesion) {
    const payload = sesion.statusCode >= 500 ? serverErrorPayload(event, sesion.error) : { success: false, error: sesion.error }
    return jsonResponse(event, sesion.statusCode, payload)
  }

  let body: Body
  try {
    body = JSON.parse(event.body ?? '{}') as Body
  } catch {
    return jsonResponse(event, 400, { success: false, error: 'JSON inválido' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })

  if (body.accion === 'listar') {
    const tipo = body.tipo
    const sucursalId = body.sucursalId?.trim() || null
    if (!tipo || !['jerarquia', 'local'].includes(tipo)) {
      return jsonResponse(event, 400, { success: false, error: 'Tipo de listado inválido' })
    }
    if (tipo === 'local' && !sucursalId) {
      return jsonResponse(event, 400, { success: false, error: 'Falta sucursalId' })
    }

    const { data, error } = await supabase.rpc('listar_invitaciones_gestion_v1', {
      p_actor_id: sesion.uid,
      p_tipo: tipo,
      p_sucursal_id: tipo === 'local' ? sucursalId : null,
    })
    if (error) {
      const status = statusRpc(error.message)
      return jsonResponse(event, status, publicRpcErrorPayload(event, 'admin-invitaciones', 'listar_invitaciones_failed', error, status, 'No se pudieron listar las invitaciones.'))
    }
    return jsonResponse(event, 200, { success: true, invitaciones: data ?? [] })
  }

  const invitacionId = body.invitacionId?.trim() ?? ''
  if (!invitacionId) {
    return jsonResponse(event, 400, { success: false, error: 'Falta invitacionId' })
  }

  const { data: detalleData, error: detalleError } = await supabase.rpc('obtener_invitacion_gestion_v1', {
    p_actor_id: sesion.uid,
    p_invitacion_id: invitacionId,
  })
  if (detalleError) {
    const status = statusRpc(detalleError.message)
    return jsonResponse(event, status, publicRpcErrorPayload(event, 'admin-invitaciones', 'obtener_invitacion_failed', detalleError, status, 'No se pudo obtener la invitación.'))
  }
  const detalle = detalleData as InvitacionDetalle
  if (detalle.estado !== 'pendiente') {
    return jsonResponse(event, 409, { success: false, error: 'La invitación ya no está pendiente.' })
  }

  const { data: anulacionData, error: anulacionError } = await supabase.rpc('anular_invitacion_gestion_v1', {
    p_actor_id: sesion.uid,
    p_invitacion_id: invitacionId,
  })
  if (anulacionError) {
    const status = statusRpc(anulacionError.message)
    return jsonResponse(event, status, publicRpcErrorPayload(event, 'admin-invitaciones', 'anular_invitacion_failed', anulacionError, status, 'No se pudo anular la invitación.'))
  }
  const anulacion = (anulacionData ?? {}) as { usuario_id?: string | null; puede_eliminar_auth?: boolean }

  if (anulacion.usuario_id && anulacion.puede_eliminar_auth) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(anulacion.usuario_id)
    if (deleteError) {
      // La operación se considera fallida completa: dejamos la invitación nuevamente
      // pendiente para que el administrador pueda reintentar sin quedar bloqueado.
      await supabase
        .from('invitaciones_acceso')
        .update({ estado: 'pendiente', anulada_at: null })
        .eq('id', invitacionId)
      logServerError(event, 'admin-invitaciones', 'auth_delete_failed', deleteError)
      return jsonResponse(event, 502, serverErrorPayload(event, 'No se pudo limpiar la cuenta pendiente en Auth.'))
    }
    await supabase
      .from('invitaciones_acceso')
      .update({ auth_deleted_at: new Date().toISOString() })
      .eq('id', invitacionId)
  } else if (anulacion.usuario_id) {
    // Un pendiente nunca debería tener otro acceso activo. Fallamos cerrado para no
    // borrar una identidad que pueda estar siendo usada por otro alcance válido.
    await supabase
      .from('invitaciones_acceso')
      .update({ estado: 'pendiente', anulada_at: null })
      .eq('id', invitacionId)
    return jsonResponse(event, 409, {
      success: false,
      error: 'La cuenta asociada tiene otro acceso activo y no puede limpiarse desde esta invitación.',
    })
  }

  if (body.accion === 'anular') {
    return jsonResponse(event, 200, { success: true, invitacion_id: invitacionId, estado: 'anulada' })
  }

  if (body.accion !== 'regenerar') {
    return jsonResponse(event, 400, { success: false, error: 'Acción inválida' })
  }

  const redirectTo = `${(process.env.URL ?? 'https://noven-ia.netlify.app').replace(/\/$/, '')}/activar`
  let nuevaAuth: { usuarioId: string; link: string | null }
  try {
    nuevaAuth = await crearInvitacionAuth(supabase, detalle.email, detalle.nombre, detalle.canal, redirectTo)
  } catch (err) {
    return jsonResponse(event, 400, {
      success: false,
      error: `La invitación anterior fue anulada, pero no se pudo generar la nueva: ${err instanceof Error ? err.message : String(err)}`,
    })
  }

  let registro: unknown
  let registroError: { message: string } | null = null

  if (detalle.rol === 'gerente_zonal' || detalle.rol === 'gerente_sucursal') {
    const result = await supabase.rpc('registrar_invitacion_acceso_v1', {
      p_actor_id: sesion.uid,
      p_usuario_id: nuevaAuth.usuarioId,
      p_email: detalle.email,
      p_nombre: detalle.nombre,
      p_rol: detalle.rol,
      p_zona_id: detalle.rol === 'gerente_zonal' ? detalle.zona_id : null,
      p_sucursal_id: detalle.rol === 'gerente_sucursal' ? detalle.sucursal_id : null,
      p_canal: detalle.canal,
    })
    registro = result.data
    registroError = result.error
  } else {
    const result = await supabase.rpc('registrar_invitacion_local_v1', {
      p_actor_id: sesion.uid,
      p_usuario_id: nuevaAuth.usuarioId,
      p_email: detalle.email,
      p_nombre: detalle.nombre,
      p_rol: detalle.rol,
      p_sucursal_id: detalle.sucursal_id,
      p_familias: detalle.rol === 'operador' ? (detalle.familias_ids ?? []) : [],
      p_canal: detalle.canal,
    })
    registro = result.data
    registroError = result.error
  }

  if (registroError) {
    try {
      const { error: cleanupError } = await supabase.auth.admin.deleteUser(nuevaAuth.usuarioId)
      if (cleanupError) logServerError(event, 'admin-invitaciones', 'auth_cleanup_failed', cleanupError)
    } catch (cleanupError) {
      logServerError(event, 'admin-invitaciones', 'auth_cleanup_failed', cleanupError)
    }
    const status = statusRpc(registroError.message)
    return jsonResponse(event, status, publicRpcErrorPayload(event, 'admin-invitaciones', 'registrar_invitacion_regenerada_failed', registroError, status, 'La invitación anterior fue anulada, pero no se pudo registrar la nueva.'))
  }

  return jsonResponse(event, 201, {
    success: true,
    invitacion: registro,
    canal: detalle.canal,
    link: nuevaAuth.link,
  })
}

export { handler }
