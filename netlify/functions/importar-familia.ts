import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { getCorsHeaders } from './_auth'
import { decodificarCsv } from '../../src/lib/importar-csv'
import { analizarReporteGlaciar } from '../../src/lib/importar-glaciar'
import { reconciliar, type FilaConciliada, type ProductoDb } from '../../src/lib/importar-reconciliacion'

interface DecisionInput {
  decision: 'mismo' | 'distinto'
  productoIdEsperado: string
}

interface Body {
  sucursalId?: string
  nombreArchivo?: string
  archivoBase64?: string
  decisiones?: Record<string, DecisionInput>
  familiasAprobadas?: string[]
}

interface ProductoCatalogoRow {
  id: string
  cod_art: string
  codigo_barras: string | null
  descripcion: string
  marca: string | null
  gramaje: string | null
  familia_id: string | null
}

interface EstadoLocalRow {
  producto_id: string
  stock_actual: number
  venta_media_diaria: number
}

interface OperacionImportacion {
  accion: 'actualizar' | 'insertar'
  producto_id: string | null
  cod_art: string
  descripcion: string
  marca: string
  gramaje: string | null
  stock: number
  venta_media_diaria: number
  fila_origen: number
  corregir_cod_art: boolean
  asignar_familia: boolean
}

function fechaIsoDesdeGlaciar(raw: string | null): string | null {
  if (!raw) return null
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

function enLotes<T>(items: T[], tam = 200): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += tam) out.push(items.slice(i, i + tam))
  return out
}

function aOperacionActualizar(
  fc: FilaConciliada,
  familiaId: string,
  aprobadas: Set<string>,
): OperacionImportacion {
  if (!fc.match) throw new Error(`Reconciliación inválida en línea ${fc.fila.linea}`)
  return {
    accion: 'actualizar',
    producto_id: fc.match.id,
    cod_art: fc.fila.cod_art,
    descripcion: fc.fila.descripcion,
    marca: fc.fila.marca,
    gramaje: fc.fila.gramaje,
    stock: fc.fila.stockCsv,
    venta_media_diaria: fc.fila.ventaMediaCsv,
    fila_origen: fc.fila.linea,
    corregir_cod_art: fc.estrategia === 'descripcion' && fc.match.cod_art !== fc.fila.cod_art,
    asignar_familia:
      fc.match.familia_id === null ||
      (fc.conflictoFamilia && aprobadas.has(fc.match.id) && fc.match.familia_id !== familiaId),
  }
}

