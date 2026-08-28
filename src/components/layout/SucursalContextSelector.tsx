import { Building2 } from 'lucide-react'
import { useSucursalActual } from '@/hooks/useSucursalActual'

export default function SucursalContextSelector({ mobile = false }: { mobile?: boolean }) {
  const {
    sucursalId,
    loading,
    sucursalesPermitidas,
    seleccionarSucursal,
  } = useSucursalActual()

  if (loading || sucursalesPermitidas.length <= 1) return null

  return (
    <div className={mobile ? 'px-3 py-2 border-b border-border/50 bg-white' : 'px-3 py-3'}>
      <label className="block text-[10px] uppercase tracking-wide font-bold text-muted-foreground mb-1.5">
        Sucursal de trabajo
      </label>
      <div className="relative">
        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand pointer-events-none" />
        <select
          value={sucursalId}
          onChange={(e) => seleccionarSucursal(e.target.value)}
          className="w-full h-10 pl-9 pr-8 rounded-xl border border-border bg-surface-base text-sm font-semibold text-foreground focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          aria-label="Seleccionar sucursal de trabajo"
        >
          <option value="" disabled>Seleccionar sucursal</option>
          {sucursalesPermitidas.map((s) => (
            <option key={s.id} value={s.id}>
              {s.codigo} · {s.nombre}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
