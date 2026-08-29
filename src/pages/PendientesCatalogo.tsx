import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle, Eye, Loader2, RefreshCw, Tags, TriangleAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import ProductIdentity from '@/components/product/ProductIdentity'
import { usePuedeGestionarCatalogo } from '@/hooks/usePuedeGestionarCatalogo'

interface SucursalPendiente {
  id: string
  codigo: string
  nombre: string
}

interface ProductoPendiente {
  id: string
  organizacion_id: string
  cod_art: string
  descripcion: string
  marca: string | null
  gramaje: string | null
  producto_id: string | null
  first_detected_at: string
  last_detected_at: string
  detecciones: number
  sucursales: SucursalPendiente[]
}

interface FamiliaInfo {
  id: string
  organizacion_id: string
  codigo: string
  nombre: string
}

interface ListResponse {
  success: boolean
  error?: string
  pendientes?: ProductoPendiente[]
}

interface ResolveResponse {
  success: boolean
  error?: string
  resultado?: {
    ya_resuelto?: boolean
    producto_id?: string
    familia_id?: string
    sucursales_afectadas?: number
  }
}

async function tokenActual(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('La sesión expiró. Volvé a iniciar sesión.')
  return token
}

export default function PendientesCatalogo() {
  const navigate = useNavigate()
  const { puedeGestionar, sucursalesGestionables } = usePuedeGestionarCatalogo()
  const [pendientes, setPendientes] = useState<ProductoPendiente[]>([])
  const [familias, setFamilias] = useState<FamiliaInfo[]>([])
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [familiaPorPendiente, setFamiliaPorPendiente] = useState<Record<string, string>>({})
  const [familiaMasiva, setFamiliaMasiva] = useState('')
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const puedeGestionarPendiente = useCallback(
    (pendiente: ProductoPendiente): boolean => pendiente.sucursales.some((s) => sucursalesGestionables.has(s.id)),
    [sucursalesGestionables],
  )

  const cargar = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    setMensaje(null)
    try {
      const token = await tokenActual()
      const response = await fetch('/.netlify/functions/listar-pendientes-catalogo', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await response.json() as ListResponse
      if (!response.ok || !body.success) throw new Error(body.error || 'No se pudieron cargar los pendientes.')

      const lista = body.pendientes ?? []
      setPendientes(lista)
      setSeleccionados(new Set())
      setFamiliaPorPendiente({})
      setFamiliaMasiva('')

      // Un usuario de sólo lectura no necesita abrir superficie adicional de catálogo.
      const orgs = Array.from(new Set(
        lista.filter(puedeGestionarPendiente).map((p) => p.organizacion_id),
      ))
      if (orgs.length === 0) {
        setFamilias([])
        return
      }

      const { data: famData, error: famError } = await supabase
        .from('familias')
        .select('id, organizacion_id, codigo, nombre')
        .in('organizacion_id', orgs)
        .order('nombre')
      if (famError) throw new Error(`No se pudieron cargar las familias: ${famError.message}`)
      setFamilias((famData ?? []) as FamiliaInfo[])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [puedeGestionarPendiente])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const seleccion = useMemo(
    () => pendientes.filter((p) => seleccionados.has(p.id) && puedeGestionarPendiente(p)),
    [pendientes, puedeGestionarPendiente, seleccionados],
  )

  const haySoloLectura = useMemo(
    () => pendientes.some((p) => !puedeGestionarPendiente(p)),
    [pendientes, puedeGestionarPendiente],
  )

  const orgSeleccionada = useMemo(() => {
    const orgs = new Set(seleccion.map((p) => p.organizacion_id))
    return orgs.size === 1 ? seleccion[0]?.organizacion_id ?? null : null
  }, [seleccion])

  const familiasMasivas = useMemo(
    () => orgSeleccionada ? familias.filter((f) => f.organizacion_id === orgSeleccionada) : [],
    [familias, orgSeleccionada],
  )

  async function resolverUno(pendienteId: string, familiaId: string): Promise<ResolveResponse> {
    const token = await tokenActual()
    const response = await fetch('/.netlify/functions/resolver-pendiente-catalogo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ pendienteId, familiaId }),
    })
    const body = await response.json() as ResolveResponse
    if (!response.ok || !body.success) throw new Error(body.error || 'No se pudo clasificar el producto.')
    return body
  }

  async function clasificarIndividual(pendiente: ProductoPendiente): Promise<void> {
    if (!puedeGestionarPendiente(pendiente)) {
      setError('Este producto está disponible sólo para seguimiento en tu alcance actual.')
      return
    }
    const familiaId = familiaPorPendiente[pendiente.id]
    if (!familiaId) {
      setError('Elegí una familia antes de clasificar el producto.')
      return
    }
    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      const body = await resolverUno(pendiente.id, familiaId)
      const sucursales = body.resultado?.sucursales_afectadas ?? pendiente.sucursales.length
      setMensaje(`Producto ${pendiente.cod_art} clasificado. Se propagó a ${sucursales} sucursal(es).`)
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGuardando(false)
    }
  }

  async function clasificarSeleccionados(): Promise<void> {
    if (seleccion.length === 0) return
    if (seleccion.some((p) => !puedeGestionarPendiente(p))) {
      setError('La selección contiene productos de sucursales donde no tenés permiso de clasificación.')
      return
    }
    if (!orgSeleccionada) {
      setError('La clasificación masiva sólo puede hacerse con productos de la misma organización.')
      return
    }
    if (!familiaMasiva) {
      setError('Elegí una familia para los productos seleccionados.')
      return
    }

    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      let sucursalesAfectadas = 0
      for (const pendiente of seleccion) {
        const body = await resolverUno(pendiente.id, familiaMasiva)
        sucursalesAfectadas += body.resultado?.sucursales_afectadas ?? 0
      }
      setMensaje(`${seleccion.length} producto(s) clasificados. Se actualizaron ${sucursalesAfectadas} estados de sucursal.`)
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGuardando(false)
    }
  }

  function toggle(id: string): void {
    const pendiente = pendientes.find((p) => p.id === id)
    if (!pendiente || !puedeGestionarPendiente(pendiente)) return
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-10 bg-white border-b border-border/40 px-4 md:px-8 py-4 md:py-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(puedeGestionar ? '/importar' : '/dashboard')}
            className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-none">Pendientes de catálogo</h1>
            <p className="text-sm text-muted-foreground mt-1">Aprendizaje compartido por toda la organización</p>
          </div>
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={loading || guardando}
            className="h-9 px-3 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </header>

      <main className="px-4 md:px-8 py-5 md:py-6 max-w-6xl space-y-4 pb-28">
        <div className="bg-brand-light border border-brand/20 rounded-card p-4 flex items-start gap-3">
          <Tags className="h-5 w-5 text-brand shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">Una clasificación se aprende una sola vez</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Si un artículo fue detectado por varias sucursales, una clasificación autorizada resuelve todas esas detecciones. Cada sucursal conserva su propio stock y venta media.
            </p>
          </div>
        </div>

        {!loading && haySoloLectura && (
          <div className="bg-slate-50 border border-slate-200 rounded-card p-4 flex items-start gap-3" role="status">
            <Eye className="h-5 w-5 text-slate-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Parte de esta bandeja es sólo lectura</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Podés seguir los pendientes de tu alcance zonal, pero sólo clasificar los detectados en sucursales donde seas gerente o supervisor local.
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-card shadow-card p-6 flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-brand animate-spin" />
            <p className="text-sm text-muted-foreground">Cargando productos pendientes...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-card p-4 flex items-start gap-3">
            <TriangleAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {mensaje && !error && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-card p-4 flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-800">{mensaje}</p>
          </div>
        )}

        {!loading && pendientes.length === 0 && !error && (
          <div className="bg-white rounded-card shadow-card p-8 text-center">
            <CheckCircle className="h-9 w-9 text-emerald-500 mx-auto" />
            <p className="text-foreground font-bold mt-3">Catálogo al día</p>
            <p className="text-sm text-muted-foreground mt-1">No hay productos nuevos pendientes de clasificación en tu alcance.</p>
          </div>
        )}

        {seleccion.length > 0 && (
          <div className="bg-white rounded-card shadow-card border border-brand/20 p-4 flex flex-col md:flex-row gap-3 md:items-end sticky top-[78px] z-[5]">
            <div className="flex-1">
              <p className="text-xs font-semibold text-foreground">{seleccion.length} producto(s) seleccionado(s)</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Asignación conjunta a una familia de la misma organización.</p>
            </div>
            <select
              value={familiaMasiva}
              onChange={(e) => setFamiliaMasiva(e.target.value)}
              disabled={!orgSeleccionada || guardando}
              className="min-h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground disabled:opacity-50"
            >
              <option value="">Elegir familia...</option>
              {familiasMasivas.map((f) => (
                <option key={f.id} value={f.id}>{f.codigo} · {f.nombre}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!familiaMasiva || guardando || !orgSeleccionada}
              onClick={() => void clasificarSeleccionados()}
              className="min-h-10 px-4 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
              Asignar familia
            </button>
          </div>
        )}

        {!loading && pendientes.length > 0 && (
          <div className="space-y-3">
            {pendientes.map((p) => {
              const editable = puedeGestionarPendiente(p)
              const familiasProducto = editable ? familias.filter((f) => f.organizacion_id === p.organizacion_id) : []
              return (
                <article key={p.id} className="bg-white rounded-card shadow-card border border-border/50 p-4">
                  <div className="flex items-start gap-3">
                    {editable ? (
                      <input
                        type="checkbox"
                        checked={seleccionados.has(p.id)}
                        onChange={() => toggle(p.id)}
                        className="mt-1 h-4 w-4 accent-[color:var(--brand)]"
                        aria-label={`Seleccionar ${p.cod_art}`}
                      />
                    ) : (
                      <Eye className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                        <ProductIdentity
                          producto={{
                            descripcion: p.descripcion,
                            marca: p.marca,
                            gramaje: p.gramaje,
                            cod_art: p.cod_art,
                            codigo_barras: null,
                          }}
                          showImage={false}
                          compact
                          className="flex-1"
                        />
                        <div className="md:text-right shrink-0">
                          <p className="text-xs font-semibold text-foreground">{p.sucursales.length} sucursal(es)</p>
                          <p className="text-[11px] text-muted-foreground">{p.detecciones} detección(es)</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {p.sucursales.map((s) => (
                          <span key={s.id} className="inline-flex px-2 py-1 rounded-md bg-muted text-[11px] text-foreground font-medium">
                            {s.codigo} · {s.nombre}
                          </span>
                        ))}
                      </div>

                      {editable ? (
                        <div className="mt-4 flex flex-col sm:flex-row gap-2">
                          <select
                            value={familiaPorPendiente[p.id] ?? ''}
                            onChange={(e) => setFamiliaPorPendiente((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            disabled={guardando}
                            className="flex-1 min-h-10 rounded-lg border border-border bg-white px-3 text-sm text-foreground disabled:opacity-50"
                            aria-label={`Familia para ${p.cod_art}`}
                          >
                            <option value="">Elegir familia...</option>
                            {familiasProducto.map((f) => (
                              <option key={f.id} value={f.id}>{f.codigo} · {f.nombre}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!familiaPorPendiente[p.id] || guardando}
                            onClick={() => void clasificarIndividual(p)}
                            className="min-h-10 px-4 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-semibold disabled:opacity-50"
                          >
                            Clasificar para toda la organización
                          </button>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground" aria-label={`Solo lectura ${p.cod_art}`}>
                          Solo lectura en tu alcance actual.
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
