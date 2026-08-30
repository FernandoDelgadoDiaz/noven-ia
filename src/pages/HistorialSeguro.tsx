import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronLeft,
  CircleCheckBig,
  Clock,
  HandHeart,
  Trash2,
  User,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getTrimestreActual } from '@/hooks/useAccionesOperativas'
import { useSucursalActual } from '@/hooks/useSucursalActual'
import { formatearPesos, formatearUnidades } from '@/lib/economia-riesgo'
import ProductIdentity from '@/components/product/ProductIdentity'

type TipoAccion = 'vendido' | 'donacion' | 'decomiso'

interface TramoResultado {
  orden: number
  rag_porcentaje: number | null
  cantidad_inicio: number
  cantidad_fin: number
  unidades_vendidas: number
  iniciado_at: string
  finalizado_at: string
}

interface AccionHistorial {
  id: string
  tipo: TipoAccion
  cantidad: number
  unidades_recuperadas: number
  unidades_perdidas: number
  valor_recuperado_sin_iva: number | null
  valor_perdido_sin_iva: number | null
  resultado_ciclo_completo: boolean
  tramos_resultado: TramoResultado[]
  created_at: string
  observaciones: string | null
  usuario_id: string | null
  usuario_nombre: string | null
  producto_descripcion: string
  producto_marca: string | null
  producto_gramaje: string | null
  producto_cod_art: string | null
  producto_codigo_barras: string | null
  producto_imagen_url: string | null
}

