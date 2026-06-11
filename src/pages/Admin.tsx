import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  Plus,
  Pencil,
  ChevronDown,
  ChevronRight,
  X,
  Loader2,
  CheckSquare,
  Square,
  UserCheck,
  UserX,
  Shield,
  User,
  Briefcase,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}
import type {
  UsuarioConEmail,
  Sector,
  Familia,
  RolUsuario,
} from '@/types/index'

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROL_LABELS: Record<RolUsuario, string> = {
  admin: 'Admin',
  operador: 'Operador',
  supervisor: 'Supervisor',
}

const ROL_COLORES: Record<RolUsuario, string> = {
  admin: 'bg-brand-light text-brand border border-brand-muted',
  operador: 'bg-blue-50 text-blue-700 border border-blue-200',
  supervisor: 'bg-purple-50 text-purple-700 border border-purple-200',
}

const ROL_ICONOS: Record<RolUsuario, React.ComponentType<{ className?: string }>> = {
  admin: Shield,
  operador: User,
  supervisor: Briefcase,
}

function toastError(msg: string) {
  // Simple toast via alert fallback — en producción usar una lib de toast
  console.error(msg)
}

// ── Tipos internos del modal ──────────────────────────────────────────────────

interface FormData {
  nombre: string
  email: string
  password: string
  rol: RolUsuario
  familiasSeleccionadas: Set<string>
  activo: boolean
}

interface SectorConFamilias {
  sector: Sector
  familias: Familia[]
}

// ── Componente Modal ──────────────────────────────────────────────────────────

interface ModalProps {
  modo: 'crear' | 'editar'
  usuarioId?: string
  initialData?: {
    nombre: string
    email: string
    rol: RolUsuario
    familiasIds: string[]
    activo: boolean
  }
  sectoresConFamilias: SectorConFamilias[]
  onClose: () => void
  onGuardado: () => void
}

