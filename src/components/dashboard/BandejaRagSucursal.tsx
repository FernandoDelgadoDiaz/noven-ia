import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, ClipboardCheck, Clock3 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useEscalaRag } from '@/hooks/useEscalaRag'
import { evaluarSugerencia } from '@/lib/ragCobertura'
import type { EstadoSolicitudCambioRag, VencimientoConRiesgo } from '@/types/index'

interface SeguimientoRow {
  vencimiento_id: string
  rag_porcentaje: number | null
  velocidad_observada: number | null
  velocidad_necesaria: number | null
  dias_comerciales_restantes: number | null
  dias_observados: number | null
  dias_desde_ultimo_rag: number | null
  estado_seguimiento_rag: string | null
  cantidad_actual_estimacion: number | null
}

interface SolicitudRow {
  id: string
  vencimiento_id: string
  porcentaje_rag_vigente: number | null
  porcentaje_solicitado: number
  cantidad_comprometida: number
  creada_at: string
  estado_actual: EstadoSolicitudCambioRag
}

interface ItemBandeja {
  vencimiento: VencimientoConRiesgo
  porcentajeDesde: number | null
  porcentajeHasta: number
  estado: EstadoSolicitudCambioRag | 'espera_validacion'
  diasComerciales: number
  dineroRiesgo: number
}

interface Props {
  visible: boolean
  vencimientos: VencimientoConRiesgo[]
  costosSinIva: Record<string, number>
  onAbrir: (vencimiento: VencimientoConRiesgo) => void
}

const ESTADO_LABEL: Record<ItemBandeja['estado'], string> = {
  espera_validacion: 'Esperando validación',
  solicitada: 'Pendiente de ejecución',
  ejecutada_no_habilitada: 'Ejecutada · disponible mañana',
  lista_confirmacion: 'Lista para verificar',
  confirmada: 'Confirmada en góndola',
  no_aplicada: 'No aplicada · requiere nueva ejecución',
}

