import type { RiesgoNivel, VencimientoConRiesgo } from '@/types/index'

interface AlertaItemProps {
  vencimiento: VencimientoConRiesgo
  onClick?: () => void
}

interface NivelConfig {
  label: string
  badgeCls: string
  dotCls: string
  pulsante: boolean
}

const nivelConfig: Record<RiesgoNivel, NivelConfig> = {
  critico: {
    label: 'Critico',
    badgeCls: 'bg-red-500/20 text-red-400 border border-red-500/40',
    dotCls: 'bg-red-500',
    pulsante: true,
  },
  alto: {
    label: 'Alto',
    badgeCls: 'bg-red-800/20 text-red-300 border border-red-700/40',
    dotCls: 'bg-red-400',
    pulsante: false,
  },
  moderado: {
    label: 'Moderado',
    badgeCls: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40',
    dotCls: 'bg-yellow-400',
    pulsante: false,
  },
  seguro: {
    label: 'Seguro',
    badgeCls: 'bg-green-500/20 text-green-400 border border-green-500/40',
    dotCls: 'bg-green-400',
    pulsante: false,
  },
}

function formatCobertura(dias: number): string {
  if (!isFinite(dias)) return 'Sin rotacion'
  return `${Math.round(dias)} dias stock`
}

export default function AlertaItem({ vencimiento, onClick }: AlertaItemProps) {
  const cfg = nivelConfig[vencimiento.nivel_riesgo]

  const diasLabel =
    vencimiento.dias_restantes < 0
      ? `Vencido hace ${Math.abs(vencimiento.dias_restantes)} dias`
      : vencimiento.dias_restantes === 0
        ? 'Vence hoy'
        : `Vence en ${vencimiento.dias_restantes} dias`

  return (
    <div
      className={`flex items-start gap-3 rounded-xl bg-zinc-900 border border-zinc-800 p-4 transition-colors ${onClick ? 'cursor-pointer hover:bg-gray-800 active:bg-gray-700' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
    >
      {/* Semaforo */}
      <div className="flex-shrink-0 mt-0.5">
        {cfg.pulsante ? (
          <span className="relative flex h-3 w-3">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dotCls} opacity-75`}
            />
            <span className={`relative inline-flex rounded-full h-3 w-3 ${cfg.dotCls}`} />
          </span>
        ) : (
          <span className={`inline-flex rounded-full h-3 w-3 ${cfg.dotCls}`} />
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-white leading-tight line-clamp-2">
            {vencimiento.producto.descripcion}
          </p>
          <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badgeCls}`}>
            {cfg.label}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-400">
          <span>{diasLabel}</span>
          <span>{formatCobertura(vencimiento.cobertura_dias)}</span>
          {vencimiento.producto.marca && (
            <span className="text-zinc-500">{vencimiento.producto.marca}</span>
          )}
        </div>

        {/* Acciones sugeridas */}
        {vencimiento.acciones_sugeridas.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {vencimiento.acciones_sugeridas.map((accion) => (
              <button
                key={accion}
                type="button"
                className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors active:scale-95"
              >
                {accion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
