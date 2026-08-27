import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from './_auth'

const handler: Handler = async (event: HandlerEvent) => {
  const cors = getCorsHeaders(event)
  const json = (statusCode: number, payload: unknown) => ({
    statusCode,
    headers: { ...cors, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' }
  if (event.httpMethod !== 'GET') return json(405, { success: false, error: 'Método no permitido' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, { success: false, error: 'Configuración de servidor incompleta' })
  }

  const authHeader = event.headers['authorization'] ?? event.headers['Authorization'] ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return json(401, { success: false, error: 'No autorizado: token ausente' })

  let uid: string
  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    })
    if (!userRes.ok) return json(401, { success: false, error: 'No autorizado: token inválido o expirado' })
    const user = await userRes.json() as { id?: string }
    if (!user.id) return json(401, { success: false, error: 'No autorizado' })
    uid = user.id
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json(502, { success: false, error: `No se pudo verificar la sesión: ${msg}` })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const { data, error } = await supabase.rpc('listar_productos_pendientes_catalogo', {
    p_usuario_id: uid,
  })

  if (error) {
    console.error('[listar-pendientes-catalogo] RPC error:', error)
    const status = /alcance|permiso/i.test(error.message) ? 403 : 502
    return json(status, { success: false, error: error.message })
  }

  return json(200, { success: true, pendientes: data ?? [] })
}

export { handler }
