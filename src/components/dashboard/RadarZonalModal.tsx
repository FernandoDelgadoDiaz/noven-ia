import { useMemo, useState } from 'react'
import { BellRing, CalendarDays, Check, Clock3, RefreshCw, Store, X } from 'lucide-react'
import type { AlertaRadarZonal, RespuestaRadarZonal } from '@/hooks/useRadarZonal'
import ProductIdentity from '@/components/product/ProductIdentity'

interface RadarZonalModalProps {
  alertas: AlertaRadarZonal[]
  loading: boolean
  error: string | null
  onClose: () => void
  onRefresh: () => Promise<void>
  onResponder: (args: {
    destinoId: string
    respuesta: RespuestaRadarZonal
    cantidad?: number | null
    fechaOtra?: string | null
  }) => Promise<void>
}

interface ConfirmacionPendiente {
  alerta: AlertaRadarZonal
  respuesta: 'misma_fecha' | 'otra_fecha'
}

function formatFecha(fecha: string): string {
  const [year, month, day] = fecha.split('-')
  if (!year || !month || !day) return fecha
  return `${day}/${month}/${year}`
}

function formatFrescura(fecha: string | null): string {
  if (!fecha) return 'Sin fecha de actualización'
  const diffMs = Date.now() - new Date(fecha).getTime()
  const horas = Math.max(0, Math.floor(diffMs / 3_600_000))
  if (horas < 1) return 'Actualizado hace menos de 1 h'
  if (horas < 24) return `Actualizado hace ${horas} h`
  const dias = Math.floor(horas / 24)
  return `Actualizado hace ${dias} día${dias === 1 ? '' : 's'}`
}

function labelNivel(nivel: AlertaRadarZonal['nivel_origen']): string {
  if (nivel === 'decomiso') return 'Decomiso'
  if (nivel === 'donacion') return 'Donación'
  if (nivel === 'urgente') return 'Urgente'
  return 'Radar'
}

function productoAlerta(alerta: AlertaRadarZonal) {
  return {
    descripcion: alerta.descripcion,
    marca: alerta.marca,
    gramaje: alerta.gramaje,
    cod_art: alerta.cod_art,
    codigo_barras: alerta.codigo_barras,
    imagen_thumb_url: alerta.imagen_thumb_url,
  }
}

