import { RISK_VISUAL } from '@/lib/risk-config'
import type { RiesgoNivel } from '@/types/index'
import { Package } from 'lucide-react'

interface RiesgoCardProps {
  titulo: string
  valor: number | string
  nivel: RiesgoNivel
  icono?: string
  IconoComponente?: React.ComponentType<{ className?: string }>
  onClick?: () => void
}

export default function RiesgoCard({
  titulo,
  valor,
  nivel,
  icono,
  IconoComponente,
  onClick,
}: RiesgoCardProps) {
  const v = RISK_VISUAL[nivel]
  const isInteractive = Boolean(onClick)

  return (
    <div
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={isInteractive ? (e) => { if (e.key === 'Enter') onClick?.() } : undefined}
      className={[
        'relative overflow-hidden rounded-card shadow-card md:shadow-kpi',
        v.cardGradient,
        isInteractive
          ? 'cursor-pointer hover:shadow-elevated hover:-translate-y-px transition-all duration-200 active:scale-[0.97] active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand'
          : '',
      ].join(' ')}
    >
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${v.accentBar}`} />

      {/* Icon row */}
      <div className="flex items-start justify-between pt-4 px-4">
        <div className={`p-2.5 rounded-xl ${v.statIconBg}`}>
          {IconoComponente ? (
            <IconoComponente className={`h-4 w-4 ${v.statIconColor}`} />
          ) : icono ? (
            <span className="text-base leading-none" aria-hidden="true">{icono}</span>
          ) : (
            <Package className={`h-4 w-4 ${v.statIconColor}`} />
          )}
        </div>

        {typeof valor === 'number' && valor > 0 && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.badge}`}>
            activo
          </span>
        )}
      </div>

      {/* Value + label */}
      <div className="px-4 pt-2.5 pb-4">
        <p className={`text-4xl font-black tracking-tight leading-none tabular-nums ${v.statValueText}`}>
          {valor}
        </p>
        <p className="text-[11px] text-muted-foreground font-semibold mt-1.5 uppercase tracking-wide leading-tight">
          {titulo}
        </p>
      </div>
    </div>
  )
}
