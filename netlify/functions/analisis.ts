import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from './_auth'

/**
 * analisis — genera un reporte en lenguaje natural (DeepSeek) sobre los
 * vencimientos del usuario. El rol y las familias se derivan server-side
 * desde el JWT (no se confía en lo que manda el cliente).
 */

const SUCURSAL_LEGACY = '00000000-0000-0000-0000-000000000001'

const SYSTEM_OPERADOR = `Sos un asistente experto en gestión de vencimientos para supermercados argentinos.
Analizás los datos de vencimientos y dás recomendaciones concretas y operativas.
Hablás en español rioplatense, de forma directa y clara.
Tu respuesta debe tener estas secciones:
1. Resumen de situación (2-3 oraciones)
2. Productos críticos (lista con acción específica para cada uno)
3. Recomendación principal del día
Sé conciso — máximo 300 palabras.`

const SYSTEM_ADMIN = `Sos un asistente experto en gestión de merma para supermercados argentinos.
Analizás datos de toda la sucursal y dás insights estratégicos al gerente.
Hablás en español rioplatense, de forma directa y profesional.
Tu respuesta debe tener estas secciones:
1. Estado general de la sucursal (2-3 oraciones)
2. Familias/sectores con mayor riesgo
3. Comparativa con trimestre (si hay datos de acciones_operativas)
4. Recomendación estratégica
Sé conciso — máximo 400 palabras.`

// ── Motor de riesgo (inline, espejo de src/lib/riesgo.ts) ─────────────
const UMBRAL_RADAR = 45
const UMBRAL_URGENTE = 20
const UMBRAL_DONACION = 10

function diasRestantes(fecha: string): number {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const v = new Date(fecha); v.setHours(0, 0, 0, 0)
  return Math.floor((v.getTime() - hoy.getTime()) / 86400000)
}

function calcularNivel(dias: number, cantidad: number, venta: number): string {
  const diasStock = venta <= 0 ? Infinity : Math.floor(cantidad / venta)
  const hayRiesgo = diasStock > dias
  if (dias <= 0) return 'decomiso'
  if (dias <= UMBRAL_DONACION) return 'donacion'
  if (dias <= UMBRAL_URGENTE && hayRiesgo) return 'urgente'
  if (dias <= UMBRAL_RADAR && hayRiesgo) return 'radar'
  return 'seguro'
}

interface VencRow {
  cantidad: number
  fecha_vencimiento: string
  productos: {
    descripcion: string
    marca: string | null
    venta_media_diaria: number
    familia_id: string | null
    categoria: string | null
  } | null
}

function getTrimestre(): { trimestre: number; anio: number } {
  const hoy = new Date()
  return { trimestre: Math.ceil((hoy.getMonth() + 1) / 3), anio: hoy.getFullYear() }
}