export default function RadarZonalModal({
  alertas,
  loading,
  error,
  onClose,
  onRefresh,
  onResponder,
}: RadarZonalModalProps) {
  const [confirmacion, setConfirmacion] = useState<ConfirmacionPendiente | null>(null)
  const [cantidad, setCantidad] = useState('')
  const [fechaOtra, setFechaOtra] = useState('')
  const [guardandoId, setGuardandoId] = useState<string | null>(null)
  const [accionError, setAccionError] = useState<string | null>(null)

  const titulo = useMemo(
    () => alertas.length === 1 ? '1 alerta para revisar' : `${alertas.length} alertas para revisar`,
    [alertas.length],
  )

  async function responderSimple(alerta: AlertaRadarZonal, respuesta: 'no_lo_tengo' | 'revisar_despues') {
    setGuardandoId(alerta.destino_id)
    setAccionError(null)
    try {
      await onResponder({ destinoId: alerta.destino_id, respuesta })
      if (respuesta === 'revisar_despues') onClose()
    } catch (err) {
      console.error('[radar-zonal] Error respondiendo alerta', err)
      setAccionError('No pudimos registrar la respuesta. Intentá nuevamente.')
    } finally {
      setGuardandoId(null)
    }
  }

  function abrirConfirmacion(alerta: AlertaRadarZonal, respuesta: 'misma_fecha' | 'otra_fecha') {
    setConfirmacion({ alerta, respuesta })
    setCantidad('')
    setFechaOtra(respuesta === 'otra_fecha' ? '' : alerta.fecha_vencimiento)
    setAccionError(null)
  }

  async function confirmarVencimiento() {
    if (!confirmacion) return
    const qty = Number(cantidad)
    if (!Number.isInteger(qty) || qty <= 0) {
      setAccionError('Ingresá una cantidad comprometida mayor a cero.')
      return
    }
    if (confirmacion.respuesta === 'otra_fecha' && !fechaOtra) {
      setAccionError('Seleccioná la fecha que encontraste en tu local.')
      return
    }

    setGuardandoId(confirmacion.alerta.destino_id)
    setAccionError(null)
    try {
      await onResponder({
        destinoId: confirmacion.alerta.destino_id,
        respuesta: confirmacion.respuesta,
        cantidad: qty,
        fechaOtra: confirmacion.respuesta === 'otra_fecha' ? fechaOtra : null,
      })
      setConfirmacion(null)
    } catch (err) {
      console.error('[radar-zonal] Error confirmando vencimiento', err)
      setAccionError('No pudimos crear el seguimiento. Revisá los datos e intentá nuevamente.')
    } finally {
      setGuardandoId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px] flex items-end md:items-center md:justify-center" role="dialog" aria-modal="true" aria-label="Radar Zonal">
      <div className="bg-surface-base w-full max-h-[92vh] md:max-w-xl md:rounded-[28px] rounded-t-[28px] shadow-elevated overflow-hidden flex flex-col">
        <div className="bg-white px-4 py-4 border-b border-border/50 flex items-center gap-3 shrink-0">
          <div className="h-10 w-10 rounded-2xl bg-brand-light flex items-center justify-center shrink-0">
            <BellRing className="h-5 w-5 text-brand" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground">Radar Zonal</p>
            <p className="text-xs text-muted-foreground">{loading ? 'Buscando novedades…' : titulo}</p>
          </div>
          <button type="button" onClick={() => void onRefresh()} className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted" aria-label="Actualizar Radar Zonal">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted" aria-label="Cerrar Radar Zonal">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 space-y-3">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
          )}

          {!loading && alertas.length === 0 && (
            <div className="bg-white rounded-[22px] shadow-card px-5 py-8 text-center">
              <div className="h-12 w-12 mx-auto rounded-full bg-emerald-50 flex items-center justify-center">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="font-bold text-foreground mt-3">Todo revisado</p>
              <p className="text-xs text-muted-foreground mt-1">No hay alertas zonales pendientes para tu familia.</p>
            </div>
          )}

          {alertas.map((alerta) => {
            const busy = guardandoId === alerta.destino_id
            return (
              <article key={alerta.destino_id} className="bg-white rounded-[22px] shadow-card overflow-hidden">
                <div className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <ProductIdentity
                      producto={productoAlerta(alerta)}
                      label={`Detectado en Suc. ${alerta.sucursal_origen_codigo}`}
                      compact
                      imageSize="sm"
                    />
                  </div>
                  <span className="shrink-0 rounded-full bg-orange-50 text-orange-700 px-2 py-0.5 text-[9px] font-bold uppercase">{labelNivel(alerta.nivel_origen)}</span>
                </div>

                <div className="px-4 pb-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-surface-base px-3 py-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /><span className="text-[9px] uppercase font-bold">Fecha detectada</span></div>
                    <p className="text-xs font-bold text-foreground mt-1">{formatFecha(alerta.fecha_vencimiento)}</p>
                  </div>
                  <div className="rounded-xl bg-surface-base px-3 py-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground"><Store className="h-3.5 w-3.5" /><span className="text-[9px] uppercase font-bold">Tu stock</span></div>
                    <p className="text-xs font-bold text-foreground mt-1">{alerta.stock_actual} un.</p>
                  </div>
                </div>

                <div className="px-4 pb-3 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <Clock3 className="h-3 w-3 shrink-0" />
                  <span>{formatFrescura(alerta.stock_actualizado_at)}</span>
                  {alerta.estado === 'revisar_despues' && <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 font-semibold">Pendiente de revisión</span>}
                </div>

                <div className="border-t border-border/50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground">¿Tenés unidades con esta fecha?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={busy} onClick={() => abrirConfirmacion(alerta, 'misma_fecha')} className="rounded-xl bg-brand text-white px-3 py-2.5 text-xs font-bold disabled:opacity-50 active:scale-[0.98]">Sí, misma fecha</button>
                    <button type="button" disabled={busy} onClick={() => abrirConfirmacion(alerta, 'otra_fecha')} className="rounded-xl border border-brand text-brand px-3 py-2.5 text-xs font-bold disabled:opacity-50 active:scale-[0.98]">Tengo otra fecha</button>
                    <button type="button" disabled={busy} onClick={() => void responderSimple(alerta, 'no_lo_tengo')} className="rounded-xl border border-border bg-white text-foreground px-3 py-2.5 text-xs font-semibold disabled:opacity-50 active:scale-[0.98]">No lo tengo</button>
                    <button type="button" disabled={busy} onClick={() => void responderSimple(alerta, 'revisar_despues')} className="rounded-xl bg-muted text-muted-foreground px-3 py-2.5 text-xs font-semibold disabled:opacity-50 active:scale-[0.98]">Revisar después</button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        {confirmacion && (
          <div className="absolute inset-0 bg-black/35 flex items-end md:items-center md:justify-center z-10">
            <div className="bg-white w-full md:max-w-md rounded-t-[26px] md:rounded-[26px] p-5 shadow-elevated">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-brand mb-2">{confirmacion.respuesta === 'misma_fecha' ? 'Confirmar misma fecha' : 'Registrar otra fecha'}</p>
                  <ProductIdentity producto={productoAlerta(confirmacion.alerta)} compact imageSize="sm" />
                </div>
                <button type="button" onClick={() => setConfirmacion(null)} className="h-8 w-8 rounded-xl flex items-center justify-center hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
              </div>

              {confirmacion.respuesta === 'misma_fecha' && (
                <div className="mt-4 rounded-xl bg-brand-light px-3 py-2 text-xs text-brand font-semibold">Fecha: {formatFecha(confirmacion.alerta.fecha_vencimiento)}</div>
              )}

              {confirmacion.respuesta === 'otra_fecha' && (
                <label className="block mt-4">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Fecha que encontraste</span>
                  <input type="date" value={fechaOtra} onChange={(e) => setFechaOtra(e.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-surface-base px-3 py-3 text-sm text-foreground" />
                </label>
              )}

              <label className="block mt-4">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Cantidad comprometida con ese vencimiento</span>
                <input inputMode="numeric" type="number" min="1" step="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Ej. 12" className="mt-1.5 w-full rounded-xl border border-border bg-surface-base px-3 py-3 text-sm text-foreground" />
                <span className="block text-[10px] text-muted-foreground mt-1.5">Tu stock total registrado es {confirmacion.alerta.stock_actual} un. Ingresá sólo las unidades que verificaste con esta fecha.</span>
              </label>

              {accionError && <p className="mt-3 text-xs text-red-600">{accionError}</p>}

              <button type="button" disabled={guardandoId === confirmacion.alerta.destino_id} onClick={() => void confirmarVencimiento()} className="mt-5 w-full rounded-xl bg-brand text-white py-3 text-sm font-bold disabled:opacity-50 active:scale-[0.98]">
                {guardandoId === confirmacion.alerta.destino_id ? 'Guardando…' : 'Crear seguimiento en mi local'}
              </button>
            </div>
          </div>
        )}

        {accionError && !confirmacion && <div className="shrink-0 px-4 pb-4 text-xs text-red-600">{accionError}</div>}
      </div>
    </div>
  )
}
