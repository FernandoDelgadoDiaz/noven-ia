import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { getCorsHeaders } from './_auth'
import { decodificarCsv } from '../../src/lib/importar-csv'
import { analizarReporteGlaciar } from '../../src/lib/importar-glaciar'

interface Body {
  sucursalId?: string
  nombreArchivo?: string
  archivoBase64?: string
}

function fechaIsoDesdeGlaciar(raw: string | null): string | null {
  if (!raw) return null
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
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
  const nombreArchivo = body.nombreArchivo?.trim() ?? ''
  const archivoBase64 = body.archivoBase64 ?? ''
  if (!sucursalId || !nombreArchivo || !archivoBase64) {
    return json(400, { success: false, error: 'Faltan sucursalId, nombreArchivo o archivoBase64' })
  }

  // Gate server-side antes de decodificar o procesar el archivo. El rol zonal es
  // de lectura y admin_organizacion no amplía el scope operativo.
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const { data: puedeOperar, error: gateError } = await supabase.rpc('validar_operacion_local_server_v1', {
    p_actor_id: uid,
    p_sucursal_id: sucursalId,
  })
  if (gateError) {
    return json(502, { success: false, error: 'No se pudo validar el alcance de la importación.' })
  }
  if (puedeOperar !== true) {
    return json(403, { success: false, error: 'No tenés permiso para importar en la sucursal seleccionada.' })
  }

  let raw: Buffer
  try {
    raw = Buffer.from(archivoBase64, 'base64')
  } catch {
    return json(400, { success: false, error: 'Archivo base64 inválido' })
  }

  if (raw.length === 0) return json(400, { success: false, error: 'El archivo está vacío' })
  if (raw.length > 4_500_000) {
    return json(413, {
      success: false,
      error: 'El archivo supera el tamaño admitido por esta carga. Debe procesarse mediante el flujo de archivo grande.',
    })
  }

  const bytes = Uint8Array.from(raw)
  const { texto, encoding } = decodificarCsv(bytes.buffer)
  const analisis = analizarReporteGlaciar(texto, { modo: 'masiva' })

  if (analisis.erroresBloqueantes.length > 0) {
    return json(400, {
      success: false,
      error: 'El reporte no puede importarse.',
      errores: analisis.erroresBloqueantes,
      encoding,
    })
  }

  if (analisis.parser.filas.length > 20_000) {
    return json(413, { success: false, error: 'El archivo contiene más de 20.000 productos importables.' })
  }

  const codigoSucursal = analisis.metadata.codigoSucursal
  if (!codigoSucursal) {
    return json(400, { success: false, error: 'No se pudo determinar Cod.Suc.Padrón.' })
  }

  const archivoSha256 = createHash('sha256').update(raw).digest('hex')
  const items = analisis.parser.filas.map((f) => ({
    cod_art: f.cod_art,
    descripcion: f.descripcion,
    marca: f.marca,
    gramaje: f.gramaje,
    stock: f.stockCsv,
    venta_media_diaria: f.ventaMediaCsv,
    fila_origen: f.linea,
  }))

  const { data, error } = await supabase.rpc('aplicar_importacion_glaciar_masiva_v2', {
    p_sucursal_id: sucursalId,
    p_usuario_id: uid,
    p_codigo_sucursal_fuente: codigoSucursal,
    p_nombre_archivo: nombreArchivo,
    p_archivo_sha256: archivoSha256,
    p_filas_total: analisis.parser.filas.length + analisis.parser.descartadas.length,
    p_filas_validas: analisis.parser.filas.length,
    p_filas_descartadas: analisis.parser.descartadas.length,
    p_items: items,
    p_fecha_reporte: fechaIsoDesdeGlaciar(analisis.metadata.fechaReporteTexto),
  })

  if (error) {
    console.error('[importar-asistido-completo] RPC error:', error)
    const status = error.message.includes('permiso') ? 403 : 502
    return json(status, { success: false, error: error.message })
  }

  return json(200, {
    success: true,
    encoding,
    codigo_sucursal: codigoSucursal,
    filas_validas: analisis.parser.filas.length,
    filas_descartadas: analisis.parser.descartadas.length,
    resultado: data,
  })
}

export { handler }