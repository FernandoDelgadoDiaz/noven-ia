import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle,
  CircleOff,
  Clock3,
  Percent,
  Save,
  Tags,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSucursalActual } from '@/hooks/useSucursalActual'
import {
  BADGE_CONFIG,
  calcularDiasRestantes,
  calcularMetricasRiesgo,
  calcularNivelRiesgo,
  type NivelRiesgo,
} from '@/lib/riesgo'
import { RISK_VISUAL } from '@/lib/risk-config'
import {
  consultarModoImagenProducto,
  guardarImagenProductoGlobal,
  type ModoImagenProducto,
} from '@/lib/product-image'
import ProductIdentity from '@/components/product/ProductIdentity'
import type { EstadoSeguimientoRag, EstadoSolicitudCambioRag } from '@/types/index'
import { useEscalaRag } from '@/hooks/useEscalaRag'
import { useSolicitudCambioRag } from '@/hooks/useSolicitudCambioRag'
import { useAccesosMultitenant } from '@/hooks/useAccesosMultitenant'
import { useUsuarioRol } from '@/hooks/useUsuarioRol'
import { coberturaComoPorcentaje, evaluarSugerencia } from '@/lib/ragCobertura'
import {
  CAUSAS_NO_VENTA,
  evaluarSalidaAnomala,
  type ContextoSalida,
  type RespuestaNoVenta,
} from '@/lib/salidaAnomala'

interface VencimientoParaEditar {
  id: string
  producto_id: string
  fecha_vencimiento: string
  cantidad: number
  dias_donacion?: number
  nivel_riesgo: string
  productos: {
    descripcion: string
    cod_art: string | null
    codigo_barras: string | null
    gramaje: string | null
    marca: string | null
    stock_actual: number
    venta_media_diaria: number
    imagen_url?: string | null
    imagen_thumb_url?: string | null
    organizacion_id?: string
  }
}

interface SeguimientoRagRow {
  dias_donacion: number | null
  rag_porcentaje: number | null
  rag_aplicado_at: string | null
  cantidad_base_rag: number | null
  cantidad_observada: number | null
  unidades_vendidas_observadas: number | null
  velocidad_observada: number | null
  velocidad_necesaria: number | null
  dias_observados: number | null
  dias_desde_ultimo_rag: number | null
  dias_comerciales_restantes: number
  estado_seguimiento_rag: EstadoSeguimientoRag
  hay_oferta_central: boolean
  intervenciones_abiertas: number
  medicion_atribuible: boolean
}

interface SalidaPendiente {
  observacionId: number
  bajada: number
}

interface Props {
  vencimiento: VencimientoParaEditar
  onClose: () => void
  onGuardado: () => void
  onImagenActualizada?: (url: string) => void
}

type MotivoFinalizacionRag = 'decision_comercial' | 'otro'

const RAG_ESTADO_LABEL: Record<EstadoSeguimientoRag, string> = {
  decomiso: 'Producto vencido',
  donacion: 'En ventana de donación',
  sin_rag: 'Sin RAG registrado',
  pendiente_control_operador: 'Pendiente de nuevo control',
  ventana_insuficiente: 'Ventana todavía corta para medir',
  dato_a_revisar: 'Cantidad a revisar',
  sin_movimiento: 'Sin movimiento',
  efectivo: 'RAG efectivo',
  insuficiente: 'RAG insuficiente',
}

function fmtVelocidad(valor: number | null): string {
  if (valor === null || !Number.isFinite(valor)) return '—'
  return `${valor.toFixed(2)} un/día`
}

const SOLICITUD_RAG_LABEL: Record<EstadoSolicitudCambioRag, string> = {
  solicitada: 'Pendiente de ejecución zonal',
  ejecutada_no_habilitada: 'Ejecutada · disponible para verificar mañana',
  lista_confirmacion: 'Lista para verificar en góndola',
  confirmada: 'Confirmada en góndola',
  no_aplicada: 'No aplicada · pendiente de nueva ejecución',
}

