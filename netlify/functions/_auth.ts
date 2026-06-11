/**
 * _auth.ts — helper compartido para verificar JWT de caller en Netlify Functions.
 *
 * Uso:
 *   const result = await verificarAdmin(event)
 *   if (result.error) return result.error   // HandlerResponse listo para retornar
 *   // result.uid disponible si se necesita el uid del caller
 */

import type { HandlerEvent, HandlerResponse } from '@netlify/functions'

// Orígenes permitidos según entorno
const ALLOWED_ORIGINS = [
  'https://noven-ia.netlify.app',
  'http://localhost:5173',
  'http://localhost:5174',
]

export function getCorsHeaders(event: HandlerEvent): Record<string, string> {
  const origin = event.headers['origin'] ?? ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : 'https://noven-ia.netlify.app'
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  }
}

interface VerifyResult {
  uid: string
  error: null
}

interface VerifyError {
  uid: null
  error: HandlerResponse
}

type VerifyAdminResult = VerifyResult | VerifyError

/**
 * Extrae el Bearer token del header Authorization, lo valida contra Supabase Auth,
 * consulta el rol del usuario y devuelve 401/403 si no es admin.
 */
export async function verificarAdmin(
  event: HandlerEvent,
): Promise<VerifyAdminResult> {
  const corsHeaders = getCorsHeaders(event)

  // 1. Extraer token
  const authHeader = event.headers['authorization'] ?? event.headers['Authorization'] ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  if (!token) {
    return {
      uid: null,
      error: {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'No autorizado: token ausente' }),
      },
    }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return {
      uid: null,
      error: {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Configuración de servidor incompleta' }),
      },
    }
  }

  // 2. Validar token contra Supabase Auth → obtener user.id
  let userId: string
  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': anonKey,
      },
    })

    if (!userRes.ok) {
      return {
        uid: null,
        error: {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'No autorizado: token inválido o expirado' }),
        },
      }
    }

    const userData = await userRes.json() as { id?: string }
    if (!userData.id) {
      return {
        uid: null,
        error: {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'No autorizado: no se pudo resolver el usuario' }),
        },
      }
    }
    userId = userData.id
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      uid: null,
      error: {
        statusCode: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: `Error de red al verificar token: ${msg}` }),
      },
    }
  }

  // 3. Consultar rol en public.usuarios con service role key
  try {
    const rolRes = await fetch(
      `${supabaseUrl}/rest/v1/usuarios?id=eq.${encodeURIComponent(userId)}&select=rol`,
      {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Accept': 'application/json',
        },
      },
    )

    if (!rolRes.ok) {
      return {
        uid: null,
        error: {
          statusCode: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Error al verificar permisos del usuario' }),
        },
      }
    }

    const rolData = await rolRes.json() as Array<{ rol: string }>
    const rol = rolData[0]?.rol ?? ''

    if (rol !== 'admin') {
      return {
        uid: null,
        error: {
          statusCode: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Prohibido: se requiere rol admin' }),
        },
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      uid: null,
      error: {
        statusCode: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: `Error al verificar rol: ${msg}` }),
      },
    }
  }

  return { uid: userId, error: null }
}
