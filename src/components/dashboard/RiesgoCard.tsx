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
        'bg-white rounded-card p-4 flex flex-col gap-3 shadow-card',
        isInteractive
          ? 'cursor-pointer hover:shadow-elevated transition-all duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand'
          : '',
      ].join(' ')}
    >
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-xl ${v.statIconBg}`}>
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

      {/* Value */}
      <div>
        <p className={`text-3xl font-bold leading-none ${v.statValueText}`}>{valor}</p>
        <p className="text-xs text-muted-foreground font-medium mt-1.5 uppercase tracking-wide leading-tight">
          {titulo}
        </p>
      </div>
    </div>
  )
}
