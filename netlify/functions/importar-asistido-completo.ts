import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { getCorsHeaders } from './_auth'
import { logServerError } from './_observability'
import { decodificarCsv } from '../../src/lib/importar-csv'
import { analizarReporteGlaciar } from '../../src/lib/importar-glaciar'
import { parsear0258 } from '../../src/lib/importar-0258'

interface Body {
  sucursalId?: string
  nombreArchivo?: string
  archivoBase64?: string
}

const ENDPOINT = 'importar-asistido-completo'

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
    logServerError(event, { endpoint: ENDPOINT, operation: 'server_config', statusCode: 500, error: 'Configuración de servidor incompleta' })
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
    logServerError(event, { endpoint: ENDPOINT, operation: 'session_verify', statusCode: 502, error: err })
    return json(502, { success: false, error: 'No se pudo verificar la sesión.' })
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
    logServerError(event, { endpoint: ENDPOINT, operation: 'validar_operacion_local_server_v1', statusCode: 502, error: gateError })
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

  const fechaReporte = fechaIsoDesdeGlaciar(analisis.metadata.fechaReporteTexto)
  let data: unknown
  let error: { message: string } | null
  let operation: string

  if (analisis.fuente === '0258') {
    const detalleItems = parsear0258(texto).filas.map((f) => ({
      cod_art: f.cod_art,
      descripcion: f.descripcion,
      marca: f.marca,
      contenido: f.contenido,
      unidad_medida: f.unidad_medida,
      bulto: f.bulto,
      dto_sec_fam: f.dto_sec_fam,
      costo_unitario: f.costo_unitario,
      costo_final: f.costo_final,
      precio_sugerido: f.precio_sugerido,
      precio_venta: f.precio_venta,
      stock_transito: f.stock_transito,
      stock: f.stock,
      per_ant_3: f.per_ant_3,
      per_ant_2: f.per_ant_2,
      per_ant_1: f.per_ant_1,
      ultimo_periodo: f.ultimo_periodo,
      venta_media_diaria: f.venta_media_diaria,
      fila_origen: f.linea,
    }))

    operation = 'aplicar_importacion_0258_masiva_v1'
    const res = await supabase.rpc(operation, {
      p_sucursal_id: sucursalId,
      p_usuario_id: uid,
      p_codigo_sucursal_fuente: codigoSucursal,
      p_nombre_archivo: nombreArchivo,
      p_archivo_sha256: archivoSha256,
      p_filas_total: analisis.parser.filas.length + analisis.parser.descartadas.length,
      p_filas_validas: analisis.parser.filas.length,
      p_filas_descartadas: analisis.parser.descartadas.length,
      p_items: items,
      p_detalle_items: detalleItems,
      p_fecha_reporte: fechaReporte,
    })
    data = res.data
    error = res.error
  } else {
    operation = 'aplicar_importacion_glaciar_masiva_v2'
    const res = await supabase.rpc(operation, {
      p_sucursal_id: sucursalId,
      p_usuario_id: uid,
      p_codigo_sucursal_fuente: codigoSucursal,
      p_nombre_archivo: nombreArchivo,
      p_archivo_sha256: archivoSha256,
      p_filas_total: analisis.parser.filas.length + analisis.parser.descartadas.length,
      p_filas_validas: analisis.parser.filas.length,
      p_filas_descartadas: analisis.parser.descartadas.length,
      p_items: items,
      p_fecha_reporte: fechaReporte,
    })
    data = res.data
    error = res.error
  }

  if (error) {
    const status = error.message.includes('permiso') ? 403 : 502
    if (status >= 500) {
      logServerError(event, { endpoint: ENDPOINT, operation, statusCode: status, error })
    }
    return json(status, {
      success: false,
      error: status === 403 ? error.message : 'No se pudo aplicar la importación.',
    })
  }

  return json(200, {
    success: true,
    encoding,
    fuente: analisis.fuente,
    codigo_sucursal: codigoSucursal,
    filas_validas: analisis.parser.filas.length,
    filas_descartadas: analisis.parser.descartadas.length,
    resultado: data,
  })
}

export { handler }