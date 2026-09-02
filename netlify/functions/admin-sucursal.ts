import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { adminActionMatchesLane, adminLaneForPath } from './_lib/admin-routing'
import { getCorsHeaders } from './_auth'
import { logServerError } from './_observability'

type CanalInvitacion = 'link' | 'email'
type RolLocalInvitable = 'supervisor' | 'operador'

interface ListBody {
  accion: 'listar'
  sucursalId?: string
}

interface LegacyCreateBody {
  accion: 'crear'
  sucursalId?: string
}

interface InviteBody {
  accion: 'invitar'
  sucursalId?: string
  nombre?: string
  email?: string
  rol?: RolLocalInvitable
  familias?: string[]
  canal?: CanalInvitacion
}

interface EditBody {
  accion: 'editar'
  sucursalId?: string
  usuarioId?: string
  nombre?: string
  rol?: 'admin' | 'supervisor' | 'operador'
  activo?: boolean
  familias?: string[]
}

type Body = ListBody | LegacyCreateBody | InviteBody | EditBody

interface AdminPayload {
  sucursal?: unknown
  familias?: unknown[]
  sectores?: unknown[]
  usuarios?: Array<Record<string, unknown> & { id?: string }>
}

const ENDPOINT = 'admin-sucursal'

function statusRpc(message: string): number {
  if (/permiso|prohibido|alcance|administrar/i.test(message)) return 403
  if (/inexistente|no encontr/i.test(message)) return 404
  if (/familia|rol|nombre|email|canal|obligatorio|inválid|requiere/i.test(message)) return 400
  if (/registrada|responsable|duplicate|unique/i.test(message)) return 409
  return 502
}

async function validarSesion(
  event: HandlerEvent,
  supabaseUrl: string,
  anonKey: string,
): Promise<{ uid: string } | { error: string; status: number }> {
  const authHeader = event.headers.authorization ?? event.headers.Authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return { error: 'No autorizado: token ausente', status: 401 }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    })
    if (!res.ok) return { error: 'No autorizado: sesión inválida o expirada', status: 401 }
    const user = await res.json() as { id?: string }
    if (!user.id) return { error: 'No autorizado: usuario no resoluble', status: 401 }
    return { uid: user.id }
  } catch (err) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'session_verify', statusCode: 502, error: err })
    return { error: 'No se pudo verificar la sesión.', status: 502 }
  }
}

