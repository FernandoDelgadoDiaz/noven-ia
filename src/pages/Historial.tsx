import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, HandHeart, Trash2, PackageOpen, Clock, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getTrimestreActual } from '@/hooks/useAccionesOperativas'
import { useSucursalActual } from '@/hooks/useSucursalActual'

type TipoAccion = 'donacion' | 'decomiso'

interface HistorialRow {
  id: string
  tipo: string
  cantidad: number
  created_at: string
  observaciones: string | null
  usuario_id: string | null
  productos: {
    descripcion: string
    marca: string | null
    imagen_url: string | null
  } | null
}

interface AccionHistorial extends HistorialRow {
  usuarioNombre: string | null
}

const TIPO_CONFIG: Record<TipoAccion, {
  titulo: string
  verbo: string
  Icono: typeof HandHeart
  iconBg: string
  iconColor: string
  totalColor: string
}> = {
  donacion: {
    titulo: 'Donaciones',
    verbo: 'donadas',
    Icono: HandHeart,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    totalColor: 'text-orange-600',
  },
  decomiso: {
    titulo: 'Decomisos',
    verbo: 'decomisadas',
    Icono: Trash2,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    totalColor: 'text-red-600',
  },
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatFechaHora(iso: string): string {
  const d = new Date(iso)
  const fecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
  const hora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${fecha} · ${hora}`
}

export default function Historial() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { sucursalId, loading: sucursalLoading } = useSucursalActual()

  const tipo: TipoAccion = searchParams.get('tipo') === 'decomiso' ? 'decomiso' : 'donacion'
  const config = TIPO_CONFIG[tipo]

  const trimestreInfo = useMemo(() => getTrimestreActual(), [])

  const [acciones, setAcciones] = useState<AccionHistorial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const subtitulo = useMemo(() => {
    const mesInicio = capitalizar(new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(trimestreInfo.desde))
    const mesFin = capitalizar(new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(trimestreInfo.hasta))
    return `${mesInicio} — ${mesFin} ${trimestreInfo.anio}`
  }, [trimestreInfo])

  const totalUnidades = useMemo(
    () => acciones.reduce((sum, a) => sum + a.cantidad, 0),
    [acciones],
  )

  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)

    const { trimestre, anio } = trimestreInfo
    const { data, error: fetchError } = await supabase
      .from('acciones_operativas')
      .select(`
        id, tipo, cantidad, created_at, observaciones, usuario_id,
        productos ( descripcion, marca, imagen_url )
      `)
      .eq('tipo', tipo)
      .eq('trimestre', trimestre)
      .eq('anio', anio)
      .eq('sucursal_id', sucursalId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as unknown as HistorialRow[]

    // usuario_id referencia auth.users, no public.usuarios — resolvemos el nombre en una query aparte
    const ids = Array.from(new Set(rows.map((r) => r.usuario_id).filter((id): id is string => id !== null)))
    const nombrePorId = new Map<string, string>()
    if (ids.length > 0) {
      const { data: usuarios } = await supabase
        .from('usuarios')
        .select('id, nombre')
        .in('id', ids)
      for (const u of usuarios ?? []) {
        nombrePorId.set(u.id as string, (u.nombre as string) || '')
      }
    }

    setAcciones(
      rows.map((r) => ({
        ...r,
        usuarioNombre: r.usuario_id ? (nombrePorId.get(r.usuario_id) || null) : null,
      })),
    )
    setLoading(false)
  }, [tipo, trimestreInfo, sucursalId])

  useEffect(() => {
    if (sucursalLoading) return
    void fetchData()
  }, [fetchData, sucursalLoading])

  const { Icono } = config

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-border/40 px-4 md:px-8 py-4 md:py-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="p-1.5 -ml-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 active:scale-[0.94]"
            aria-label="Volver al dashboard"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-none truncate">
              Historial de {config.titulo} Q{trimestreInfo.trimestre} {trimestreInfo.anio}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 leading-none">{subtitulo}</p>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 py-5 md:py-6 space-y-4">
        {/* Total destacado */}
        <div className="bg-white rounded-card shadow-card p-5 flex items-center gap-4">
          <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${config.iconBg}`}>
            <Icono className={`h-6 w-6 ${config.iconColor}`} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className={`text-4xl font-black tracking-tight leading-none tabular-nums ${config.totalColor}`}>
              {loading ? '–' : totalUnidades}
            </p>
            <p className="text-sm text-muted-foreground mt-1.5">
              unidades {config.verbo} este trimestre
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div role="alert" className="rounded-card bg-red-50 border border-red-200 px-4 py-3 flex items-center justify-between gap-3 animate-fade-in">
            <p className="text-sm text-red-600">No pudimos cargar el historial. Revisá tu conexión.</p>
            <button
              type="button"
              onClick={() => void fetchData()}
              className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-800 border border-red-300 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Skeletons */}
        {loading && (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-card shadow-card h-20 animate-pulse" aria-hidden="true" />
            ))}
          </div>
        )}

        {/* Lista */}
        {!loading && !error && acciones.length > 0 && (
          <div className="space-y-2.5">
            {acciones.map((a) => (
              <div key={a.id} className="bg-white rounded-card shadow-card p-3.5 flex gap-3">
                {/* Foto */}
                <div className="h-14 w-14 rounded-xl bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                  {a.productos?.imagen_url ? (
                    <img
                      src={a.productos.imagen_url}
                      alt={a.productos.descripcion}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <PackageOpen className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  )}
                </div>

                {/* Datos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-foreground font-semibold text-sm leading-snug line-clamp-2 min-w-0">
                      {a.productos?.descripcion ?? 'Producto eliminado'}
                    </p>
                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full leading-tight ${config.iconBg} ${config.iconColor}`}>
                      {a.cantidad} u.
                    </span>
                  </div>

                  {a.productos?.marca && (
                    <p className="text-muted-foreground text-xs mt-0.5">{a.productos.marca}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                      {formatFechaHora(a.created_at)}
                    </span>
                    {a.usuarioNombre && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {a.usuarioNombre}
                      </span>
                    )}
                  </div>

                  {a.observaciones && (
                    <p className="text-muted-foreground text-xs mt-1.5 italic border-l-2 border-border pl-2">
                      {a.observaciones}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && acciones.length === 0 && (
          <div className="rounded-card bg-white shadow-card px-6 py-12 flex flex-col items-center text-center gap-4">
            <div className="p-4 bg-emerald-50 rounded-full">
              <Icono className="h-10 w-10 text-emerald-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-foreground font-semibold text-base">
                No hay {config.titulo.toLowerCase()} registrados este trimestre
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                Los registros aparecerán acá a medida que se carguen.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
