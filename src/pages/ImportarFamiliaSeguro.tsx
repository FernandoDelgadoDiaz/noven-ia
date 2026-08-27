import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  Copy,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSucursalActual } from '@/hooks/useSucursalActual'
import {
  decodificarCsv,
  similaridad,
  type EncodingDetectado,
  type ResultadoParser,
} from '@/lib/importar-csv'
import { analizarReporteGlaciar } from '@/lib/importar-glaciar'
import {
  reconciliar,
  type FilaConciliada,
  type Huerfano,
  type MotivoCodArt,
  type ProductoDb,
  type Reconciliacion,
} from '@/lib/importar-reconciliacion'

interface FamiliaInfo {
  id: string
  codigo: string
  nombre: string
}

interface SucursalInfo {
  codigo: string
  nombre: string
  organizacion_id: string
}

interface ProductoCatalogoRow {
  id: string
  cod_art: string
  codigo_barras: string | null
  descripcion: string
  marca: string | null
  gramaje: string | null
  familia_id: string | null
  activo: boolean
}

interface EstadoLocalRow {
  producto_id: string
  stock_actual: number
  venta_media_diaria: number
}

type DecisionSimilar = 'mismo' | 'distinto'

interface AvisoSimilar {
  linea: number
  codArt: string
  descripcion: string
  producto: ProductoDb
  score: number
}

interface Preview {
  parser: ResultadoParser
  familia: FamiliaInfo
  sucursal: SucursalInfo
  reconciliacion: Reconciliacion
  familias: Map<string, FamiliaInfo>
  avisosSimilares: AvisoSimilar[]
  encoding: EncodingDetectado
}

interface ResultadoServidor {
  duplicada?: boolean
  importacion_id?: string
  estado?: string
  actualizados?: number
  nuevos?: number
  aplicadas?: number
}

interface RespuestaServidor {
  success: boolean
  error?: string
  errores?: string[]
  resultado?: ResultadoServidor
  cod_art_corregidos?: Array<{ de: string; a: string; descripcion: string }>
  insertados_con_decision?: Array<{ codArt: string; descripcion: string; similarA: string }>
  excluidos_sin_decidir?: number
}

interface ResultadoUi {
  duplicada: boolean
  importacionId: string | null
  actualizados: number
  nuevos: number
  codArtCorregidos: Array<{ de: string; a: string; descripcion: string }>
  insertadosConSimilar: Array<{ codArt: string; descripcion: string; similarA: string }>
  excluidosSinDecidir: number
}

const UMBRAL_AVISO = 0.7
const MAX_ARCHIVO_BYTES = 4_500_000

const ETIQUETA_COD_ART: Record<Exclude<MotivoCodArt, null>, string> = {
  sin_asignar: 'cod_art sin asignar',
  ean: 'cod_art es un EAN',
  formato_invalido: 'cod_art inválido',
}

const ETIQUETA_ESTRATEGIA: Record<string, string> = {
  cod_art: 'Cód.',
  codigo_barras: 'EAN',
  descripcion: 'Descr.',
}

function enLotes<T>(items: T[], tam = 200): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += tam) out.push(items.slice(i, i + tam))
  return out
}

function archivoABase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '')
      const comma = dataUrl.indexOf(',')
      if (comma < 0) reject(new Error('No se pudo codificar el archivo.'))
      else resolve(dataUrl.slice(comma + 1))
    }
    reader.readAsDataURL(file)
  })
}

