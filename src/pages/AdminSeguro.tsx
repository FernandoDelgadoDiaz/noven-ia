import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Shield,
  Square,
  CheckSquare,
  User,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSucursalActual } from '@/hooks/useSucursalActual'

type RolUi = 'admin' | 'supervisor' | 'operador'

interface SucursalAdmin {
  id: string
  codigo: string
  nombre: string
  organizacion_id: string
}

interface SectorAdmin {
  id: string
  codigo: string
  nombre: string
}

interface FamiliaAdmin {
  id: string
  codigo: string
  nombre: string
  sector_id: string
}

interface UsuarioAdmin {
  id: string
  nombre: string
  email: string
  activo: boolean
  rol: RolUi
  rol_scope: string
  familias_ids: string[]
}

interface AdminPayload {
  success: boolean
  error?: string
  sucursal?: SucursalAdmin
  sectores?: SectorAdmin[]
  familias?: FamiliaAdmin[]
  usuarios?: UsuarioAdmin[]
}

interface FormState {
  nombre: string
  email: string
  password: string
  rol: RolUi
  activo: boolean
  familias: Set<string>
}

const ROL_LABEL: Record<RolUi, string> = {
  admin: 'Admin de sucursal',
  supervisor: 'Supervisor',
  operador: 'Operador',
}

const ROL_ICONO: Record<RolUi, React.ComponentType<{ className?: string }>> = {
  admin: Shield,
  supervisor: Briefcase,
  operador: User,
}

const ROL_BADGE: Record<RolUi, string> = {
  admin: 'bg-brand-light text-brand border-brand/20',
  supervisor: 'bg-purple-50 text-purple-700 border-purple-200',
  operador: 'bg-blue-50 text-blue-700 border-blue-200',
}

async function tokenActual(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('La sesión expiró. Volvé a iniciar sesión.')
  return token
}

