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
        'bg-white rounded-[24px] shadow-card p-5 md:p-6 flex flex-col',
        isInteractive
          ? 'cursor-pointer hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.97] active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand'
          : '',
      ].join(' ')}
    >
      {/* Icon circular + badge */}
      <div className="flex items-start justify-between mb-4">
        <div className={`h-11 w-11 rounded-full ${v.statIconBg} flex items-center justify-center shrink-0`}>
          {IconoComponente ? (
            <IconoComponente className={`h-5 w-5 ${v.statIconColor}`} />
          ) : icono ? (
            <span className="text-lg leading-none" aria-hidden="true">{icono}</span>
          ) : (
            <Package className={`h-5 w-5 ${v.statIconColor}`} />
          )}
        </div>

        {typeof valor === 'number' && valor > 0 && (
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${v.badge}`}>
            activo
          </span>
        )}
      </div>

      {/* Dominant number */}
      <p className={`text-5xl font-black tracking-tight leading-none tabular-nums ${v.statValueText}`}>
        {valor}
      </p>

      {/* Label */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-2.5 leading-tight">
        {titulo}
      </p>
    </div>
  )
}
