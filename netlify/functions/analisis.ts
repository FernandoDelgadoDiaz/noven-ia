import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from './_auth'

/**
 * analisis — genera un reporte en lenguaje natural (DeepSeek) sobre los
 * vencimientos del usuario. El rol y las familias se derivan server-side
 * desde el JWT (no se confía en lo que manda el cliente).
 */

const SUCURSAL_LEGACY = '00000000-0000-0000-0000-000000000001'

const SYSTEM_OPERADOR = `Usted es un consultor especializado en gestión de vencimientos y control de merma para comercios minoristas de alimentación.
Analiza los datos históricos y actuales de vencimientos para proporcionar recomendaciones constructivas y fundamentadas.

REGLAS:
- Utilice un tono formal y profesional en todo momento
- Base sus recomendaciones SIEMPRE en los cálculos de merma estimada provistos
- Identifique patrones históricos: productos que se repiten en donaciones o decomisos
- Compare el período actual con el anterior cuando haya datos disponibles
- No invente porcentajes de descuento sin respaldo en datos
- Explique el razonamiento detrás de cada recomendación
- Máximo 350 palabras

Estructura del informe:
1. Situación actual (datos concretos de merma estimada)
2. Análisis histórico (patrones detectados en trimestres anteriores)
3. Productos que requieren acción inmediata (con justificación basada en cálculos)
4. Recomendaciones constructivas (acciones específicas y medibles)`

const SYSTEM_ADMIN = `Usted es un consultor estratégico especializado en gestión de merma y control de vencimientos para cadenas de supermercados.
Analiza el desempeño operativo de toda la sucursal comparando datos históricos y actuales.

REGLAS:
- Utilice un tono formal y profesional en todo momento
- Base sus análisis en los cálculos de merma estimada y datos históricos provistos
- Identifique tendencias entre trimestres
- Señale familias o sectores con merma estructural (problema recurrente)
- Cuantifique el impacto en unidades cuando sea posible
- Proporcione recomendaciones estratégicas accionables
- Máximo 450 palabras

Estructura del informe:
1. Estado general de la sucursal (métricas clave)
2. Comparativa trimestral (evolución de merma)
3. Familias con mayor riesgo estructural
4. Análisis de patrones históricos
5. Recomendaciones estratégicas con fundamento`

// ── Motor de riesgo (inline) ───────────────────────────────────────────
// NOTA: src/lib/riesgo.ts es exclusivamente frontend y no puede importarse
// aquí en build time de Netlify Functions. Esta copia inline se extiende
// (no se agrega una cuarta copia) para incluir el cálculo de merma estimada.
// Si en el futuro se extrae a shared/, borrar estas funciones y redirigir.
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

interface MermaCalc {
  unidadesVenderANormal: number
  mermaUnidades: number
  mermaPorcentaje: number
  accion: string
}

