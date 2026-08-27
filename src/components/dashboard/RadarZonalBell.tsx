import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useRadarZonal } from '@/hooks/useRadarZonal'
import RadarZonalModal from '@/components/dashboard/RadarZonalModal'

interface RadarZonalBellProps {
  sucursalId: string
  hayCriticos: boolean
}

export default function RadarZonalBell({ sucursalId, hayCriticos }: RadarZonalBellProps) {
  const [abierto, setAbierto] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const radar = useRadarZonal(sucursalId)

  useEffect(() => {
    if (searchParams.get('radar_zonal') !== '1') return
    setAbierto(true)
    const next = new URLSearchParams(searchParams)
    next.delete('radar_zonal')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  function abrir() {
    setAbierto(true)
    void radar.refetch()
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="relative h-9 w-9 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground transition-colors duration-150 active:scale-[0.94]"
        aria-label={radar.cantidadPendiente > 0 ? `Radar Zonal: ${radar.cantidadPendiente} alertas pendientes` : 'Notificaciones'}
      >
        <Bell className="h-4 w-4" />
        {radar.cantidadPendiente > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-brand text-white border-2 border-white text-[8px] font-black leading-[13px] text-center tabular-nums">
            {radar.cantidadPendiente > 9 ? '9+' : radar.cantidadPendiente}
          </span>
        ) : hayCriticos ? (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white" />
        ) : null}
      </button>

      {abierto && (
        <RadarZonalModal
          alertas={radar.alertas}
          loading={radar.loading}
          error={radar.error}
          onClose={() => setAbierto(false)}
          onRefresh={radar.refetch}
          onResponder={radar.responder}
        />
      )}
    </>
  )
}
