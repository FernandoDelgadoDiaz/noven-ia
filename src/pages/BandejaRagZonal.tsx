import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Tags } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ZonaBandeja {
  id: string
  codigo: string
  nombre: string
  organizacion_id: string
}

interface SolicitudBandeja {
  id: string
  zona_id: string
  zona_nombre: string
  sucursal_id: string
  sucursal_codigo: string
  sucursal_nombre: string
  producto_codigo: string
  producto_descripcion: string
  sector_nombre: string
  familia_nombre: string
  porcentaje_rag_vigente: number | null
  porcentaje_solicitado: number
  fecha_vencimiento: string
  fin_accion: string
  cantidad_comprometida: number
  creada_at: string
  ultimo_evento: 'solicitada' | 'ejecutada' | 'no_aplicada'
  ultimo_evento_at: string
  habilitada_desde: string | null
  estado_actual: 'solicitada' | 'ejecutada_no_habilitada' | 'lista_confirmacion' | 'no_aplicada'
  validada_por_nombre: string
  requiere_ejecucion: boolean
}

interface BandejaData {
  zonas: ZonaBandeja[]
  solicitudes: SolicitudBandeja[]
}

const EMPTY_DATA: BandejaData = { zonas: [], solicitudes: [] }

function fecha(value: string | null): string {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function fechaHoraArgentina(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin dato'
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function porcentaje(value: number | null): string {
  return value == null ? 'Sin RAG' : `${Number(value).toLocaleString('es-AR')}%`
}

function mensajeError(error: { code?: string; message?: string }): string {
  if (error.code === 'PGRST202' || /listar_bandeja_rag_zonal/i.test(error.message ?? '')) {
    return 'La bandeja zonal todavía no está habilitada en este entorno.'
  }
  return error.message || 'No se pudo cargar la bandeja zonal.'
}

export default function BandejaRagZonal() {
  const [data, setData] = useState<BandejaData>(EMPTY_DATA)
  const [zonaId, setZonaId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ejecutando, setEjecutando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: result, error: rpcError } = await supabase.rpc('listar_bandeja_rag_zonal')
    if (rpcError) {
      setData(EMPTY_DATA)
      setError(mensajeError(rpcError))
      setLoading(false)
      return
    }

    const next = (result ?? EMPTY_DATA) as BandejaData
    setData({ zonas: next.zonas ?? [], solicitudes: next.solicitudes ?? [] })
    setZonaId((actual) => {
      if (actual && next.zonas?.some((zona) => zona.id === actual)) return actual
      return next.zonas?.[0]?.id ?? ''
    })
    setLoading(false)
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  const solicitudes = useMemo(
    () => data.solicitudes.filter((solicitud) => solicitud.zona_id === zonaId),
    [data.solicitudes, zonaId],
  )
  const pendientes = solicitudes.filter((solicitud) => solicitud.requiere_ejecucion).length
  const zona = data.zonas.find((item) => item.id === zonaId)

  async function ejecutar(solicitud: SolicitudBandeja) {
    const confirma = window.confirm(
      `¿Confirmás que cargaste ${solicitud.porcentaje_solicitado}% para ${solicitud.producto_descripcion} en la sucursal ${solicitud.sucursal_codigo}?`,
    )
    if (!confirma) return

    setEjecutando(solicitud.id)
    setError(null)
    const { error: rpcError } = await supabase.rpc('ejecutar_solicitud_cambio_rag', {
      p_solicitud_id: solicitud.id,
    })
    if (rpcError) setError(mensajeError(rpcError))
    else await cargar()
    setEjecutando(null)
  }

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-10 bg-white border-b border-border/40 px-4 md:px-8 py-4 md:py-5">
        <div className="max-w-6xl mx-auto flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Bandeja zonal RAG</h1>
            <p className="text-sm text-muted-foreground mt-1">Cambios validados que deben cargarse en el sistema de precios.</p>
          </div>
          <button type="button" onClick={() => void cargar()} disabled={loading} className="h-10 px-3 rounded-xl border border-border bg-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-5 md:py-6 pb-28 space-y-4">
        {data.zonas.length > 1 && (
          <div className="bg-white rounded-card shadow-card p-4">
            <label className="text-xs font-bold uppercase tracking-wide text-foreground">Zona asignada</label>
            <select value={zonaId} onChange={(event) => setZonaId(event.target.value)} className="mt-1.5 w-full md:max-w-sm h-11 px-3 rounded-xl bg-surface-base border border-border">
              {data.zonas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </div>
        )}

        {zona && (
          <section className="grid grid-cols-2 gap-3" aria-label="Resumen de la bandeja">
            <div className="bg-white rounded-card shadow-card p-4">
              <p className="text-xs text-muted-foreground">Zona</p>
              <p className="text-base font-bold text-foreground mt-1">{zona.nombre}</p>
            </div>
            <div className="bg-white rounded-card shadow-card p-4">
              <p className="text-xs text-muted-foreground">Pendientes de ejecución</p>
              <p className="text-2xl font-bold text-brand mt-1">{pendientes}</p>
            </div>
          </section>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{error}
          </div>
        )}

        {loading && solicitudes.length === 0 ? (
          <div className="bg-white rounded-card shadow-card py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-brand" />
            <p className="text-sm">Cargando solicitudes de la zona...</p>
          </div>
        ) : solicitudes.length === 0 && !error ? (
          <div className="bg-white rounded-card shadow-card py-16 text-center px-5">
            <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
            <p className="mt-3 font-bold text-foreground">No hay cambios pendientes</p>
            <p className="mt-1 text-sm text-muted-foreground">Las solicitudes validadas de esta zona aparecerán acá.</p>
          </div>
        ) : (
          <section className="space-y-3" aria-label="Solicitudes RAG de la zona">
            {solicitudes.map((solicitud) => (
              <article key={solicitud.id} className="bg-white rounded-card shadow-card p-4 md:p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
                    <Tags className="h-5 w-5 text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-foreground">Sucursal {solicitud.sucursal_codigo}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${solicitud.requiere_ejecucion ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {solicitud.requiere_ejecucion ? 'PENDIENTE' : 'EJECUTADA'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{solicitud.sector_nombre} · {solicitud.familia_nombre}</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{solicitud.producto_descripcion}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Código {solicitud.producto_codigo}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <Dato label="Cambio RAG" value={`${porcentaje(solicitud.porcentaje_rag_vigente)} → ${porcentaje(solicitud.porcentaje_solicitado)}`} />
                  <Dato label="Vto. producto" value={fecha(solicitud.fecha_vencimiento)} />
                  <Dato label="Fin de acción" value={fecha(solicitud.fin_accion)} />
                  <Dato label="Stock comprometido" value={Number(solicitud.cantidad_comprometida).toLocaleString('es-AR')} />
                  <Dato label="Validado por" value={solicitud.validada_por_nombre} />
                  <Dato label="Fecha de validación" value={fechaHoraArgentina(solicitud.creada_at)} />
                  {!solicitud.requiere_ejecucion && <Dato label="Habilita verificación" value={fecha(solicitud.habilitada_desde)} />}
                </div>

                {solicitud.requiere_ejecucion ? (
                  <button type="button" onClick={() => void ejecutar(solicitud)} disabled={ejecutando === solicitud.id} className="mt-4 w-full md:w-auto h-11 px-5 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                    {ejecutando === solicitud.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    Marcar como ejecutada
                  </button>
                ) : (
                  <p className="mt-4 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                    Carga informada. La sucursal podrá verificarla en góndola desde {fecha(solicitud.habilitada_desde)}.
                  </p>
                )}
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  )
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground mt-0.5">{value}</p>
    </div>
  )
}