const ORDEN: Record<string, number> = { decomiso: 0, donacion: 1, urgente: 2, radar: 3, seguro: 4 }

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
  const deepseekKey = process.env.DEEPSEEK_API_KEY

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !deepseekKey) {
    console.error('[analisis] Faltan variables de entorno')
    return json(500, { success: false, error: 'Config de servidor incompleta' })
  }

  // 1. Auth: validar token → uid
  const authHeader = event.headers['authorization'] ?? event.headers['Authorization'] ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return json(401, { success: false, error: 'No autorizado: token ausente' })

  let uid: string
  try {
    const ures = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    })
    if (!ures.ok) return json(401, { success: false, error: 'No autorizado: token inválido' })
    const ud = (await ures.json()) as { id?: string }
    if (!ud.id) return json(401, { success: false, error: 'No autorizado' })
    uid = ud.id
  } catch (e: unknown) {
    return json(502, { success: false, error: `Error al verificar token: ${(e as Error).message}` })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  // 2. Rol, sucursal y familias — autoritativo desde la DB
  const { data: perfil } = await supabase
    .from('usuarios')
    .select('rol, sucursal_id')
    .eq('id', uid)
    .maybeSingle()
  const rol = (perfil?.rol as string) ?? 'operador'
  const sucursalId = (perfil?.sucursal_id as string | null) ?? SUCURSAL_LEGACY
  const esAdmin = rol === 'admin'

  let familiaIds: string[] = []
  if (!esAdmin) {
    const { data: ufs } = await supabase
      .from('usuario_familias')
      .select('familia_id')
      .eq('usuario_id', uid)
    familiaIds = (ufs ?? []).map((u) => u.familia_id as string)
    if (familiaIds.length === 0) {
      return json(200, {
        success: true,
        analisis:
          'Todavía no tenés familias asignadas, así que no hay datos para analizar. Pedile al administrador que te asigne tus sectores.',
        generado_en: new Date().toISOString(),
      })
    }
  }

  // 3. Vencimientos activos de la sucursal (+ productos)
  const { data: rows, error: vErr } = await supabase
    .from('vencimientos')
    .select('cantidad, fecha_vencimiento, productos(descripcion, marca, venta_media_diaria, familia_id, categoria)')
    .eq('activo', true)
    .eq('sucursal_id', sucursalId)
  if (vErr) return json(502, { success: false, error: `Error al leer vencimientos: ${vErr.message}` })

  let vencs = ((rows ?? []) as unknown as VencRow[]).filter((r) => r.productos !== null)
  if (!esAdmin) {
    vencs = vencs.filter((r) => r.productos!.familia_id !== null && familiaIds.includes(r.productos!.familia_id))
  }

  // Nombres de familia para el prompt
  const famIds = Array.from(new Set(vencs.map((r) => r.productos!.familia_id).filter((x): x is string => !!x)))
  const famNombre = new Map<string, string>()
  if (famIds.length > 0) {
    const { data: fams } = await supabase.from('familias').select('id, nombre').in('id', famIds)
    for (const f of fams ?? []) famNombre.set(f.id as string, f.nombre as string)
  }

  // Totales del trimestre
  const { trimestre, anio } = getTrimestre()
  const { data: acc } = await supabase
    .from('acciones_operativas')
    .select('tipo, cantidad')
    .eq('sucursal_id', sucursalId)
    .eq('trimestre', trimestre)
    .eq('anio', anio)
  const totalDonacion = (acc ?? []).filter((a) => a.tipo === 'donacion').reduce((s, a) => s + (a.cantidad as number), 0)
  const totalDecomiso = (acc ?? []).filter((a) => a.tipo === 'decomiso').reduce((s, a) => s + (a.cantidad as number), 0)

  // 4. Construir prompt con datos reales
  const procesados = vencs
    .map((r) => {
      const dias = diasRestantes(r.fecha_vencimiento)
      const nivel = calcularNivel(dias, r.cantidad, r.productos!.venta_media_diaria)
      return { ...r, dias, nivel }
    })
    .sort((a, b) => (ORDEN[a.nivel] - ORDEN[b.nivel]) || (a.dias - b.dias))
    .slice(0, 60)

  const hoyStr = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())
  const lineas = procesados.map((r) => {
    const p = r.productos!
    const fam = p.familia_id ? (famNombre.get(p.familia_id) ?? '—') : '—'
    const venta = p.venta_media_diaria > 0 ? `${p.venta_media_diaria} u/día` : 'sin rotación'
    const vence = r.dias < 0 ? `vencido hace ${Math.abs(r.dias)} días` : r.dias === 0 ? 'vence hoy' : `vence en ${r.dias} días`
    return `- ${p.descripcion}${p.marca ? ` (${p.marca})` : ''} | familia: ${fam} | nivel: ${r.nivel} | ${vence} | cantidad: ${r.cantidad} | ${venta}`
  })

  const datosFormateados = [
    `Fecha de hoy: ${hoyStr}`,
    `Ámbito: ${esAdmin ? 'toda la sucursal' : 'familias asignadas del operador'}`,
    '',
    `Vencimientos activos (${procesados.length}${vencs.length > procesados.length ? ` de ${vencs.length}` : ''}):`,
    lineas.length > 0 ? lineas.join('\n') : '(sin vencimientos activos)',
    '',
    `Acciones del trimestre Q${trimestre} ${anio}:`,
    `- Donación: ${totalDonacion} unidades`,
    `- Decomiso: ${totalDecomiso} unidades`,
  ].join('\n')

  // 5. Llamar a DeepSeek
  let analisis: string
  try {
    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: esAdmin ? SYSTEM_ADMIN : SYSTEM_OPERADOR },
          { role: 'user', content: datosFormateados },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    })
    if (!dsRes.ok) {
      const errTxt = await dsRes.text().catch(() => '')
      console.error('[analisis] DeepSeek error', dsRes.status, errTxt)
      return json(502, { success: false, error: `Error del modelo de análisis (${dsRes.status})` })
    }
    const dsData = (await dsRes.json()) as { choices?: Array<{ message?: { content?: string } }> }
    analisis = dsData.choices?.[0]?.message?.content?.trim() ?? ''
    if (!analisis) return json(502, { success: false, error: 'El modelo no devolvió contenido' })
  } catch (e: unknown) {
    return json(502, { success: false, error: `Error al contactar el modelo: ${(e as Error).message}` })
  }

  return json(200, { success: true, analisis, generado_en: new Date().toISOString() })
}

export { handler }
