import { useState, useEffect, useRef } from 'react'
import { X, Trash2, Save, AlertTriangle, Percent, Activity } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  BADGE_CONFIG,
  calcularDiasRestantes,
  calcularMetricasRiesgo,
  calcularNivelRiesgo,
} from '@/lib/riesgo'
import { RISK_VISUAL } from '@/lib/risk-config'
import type { NivelRiesgo } from '@/lib/riesgo'
import type { EstadoSeguimientoRag } from '@/types/index'

interface VencimientoParaEditar {
  id: string
  producto_id: string
  sucursal_id: string
  fecha_vencimiento: string
  cantidad: number
  dias_donacion: number
  nivel_riesgo: string
  productos: {
    descripcion: string
    cod_art: string | null
    codigo_barras: string | null
    gramaje: string | null
    marca: string | null
    sector: string | null
    stock_actual: number
    venta_media_diaria: number
    imagen_url?: string | null
  }
}

interface SeguimientoRagRow {
  rag_porcentaje: number | null
  rag_aplicado_at: string | null
  cantidad_base_rag: number | null
  cantidad_observada: number | null
  unidades_vendidas_observadas: number | null
  velocidad_observada: number | null
  velocidad_necesaria: number | null
  dias_comerciales_restantes: number
  estado_seguimiento_rag: EstadoSeguimientoRag
}

interface Props {
  vencimiento: VencimientoParaEditar
  onClose: () => void
  onGuardado: () => void
  onImagenActualizada?: (url: string) => void
}

const RAG_ESTADO_LABEL: Record<EstadoSeguimientoRag, string> = {
  decomiso: 'Producto vencido',
  donacion: 'En ventana de donación',
  sin_rag: 'Sin RAG registrado',
  efectivo_por_vmd: 'Velocidad Glaciar suficiente',
  pendiente_control_operador: 'Pendiente de nuevo control',
  dato_a_revisar: 'Cantidad a revisar',
  sin_movimiento: 'Sin movimiento',
  efectivo: 'RAG efectivo',
  insuficiente: 'RAG insuficiente',
}

function fmtVelocidad(valor: number | null): string {
  if (valor === null || !Number.isFinite(valor)) return '—'
  return `${valor.toFixed(2)} un/día`
}

