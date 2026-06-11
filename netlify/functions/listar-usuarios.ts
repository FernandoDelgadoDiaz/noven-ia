import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import { verificarAdmin, getCorsHeaders } from './_auth'

const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  const corsHeaders = getCorsHeaders(event)

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Método no permitido' }),
    }
  }

  // Verificar autenticación y rol admin
  const auth = await verificarAdmin(event)
  if (auth.error !== null) {
    return auth.error
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[listar-usuarios] Faltan variables de entorno')
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Variables de entorno del servidor no configuradas' }),
    }
  }

  let adminResponse: Response
  try {
    adminResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[listar-usuarios] Error de red:', msg)
    return {
      statusCode: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: `Error de red: ${msg}` }),
    }
  }

  if (!adminResponse.ok) {
    const errData = await adminResponse.json().catch(() => ({})) as { message?: string }
    console.error('[listar-usuarios] Supabase error:', adminResponse.status, errData)
    return {
      statusCode: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: errData.message ?? `Error HTTP ${adminResponse.status}` }),
    }
  }

  const data = await adminResponse.json() as { users?: { id: string; email: string }[] }
  const users = (data.users ?? []).map((u) => ({ id: u.id, email: u.email ?? '' }))

  return {
    statusCode: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, users }),
  }
}

export { handler }
