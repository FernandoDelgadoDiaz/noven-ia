import { AlertTriangle, BellRing, CheckCircle2, ChevronRight, Clock3, ShieldAlert } from 'lucide-react'
import { formatearPesos, formatearUnidades } from '@/lib/economia-riesgo'
import type { EstadoProblemaActivo, ProblemaActivo, ResumenProblemasActivos } from '@/hooks/useProblemasActivos'

interface Props {
  resumen: ResumenProblemasActivos
  problemas: ProblemaActivo[]
  loading: boolean
  error: string | null
  onVerTodos: () => void
}

const ESTADO_VISUAL: Record<EstadoProblemaActivo, {
  label: string
  badge: string
  icono: typeof AlertTriangle
}> = {
  requiere_cierre: {
    label: 'Cierre pendiente',
    badge: 'bg-red-50 text-red-700 border-red-200',
    icono: ShieldAlert,
  },
  escalado_sin_respuesta: {
    label: 'Sin respuesta',
    badge: 'bg-red-50 text-red-700 border-red-200',
    icono: BellRing,
  },
  requiere_revision: {
    label: 'Revisar hoy',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
    icono: AlertTriangle,
  },
  requiere_intervencion: {
    label: 'Verificar RAG',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    icono: AlertTriangle,
  },
  intervencion_aplicada: {
    label: 'Control pendiente',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    icono: Clock3,
  },
  bajo_control: {
    label: 'Bajo control',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icono: CheckCircle2,
  },
  dato_a_revisar: {
    label: 'Dato a revisar',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    icono: AlertTriangle,
  },
}

function valorEconomico(valor: number | null): string {
  return valor == null ? 'Costo pendiente' : formatearPesos(valor)
}

function detalleEscalamiento(problema: ProblemaActivo): string | null {
  if (problema.estado_problema !== 'escalado_sin_respuesta') return null
  if (problema.notificado) {
    const enviados = problema.push_enviados ?? 0
    return `Escalamiento notificado${enviados > 0 ? ` · ${enviados} envío${enviados === 1 ? '' : 's'}` : ''}`
  }
  return 'Escalamiento registrado · notificación pendiente o sin suscripción activa'
}

export default function ProblemasActivosPanel({ resumen, problemas, loading, error, onVerTodos }: Props) {
  const principales = problemas.slice(0, 4)
  const riesgoEconomico = resumen.valorizados > 0
    ? formatearPesos(resumen.dinero_en_riesgo_sin_iva)
    : 'Costo pendiente'

  return (
    <section aria-label="Problemas activos" className="bg-white rounded-[22px] shadow-card overflow-hidden">
      <div className="px-4 py-3.5 border-b border-border/60 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-foreground" aria-hidden="true" />
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-foreground">Problemas activos</h2>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Qué sigue abierto, qué necesita acción y qué ya está bajo control.</p>
        </div>
        <button
          type="button"
          onClick={onVerTodos}
          className="shrink-0 text-[10px] font-semibold text-brand flex items-center gap-0.5"
        >
          Ver riesgo <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <div className="px-4 py-4 space-y-3" aria-label="Cargando problemas activos">
          <div className="h-12 rounded-xl bg-muted animate-pulse" />
          <div className="h-16 rounded-xl bg-muted animate-pulse" />
          <div className="h-16 rounded-xl bg-muted animate-pulse" />
        </div>
      ) : error ? (
        <div className="px-4 py-4">
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
            <p className="text-xs font-semibold text-amber-800">Seguimiento temporalmente no disponible</p>
            <p className="text-[10px] text-amber-700 mt-0.5">El dashboard de vencimientos sigue operativo. Reintentá con Actualizar.</p>
          </div>
        </div>
      ) : resumen.abiertos === 0 ? (
        <div className="px-4 py-7 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground mt-2">Sin problemas económicos activos</p>
          <p className="text-[11px] text-muted-foreground mt-1">No hay vencimientos en estado Decomiso, Donación, Urgente o Radar.</p>
        </div>
      ) : (
        <>
          <div className="px-4 py-3 bg-surface-base/60 border-b border-border/50">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-2xl font-black tabular-nums text-foreground leading-none">{resumen.abiertos}</p>
                <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mt-1">problemas abiertos</p>
              </div>
              <div className="text-right">
                <p className="text-base font-black tabular-nums text-orange-700 leading-none">{riesgoEconomico}</p>
                <p className="text-[9px] font-semibold text-muted-foreground mt-1">{formatearUnidades(resumen.unidades_expuestas)} un. expuestas · costo s/IVA</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {resumen.requieren_accion > 0 && (
                <span className="px-2 py-1 rounded-full bg-orange-50 border border-orange-200 text-[9px] font-bold text-orange-700">
                  {resumen.requieren_accion} requieren acción
                </span>
              )}
              {resumen.sin_respuesta > 0 && (
                <span className="px-2 py-1 rounded-full bg-red-50 border border-red-200 text-[9px] font-bold text-red-700">
                  {resumen.sin_respuesta} sin respuesta
                </span>
              )}
              {resumen.bajo_control > 0 && (
                <span className="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[9px] font-bold text-emerald-700">
                  {resumen.bajo_control} bajo control
                </span>
              )}
              {resumen.valorizados < resumen.abiertos && (
                <span className="px-2 py-1 rounded-full bg-muted border border-border text-[9px] font-semibold text-muted-foreground">
                  {resumen.valorizados}/{resumen.abiertos} valorizados
                </span>
              )}
            </div>
          </div>

          <div className="divide-y divide-border/60">
            {principales.map((problema, index) => {
              const visual = ESTADO_VISUAL[problema.estado_problema]
              const Icono = visual.icono
              const escalamiento = detalleEscalamiento(problema)

              return (
                <div key={problema.vencimiento_id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0 text-[10px] font-black text-foreground tabular-nums">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{problema.descripcion}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">SKU {problema.cod_art}{problema.marca ? ` · ${problema.marca}` : ''}</p>
                        </div>
                        <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[8px] font-bold ${visual.badge}`}>
                          <Icono className="h-2.5 w-2.5" aria-hidden="true" />
                          {visual.label}
                        </span>
                      </div>

                      <p className="text-[10px] text-foreground/80 mt-1.5 leading-snug">{problema.motivo_prioridad}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-muted-foreground">
                        <span className="font-semibold text-foreground">{formatearUnidades(problema.unidades_expuestas)} un.</span>
                        <span>·</span>
                        <span className="font-semibold text-foreground">{valorEconomico(problema.dinero_en_riesgo_sin_iva)}</span>
                        {problema.rag_porcentaje != null && (
                          <>
                            <span>·</span>
                            <span>RAG {problema.rag_porcentaje}%</span>
                          </>
                        )}
                      </div>

                      {escalamiento && (
                        <p className="text-[9px] text-red-700 mt-1.5">{escalamiento}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {resumen.abiertos > principales.length && (
            <button
              type="button"
              onClick={onVerTodos}
              className="w-full px-4 py-2.5 text-[10px] font-semibold text-brand border-t border-border/60 hover:bg-muted/40 transition-colors"
            >
              Ver los {resumen.abiertos} problemas abiertos →
            </button>
          )}
        </>
      )}
    </section>
  )
}
