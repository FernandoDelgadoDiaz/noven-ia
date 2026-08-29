import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, ScanLine, RefreshCw, AlertTriangle, FolderX, Trash2, CircleCheckBig } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useVencimientos } from '@/hooks/useVencimientos'
import { useAuth } from '@/hooks/useAuth'
import { useAccionesOperativas } from '@/hooks/useAccionesOperativas'
import { useSucursalActual } from '@/hooks/useSucursalActual'
import { usePuedeOperarSucursal } from '@/hooks/usePuedeOperarSucursal'
import { calcularCostoEnRiesgo, calcularUnidadesExpuestas, formatearPesos, formatearUnidades } from '@/lib/economia-riesgo'
import AlertaItem from '@/components/dashboard/AlertaItem'
import EditarVencimientoModal from '@/components/dashboard/EditarVencimientoModal'
import AccionOperativaModal from '@/components/dashboard/AccionOperativaModal'
import RadarZonalBell from '@/components/dashboard/RadarZonalBell'
import type { VencimientoConRiesgo } from '@/types/index'

const ORDEN_RIESGO: Record<string, number> = {
  decomiso: 0,
  donacion: 1,
  urgente: 2,
  radar: 3,
  seguro: 4,
}

interface AccionPendiente {
  vencimiento: VencimientoConRiesgo
  tipo: 'donacion' | 'decomiso'
}

interface CostoRiesgoResponse {
  success: boolean
  costos?: Array<{ producto_id: string; costo_sin_iva: number; observado_at: string }>
}