export default function EditarVencimientoModal({ vencimiento, onClose, onGuardado, onImagenActualizada }: Props) {
  const [stockActual, setStockActual] = useState(vencimiento.productos.stock_actual)
  const [fechaVencimiento, setFechaVencimiento] = useState(vencimiento.fecha_vencimiento)
  const [cantidad, setCantidad] = useState(vencimiento.cantidad)
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nivelCalculado, setNivelCalculado] = useState<NivelRiesgo>(() =>
    calcularNivelRiesgo(
      calcularDiasRestantes(vencimiento.fecha_vencimiento),
      vencimiento.cantidad,
      vencimiento.productos.venta_media_diaria,
      vencimiento.dias_donacion,
    ),
  )

  const [seguimientoRag, setSeguimientoRag] = useState<SeguimientoRagRow | null>(null)
  const [ragPorcentaje, setRagPorcentaje] = useState('')
  const [cargandoRag, setCargandoRag] = useState(true)

  const fotoInputRef = useRef<HTMLInputElement>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(vencimiento.productos.imagen_url ?? null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [fotoGuardada, setFotoGuardada] = useState(false)
  const [errorFoto, setErrorFoto] = useState<string | null>(null)

  useEffect(() => {
    let activo = true

    async function cargarSeguimientoRag(): Promise<void> {
      setCargandoRag(true)
      const { data, error: ragError } = await supabase
        .from('v_seguimiento_rag_actual')
        .select(
          'rag_porcentaje, rag_aplicado_at, cantidad_base_rag, cantidad_observada, unidades_vendidas_observadas, velocidad_observada, velocidad_necesaria, dias_comerciales_restantes, estado_seguimiento_rag',
        )
        .eq('vencimiento_id', vencimiento.id)
        .maybeSingle()

      if (!activo) return

      // Compatibilidad mientras producción todavía no tenga las nuevas vistas.
      if (ragError?.code === '42P01' || ragError?.code === 'PGRST205') {
        setSeguimientoRag(null)
        setCargandoRag(false)
        return
      }

      if (ragError) {
        console.error('[EditarVencimientoModal] Error seguimiento RAG:', ragError)
        setSeguimientoRag(null)
        setCargandoRag(false)
        return
      }

      const row = (data ?? null) as SeguimientoRagRow | null
      setSeguimientoRag(row)
      setRagPorcentaje(row?.rag_porcentaje != null ? String(row.rag_porcentaje) : '')
      setCargandoRag(false)
    }

    void cargarSeguimientoRag()
    return () => { activo = false }
  }, [vencimiento.id])

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    if (!file) return
    const localUrl = URL.createObjectURL(file)
    setFotoUrl(localUrl)
    setSubiendoFoto(true)
    setFotoGuardada(false)
    setErrorFoto(null)
    try {
      const codArt = vencimiento.productos.cod_art ?? vencimiento.producto_id
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${codArt}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('productos-imagenes')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('productos-imagenes').getPublicUrl(path)
      const publicUrl = urlData.publicUrl
      const { error: updateError } = await supabase
        .from('productos')
        .update({ imagen_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', vencimiento.producto_id)
      if (updateError) throw updateError
      setFotoUrl(publicUrl)
      setFotoGuardada(true)
      onImagenActualizada?.(publicUrl)
      if (fotoInputRef.current) fotoInputRef.current.value = ''
    } catch (err) {
      console.error('[EditarVencimientoModal] Error al subir foto:', err)
      setFotoUrl(vencimiento.productos.imagen_url ?? null)
      setErrorFoto('No se pudo guardar la foto. Intentá de nuevo.')
    } finally {
      setSubiendoFoto(false)
    }
  }

  useEffect(() => {
    setNivelCalculado(
      calcularNivelRiesgo(
        calcularDiasRestantes(fechaVencimiento),
        cantidad,
        vencimiento.productos.venta_media_diaria,
        vencimiento.dias_donacion,
      ),
    )
  }, [fechaVencimiento, cantidad, vencimiento.productos.venta_media_diaria, vencimiento.dias_donacion])

  const diasRestantes = calcularDiasRestantes(fechaVencimiento)
  const metricas = calcularMetricasRiesgo(
    diasRestantes,
    cantidad,
    vencimiento.productos.venta_media_diaria,
    vencimiento.dias_donacion,
  )
  const puedeGestionarRag = nivelCalculado === 'radar' || nivelCalculado === 'urgente'

  async function handleGuardar(): Promise<void> {
    setError(null)
    setGuardando(true)

    // 1. Fecha: sigue siendo edición del registro actual.
    if (fechaVencimiento !== vencimiento.fecha_vencimiento) {
      const { error: errFecha } = await supabase
        .from('vencimientos')
        .update({ fecha_vencimiento: fechaVencimiento })
        .eq('id', vencimiento.id)
      if (errFecha) {
        setError(`Error al guardar fecha: ${errFecha.message}`)
        setGuardando(false)
        return
      }
    }

    // 2. Control físico del operador: SIEMPRE append-only, incluso 10 → 10.
    // De esa forma "no se vendió nada" se convierte en una señal medible.
    const { error: errControl } = await supabase.rpc('registrar_control_vencimiento', {
      p_vencimiento_id: vencimiento.id,
      p_cantidad_comprometida: cantidad,
      p_nota: null,
    })
    if (errControl) {
      setError(`Error al registrar control: ${errControl.message}`)
      setGuardando(false)
      return
    }

    // 3. Un porcentaje distinto crea una NUEVA intervención RAG. Mantener 30%
    // al día siguiente sólo registra el control físico; no duplica el RAG.
    if (puedeGestionarRag && ragPorcentaje.trim() !== '') {
      const porcentaje = Number(ragPorcentaje)
      if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
        setError('El RAG debe ser un porcentaje mayor a 0 y menor o igual a 100.')
        setGuardando(false)
        return
      }

      const porcentajeAnterior = seguimientoRag?.rag_porcentaje ?? null
      if (porcentajeAnterior === null || Math.abs(porcentaje - porcentajeAnterior) > 0.0001) {
        const { error: errRag } = await supabase.rpc('registrar_intervencion_rag', {
          p_vencimiento_id: vencimiento.id,
          p_porcentaje_descuento: porcentaje,
          p_nota: null,
        })
        if (errRag) {
          setError(`Control guardado, pero no se pudo registrar el nuevo RAG: ${errRag.message}`)
          setGuardando(false)
          return
        }
      }
    }

    // Compatibilidad legacy de stock total; el stock comprometido es `cantidad`.
    if (stockActual !== vencimiento.productos.stock_actual) {
      const { error: errProd } = await supabase
        .from('productos')
        .update({ stock_actual: stockActual, updated_at: new Date().toISOString() })
        .eq('id', vencimiento.producto_id)
      if (errProd) {
        setError(`Control guardado, pero falló el stock total: ${errProd.message}`)
        setGuardando(false)
        return
      }
    }

    setGuardando(false)
    onGuardado()
    onClose()
  }

  async function handleEliminar(): Promise<void> {
    setError(null)
    setEliminando(true)
    const { error: errDel } = await supabase
      .from('vencimientos')
      .update({ activo: false })
      .eq('id', vencimiento.id)
    if (errDel) { setError(`Error al eliminar: ${errDel.message}`); setEliminando(false); return }
    setEliminando(false)
    onGuardado()
    onClose()
  }

  const badge = BADGE_CONFIG[nivelCalculado]
  const riskViz = RISK_VISUAL[nivelCalculado]

  const partes = [vencimiento.productos.descripcion]
  if (vencimiento.productos.gramaje) partes.push(vencimiento.productos.gramaje)
  const tituloBase = partes.join(' ')
  const titulo = vencimiento.productos.marca ? `${tituloBase} — ${vencimiento.productos.marca}` : tituloBase

  const diasStock = vencimiento.productos.venta_media_diaria > 0
    ? `${metricas.dias_stock.toFixed(1)} días`
    : 'Sin rotación'

  const inputCls = 'w-full h-11 px-3 bg-surface-base border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all duration-150'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Editar vencimiento"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-md bg-white sm:rounded-modal rounded-t-modal shadow-modal overflow-hidden animate-slide-up max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="shrink-0">
              <div className="flex flex-col items-center gap-1.5">
                {fotoUrl ? (
                  <img src={fotoUrl} alt={vencimiento.productos.descripcion} className="h-20 w-20 rounded-2xl object-cover" />
                ) : (
                  <div className="h-20 w-20 rounded-2xl bg-muted flex flex-col items-center justify-center gap-1">
                    <span className="text-xl" aria-hidden="true">📷</span>
                    <span className="text-[9px] text-muted-foreground font-medium leading-none">Sin foto</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fotoInputRef.current?.click()}
                  disabled={subiendoFoto}
                  className="w-20 py-1 rounded-lg bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground text-[9px] font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer touch-manipulation"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {subiendoFoto ? <span className="h-3 w-3 border-2 border-brand/40 border-t-brand rounded-full animate-spin" /> : fotoUrl ? 'Cambiar foto' : 'Agregar foto'}
                </button>
                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/*"
                  {...(fotoUrl ? {} : { capture: 'environment' as const })}
                  className="hidden"
                  onChange={(e) => { void handleFotoChange(e) }}
                />
              </div>
              {fotoGuardada && <p className="text-[10px] text-emerald-600 font-medium text-center mt-0.5">Foto guardada</p>}
              {errorFoto && <p className="text-[10px] text-red-500 font-medium text-center mt-0.5">{errorFoto}</p>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground font-medium mb-1">Control del producto</p>
              <h2 className="text-foreground font-bold text-sm leading-snug">{titulo}</h2>
              <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                <span>Cod: <span className="font-mono text-foreground/70">{vencimiento.productos.cod_art ?? '—'}</span></span>
                <span>EAN: <span className="text-foreground/70">{vencimiento.productos.codigo_barras ?? 'Sin mapear'}</span></span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                VMD Glaciar: <span className="text-foreground/70">{vencimiento.productos.venta_media_diaria} un/día</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pt-4 space-y-2">
          <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${riskViz.rowBg} border ${riskViz.badge.split(' ').find(c => c.startsWith('border')) ?? 'border-border'}`}>
            <span className="text-xs text-muted-foreground font-medium">Riesgo calculado</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${riskViz.badge}`}>{badge.label}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-muted-foreground">Ventana comercial</p>
              <p className="font-semibold text-foreground mt-0.5">{metricas.dias_comerciales_restantes} días</p>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-muted-foreground">Velocidad necesaria</p>
              <p className="font-semibold text-foreground mt-0.5">{fmtVelocidad(metricas.velocidad_necesaria)}</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground px-1">
            Retiro para donación: {vencimiento.dias_donacion} días antes del vencimiento.
          </p>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="modal-stock" className="block text-xs font-semibold text-foreground uppercase tracking-wide">Stock total Glaciar</label>
            <input id="modal-stock" type="number" min={0} value={stockActual} onChange={(e) => setStockActual(Number(e.target.value))} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="modal-fecha" className="block text-xs font-semibold text-foreground uppercase tracking-wide">Fecha de vencimiento</label>
            <input id="modal-fecha" type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="modal-cantidad" className="block text-xs font-semibold text-foreground uppercase tracking-wide">Cantidad comprometida observada hoy</label>
            <input id="modal-cantidad" type="number" min={0} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} className={inputCls} />
            <p className="text-[11px] text-muted-foreground">Se guarda como un nuevo control aunque la cantidad sea igual al control anterior.</p>
          </div>

          {(puedeGestionarRag || seguimientoRag?.rag_porcentaje != null) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-amber-700" />
                <div>
                  <p className="text-xs font-bold text-foreground">RAG · Retiro Anticipado de Góndola</p>
                  <p className="text-[11px] text-muted-foreground">Registrá el descuento aplicado en Glaciar.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="modal-rag" className="block text-xs font-semibold text-foreground">Descuento RAG actual (%)</label>
                <input
                  id="modal-rag"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={ragPorcentaje}
                  onChange={(e) => setRagPorcentaje(e.target.value)}
                  disabled={!puedeGestionarRag}
                  placeholder="Ej. 30"
                  className={inputCls}
                />
              </div>

              {cargandoRag ? (
                <p className="text-[11px] text-muted-foreground">Cargando seguimiento…</p>
              ) : seguimientoRag?.rag_porcentaje != null ? (
                <div className="rounded-lg bg-white/80 border border-amber-100 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-amber-700" />
                    <span className="text-xs font-semibold text-foreground">{RAG_ESTADO_LABEL[seguimientoRag.estado_seguimiento_rag]}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>RAG vigente</span><span className="text-right font-medium text-foreground">{seguimientoRag.rag_porcentaje}%</span>
                    <span>Vel. observada</span><span className="text-right font-medium text-foreground">{fmtVelocidad(seguimientoRag.velocidad_observada)}</span>
                    <span>Vel. necesaria</span><span className="text-right font-medium text-foreground">{fmtVelocidad(seguimientoRag.velocidad_necesaria)}</span>
                    {seguimientoRag.unidades_vendidas_observadas != null && (
                      <><span>Reducción observada</span><span className="text-right font-medium text-foreground">{seguimientoRag.unidades_vendidas_observadas} un</span></>
                    )}
                  </div>
                  {puedeGestionarRag && (
                    <p className="text-[10px] text-muted-foreground pt-1">Si cambiás el porcentaje, Noven conservará el RAG anterior y abrirá una nueva etapa de seguimiento.</p>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">Todavía no hay un RAG registrado para este vencimiento.</p>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 animate-fade-in">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-600 text-xs">{error}</p>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 space-y-2">
          <button
            type="button"
            onClick={() => void handleGuardar()}
            disabled={guardando || eliminando}
            className="w-full h-11 flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-lg shadow-brand transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {guardando ? (
              <><span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</>
            ) : (
              <><Save className="h-4 w-4" />Registrar control</>
            )}
          </button>

          {!confirmarEliminar ? (
            <button
              type="button"
              onClick={() => setConfirmarEliminar(true)}
              disabled={guardando || eliminando}
              className="w-full h-11 flex items-center justify-center gap-2 bg-transparent hover:bg-red-50 border border-red-200 text-red-600 hover:text-red-700 font-medium text-sm rounded-lg transition-all duration-150 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar registro
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-center text-muted-foreground">Esta acción no se puede deshacer.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmarEliminar(false)} disabled={eliminando} className="flex-1 h-11 bg-muted hover:bg-muted/70 text-foreground font-medium text-sm rounded-lg transition-colors disabled:opacity-50">Cancelar</button>
                <button type="button" onClick={() => void handleEliminar()} disabled={eliminando} className="flex-1 h-11 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-sm rounded-lg transition-colors active:scale-[0.98] disabled:opacity-50">
                  {eliminando ? <><span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Eliminando...</> : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