function aOperacionInsertar(fc: FilaConciliada): OperacionImportacion {
  return {
    accion: 'insertar',
    producto_id: null,
    cod_art: fc.fila.cod_art,
    descripcion: fc.fila.descripcion,
    marca: fc.fila.marca,
    gramaje: fc.fila.gramaje,
    stock: fc.fila.stockCsv,
    venta_media_diaria: fc.fila.ventaMediaCsv,
    fila_origen: fc.fila.linea,
    corregir_cod_art: false,
    asignar_familia: true,
  }
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
  const decisiones = body.decisiones ?? {}
  const familiasAprobadas = new Set(body.familiasAprobadas ?? [])

  if (!sucursalId || !nombreArchivo || !archivoBase64) {
    return json(400, { success: false, error: 'Faltan sucursalId, nombreArchivo o archivoBase64' })
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
      error: 'El reporte no puede importarse.',
      errores: analisis.erroresBloqueantes,
      encoding,
    })
  }

  const codigoSucursal = analisis.metadata.codigoSucursal
  const codigoFamilia = analisis.parser.codigoFamilia ?? analisis.metadata.codigoFamilia
  if (!codigoSucursal || !codigoFamilia) {
    return json(400, { success: false, error: 'No se pudo verificar sucursal o Cód.Familia.' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const { data: sucursal, error: errSucursal } = await supabase
    .from('sucursales')
    .select('id, codigo, organizacion_id')
    .eq('id', sucursalId)
    .eq('activa', true)
    .maybeSingle()

  if (errSucursal || !sucursal) {
    return json(404, { success: false, error: 'Sucursal inexistente o inactiva.' })
  }
  if (sucursal.codigo !== codigoSucursal) {
    return json(409, {
      success: false,
      error: `El archivo corresponde a la sucursal ${codigoSucursal}, no a ${sucursal.codigo}.`,
    })
  }

  const { data: familia, error: errFamilia } = await supabase
    .from('familias')
    .select('id, codigo, nombre')
    .eq('organizacion_id', sucursal.organizacion_id)
    .eq('codigo', codigoFamilia)
    .maybeSingle()

  if (errFamilia || !familia) {
    return json(409, { success: false, error: `La familia ${codigoFamilia} no existe en la organización.` })
  }

  const codArts = Array.from(new Set(analisis.parser.filas.map((f) => f.cod_art)))
  const porId = new Map<string, ProductoCatalogoRow>()
  const sumar = (rows: ProductoCatalogoRow[] | null): void => {
    for (const p of rows ?? []) if (!porId.has(p.id)) porId.set(p.id, p)
  }
  const campos = 'id, cod_art, codigo_barras, descripcion, marca, gramaje, familia_id'

  for (const lote of enLotes(codArts)) {
    const [{ data: porCod, error: errCod }, { data: porEan, error: errEan }] = await Promise.all([
      supabase
        .from('productos')
        .select(campos)
        .eq('organizacion_id', sucursal.organizacion_id)
        .in('cod_art', lote),
      supabase
        .from('productos')
        .select(campos)
        .eq('organizacion_id', sucursal.organizacion_id)
        .in('codigo_barras', lote),
    ])
    if (errCod || errEan) {
      return json(502, { success: false, error: `No se pudo reconstruir la reconciliación: ${(errCod ?? errEan)?.message}` })
    }
    sumar((porCod ?? []) as ProductoCatalogoRow[])
    sumar((porEan ?? []) as ProductoCatalogoRow[])
  }

  const { data: porFamilia, error: errPorFamilia } = await supabase
    .from('productos')
    .select(campos)
    .eq('organizacion_id', sucursal.organizacion_id)
    .eq('familia_id', familia.id)
    .eq('activo', true)

  if (errPorFamilia) {
    return json(502, { success: false, error: `No se pudo cargar el catálogo de la familia: ${errPorFamilia.message}` })
  }
  sumar((porFamilia ?? []) as ProductoCatalogoRow[])

  const ids = Array.from(porId.keys())
  const estadoPorProducto = new Map<string, EstadoLocalRow>()
  for (const lote of enLotes(ids)) {
    const { data: estados, error: errEstados } = await supabase
      .from('producto_sucursal')
      .select('producto_id, stock_actual, venta_media_diaria')
      .eq('sucursal_id', sucursalId)
      .in('producto_id', lote)
    if (errEstados) {
      return json(502, { success: false, error: `No se pudo cargar el estado local: ${errEstados.message}` })
    }
    for (const estado of (estados ?? []) as EstadoLocalRow[]) estadoPorProducto.set(estado.producto_id, estado)
  }

  const candidatos: ProductoDb[] = Array.from(porId.values()).map((p) => {
    const estado = estadoPorProducto.get(p.id)
    return {
      id: p.id,
      cod_art: p.cod_art,
      codigo_barras: p.codigo_barras,
      descripcion: p.descripcion,
      marca: p.marca,
      gramaje: p.gramaje,
      familia_id: p.familia_id,
      stock_actual: estado?.stock_actual ?? 0,
      venta_media_diaria: estado?.venta_media_diaria ?? 0,
    }
  })

  const recon = reconciliar(analisis.parser.filas, candidatos, familia.id)
  const operaciones: OperacionImportacion[] = []
  const codArtCorregidos: Array<{ de: string; a: string; descripcion: string }> = []
  const insertadosConDecision: Array<{ codArt: string; descripcion: string; similarA: string }> = []

  for (const fc of recon.aActualizar) {
    operaciones.push(aOperacionActualizar(fc, familia.id, familiasAprobadas))
  }

  for (const fc of recon.aConfirmar) {
    const decision = decisiones[String(fc.fila.linea)]
    if (!decision) continue

    if (!fc.match || decision.productoIdEsperado !== fc.match.id) {
      return json(409, {
        success: false,
        error:
          `El catálogo cambió desde el preview en la línea ${fc.fila.linea}. ` +
          'No se aplicó ningún cambio. Volvé a cargar el archivo y revisá las coincidencias.',
      })
    }

    if (decision.decision === 'mismo') {
      operaciones.push(aOperacionActualizar(fc, familia.id, familiasAprobadas))
      if (fc.match.cod_art !== fc.fila.cod_art) {
        codArtCorregidos.push({ de: fc.match.cod_art, a: fc.fila.cod_art, descripcion: fc.match.descripcion })
      }
    } else if (decision.decision === 'distinto') {
      operaciones.push(aOperacionInsertar(fc))
      insertadosConDecision.push({
        codArt: fc.fila.cod_art,
        descripcion: fc.fila.descripcion,
        similarA: `${fc.match.cod_art} — ${fc.match.descripcion}`,
      })
    }
  }

  for (const fc of recon.nuevos) operaciones.push(aOperacionInsertar(fc))

  if (operaciones.length === 0) {
    return json(409, { success: false, error: 'No quedaron productos aprobados para importar.' })
  }

  const archivoSha256 = createHash('sha256').update(raw).digest('hex')
  const { data: aplicado, error: errAplicado } = await supabase.rpc('aplicar_importacion_glaciar_familia_v1', {
    p_sucursal_id: sucursalId,
    p_usuario_id: uid,
    p_codigo_sucursal_fuente: codigoSucursal,
    p_codigo_familia: codigoFamilia,
    p_nombre_archivo: nombreArchivo,
    p_archivo_sha256: archivoSha256,
    p_filas_total: analisis.parser.filas.length + analisis.parser.descartadas.length,
    p_filas_validas: analisis.parser.filas.length,
    p_filas_descartadas: analisis.parser.descartadas.length,
    p_operaciones: operaciones,
    p_fecha_reporte: fechaIsoDesdeGlaciar(analisis.metadata.fechaReporteTexto),
  })

  if (errAplicado) {
    console.error('[importar-familia] RPC error:', errAplicado)
    const status = /permiso|sucursal|familia/i.test(errAplicado.message) ? 403 : 409
    return json(status, { success: false, error: errAplicado.message })
  }

  return json(200, {
    success: true,
    encoding,
    codigo_sucursal: codigoSucursal,
    codigo_familia: codigoFamilia,
    resultado: aplicado,
    cod_art_corregidos: codArtCorregidos,
    insertados_con_decision: insertadosConDecision,
    excluidos_sin_decidir: recon.aConfirmar.filter((fc) => decisiones[String(fc.fila.linea)] === undefined).length,
  })
}

export { handler }