async function listarEmailsAuth(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<Map<string, string>> {
  const emails = new Map<string, string>()
  let page = 1

  while (page <= 20) {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=1000`, {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        Accept: 'application/json',
      },
    })
    if (!res.ok) throw new Error(`No se pudo consultar Auth (HTTP ${res.status})`)
    const data = await res.json() as { users?: Array<{ id: string; email?: string }> }
    const users = data.users ?? []
    for (const u of users) emails.set(u.id, u.email ?? '')
    if (users.length < 1000) break
    page++
  }

  return emails
}

async function eliminarAuthUser(
  event: HandlerEvent,
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
): Promise<void> {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  })
  if (!res.ok) {
    logServerError(event, {
      endpoint: ENDPOINT,
      operation: 'compensate_delete_auth_user',
      statusCode: 502,
      error: `Auth delete HTTP ${res.status}`,
    })
  }
}

async function handleAdminSucursal(event: HandlerEvent): Promise<HandlerResponse> {
  const cors = getCorsHeaders(event)
  const json = (statusCode: number, payload: unknown) => ({
    statusCode,
    headers: { ...cors, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const lane = adminLaneForPath(event.path, 'sucursal')
  if (!lane) return json(404, { success: false, error: 'Ruta administrativa inexistente' })

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { success: false, error: 'Método no permitido' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'server_config', statusCode: 500, error: 'Configuración de servidor incompleta' })
    return json(500, { success: false, error: 'Configuración de servidor incompleta' })
  }

  const sesion = await validarSesion(event, supabaseUrl, anonKey)
  if ('error' in sesion) return json(sesion.status, { success: false, error: sesion.error })

  let body: Body
  try {
    body = JSON.parse(event.body ?? '{}') as Body
  } catch {
    return json(400, { success: false, error: 'JSON inválido' })
  }
  if (!adminActionMatchesLane(lane, body.accion)) {
    return json(404, { success: false, error: 'Ruta administrativa inexistente' })
  }

  const sucursalId = body.sucursalId?.trim() ?? ''
  if (!sucursalId) return json(400, { success: false, error: 'Falta sucursalId' })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })

  if (body.accion === 'listar') {
    const { data, error } = await supabase.rpc('listar_admin_sucursal_v1', {
      p_actor_id: sesion.uid,
      p_sucursal_id: sucursalId,
    })
    if (error) {
      const status = statusRpc(error.message)
      if (status >= 500) {
        logServerError(event, { endpoint: ENDPOINT, operation: 'listar_admin_sucursal_v1', statusCode: status, error })
      }
      return json(status, {
        success: false,
        error: status >= 500 ? 'No se pudo consultar la administración de la sucursal.' : error.message,
      })
    }

    try {
      const payload = (data ?? {}) as AdminPayload
      const emails = await listarEmailsAuth(supabaseUrl, serviceRoleKey)
      const usuarios = (payload.usuarios ?? []).map((u) => ({
        ...u,
        email: typeof u.id === 'string' ? (emails.get(u.id) ?? '') : '',
      }))
      return json(200, { success: true, ...payload, usuarios })
    } catch (err) {
      logServerError(event, { endpoint: ENDPOINT, operation: 'listar_auth_users', statusCode: 502, error: err })
      return json(502, { success: false, error: 'No se pudo completar el listado de usuarios.' })
    }
  }

  if (body.accion === 'crear') {
    return json(410, {
      success: false,
      error: 'El alta directa con contraseña inicial fue retirada. Usá una invitación para Supervisor u Operador.',
    })
  }

  if (body.accion === 'invitar') {
    const nombre = body.nombre?.trim() ?? ''
    const email = body.email?.trim().toLowerCase() ?? ''
    const rol = body.rol
    const familias = Array.from(new Set((body.familias ?? []).filter((x): x is string => typeof x === 'string' && x.trim() !== '')))
    const canal = body.canal ?? 'link'

    if (!nombre) return json(400, { success: false, error: 'El nombre es obligatorio' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(400, { success: false, error: 'El email no es válido' })
    }
    if (!rol || !['supervisor', 'operador'].includes(rol)) {
      return json(400, { success: false, error: 'Rol local inválido' })
    }
    if (!['link', 'email'].includes(canal)) {
      return json(400, { success: false, error: 'Canal inválido' })
    }
    if (rol === 'operador' && familias.length === 0) {
      return json(400, { success: false, error: 'Seleccioná al menos una familia para el operador' })
    }

    // Gate de permiso ANTES de crear la cuenta Auth.
    const { error: permisoError } = await supabase.rpc('listar_admin_sucursal_v1', {
      p_actor_id: sesion.uid,
      p_sucursal_id: sucursalId,
    })
    if (permisoError) {
      const status = statusRpc(permisoError.message)
      if (status >= 500) {
        logServerError(event, { endpoint: ENDPOINT, operation: 'listar_admin_sucursal_v1.invitar_gate', statusCode: status, error: permisoError })
      }
      return json(status, {
        success: false,
        error: status >= 500 ? 'No se pudo validar el alcance de administración.' : permisoError.message,
      })
    }

    try {
      const emails = await listarEmailsAuth(supabaseUrl, serviceRoleKey)
      if (Array.from(emails.values()).some((value) => value.trim().toLowerCase() === email)) {
        return json(409, { success: false, error: 'Ese email ya tiene una cuenta en Noven.' })
      }
    } catch (err) {
      logServerError(event, { endpoint: ENDPOINT, operation: 'verify_invite_email', statusCode: 502, error: err })
      return json(502, { success: false, error: 'No se pudo verificar el email en Auth.' })
    }

    const redirectTo = `${(process.env.URL ?? 'https://noven-ia.netlify.app').replace(/\/$/, '')}/activar`
    let usuarioId = ''
    let link: string | null = null

    try {
      if (canal === 'link') {
        const { data, error } = await supabase.auth.admin.generateLink({
          type: 'invite',
          email,
          options: {
            redirectTo,
            data: { nombre },
          },
        })
        if (error) throw error
        usuarioId = data.user.id
        link = data.properties.action_link
        if (!link) throw new Error('Supabase no devolvió el link de invitación')
      } else {
        const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
          redirectTo,
          data: { nombre },
        })
        if (error) throw error
        if (!data.user?.id) throw new Error('Supabase no devolvió el usuario invitado')
        usuarioId = data.user.id
      }
    } catch (err) {
      return json(400, { success: false, error: err instanceof Error ? err.message : String(err) })
    }

    const { data: registro, error: registroError } = await supabase.rpc('registrar_invitacion_local_v1', {
      p_actor_id: sesion.uid,
      p_usuario_id: usuarioId,
      p_email: email,
      p_nombre: nombre,
      p_rol: rol,
      p_sucursal_id: sucursalId,
      p_familias: rol === 'operador' ? familias : [],
      p_canal: canal,
    })

    if (registroError) {
      await eliminarAuthUser(event, supabaseUrl, serviceRoleKey, usuarioId)
      const status = statusRpc(registroError.message)
      if (status >= 500) {
        logServerError(event, { endpoint: ENDPOINT, operation: 'registrar_invitacion_local_v1', statusCode: status, error: registroError })
      }
      return json(status, {
        success: false,
        error: status >= 500 ? 'No se pudo registrar la invitación local.' : registroError.message,
      })
    }

    return json(201, {
      success: true,
      invitacion: registro,
      canal,
      link,
    })
  }

  if (body.accion === 'editar') {
    const nombre = body.nombre?.trim() ?? ''
    const rol = body.rol
    const activo = body.activo !== false
    const familias = Array.from(new Set((body.familias ?? []).filter((x): x is string => typeof x === 'string' && x.trim() !== '')))
    const usuarioId = body.usuarioId?.trim() ?? ''

    if (!usuarioId) return json(400, { success: false, error: 'Falta usuarioId' })
    if (!nombre) return json(400, { success: false, error: 'El nombre es obligatorio' })
    if (!rol || !['admin', 'supervisor', 'operador'].includes(rol)) {
      return json(400, { success: false, error: 'Rol inválido' })
    }

    const { data, error } = await supabase.rpc('guardar_usuario_sucursal_admin_v1', {
      p_actor_id: sesion.uid,
      p_sucursal_id: sucursalId,
      p_usuario_id: usuarioId,
      p_nombre: nombre,
      p_rol_legacy: rol,
      p_activo: activo,
      p_familias: rol === 'operador' && activo ? familias : [],
    })
    if (error) {
      const status = statusRpc(error.message)
      if (status >= 500) {
        logServerError(event, { endpoint: ENDPOINT, operation: 'guardar_usuario_sucursal_admin_v1', statusCode: status, error })
      }
      return json(status, {
        success: false,
        error: status >= 500 ? 'No se pudo guardar el usuario de la sucursal.' : error.message,
      })
    }
    return json(200, { success: true, usuario: data })
  }

  return json(400, { success: false, error: 'Acción inválida' })
}

const handler: Handler = handleAdminSucursal

export { handler, handleAdminSucursal }