function formatFechaHeader(): string {
  const raw = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días 👋'
  if (h < 18) return 'Buenas tardes 👋'
  return 'Buenas noches 👋'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { sucursalId } = useSucursalActual()
  const { puedeOperar } = usePuedeOperarSucursal()
  const { data, loading, error, refetch, sinFamilias } = useVencimientos(sucursalId)
  const { user } = useAuth()
  const {
    vendidos,
    donaciones,
    decomisos: decomisosTrimestrales,
    recuperado,
    perdido,
    hayValorizacionRetrospectiva,
    loading: loadingAcciones,
    trimestreInfo,
    refetch: refetchAcciones,
  } = useAccionesOperativas()

  const [vencimientoEditando, setVencimientoEditando] = useState<VencimientoConRiesgo | null>(null)
  const [accionPendiente, setAccionPendiente] = useState<AccionPendiente | null>(null)
  const [costosSinIva, setCostosSinIva] = useState<Record<string, number>>({})
  const [costosLoading, setCostosLoading] = useState(false)

  const [familiaNombres, setFamiliaNombres] = useState<Record<string, string>>({})
  const familiaIdsEnData = useMemo(() => {
    const set = new Set<string>()
    data.forEach((v) => { if (v.producto.familia_id) set.add(v.producto.familia_id) })
    return Array.from(set)
  }, [data])

  useEffect(() => {
    const faltantes = familiaIdsEnData.filter((id) => !(id in familiaNombres))
    if (faltantes.length === 0) return
    void supabase
      .from('familias')
      .select('id, nombre')
      .in('id', faltantes)
      .then(({ data: rows }) => {
        if (!rows) return
        setFamiliaNombres((prev) => {
          const next = { ...prev }
          for (const r of rows) next[r.id as string] = r.nombre as string
          return next
        })
      })
  }, [familiaIdsEnData, familiaNombres])

  const productoIdsEnData = useMemo(
    () => Array.from(new Set(data.map((v) => v.producto_id))),
    [data],
  )

  useEffect(() => {
    let cancelado = false
    async function cargarCostos(): Promise<void> {
      if (!sucursalId || productoIdsEnData.length === 0) {
        setCostosSinIva({})
        return
      }
      setCostosLoading(true)
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        if (!token) return
        const response = await fetch('/.netlify/functions/costos-riesgo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sucursalId, productoIds: productoIdsEnData }),
        })
        if (!response.ok) return
        const payload = await response.json() as CostoRiesgoResponse
        if (!payload.success || cancelado) return
        const next: Record<string, number> = {}
        for (const row of payload.costos ?? []) next[row.producto_id] = row.costo_sin_iva
        setCostosSinIva(next)
      } finally {
        if (!cancelado) setCostosLoading(false)
      }
    }
    void cargarCostos()
    return () => { cancelado = true }
  }, [sucursalId, productoIdsEnData])

  const alertasOrdenadas = [...data].sort(
    (a, b) => ORDEN_RIESGO[a.nivel_riesgo] - ORDEN_RIESGO[b.nivel_riesgo],
  )

  const itemsEnRiesgo = data.filter(
    (v) => v.nivel_riesgo === 'decomiso' || v.nivel_riesgo === 'donacion' || v.nivel_riesgo === 'urgente' || v.nivel_riesgo === 'radar',
  )
  const enRiesgo = itemsEnRiesgo.length

  const itemsAccionInmediata = data.filter(
    (v) => v.nivel_riesgo === 'decomiso' || v.nivel_riesgo === 'donacion' || v.nivel_riesgo === 'urgente',
  )
  const accionInmediata = itemsAccionInmediata.length

  const exposiciones = itemsEnRiesgo.map((v) => ({
    productoId: v.producto_id,
    unidades: calcularUnidadesExpuestas({
      cantidad: v.cantidad,
      venta_media_diaria: v.producto.venta_media_diaria,
      dias_comerciales_restantes: v.dias_comerciales_restantes,
    }),
  }))
  const unidadesEnRiesgo = exposiciones.reduce((acc, item) => acc + item.unidades, 0)
  const exposicionesValorizadas = exposiciones.filter((item) => costosSinIva[item.productoId] != null)
  const pesosEnRiesgo = exposicionesValorizadas.reduce(
    (acc, item) => acc + calcularCostoEnRiesgo(item.unidades, costosSinIva[item.productoId]),
    0,
  )
  const coberturaCostosCompleta = enRiesgo > 0 && exposicionesValorizadas.length === enRiesgo

  const enRadar = data.filter((v) => v.nivel_riesgo === 'radar').length
  const hayCriticos = data.some((v) => v.nivel_riesgo === 'decomiso' || v.nivel_riesgo === 'donacion')
  const perdidaUnidades = donaciones + decomisosTrimestrales

  const avatarLetter = user?.email?.[0]?.toUpperCase() ?? 'U'

  function handleRegistrarAccion(vencimiento: VencimientoConRiesgo, tipo: 'donacion' | 'decomiso'): void {
    if (!puedeOperar) return
    setAccionPendiente({ vencimiento, tipo })
  }

  function handleAccionSuccess(): void {
    void refetch()
    void refetchAcciones()
  }

  return (
    <div className="min-h-screen bg-surface-base">
      {puedeOperar && vencimientoEditando !== null && (
        <EditarVencimientoModal
          vencimiento={{
            id: vencimientoEditando.id,
            producto_id: vencimientoEditando.producto_id,
            fecha_vencimiento: vencimientoEditando.fecha_vencimiento,
            cantidad: vencimientoEditando.cantidad,
            nivel_riesgo: vencimientoEditando.nivel_riesgo,
            productos: {
              descripcion: vencimientoEditando.producto.descripcion,
              cod_art: vencimientoEditando.producto.cod_art,
              codigo_barras: vencimientoEditando.producto.codigo_barras,
              gramaje: vencimientoEditando.producto.gramaje,
              marca: vencimientoEditando.producto.marca,
              stock_actual: vencimientoEditando.producto.stock_actual,
              venta_media_diaria: vencimientoEditando.producto.venta_media_diaria,
              imagen_url: vencimientoEditando.producto.imagen_url,
              imagen_thumb_url: vencimientoEditando.producto.imagen_thumb_url,
              organizacion_id: vencimientoEditando.producto.organizacion_id,
            },
          }}
          onClose={() => setVencimientoEditando(null)}
          onGuardado={() => { setVencimientoEditando(null); void refetch(); void refetchAcciones() }}
          onImagenActualizada={() => void refetch()}
        />
      )}

      {puedeOperar && accionPendiente !== null && (
        <AccionOperativaModal
          vencimiento={accionPendiente.vencimiento}
          tipo={accionPendiente.tipo}
          onClose={() => setAccionPendiente(null)}
          onSuccess={handleAccionSuccess}
        />
      )}

      <header className="sticky top-0 z-10 bg-white border-b border-border/40 px-4 md:px-8 py-4 md:py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-none">
              {getGreeting()}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{formatFechaHeader()}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { void refetch(); void refetchAcciones() }}
              disabled={loading}
              className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground transition-colors duration-150 disabled:opacity-40 active:scale-[0.94]"
              aria-label="Actualizar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <RadarZonalBell sucursalId={sucursalId} hayCriticos={hayCriticos} />

            <div
              className="h-9 w-9 rounded-full bg-brand flex items-center justify-center text-white font-bold text-sm shadow-brand shrink-0 select-none"
              aria-label="Perfil"
            >
              {avatarLetter}
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 py-4 md:py-6 space-y-4 md:space-y-5">
        {error && (
          <div role="alert" className="rounded-[20px] bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 animate-fade-in">
            No pudimos cargar los datos. Revisá tu conexión e intentá de nuevo.
          </div>
        )}

        {!loading && sinFamilias && (
          <div role="alert" className="rounded-[20px] bg-amber-50 border border-amber-200 px-5 py-4 flex items-center gap-4 animate-fade-in">
            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <FolderX className="h-5 w-5 text-amber-600" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-amber-800 text-sm">Sin familias asignadas</p>
              <p className="text-amber-700 text-xs mt-0.5">No tenés familias asignadas. Contactá al administrador.</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-[24px] bg-white shadow-card h-[136px] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {accionInmediata > 0 && (
              <div className="flex items-center gap-3 bg-red-50 border-l-4 border-red-600 rounded-r-2xl px-4 py-3 animate-fade-in">
                <div className="h-9 w-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-red-800 text-sm leading-snug">Atención requerida</p>
                  <p className="text-red-600 text-xs mt-0.5">
                    {accionInmediata} producto{accionInmediata !== 1 ? 's' : ''} requieren acción inmediata.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/vencimientos')}
                  className="shrink-0 px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl transition-colors duration-150 active:scale-[0.97] whitespace-nowrap"
                >
                  Ver →
                </button>
              </div>
            )}

            <section aria-label="Resumen de riesgos" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/vencimientos?filtro=riesgo')}
                  className="bg-white rounded-[20px] shadow-card p-3.5 text-left min-h-[122px] hover:shadow-elevated transition-all active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="h-8 w-8 rounded-xl bg-orange-50 flex items-center justify-center">
                      <Package className="h-4 w-4 text-orange-600" aria-hidden="true" />
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground">{enRiesgo} productos</span>
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-3xl font-black leading-none tabular-nums text-orange-600">{formatearUnidades(unidadesEnRiesgo)}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">un. en riesgo</span>
                  </div>
                  <div className="mt-2 border-t border-border/60 pt-2">
                    <p className="text-base font-black leading-none tabular-nums text-orange-700">
                      {costosLoading
                        ? 'Calculando…'
                        : exposicionesValorizadas.length > 0
                          ? formatearPesos(pesosEnRiesgo)
                          : 'Costo pendiente'}
                    </p>
                    <p className="text-[9px] font-semibold text-muted-foreground mt-1">
                      costo en riesgo s/IVA
                      {!costosLoading && exposicionesValorizadas.length > 0 && !coberturaCostosCompleta
                        ? ` · ${exposicionesValorizadas.length}/${enRiesgo} productos valorizados`
                        : ''}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/vencimientos?filtro=radar')}
                  className="bg-white rounded-[20px] shadow-card p-3.5 text-left min-h-[122px] hover:shadow-elevated transition-all active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="h-8 w-8 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Package className="h-4 w-4 text-amber-500" aria-hidden="true" />
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground">hasta 45 días</span>
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-3xl font-black leading-none tabular-nums text-amber-600">{enRadar}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">en radar</span>
                  </div>
                </button>
              </div>

              <div className="bg-white rounded-[20px] shadow-card px-3.5 py-3">
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Resultados</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{trimestreInfo.label} · costo s/IVA</p>
                  </div>
                  <button type="button" onClick={() => navigate('/historial')} className="text-[10px] font-semibold text-brand">Ver historial →</button>
                </div>

                <div className="grid grid-cols-2 divide-x divide-border">
                  <button type="button" onClick={() => navigate('/historial?tipo=vendido')} className="pr-3 text-left">
                    <div className="flex items-center gap-1.5">
                      <CircleCheckBig className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-xl font-black tabular-nums text-emerald-600">{loadingAcciones ? '–' : formatearUnidades(vendidos)}</span>
                      <span className="text-[9px] font-bold uppercase text-muted-foreground">un.</span>
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mt-1">Recuperadas por venta</p>
                    <p className="text-sm font-black tabular-nums text-emerald-700 mt-1">
                      {loadingAcciones ? '–' : recuperado.accionesConCosto > 0 ? formatearPesos(recuperado.pesos) : 'Costo pendiente'}
                    </p>
                    {recuperado.accionesSinCosto > 0 && !loadingAcciones && (
                      <p className="text-[8px] text-muted-foreground mt-0.5">{recuperado.accionesSinCosto} cierre{recuperado.accionesSinCosto !== 1 ? 's' : ''} sin costo</p>
                    )}
                  </button>

                  <button type="button" onClick={() => navigate('/historial')} className="pl-3 text-left">
                    <div className="flex items-center gap-1.5">
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      <span className="text-xl font-black tabular-nums text-red-600">{loadingAcciones ? '–' : formatearUnidades(perdidaUnidades)}</span>
                      <span className="text-[9px] font-bold uppercase text-muted-foreground">un.</span>
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mt-1">Perdidas · donación + decomiso</p>
                    <p className="text-sm font-black tabular-nums text-red-700 mt-1">
                      {loadingAcciones ? '–' : perdido.accionesConCosto > 0 ? formatearPesos(perdido.pesos) : 'Costo pendiente'}
                    </p>
                    {perdido.accionesSinCosto > 0 && !loadingAcciones && (
                      <p className="text-[8px] text-muted-foreground mt-0.5">{perdido.accionesSinCosto} cierre{perdido.accionesSinCosto !== 1 ? 's' : ''} sin costo</p>
                    )}
                  </button>
                </div>

                <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
                  <span>Donación: {donaciones} un. · Decomiso: {decomisosTrimestrales} un.</span>
                  {hayValorizacionRetrospectiva && <span title="Acciones anteriores al registro de costos 0258 se valorizaron con el primer costo disponible." className="text-right">histórico valorizado*</span>}
                </div>
              </div>
            </section>

            <section aria-label="Alertas de vencimiento">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  Alertas priorizadas
                </h2>
                {alertasOrdenadas.length > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {alertasOrdenadas.length} registros
                  </span>
                )}
              </div>

              {alertasOrdenadas.length === 0 ? (
                <div className="rounded-[24px] bg-white shadow-card px-6 py-12 flex flex-col items-center text-center gap-4">
                  <div className="p-4 bg-emerald-50 rounded-full">
                    <ScanLine className="h-10 w-10 text-emerald-400" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-foreground font-semibold text-base">Sin productos registrados</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      {puedeOperar
                        ? 'Usá el Scanner para cargar el primer vencimiento.'
                        : 'No hay vencimientos registrados en esta sucursal.'}
                    </p>
                  </div>
                  {puedeOperar && (
                    <button
                      type="button"
                      onClick={() => navigate('/scanner')}
                      className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold shadow-brand transition-all duration-150 active:scale-[0.97]"
                    >
                      Ir al Scanner
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3 pb-28 md:pb-10">
                  {alertasOrdenadas.map((v) => (
                    <AlertaItem
                      key={v.id}
                      vencimiento={v}
                      familiaNombre={v.producto.familia_id ? (familiaNombres[v.producto.familia_id] ?? null) : null}
                      onClick={puedeOperar ? () => setVencimientoEditando(v) : undefined}
                      onRegistrarAccion={puedeOperar ? handleRegistrarAccion : undefined}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
