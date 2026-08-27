import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from './_auth'

interface ListBody {
  accion: 'listar'
  sucursalId?: string
}

interface CreateBody {
  accion: 'crear'
  sucursalId?: string
  nombre?: string
  email?: string
  password?: string
  rol?: 'admin' | 'supervisor' | 'operador'
  activo?: boolean
  familias?: string[]
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

type Body = ListBody | CreateBody | EditBody

interface AdminPayload {
  sucursal?: unknown
  familias?: unknown[]
  sectores?: unknown[]
  usuarios?: Array<Record<string, unknown> & { id?: string }>
}

function statusRpc(message: string): number {
  if (/permiso|prohibido|alcance|administrar/i.test(message)) return 403
  if (/inexistente|no encontr/i.test(message)) return 404
  if (/familia|rol|nombre|inválid/i.test(message)) return 400
  return 409
}

async function validarSesion(
  event: HandlerEvent,
  supabaseUrl: string,
  anonKey: string,
): Promise<{ uid: string; token: string } | { error: string }> {
  const authHeader = event.headers.authorization ?? event.headers.Authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return { error: 'No autorizado: token ausente' }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    })
    if (!res.ok) return { error: 'No autorizado: sesión inválida o expirada' }
    const user = await res.json() as { id?: string }
    if (!user.id) return { error: 'No autorizado: usuario no resoluble' }
    return { uid: user.id, token }
  } catch (err) {
    return { error: `No se pudo verificar la sesión: ${err instanceof Error ? err.message : String(err)}` }
  }
}

async function listarEmailsAuth(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<Map<string, string>> {
  const emails = new Map<string, string>()
  let page = 1

  // Admin API pagina. 1000 por página cubre ampliamente el MVP, pero seguimos
  // paginando para que el endpoint no dependa de ese supuesto.
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

async function crearAuthUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
  password: string,
): Promise<{ id: string; email: string }> {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      // No se usa metadata para autorización. El rol real vive en PostgreSQL.
      user_metadata: {},
    }),
  })

  const data = await res.json().catch(() => ({})) as {
    id?: string
    email?: string
    message?: string
    msg?: string
    error?: string
  }
  if (!res.ok || !data.id) {
    throw new Error(data.message ?? data.msg ?? data.error ?? `No se pudo crear la cuenta Auth (HTTP ${res.status})`)
  }
  return { id: data.id, email: data.email ?? email }
}

async function eliminarAuthUser(
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
    console.error('[admin-sucursal] compensación Auth falló', res.status, userId)
  }
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
    return json(500, { success: false, error: 'Configuración de servidor incompleta' })
  }

  const sesion = await validarSesion(event, supabaseUrl, anonKey)
  if ('error' in sesion) return json(401, { success: false, error: sesion.error })

  let body: Body
  try {
    body = JSON.parse(event.body ?? '{}') as Body
  } catch {
    return json(400, { success: false, error: 'JSON inválido' })
  }

  const sucursalId = body.sucursalId?.trim() ?? ''
  if (!sucursalId) return json(400, { success: false, error: 'Falta sucursalId' })

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  if (body.accion === 'listar') {
    const { data, error } = await supabase.rpc('listar_admin_sucursal_v1', {
      p_actor_id: sesion.uid,
      p_sucursal_id: sucursalId,
    })
    if (error) return json(statusRpc(error.message), { success: false, error: error.message })

    try {
      const payload = (data ?? {}) as AdminPayload
      const emails = await listarEmailsAuth(supabaseUrl, serviceRoleKey)
      const usuarios = (payload.usuarios ?? []).map((u) => ({
        ...u,
        email: typeof u.id === 'string' ? (emails.get(u.id) ?? '') : '',
      }))
      return json(200, { success: true, ...payload, usuarios })
    } catch (err) {
      return json(502, { success: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  const nombre = body.nombre?.trim() ?? ''
  const rol = body.rol
  const activo = body.activo !== false
  const familias = Array.from(new Set((body.familias ?? []).filter((x): x is string => typeof x === 'string' && x.trim() !== '')))

  if (!nombre) return json(400, { success: false, error: 'El nombre es obligatorio' })
  if (!rol || !['admin', 'supervisor', 'operador'].includes(rol)) {
    return json(400, { success: false, error: 'Rol inválido' })
  }

  if (body.accion === 'crear') {
    const email = body.email?.trim().toLowerCase() ?? ''
    const password = body.password ?? ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(400, { success: false, error: 'El email no es válido' })
    }
    if (password.length < 6) {
      return json(400, { success: false, error: 'La contraseña debe tener al menos 6 caracteres' })
    }

    // Gate de permiso ANTES de crear Auth: si el actor no administra la sucursal,
    // no dejamos una cuenta huérfana.
    const { error: preAuthError } = await supabase.rpc('listar_admin_sucursal_v1', {
      p_actor_id: sesion.uid,
      p_sucursal_id: sucursalId,
    })
    if (preAuthError) return json(statusRpc(preAuthError.message), { success: false, error: preAuthError.message })

    let creado: { id: string; email: string }
    try {
      creado = await crearAuthUser(supabaseUrl, serviceRoleKey, email, password)
    } catch (err) {
      return json(400, { success: false, error: err instanceof Error ? err.message : String(err) })
    }

    const { data, error } = await supabase.rpc('guardar_usuario_sucursal_admin_v1', {
      p_actor_id: sesion.uid,
      p_sucursal_id: sucursalId,
      p_usuario_id: creado.id,
      p_nombre: nombre,
      p_rol_legacy: rol,
      p_activo: activo,
      p_familias: familias,
    })

    if (error) {
      // Compensación: la transacción DB se revirtió; eliminamos sólo la cuenta
      // Auth que acaba de crear ESTA llamada.
      await eliminarAuthUser(supabaseUrl, serviceRoleKey, creado.id)
      return json(statusRpc(error.message), { success: false, error: error.message })
    }

    return json(201, { success: true, usuario: data, email: creado.email })
  }

  if (body.accion === 'editar') {
    const usuarioId = body.usuarioId?.trim() ?? ''
    if (!usuarioId) return json(400, { success: false, error: 'Falta usuarioId' })

    const { data, error } = await supabase.rpc('guardar_usuario_sucursal_admin_v1', {
      p_actor_id: sesion.uid,
      p_sucursal_id: sucursalId,
      p_usuario_id: usuarioId,
      p_nombre: nombre,
      p_rol_legacy: rol,
      p_activo: activo,
      p_familias: familias,
    })
    if (error) return json(statusRpc(error.message), { success: false, error: error.message })
    return json(200, { success: true, usuario: data })
  }

  return json(400, { success: false, error: 'Acción inválida' })
}

export { handler }