function esVistaAusente(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export default function BandejaRagSucursal({
  visible,
  vencimientos,
  costosSinIva,
  onAbrir,
}: Props) {
  const { escala } = useEscalaRag()
  const [seguimientos, setSeguimientos] = useState<SeguimientoRow[]>([])
  const [solicitudes, setSolicitudes] = useState<SolicitudRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ids = useMemo(() => vencimientos.map((v) => v.id), [vencimientos])
  const idsKey = ids.join(',')

  useEffect(() => {
    let cancelado = false
    if (!visible || ids.length === 0) {
      setSeguimientos([])
      setSolicitudes([])
      setLoading(false)
      return () => { cancelado = true }
    }

    setLoading(true)
    setError(null)
    void Promise.all([
      supabase
        .from('v_seguimiento_rag_actual')
        .select('vencimiento_id, rag_porcentaje, velocidad_observada, velocidad_necesaria, dias_comerciales_restantes, dias_observados, dias_desde_ultimo_rag, estado_seguimiento_rag, cantidad_actual_estimacion')
        .in('vencimiento_id', ids),
      supabase
        .from('v_solicitudes_cambio_rag_actual')
        .select('id, vencimiento_id, porcentaje_rag_vigente, porcentaje_solicitado, cantidad_comprometida, creada_at, estado_actual')
        .in('vencimiento_id', ids)
        .order('creada_at', { ascending: false }),
    ]).then(([seguimientoResult, solicitudesResult]) => {
      if (cancelado) return
      const errores = [seguimientoResult.error, solicitudesResult.error].filter(
        (err) => err && !esVistaAusente(err),
      )
      if (errores.length > 0) {
        setError(errores[0]?.message ?? 'No se pudo cargar la bandeja RAG.')
      }
      setSeguimientos(seguimientoResult.error ? [] : seguimientoResult.data as SeguimientoRow[])
      setSolicitudes(solicitudesResult.error ? [] : solicitudesResult.data as SolicitudRow[])
      setLoading(false)
    })

    return () => { cancelado = true }
    // idsKey representa la lista estable de vencimientos, no la identidad del array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, idsKey])

  const items = useMemo(() => {
    const vencimientoPorId = new Map(vencimientos.map((v) => [v.id, v]))
    const solicitudPorVencimiento = new Map<string, SolicitudRow>()
    for (const solicitud of solicitudes) {
      if (!solicitudPorVencimiento.has(solicitud.vencimiento_id)) {
        solicitudPorVencimiento.set(solicitud.vencimiento_id, solicitud)
      }
    }

    const pendientes: ItemBandeja[] = []
    for (const seguimiento of seguimientos) {
      const vencimiento = vencimientoPorId.get(seguimiento.vencimiento_id)
      if (!vencimiento) continue
      const solicitud = solicitudPorVencimiento.get(seguimiento.vencimiento_id)
      const costo = costosSinIva[vencimiento.producto_id] ?? 0

      if (solicitud && solicitud.estado_actual !== 'confirmada') {
        pendientes.push({
          vencimiento,
          porcentajeDesde: solicitud.porcentaje_rag_vigente,
          porcentajeHasta: solicitud.porcentaje_solicitado,
          estado: solicitud.estado_actual,
          diasComerciales: seguimiento.dias_comerciales_restantes ?? vencimiento.dias_comerciales_restantes,
          dineroRiesgo: solicitud.cantidad_comprometida * costo,
        })
        continue
      }

      const sugerencia = evaluarSugerencia({
        estado: seguimiento.estado_seguimiento_rag,
        velocidadObservada: seguimiento.velocidad_observada,
        velocidadNecesaria: seguimiento.velocidad_necesaria,
        diasComercialesRestantes: seguimiento.dias_comerciales_restantes,
        diasObservados: seguimiento.dias_observados,
        diasDesdeUltimoRag: seguimiento.dias_desde_ultimo_rag,
        ragPorcentaje: seguimiento.rag_porcentaje,
      }, escala)
      if (!sugerencia.hay || sugerencia.hasta == null) continue

      pendientes.push({
        vencimiento,
        porcentajeDesde: sugerencia.desde,
        porcentajeHasta: sugerencia.hasta,
        estado: 'espera_validacion',
        diasComerciales: seguimiento.dias_comerciales_restantes ?? vencimiento.dias_comerciales_restantes,
        dineroRiesgo: (seguimiento.cantidad_actual_estimacion ?? vencimiento.cantidad) * costo,
      })
    }

    return pendientes.sort((a, b) =>
      a.diasComerciales - b.diasComerciales || b.dineroRiesgo - a.dineroRiesgo,
    )
  }, [costosSinIva, escala, seguimientos, solicitudes, vencimientos])

  if (!visible || (!loading && !error && items.length === 0)) return null

  return (
    <section aria-label="Bandeja RAG de la sucursal" className="rounded-[20px] border border-amber-200 bg-white shadow-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-amber-100 bg-amber-50/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-amber-700" aria-hidden="true" />
          <div>
            <h2 className="text-xs font-bold text-amber-950">Validación RAG de la sucursal</h2>
            <p className="text-[10px] text-amber-800">Urgencia primero; ante empate, mayor dinero en riesgo.</p>
          </div>
        </div>
        {!loading && <span className="text-[10px] font-bold text-amber-800">{items.length} pendientes</span>}
      </div>

      {loading ? (
        <p className="px-4 py-4 text-xs text-muted-foreground">Cargando validaciones…</p>
      ) : error ? (
        <p role="alert" className="px-4 py-3 text-xs text-red-600">No se pudo cargar la bandeja: {error}</p>
      ) : (
        <div className="divide-y divide-border/70">
          {items.map((item) => (
            <button
              key={item.vencimiento.id}
              type="button"
              onClick={() => onAbrir(item.vencimiento)}
              className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-amber-50/40 transition-colors"
            >
              <Clock3 className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground">{item.vencimiento.producto.descripcion}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {ESTADO_LABEL[item.estado]} · {item.porcentajeDesde ?? 0}% → {item.porcentajeHasta}% · {item.diasComerciales} días comerciales
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
