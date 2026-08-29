import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from './_auth'
import { logServerError } from './_observability'

interface Body {
  sucursalId?: string
  productoIds?: string[]
}

interface CostoRow {
  producto_id: string
  costo_unitario: number | null
  observado_at: string
}

const ENDPOINT = 'costos-riesgo'
const MAX_PRODUCTOS = 500

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

  let body: Body
  try {
    body = JSON.parse(event.body ?? '{}') as Body
  } catch {
    return json(400, { success: false, error: 'JSON inválido' })
  }

  const sucursalId = body.sucursalId?.trim() ?? ''
  const solicitados = Array.from(new Set((body.productoIds ?? []).map((id) => id.trim()).filter(Boolean)))
  if (!sucursalId) return json(400, { success: false, error: 'Falta sucursalId' })
  if (solicitados.length === 0) return json(200, { success: true, costos: [] })
  if (solicitados.length > MAX_PRODUCTOS) return json(400, { success: false, error: 'Demasiados productos solicitados' })

  // La lista autorizada se resuelve con el JWT del usuario sobre la misma vista
  // operativa que consume el Dashboard. El service role sólo lee costos para la
  // intersección resultante; no decide alcance por sí mismo.
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: visibles, error: visiblesError } = await userClient
    .from('v_vencimientos_operativos')
    .select('producto_id')
    .eq('sucursal_id', sucursalId)
    .eq('activo', true)
    .in('producto_id', solicitados)

  if (visiblesError) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'scope_v_vencimientos_operativos', statusCode: 502, error: visiblesError })
    return json(502, { success: false, error: 'No se pudo validar el alcance de los costos.' })
  }

  const permitidos = Array.from(new Set((visibles ?? []).map((row) => String(row.producto_id))))
  if (permitidos.length === 0) return json(200, { success: true, costos: [] })

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const { data: costos, error: costosError } = await serviceClient
    .from('producto_costo_ultima_observacion')
    .select('producto_id, costo_unitario, observado_at')
    .in('producto_id', permitidos)

  if (costosError) {
    logServerError(event, { endpoint: ENDPOINT, operation: 'producto_costo_ultima_observacion', statusCode: 502, error: costosError })
    return json(502, { success: false, error: 'No se pudieron consultar los costos económicos.' })
  }

  const rows = ((costos ?? []) as CostoRow[])
    .filter((row) => row.costo_unitario != null && Number.isFinite(Number(row.costo_unitario)) && Number(row.costo_unitario) >= 0)
    .map((row) => ({
      producto_id: row.producto_id,
      costo_sin_iva: Number(row.costo_unitario),
      observado_at: row.observado_at,
    }))

  return json(200, { success: true, costos: rows, criterio: 'costo_unitario_sin_iva' })
}

export { handler }
