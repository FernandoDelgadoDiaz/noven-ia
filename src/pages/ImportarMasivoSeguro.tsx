import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  FileText,
  Layers3,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSucursalActual } from '@/hooks/useSucursalActual'
import { decodificarCsv, type EncodingDetectado, type ResultadoParser } from '@/lib/importar-csv'
import { analizarReporteGlaciar } from '@/lib/importar-glaciar'
import { planificarImportacionMasiva, type PlanImportacionMasiva } from '@/lib/importar-masivo'
import type { ProductoDb } from '@/lib/importar-reconciliacion'

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
}

interface EstadoLocalRow {
  producto_id: string
  stock_actual: number
  venta_media_diaria: number
}

interface Preview {
  parser: ResultadoParser
  plan: PlanImportacionMasiva
  familias: Map<string, FamiliaInfo>
  codigoSucursalFuente: string
  encoding: EncodingDetectado
}

interface ResultadoServidor {
  duplicada?: boolean
  importacion_id?: string
  estado?: string
  aplicadas?: number
  sin_mapear?: number
  sin_familia?: number
  pendientes_organizacion?: number
  familias?: Array<{
    familia_id: string
    codigo: string
    nombre: string
    productos: number
  }>
}

interface RespuestaImportacion {
  success: boolean
  error?: string
  errores?: string[]
  resultado?: ResultadoServidor
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

export default function ImportarMasivoSeguro() {
  const navigate = useNavigate()
  const { sucursalId, loading: sucursalLoading, requiereSeleccionSucursal } = useSucursalActual()
  const inputRef = useRef<HTMLInputElement>(null)

  const [archivo, setArchivo] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [sucursal, setSucursal] = useState<SucursalInfo | null>(null)
  const [resultado, setResultado] = useState<ResultadoServidor | null>(null)

  function reset(): void {
    setArchivo(null)
    setPreview(null)
    setResultado(null)
    setError(null)
    setSucursal(null)
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

    setArchivo(file)
    setProcesando(true)
    setError(null)
    setPreview(null)
    setResultado(null)

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
      const suc = sucData as SucursalInfo
      setSucursal(suc)

      const { texto, encoding } = decodificarCsv(buffer)
      const analisis = analizarReporteGlaciar(texto, { modo: 'masiva' })
      if (analisis.erroresBloqueantes.length > 0) {
        throw new Error(analisis.erroresBloqueantes.join(' '))
      }

      const codigoFuente = analisis.metadata.codigoSucursal
      if (!codigoFuente) throw new Error('No se pudo identificar Cod.Suc.Padrón en el archivo.')
      if (codigoFuente !== suc.codigo) {
        throw new Error(
          `Este archivo es de la sucursal ${codigoFuente}, pero estás trabajando en la sucursal ${suc.codigo}. No se escribió nada.`,
        )
      }

      const codArts = Array.from(new Set(analisis.parser.filas.map((f) => f.cod_art)))
      const catalogoPorId = new Map<string, ProductoCatalogoRow>()
      const campos = 'id, cod_art, codigo_barras, descripcion, marca, gramaje, familia_id'

      for (const lote of enLotes(codArts)) {
        const { data, error: productosError } = await supabase
          .from('v_productos_catalogo')
          .select(campos)
          .eq('organizacion_id', suc.organizacion_id)
          .eq('activo', true)
          .in('cod_art', lote)
        if (productosError) throw new Error(`No se pudo consultar el catálogo: ${productosError.message}`)
        for (const p of (data ?? []) as unknown as ProductoCatalogoRow[]) catalogoPorId.set(p.id, p)
      }

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
        for (const estado of (estados ?? []) as unknown as EstadoLocalRow[]) estadoPorProducto.set(estado.producto_id, estado)
      }

      const productos: ProductoDb[] = Array.from(catalogoPorId.values()).map((p) => {
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

      const plan = planificarImportacionMasiva(analisis.parser.filas, productos)
      const familiaIds = Array.from(new Set(plan.porFamilia.map((f) => f.familia_id)))
      const familias = new Map<string, FamiliaInfo>()

      if (familiaIds.length > 0) {
        const { data: familiasData, error: familiasError } = await supabase
          .from('familias')
          .select('id, codigo, nombre')
          .eq('organizacion_id', suc.organizacion_id)
          .in('id', familiaIds)
        if (familiasError) throw new Error(`No se pudieron resolver las familias: ${familiasError.message}`)
        for (const f of (familiasData ?? []) as unknown as FamiliaInfo[]) familias.set(f.id, f)
      }

      setPreview({
        parser: analisis.parser,
        plan,
        familias,
        codigoSucursalFuente: codigoFuente,
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
    if (preview.plan.actualizables.length === 0) {
      setError('No hay productos previamente aprendidos para actualizar.')
      return
    }
    if (archivo.size > 3_500_000) {
      setError('Este archivo es demasiado grande para la carga web actual. No se aplicó ningún cambio.')
      return
    }

    setAplicando(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('La sesión expiró. Volvé a iniciar sesión.')

      const archivoBase64 = await archivoABase64(archivo)
      const response = await fetch('/.netlify/functions/importar-asistido-completo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sucursalId,
          nombreArchivo: archivo.name,
          archivoBase64,
        }),
      })
      const body = await response.json() as RespuestaImportacion
      if (!response.ok || !body.success) {
        throw new Error(body.errores?.join(' ') || body.error || 'No se pudo aplicar la importación.')
      }
      setResultado(body.resultado ?? {})
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

  const pendientes = preview
    ? preview.plan.sinMapear.length + preview.plan.conocidosSinFamilia.length
    : 0

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
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-none">Asistido completo</h1>
            <p className="text-sm text-muted-foreground mt-1">Actualización masiva por códigos ya aprendidos</p>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 py-5 md:py-6 max-w-5xl space-y-4 pb-28">
        <div className="bg-brand-light border border-brand/20 rounded-card px-4 py-3.5 flex items-start gap-3">
          <Layers3 className="h-5 w-5 text-brand shrink-0 mt-0.5" />
          <div>
            <p className="text-foreground font-semibold text-sm">Catálogo compartido, estado separado por sucursal</p>
            <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
              El preview usa la familia global aprendida del SKU, pero compara stock y VMD contra el estado de la sucursal actual.
              La aplicación final vuelve a validar todo en servidor y se ejecuta atómicamente.
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
            <p className="text-sm text-amber-800">Seleccioná una sucursal antes de importar un asistido completo.</p>
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
              <p className="text-foreground font-bold text-base">Subí la Reposición Asistida completa</p>
              <p className="text-muted-foreground text-sm mt-1">Puede contener varias familias en el mismo CSV.</p>
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
                {preview && <> · {preview.encoding}</>}
                {sucursal && <> · Sucursal {sucursal.codigo}</>}
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
            <Loader2 className="h-5 w-5 text-brand animate-spin shrink-0" />
            <div>
              <p className="text-foreground font-semibold text-sm">Analizando el asistido completo...</p>
              <p className="text-muted-foreground text-xs mt-0.5">Buscando coincidencias exactas y leyendo el estado local de la sucursal.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-card p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 font-semibold text-sm">No se pudo continuar</p>
              <p className="text-red-600 text-xs mt-1">{error}</p>
            </div>
          </div>
        )}

        {preview && !resultado && !procesando && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Resumen titulo="Leídos" valor={preview.parser.filas.length} />
              <Resumen titulo="Reconocidos" valor={preview.plan.actualizables.length} destacado />
              <Resumen titulo="Sin mapear" valor={preview.plan.sinMapear.length} alerta={preview.plan.sinMapear.length > 0} />
              <Resumen titulo="Sin familia" valor={preview.plan.conocidosSinFamilia.length} alerta={preview.plan.conocidosSinFamilia.length > 0} />
            </div>

            <div className="bg-white rounded-card shadow-card overflow-hidden">
              <div className="px-4 py-3.5 border-b border-border">
                <h2 className="text-foreground font-bold text-sm">Derivación por familia</h2>
                <p className="text-muted-foreground text-xs mt-0.5">Cada Cod.Art. reconocido conserva la familia aprendida en el catálogo de la organización.</p>
              </div>
              <div className="divide-y divide-border/60">
                {preview.plan.porFamilia.map((r) => {
                  const f = preview.familias.get(r.familia_id)
                  return (
                    <div key={r.familia_id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-foreground text-sm font-semibold">{f?.nombre ?? 'Familia sin nombre'}</p>
                        <p className="text-muted-foreground text-xs font-mono mt-0.5">{f?.codigo ?? r.familia_id}</p>
                      </div>
                      <span className="px-2.5 py-1 bg-brand-light text-brand text-xs font-bold rounded-lg">{r.productos} productos</span>
                    </div>
                  )
                })}
                {preview.plan.porFamilia.length === 0 && <p className="px-4 py-5 text-sm text-muted-foreground">Todavía no hay productos ruteables.</p>}
              </div>
            </div>

            {pendientes > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-card p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-900 font-semibold text-sm">{pendientes} productos requieren aprendizaje</p>
                    <p className="text-amber-700 text-xs mt-1">No bloquean los códigos conocidos. El backend los deja pendientes a nivel organización para resolverlos una vez.</p>
                  </div>
                </div>
                {preview.plan.sinMapear.length > 0 && (
                  <div className="bg-white/70 rounded-lg px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide font-bold text-amber-800 mb-1">Primeros códigos sin mapear</p>
                    <p className="text-xs text-amber-800 font-mono break-words">
                      {preview.plan.sinMapear.slice(0, 20).map((f) => f.cod_art).join(' · ')}
                      {preview.plan.sinMapear.length > 20 ? ` · +${preview.plan.sinMapear.length - 20}` : ''}
                    </p>
                  </div>
                )}
              </div>
            )}

            {preview.parser.descartadas.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-card px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">{preview.parser.descartadas.length} filas fueron descartadas por formato o datos inválidos.</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => void aplicar()}
              disabled={aplicando || preview.plan.actualizables.length === 0}
              className="w-full min-h-[56px] bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base rounded-card shadow-brand transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {aplicando ? <><Loader2 className="h-5 w-5 animate-spin" />Aplicando actualización masiva...</> : <><RefreshCw className="h-5 w-5" />Actualizar {preview.plan.actualizables.length} productos</>}
            </button>
          </>
        )}

        {resultado && (
          <div className="bg-white rounded-[24px] shadow-card p-6 space-y-5 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-foreground font-bold text-lg">{resultado.duplicada ? 'Este archivo ya había sido procesado' : 'Asistido completo actualizado'}</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {resultado.duplicada
                    ? 'Noven reconoció el SHA-256 y no aplicó el mismo archivo dos veces.'
                    : `${resultado.aplicadas ?? 0} productos actualizaron stock y VMD exclusivamente en esta sucursal.`}
                </p>
              </div>
            </div>

            {!resultado.duplicada && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Resumen titulo="Aplicados" valor={resultado.aplicadas ?? 0} destacado />
                <Resumen titulo="Sin mapear" valor={resultado.sin_mapear ?? 0} alerta={(resultado.sin_mapear ?? 0) > 0} />
                <Resumen titulo="Sin familia" valor={resultado.sin_familia ?? 0} alerta={(resultado.sin_familia ?? 0) > 0} />
                <Resumen titulo="Pendientes org." valor={resultado.pendientes_organizacion ?? 0} alerta={(resultado.pendientes_organizacion ?? 0) > 0} />
              </div>
            )}

            {resultado.importacion_id && <p className="text-xs text-muted-foreground font-mono">Importación {resultado.importacion_id}</p>}

            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" onClick={reset} className="flex-1 min-h-[48px] bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-card">Importar otro asistido</button>
              <button type="button" onClick={() => navigate('/importar/pendientes')} className="flex-1 min-h-[48px] bg-muted hover:bg-muted/70 text-foreground font-semibold text-sm rounded-card">Resolver catálogo pendiente</button>
            </div>
          </div>
        )}

        {!archivo && (
          <div className="bg-white rounded-card shadow-card px-4 py-3.5 flex items-start gap-3">
            <FileText className="h-4 w-4 text-brand shrink-0 mt-0.5" />
            <p className="text-muted-foreground text-xs leading-relaxed">El catálogo se aprende una vez por organización; el stock y la venta media se actualizan por sucursal.</p>
          </div>
        )}
      </main>
    </div>
  )
}

function Resumen({
  titulo,
  valor,
  destacado = false,
  alerta = false,
}: {
  titulo: string
  valor: number
  destacado?: boolean
  alerta?: boolean
}) {
  return (
    <div className={`rounded-card px-4 py-4 border ${destacado ? 'bg-brand-light border-brand/20' : alerta ? 'bg-amber-50 border-amber-200' : 'bg-white border-border/60'} shadow-card`}>
      <p className={`text-2xl font-bold tabular-nums ${destacado ? 'text-brand' : alerta ? 'text-amber-800' : 'text-foreground'}`}>{valor}</p>
      <p className={`text-xs mt-1 ${alerta ? 'text-amber-700' : 'text-muted-foreground'}`}>{titulo}</p>
    </div>
  )
}