function calcularMerma(cantidad: number, ventaMedia: number, dias: number): MermaCalc {
  const unidadesVenderANormal = ventaMedia * Math.max(0, dias)
  const mermaUnidades = Math.max(0, cantidad - unidadesVenderANormal)
  const mermaPorcentaje = cantidad > 0 ? (mermaUnidades / cantidad) * 100 : 100

  let accion: string
  if (mermaPorcentaje <= 20) {
    accion = 'MONITOREAR — merma estimada baja, precio normal'
  } else if (mermaPorcentaje <= 50) {
    accion = 'OFERTA LEVE — merma estimada media, reubicación + descuento leve'
  } else if (mermaPorcentaje <= 80) {
    accion = 'PROMOCIÓN AGRESIVA — merma estimada alta, descuento fuerte + punta de góndola'
  } else {
    accion = 'DONACIÓN INEVITABLE — merma >80%, no hay rebaja que lo salve'
  }

  return { unidadesVenderANormal, mermaUnidades, mermaPorcentaje, accion }
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

interface AccionRow {
  tipo: string
  cantidad: number
  trimestre: number
  anio: number
  productos: { descripcion: string; familia_id: string | null } | null
}

function getTrimestre(): { trimestre: number; anio: number } {
  const hoy = new Date()
  return { trimestre: Math.ceil((hoy.getMonth() + 1) / 3), anio: hoy.getFullYear() }
}

// Resume las acciones de un trimestre por tipo, agrupando por producto para
// exponer cuántas veces se repite cada uno (base de "patrones repetidos").
function resumirAcciones(acciones: AccionRow[], tipo: string) {
  const items = acciones.filter((a) => a.tipo === tipo)
  const total = items.reduce((s, a) => s + (a.cantidad ?? 0), 0)
  const porProducto = new Map<string, { cantidad: number; veces: number }>()
  for (const a of items) {
    const nombre = a.productos?.descripcion ?? '(sin producto)'
    const prev = porProducto.get(nombre) ?? { cantidad: 0, veces: 0 }
    porProducto.set(nombre, { cantidad: prev.cantidad + (a.cantidad ?? 0), veces: prev.veces + 1 })
  }
  return { total, registros: items.length, porProducto }
}

// Top N productos de un resumen, ordenados por cantidad total descendente.
function topProductos(porProducto: Map<string, { cantidad: number; veces: number }>, n = 5) {
  return Array.from(porProducto.entries())
    .sort((a, b) => b[1].cantidad - a[1].cantidad)
    .slice(0, n)
}

function comparativa(actual: number, anterior: number): string {
  if (anterior === 0) return actual === 0 ? 'sin variación (0 en ambos)' : `+${actual} u (sin base previa)`
  const delta = actual - anterior
  const pct = ((delta / anterior) * 100).toFixed(0)
  const signo = delta > 0 ? '+' : ''
  return `${signo}${delta} u (${signo}${pct}% vs. período anterior)`
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

  // Histórico de acciones_operativas: trimestre actual + anterior
  const { trimestre: trimestreActual, anio: anioActual } = getTrimestre()
  const trimestreAnterior = trimestreActual === 1 ? 4 : trimestreActual - 1
  const anioAnterior = trimestreActual === 1 ? anioActual - 1 : anioActual

  const accionSelect = 'tipo, cantidad, trimestre, anio, productos(descripcion, familia_id)'
  const [{ data: accActualRaw }, { data: accAnteriorRaw }] = await Promise.all([
    supabase.from('acciones_operativas').select(accionSelect)
      .eq('sucursal_id', sucursalId).eq('trimestre', trimestreActual).eq('anio', anioActual),
    supabase.from('acciones_operativas').select(accionSelect)
      .eq('sucursal_id', sucursalId).eq('trimestre', trimestreAnterior).eq('anio', anioAnterior),
  ])

  // El operador solo ve el histórico de sus familias asignadas (mismo criterio
  // de scope que los vencimientos activos). El admin ve toda la sucursal.
  const scope = (a: AccionRow) =>
    esAdmin || (a.productos?.familia_id != null && familiaIds.includes(a.productos.familia_id))
  const accActual = ((accActualRaw ?? []) as unknown as AccionRow[]).filter(scope)
  const accAnterior = ((accAnteriorRaw ?? []) as unknown as AccionRow[]).filter(scope)

  const donActual = resumirAcciones(accActual, 'donacion')
  const decActual = resumirAcciones(accActual, 'decomiso')
  const donAnterior = resumirAcciones(accAnterior, 'donacion')
  const decAnterior = resumirAcciones(accAnterior, 'decomiso')

  // Patrones repetidos: mismo producto+tipo que aparece en ≥2 registros a lo
  // largo de ambos trimestres (señal de merma estructural / recurrente).
  const patronMap = new Map<string, { tipo: string; producto: string; veces: number; cantidad: number }>()
  for (const a of [...accActual, ...accAnterior]) {
    const producto = a.productos?.descripcion ?? '(sin producto)'
    const key = `${a.tipo}::${producto}`
    const prev = patronMap.get(key) ?? { tipo: a.tipo, producto, veces: 0, cantidad: 0 }
    patronMap.set(key, { ...prev, veces: prev.veces + 1, cantidad: prev.cantidad + (a.cantidad ?? 0) })
  }
  const patronesRepetidos = Array.from(patronMap.values())
    .filter((p) => p.veces >= 2)
    .sort((a, b) => b.veces - a.veces || b.cantidad - a.cantidad)
    .slice(0, 8)

  // 4. Construir prompt con datos reales + cálculo de merma estimada
  const procesados = vencs
    .map((r) => {
      const dias = diasRestantes(r.fecha_vencimiento)
      const nivel = calcularNivel(dias, r.cantidad, r.productos!.venta_media_diaria)
      const merma = calcularMerma(r.cantidad, r.productos!.venta_media_diaria, dias)
      return { ...r, dias, nivel, merma }
    })
    .sort((a, b) => (ORDEN[a.nivel] - ORDEN[b.nivel]) || (a.dias - b.dias))
    .slice(0, 60)

  const hoyStr = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())
  const lineas = procesados.map((r) => {
    const p = r.productos!
    const fam = p.familia_id ? (famNombre.get(p.familia_id) ?? '—') : '—'
    const ventaStr = p.venta_media_diaria > 0 ? `${p.venta_media_diaria} u/día` : 'sin rotación'
    const vence = r.dias < 0 ? `vencido hace ${Math.abs(r.dias)} días` : r.dias === 0 ? 'vence hoy' : `vence en ${r.dias} días`
    const m = r.merma
    return [
      `Producto: ${p.descripcion}${p.marca ? ` (${p.marca})` : ''}`,
      `  Familia: ${fam} | Nivel de riesgo: ${r.nivel}`,
      `  Días restantes: ${vence}`,
      `  Stock actual: ${r.cantidad} unidades`,
      `  Venta media: ${ventaStr}`,
      `  Unidades que se venderían a precio normal: ${Math.round(m.unidadesVenderANormal)}`,
      `  Merma estimada: ${Math.round(m.mermaUnidades)} unidades (${m.mermaPorcentaje.toFixed(1)}%)`,
      `  Acción calculada: ${m.accion}`,
    ].join('\n')
  })

  // Formateo del histórico por trimestre (con top de productos por acción)
  const fmtTop = (top: Array<[string, { cantidad: number; veces: number }]>) =>
    top.length > 0
      ? top.map(([n, v]) => `    · ${n}: ${v.cantidad} u (${v.veces} ${v.veces === 1 ? 'registro' : 'registros'})`).join('\n')
      : '    · (sin registros)'

  const bloqueTrimestre = (
    etiqueta: string,
    don: ReturnType<typeof resumirAcciones>,
    dec: ReturnType<typeof resumirAcciones>,
  ) =>
    [
      etiqueta,
      `- Donaciones: ${don.total} unidades en ${don.registros} registros`,
      fmtTop(topProductos(don.porProducto)),
      `- Decomisos: ${dec.total} unidades en ${dec.registros} registros`,
      fmtTop(topProductos(dec.porProducto)),
    ].join('\n')

  const bloquePatrones = patronesRepetidos.length > 0
    ? patronesRepetidos
        .map((p) => `- ${p.producto} — ${p.tipo} ${p.veces} veces (total ${p.cantidad} u) en el período analizado`)
        .join('\n')
    : '- No se detectaron productos repetidos entre los registros disponibles.'

  const datosFormateados = [
    `Fecha de hoy: ${hoyStr}`,
    `Ámbito: ${esAdmin ? 'toda la sucursal' : 'familias asignadas del operador'}`,
    '',
    `Vencimientos activos (${procesados.length}${vencs.length > procesados.length ? ` de ${vencs.length}` : ''}):`,
    lineas.length > 0 ? lineas.join('\n\n') : '(sin vencimientos activos)',
    '',
    '=== ANÁLISIS HISTÓRICO DE ACCIONES OPERATIVAS ===',
    '',
    bloqueTrimestre(`Trimestre ACTUAL (Q${trimestreActual} ${anioActual}):`, donActual, decActual),
    '',
    bloqueTrimestre(`Trimestre ANTERIOR (Q${trimestreAnterior} ${anioAnterior}):`, donAnterior, decAnterior),
    '',
    'Comparativa trimestral (actual vs. anterior):',
    `- Donaciones: ${comparativa(donActual.total, donAnterior.total)}`,
    `- Decomisos: ${comparativa(decActual.total, decAnterior.total)}`,
    '',
    'Patrones repetidos detectados (mismo producto en ≥2 registros):',
    bloquePatrones,
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
        max_tokens: 1300,
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
