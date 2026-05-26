import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Método no permitido' }),
    }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[crear-usuario] Faltan variables de entorno:', {
      hasUrl: Boolean(supabaseUrl),
      hasKey: Boolean(serviceRoleKey),
    })
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Variables de entorno del servidor no configuradas' }),
    }
  }

  let body: { nombre?: unknown; email?: unknown; password?: unknown; rol?: unknown }
  try {
    body = JSON.parse(event.body ?? '{}') as { nombre?: unknown; email?: unknown; password?: unknown; rol?: unknown }
  } catch {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Body inválido: no es JSON válido' }),
    }
  }

  const { nombre, email, password, rol } = body

  if (
    typeof nombre !== 'string' || !nombre.trim() ||
    typeof email !== 'string' || !email.trim() ||
    typeof password !== 'string' || !password ||
    typeof rol !== 'string' || !rol.trim()
  ) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Faltan campos obligatorios o son inválidos: nombre, email, password, rol',
      }),
    }
  }

  // Llamada directa a la Admin API de Supabase con fetch nativo (Node 18+)
  const adminUrl = `${supabaseUrl}/auth/v1/admin/users`

  let adminResponse: Response
  try {
    adminResponse = await fetch(adminUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: {
          nombre: nombre.trim(),
          rol: rol.trim(),
        },
      }),
    })
  } catch (fetchError: unknown) {
    const message = fetchError instanceof Error ? fetchError.message : String(fetchError)
    console.error('[crear-usuario] Error de red al llamar Admin API:', message)
    return {
      statusCode: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: `Error de red al contactar Supabase: ${message}` }),
    }
  }

  let adminData: unknown
  try {
    adminData = await adminResponse.json()
  } catch {
    console.error('[crear-usuario] Respuesta de Admin API no es JSON. Status:', adminResponse.status)
    return {
      statusCode: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Respuesta inesperada de Supabase Auth' }),
    }
  }

  if (!adminResponse.ok) {
    const errorData = adminData as { message?: string; msg?: string; error?: string; error_description?: string }
    const errorMsg =
      errorData.message ??
      errorData.msg ??
      errorData.error_description ??
      errorData.error ??
      `Error HTTP ${adminResponse.status} de Supabase Auth`

    console.error('[crear-usuario] Supabase Admin API error:', adminResponse.status, errorData)
    return {
      statusCode: adminResponse.status >= 500 ? 502 : 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: errorMsg }),
    }
  }

  const userData = adminData as { id?: string; email?: string }

  if (!userData.id) {
    console.error('[crear-usuario] Supabase devolvió OK pero sin id de usuario:', adminData)
    return {
      statusCode: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Supabase no devolvió el ID del usuario creado' }),
    }
  }

  return {
    statusCode: 201,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, id: userData.id, email: userData.email }),
  }
}

export { handler }