function ModalUsuario({
  modo,
  usuarioId,
  initialData,
  sectoresConFamilias,
  onClose,
  onGuardado,
}: ModalProps) {
  const [form, setForm] = useState<FormData>({
    nombre: initialData?.nombre ?? '',
    email: initialData?.email ?? '',
    password: '',
    rol: initialData?.rol ?? 'operador',
    familiasSeleccionadas: new Set(initialData?.familiasIds ?? []),
    activo: initialData?.activo ?? true,
  })
  const [sectoresExpandidos, setSectoresExpandidos] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState<Partial<Record<keyof FormData | 'global', string>>>({})

  function toggleSector(sectorId: string) {
    setSectoresExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(sectorId)) {
        next.delete(sectorId)
      } else {
        next.add(sectorId)
      }
      return next
    })
  }

  function toggleFamilia(familiaId: string) {
    setForm((prev) => {
      const next = new Set(prev.familiasSeleccionadas)
      if (next.has(familiaId)) {
        next.delete(familiaId)
      } else {
        next.add(familiaId)
      }
      return { ...prev, familiasSeleccionadas: next }
    })
  }

  function marcarTodasSector(sectorId: string) {
    const grupo = sectoresConFamilias.find((g) => g.sector.id === sectorId)
    if (!grupo) return
    const ids = grupo.familias.map((f) => f.id)
    setForm((prev) => {
      const next = new Set(prev.familiasSeleccionadas)
      const todasMarcadas = ids.every((id) => next.has(id))
      if (todasMarcadas) {
        ids.forEach((id) => next.delete(id))
      } else {
        ids.forEach((id) => next.add(id))
      }
      return { ...prev, familiasSeleccionadas: next }
    })
  }

  function validar(): boolean {
    const errs: Partial<Record<keyof FormData | 'global', string>> = {}
    if (!form.nombre.trim()) errs.nombre = 'El nombre es obligatorio'
    if (!form.email.trim()) errs.email = 'El email es obligatorio'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'El email no es válido'
    if (modo === 'crear' && !form.password) errs.password = 'La contraseña es obligatoria'
    if (modo === 'crear' && form.password && form.password.length < 6)
      errs.password = 'La contraseña debe tener al menos 6 caracteres'
    setErrores(errs)
    return Object.keys(errs).length === 0
  }

  async function guardar() {
    if (!validar()) return
    setGuardando(true)
    setErrores({})

    try {
      let uid = usuarioId

      if (modo === 'crear') {
        // 1. Crear usuario en auth via Netlify Function
        const fnUrl = '/.netlify/functions/crear-usuario'
        const accessToken = await getAccessToken()
        const res = await fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            nombre: form.nombre.trim(),
            email: form.email.trim(),
            password: form.password,
            rol: form.rol,
          }),
        })
        const json = await res.json() as { id?: string; email?: string; error?: string }
        if (!res.ok || !json.id) {
          setErrores({ global: json.error ?? 'Error al crear el usuario en autenticación' })
          setGuardando(false)
          return
        }
        uid = json.id

        // 2. INSERT en public.usuarios
        const { error: errInsert } = await supabase.from('usuarios').insert({
          id: uid,
          nombre: form.nombre.trim(),
          rol: form.rol,
          activo: true,
        })
        if (errInsert) {
          setErrores({ global: `Error al guardar el perfil: ${errInsert.message}` })
          setGuardando(false)
          return
        }
      } else {
        // Editar: UPDATE public.usuarios
        const { error: errUpdate } = await supabase
          .from('usuarios')
          .update({ nombre: form.nombre.trim(), rol: form.rol, activo: form.activo })
          .eq('id', uid)
        if (errUpdate) {
          setErrores({ global: `Error al actualizar el perfil: ${errUpdate.message}` })
          setGuardando(false)
          return
        }
      }

      // 3. Sincronizar familias
      const { error: errDel } = await supabase
        .from('usuario_familias')
        .delete()
        .eq('usuario_id', uid)
      if (errDel) {
        setErrores({ global: `Error al actualizar familias: ${errDel.message}` })
        setGuardando(false)
        return
      }

      if (form.familiasSeleccionadas.size > 0) {
        const rows = Array.from(form.familiasSeleccionadas).map((fId) => ({
          usuario_id: uid,
          familia_id: fId,
        }))
        const { error: errIns } = await supabase.from('usuario_familias').insert(rows)
        if (errIns) {
          setErrores({ global: `Error al asignar familias: ${errIns.message}` })
          setGuardando(false)
          return
        }
      }

      onGuardado()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error inesperado'
      setErrores({ global: msg })
      toastError(msg)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={modo === 'crear' ? 'Crear nuevo usuario' : 'Editar usuario'}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full md:max-w-lg bg-white rounded-t-[28px] md:rounded-[24px] shadow-modal flex flex-col max-h-[90vh] animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">
              {modo === 'crear' ? 'Nuevo usuario' : 'Editar usuario'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {modo === 'crear' ? 'Completá los datos para crear la cuenta' : 'Modificá los datos del usuario'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cuerpo scrollable */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Error global */}
          {errores.global && (
            <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <X className="h-4 w-4 shrink-0 mt-0.5" />
              {errores.global}
            </div>
          )}

          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground" htmlFor="campo-nombre">
              Nombre completo
            </label>
            <input
              id="campo-nombre"
              type="text"
              placeholder="Ej: María González"
              value={form.nombre}
              onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
              className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-brand/40 transition-shadow ${
                errores.nombre ? 'border-red-400' : 'border-border'
              }`}
            />
            {errores.nombre && <p className="text-xs text-red-600">{errores.nombre}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground" htmlFor="campo-email">
              Email
            </label>
            <input
              id="campo-email"
              type="email"
              placeholder="usuario@ejemplo.com"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              readOnly={modo === 'editar'}
              className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-brand/40 transition-shadow ${
                errores.email ? 'border-red-400' : 'border-border'
              } ${modo === 'editar' ? 'opacity-60 cursor-not-allowed bg-muted' : ''}`}
            />
            {errores.email && <p className="text-xs text-red-600">{errores.email}</p>}
          </div>

          {/* Password — solo en creación */}
          {modo === 'crear' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="campo-password">
                Contraseña
              </label>
              <input
                id="campo-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-brand/40 transition-shadow ${
                  errores.password ? 'border-red-400' : 'border-border'
                }`}
              />
              {errores.password && <p className="text-xs text-red-600">{errores.password}</p>}
            </div>
          )}

          {/* Rol */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground" htmlFor="campo-rol">
              Rol
            </label>
            <select
              id="campo-rol"
              value={form.rol}
              onChange={(e) => setForm((p) => ({ ...p, rol: e.target.value as RolUsuario }))}
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 transition-shadow appearance-none"
            >
              <option value="operador">Operador</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Activo toggle — solo en edición */}
          {modo === 'editar' && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground">Estado</p>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, activo: !p.activo }))}
                className="flex items-center gap-3 w-full py-2.5 px-3.5 rounded-xl border border-border hover:bg-muted/40 transition-colors"
              >
                <div className={`relative h-5 w-9 rounded-full transition-colors ${form.activo ? 'bg-brand' : 'bg-muted-foreground/30'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.activo ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className={`text-sm font-medium ${form.activo ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                  {form.activo ? 'Activo' : 'Inactivo'}
                </span>
              </button>
            </div>
          )}

          {/* Familias */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Familias asignadas</p>
              <span className="text-xs text-muted-foreground">
                {form.familiasSeleccionadas.size} seleccionadas
              </span>
            </div>

            {sectoresConFamilias.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">
                No hay sectores/familias cargados.
              </p>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/60">
                {sectoresConFamilias.map(({ sector, familias }) => {
                  const expandido = sectoresExpandidos.has(sector.id)
                  const seleccionadasEnSector = familias.filter((f) =>
                    form.familiasSeleccionadas.has(f.id),
                  ).length
                  const todasEnSector = seleccionadasEnSector === familias.length

                  return (
                    <div key={sector.id}>
                      {/* Header sector */}
                      <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors">
                        <button
                          type="button"
                          className="flex items-center gap-2 flex-1 text-left"
                          onClick={() => toggleSector(sector.id)}
                        >
                          {expandido ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-foreground">
                            {sector.codigo} — {sector.nombre}
                          </span>
                          {seleccionadasEnSector > 0 && (
                            <span className="ml-auto mr-2 text-[10px] font-semibold text-brand bg-brand-light px-1.5 py-0.5 rounded-full">
                              {seleccionadasEnSector}/{familias.length}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => marcarTodasSector(sector.id)}
                          className="text-[10px] text-brand hover:text-brand-hover font-semibold shrink-0 ml-1 px-2 py-1 rounded-lg hover:bg-brand-light transition-colors"
                        >
                          {todasEnSector ? 'Desmarcar' : 'Marcar todas'}
                        </button>
                      </div>

                      {/* Familias del sector */}
                      {expandido && (
                        <div className="divide-y divide-border/40 bg-white">
                          {familias.map((familia) => {
                            const checked = form.familiasSeleccionadas.has(familia.id)
                            return (
                              <button
                                key={familia.id}
                                type="button"
                                onClick={() => toggleFamilia(familia.id)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors text-left"
                              >
                                {checked ? (
                                  <CheckSquare className="h-4 w-4 text-brand shrink-0" />
                                ) : (
                                  <Square className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                                )}
                                <span className="text-xs text-foreground">
                                  <span className="font-mono text-muted-foreground mr-1">{familia.codigo}</span>
                                  {familia.nombre}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border/40 shrink-0 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={guardando}
            className="flex-1 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold shadow-brand transition-all active:scale-[0.97] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {guardando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              modo === 'crear' ? 'Crear usuario' : 'Guardar cambios'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal Admin ───────────────────────────────────────────────────

export default function Admin() {
  const [usuarios, setUsuarios] = useState<UsuarioConEmail[]>([])
  const [sectoresConFamilias, setSectoresConFamilias] = useState<SectorConFamilias[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioConEmail | null>(null)

  // Cargar sectores y familias
  const cargarSectoresYFamilias = useCallback(async () => {
    const [{ data: sectores, error: errS }, { data: familias, error: errF }] = await Promise.all([
      supabase.from('sectores').select('id, nombre, codigo').order('codigo'),
      supabase.from('familias').select('id, nombre, codigo, sector_id').order('codigo'),
    ])

    if (errS || errF) return

    const grupos: SectorConFamilias[] = (sectores ?? []).map((s: Sector) => ({
      sector: s,
      familias: (familias ?? []).filter((f: Familia) => f.sector_id === s.id),
    }))
    setSectoresConFamilias(grupos)
  }, [])

  // Cargar usuarios — 2 fetches máximo: Netlify Function + 1 query a la vista
  const cargarUsuarios = useCallback(async () => {
    setLoading(true)
    setError(null)

    // Fetch 1: emails desde auth via función admin (paralelo con fetch 2)
    const emailPromise = (async () => {
      const emailMap = new Map<string, string>()
      try {
        const accessToken = await getAccessToken()
        const fnRes = await fetch('/.netlify/functions/listar-usuarios', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        })
        if (fnRes.ok) {
          const fnData = await fnRes.json() as { users?: { id: string; email: string }[] }
          for (const u of fnData.users ?? []) emailMap.set(u.id, u.email)
        }
      } catch { /* silencioso — email quedará vacío si falla */ }
      return emailMap
    })()

    // Fetch 2: una sola query a la vista que ya trae usuario + familias + sectores
    interface ViewRow {
      id: string
      nombre: string
      rol: RolUsuario
      sucursal_id: string | null
      activo: boolean
      familias: { id: string; nombre: string; codigo: string; sector_id: string; sector_nombre: string }[]
    }
    const viewPromise = supabase
      .from('vw_usuarios_completos')
      .select('id, nombre, rol, sucursal_id, activo, familias')
      .order('nombre')

    const [emailMap, { data: viewRows, error: viewError }] = await Promise.all([emailPromise, viewPromise])

    if (viewError) {
      setError('No pudimos cargar la lista de usuarios. Revisá tu conexión e intentá de nuevo.')
      setLoading(false)
      return
    }

    const usuariosConEmail: UsuarioConEmail[] = (viewRows ?? []).map((row: unknown) => {
      const r = row as ViewRow
      return {
        id: r.id,
        nombre: r.nombre,
        rol: r.rol,
        sucursal_id: r.sucursal_id,
        activo: r.activo,
        email: emailMap.get(r.id) ?? '',
        familias: Array.isArray(r.familias) ? r.familias : [],
      }
    })

    setUsuarios(usuariosConEmail)
    setLoading(false)
  }, [])

  useEffect(() => {
    void cargarUsuarios()
    void cargarSectoresYFamilias()
  }, [cargarUsuarios, cargarSectoresYFamilias])

  function abrirCrear() {
    setUsuarioEditando(null)
    setModalAbierto(true)
  }

  function abrirEditar(u: UsuarioConEmail) {
    setUsuarioEditando(u)
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setUsuarioEditando(null)
  }

  function onGuardado() {
    cerrarModal()
    void cargarUsuarios()
  }

  // Toggle activo
  async function toggleActivo(u: UsuarioConEmail) {
    const { error: e } = await supabase
      .from('usuarios')
      .update({ activo: !u.activo })
      .eq('id', u.id)
    if (e) return
    void cargarUsuarios()
  }

  return (
    <div className="min-h-screen bg-surface-base">

      {/* Modal */}
      {modalAbierto && (
        <ModalUsuario
          modo={usuarioEditando ? 'editar' : 'crear'}
          usuarioId={usuarioEditando?.id}
          initialData={
            usuarioEditando
              ? {
                  nombre: usuarioEditando.nombre,
                  email: usuarioEditando.email,
                  rol: usuarioEditando.rol,
                  familiasIds: usuarioEditando.familias.map((f) => f.id),
                  activo: usuarioEditando.activo,
                }
              : undefined
          }
          sectoresConFamilias={sectoresConFamilias}
          onClose={cerrarModal}
          onGuardado={onGuardado}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-border/40 px-4 md:px-8 py-4 md:py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
              <Users className="h-4.5 w-4.5 text-brand" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight leading-none">
                Gestión de Usuarios
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} registrado{usuarios.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={abrirCrear}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-xl shadow-brand transition-all active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nuevo Usuario</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className="px-4 md:px-8 py-5 md:py-6 space-y-4">

        {/* Error */}
        {error && (
          <div role="alert" className="rounded-[20px] bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 animate-fade-in">
            {error}
          </div>
        )}

        {/* Skeleton */}
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[20px] bg-white shadow-card h-24 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && usuarios.length === 0 && (
          <div className="rounded-[24px] bg-white shadow-card px-6 py-12 flex flex-col items-center text-center gap-4">
            <div className="p-4 bg-brand-light rounded-full">
              <Users className="h-10 w-10 text-brand" aria-hidden="true" />
            </div>
            <div>
              <p className="text-foreground font-semibold text-base">Sin usuarios registrados</p>
              <p className="text-muted-foreground text-sm mt-1">
                Creá el primer usuario para comenzar a gestionar el equipo.
              </p>
            </div>
            <button
              type="button"
              onClick={abrirCrear}
              className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold shadow-brand transition-all active:scale-[0.97]"
            >
              Crear primer usuario
            </button>
          </div>
        )}

        {/* Lista de usuarios */}
        {!loading && usuarios.length > 0 && (
          <div className="space-y-3">
            {usuarios.map((u) => {
              const RolIcon = ROL_ICONOS[u.rol]
              return (
                <div
                  key={u.id}
                  className="bg-white rounded-[20px] shadow-card px-4 py-4 flex flex-col gap-3 animate-fade-in"
                >
                  {/* Fila principal */}
                  <div className="flex items-center justify-between gap-3">
                    {/* Avatar + info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-brand flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-brand">
                        {u.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{u.nombre}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.email || `ID: ${u.id.slice(0, 8)}…`}
                        </p>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => abrirEditar(u)}
                        className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground transition-colors"
                        aria-label={`Editar ${u.nombre}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActivo(u)}
                        className={`h-8 w-8 flex items-center justify-center rounded-xl transition-colors ${
                          u.activo
                            ? 'text-emerald-600 hover:bg-emerald-50'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                        aria-label={u.activo ? 'Desactivar usuario' : 'Activar usuario'}
                        title={u.activo ? 'Activo — clic para desactivar' : 'Inactivo — clic para activar'}
                      >
                        {u.activo ? (
                          <UserCheck className="h-3.5 w-3.5" />
                        ) : (
                          <UserX className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Rol badge */}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${ROL_COLORES[u.rol]}`}>
                      <RolIcon className="h-3 w-3" />
                      {ROL_LABELS[u.rol]}
                    </span>

                    {/* Estado */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        u.activo
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-100 text-gray-500 border border-gray-200'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${u.activo ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>

                    {/* Familias chips — primeras 3 */}
                    {u.familias.slice(0, 3).map((f) => (
                      <span
                        key={f.id}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-base text-muted-foreground border border-border/60"
                        title={`${f.sector_nombre} — ${f.nombre}`}
                      >
                        {f.codigo}
                      </span>
                    ))}
                    {u.familias.length > 3 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-base text-muted-foreground border border-border/60">
                        +{u.familias.length - 3} más
                      </span>
                    )}
                    {u.familias.length === 0 && (
                      <span className="text-[11px] text-muted-foreground/60 italic">Sin familias asignadas</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
