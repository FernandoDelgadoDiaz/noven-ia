import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, Copy, Link2, Loader2, Mail, RefreshCcw, RotateCw, UserRoundCheck, X, XCircle } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useSucursalActual } from '@/hooks/useSucursalActual'

type TipoListado = 'jerarquia' | 'local'
type Canal = 'link' | 'email'

interface InvitacionItem {
  id: string
  email: string
  nombre: string
  rol: 'gerente_zonal' | 'gerente_sucursal' | 'supervisor' | 'operador'
  canal: Canal
  estado: 'pendiente' | 'vencida'
  created_at: string
  expires_at: string
  zona_nombre?: string | null
  sucursal_codigo?: string | null
  sucursal_nombre?: string | null
  familias_ids?: string[]
}

interface ApiResult {
  success: boolean
  error?: string
  invitaciones?: InvitacionItem[]
  canal?: Canal
  link?: string | null
}

const ROL_LABEL: Record<InvitacionItem['rol'], string> = {
  gerente_zonal: 'Gerente zonal',
  gerente_sucursal: 'Gerente de sucursal',
  supervisor: 'Supervisor',
  operador: 'Operador',
}

async function tokenActual(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('La sesión expiró. Volvé a iniciar sesión.')
  return token
}

async function request(body: Record<string, unknown>): Promise<ApiResult> {
  const token = await tokenActual()
  const lane = body.accion === 'listar' ? 'read' : 'write'
  const res = await fetch(`/api/admin/${lane}/invitaciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (res.status === 429) {
    throw new Error('Hay demasiadas solicitudes administrativas. Esperá un minuto y volvé a intentar.')
  }
  const data = await res.json().catch(() => ({ success: false, error: 'Respuesta inválida del servidor' })) as ApiResult
  if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo gestionar la invitación.')
  return data
}

function fechaCorta(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin dato'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export default function InvitationManagementDock() {
  const { pathname } = useLocation()
  const { sucursalId, loading: sucursalLoading } = useSucursalActual()
  const tipo: TipoListado | null = pathname === '/admin/accesos' ? 'jerarquia' : pathname === '/admin' ? 'local' : null
  const [abierto, setAbierto] = useState(false)
  const [invitaciones, setInvitaciones] = useState<InvitacionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [accionando, setAccionando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ canal: Canal; link: string | null } | null>(null)
  const [copiado, setCopiado] = useState(false)

  const puedeConsultar = Boolean(tipo && (tipo === 'jerarquia' || (!sucursalLoading && sucursalId)))

  const cargar = useCallback(async () => {
    if (!tipo || !puedeConsultar) {
      setInvitaciones([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await request({
        accion: 'listar',
        tipo,
        sucursalId: tipo === 'local' ? sucursalId : null,
      })
      setInvitaciones(data.invitaciones ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [puedeConsultar, sucursalId, tipo])

  useEffect(() => {
    if (!tipo) return
    void cargar()
  }, [cargar, tipo])

  const vencidas = useMemo(() => invitaciones.filter((i) => i.estado === 'vencida').length, [invitaciones])

  if (!tipo) return null

  async function anular(inv: InvitacionItem) {
    const ok = window.confirm(`¿Anular la invitación de ${inv.nombre}? El enlace actual dejará de servir.`)
    if (!ok) return
    setAccionando(inv.id)
    setError(null)
    try {
      await request({ accion: 'anular', invitacionId: inv.id })
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAccionando(null)
    }
  }

  async function regenerar(inv: InvitacionItem) {
    setAccionando(inv.id)
    setError(null)
    setResultado(null)
    try {
      const data = await request({ accion: 'regenerar', invitacionId: inv.id })
      setResultado({ canal: data.canal ?? inv.canal, link: data.link ?? null })
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAccionando(null)
    }
  }

  async function copiarLink() {
    if (!resultado?.link) return
    try {
      await navigator.clipboard.writeText(resultado.link)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 1600)
    } catch {
      setError('No se pudo copiar automáticamente. Mantené presionado el enlace para copiarlo.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setAbierto(true); void cargar() }}
        className="fixed z-40 right-4 md:right-6 bottom-[calc(76px+env(safe-area-inset-bottom,0px))] md:bottom-6 h-11 px-4 rounded-full bg-white border border-border shadow-elevated flex items-center gap-2 text-sm font-semibold text-foreground"
        aria-label="Gestionar invitaciones pendientes"
      >
        <Clock3 className="h-4 w-4 text-brand" />
        Invitaciones
        <span className="min-w-6 h-6 px-1.5 rounded-full bg-brand-light text-brand text-xs font-bold flex items-center justify-center">{invitaciones.length}</span>
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4" role="dialog" aria-modal="true" aria-label="Invitaciones pendientes">
          <div className="absolute inset-0 bg-black/45" onClick={() => setAbierto(false)} />
          <section className="relative z-10 w-full md:max-w-xl max-h-[88vh] bg-white rounded-t-[28px] md:rounded-[24px] shadow-modal overflow-hidden flex flex-col">
            <header className="px-5 py-4 border-b border-border flex items-start gap-3 shrink-0">
              <div className="h-10 w-10 rounded-xl bg-brand-light flex items-center justify-center shrink-0"><UserRoundCheck className="h-5 w-5 text-brand" /></div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-lg text-foreground">Invitaciones pendientes</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tipo === 'local' ? 'Supervisor y Operador de esta sucursal.' : 'Gerentes dentro de tu jerarquía.'}
                </p>
              </div>
              <button type="button" onClick={() => setAbierto(false)} className="h-9 w-9 rounded-lg hover:bg-muted flex items-center justify-center"><X className="h-5 w-5" /></button>
            </header>

            <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3">
              {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

              {resultado && (
                resultado.canal === 'link' && resultado.link ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                    <p className="text-sm font-semibold text-emerald-800">Nuevo enlace generado</p>
                    <p className="text-xs text-emerald-700 break-all select-all">{resultado.link}</p>
                    <button type="button" onClick={() => void copiarLink()} className="h-9 px-3 rounded-lg bg-emerald-700 text-white text-xs font-semibold flex items-center gap-2">
                      <Copy className="h-3.5 w-3.5" />{copiado ? 'Copiado' : 'Copiar enlace'}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex gap-2 text-sm text-emerald-800"><Mail className="h-4 w-4 shrink-0 mt-0.5" />Nueva invitación enviada por email.</div>
                )
              )}

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">{vencidas > 0 ? `${vencidas} vencida${vencidas !== 1 ? 's' : ''} · regenerá para emitir un nuevo acceso.` : 'Cada invitación tiene una vigencia máxima de 72 horas.'}</p>
                <button type="button" onClick={() => void cargar()} disabled={loading} className="h-8 px-2.5 rounded-lg border border-border text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"><RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Actualizar</button>
              </div>

              {loading && invitaciones.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-2 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin text-brand" /><p className="text-sm">Cargando invitaciones...</p></div>
              ) : invitaciones.length === 0 ? (
                <div className="py-12 text-center"><Clock3 className="h-9 w-9 mx-auto text-muted-foreground/40" /><p className="mt-3 text-sm font-semibold text-foreground">No hay invitaciones pendientes</p><p className="mt-1 text-xs text-muted-foreground">Las nuevas invitaciones aparecerán acá hasta ser aceptadas o anuladas.</p></div>
              ) : (
                <div className="space-y-3">
                  {invitaciones.map((inv) => {
                    const scope = inv.zona_nombre
                      ? inv.zona_nombre
                      : inv.sucursal_codigo
                        ? `Sucursal ${inv.sucursal_codigo}`
                        : 'Alcance asignado'
                    const busy = accionando === inv.id
                    return (
                      <article key={inv.id} className="rounded-2xl border border-border p-4">
                        <div className="flex items-start gap-3">
                          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${inv.estado === 'vencida' ? 'bg-amber-50' : 'bg-brand-light'}`}>
                            {inv.canal === 'link' ? <Link2 className={`h-4 w-4 ${inv.estado === 'vencida' ? 'text-amber-600' : 'text-brand'}`} /> : <Mail className={`h-4 w-4 ${inv.estado === 'vencida' ? 'text-amber-600' : 'text-brand'}`} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-foreground">{inv.nombre}</p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inv.estado === 'vencida' ? 'bg-amber-50 text-amber-700' : 'bg-brand-light text-brand'}`}>{inv.estado === 'vencida' ? 'VENCIDA' : 'PENDIENTE'}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">{inv.email}</p>
                            <p className="text-xs text-muted-foreground mt-1">{ROL_LABEL[inv.rol]} · {scope}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">Vence: {fechaCorta(inv.expires_at)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <button type="button" disabled={busy} onClick={() => void regenerar(inv)} className="h-10 rounded-xl border border-brand/30 text-brand text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}Regenerar
                          </button>
                          <button type="button" disabled={busy} onClick={() => void anular(inv)} className="h-10 rounded-xl border border-red-200 text-red-600 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                            <XCircle className="h-4 w-4" />Anular
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