export default function EditarVencimientoModalSeguro({
  vencimiento,
  onClose,
  onGuardado,
  onImagenActualizada,
}: Props) {
  const { sucursalId } = useSucursalActual()
  const { accesos, legacyMode } = useAccesosMultitenant()
  const { rol: rolLegacy } = useUsuarioRol()
  const {
    solicitud: solicitudCambioRag,
    loading: cargandoSolicitudRag,
    error: errorSolicitudRag,
    disponible: circuitoRagDisponible,
    refetch: recargarSolicitudRag,
  } = useSolicitudCambioRag(vencimiento.id)
  const [stockActual, setStockActual] = useState(vencimiento.productos.stock_actual)
  const [fechaVencimiento, setFechaVencimiento] = useState(vencimiento.fecha_vencimiento)
  const [cantidad, setCantidad] = useState(vencimiento.cantidad)
  const [diasDonacion, setDiasDonacion] = useState(vencimiento.dias_donacion ?? 10)
  const [guardando, setGuardando] = useState(false)
  const [cerrandoVendido, setCerrandoVendido] = useState(false)
  const [anulando, setAnulando] = useState(false)
  const [confirmarVendido, setConfirmarVendido] = useState(false)
  const [confirmarAnulacion, setConfirmarAnulacion] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [seguimientoRag, setSeguimientoRag] = useState<SeguimientoRagRow | null>(null)
  const [cargandoRag, setCargandoRag] = useState(true)
  const [solicitandoRag, setSolicitandoRag] = useState(false)
  const [finalizandoRag, setFinalizandoRag] = useState(false)
  const [confirmarFinalizarRag, setConfirmarFinalizarRag] = useState(false)
  const { escala: escalaRag } = useEscalaRag()
  const [motivoFinalizacionRag, setMotivoFinalizacionRag] = useState<MotivoFinalizacionRag>('decision_comercial')
  const [notaFinalizacionRag, setNotaFinalizacionRag] = useState('')
  // Informar el primer RAG: el valor del selector es el porcentaje como texto,
  // o 'otro' cuando la cadena puso algo fuera de la escala autorizada.
  const [seleccionRagInformado, setSeleccionRagInformado] = useState('')
  const [porcentajeRagFueraEscala, setPorcentajeRagFueraEscala] = useState('')
  const [informandoRag, setInformandoRag] = useState(false)
  const [notaOfertaCentral, setNotaOfertaCentral] = useState('')
  const [gestionandoOfertaCentral, setGestionandoOfertaCentral] = useState(false)
  const [confirmarFinalizarOferta, setConfirmarFinalizarOferta] = useState(false)
  const [salidaPendiente, setSalidaPendiente] = useState<SalidaPendiente | null>(null)
  const [declarandoSalida, setDeclarandoSalida] = useState(false)

  const fotoInputRef = useRef<HTMLInputElement>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(vencimiento.productos.imagen_url ?? null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [fotoGuardada, setFotoGuardada] = useState(false)
  const [errorFoto, setErrorFoto] = useState<string | null>(null)
  const [modoFoto, setModoFoto] = useState<ModoImagenProducto | null>(null)
  const [cargandoPermisoFoto, setCargandoPermisoFoto] = useState(true)

  const [nivelCalculado, setNivelCalculado] = useState<NivelRiesgo>(() =>
    calcularNivelRiesgo(
      calcularDiasRestantes(vencimiento.fecha_vencimiento),
      vencimiento.cantidad,
      vencimiento.productos.venta_media_diaria,
      vencimiento.dias_donacion ?? 10,
    ),
  )

  useEffect(() => {
    let activo = true
    async function cargarSeguimiento(): Promise<void> {
      setCargandoRag(true)
      const { data, error: ragError } = await supabase
        .from('v_seguimiento_rag_actual')
        .select('dias_donacion, rag_porcentaje, rag_aplicado_at, cantidad_base_rag, cantidad_observada, unidades_vendidas_observadas, velocidad_observada, velocidad_necesaria, dias_observados, dias_desde_ultimo_rag, dias_comerciales_restantes, estado_seguimiento_rag, hay_oferta_central, intervenciones_abiertas, medicion_atribuible')
        .eq('vencimiento_id', vencimiento.id)
        .maybeSingle()

      if (!activo) return
      if (ragError?.code === '42P01' || ragError?.code === 'PGRST205') {
        setSeguimientoRag(null)
        setCargandoRag(false)
        return
      }
      if (ragError) {
        console.error('[EditarVencimientoModalSeguro] seguimiento RAG:', ragError)
        setSeguimientoRag(null)
        setCargandoRag(false)
        return
      }
      const row = (data ?? null) as SeguimientoRagRow | null
      setSeguimientoRag(row)
      if (row?.dias_donacion != null) setDiasDonacion(row.dias_donacion)
      setCargandoRag(false)
    }
    void cargarSeguimiento()
    return () => { activo = false }
  }, [vencimiento.id])

  useEffect(() => {
    let activo = true
    async function cargarModoFoto(): Promise<void> {
      if (!sucursalId) {
        if (activo) setCargandoPermisoFoto(false)
        return
      }
      setCargandoPermisoFoto(true)
      try {
        const modo = await consultarModoImagenProducto(sucursalId, vencimiento.producto_id)
        if (!activo) return
        setModoFoto(modo)
      } catch (err) {
        if (!activo) return
        console.error('[EditarVencimientoModalSeguro] modo imagen:', err)
        setModoFoto('solo_lectura')
      } finally {
        if (activo) setCargandoPermisoFoto(false)
      }
    }
    void cargarModoFoto()
    return () => { activo = false }
  }, [sucursalId, vencimiento.producto_id])

  useEffect(() => {
    setNivelCalculado(
      calcularNivelRiesgo(
        calcularDiasRestantes(fechaVencimiento),
        cantidad,
        vencimiento.productos.venta_media_diaria,
        diasDonacion,
      ),
    )
  }, [fechaVencimiento, cantidad, vencimiento.productos.venta_media_diaria, diasDonacion])

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    if (!file) return
    if (!sucursalId) {
      setErrorFoto('No hay una sucursal seleccionada.')
      return
    }
    const organizacionId = vencimiento.productos.organizacion_id
    if (!organizacionId) {
      setErrorFoto('No se pudo resolver la organización del producto.')
      return
    }
    if (modoFoto === 'solo_lectura') {
      setErrorFoto('La foto ya es compartida por la organización y tu perfil no puede reemplazarla.')
      if (fotoInputRef.current) fotoInputRef.current.value = ''
      return
    }

    const localUrl = URL.createObjectURL(file)
    setFotoUrl(localUrl)
    setSubiendoFoto(true)
    setFotoGuardada(false)
    setErrorFoto(null)

    try {
      const resultado = await guardarImagenProductoGlobal({
        file,
        sucursalId,
        productoId: vencimiento.producto_id,
        organizacionId,
      })
      setFotoUrl(resultado.publicUrl)
      setModoFoto(resultado.modoPosterior)
      setFotoGuardada(true)
      onImagenActualizada?.(resultado.publicUrl)
      if (fotoInputRef.current) fotoInputRef.current.value = ''
    } catch (err) {
      console.error('[EditarVencimientoModalSeguro] imagen global:', err)
      setFotoUrl(vencimiento.productos.imagen_url ?? null)
      const message = err instanceof Error ? err.message : ''
      setErrorFoto(message || 'No se pudo guardar la foto. Intentá de nuevo.')
    } finally {
      URL.revokeObjectURL(localUrl)
      setSubiendoFoto(false)
    }
  }

  const puedeGestionarRag = nivelCalculado === 'radar' || nivelCalculado === 'urgente'
  const puedeValidarSugerencia = legacyMode
    ? rolLegacy === 'admin' || rolLegacy === 'supervisor'
    : Boolean(sucursalId) && accesos.some((acceso) =>
      acceso.activo
      && acceso.sucursal_id === sucursalId
      && (acceso.rol === 'gerente_sucursal' || acceso.rol === 'supervisor'),
    )

  // Sugerencia por urgencia. Mismo motor determinístico que la línea del
  // Dashboard: el operador no puede ver dos números distintos para lo mismo.
  const sugerencia = useMemo(() => {
    if (!seguimientoRag) return null
    return evaluarSugerencia({
      estado: seguimientoRag.estado_seguimiento_rag,
      velocidadObservada: seguimientoRag.velocidad_observada,
      velocidadNecesaria: seguimientoRag.velocidad_necesaria,
      diasComercialesRestantes: seguimientoRag.dias_comerciales_restantes,
      diasObservados: seguimientoRag.dias_observados,
      diasDesdeUltimoRag: seguimientoRag.dias_desde_ultimo_rag,
      ragPorcentaje: seguimientoRag.rag_porcentaje,
    }, escalaRag)
  }, [seguimientoRag, escalaRag])

  // El estado insuficiente / sin movimiento es el que amerita mostrar el
  // detalle del déficit. En los demás, la tarjeta queda como estaba.
  const muestraDetalleCobertura = seguimientoRag != null
    && (seguimientoRag.estado_seguimiento_rag === 'insuficiente'
      || seguimientoRag.estado_seguimiento_rag === 'sin_movimiento')
  const diasRestantes = calcularDiasRestantes(fechaVencimiento)
  const metricas = calcularMetricasRiesgo(
    diasRestantes,
    cantidad,
    vencimiento.productos.venta_media_diaria,
    diasDonacion,
  )

  async function handleGuardar(): Promise<void> {
    setError(null)
    if (cantidad === 0) {
      setConfirmarVendido(true)
      return
    }
    if (!Number.isFinite(cantidad) || cantidad < 0) {
      setError('La cantidad comprometida no es válida.')
      return
    }
    if (!fechaVencimiento) {
      setError('La fecha de vencimiento es obligatoria.')
      return
    }
    if (!Number.isFinite(stockActual) || stockActual < 0) {
      setError('El stock total debe ser mayor o igual a cero.')
      return
    }

    setGuardando(true)
    const { data: controlData, error: rpcError } = await supabase.rpc('registrar_control_vencimiento_dashboard', {
      p_vencimiento_id: vencimiento.id,
      p_cantidad_comprometida: cantidad,
      p_fecha_vencimiento: fechaVencimiento,
      p_stock_actual: stockActual,
      // El control registra evidencia operativa. El cambio de precio sigue el
      // circuito centralizado y nunca se origina desde este formulario.
      p_porcentaje_rag: null,
      p_nota: null,
    })

    if (rpcError) {
      setGuardando(false)
      setError(`No se pudo registrar el control: ${rpcError.message}`)
      return
    }

    const observacionId = Number((controlData as { observacion_id?: number } | null)?.observacion_id)
    if (Number.isFinite(observacionId)) {
      const { data: contextoData, error: contextoError } = await supabase.rpc(
        'contexto_salida_control',
        { p_observacion_id: observacionId },
      )
      if (!contextoError) {
        const row = Array.isArray(contextoData) ? contextoData[0] : contextoData
        if (row) {
          const contexto = row as {
            cantidad_previa: number | null
            cantidad_actual: number | null
            bajada: number | null
            dias: number | null
            velocidad_necesaria: number | null
            umbral: number | null
            ya_declarada: boolean
          }
          const decision = evaluarSalidaAnomala({
            cantidadPrevia: contexto.cantidad_previa,
            cantidadActual: contexto.cantidad_actual,
            bajada: contexto.bajada,
            dias: contexto.dias,
            velocidadNecesaria: contexto.velocidad_necesaria,
            umbral: contexto.umbral,
            yaDeclarada: contexto.ya_declarada,
          } satisfies ContextoSalida)
          if (decision.preguntar && decision.bajada != null) {
            setGuardando(false)
            setSalidaPendiente({ observacionId, bajada: decision.bajada })
            return
          }
        }
      } else {
        console.error('[EditarVencimientoModalSeguro] contexto salida:', contextoError)
      }
    }

    setGuardando(false)
    onGuardado()
    onClose()
  }

  async function handleFinalizarRag(): Promise<void> {
    setError(null)
    if (seguimientoRag?.rag_porcentaje == null) {
      setConfirmarFinalizarRag(false)
      return
    }
    setFinalizandoRag(true)
    const { error: rpcError } = await supabase.rpc('finalizar_rag_vigente', {
      p_vencimiento_id: vencimiento.id,
      p_motivo: motivoFinalizacionRag,
      p_nota: notaFinalizacionRag.trim() || null,
    })
    setFinalizandoRag(false)

    if (rpcError) {
      setError(`No se pudo finalizar el RAG: ${rpcError.message}`)
      setConfirmarFinalizarRag(false)
      return
    }

    setConfirmarFinalizarRag(false)
    onGuardado()
    onClose()
  }

  function hayControlSinGuardar(): boolean {
    return stockActual !== vencimiento.productos.stock_actual
      || fechaVencimiento !== vencimiento.fecha_vencimiento
      || cantidad !== vencimiento.cantidad
  }

  async function handleSolicitarCambioRag(): Promise<void> {
    setError(null)
    if (hayControlSinGuardar()) {
      setError('Registrá primero el control para validar la sugerencia con la evidencia actual.')
      return
    }

    setSolicitandoRag(true)
    const { error: rpcError } = await supabase.rpc('solicitar_cambio_rag', {
      p_vencimiento_id: vencimiento.id,
    })
    setSolicitandoRag(false)
    if (rpcError) {
      setError(`No se pudo informar el cambio RAG: ${rpcError.message}`)
      return
    }

    await recargarSolicitudRag()
    onGuardado()
  }

  /**
   * Porcentaje elegido para informar, o null si todavía no hay uno válido.
   *
   * La escala gobierna lo que se SUGIERE, no lo que se puede declarar: si la
   * cadena puso un porcentaje fuera de escala, eso ya ocurrió en la góndola y
   * tiene que poder informarse igual. El servidor lo marca `fuera_de_escala` y
   * lo excluye de los promedios, que es lo correcto — pero lo registra.
   */
  function porcentajeRagAInformar(): number | null {
    const crudo = seleccionRagInformado === 'otro'
      ? porcentajeRagFueraEscala
      : seleccionRagInformado
    const valor = Number(crudo)
    if (!Number.isFinite(valor) || valor <= 0 || valor > 100) return null
    return valor
  }

  async function handleInformarRag(): Promise<void> {
    setError(null)
    const porcentaje = porcentajeRagAInformar()
    if (porcentaje == null) {
      setError('Elegí el porcentaje que ya está aplicado en góndola.')
      return
    }
    if (hayControlSinGuardar()) {
      setError('Registrá primero el control para que el RAG comience con ese stock conocido.')
      return
    }

    setInformandoRag(true)
    const { error: rpcError } = await supabase.rpc('informar_rag', {
      p_vencimiento_id: vencimiento.id,
      p_porcentaje: porcentaje,
      p_nota: null,
    })
    setInformandoRag(false)
    if (rpcError) {
      setError(`No se pudo informar el RAG: ${rpcError.message}`)
      return
    }
    onGuardado()
    onClose()
  }

  async function handleInformarOfertaCentral(): Promise<void> {
    setError(null)
    if (hayControlSinGuardar()) {
      setError('Registrá primero el control para que la oferta comience con ese stock conocido.')
      return
    }

    setGestionandoOfertaCentral(true)
    const { error: rpcError } = await supabase.rpc('informar_oferta_central', {
      p_vencimiento_id: vencimiento.id,
      p_nota: notaOfertaCentral.trim() || null,
    })
    setGestionandoOfertaCentral(false)
    if (rpcError) {
      setError(`No se pudo informar la oferta central: ${rpcError.message}`)
      return
    }
    onGuardado()
    onClose()
  }

  async function handleFinalizarOfertaCentral(): Promise<void> {
    setError(null)
    setGestionandoOfertaCentral(true)
    const { error: rpcError } = await supabase.rpc('finalizar_oferta_central', {
      p_vencimiento_id: vencimiento.id,
      p_nota: notaOfertaCentral.trim() || null,
    })
    setGestionandoOfertaCentral(false)
    if (rpcError) {
      setError(`No se pudo finalizar la oferta central: ${rpcError.message}`)
      setConfirmarFinalizarOferta(false)
      return
    }
    setConfirmarFinalizarOferta(false)
    onGuardado()
    onClose()
  }

  async function handleDeclararSalida(respuesta: RespuestaNoVenta): Promise<void> {
    if (!salidaPendiente) return
    setError(null)
    setDeclarandoSalida(true)
    const { error: rpcError } = await supabase.rpc('declarar_salida_no_venta', {
      p_observacion_id: salidaPendiente.observacionId,
      p_respuesta: respuesta,
    })
    setDeclarandoSalida(false)
    if (rpcError) {
      setError(`No se pudo registrar la salida: ${rpcError.message}`)
      return
    }
    setSalidaPendiente(null)
    onGuardado()
    onClose()
  }

  async function handleCerrarVendido(): Promise<void> {
    setError(null)
    setCerrandoVendido(true)
    const { error: cierreError } = await supabase.rpc('cerrar_vencimiento_operativo', {
      p_vencimiento_id: vencimiento.id,
      p_resultado: 'vendido',
      p_observaciones: null,
    })
    setCerrandoVendido(false)
    if (cierreError) {
      setError(`No se pudo registrar como vendido: ${cierreError.message}`)
      return
    }
    onGuardado()
    onClose()
  }

  async function handleAnular(): Promise<void> {
    setError(null)
    setAnulando(true)
    const { error: anularError } = await supabase.rpc('anular_vencimiento_carga_incorrecta', {
      p_vencimiento_id: vencimiento.id,
      p_motivo: 'Carga incorrecta desde Dashboard',
    })
    setAnulando(false)
    if (anularError) {
      setError(`No se pudo anular la carga: ${anularError.message}`)
      return
    }
    onGuardado()
    onClose()
  }

  const badge = BADGE_CONFIG[nivelCalculado]
  const riskViz = RISK_VISUAL[nivelCalculado]
  const ocupado = guardando || cerrandoVendido || anulando || subiendoFoto || informandoRag
    || finalizandoRag || gestionandoOfertaCentral || declarandoSalida || solicitandoRag
  const puedeEditarFoto = modoFoto === 'agregar' || modoFoto === 'reemplazar'
  const inputCls = 'w-full h-11 px-3 bg-surface-base border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all duration-150'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Control de vencimiento">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={ocupado ? undefined : onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-white sm:rounded-modal rounded-t-modal shadow-modal overflow-hidden max-h-[92vh] overflow-y-auto animate-slide-up">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-border">
          <div className="flex gap-3 min-w-0 flex-1">
            <div className="shrink-0">
              {fotoUrl ? (
                <img src={fotoUrl} alt={vencimiento.productos.descripcion} decoding="async" className="h-20 w-20 rounded-2xl object-cover" />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center text-2xl">📷</div>
              )}
              {puedeEditarFoto && (
                <button type="button" onClick={() => fotoInputRef.current?.click()} disabled={subiendoFoto || ocupado || cargandoPermisoFoto} className="w-20 mt-1 py-1 rounded-lg bg-muted text-[9px] font-semibold text-muted-foreground disabled:opacity-50">
                  {subiendoFoto ? 'Guardando…' : modoFoto === 'reemplazar' ? 'Cambiar foto' : 'Agregar foto'}
                </button>
              )}
              {fotoUrl && modoFoto === 'solo_lectura' && (
                <p className="w-20 text-[9px] text-muted-foreground text-center mt-1">Foto compartida</p>
              )}
              {puedeEditarFoto && (
                <input ref={fotoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void handleFotoChange(e) }} />
              )}
              {fotoGuardada && <p className="text-[10px] text-emerald-600 text-center mt-1">Guardada</p>}
              {errorFoto && <p className="text-[10px] text-red-500 text-center mt-1 max-w-20">{errorFoto}</p>}
            </div>
            <ProductIdentity producto={vencimiento.productos} showImage={false} label="Control del producto" compact>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                <span className="font-semibold text-foreground/70">Venta media del sistema:</span>{' '}
                <span className="font-semibold text-foreground/80">{vencimiento.productos.venta_media_diaria} un/día</span>
              </p>
            </ProductIdentity>
          </div>
          <button type="button" onClick={onClose} disabled={ocupado} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40" aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-5 pt-4 space-y-3">
          <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${riskViz.rowBg} border ${riskViz.badge.split(' ').find((c) => c.startsWith('border')) ?? 'border-border'}`}>
            <span className="text-xs text-muted-foreground font-medium">Riesgo calculado</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${riskViz.badge}`}>{badge.label}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-muted/50 px-3 py-2"><p className="text-muted-foreground">Ventana comercial</p><p className="font-semibold mt-0.5">{metricas.dias_comerciales_restantes} días</p></div>
            <div className="rounded-lg bg-muted/50 px-3 py-2"><p className="text-muted-foreground">Velocidad necesaria</p><p className="font-semibold mt-0.5">{fmtVelocidad(metricas.velocidad_necesaria)}</p></div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <Campo label="Stock total del sistema" htmlFor="ev-stock"><input id="ev-stock" type="number" min={0} value={stockActual} onChange={(e) => setStockActual(Number(e.target.value))} className={inputCls} /></Campo>
          <Campo label="Fecha de vencimiento" htmlFor="ev-fecha"><input id="ev-fecha" type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className={inputCls} /></Campo>
          <Campo label="Cantidad comprometida observada hoy" htmlFor="ev-cantidad">
            <input id="ev-cantidad" type="number" min={0} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} className={inputCls} />
            <p className="text-[11px] text-muted-foreground mt-1">Si llega a 0, Noven te pedirá confirmar el cierre como vendido.</p>
          </Campo>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <Tags className="h-4 w-4 text-slate-700" />
              <div>
                <p className="text-xs font-bold">Intervenciones</p>
                <p className="text-[11px] text-muted-foreground">Informá sólo lo que está aplicado en góndola.</p>
              </div>
            </div>

            {(puedeGestionarRag || seguimientoRag?.rag_porcentaje != null || solicitudCambioRag != null) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-3">
              <div className="flex items-center gap-2"><Percent className="h-4 w-4 text-amber-700" /><div><p className="text-xs font-bold">RAG · Retiro Anticipado de Góndola</p><p className="text-[11px] text-muted-foreground">El porcentaje se define por escala y se ejecuta de forma centralizada.</p></div></div>
              {cargandoRag ? <p className="text-[11px] text-muted-foreground">Cargando seguimiento…</p> : seguimientoRag?.rag_porcentaje != null ? (
                <div className="rounded-lg bg-white/80 border border-amber-100 p-3 text-[11px]">
                  <div className="flex items-center gap-1.5 font-semibold"><Activity className="h-3.5 w-3.5 text-amber-700" />{RAG_ESTADO_LABEL[seguimientoRag.estado_seguimiento_rag]}</div>
                  <div className="grid grid-cols-2 gap-1 mt-2 text-muted-foreground"><span>RAG vigente</span><span className="text-right font-medium text-foreground">{seguimientoRag.rag_porcentaje}%</span><span>Vel. observada</span><span className="text-right font-medium text-foreground">{fmtVelocidad(seguimientoRag.velocidad_observada)}</span>
                    {muestraDetalleCobertura && (<>
                      <span>Vel. necesaria</span><span className="text-right font-medium text-foreground">{fmtVelocidad(seguimientoRag.velocidad_necesaria)}</span>
                      <span>Cobertura</span><span className="text-right font-medium text-foreground">{coberturaComoPorcentaje(sugerencia?.cobertura ?? null)}</span>
                      <span>Días comerciales</span><span className="text-right font-medium text-foreground">{seguimientoRag.dias_comerciales_restantes}</span>
                    </>)}
                  </div>
                  {sugerencia?.motivo === 'tope_de_escala' && (
                    <div className="mt-2.5 rounded-lg border border-amber-300 bg-amber-100/70 p-2.5">
                      <p className="font-bold text-[11px]">Sin escalón superior</p>
                      <p className="text-[11px] mt-0.5">
                        El RAG ya está en {seguimientoRag?.rag_porcentaje}%, el máximo de la escala.
                        No hay más margen de descuento para sugerir.
                      </p>
                    </div>
                  )}
                  {sugerencia?.hay && (
                    <div className="mt-2.5 rounded-lg border border-amber-300 bg-amber-100/70 p-2.5">
                      <p className="font-bold text-[11px]">Sugerencia por urgencia</p>
                      <p className="text-[11px] mt-0.5">
                        <span className="font-semibold">{sugerencia.desde}% → {sugerencia.hasta}%</span>
                        {sugerencia.sinMovimiento
                          ? ' · sin movimiento observado'
                          : sugerencia.factorRequerido != null && ` · hace falta multiplicar la salida por ${sugerencia.factorRequerido.toLocaleString('es-AR', { maximumFractionDigits: 1 })}`}
                      </p>
                      {sugerencia.topeInsuficiente ? (
                        <p className="text-[10px] mt-1 text-amber-900/90">
                          Es el tope de la escala autorizada y aun así puede no alcanzar en los días que quedan.
                        </p>
                      ) : sugerencia.saltoPuedeNoAlcanzar && (
                        <p className="text-[10px] mt-1 text-amber-900/90">
                          El déficit es grande: este escalón probablemente no alcance en los días que quedan.
                          Si no responde, el próximo control vuelve a sugerir.
                        </p>
                      )}
                      {cargandoSolicitudRag ? (
                        <p className="mt-2 text-[10px] text-amber-900/80">Consultando estado de la solicitud…</p>
                      ) : solicitudCambioRag && solicitudCambioRag.estado_actual !== 'confirmada' ? (
                        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-white/80 p-2.5">
                          <Clock3 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[11px] font-bold">{SOLICITUD_RAG_LABEL[solicitudCambioRag.estado_actual]}</p>
                            <p className="text-[10px] text-amber-900/80">Cambio solicitado: {solicitudCambioRag.porcentaje_rag_vigente}% → {solicitudCambioRag.porcentaje_solicitado}%</p>
                          </div>
                        </div>
                      ) : puedeValidarSugerencia && circuitoRagDisponible ? (
                        <button
                          type="button"
                          onClick={() => void handleSolicitarCambioRag()}
                          disabled={ocupado}
                          className="mt-2 w-full h-8 rounded-lg border border-amber-400 bg-white text-amber-900 font-semibold text-[11px] disabled:opacity-50"
                        >
                          {solicitandoRag ? 'Informando…' : `Informar ${sugerencia.hasta}%`}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="mt-2 w-full h-8 rounded-lg border border-amber-300 bg-white/70 text-amber-900 font-semibold text-[11px] opacity-70"
                        >
                          Requiere gerente o supervisor
                        </button>
                      )}
                      <p className="text-[10px] mt-1.5 text-amber-900/80">
                        Es una sugerencia por urgencia, no un porcentaje óptimo. Informarla crea una solicitud;
                        no modifica el precio ni inicia la medición.
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmarFinalizarRag(true)}
                    disabled={ocupado}
                    className="mt-3 w-full h-9 flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold text-xs disabled:opacity-50"
                  >
                    <CircleOff className="h-3.5 w-3.5" />Finalizar RAG vigente
                  </button>
                </div>
              ) : (
                /*
                 * El hueco que esto cierra: antes acá sólo decía "Todavía no hay
                 * un RAG registrado" y no había forma de registrar el primero.
                 * Sin intervención no hay tramo, y sin tramo el motor no mide.
                 *
                 * Es el camino diario, así que son dos gestos: elegir el
                 * porcentaje que ya está en góndola y confirmarlo. No hay
                 * selector de tipo antes del número ni un paso entre el número y
                 * el informe.
                 */
                <div className="rounded-lg bg-white/80 border border-amber-100 p-3 space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Todavía no hay un RAG registrado. Si la góndola ya tiene uno, informalo:
                    hasta entonces el producto queda fuera del seguimiento.
                  </p>
                  <div className="flex gap-2">
                    <select
                      value={seleccionRagInformado}
                      onChange={(e) => setSeleccionRagInformado(e.target.value)}
                      className={`${inputCls} flex-1`}
                    >
                      <option value="">RAG en góndola…</option>
                      {escalaRag.map((escalon) => (
                        <option key={escalon.escalon} value={String(escalon.porcentaje)}>
                          {escalon.porcentaje}%
                        </option>
                      ))}
                      <option value="otro">Otro porcentaje…</option>
                    </select>
                    {seleccionRagInformado === 'otro' && (
                      <input
                        type="number"
                        min={1}
                        max={100}
                        inputMode="numeric"
                        value={porcentajeRagFueraEscala}
                        onChange={(e) => setPorcentajeRagFueraEscala(e.target.value)}
                        placeholder="%"
                        className={`${inputCls} w-24`}
                      />
                    )}
                  </div>
                  {seleccionRagInformado === 'otro' && (
                    <p className="text-[10px] text-amber-900/80">
                      Fuera de la escala autorizada. Se registra igual, porque ya está en góndola:
                      queda marcado como fuera de escala y no entra en los promedios.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleInformarRag()}
                    disabled={ocupado || porcentajeRagAInformar() == null}
                    className="w-full h-9 flex items-center justify-center gap-2 rounded-lg border border-amber-400 bg-white text-amber-900 font-semibold text-xs disabled:opacity-50"
                  >
                    <Percent className="h-3.5 w-3.5" />
                    {informandoRag ? 'Informando…' : 'Informar RAG'}
                  </button>
                </div>
              )}
              {!cargandoSolicitudRag && solicitudCambioRag && solicitudCambioRag.estado_actual === 'confirmada' && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-800">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-semibold">{SOLICITUD_RAG_LABEL.confirmada}: {solicitudCambioRag.porcentaje_solicitado}%</p>
                </div>
              )}
              {errorSolicitudRag && (
                <p className="text-[10px] text-red-600">No se pudo consultar la solicitud: {errorSolicitudRag}</p>
              )}
            </div>
            )}

            <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <Tags className="h-4 w-4 text-sky-700" />
                <div className="flex-1">
                  <p className="text-xs font-bold">Oferta central</p>
                  <p className="text-[11px] text-muted-foreground">
                    {seguimientoRag?.hay_oferta_central
                      ? 'Informada como activa en góndola.'
                      : 'No informada en NoVen.'}
                  </p>
                </div>
                {seguimientoRag?.hay_oferta_central && (
                  <span className="text-[10px] font-semibold rounded-full border border-sky-200 bg-white px-2 py-0.5 text-sky-700">Activa</span>
                )}
              </div>
              <input
                type="text"
                value={notaOfertaCentral}
                onChange={(e) => setNotaOfertaCentral(e.target.value)}
                placeholder="Detalle opcional, ej. 2x1"
                className={inputCls}
              />
              {seguimientoRag?.hay_oferta_central ? (
                <button
                  type="button"
                  onClick={() => setConfirmarFinalizarOferta(true)}
                  disabled={ocupado}
                  className="w-full h-9 flex items-center justify-center gap-2 rounded-lg border border-sky-300 bg-white text-sky-800 font-semibold text-xs disabled:opacity-50"
                >
                  <CircleOff className="h-3.5 w-3.5" />Finalizar oferta central
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleInformarOfertaCentral()}
                  disabled={ocupado}
                  className="w-full h-9 flex items-center justify-center gap-2 rounded-lg border border-sky-400 bg-white text-sky-800 font-semibold text-xs disabled:opacity-50"
                >
                  <Tags className="h-3.5 w-3.5" />
                  {gestionandoOfertaCentral ? 'Informando…' : 'Informar oferta central'}
                </button>
              )}
            </div>

            {seguimientoRag != null && seguimientoRag.intervenciones_abiertas > 1 && (
              <p className="text-[10px] text-slate-600">
                RAG y oferta central conviven. La salida observada es combinada y no se atribuye a una sola intervención.
              </p>
            )}
          </div>

          {error && <div className="flex gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5"><AlertTriangle className="h-4 w-4 text-red-500 shrink-0" /><p className="text-red-600 text-xs">{error}</p></div>}
        </div>

        <div className="px-5 pb-5 space-y-2">
          <button type="button" onClick={() => void handleGuardar()} disabled={ocupado} className="w-full h-11 flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-lg shadow-brand disabled:opacity-50">
            {guardando ? 'Guardando…' : <><Save className="h-4 w-4" />Registrar control</>}
          </button>

          <button type="button" onClick={() => setConfirmarVendido(true)} disabled={ocupado} className="w-full h-11 flex items-center justify-center gap-2 border border-emerald-300 bg-emerald-50 text-emerald-700 font-semibold text-sm rounded-lg disabled:opacity-50">
            <CheckCircle className="h-4 w-4" />Marcar como vendido
          </button>

          {!confirmarAnulacion ? (
            <button type="button" onClick={() => setConfirmarAnulacion(true)} disabled={ocupado} className="w-full h-11 flex items-center justify-center gap-2 border border-red-200 text-red-600 font-medium text-sm rounded-lg disabled:opacity-50"><Trash2 className="h-4 w-4" />Eliminar carga incorrecta</button>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
              <p className="text-xs text-red-800 text-center">Se anulará la carga, pero quedará evidencia de la corrección.</p>
              <div className="flex gap-2"><button type="button" onClick={() => setConfirmarAnulacion(false)} className="flex-1 h-10 rounded-lg bg-white border border-border text-sm">Cancelar</button><button type="button" onClick={() => void handleAnular()} disabled={anulando} className="flex-1 h-10 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50">{anulando ? 'Anulando…' : 'Sí, anular'}</button></div>
            </div>
          )}
        </div>
      </div>

      {confirmarVendido && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-[24px] shadow-2xl p-5 space-y-4">
            <div><p className="font-bold text-foreground">Confirmar vendido</p><p className="text-sm text-muted-foreground mt-1">El vencimiento saldrá de activos y quedará registrado como resuelto por venta antes del vencimiento.</p></div>
            <div className="flex gap-2"><button type="button" onClick={() => setConfirmarVendido(false)} disabled={cerrandoVendido} className="flex-1 h-11 rounded-xl border border-border text-sm font-medium">Cancelar</button><button type="button" onClick={() => void handleCerrarVendido()} disabled={cerrandoVendido} className="flex-1 h-11 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50">{cerrandoVendido ? 'Cerrando…' : 'Confirmar vendido'}</button></div>
          </div>
        </div>
      )}

      {confirmarFinalizarRag && seguimientoRag?.rag_porcentaje != null && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-[24px] shadow-2xl p-5 space-y-4">
            <div>
              <p className="font-bold text-foreground">Finalizar RAG {seguimientoRag.rag_porcentaje}%</p>
              <p className="text-sm text-muted-foreground mt-1">El producto seguirá en Radar/Urgente si mantiene riesgo. Sólo se cerrará esta intervención RAG.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="rag-motivo-finalizacion" className="block text-xs font-semibold text-foreground uppercase tracking-wide">Motivo</label>
              <select
                id="rag-motivo-finalizacion"
                value={motivoFinalizacionRag}
                onChange={(e) => setMotivoFinalizacionRag(e.target.value as MotivoFinalizacionRag)}
                className={inputCls}
              >
                <option value="decision_comercial">Decisión comercial</option>
                <option value="otro">Otro motivo</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="rag-nota-finalizacion" className="block text-xs font-semibold text-foreground uppercase tracking-wide">Detalle opcional</label>
              <input
                id="rag-nota-finalizacion"
                type="text"
                value={notaFinalizacionRag}
                onChange={(e) => setNotaFinalizacionRag(e.target.value)}
                placeholder="Detalle del motivo"
                className={inputCls}
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmarFinalizarRag(false)} disabled={finalizandoRag} className="flex-1 h-11 rounded-xl border border-border text-sm font-medium">Cancelar</button>
              <button type="button" onClick={() => void handleFinalizarRag()} disabled={finalizandoRag} className="flex-1 h-11 rounded-xl bg-slate-800 text-white text-sm font-bold disabled:opacity-50">{finalizandoRag ? 'Finalizando…' : 'Finalizar RAG'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmarFinalizarOferta && seguimientoRag?.hay_oferta_central && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-[24px] shadow-2xl p-5 space-y-4">
            <div>
              <p className="font-bold text-foreground">Finalizar oferta central</p>
              <p className="text-sm text-muted-foreground mt-1">
                Sólo se cerrará la oferta central. El RAG seguirá vigente si está activo.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmarFinalizarOferta(false)} disabled={gestionandoOfertaCentral} className="flex-1 h-11 rounded-xl border border-border text-sm font-medium">Cancelar</button>
              <button type="button" onClick={() => void handleFinalizarOfertaCentral()} disabled={gestionandoOfertaCentral} className="flex-1 h-11 rounded-xl bg-sky-700 text-white text-sm font-bold disabled:opacity-50">{gestionandoOfertaCentral ? 'Finalizando…' : 'Finalizar oferta'}</button>
            </div>
          </div>
        </div>
      )}

      {salidaPendiente && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-[24px] shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-violet-50 p-2 text-violet-700"><ArrowRightLeft className="h-5 w-5" /></div>
              <div>
                <p className="font-bold text-foreground">¿Qué pasó con {salidaPendiente.bajada.toLocaleString('es-AR')} unidades?</p>
                <p className="text-sm text-muted-foreground mt-1">Marcá si salieron por venta o por otra causa. NoVen descuenta las transferencias de la venta medida.</p>
              </div>
            </div>
            {error && (
              <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
            <div className="space-y-2">
              {CAUSAS_NO_VENTA.map((causa) => (
                <button
                  key={causa.valor}
                  type="button"
                  onClick={() => void handleDeclararSalida(causa.valor)}
                  disabled={declarandoSalida}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 disabled:opacity-50"
                >
                  {causa.etiqueta}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Campo({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label htmlFor={htmlFor} className="block text-xs font-semibold text-foreground uppercase tracking-wide">{label}</label>{children}</div>
}
