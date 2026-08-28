import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Check, ChevronDown, ChevronRight, Copy, Link2, Loader2, Mail, MapPinned, Plus, Shield, Store, Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type RolInvitable = 'gerente_zonal' | 'gerente_sucursal'
type Canal = 'link' | 'email'

interface RegionItem { id: string; codigo: string; nombre: string; organizacion_id: string }
interface ZonaItem { id: string; codigo: string; nombre: string; region_id: string; organizacion_id: string }
interface SucursalItem { id: string; codigo: string; nombre: string; zona_id: string; organizacion_id: string }
interface Contexto {
  success: boolean
  error?: string
  puede_crear_zonal?: boolean
  regiones?: RegionItem[]
  zonas?: ZonaItem[]
  sucursales?: SucursalItem[]
}

interface ResultadoInvitacion {
  success: boolean
  error?: string
  canal?: Canal
  link?: string | null
}

async function tokenActual(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('La sesión expiró. Volvé a iniciar sesión.')
  return token
}

async function request(body: Record<string, unknown>): Promise<Contexto | ResultadoInvitacion> {
  const token = await tokenActual()
  const res = await fetch('/.netlify/functions/admin-accesos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({ success: false, error: 'Respuesta inválida del servidor' }))
  if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo completar la operación.')
  return data
}

export default function AdminAccesos() {
  const [contexto, setContexto] = useState<Contexto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState(false)
  const [regionesAbiertas, setRegionesAbiertas] = useState<Set<string>>(new Set())
  const [zonasAbiertas, setZonasAbiertas] = useState<Set<string>>(new Set())

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setContexto(await request({ accion: 'listar' }) as Contexto)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  function toggleRegion(id: string) {
    setRegionesAbiertas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleZona(id: string) {
    setZonasAbiertas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-10 bg-white border-b border-border/40 px-4 md:px-8 py-4 md:py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Accesos y jerarquía</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerentes zonales y gerentes de sucursal</p>
          </div>
          <button
            type="button"
            onClick={() => setModal(true)}
            disabled={loading || !contexto}
            className="h-10 px-4 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-xl shadow-brand flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />Nueva invitación
          </button>
        </div>
      </header>

      <main className="px-4 md:px-8 py-5 md:py-6 max-w-5xl space-y-4 pb-28">
        {loading ? (
          <div className="bg-white rounded-card shadow-card p-6 flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-brand animate-spin" />
            <p className="text-sm text-muted-foreground">Cargando estructura autorizada...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-card p-4 text-sm text-red-700">{error}</div>
        ) : contexto ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Resumen titulo="Regiones" valor={contexto.regiones?.length ?? 0} Icono={MapPinned} />
              <Resumen titulo="Zonas" valor={contexto.zonas?.length ?? 0} Icono={Shield} />
              <Resumen titulo="Sucursales" valor={contexto.sucursales?.length ?? 0} Icono={Building2} />
            </div>

            <section className="space-y-3" aria-label="Estructura disponible">
              <div className="px-1">
                <h2 className="text-sm font-bold text-foreground">Estructura disponible</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Abrí una región y después una zona para ver sus sucursales. Noven solo permite asignar accesos dentro de tu jerarquía real.
                </p>
              </div>

              {(contexto.regiones ?? []).map((region) => {
                const zonas = (contexto.zonas ?? []).filter((z) => z.region_id === region.id)
                const zonaIds = new Set(zonas.map((z) => z.id))
                const sucursalesRegion = (contexto.sucursales ?? []).filter((s) => zonaIds.has(s.zona_id)).length
                const abierta = regionesAbiertas.has(region.id)

                return (
                  <div key={region.id} className="bg-white rounded-card shadow-card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleRegion(region.id)}
                      className="w-full px-4 py-4 flex items-center gap-3 text-left select-none"
                      aria-expanded={abierta}
                    >
                      <div className="h-10 w-10 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
                        <MapPinned className="h-5 w-5 text-brand" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground">{region.nombre}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {zonas.length} zona{zonas.length !== 1 ? 's' : ''} · {sucursalesRegion} sucursales
                        </p>
                      </div>
                      {abierta
                        ? <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                        : <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />}
                    </button>

                    {abierta && (
                      <div className="border-t border-border/60 divide-y divide-border/50">
                        {zonas.map((zona) => {
                          const sucursalesZona = (contexto.sucursales ?? [])
                            .filter((s) => s.zona_id === zona.id)
                            .sort((a, b) => a.codigo.localeCompare(b.codigo))
                          const zonaAbierta = zonasAbiertas.has(zona.id)

                          return (
                            <div key={zona.id} className="bg-surface-base/35">
                              <button
                                type="button"
                                onClick={() => toggleZona(zona.id)}
                                className="w-full px-4 py-3 flex items-center gap-3 text-left select-none"
                                aria-expanded={zonaAbierta}
                              >
                                <div className="h-8 w-8 rounded-lg bg-white border border-border/60 flex items-center justify-center shrink-0">
                                  <Shield className="h-4 w-4 text-brand" />
                                </div>
                                <p className="flex-1 min-w-0 text-sm font-medium text-foreground">{zona.nombre}</p>
                                <div className="text-right shrink-0 mr-1">
                                  <p className="text-sm font-bold tabular-nums text-foreground">{sucursalesZona.length}</p>
                                  <p className="text-[10px] text-muted-foreground">sucursales</p>
                                </div>
                                {zonaAbierta
                                  ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                              </button>

                              {zonaAbierta && (
                                <div className="border-t border-border/50 bg-white divide-y divide-border/40">
                                  {sucursalesZona.map((sucursal) => (
                                    <div key={sucursal.id} className="px-4 py-3 pl-12 flex items-center gap-3">
                                      <div className="h-8 w-8 rounded-lg bg-brand-light flex items-center justify-center shrink-0">
                                        <Store className="h-4 w-4 text-brand" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground">Sucursal {sucursal.codigo}</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sucursal.nombre}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          </>
        ) : null}
      </main>

      {modal && contexto && (
        <ModalInvitacion contexto={contexto} onClose={() => setModal(false)} />
      )}
    </div>
  )
}

function Resumen({ titulo, valor, Icono }: { titulo: string; valor: number; Icono: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="bg-white rounded-card shadow-card p-4">
      <div className="h-8 w-8 rounded-lg bg-brand-light flex items-center justify-center"><Icono className="h-4 w-4 text-brand" /></div>
      <p className="text-2xl font-bold text-foreground mt-3">{valor}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{titulo}</p>
    </div>
  )
}

function ModalInvitacion({ contexto, onClose }: { contexto: Contexto; onClose: () => void }) {
  const zonas = contexto.zonas ?? []
  const sucursales = contexto.sucursales ?? []
  const puedeZonal = Boolean(contexto.puede_crear_zonal)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<RolInvitable>(puedeZonal ? 'gerente_zonal' : 'gerente_sucursal')
  const [zonaId, setZonaId] = useState(zonas.length === 1 ? zonas[0].id : '')
  const [sucursalId, setSucursalId] = useState('')
  const [canal, setCanal] = useState<Canal>('link')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoInvitacion | null>(null)
  const [copiado, setCopiado] = useState(false)

  const sucursalesFiltradas = useMemo(
    () => zonaId ? sucursales.filter((s) => s.zona_id === zonaId) : [],
    [sucursales, zonaId],
  )

  const alcanceNombre = useMemo(() => {
    if (rol === 'gerente_zonal') return zonas.find((z) => z.id === zonaId)?.nombre ?? ''
    const s = sucursales.find((x) => x.id === sucursalId)
    return s ? `Sucursal ${s.codigo}` : ''
  }, [rol, zonas, zonaId, sucursales, sucursalId])

  function cambiarRol(next: RolInvitable) {
    setRol(next)
    setSucursalId('')
    if (zonas.length === 1) setZonaId(zonas[0].id)
    else setZonaId('')
  }

  async function guardar() {
    setError(null)
    setGuardando(true)
    try {
      const data = await request({
        accion: 'invitar',
        nombre,
        email,
        rol,
        zonaId: rol === 'gerente_zonal' ? zonaId : null,
        sucursalId: rol === 'gerente_sucursal' ? sucursalId : null,
        canal,
      }) as ResultadoInvitacion
      setResultado(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGuardando(false)
    }
  }

  async function copiar() {
    if (!resultado?.link) return
    const rolTexto = rol === 'gerente_zonal' ? 'Gerente Zonal' : 'Gerente de Sucursal'
    const texto = `Hola ${nombre}, te invito a ingresar a Noven IA como ${rolTexto}${alcanceNombre ? ` · ${alcanceNombre}` : ''}. Abrí este enlace para activar tu cuenta y crear tu contraseña:\n${resultado.link}`
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
    window.setTimeout(() => setCopiado(false), 1800)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/35 flex items-end md:items-center justify-center md:p-4">
      <div className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-3xl shadow-elevated max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-border flex items-center justify-between z-10">
          <div>
            <h2 className="font-bold text-lg text-foreground">Nueva invitación</h2>
            <p className="text-xs text-muted-foreground">El usuario creará su propia contraseña.</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-lg hover:bg-muted flex items-center justify-center"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {resultado ? (
            <div className="py-3">
              <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto"><Check className="h-6 w-6 text-emerald-600" /></div>
              <h3 className="mt-4 text-center font-bold text-foreground">Invitación creada</h3>
              <p className="mt-1 text-center text-sm text-muted-foreground">{nombre} · {alcanceNombre}</p>

              {resultado.canal === 'link' && resultado.link ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-xl bg-surface-base border border-border px-3 py-2 text-xs text-muted-foreground break-all">{resultado.link}</div>
                  <button type="button" onClick={() => void copiar()} className="w-full h-12 rounded-xl bg-brand text-white font-semibold flex items-center justify-center gap-2">
                    {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiado ? 'Mensaje copiado' : 'Copiar invitación para WhatsApp'}
                  </button>
                </div>
              ) : (
                <div className="mt-5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">Supabase envió la invitación al email indicado.</div>
              )}

              <button type="button" onClick={onClose} className="mt-3 w-full h-11 rounded-xl border border-border font-semibold text-sm">Cerrar</button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-foreground">Nombre y apellido</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-xl bg-surface-base border border-border focus:outline-none focus:border-brand" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-foreground">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-xl bg-surface-base border border-border focus:outline-none focus:border-brand" placeholder="persona@empresa.com" />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-foreground">Rol</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {puedeZonal && <RolButton activo={rol === 'gerente_zonal'} label="Gerente zonal" onClick={() => cambiarRol('gerente_zonal')} />}
                  <RolButton activo={rol === 'gerente_sucursal'} label="Gerente sucursal" onClick={() => cambiarRol('gerente_sucursal')} />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-foreground">Zona</label>
                <select value={zonaId} onChange={(e) => { setZonaId(e.target.value); setSucursalId('') }} className="mt-1.5 w-full h-11 px-3 rounded-xl bg-surface-base border border-border">
                  <option value="">Seleccionar zona</option>
                  {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
                </select>
              </div>

              {rol === 'gerente_sucursal' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-foreground">Sucursal</label>
                  <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} disabled={!zonaId} className="mt-1.5 w-full h-11 px-3 rounded-xl bg-surface-base border border-border disabled:opacity-50">
                    <option value="">Seleccionar sucursal</option>
                    {sucursalesFiltradas.map((s) => <option key={s.id} value={s.id}>{s.codigo} · {s.nombre}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-foreground">Cómo entregar la invitación</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <CanalButton activo={canal === 'link'} Icono={Link2} label="Link / WhatsApp" onClick={() => setCanal('link')} />
                  <CanalButton activo={canal === 'email'} Icono={Mail} label="Email" onClick={() => setCanal('email')} />
                </div>
              </div>

              {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

              <button type="button" onClick={() => void guardar()} disabled={guardando} className="w-full h-12 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                Crear invitación
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function RolButton({ activo, label, onClick }: { activo: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`h-11 rounded-xl border text-sm font-semibold ${activo ? 'bg-brand-light border-brand text-brand' : 'border-border text-muted-foreground'}`}>{label}</button>
}

function CanalButton({ activo, Icono, label, onClick }: { activo: boolean; Icono: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`h-12 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold ${activo ? 'bg-brand-light border-brand text-brand' : 'border-border text-muted-foreground'}`}><Icono className="h-4 w-4" />{label}</button>
}