const TIPO_CONFIG: Record<TipoAccion, {
  titulo: string
  tituloVacio: string
  descripcionTotal: (total: number) => string
  Icono: typeof HandHeart
  iconBg: string
  iconColor: string
  totalColor: string
}> = {
  vendido: {
    titulo: 'Casos resueltos por venta',
    tituloVacio: 'No hay casos resueltos por venta este trimestre',
    descripcionTotal: (total) => `${formatearUnidades(total)} unidades recuperadas por venta`,
    Icono: CircleCheckBig,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    totalColor: 'text-emerald-600',
  },
  donacion: {
    titulo: 'Donaciones',
    tituloVacio: 'No hay donaciones registradas este trimestre',
    descripcionTotal: (total) => `${formatearUnidades(total)} unidades donadas este trimestre`,
    Icono: HandHeart,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    totalColor: 'text-orange-600',
  },
  decomiso: {
    titulo: 'Decomisos',
    tituloVacio: 'No hay decomisos registrados este trimestre',
    descripcionTotal: (total) => `${formatearUnidades(total)} unidades decomisadas este trimestre`,
    Icono: Trash2,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    totalColor: 'text-red-600',
  },
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatFechaHora(iso: string): string {
  const d = new Date(iso)
  const fecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
  const hora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${fecha} · ${hora}`
}

export default function HistorialSeguro() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { sucursalId, loading: sucursalLoading } = useSucursalActual()

  const tipoParam = searchParams.get('tipo')
  const tipo: TipoAccion = tipoParam === 'vendido' || tipoParam === 'decomiso' ? tipoParam : 'donacion'
  const config = TIPO_CONFIG[tipo]
  const trimestreInfo = useMemo(() => getTrimestreActual(), [])

  const [acciones, setAcciones] = useState<AccionHistorial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const subtitulo = useMemo(() => {
    const mesInicio = capitalizar(new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(trimestreInfo.desde))
    const mesFin = capitalizar(new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(trimestreInfo.hasta))
    return `${mesInicio} — ${mesFin} ${trimestreInfo.anio}`
  }, [trimestreInfo])

  const total = useMemo(
    () => tipo === 'vendido'
      ? acciones.reduce((sum, a) => sum + (Number(a.unidades_recuperadas) || 0), 0)
      : acciones.reduce((sum, a) => sum + (Number(a.unidades_perdidas) || 0), 0),
    [acciones, tipo],
  )

  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('v_acciones_operativas_historial')
      .select('id, tipo, cantidad, unidades_recuperadas, unidades_perdidas, valor_recuperado_sin_iva, valor_perdido_sin_iva, resultado_ciclo_completo, tramos_resultado, created_at, observaciones, usuario_id, usuario_nombre, producto_descripcion, producto_marca, producto_gramaje, producto_cod_art, producto_codigo_barras, producto_imagen_url')
      .eq('tipo', tipo)
      .eq('trimestre', trimestreInfo.trimestre)
      .eq('anio', trimestreInfo.anio)
      .eq('sucursal_id', sucursalId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    setAcciones((data ?? []) as unknown as AccionHistorial[])
    setLoading(false)
  }, [tipo, trimestreInfo, sucursalId])

  useEffect(() => {
    if (sucursalLoading) return
    void fetchData()
  }, [fetchData, sucursalLoading])

  const { Icono } = config

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-10 bg-white border-b border-border/40 px-4 md:px-8 py-4 md:py-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="p-1.5 -ml-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-[0.94]"
            aria-label="Volver al dashboard"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-tight truncate">
              {config.titulo}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 leading-none">Q{trimestreInfo.trimestre} {trimestreInfo.anio} · {subtitulo}</p>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 py-5 md:py-6 space-y-4">
        <div className="bg-white rounded-card shadow-card p-5 flex items-center gap-4">
          <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${config.iconBg}`}>
            <Icono className={`h-6 w-6 ${config.iconColor}`} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className={`text-4xl font-black tracking-tight leading-none tabular-nums ${config.totalColor}`}>{loading ? '–' : formatearUnidades(total)}</p>
            <p className="text-sm text-muted-foreground mt-1.5">{config.descripcionTotal(total)}</p>
          </div>
        </div>

        {tipo === 'vendido' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-card p-4 text-sm text-emerald-900">
            <p className="font-semibold">Qué mide este historial</p>
            <p className="text-xs mt-1 text-emerald-800 leading-relaxed">
              Cada fila sigue el ciclo completo del vencimiento. Las unidades recuperadas surgen de las disminuciones observadas entre controles y cambios de RAG; el último saldo positivo queda sólo como dato técnico de cierre.
            </p>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-card bg-red-50 border border-red-200 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-red-600">No pudimos cargar el historial: {error}</p>
            <button type="button" onClick={() => void fetchData()} className="text-xs font-semibold text-red-700 border border-red-300 px-3 py-1.5 rounded-lg">Reintentar</button>
          </div>
        )}

        {loading && (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => <div key={i} className="bg-white rounded-card shadow-card h-24 animate-pulse" />)}
          </div>
        )}

        {!loading && !error && acciones.length > 0 && (
          <div className="space-y-2.5">
            {acciones.map((a) => {
              const unidadesPrincipales = tipo === 'vendido' ? Number(a.unidades_recuperadas) || 0 : Number(a.unidades_perdidas) || 0
              const valorPrincipal = tipo === 'vendido' ? a.valor_recuperado_sin_iva : a.valor_perdido_sin_iva
              const tramosConVenta = (a.tramos_resultado ?? []).filter((tramo) => Number(tramo.unidades_vendidas) > 0)
              return (
                <div key={a.id} className="bg-white rounded-card shadow-card p-3.5">
                  <ProductIdentity
                    producto={{
                      descripcion: a.producto_descripcion,
                      marca: a.producto_marca,
                      gramaje: a.producto_gramaje,
                      cod_art: a.producto_cod_art,
                      codigo_barras: a.producto_codigo_barras,
                      imagen_url: a.producto_imagen_url,
                    }}
                    compact
                    imageSize="sm"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${config.iconBg} ${config.iconColor}`}>
                        {formatearUnidades(unidadesPrincipales)} u. {tipo === 'vendido' ? 'recuperadas' : 'perdidas'}
                      </span>
                      {valorPrincipal != null && <span className="font-bold text-foreground">{formatearPesos(Number(valorPrincipal))} s/IVA</span>}
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatFechaHora(a.created_at)}</span>
                      {a.usuario_nombre && <span className="flex items-center gap-1"><User className="h-3 w-3" />{a.usuario_nombre}</span>}
                    </div>

                    {tramosConVenta.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {tramosConVenta.map((tramo) => (
                          <span key={`${a.id}-${tramo.orden}`} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-muted text-muted-foreground">
                            {tramo.rag_porcentaje == null ? 'Sin RAG' : `RAG ${Number(tramo.rag_porcentaje)}%`} → {formatearUnidades(Number(tramo.unidades_vendidas))} u.
                          </span>
                        ))}
                      </div>
                    )}

                    {!a.resultado_ciclo_completo && (
                      <p className="text-[10px] text-amber-700 mt-2">Ciclo histórico incompleto: Noven conserva el cierre disponible, pero no inventa ventas anteriores sin observaciones.</p>
                    )}
                    {tipo !== 'vendido' && Number(a.unidades_recuperadas) > 0 && (
                      <p className="text-[10px] text-emerald-700 mt-2">Antes del cierre se recuperaron {formatearUnidades(Number(a.unidades_recuperadas))} u. por venta.</p>
                    )}
                    {a.observaciones && <p className="text-muted-foreground text-xs mt-1.5 italic border-l-2 border-border pl-2">{a.observaciones}</p>}
                  </ProductIdentity>
                </div>
              )
            })}
          </div>
        )}

        {!loading && !error && acciones.length === 0 && (
          <div className="rounded-card bg-white shadow-card px-6 py-12 flex flex-col items-center text-center gap-4">
            <div className="p-4 bg-emerald-50 rounded-full"><Icono className="h-10 w-10 text-emerald-400" /></div>
            <div><p className="text-foreground font-semibold text-base">{config.tituloVacio}</p><p className="text-muted-foreground text-sm mt-1">Los cierres registrados aparecerán acá.</p></div>
          </div>
        )}
      </main>
    </div>
  )
}
