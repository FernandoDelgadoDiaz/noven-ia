import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders, logServerError, publicRpcErrorPayload, serverErrorPayload } from './_auth'

type RolInvitable = 'gerente_zonal' | 'gerente_sucursal'
type CanalInvitacion = 'link' | 'email'

interface ListBody {
  accion: 'listar'
}

interface InviteBody {
  accion: 'invitar'
  nombre?: string
  email?: string
  rol?: RolInvitable
  zonaId?: string | null
  sucursalId?: string | null
  canal?: CanalInvitacion
}

type Body = ListBody | InviteBody

interface ContextoAltas {
  puede_crear_zonal?: boolean
  zonas?: Array<{ id?: string }>
  sucursales?: Array<{ id?: string; zona_id?: string }>
}

function jsonResponse(event: HandlerEvent, statusCode: number, payload: unknown) {
  return {
    statusCode,
    headers: { ...getCorsHeaders(event), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
}

function statusRpc(message: string): number {
  if (/permiso|prohibido|solo el administrador/i.test(message)) return 403
  if (/inexistente|inactivo|no encontr/i.test(message)) return 404
  if (/obligatorio|inválid|requiere/i.test(message)) return 400
  if (/ya está registrada|duplicate|unique/i.test(message)) return 409
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
    logServerError(event, 'admin-accesos', 'auth_verify_failed', err)
    return { error: 'No se pudo verificar la sesión.', statusCode: 502 }
  }
}

async function emailYaExiste(
  supabase: ReturnType<typeof createClient>,
  email: string,
): Promise<boolean> {
  const normalized = email.toLowerCase()
  let page = 1
  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const users = data.users ?? []
    if (users.some((u) => (u.email ?? '').toLowerCase() === normalized)) return true
    if (users.length < 1000) return false
    page++
  }
  return false
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
    const { data, error } = await supabase.rpc('listar_contexto_altas_v1', {
      p_actor_id: sesion.uid,
    })
    if (error) {
      const status = statusRpc(error.message)
      return jsonResponse(event, status, publicRpcErrorPayload(event, 'admin-accesos', 'listar_contexto_altas_failed', error, status, 'No se pudo cargar el contexto de altas.'))
    }
    return jsonResponse(event, 200, { success: true, ...(data as Record<string, unknown>) })
  }

  if (body.accion !== 'invitar') {
    return jsonResponse(event, 400, { success: false, error: 'Acción inválida' })
  }

  const nombre = body.nombre?.trim() ?? ''
  const email = body.email?.trim().toLowerCase() ?? ''
  const rol = body.rol
  const zonaId = body.zonaId?.trim() || null
  const sucursalId = body.sucursalId?.trim() || null
  const canal = body.canal ?? 'link'

  if (!nombre) return jsonResponse(event, 400, { success: false, error: 'El nombre es obligatorio' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse(event, 400, { success: false, error: 'El email no es válido' })
  }
  if (!rol || !['gerente_zonal', 'gerente_sucursal'].includes(rol)) {
    return jsonResponse(event, 400, { success: false, error: 'Rol inválido' })
  }
  if (!['link', 'email'].includes(canal)) {
    return jsonResponse(event, 400, { success: false, error: 'Canal inválido' })
  }
  if (rol === 'gerente_zonal' && !zonaId) {
    return jsonResponse(event, 400, { success: false, error: 'Seleccioná una zona' })
  }
  if (rol === 'gerente_sucursal' && !sucursalId) {
    return jsonResponse(event, 400, { success: false, error: 'Seleccioná una sucursal' })
  }

  // Resolvemos el alcance exacto ANTES de crear la cuenta o enviar un email.
  // El servidor devuelve sólo zonas/sucursales que el actor puede administrar.
  const { data: contextoData, error: permisoError } = await supabase.rpc('listar_contexto_altas_v1', {
    p_actor_id: sesion.uid,
  })
  if (permisoError) {
    const status = statusRpc(permisoError.message)
    return jsonResponse(event, status, publicRpcErrorPayload(event, 'admin-accesos', 'validar_contexto_altas_failed', permisoError, status, 'No se pudo validar el alcance de altas.'))
  }

  const contexto = (contextoData ?? {}) as ContextoAltas
  const zonasPermitidas = new Set((contexto.zonas ?? []).map((z) => z.id).filter((id): id is string => Boolean(id)))
  const sucursalesPermitidas = new Map(
    (contexto.sucursales ?? [])
      .filter((s): s is { id: string; zona_id?: string } => Boolean(s.id))
      .map((s) => [s.id, s]),
  )

  if (rol === 'gerente_zonal') {
    if (!contexto.puede_crear_zonal) {
      return jsonResponse(event, 403, { success: false, error: 'Solo el administrador de organización puede crear gerentes zonales.' })
    }
    if (!zonaId || !zonasPermitidas.has(zonaId)) {
      return jsonResponse(event, 403, { success: false, error: 'No tenés permiso para asignar esa zona.' })
    }
  } else {
    const sucursal = sucursalId ? sucursalesPermitidas.get(sucursalId) : undefined
    if (!sucursal) {
      return jsonResponse(event, 403, { success: false, error: 'No tenés permiso para asignar esa sucursal.' })
    }
  }

  try {
    if (await emailYaExiste(supabase, email)) {
      return jsonResponse(event, 409, { success: false, error: 'Ese email ya tiene una cuenta en Noven.' })
    }
  } catch (err) {
    logServerError(event, 'admin-accesos', 'email_lookup_failed', err)
    return jsonResponse(event, 502, serverErrorPayload(event, 'No se pudo verificar el email.'))
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
    return jsonResponse(event, 400, {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  const { data: registro, error: registroError } = await supabase.rpc('registrar_invitacion_acceso_v1', {
    p_actor_id: sesion.uid,
    p_usuario_id: usuarioId,
    p_email: email,
    p_nombre: nombre,
    p_rol: rol,
    p_zona_id: rol === 'gerente_zonal' ? zonaId : null,
    p_sucursal_id: rol === 'gerente_sucursal' ? sucursalId : null,
    p_canal: canal,
  })

  if (registroError) {
    // La cuenta Auth fue creada por ESTA llamada; si falla la asignación segura de
    // alcance, compensamos para no dejar una cuenta huérfana ni con permisos parciales.
    try {
      const { error: cleanupError } = await supabase.auth.admin.deleteUser(usuarioId)
      if (cleanupError) logServerError(event, 'admin-accesos', 'auth_cleanup_failed', cleanupError)
    } catch (cleanupError) {
      logServerError(event, 'admin-accesos', 'auth_cleanup_failed', cleanupError)
    }
    const status = statusRpc(registroError.message)
    return jsonResponse(event, status, publicRpcErrorPayload(event, 'admin-accesos', 'registrar_invitacion_failed', registroError, status, 'No se pudo registrar la invitación.'))
  }

  return jsonResponse(event, 201, {
    success: true,
    invitacion: registro,
    canal,
    link,
  })
}

export { handler }
