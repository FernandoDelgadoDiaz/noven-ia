import { useRef, useState } from 'react'
import { ArrowLeft, CheckCircle, FileSearch, Loader2, Upload, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useSucursalActual } from '@/hooks/useSucursalActual'

interface LearnResponse {
  success: boolean
  error?: string
  errores?: string[]
  codigo_sucursal?: string
  codigo_familia?: string
  productos_en_archivo?: number
  resultado?: {
    familia_id?: string
    codigo_familia?: string
    resueltos?: number
    ya_resueltos?: number
    sucursales_afectadas?: number
  }
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

export default function AprenderPendientesCsv() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const { sucursalId, loading: sucursalLoading, requiereSeleccionSucursal } = useSucursalActual()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<LearnResponse | null>(null)

  async function aprender(): Promise<void> {
    if (!archivo || !sucursalId) return
    setProcesando(true)
    setError(null)
    setResultado(null)

    try {
      if (!archivo.name.toLowerCase().endsWith('.csv')) {
        throw new Error('El archivo debe ser un CSV de Reposición Asistida filtrado por familia.')
      }
      if (archivo.size > 3_500_000) throw new Error('El archivo es demasiado grande para esta carga web.')

      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('La sesión expiró. Volvé a iniciar sesión.')

      const archivoBase64 = await archivoABase64(archivo)
      const response = await fetch('/.netlify/functions/aprender-pendientes-familia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sucursalId, archivoBase64 }),
      })
      const body = await response.json() as LearnResponse
      if (!response.ok || !body.success) {
        throw new Error(body.errores?.join(' ') || body.error || 'No se pudo aprender desde el archivo.')
      }
      setResultado(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setProcesando(false)
    }
  }

  function reset(): void {
    setArchivo(null)
    setResultado(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-10 bg-white border-b border-border/40 px-4 md:px-8 py-4 md:py-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/importar/pendientes')}
            className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-none">Aprender desde CSV filtrado</h1>
            <p className="text-sm text-muted-foreground mt-1">Clasificación automática de pendientes por Cód.Familia</p>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-3xl space-y-4 pb-28">
        <div className="bg-brand-light border border-brand/20 rounded-card p-4 flex items-start gap-3">
          <FileSearch className="h-5 w-5 text-brand shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">Ejemplo: Almacén → Golosinas → Exportar CSV</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Noven verifica la sucursal y la Cód.Familia del reporte. Cualquier cod_art de ese archivo que esté pendiente se clasifica con esa familia para toda la organización.
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
          <div className="bg-amber-50 border border-amber-200 rounded-card p-4 text-sm text-amber-800">
            Seleccioná una sucursal antes de usar un CSV filtrado como evidencia de catálogo.
          </div>
        )}

        {!sucursalLoading && sucursalId && !resultado && (
          <div className="bg-white rounded-[24px] shadow-card border border-border/60 p-6 space-y-4">
            {!archivo ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-full min-h-44 rounded-2xl border border-dashed border-border hover:border-brand/50 hover:bg-brand-light/30 transition-colors flex flex-col items-center justify-center gap-3"
              >
                <div className="h-12 w-12 rounded-2xl bg-brand-light flex items-center justify-center">
                  <Upload className="h-5 w-5 text-brand" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground">Seleccionar CSV filtrado</p>
                  <p className="text-xs text-muted-foreground mt-1">Debe incluir el encabezado de Reposición Asistida y Cód.Familia.</p>
                </div>
              </button>
            ) : (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/60">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{archivo.name}</p>
                  <p className="text-xs text-muted-foreground">{(archivo.size / 1024).toFixed(1)} KB</p>
                </div>
                <button type="button" onClick={reset} className="p-2 rounded-lg hover:bg-white text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />

            {archivo && (
              <button
                type="button"
                onClick={() => void aprender()}
                disabled={procesando}
                className="w-full min-h-12 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {procesando && <Loader2 className="h-4 w-4 animate-spin" />}
                Verificar y aprender pendientes
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-card p-4 text-sm text-red-700">{error}</div>
        )}

        {resultado?.success && (
          <div className="bg-white rounded-card shadow-card border border-emerald-200 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-foreground">Aprendizaje completado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Familia detectada: <span className="font-mono font-semibold text-foreground">{resultado.codigo_familia}</span>
                  {resultado.codigo_sucursal && <> · Sucursal {resultado.codigo_sucursal}</>}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Dato label="Productos del CSV" value={resultado.productos_en_archivo ?? 0} />
              <Dato label="Pendientes resueltos" value={resultado.resultado?.resueltos ?? 0} destacado />
              <Dato label="Estados propagados" value={resultado.resultado?.sucursales_afectadas ?? 0} />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => navigate('/importar/pendientes')}
                className="flex-1 min-h-11 rounded-xl bg-brand text-white text-sm font-semibold"
              >
                Volver a pendientes
              </button>
              <button
                type="button"
                onClick={reset}
                className="flex-1 min-h-11 rounded-xl bg-muted text-foreground text-sm font-semibold"
              >
                Procesar otra familia
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function Dato({ label, value, destacado = false }: { label: string; value: number; destacado?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${destacado ? 'bg-brand-light' : 'bg-muted/60'}`}>
      <p className={`text-xl font-bold ${destacado ? 'text-brand' : 'text-foreground'}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}
