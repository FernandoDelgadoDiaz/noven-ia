import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from './_auth'
import { decodificarCsv } from '../../src/lib/importar-csv'
import { analizarReporteGlaciar } from '../../src/lib/importar-glaciar'

interface Body {
  sucursalId?: string
  archivoBase64?: string
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

  let body: Body
  try {
    body = JSON.parse(event.body ?? '{}') as Body
  } catch {
    return json(400, { success: false, error: 'JSON inválido' })
  }

  const sucursalId = body.sucursalId?.trim() ?? ''
  const archivoBase64 = body.archivoBase64 ?? ''
  if (!sucursalId || !archivoBase64) {
    return json(400, { success: false, error: 'Faltan sucursalId o archivoBase64' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const { data: puedeOperar, error: gateError } = await supabase.rpc('validar_operacion_local_server_v1', {
    p_actor_id: uid,
    p_sucursal_id: sucursalId,
  })
  if (gateError) {
    return json(502, { success: false, error: 'No se pudo validar el alcance para aprender catálogo.' })
  }
  if (puedeOperar !== true) {
    return json(403, { success: false, error: 'No tenés permiso para aprender catálogo desde esta sucursal.' })
  }

  let raw: Buffer
  try {
    raw = Buffer.from(archivoBase64, 'base64')
  } catch {
    return json(400, { success: false, error: 'Archivo base64 inválido' })
  }
  if (raw.length === 0) return json(400, { success: false, error: 'El archivo está vacío' })
  if (raw.length > 4_500_000) return json(413, { success: false, error: 'El archivo es demasiado grande.' })

  const bytes = Uint8Array.from(raw)
  const { texto, encoding } = decodificarCsv(bytes.buffer)
  const analisis = analizarReporteGlaciar(texto, { modo: 'familia' })

  if (analisis.erroresBloqueantes.length > 0) {
    return json(400, {
      success: false,
      error: 'El reporte filtrado no puede usarse para aprender catálogo.',
      errores: analisis.erroresBloqueantes,
      encoding,
    })
  }

  const codigoSucursal = analisis.metadata.codigoSucursal
  const codigoFamilia = analisis.parser.codigoFamilia ?? analisis.metadata.codigoFamilia
  if (!codigoSucursal || !codigoFamilia) {
    return json(400, { success: false, error: 'No se pudo verificar sucursal o Cód.Familia.' })
  }

  const codArts = Array.from(new Set(analisis.parser.filas.map((f) => f.cod_art)))
  const { data, error } = await supabase.rpc('resolver_pendientes_catalogo_por_familia_csv', {
    p_sucursal_id: sucursalId,
    p_usuario_id: uid,
    p_codigo_sucursal_fuente: codigoSucursal,
    p_codigo_familia: codigoFamilia,
    p_cod_arts: codArts,
  })

  if (error) {
    console.error('[aprender-pendientes-familia] RPC error:', error)
    const status = /alcance|permiso|familia|sucursal/i.test(error.message) ? 403 : 409
    return json(status, { success: false, error: error.message })
  }

  return json(200, {
    success: true,
    encoding,
    codigo_sucursal: codigoSucursal,
    codigo_familia: codigoFamilia,
    productos_en_archivo: codArts.length,
    resultado: data,
  })
}

export { handler }