export default function ImportarFamiliaSeguro() {
  const navigate = useNavigate()
  const { sucursalId, loading: sucursalLoading, requiereSeleccionSucursal } = useSucursalActual()
  const inputRef = useRef<HTMLInputElement>(null)

  const [archivo, setArchivo] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [familiaConfirmada, setFamiliaConfirmada] = useState(false)
  const [decisiones, setDecisiones] = useState<Record<number, DecisionSimilar>>({})
  const [familiasAprobadas, setFamiliasAprobadas] = useState<Set<string>>(new Set())
  const [verDescartadas, setVerDescartadas] = useState(false)
  const [resultado, setResultado] = useState<ResultadoUi | null>(null)
  const [copiado, setCopiado] = useState(false)

  function reset(): void {
    setArchivo(null)
    setPreview(null)
    setFamiliaConfirmada(false)
    setDecisiones({})
    setFamiliasAprobadas(new Set())
    setResultado(null)
    setError(null)
    setVerDescartadas(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const procesarArchivo = useCallback(async (file: File): Promise<void> => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('El archivo debe ser un CSV exportado desde Reposición Asistida de Glaciar.')
      return
    }
    if (!sucursalId) {
      setError('No hay una sucursal operativa seleccionada.')
      return
    }
    if (file.size > MAX_ARCHIVO_BYTES) {
      setError('El archivo es demasiado grande para esta carga web. No se escribió nada.')
      return
    }

    setArchivo(file)
    setProcesando(true)
    setError(null)
    setPreview(null)
    setResultado(null)
    setFamiliaConfirmada(false)
    setDecisiones({})
    setFamiliasAprobadas(new Set())

    try {
      const [{ data: sucData, error: sucError }, buffer] = await Promise.all([
        supabase
          .from('sucursales')
          .select('codigo, nombre, organizacion_id')
          .eq('id', sucursalId)
          .eq('activa', true)
          .maybeSingle(),
        file.arrayBuffer(),
      ])
      if (sucError) throw new Error(`No se pudo verificar la sucursal: ${sucError.message}`)
      if (!sucData) throw new Error('No se encontró la sucursal actual.')
      const sucursal = sucData as SucursalInfo

      const { texto, encoding } = decodificarCsv(buffer)
      const analisis = analizarReporteGlaciar(texto, { modo: 'familia' })
      if (analisis.erroresBloqueantes.length > 0) {
        throw new Error(analisis.erroresBloqueantes.join(' '))
      }

      const codigoSucursalFuente = analisis.metadata.codigoSucursal
      if (!codigoSucursalFuente) throw new Error('No se pudo identificar Cod.Suc.Padrón en el archivo.')
      if (codigoSucursalFuente !== sucursal.codigo) {
        throw new Error(
          `Este archivo es de la sucursal ${codigoSucursalFuente}, pero estás trabajando en la sucursal ${sucursal.codigo}. No se escribió nada.`,
        )
      }

      const codigoFamilia = analisis.parser.codigoFamilia ?? analisis.metadata.codigoFamilia
      if (!codigoFamilia) throw new Error('No se pudo identificar Cód.Familia en el archivo.')

      const { data: familiasData, error: familiasError } = await supabase
        .from('familias')
        .select('id, codigo, nombre')
        .eq('organizacion_id', sucursal.organizacion_id)
      if (familiasError) throw new Error(`No se pudieron consultar las familias: ${familiasError.message}`)

      const familiasRows = (familiasData ?? []) as unknown as FamiliaInfo[]
      const familia = familiasRows.find((f) => f.codigo === codigoFamilia)
      if (!familia) {
        throw new Error(`La familia ${codigoFamilia} no está dada de alta en esta organización.`)
      }
      const familias = new Map(familiasRows.map((f) => [f.id, f]))

      const codArts = Array.from(new Set(analisis.parser.filas.map((f) => f.cod_art)))
      const catalogoPorId = new Map<string, ProductoCatalogoRow>()
      const sumarCatalogo = (rows: unknown): void => {
        for (const p of (rows ?? []) as ProductoCatalogoRow[]) {
          if (!catalogoPorId.has(p.id)) catalogoPorId.set(p.id, p)
        }
      }
      const camposCatalogo = 'id, cod_art, codigo_barras, descripcion, marca, gramaje, familia_id, activo'

      for (const lote of enLotes(codArts)) {
        const [{ data: porCod, error: errCod }, { data: porEan, error: errEan }] = await Promise.all([
          supabase
            .from('v_productos_catalogo')
            .select(camposCatalogo)
            .eq('organizacion_id', sucursal.organizacion_id)
            .in('cod_art', lote),
          supabase
            .from('v_productos_catalogo')
            .select(camposCatalogo)
            .eq('organizacion_id', sucursal.organizacion_id)
            .in('codigo_barras', lote),
        ])
        if (errCod || errEan) {
          throw new Error(`No se pudo consultar el catálogo: ${(errCod ?? errEan)?.message}`)
        }
        sumarCatalogo(porCod)
        sumarCatalogo(porEan)
      }

      const { data: deLaFamilia, error: familiaProdsError } = await supabase
        .from('v_productos_catalogo')
        .select(camposCatalogo)
        .eq('organizacion_id', sucursal.organizacion_id)
        .eq('familia_id', familia.id)
        .eq('activo', true)
      if (familiaProdsError) {
        throw new Error(`No se pudo consultar el catálogo de la familia: ${familiaProdsError.message}`)
      }
      sumarCatalogo(deLaFamilia)

      const ids = Array.from(catalogoPorId.keys())
      const estadoPorProducto = new Map<string, EstadoLocalRow>()
      for (const lote of enLotes(ids)) {
        if (lote.length === 0) continue
        const { data: estados, error: estadoError } = await supabase
          .from('v_producto_sucursal_operativo')
          .select('producto_id, stock_actual, venta_media_diaria')
          .eq('sucursal_id', sucursalId)
          .in('producto_id', lote)
        if (estadoError) throw new Error(`No se pudo consultar el estado de la sucursal: ${estadoError.message}`)
        for (const estado of (estados ?? []) as unknown as EstadoLocalRow[]) {
          estadoPorProducto.set(estado.producto_id, estado)
        }
      }

      const candidatos: ProductoDb[] = Array.from(catalogoPorId.values()).map((p) => {
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

      const base = reconciliar(analisis.parser.filas, candidatos, familia.id)
      const idsConEstadoLocal = new Set(estadoPorProducto.keys())
      const reconciliacion: Reconciliacion = {
        ...base,
        huerfanos: base.huerfanos.filter((h) => idsConEstadoLocal.has(h.producto.id)),
      }

      const avisosSimilares: AvisoSimilar[] = []
      for (const fc of reconciliacion.nuevos) {
        let mejor: ProductoDb | null = null
        let mejorScore = 0
        for (const p of candidatos) {
          const score = similaridad(fc.fila.descripcion, p.descripcion)
          if (score > mejorScore) {
            mejor = p
            mejorScore = score
          }
        }
        if (mejor && mejorScore >= UMBRAL_AVISO) {
          avisosSimilares.push({
            linea: fc.fila.linea,
            codArt: fc.fila.cod_art,
            descripcion: fc.fila.descripcion,
            producto: mejor,
            score: mejorScore,
          })
        }
      }
      avisosSimilares.sort((a, b) => b.score - a.score)

      setPreview({
        parser: analisis.parser,
        familia,
        sucursal,
        reconciliacion,
        familias,
        avisosSimilares,
        encoding,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setProcesando(false)
    }
  }, [sucursalId])

  async function aplicar(): Promise<void> {
    if (!archivo || !preview || !sucursalId) return

    const { reconciliacion } = preview
    const totalAEscribir =
      reconciliacion.aActualizar.length +
      reconciliacion.nuevos.length +
      reconciliacion.aConfirmar.filter((fc) => decisiones[fc.fila.linea] !== undefined).length
    if (totalAEscribir === 0) {
      setError('No hay productos aprobados para importar.')
      return
    }

    setAplicando(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('La sesión expiró. Volvé a iniciar sesión.')

      const decisionesServidor = Object.fromEntries(
        reconciliacion.aConfirmar
          .filter((fc) => Boolean(decisiones[fc.fila.linea]) && Boolean(fc.match))
          .map((fc) => [
            String(fc.fila.linea),
            {
              decision: decisiones[fc.fila.linea],
              productoIdEsperado: fc.match!.id,
            },
          ]),
      )

      const archivoBase64 = await archivoABase64(archivo)
      const response = await fetch('/.netlify/functions/importar-familia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sucursalId,
          nombreArchivo: archivo.name,
          archivoBase64,
          decisiones: decisionesServidor,
          familiasAprobadas: Array.from(familiasAprobadas),
        }),
      })
      const body = await response.json() as RespuestaServidor
      if (!response.ok || !body.success) {
        throw new Error(body.errores?.join(' ') || body.error || 'No se pudo aplicar la importación.')
      }

      const r = body.resultado ?? {}
      const insertadosConDecision = body.insertados_con_decision ?? []
      const avisosDeNuevos = preview.avisosSimilares.map((a) => ({
        codArt: a.codArt,
        descripcion: a.descripcion,
        similarA: `${a.producto.cod_art} — ${a.producto.descripcion} (${Math.round(a.score * 100)}%)`,
      }))

      setResultado({
        duplicada: Boolean(r.duplicada),
        importacionId: r.importacion_id ?? null,
        actualizados: Number(r.actualizados ?? 0),
        nuevos: Number(r.nuevos ?? 0),
        codArtCorregidos: body.cod_art_corregidos ?? [],
        insertadosConSimilar: [...insertadosConDecision, ...avisosDeNuevos],
        excluidosSinDecidir: Number(body.excluidos_sin_decidir ?? 0),
      })
    } catch (err) {
      setError(`${err instanceof Error ? err.message : String(err)} No se aplicaron cambios parciales.`)
    } finally {
      setAplicando(false)
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void procesarArchivo(file)
  }

  function nombreFamilia(id: string | null): string {
    if (!preview) return 'familia desconocida'
    if (id === null) return 'sin familia'
    const f = preview.familias.get(id)
    return f ? `${f.codigo} ${f.nombre}` : 'familia desconocida'
  }

  function armarReporteTexto(): string {
    if (!preview || !resultado || !archivo) return ''
    const { reconciliacion, familia, sucursal, parser } = preview
    const lineas = [
      `IMPORTACIÓN GLACIAR · SUCURSAL ${sucursal.codigo} · FAMILIA ${familia.codigo} ${familia.nombre}`,
      `Archivo: ${archivo.name}`,
      `Importación: ${resultado.importacionId ?? '—'}`,
      `Resultado: ${resultado.duplicada ? 'archivo ya aplicado anteriormente' : 'aplicada atómicamente'}`,
      `Actualizados: ${resultado.actualizados}`,
      `Nuevos: ${resultado.nuevos}`,
      `Coincidencias sin decidir excluidas: ${resultado.excluidosSinDecidir}`,
    ]

    if (reconciliacion.huerfanos.length > 0) {
      lineas.push('', `PRODUCTOS LOCALES QUE NO VINIERON EN EL CSV (${reconciliacion.huerfanos.length})`)
      for (const h of reconciliacion.huerfanos) {
        lineas.push(`- ${h.producto.cod_art} · ${h.producto.descripcion} · stock ${h.producto.stock_actual}`)
      }
    }
    if (resultado.codArtCorregidos.length > 0) {
      lineas.push('', `CÓDIGOS CORREGIDOS (${resultado.codArtCorregidos.length})`)
      for (const c of resultado.codArtCorregidos) lineas.push(`- ${c.descripcion}: ${c.de} → ${c.a}`)
    }
    if (parser.descartadas.length > 0) {
      lineas.push('', `FILAS DESCARTADAS (${parser.descartadas.length})`)
      for (const d of parser.descartadas) lineas.push(`- línea ${d.linea} · ${d.codArt} · ${d.motivo}`)
    }
    return lineas.join('\n')
  }

  async function copiarReporte(): Promise<void> {
    try {
      await navigator.clipboard.writeText(armarReporteTexto())
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  const rec = preview?.reconciliacion ?? null
  const sinDecidir = rec
    ? rec.aConfirmar.filter((fc) => decisiones[fc.fila.linea] === undefined).length
    : 0
  const totalAEscribir = rec
    ? rec.aActualizar.length + rec.nuevos.length + rec.aConfirmar.filter((fc) => decisiones[fc.fila.linea] !== undefined).length
    : 0
  const descartadas = preview?.parser.descartadas ?? []

  const thCls = 'text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-2.5'
  const tdCls = 'px-4 py-2.5 text-xs'

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-10 bg-white border-b border-border/40 px-4 md:px-8 py-4 md:py-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/importar')}
            className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-none">Importar una familia</h1>
            <p className="text-sm text-muted-foreground mt-1">Preview local + aplicación atómica en servidor</p>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 py-5 md:py-6 max-w-5xl space-y-4 pb-28">
        <div className="bg-brand-light border border-brand/20 rounded-card p-4 flex items-start gap-3">
          <FileText className="h-5 w-5 text-brand shrink-0 mt-0.5" />
          <div>
            <p className="text-foreground font-semibold text-sm">La confirmación no escribe producto por producto desde el navegador</p>
            <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
              Noven vuelve a validar sucursal, familia, catálogo y tus decisiones antes de aplicar todo en una sola transacción.
              Si algo cambió desde el preview, no se aplica nada.
            </p>
          </div>
        </div>

        {sucursalLoading && (
          <div className="bg-white rounded-card shadow-card p-5 flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-brand animate-spin" />
            <p className="text-sm text-muted-foreground">Resolviendo sucursal...</p>
          </div>
        )}

        {!sucursalLoading && requiereSeleccionSucursal && (
          <div className="bg-amber-50 border border-amber-200 rounded-card p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">Seleccioná una sucursal antes de importar.</p>
          </div>
        )}

        {!archivo && !sucursalLoading && sucursalId && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onClick={() => inputRef.current?.click()}
            className={[
              'rounded-[24px] p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 border',
              dragging
                ? 'border-brand bg-brand-light shadow-brand'
                : 'border-border/60 bg-white shadow-card hover:shadow-elevated hover:border-brand/40',
            ].join(' ')}
          >
            <div className={`p-4 rounded-[18px] ${dragging ? 'bg-brand/10' : 'bg-muted'}`}>
              <Upload className={`h-10 w-10 ${dragging ? 'text-brand' : 'text-muted-foreground'}`} />
            </div>
            <div className="text-center">
              <p className="text-foreground font-bold text-base">Subí el CSV filtrado por familia</p>
              <p className="text-muted-foreground text-sm mt-1">Reposición Asistida completa desde la línea 00 del reporte</p>
            </div>
            <span className="px-5 py-2.5 bg-brand text-white font-semibold text-sm rounded-lg shadow-brand">Seleccionar CSV</span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void procesarArchivo(file)
              }}
            />
          </div>
        )}

        {archivo && !resultado && (
          <div className="bg-white rounded-card shadow-card px-4 py-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-foreground text-sm font-semibold truncate">{archivo.name}</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                {(archivo.size / 1024).toFixed(1)} KB
                {preview && <> · {preview.encoding} · Sucursal {preview.sucursal.codigo}</>}
              </p>
            </div>
            {!procesando && !aplicando && (
              <button type="button" onClick={reset} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" aria-label="Quitar archivo">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {procesando && (
          <div className="bg-white rounded-card shadow-card p-5 flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-brand animate-spin" />
            <div>
              <p className="text-sm text-foreground font-semibold">Analizando CSV...</p>
              <p className="text-xs text-muted-foreground mt-0.5">Verificando sucursal, familia, catálogo y estado local.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-card p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">No se pudo completar la operación</p>
              <p className="text-xs text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {preview && !familiaConfirmada && !resultado && !procesando && (
          <div className="bg-white rounded-card shadow-card border border-brand/30 p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-brand uppercase tracking-wide">Confirmación del archivo</p>
              <p className="text-foreground font-bold mt-1">
                Sucursal {preview.sucursal.codigo} · {preview.sucursal.nombre}
              </p>
              <p className="text-foreground text-sm mt-1">
                Familia <span className="font-mono font-semibold text-brand">{preview.familia.codigo}</span> {preview.familia.nombre}
              </p>
              <p className="text-muted-foreground text-xs mt-2">
                {preview.parser.filas.length} productos válidos. Todavía no se escribió nada.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setFamiliaConfirmada(true)}
                className="flex-1 min-h-[52px] bg-brand hover:bg-brand-hover text-white font-bold text-sm rounded-card shadow-brand transition-all active:scale-[0.98]"
              >
                Sí, revisar e importar esta familia
              </button>
              <button type="button" onClick={reset} className="sm:w-32 min-h-[52px] bg-muted hover:bg-muted/70 text-foreground font-medium text-sm rounded-card">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {preview && rec && familiaConfirmada && !resultado && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ResumenCard titulo="Actualización exacta" valor={rec.aActualizar.length} />
              <ResumenCard titulo="A confirmar" valor={rec.aConfirmar.length} />
              <ResumenCard titulo="Nuevos" valor={rec.nuevos.length} />
              <ResumenCard titulo="Huérfanos locales" valor={rec.huerfanos.length} />
            </div>

            {rec.duplicadosPorEan.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-card p-4">
                <p className="text-red-900 font-bold text-sm">Duplicados detectados por EAN ({rec.duplicadosPorEan.length})</p>
                <p className="text-red-700 text-xs mt-1">No se resuelven silenciosamente durante esta importación.</p>
                <div className="mt-2 space-y-1">
                  {rec.duplicadosPorEan.map((d) => (
                    <p key={d.duplicado.id} className="text-xs text-red-800">
                      <span className="font-mono font-semibold">{d.principal.cod_art}</span> {d.principal.descripcion} ← duplicado {d.duplicado.cod_art} {d.duplicado.descripcion}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {rec.aConfirmar.length > 0 && (
              <div className="bg-white rounded-card shadow-card overflow-hidden">
                <div className="px-4 py-3.5 border-b border-border">
                  <p className="text-foreground font-bold text-sm">Coincidencias a confirmar ({rec.aConfirmar.length})</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {sinDecidir > 0 ? `${sinDecidir} sin decidir: quedarán excluidas.` : 'Todas las coincidencias tienen una decisión.'}
                  </p>
                </div>
                <div className="divide-y divide-border/60">
                  {rec.aConfirmar.map((fc) => (
                    <DecisionRow
                      key={fc.fila.linea}
                      fc={fc}
                      decision={decisiones[fc.fila.linea]}
                      onDecision={(decision) => setDecisiones((prev) => ({ ...prev, [fc.fila.linea]: decision }))}
                    />
                  ))}
                </div>
              </div>
            )}

            {rec.conflictosFamilia.length > 0 && (
              <div className="bg-white rounded-card shadow-card overflow-hidden border border-amber-300">
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-3.5">
                  <p className="text-amber-900 font-bold text-sm">Cambios de familia posibles ({rec.conflictosFamilia.length})</p>
                  <p className="text-amber-700 text-xs mt-1">Sólo se cambia la familia de los productos que marques explícitamente.</p>
                </div>
                <div className="divide-y divide-border/60">
                  {rec.conflictosFamilia.map((fc) => (
                    <label key={`${fc.fila.linea}-${fc.match?.id}`} className="p-4 flex gap-3 items-start cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-[color:var(--brand,#0d9488)]"
                        checked={fc.match ? familiasAprobadas.has(fc.match.id) : false}
                        onChange={(e) => {
                          if (!fc.match) return
                          const id = fc.match.id
                          setFamiliasAprobadas((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(id)
                            else next.delete(id)
                            return next
                          })
                        }}
                      />
                      <div>
                        <p className="text-sm font-semibold text-foreground"><span className="font-mono text-brand">{fc.fila.cod_art}</span> · {fc.fila.descripcion}</p>
                        <p className="text-xs text-muted-foreground mt-1">Actual: {nombreFamilia(fc.match?.familia_id ?? null)} → CSV: {preview.familia.codigo} {preview.familia.nombre}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {rec.aActualizar.length > 0 && (
              <TablaActualizaciones filas={rec.aActualizar} />
            )}

            {rec.nuevos.length > 0 && (
              <div className="bg-white rounded-card shadow-card overflow-hidden">
                <div className="px-4 py-3.5 border-b border-border bg-brand-light">
                  <p className="text-brand font-bold text-sm">Productos nuevos ({rec.nuevos.length})</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b border-border"><th className={thCls}>Cod.Art.</th><th className={thCls}>Descripción</th><th className={`${thCls} text-right`}>Stock</th><th className={`${thCls} text-right`}>V.Media</th></tr></thead>
                    <tbody>
                      {rec.nuevos.map((fc) => (
                        <tr key={fc.fila.linea} className="border-b border-border/50 last:border-0">
                          <td className={`${tdCls} font-mono font-semibold text-brand`}>{fc.fila.cod_art}</td>
                          <td className={`${tdCls} text-foreground`}>{fc.fila.descripcion}</td>
                          <td className={`${tdCls} text-right font-semibold`}>{fc.fila.stockCsv}</td>
                          <td className={`${tdCls} text-right text-brand font-semibold`}>{fc.fila.ventaMediaCsv.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {preview.avisosSimilares.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-card p-4">
                <p className="text-amber-900 font-bold text-sm">Nuevos con descripción parecida ({preview.avisosSimilares.length})</p>
                <p className="text-amber-700 text-xs mt-1 mb-2">Revisalos antes de confirmar para evitar duplicados.</p>
                {preview.avisosSimilares.map((a) => (
                  <p key={a.linea} className="text-xs text-amber-800">
                    <span className="font-mono font-semibold">{a.codArt}</span> {a.descripcion} — {Math.round(a.score * 100)}% parecido a {a.producto.cod_art} {a.producto.descripcion}
                  </p>
                ))}
              </div>
            )}

            {rec.huerfanos.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-card p-4">
                <p className="text-amber-900 font-bold text-sm">Productos locales que no vinieron en el CSV ({rec.huerfanos.length})</p>
                <p className="text-amber-700 text-xs mt-1 mb-2">Su estado local no se modifica.</p>
                {rec.huerfanos.map((h: Huerfano) => (
                  <p key={h.producto.id} className="text-xs text-amber-800">
                    <span className="font-mono font-semibold">{h.producto.cod_art || '—'}</span> {h.producto.descripcion} · stock {h.producto.stock_actual}
                    {h.motivoCodArt && <span className="ml-2 font-semibold">[{ETIQUETA_COD_ART[h.motivoCodArt]}]</span>}
                  </p>
                ))}
              </div>
            )}

            {descartadas.length > 0 && (
              <div className="bg-white rounded-card shadow-card overflow-hidden">
                <button type="button" onClick={() => setVerDescartadas((v) => !v)} className="w-full p-4 flex items-center justify-between text-left">
                  <div><p className="text-sm font-bold text-foreground">Filas descartadas ({descartadas.length})</p><p className="text-xs text-muted-foreground mt-0.5">No se importarán.</p></div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${verDescartadas ? 'rotate-180' : ''}`} />
                </button>
                {verDescartadas && (
                  <div className="border-t border-border px-4 py-3 space-y-1">
                    {descartadas.map((d) => <p key={`${d.linea}-${d.codArt}`} className="text-xs text-muted-foreground">línea {d.linea} · {d.codArt || '—'} · {d.motivo}</p>)}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => void aplicar()}
                disabled={aplicando || totalAEscribir === 0}
                className="flex-1 min-h-[56px] bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base rounded-card shadow-brand flex items-center justify-center gap-2"
              >
                {aplicando ? <><Loader2 className="h-5 w-5 animate-spin" />Aplicando transacción...</> : <><CheckCircle className="h-5 w-5" />Confirmar importación ({totalAEscribir})</>}
              </button>
              <button type="button" onClick={reset} disabled={aplicando} className="sm:w-32 min-h-[56px] bg-muted hover:bg-muted/70 disabled:opacity-50 text-foreground font-medium text-sm rounded-card">Cancelar</button>
            </div>
          </div>
        )}

        {resultado && preview && (
          <div className="space-y-4">
            <div className={`${resultado.duplicada ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'} border rounded-card p-5`}>
              <div className="flex items-start gap-3">
                {resultado.duplicada ? <RefreshCw className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" /> : <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />}
                <div>
                  <p className="font-bold text-foreground">{resultado.duplicada ? 'Este archivo ya había sido aplicado' : 'Importación aplicada atómicamente'}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {resultado.duplicada
                      ? 'No se volvió a aplicar ningún cambio.'
                      : `${resultado.actualizados} actualizados · ${resultado.nuevos} nuevos · 0 cambios parciales.`}
                  </p>
                  {resultado.importacionId && <p className="text-xs font-mono text-muted-foreground mt-2">ID {resultado.importacionId}</p>}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button type="button" onClick={() => void copiarReporte()} className="px-5 py-2.5 bg-white border border-border rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                  <Copy className="h-4 w-4" />{copiado ? 'Copiado ✓' : 'Copiar reporte'}
                </button>
                <button type="button" onClick={reset} className="px-5 py-2.5 bg-white border border-border rounded-lg text-sm font-medium">Importar otro archivo</button>
              </div>
            </div>

            {resultado.excluidosSinDecidir > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-card p-4 text-xs text-amber-800">
                {resultado.excluidosSinDecidir} coincidencia{resultado.excluidosSinDecidir !== 1 ? 's' : ''} quedaron fuera por no tener decisión.
              </div>
            )}

            {resultado.codArtCorregidos.length > 0 && (
              <div className="bg-white rounded-card shadow-card p-4">
                <p className="text-sm font-bold text-foreground">Códigos corregidos ({resultado.codArtCorregidos.length})</p>
                {resultado.codArtCorregidos.map((c, i) => <p key={i} className="text-xs mt-1 text-muted-foreground">{c.descripcion}: <span className="font-mono line-through">{c.de}</span> → <span className="font-mono text-brand font-semibold">{c.a}</span></p>)}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function ResumenCard({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="bg-white rounded-card shadow-card p-4">
      <p className="text-2xl font-black text-foreground tabular-nums">{valor}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mt-1">{titulo}</p>
    </div>
  )
}

function DecisionRow({
  fc,
  decision,
  onDecision,
}: {
  fc: FilaConciliada
  decision?: DecisionSimilar
  onDecision: (decision: DecisionSimilar) => void
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-brand-light/50 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wide text-brand font-bold">En CSV</p>
          <p className="text-sm font-semibold text-foreground mt-1">{fc.fila.descripcion}</p>
          <p className="text-xs text-muted-foreground mt-1"><span className="font-mono">{fc.fila.cod_art}</span> · stock {fc.fila.stockCsv} · VMD {fc.fila.ventaMediaCsv.toFixed(2)}</p>
        </div>
        <div className="bg-muted rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">En Noven</p>
          <p className="text-sm font-semibold text-foreground mt-1">{fc.match?.descripcion}</p>
          <p className="text-xs text-muted-foreground mt-1"><span className="font-mono">{fc.match?.cod_art}</span> · stock local {fc.match?.stock_actual ?? 0} · VMD {Number(fc.match?.venta_media_diaria ?? 0).toFixed(2)}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Similaridad: <span className="font-semibold text-foreground">{Math.round((fc.similaridad ?? 0) * 100)}%</span></p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button type="button" onClick={() => onDecision('mismo')} className={`p-3 rounded-lg border text-left text-xs font-semibold ${decision === 'mismo' ? 'bg-brand text-white border-brand' : 'bg-white text-foreground border-border hover:border-brand'}`}>
          Es el mismo producto
          <span className={`block font-normal mt-1 ${decision === 'mismo' ? 'text-white/80' : 'text-muted-foreground'}`}>Se corrige/alinea el catálogo y se actualiza el estado local.</span>
        </button>
        <button type="button" onClick={() => onDecision('distinto')} className={`p-3 rounded-lg border text-left text-xs font-semibold ${decision === 'distinto' ? 'bg-foreground text-white border-foreground' : 'bg-white text-foreground border-border'}`}>
          Es un producto distinto
          <span className={`block font-normal mt-1 ${decision === 'distinto' ? 'text-white/80' : 'text-muted-foreground'}`}>Se crea un SKU nuevo dentro de la organización.</span>
        </button>
      </div>
    </div>
  )
}

function TablaActualizaciones({ filas }: { filas: FilaConciliada[] }) {
  const th = 'text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-2.5'
  const td = 'px-4 py-2.5 text-xs'
  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      <div className="px-4 py-3.5 border-b border-border">
        <p className="text-sm font-bold text-foreground">Productos a actualizar ({filas.length})</p>
        <p className="text-xs text-muted-foreground mt-1">Stock y VMD comparados contra el estado de esta sucursal.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-border"><th className={th}>Cod.Art.</th><th className={th}>Descripción</th><th className={th}>Match</th><th className={`${th} text-right`}>Stock actual</th><th className={`${th} text-right`}>Stock CSV</th><th className={`${th} text-right`}>VMD actual</th><th className={`${th} text-right`}>VMD CSV</th></tr></thead>
          <tbody>
            {filas.map((fc) => (
              <tr key={fc.fila.linea} className="border-b border-border/50 last:border-0">
                <td className={`${td} font-mono font-semibold text-brand`}>{fc.fila.cod_art}</td>
                <td className={`${td} text-foreground`}>{fc.fila.descripcion}</td>
                <td className={td}>{ETIQUETA_ESTRATEGIA[fc.estrategia ?? ''] ?? '—'}</td>
                <td className={`${td} text-right text-muted-foreground`}>{fc.match?.stock_actual ?? 0}</td>
                <td className={`${td} text-right font-semibold`}>{fc.fila.stockCsv}</td>
                <td className={`${td} text-right text-muted-foreground`}>{Number(fc.match?.venta_media_diaria ?? 0).toFixed(2)}</td>
                <td className={`${td} text-right text-brand font-semibold`}>{fc.fila.ventaMediaCsv.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
