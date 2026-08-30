import { useCallback, useEffect, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, ChevronRight, Clock3, RefreshCw, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useSucursalActual } from '@/hooks/useSucursalActual'
import { formatearPesos, formatearUnidades } from '@/lib/economia-riesgo'

type EstadoProblema =
  | 'requiere_cierre'
  | 'escalado_sin_respuesta'
  | 'requiere_revision'
  | 'requiere_intervencion'
  | 'intervencion_aplicada'
  | 'bajo_control'
  | 'dato_a_revisar'

interface ProblemaActivo {
  vencimiento_id: string
  descripcion: string
  cod_art: string
  marca: string | null
  nivel: string
  estado_problema: EstadoProblema
  motivo_prioridad: string
  unidades_expuestas: number
  dinero_en_riesgo_sin_iva: number | null
  dias_comerciales_restantes: number
  rag_porcentaje: number | null
  escalado_at: string | null
  notificado: boolean
  ultima_respuesta_at: string | null
  ultima_respuesta_tipo: string | null
}

interface ResumenProblemas {
  abiertos: number
  sin_respuesta: number
  bajo_control: number
  requieren_accion: number
  unidades_expuestas: number
  dinero_en_riesgo_sin_iva: number
  valorizados: number
}

interface ProblemasResponse {
  success: boolean
  resumen?: ResumenProblemas
  problemas?: ProblemaActivo[]
  error?: string
}

const ESTADO_UI: Record<EstadoProblema, { label: string; cls: string }> = {
  requiere_cierre: { label: 'Cerrar hoy', cls: 'bg-red-50 text-red-700 border-red-200' },
  escalado_sin_respuesta: { label: 'Sin respuesta', cls: 'bg-red-50 text-red-700 border-red-200' },
  requiere_revision: { label: 'Revisar hoy', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  requiere_intervencion: { label: 'Intervenir', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  intervencion_aplicada: { label: 'Control pendiente', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  bajo_control: { label: 'Bajo control', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  dato_a_revisar: { label: 'Dato a revisar', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
}

function estadoIcono(estado: EstadoProblema) {
  if (estado === 'bajo_control') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />
  if (estado === 'intervencion_aplicada') return <Clock3 className="h-4 w-4 text-blue-600" />
  if (estado === 'escalado_sin_respuesta' || estado === 'requiere_cierre') return <ShieldAlert className="h-4 w-4 text-red-600" />
  return <AlertTriangle className="h-4 w-4 text-amber-600" />
}

export default function ProblemasActivosCard() {
  const navigate = useNavigate()
  const { sucursalId } = useSucursalActual()
  const [resumen, setResumen] = useState<ResumenProblemas | null>(null)
  const [problemas, setProblemas] = useState<ProblemaActivo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async (): Promise<void> => {
    if (!sucursalId) {
      setResumen(null)
      setProblemas([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        setError('Sesión expirada')
        return
      }

      const response = await fetch('/.netlify/functions/problemas-activos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sucursalId }),
      })
      const payload = await response.json() as ProblemasResponse
      if (!response.ok || !payload.success || !payload.resumen) {
        setError(payload.error ?? 'Seguimiento no disponible')
        return
      }
      setResumen(payload.resumen)
      setProblemas(payload.problemas ?? [])
    } catch {
      setError('Seguimiento no disponible')
    } finally {
      setLoading(false)
    }
  }, [sucursalId])

  useEffect(() => { void cargar() }, [cargar])

  if (loading) {
    return <div className="h-[178px] rounded-[20px] bg-white shadow-card animate-pulse" aria-label="Cargando problemas activos" />
  }

  if (error) {
    return (
      <section className="rounded-[20px] bg-white shadow-card px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">Problemas activos</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
          <button type="button" onClick={() => void cargar()} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Reintentar seguimiento">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </section>
    )
  }

  if (!resumen || resumen.abiertos === 0) {
    return (
      <section className="rounded-[20px] bg-white shadow-card px-4 py-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Sin problemas económicos abiertos</p>
          <p className="text-xs text-muted-foreground mt-0.5">No hay casos de vencimiento que requieran seguimiento.</p>
        </div>
      </section>
    )
  }

  const top = problemas.slice(0, 3)

  return (
    <section aria-label="Problemas económicos activos" className="rounded-[20px] bg-white shadow-card overflow-hidden">
      <div className="px-4 py-3.5 border-b border-border/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <Activity className="h-4 w-4 text-slate-700" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Problemas activos</p>
            <p className="text-[10px] text-muted-foreground">Seguimiento hasta resolución</p>
          </div>
        </div>
        <button type="button" onClick={() => void cargar()} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Actualizar problemas activos">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border/60 px-2 py-3">
        <div className="px-2">
          <p className="text-xl font-black tabular-nums text-foreground">{resumen.abiertos}</p>
          <p className="text-[9px] uppercase font-bold tracking-wide text-muted-foreground">abiertos</p>
        </div>
        <div className="px-2">
          <p className="text-base font-black tabular-nums text-orange-700">{formatearPesos(resumen.dinero_en_riesgo_sin_iva)}</p>
          <p className="text-[9px] uppercase font-bold tracking-wide text-muted-foreground">$ expuestos s/IVA</p>
        </div>
        <div className="px-2">
          <p className={`text-xl font-black tabular-nums ${resumen.sin_respuesta > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{resumen.sin_respuesta}</p>
          <p className="text-[9px] uppercase font-bold tracking-wide text-muted-foreground">sin respuesta</p>
        </div>
      </div>

      {top.length > 0 && (
        <div className="border-t border-border/60">
          {top.map((problema, index) => {
            const estado = ESTADO_UI[problema.estado_problema]
            return (
              <button
                key={problema.vencimiento_id}
                type="button"
                onClick={() => navigate(`/vencimientos?vencimiento=${encodeURIComponent(problema.vencimiento_id)}`)}
                className={`w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-muted/40 transition-colors ${index > 0 ? 'border-t border-border/50' : ''}`}
              >
                <div className="mt-0.5 shrink-0">{estadoIcono(problema.estado_problema)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-foreground truncate">{problema.descripcion}</p>
                    <span className={`shrink-0 text-[8px] font-bold px-2 py-0.5 rounded-full border ${estado.cls}`}>{estado.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{problema.motivo_prioridad}</p>
                  <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground">
                    <span>{formatearUnidades(problema.unidades_expuestas)} un.</span>
                    <span>·</span>
                    <span className="font-semibold text-foreground">{problema.dinero_en_riesgo_sin_iva == null ? 'sin costo' : formatearPesos(problema.dinero_en_riesgo_sin_iva)}</span>
                    {problema.rag_porcentaje != null && <><span>·</span><span>RAG {problema.rag_porcentaje}%</span></>}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-2" />
              </button>
            )
          })}
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-border/60 flex items-center justify-between text-[9px] text-muted-foreground">
        <span>{resumen.requieren_accion} requieren acción · {resumen.bajo_control} bajo control</span>
        <span>{resumen.valorizados}/{resumen.abiertos} valorizados</span>
      </div>
    </section>
  )
}