async function adminRequest(body: Record<string, unknown>): Promise<AdminPayload> {
  const token = await tokenActual()
  const res = await fetch('/.netlify/functions/admin-sucursal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({ success: false, error: 'Respuesta inválida del servidor' })) as AdminPayload
  if (!res.ok || !json.success) throw new Error(json.error || 'No se pudo completar la operación.')
  return json
}

export default function AdminSeguro() {
  const { sucursalId, loading: sucursalLoading, requiereSeleccionSucursal } = useSucursalActual()
  const [payload, setPayload] = useState<AdminPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<{ modo: 'crear' } | { modo: 'editar'; usuario: UsuarioAdmin } | null>(null)

  const cargar = useCallback(async (): Promise<void> => {
    if (!sucursalId) {
      setPayload(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await adminRequest({ accion: 'listar', sucursalId })
      setPayload(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [sucursalId])

  useEffect(() => {
    if (sucursalLoading) return
    void cargar()
  }, [cargar, sucursalLoading])

  const usuarios = payload?.usuarios ?? []
  const activos = usuarios.filter((u) => u.activo).length
  const operadores = usuarios.filter((u) => u.rol === 'operador' && u.activo).length

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-10 bg-white border-b border-border/40 px-4 md:px-8 py-4 md:py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Administración</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {payload?.sucursal ? `Sucursal ${payload.sucursal.codigo} · ${payload.sucursal.nombre}` : 'Usuarios y responsabilidades operativas'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModal({ modo: 'crear' })}
            disabled={!sucursalId || loading}
            className="h-10 px-4 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-xl shadow-brand flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />Nuevo usuario
          </button>
        </div>
      </header>

      <main className="px-4 md:px-8 py-5 md:py-6 max-w-5xl space-y-4 pb-28">
        {sucursalLoading || loading ? (
          <div className="bg-white rounded-card shadow-card p-6 flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-brand animate-spin" />
            <p className="text-sm text-muted-foreground">Cargando administración de la sucursal...</p>
          </div>
        ) : requiereSeleccionSucursal ? (
          <div className="bg-amber-50 border border-amber-200 rounded-card p-4 text-sm text-amber-800">
            Seleccioná una sucursal antes de administrar usuarios.
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-card p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">No se pudo cargar Admin</p>
              <p className="text-xs text-red-700 mt-1">{error}</p>
              <button type="button" onClick={() => void cargar()} className="mt-2 text-xs font-semibold text-red-700 underline">Reintentar</button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Resumen titulo="Usuarios" valor={usuarios.length} Icono={Users} />
              <Resumen titulo="Activos" valor={activos} Icono={UserCheck} />
              <Resumen titulo="Operadores" valor={operadores} Icono={User} />
            </div>

            <div className="bg-brand-light border border-brand/20 rounded-card p-4">
              <p className="text-sm font-semibold text-foreground">Administración aislada por sucursal</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Esta pantalla modifica solamente el acceso y las familias de la sucursal seleccionada. Si una persona tiene acceso a otra sucursal o zona, ese alcance no se toca.
              </p>
            </div>

            <div className="bg-white rounded-card shadow-card overflow-hidden">
              <div className="px-4 py-3.5 border-b border-border">
                <h2 className="text-sm font-bold text-foreground">Usuarios de esta sucursal</h2>
              </div>
              {usuarios.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <Users className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm font-semibold text-foreground mt-3">Todavía no hay usuarios</p>
                  <p className="text-xs text-muted-foreground mt-1">Creá el primero con el botón superior.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {usuarios.map((u) => <UsuarioRow key={u.id} usuario={u} familias={payload?.familias ?? []} onEditar={() => setModal({ modo: 'editar', usuario: u })} />)}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {modal && sucursalId && payload && (
        <ModalUsuario
          modo={modal.modo}
          usuario={modal.modo === 'editar' ? modal.usuario : undefined}
          sucursalId={sucursalId}
          sectores={payload.sectores ?? []}
          familias={payload.familias ?? []}
          usuarios={usuarios}
          onClose={() => setModal(null)}
          onGuardado={() => {
            setModal(null)
            void cargar()
          }}
        />
      )}
    </div>
  )
}

function UsuarioRow({
  usuario,
  familias,
  onEditar,
}: {
  usuario: UsuarioAdmin
  familias: FamiliaAdmin[]
  onEditar: () => void
}) {
  const Icono = ROL_ICONO[usuario.rol]
  const nombres = usuario.familias_ids
    .map((id) => familias.find((f) => f.id === id))
    .filter((f): f is FamiliaAdmin => Boolean(f))
    .map((f) => f.nombre)

  return (
    <div className="p-4 flex items-start gap-3">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${usuario.activo ? 'bg-brand-light' : 'bg-muted'}`}>
        {usuario.activo ? <Icono className="h-5 w-5 text-brand" /> : <UserX className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-sm text-foreground">{usuario.nombre}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROL_BADGE[usuario.rol]}`}>{ROL_LABEL[usuario.rol]}</span>
          {!usuario.activo && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">INACTIVO</span>}
        </div>
        <p className="text-xs text-muted-foreground mt-1 truncate">{usuario.email || 'Sin email visible'}</p>
        {usuario.rol === 'operador' && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {nombres.length > 0 ? nombres.join(' · ') : 'Sin familias asignadas'}
          </p>
        )}
      </div>
      <button type="button" onClick={onEditar} className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted" aria-label={`Editar ${usuario.nombre}`}>
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  )
}

function ModalUsuario({
  modo,
  usuario,
  sucursalId,
  sectores,
  familias,
  usuarios,
  onClose,
  onGuardado,
}: {
  modo: 'crear' | 'editar'
  usuario?: UsuarioAdmin
  sucursalId: string
  sectores: SectorAdmin[]
  familias: FamiliaAdmin[]
  usuarios: UsuarioAdmin[]
  onClose: () => void
  onGuardado: () => void
}) {
  const [form, setForm] = useState<FormState>({
    nombre: usuario?.nombre ?? '',
    email: usuario?.email ?? '',
    password: '',
    rol: usuario?.rol ?? 'operador',
    activo: usuario?.activo ?? true,
    familias: new Set(usuario?.familias_ids ?? []),
  })
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ocupacion = useMemo(() => {
    const map = new Map<string, UsuarioAdmin>()
    for (const u of usuarios) {
      if (!u.activo || u.rol !== 'operador' || u.id === usuario?.id) continue
      for (const familiaId of u.familias_ids) map.set(familiaId, u)
    }
    return map
  }, [usuarios, usuario?.id])

  const porSector = useMemo(() => sectores.map((sector) => ({
    sector,
    familias: familias.filter((f) => f.sector_id === sector.id),
  })), [sectores, familias])

  function toggleFamilia(id: string): void {
    if (form.rol === 'operador' && ocupacion.has(id)) return
    setForm((prev) => {
      const next = new Set(prev.familias)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...prev, familias: next }
    })
  }

  function toggleSector(id: string): void {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodas(grupo: FamiliaAdmin[]): void {
    const disponibles = grupo.filter((f) => !ocupacion.has(f.id)).map((f) => f.id)
    setForm((prev) => {
      const next = new Set(prev.familias)
      const todas = disponibles.length > 0 && disponibles.every((id) => next.has(id))
      for (const id of disponibles) {
        if (todas) next.delete(id)
        else next.add(id)
      }
      return { ...prev, familias: next }
    })
  }

  async function guardar(): Promise<void> {
    setError(null)
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    if (modo === 'crear') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        setError('El email no es válido.')
        return
      }
      if (form.password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.')
        return
      }
    }

    if (form.rol === 'operador') {
      const conflictos = Array.from(form.familias).filter((id) => ocupacion.has(id))
      if (conflictos.length > 0) {
        setError('Una o más familias seleccionadas ya tienen otro operador responsable en esta sucursal.')
        return
      }
    }

    setGuardando(true)
    try {
      await adminRequest({
        accion: modo,
        sucursalId,
        ...(modo === 'editar' ? { usuarioId: usuario?.id } : { email: form.email.trim(), password: form.password }),
        nombre: form.nombre.trim(),
        rol: form.rol,
        activo: form.activo,
        familias: form.rol === 'operador' && form.activo ? Array.from(form.familias) : [],
      })
      onGuardado()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" role="dialog" aria-modal="true" aria-label={modo === 'crear' ? 'Crear usuario' : 'Editar usuario'}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={guardando ? undefined : onClose} />
      <div className="relative z-10 w-full md:max-w-lg bg-white rounded-t-[28px] md:rounded-[24px] shadow-modal max-h-[92vh] flex flex-col overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
          <div><h2 className="font-bold text-base text-foreground">{modo === 'crear' ? 'Nuevo usuario' : 'Editar usuario'}</h2><p className="text-xs text-muted-foreground mt-0.5">{modo === 'crear' ? 'La cuenta y su alcance de sucursal se guardan coordinadamente.' : 'Los cambios afectan sólo esta sucursal.'}</p></div>
          <button type="button" onClick={onClose} disabled={guardando} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-40"><X className="h-4 w-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}</div>}

          <Campo label="Nombre"><input value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} className={inputCls} /></Campo>
          <Campo label="Email">
            <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} disabled={modo === 'editar'} className={`${inputCls} disabled:bg-muted disabled:text-muted-foreground`} />
            {modo === 'editar' && <p className="text-[11px] text-muted-foreground mt-1">El email no se modifica desde este flujo para evitar cambios parciales entre Auth y base.</p>}
          </Campo>
          {modo === 'crear' && <Campo label="Contraseña inicial"><input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className={inputCls} /></Campo>}

          <Campo label="Rol en esta sucursal">
            <select value={form.rol} onChange={(e) => setForm((p) => ({ ...p, rol: e.target.value as RolUi, familias: e.target.value === 'operador' ? p.familias : new Set() }))} className={inputCls}>
              <option value="admin">Admin de sucursal</option>
              <option value="supervisor">Supervisor</option>
              <option value="operador">Operador</option>
            </select>
          </Campo>

          <label className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3 cursor-pointer">
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm((p) => ({ ...p, activo: e.target.checked }))} className="h-4 w-4 accent-[color:var(--brand,#0d9488)]" />
            <div><p className="text-sm font-semibold text-foreground">Usuario activo en esta sucursal</p><p className="text-xs text-muted-foreground">Al desactivarlo se desactivan también sus familias locales.</p></div>
          </label>

          {form.rol === 'operador' && form.activo && (
            <div className="space-y-2">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-foreground">Familias responsables</p><p className="text-[11px] text-muted-foreground mt-1">Una familia puede tener un solo operador activo por sucursal.</p></div>
              <div className="border border-border rounded-xl overflow-hidden">
                {porSector.map(({ sector, familias: grupo }) => {
                  const abierto = expandidos.has(sector.id)
                  const disponibles = grupo.filter((f) => !ocupacion.has(f.id))
                  const marcadas = disponibles.filter((f) => form.familias.has(f.id)).length
                  return (
                    <div key={sector.id} className="border-b border-border last:border-0">
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30">
                        <button type="button" onClick={() => toggleSector(sector.id)} className="flex-1 flex items-center gap-2 text-left">
                          {abierto ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <span className="text-sm font-semibold text-foreground">{sector.nombre}</span>
                          <span className="text-[10px] text-muted-foreground">{marcadas}/{disponibles.length}</span>
                        </button>
                        {disponibles.length > 0 && <button type="button" onClick={() => toggleTodas(grupo)} className="text-[10px] font-semibold text-brand">Marcar libres</button>}
                      </div>
                      {abierto && (
                        <div className="divide-y divide-border/50">
                          {grupo.map((f) => {
                            const ocupada = ocupacion.get(f.id)
                            const marcada = form.familias.has(f.id)
                            return (
                              <button key={f.id} type="button" onClick={() => toggleFamilia(f.id)} disabled={Boolean(ocupada)} className="w-full px-4 py-2.5 flex items-start gap-3 text-left disabled:opacity-50">
                                {marcada ? <CheckSquare className="h-4 w-4 text-brand shrink-0 mt-0.5" /> : <Square className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                                <div className="min-w-0"><p className="text-sm text-foreground"><span className="font-mono text-xs text-muted-foreground mr-2">{f.codigo}</span>{f.nombre}</p>{ocupada && <p className="text-[10px] text-amber-700 mt-0.5">Responsable: {ocupada.nombre}</p>}</div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border/40 flex gap-3 shrink-0">
          <button type="button" onClick={onClose} disabled={guardando} className="flex-1 h-11 rounded-xl border border-border text-sm font-medium disabled:opacity-40">Cancelar</button>
          <button type="button" onClick={() => void guardar()} disabled={guardando} className="flex-1 h-11 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {guardando ? <><Loader2 className="h-4 w-4 animate-spin" />Guardando…</> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-xs font-semibold text-foreground">{label}</label>{children}</div>
}

const inputCls = 'w-full h-11 px-3 bg-surface-base border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all'

function Resumen({ titulo, valor, Icono }: { titulo: string; valor: number; Icono: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="bg-white rounded-card shadow-card p-4">
      <div className="h-9 w-9 rounded-xl bg-brand-light flex items-center justify-center"><Icono className="h-4 w-4 text-brand" /></div>
      <p className="text-2xl font-black text-foreground mt-3 tabular-nums">{valor}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mt-1">{titulo}</p>
    </div>
  )
}
