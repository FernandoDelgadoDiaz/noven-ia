import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Download, Loader2, RefreshCw, Tags } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  agruparPorSucursal,
  etiquetaEstado,
  exportarBandejaXlsx,
  fechaCorta,
  fechaHoraArgentina,
  nombreArchivoExportacion,
  type BandejaZonal,
  type GrupoSucursal,
  type SolicitudBandeja,
  type ZonaBandeja,
} from '@/lib/bandeja-rag-zonal'

const EMPTY_DATA: BandejaZonal = { ahora_argentina: '', zonas: [], solicitudes: [] }

function porcentaje(value: number | null): string {
  return value == null ? 'Sin RAG' : `${Number(value).toLocaleString('es-AR')}%`
}

function mensajeError(error: { code?: string; message?: string }): string {
  if (error.code === 'PGRST202' || /listar_bandeja_rag_zonal/i.test(error.message ?? '')) {
    return 'La bandeja zonal todavía no está habilitada en este entorno.'
  }
  return error.message || 'No se pudo cargar la bandeja zonal.'
}

function descargar(nombre: string, bytes: Uint8Array): void {
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)
}

export default function BandejaRagZonal() {
  const [data, setData] = useState<BandejaZonal>(EMPTY_DATA)
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

    const next = (result ?? EMPTY_DATA) as BandejaZonal
    setData({
      ahora_argentina: next.ahora_argentina ?? '',
      zonas: next.zonas ?? [],
      solicitudes: next.solicitudes ?? [],
    })
    setZonaId((actual) => {
      if (actual && next.zonas?.some((zona) => zona.id === actual)) return actual
      return next.zonas?.[0]?.id ?? ''
    })
    setLoading(false)
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  const zona: ZonaBandeja | undefined = data.zonas.find((item) => item.id === zonaId)
  const solicitudes = useMemo(
    () => data.solicitudes.filter((solicitud) => solicitud.zona_id === zonaId),
    [data.solicitudes, zonaId],
  )
  const grupos = useMemo(() => agruparPorSucursal(solicitudes), [solicitudes])
  const pendientes = solicitudes.filter((solicitud) => solicitud.requiere_ejecucion).length

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

  function exportar(sucursal: GrupoSucursal | null) {
    if (!zona) return
    const alcance = sucursal ? sucursal.solicitudes : solicitudes
    if (alcance.length === 0) return
    const exportacion = { zona, sucursal, solicitudes: alcance }
    descargar(nombreArchivoExportacion(exportacion), exportarBandejaXlsx(exportacion))
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
            <label className="text-xs font-bold uppercase tracking-wide text-foreground" htmlFor="zona-bandeja">Zona asignada</label>
            <select id="zona-bandeja" value={zonaId} onChange={(event) => setZonaId(event.target.value)} className="mt-1.5 w-full md:max-w-sm h-11 px-3 rounded-xl bg-surface-base border border-border">
              {data.zonas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </div>
        )}

        {zona && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-3 gap-3" aria-label="Resumen de la bandeja">
              <div className="bg-white rounded-card shadow-card p-4">
                <p className="text-xs text-muted-foreground">Zona</p>
                <p className="text-base font-bold text-foreground mt-1">{zona.nombre}</p>
              </div>
              <div className="bg-white rounded-card shadow-card p-4">
                <p className="text-xs text-muted-foreground">Pendientes de ejecución</p>
                <p className="text-2xl font-bold text-brand mt-1">{pendientes}</p>
              </div>
              <div className="bg-white rounded-card shadow-card p-4 col-span-2 md:col-span-1">
                <p className="text-xs text-muted-foreground">Ventana de recepción</p>
                <p className="text-base font-bold text-foreground mt-1">{zona.jornada_inicio} a {zona.jornada_corte}</p>
              </div>
            </section>

            <div className={`rounded-xl px-4 py-3 text-sm flex items-start gap-2 border ${zona.jornada_visible ? 'bg-white border-border text-foreground' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <Clock className="h-4 w-4 shrink-0 mt-0.5" />
              {zona.jornada_visible ? (
                <span>
                  Jornada del <strong>{fechaCorta(zona.jornada_visible)}</strong>.{' '}
                  {zona.ventana_abierta
                    ? 'La ventana está abierta: las solicitudes nuevas entran en tiempo real, dentro del bloque de su sucursal.'
                    : `La ventana cerró a las ${zona.jornada_corte}. Lo que se registre desde ahora se verá en la jornada del ${fechaCorta(zona.jornada_en_curso)}.`}
                </span>
              ) : (
                <span>
                  La ventana abre a las <strong>{zona.jornada_inicio}</strong>. Lo registrado para hoy espera hasta esa hora; acá sólo se muestran los pendientes de jornadas anteriores.
                </span>
              )}
            </div>
          </>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{error}
          </div>
        )}

        {zona && solicitudes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => exportar(null)} className="h-10 px-4 rounded-xl border border-border bg-white text-sm font-semibold flex items-center gap-2">
              <Download className="h-4 w-4" />Exportar toda la zona
            </button>
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
            <p className="mt-3 font-bold text-foreground">No hay cambios en esta jornada</p>
            <p className="mt-1 text-sm text-muted-foreground">Las solicitudes validadas de esta zona aparecerán acá al abrir la ventana.</p>
          </div>
        ) : (
          grupos.map((grupo) => (
            <section key={grupo.sucursal_id} className="space-y-3" aria-label={`Sucursal ${grupo.sucursal_codigo}`}>
              <div className="flex items-center justify-between gap-3 pt-2">
                <h2 className="text-sm font-bold text-foreground">
                  Sucursal {grupo.sucursal_codigo} · {grupo.sucursal_nombre}
                  <span className="ml-2 text-xs font-semibold text-muted-foreground">{grupo.solicitudes.length}</span>
                </h2>
                <button type="button" onClick={() => exportar(grupo)} className="h-9 px-3 rounded-xl border border-border bg-white text-xs font-semibold flex items-center gap-2">
                  <Download className="h-3.5 w-3.5" />Exportar sucursal
                </button>
              </div>

              {grupo.solicitudes.map((solicitud) => (
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
                    <Dato label="Vto. producto" value={fechaCorta(solicitud.fecha_vencimiento) || '—'} />
                    <Dato label="Fin de acción" value={fechaCorta(solicitud.fin_accion) || '—'} />
                    <Dato label="Stock comprometido" value={Number(solicitud.cantidad_comprometida).toLocaleString('es-AR')} />
                    <Dato label="Validado por" value={solicitud.validada_por_nombre} />
                    <Dato label="Fecha de validación" value={fechaHoraArgentina(solicitud.creada_at) || 'Sin dato'} />
                    <Dato label="Jornada zonal" value={fechaCorta(solicitud.jornada_zonal) || '—'} />
                    <Dato label="Estado" value={etiquetaEstado(solicitud.estado_actual)} />
                    {!solicitud.requiere_ejecucion && <Dato label="Habilita verificación" value={fechaCorta(solicitud.habilitada_desde) || '—'} />}
                  </div>

                  {solicitud.requiere_ejecucion ? (
                    <button type="button" onClick={() => void ejecutar(solicitud)} disabled={ejecutando === solicitud.id} className="mt-4 w-full md:w-auto h-11 px-5 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                      {ejecutando === solicitud.id && <Loader2 className="h-4 w-4 animate-spin" />}
                      Marcar Activo
                    </button>
                  ) : (
                    <p className="mt-4 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                      Carga informada. La sucursal podrá verificarla en góndola desde {fechaCorta(solicitud.habilitada_desde) || 'el día siguiente'}.
                    </p>
                  )}
                </article>
              ))}
            </section>
          ))
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
