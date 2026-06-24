import { useState, useRef, useEffect } from 'react'
import { ScanLine, Search, CheckCircle, Package, Barcode, ChevronLeft, ShieldAlert, AlertCircle } from 'lucide-react'
import { useScanner } from '@/hooks/useScanner'
import { useAuth } from '@/hooks/useAuth'
import { useUsuarioFamilias } from '@/hooks/useUsuarioFamilias'
import { useSucursalActual } from '@/hooks/useSucursalActual'
import { supabase } from '@/lib/supabase'
import ScannerModal from '@/components/scanner/ScannerModal'
import ProductoConfirm from '@/components/scanner/ProductoConfirm'
import VencimientoForm from '@/components/scanner/VencimientoForm'
import type { VencimientoExistente } from '@/components/scanner/VencimientoForm'
import { calcularDiasRestantes, calcularNivelRiesgo } from '@/lib/riesgo'
import { RISK_VISUAL } from '@/lib/risk-config'
import type { Producto, Familia } from '@/types/index'

type Paso = 'inicio' | 'confirmando' | 'capturar_ean' | 'completar_cod_art' | 'vencimiento_existente' | 'formulario' | 'exito' | 'nuevo_producto' | 'familia_bloqueada'
type CategoriaProducto = 'CHOCOLATES' | 'CARAMELOS' | 'SNACKS' | 'CHICLES' | 'CEREALES' | 'OTRO'
const CATEGORIAS: CategoriaProducto[] = ['CHOCOLATES', 'CARAMELOS', 'SNACKS', 'CHICLES', 'CEREALES', 'OTRO']

const inputCls = 'w-full h-12 px-4 bg-surface-base border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all duration-150 text-sm'

export default function Scanner() {
  const { scanBarcode, scanning, error: scanError, reset } = useScanner()
  const { user } = useAuth()
  const { esAdmin, familiaIds, loading: famLoading } = useUsuarioFamilias()
  const { sucursalId } = useSucursalActual()

  const [paso, setPaso] = useState<Paso>('inicio')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [modalEanAbierto, setModalEanAbierto] = useState(false)
  const [codigoManual, setCodigoManual] = useState('')
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
  const [productoEncontrado, setProductoEncontrado] = useState<Producto | null>(null)
  const [, setEncontradoPorCodArt] = useState(false)
  const [, setGuardadoExitoso] = useState(false)

  // Vencimiento activo existente del producto (regla: máximo 1 por producto/sucursal)
  const [vencimientoExistente, setVencimientoExistente] = useState<VencimientoExistente | null>(null)

  const [guardandoEan, setGuardandoEan] = useState(false)
  const [errorEan, setErrorEan] = useState<string | null>(null)

  const [nuevoProductoCodArt, setNuevoProductoCodArt] = useState('')
  const [nuevoProductoEan, setNuevoProductoEan] = useState('')
  const [nuevoProductoDesc, setNuevoProductoDesc] = useState('')
  const [nuevoProductoMarca, setNuevoProductoMarca] = useState('')
  const [nuevoProductoCategoria, setNuevoProductoCategoria] = useState<CategoriaProducto>('OTRO')
  const [nuevoProductoStock, setNuevoProductoStock] = useState(0)
  const [nuevoProductoVenta, setNuevoProductoVenta] = useState(0)
  const [nuevoProductoFamiliaId, setNuevoProductoFamiliaId] = useState<string>('')
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null)
  const [modalEanNuevoAbierto, setModalEanNuevoAbierto] = useState(false)

  // Errores inline de validación en tiempo real
  const [errorCodArt, setErrorCodArt] = useState<string | null>(null)
  const [errorEanNuevo, setErrorEanNuevo] = useState<string | null>(null)

  // Estado para completar cod_art faltante (Caso 2 — tipeo manual de 7 dígitos)
  const [codArtCompletando, setCodArtCompletando] = useState('')
  const [guardandoCodArt, setGuardandoCodArt] = useState(false)
  const [errorCodArtCompletando, setErrorCodArtCompletando] = useState<string | null>(null)

  // Nombres de familias para mostrar en mensajes y selector
  const [familiasUsuario, setFamiliasUsuario] = useState<Familia[]>([])

  const inputManualRef = useRef<HTMLInputElement>(null)

  // Cargar datos de las familias del usuario para mostrar nombres
  useEffect(() => {
    if (famLoading || familiaIds.length === 0) return
    supabase
      .from('familias')
      .select('id, nombre, codigo, sector_id')
      .in('id', familiaIds)
      .then(({ data }) => {
        if (data) setFamiliasUsuario(data as Familia[])
      })
  }, [familiaIds, famLoading])

  // Inicializar familia seleccionada para nuevo producto cuando carguen las familias
  useEffect(() => {
    if (familiaIds.length > 0 && !nuevoProductoFamiliaId) {
      setNuevoProductoFamiliaId(familiaIds[0])
    }
  }, [familiaIds, nuevoProductoFamiliaId])

  function verificarFamiliaProducto(producto: Producto): boolean {
    if (esAdmin) return true
    if (!producto.familia_id) return false
    return familiaIds.includes(producto.familia_id)
  }

  async function buscarProducto(codigo: string, esBarcode: boolean): Promise<void> {
    setErrorBusqueda(null)
    const resultado = await scanBarcode(codigo)
    if (resultado) {
      // Verificar si el producto pertenece a las familias del usuario
      if (!verificarFamiliaProducto(resultado)) {
        setProductoEncontrado(resultado)
        setPaso('familia_bloqueada')
        return
      }
      setProductoEncontrado(resultado)
      const fueBarcode = esBarcode || resultado.codigo_barras === codigo.trim()
      setEncontradoPorCodArt(!fueBarcode)

      // Regla de negocio: máximo 1 vencimiento activo por producto/sucursal.
      // Si ya existe, el flujo será actualizar ese registro en lugar de crear un duplicado.
      // Usamos limit(1) (no maybeSingle) para tolerar duplicados legacy y tomar el más reciente.
      const { data: vencData } = await supabase
        .from('vencimientos')
        .select('id, cantidad, fecha_vencimiento, lote')
        .eq('producto_id', resultado.id)
        .eq('sucursal_id', sucursalId)
        .eq('activo', true)
        .order('fecha_carga', { ascending: false })
        .limit(1)
      setVencimientoExistente((vencData?.[0] as VencimientoExistente | undefined) ?? null)

      setPaso('confirmando')
    } else if (!scanError) {
      const codigoTrim = codigo.trim()
      if (/^\d{13}$/.test(codigoTrim)) {
        // Es un EAN de 13 dígitos → precargar campo EAN, no cod_art
        setNuevoProductoEan(codigoTrim)
        setNuevoProductoCodArt('')
      } else if (/^\d{7}$/.test(codigoTrim)) {
        // Es un código interno de 7 dígitos → precargar cod_art
        setNuevoProductoCodArt(codigoTrim)
        setNuevoProductoEan('')
      } else {
        // Formato desconocido → dejar ambos vacíos
        setNuevoProductoCodArt('')
        setNuevoProductoEan('')
      }
      setErrorBusqueda('no_encontrado')
    }
  }

  function handleScanFromCamera(codigo: string): void {
    setModalAbierto(false)
    void buscarProducto(codigo, true)
  }

  function handleBuscarManual(): void {
    const codigo = codigoManual.trim()
    if (!codigo) { setErrorBusqueda('Ingresá un código para buscar.'); return }
    void buscarProducto(codigo, false)
  }

  // Decide el siguiente paso según qué datos le falten al producto.
  // Encadena: EAN faltante (Caso 1) → cod_art faltante (Caso 2) → formulario.
  function continuarDesdeProducto(p: Producto): void {
    if (!p.codigo_barras) { setPaso('capturar_ean'); return }
    if (!p.cod_art || p.cod_art.trim() === '') { setPaso('completar_cod_art'); return }
    // Si el producto ya tiene un vencimiento activo, mostrar ese registro (actualizar, no duplicar)
    if (vencimientoExistente) { setPaso('vencimiento_existente'); return }
    setPaso('formulario')
  }

  function handleConfirmarProducto(): void {
    if (!productoEncontrado) return
    continuarDesdeProducto(productoEncontrado)
  }

  function resetNuevoProducto(): void {
    setNuevoProductoCodArt('')
    setNuevoProductoEan('')
    setNuevoProductoDesc('')
    setNuevoProductoMarca('')
    setNuevoProductoCategoria('OTRO')
    setNuevoProductoStock(0)
    setNuevoProductoVenta(0)
    setNuevoProductoFamiliaId(familiaIds[0] ?? '')
    setErrorNuevo(null)
    setErrorCodArt(null)
    setErrorEanNuevo(null)
  }

  function handleCancelarConfirmacion(): void {
    setProductoEncontrado(null)
    setEncontradoPorCodArt(false)
    setVencimientoExistente(null)
    reset()
    setPaso('inicio')
    setCodigoManual('')
    setErrorBusqueda(null)
    setErrorEan(null)
    setCodArtCompletando('')
    setErrorCodArtCompletando(null)
    resetNuevoProducto()
  }

  // Validaciones en tiempo real
  function handleCodArtChange(valor: string): void {
    // Solo permitir dígitos
    const soloDigitos = valor.replace(/\D/g, '').slice(0, 7)
    setNuevoProductoCodArt(soloDigitos)
    if (soloDigitos.length === 0) {
      setErrorCodArt(null)
    } else if (soloDigitos.length !== 7) {
      setErrorCodArt('El código interno debe tener exactamente 7 dígitos')
    } else {
      setErrorCodArt(null)
    }
  }

  function handleEanNuevoCapturado(ean: string): void {
    setModalEanNuevoAbierto(false)
    const soloDigitos = ean.replace(/\D/g, '').slice(0, 13)
    setNuevoProductoEan(soloDigitos)
    if (soloDigitos.length !== 13) {
      setErrorEanNuevo('El EAN debe tener exactamente 13 dígitos')
    } else {
      setErrorEanNuevo(null)
    }
  }

  function codArtValido(): boolean { return /^\d{7}$/.test(nuevoProductoCodArt) }
  function eanNuevoValido(): boolean { return /^\d{13}$/.test(nuevoProductoEan) }

  function handleGuardadoExitoso(): void {
    setGuardadoExitoso(true)
    setPaso('exito')
    setTimeout(() => {
      setProductoEncontrado(null)
      setCodigoManual('')
      setErrorBusqueda(null)
      setGuardadoExitoso(false)
      setEncontradoPorCodArt(false)
      setVencimientoExistente(null)
      setErrorEan(null)
      reset()
      setPaso('inicio')
    }, 2000)
  }

  async function handleEanCapturado(ean: string): Promise<void> {
    setModalEanAbierto(false)
    if (!productoEncontrado) return
    setGuardandoEan(true)
    setErrorEan(null)
    const { data: duplicado, error: errCheck } = await supabase
      .from('productos').select('id').eq('codigo_barras', ean.trim()).neq('id', productoEncontrado.id).maybeSingle()
    if (errCheck) { setGuardandoEan(false); setErrorEan(`Error al verificar: ${errCheck.message}`); return }
    if (duplicado) { setGuardandoEan(false); setErrorEan('Este código ya está registrado en otro producto.'); return }
    const { error: errUpdate } = await supabase
      .from('productos').update({ codigo_barras: ean.trim(), updated_at: new Date().toISOString() }).eq('id', productoEncontrado.id)
    setGuardandoEan(false)
    if (errUpdate) { setErrorEan(`Error al guardar: ${errUpdate.message}`); return }
    const actualizado: Producto = { ...productoEncontrado, codigo_barras: ean.trim() }
    setProductoEncontrado(actualizado)
    continuarDesdeProducto(actualizado)
  }

  async function handleAgregarNuevoProducto(): Promise<void> {
    // Validaciones de formato
    if (!codArtValido()) {
      setErrorCodArt('El código interno debe tener exactamente 7 dígitos')
      setErrorNuevo('Corregí los errores antes de continuar.')
      return
    }
    if (!eanNuevoValido()) {
      setErrorEanNuevo('El EAN debe tener exactamente 13 dígitos')
      setErrorNuevo('Corregí los errores antes de continuar.')
      return
    }
    if (!nuevoProductoDesc.trim()) { setErrorNuevo('La descripción es obligatoria.'); return }

    // Validar que se seleccionó familia (solo para no-admin)
    const familiaIdParaInsertar = esAdmin ? (nuevoProductoFamiliaId || null) : (nuevoProductoFamiliaId || familiaIds[0] || null)
    if (!esAdmin && !familiaIdParaInsertar) {
      setErrorNuevo('No tenés familias asignadas. Contactá al administrador.')
      return
    }

    setErrorNuevo(null)
    setGuardandoNuevo(true)

    // Verificar duplicado cod_art
    const { data: dupCodArt } = await supabase
      .from('productos')
      .select('id')
      .eq('cod_art', nuevoProductoCodArt.trim())
      .maybeSingle()
    if (dupCodArt) {
      setGuardandoNuevo(false)
      setErrorNuevo('Este código interno ya existe. Buscalo en el scanner.')
      return
    }

    // Verificar duplicado EAN
    const { data: dupEan } = await supabase
      .from('productos')
      .select('id')
      .eq('codigo_barras', nuevoProductoEan.trim())
      .maybeSingle()
    if (dupEan) {
      setGuardandoNuevo(false)
      setErrorNuevo('Este EAN ya está registrado en otro producto.')
      return
    }

    const { data, error } = await supabase
      .from('productos')
      .insert({
        cod_art: nuevoProductoCodArt.trim(),
        codigo_barras: nuevoProductoEan.trim(),
        descripcion: nuevoProductoDesc.trim(),
        marca: nuevoProductoMarca.trim() || null,
        categoria: nuevoProductoCategoria,
        stock_actual: nuevoProductoStock,
        venta_media_diaria: nuevoProductoVenta,
        familia_id: familiaIdParaInsertar,
        activo: true,
      })
      .select().single()
    setGuardandoNuevo(false)
    if (error) { setErrorNuevo(`Error al agregar: ${error.message}`); return }
    if (data) { setProductoEncontrado(data as Producto); setErrorBusqueda(null); setPaso('formulario') }
  }

  // ── Pantalla bloqueada por familia ─────────────────────────────────────────
  if (paso === 'familia_bloqueada' && productoEncontrado) {
    const nombresFamilias = familiasUsuario.map((f) => f.nombre).join(', ')
    return (
      <div className="min-h-screen bg-surface-base flex flex-col">
        <SubHeader paso={1} titulo="Producto fuera de tu sector" subtitulo="Este producto no pertenece a tu sector" onBack={handleCancelarConfirmacion} />
        <div className="flex-1 flex flex-col px-4 pb-nav pt-6 gap-5">
          {/* Icono de advertencia */}
          <div className="flex flex-col items-center gap-3 text-center py-4">
            <div className="p-4 bg-amber-50 rounded-full">
              <ShieldAlert className="h-12 w-12 text-amber-500" />
            </div>
          </div>

          {/* Info del producto bloqueado */}
          <div className="bg-white rounded-card shadow-card px-4 py-3.5">
            <p className="text-xs text-muted-foreground mb-0.5">Producto escaneado</p>
            <p className="text-foreground font-bold text-base leading-tight">{productoEncontrado.descripcion}</p>
            {productoEncontrado.marca && <p className="text-muted-foreground text-sm mt-0.5">{productoEncontrado.marca}</p>}
          </div>

          {/* Mensaje de restricción */}
          <div className="bg-amber-50 border border-amber-200 rounded-card p-4 flex gap-3 items-start">
            <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-800 font-semibold text-sm">Este producto no pertenece a tu sector</p>
              <p className="text-amber-700 text-sm mt-1">
                Solo podés cargar productos de:{' '}
                <span className="font-semibold">
                  {nombresFamilias || 'tus familias asignadas'}
                </span>
              </p>
            </div>
          </div>

          {/* Botón para volver a escanear */}
          <button
            type="button"
            onClick={handleCancelarConfirmacion}
            className="w-full min-h-[56px] flex items-center justify-center gap-3 bg-brand hover:bg-brand-hover text-white font-bold text-base rounded-card shadow-brand transition-all duration-150 active:scale-[0.98]"
          >
            <ScanLine className="h-5 w-5" />
            Escanear otro
          </button>
        </div>
      </div>
    )
  }

  // ── Pantalla éxito ──────────────────────────────────────────────────────────
  if (paso === 'exito') {
    return (
      <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center px-4 gap-6 animate-scale-in">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="p-5 bg-emerald-50 rounded-full">
            <CheckCircle className="h-16 w-16 text-emerald-500" />
          </div>
          <h2 className="text-foreground text-2xl font-bold">¡Guardado!</h2>
          <p className="text-muted-foreground text-base">{productoEncontrado?.descripcion}</p>
          <p className="text-muted-foreground/60 text-sm">Volviendo al scanner...</p>
        </div>
      </div>
    )
  }

  // ── Registro existente (actualizar, no duplicar) ────────────────────────────
  if (paso === 'vencimiento_existente' && productoEncontrado && vencimientoExistente) {
    const diasRestantes = calcularDiasRestantes(vencimientoExistente.fecha_vencimiento)
    const nivel = calcularNivelRiesgo(diasRestantes, vencimientoExistente.cantidad, productoEncontrado.venta_media_diaria)
    const viz = RISK_VISUAL[nivel]
    const [y, m, d] = vencimientoExistente.fecha_vencimiento.slice(0, 10).split('-')
    const fechaFmt = `${d}/${m}/${y}`
    return (
      <div className="min-h-screen bg-surface-base flex flex-col">
        <SubHeader paso={2} titulo="Registro existente" subtitulo="Este producto ya tiene un vencimiento cargado" onBack={handleCancelarConfirmacion} />
        <div className="flex-1 overflow-y-auto px-4 pb-nav pt-4 flex flex-col gap-4">
          {/* Producto */}
          <div className="bg-white rounded-card shadow-card p-4 flex gap-3 items-center">
            <div className="h-16 w-16 rounded-xl bg-muted overflow-hidden shrink-0 flex items-center justify-center">
              {productoEncontrado.imagen_url ? (
                <img src={productoEncontrado.imagen_url} alt={productoEncontrado.descripcion} className="h-full w-full object-cover" />
              ) : (
                <Package className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-foreground font-bold text-base leading-tight">{productoEncontrado.descripcion}</p>
              {productoEncontrado.marca && <p className="text-muted-foreground text-sm mt-0.5">{productoEncontrado.marca}</p>}
            </div>
          </div>

          {/* Datos actuales del vencimiento */}
          <div className="bg-white rounded-card shadow-card p-4 flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vencimiento actual</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Fecha de vencimiento</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">{fechaFmt}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cantidad</span>
              <span className="text-sm font-semibold text-foreground tabular-nums">{vencimientoExistente.cantidad}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Nivel de riesgo</span>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full leading-tight ${viz.badge}`}>{viz.label.toUpperCase()}</span>
            </div>
          </div>

          {/* Mensaje */}
          <div className="bg-brand-light border border-brand-muted rounded-card p-4 flex gap-3 items-start">
            <AlertCircle className="h-5 w-5 text-brand shrink-0 mt-0.5" />
            <p className="text-brand text-sm">Este producto ya tiene un vencimiento registrado. ¿Querés actualizarlo?</p>
          </div>

          {/* Acciones */}
          <button
            type="button"
            onClick={() => setPaso('formulario')}
            className="w-full min-h-[56px] flex items-center justify-center gap-3 bg-brand hover:bg-brand-hover text-white font-bold text-base rounded-card shadow-brand transition-all duration-150 active:scale-[0.98]"
          >
            <CheckCircle className="h-5 w-5" />
            Actualizar registro
          </button>
          <button type="button" onClick={handleCancelarConfirmacion} className="w-full py-3 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  // ── Formulario (paso 3) ─────────────────────────────────────────────────────
  if (paso === 'formulario' && productoEncontrado) {
    return (
      <div className="min-h-screen bg-surface-base flex flex-col">
        <SubHeader
          paso={3}
          titulo={vencimientoExistente ? 'Actualizar vencimiento' : 'Cargar vencimiento'}
          subtitulo={vencimientoExistente ? 'Editá los datos del vencimiento existente' : 'Completá los datos del vencimiento'}
          onBack={handleCancelarConfirmacion}
        />
        <div className="flex-1 overflow-y-auto px-4 pb-nav pt-4">
          <VencimientoForm
            producto={productoEncontrado}
            sucursalId={sucursalId}
            usuarioId={user?.id ?? ''}
            onSuccess={handleGuardadoExitoso}
            vencimientoExistente={vencimientoExistente}
          />
          <button type="button" onClick={handleCancelarConfirmacion} className="w-full mt-3 py-3 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
            Cancelar y empezar de nuevo
          </button>
        </div>
      </div>
    )
  }

  function handleCodArtCompletandoChange(valor: string): void {
    const soloDigitos = valor.replace(/\D/g, '').slice(0, 7)
    setCodArtCompletando(soloDigitos)
    if (soloDigitos.length > 0 && soloDigitos.length !== 7) {
      setErrorCodArtCompletando('El código interno debe tener exactamente 7 dígitos')
    } else {
      setErrorCodArtCompletando(null)
    }
  }

  async function handleGuardarCodArt(): Promise<void> {
    if (!productoEncontrado) return
    const codigo = codArtCompletando.trim()
    if (!/^\d{7}$/.test(codigo)) {
      setErrorCodArtCompletando('El código interno debe tener exactamente 7 dígitos')
      return
    }
    setGuardandoCodArt(true)
    setErrorCodArtCompletando(null)
    const { data: duplicado, error: errCheck } = await supabase
      .from('productos').select('id').eq('cod_art', codigo).neq('id', productoEncontrado.id).maybeSingle()
    if (errCheck) { setGuardandoCodArt(false); setErrorCodArtCompletando(`Error al verificar: ${errCheck.message}`); return }
    if (duplicado) { setGuardandoCodArt(false); setErrorCodArtCompletando('Este código interno ya está registrado en otro producto.'); return }
    const { error: errUpdate } = await supabase
      .from('productos').update({ cod_art: codigo, updated_at: new Date().toISOString() }).eq('id', productoEncontrado.id)
    setGuardandoCodArt(false)
    if (errUpdate) { setErrorCodArtCompletando(`Error al guardar: ${errUpdate.message}`); return }
    const actualizado: Producto = { ...productoEncontrado, cod_art: codigo }
    setProductoEncontrado(actualizado)
    continuarDesdeProducto(actualizado)
  }

  // ── Capturar EAN (paso 2.5) ─────────────────────────────────────────────────
  if (paso === 'capturar_ean' && productoEncontrado) {
    return (
      <>
        {modalEanAbierto && <ScannerModal onScan={handleEanCapturado} onClose={() => setModalEanAbierto(false)} />}
        <div className="min-h-screen bg-surface-base flex flex-col">
          <SubHeader paso={2} titulo="Registrar EAN del producto" subtitulo="El EAN es necesario para identificar el producto en futuras lecturas" onBack={handleCancelarConfirmacion} />
          <div className="flex-1 overflow-y-auto px-4 pb-nav pt-4 flex flex-col gap-4">
            <div className="bg-white rounded-card shadow-card px-4 py-3.5">
              <p className="text-xs text-muted-foreground mb-0.5">Producto seleccionado</p>
              <p className="text-foreground font-bold text-base leading-tight">{productoEncontrado.descripcion}</p>
              {productoEncontrado.marca && <p className="text-muted-foreground text-sm mt-0.5">{productoEncontrado.marca}</p>}
            </div>
            <div className="bg-brand-light border border-brand-muted rounded-card p-4 flex gap-3 items-start">
              <Barcode className="h-5 w-5 text-brand shrink-0 mt-0.5" />
              <div>
                <p className="text-brand font-semibold text-sm">Este producto no tiene código de barras registrado</p>
                <p className="text-brand/70 text-xs mt-1">Escaneá el EAN para completar los datos. Es necesario para identificar el producto en futuras lecturas.</p>
              </div>
            </div>
            {errorEan && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2 animate-fade-in">
                <Package className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-red-600 text-sm">{errorEan}</p>
              </div>
            )}
            {/* Opción 1: Escanear con cámara */}
            <button
              type="button"
              onClick={() => { setErrorEan(null); setModalEanAbierto(true) }}
              disabled={guardandoEan}
              className="w-full min-h-[56px] flex items-center justify-center gap-3 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-bold text-base rounded-card shadow-brand transition-all duration-150 active:scale-[0.98]"
            >
              {guardandoEan ? (
                <><span className="h-5 w-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</>
              ) : (
                <><ScanLine className="h-5 w-5" />Escanear EAN</>
              )}
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Completar cod_art faltante (Caso 2) ─────────────────────────────────────
  if (paso === 'completar_cod_art' && productoEncontrado) {
    const codArtListo = /^\d{7}$/.test(codArtCompletando)
    return (
      <div className="min-h-screen bg-surface-base flex flex-col">
        <SubHeader paso={2} titulo="Registrar código interno" subtitulo="El código de Glaciar es necesario para identificar el producto" onBack={handleCancelarConfirmacion} />
        <div className="flex-1 overflow-y-auto px-4 pb-nav pt-4 flex flex-col gap-4">
          <div className="bg-white rounded-card shadow-card px-4 py-3.5">
            <p className="text-xs text-muted-foreground mb-0.5">Producto seleccionado</p>
            <p className="text-foreground font-bold text-base leading-tight">{productoEncontrado.descripcion}</p>
            {productoEncontrado.marca && <p className="text-muted-foreground text-sm mt-0.5">{productoEncontrado.marca}</p>}
          </div>
          <div className="bg-brand-light border border-brand-muted rounded-card p-4 flex gap-3 items-start">
            <Package className="h-5 w-5 text-brand shrink-0 mt-0.5" />
            <div>
              <p className="text-brand font-semibold text-sm">Este producto no tiene código interno registrado</p>
              <p className="text-brand/70 text-xs mt-1">Ingresá el código de 7 dígitos de Glaciar para completar los datos.</p>
            </div>
          </div>
          {errorCodArtCompletando && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2 animate-fade-in">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-600 text-sm">{errorCodArtCompletando}</p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{7}"
                maxLength={7}
                value={codArtCompletando}
                onChange={(e) => handleCodArtCompletandoChange(e.target.value)}
                placeholder="Ingresá los 7 dígitos del código interno"
                disabled={guardandoCodArt}
                className={`w-full h-12 px-4 bg-surface-base border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all duration-150 text-sm disabled:opacity-50 ${
                  errorCodArtCompletando
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                    : codArtListo
                      ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-200'
                      : 'border-border focus:border-brand focus:ring-brand/20'
                }`}
              />
              {codArtCompletando.length > 0 && (
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold ${codArtListo ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                  {codArtCompletando.length}/7
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleGuardarCodArt()}
              disabled={guardandoCodArt || !codArtListo}
              className="w-full min-h-[56px] flex items-center justify-center gap-3 bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base rounded-card shadow-brand transition-all duration-150 active:scale-[0.98]"
            >
              {guardandoCodArt ? (
                <><span className="h-5 w-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</>
              ) : (
                <><CheckCircle className="h-5 w-5" />Guardar y continuar</>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Confirmar producto (paso 2) ─────────────────────────────────────────────
  if (paso === 'confirmando' && productoEncontrado) {
    return (
      <div className="min-h-screen bg-surface-base flex flex-col">
        <SubHeader paso={2} titulo="Confirmar producto" subtitulo="¿Es este el producto que querés registrar?" onBack={handleCancelarConfirmacion} />
        <div className="flex-1 overflow-y-auto px-4 pb-nav pt-4">
          <ProductoConfirm
            producto={productoEncontrado}
            onConfirm={handleConfirmarProducto}
            onCancel={handleCancelarConfirmacion}
          />
        </div>
      </div>
    )
  }

  // ── Nuevo producto ──────────────────────────────────────────────────────────
  if (paso === 'nuevo_producto') {
    const mostrarSelectorFamilia = !esAdmin && familiasUsuario.length > 1
    const familiaUnica = !esAdmin && familiasUsuario.length === 1 ? familiasUsuario[0] : null

    const codArtTocado = nuevoProductoCodArt.length > 0

    function inputClsValidado(tocado: boolean, valido: boolean, error: string | null): string {
      if (!tocado) return inputCls
      if (error) return inputCls.replace('border-border', 'border-red-400').replace('focus:border-brand', 'focus:border-red-500').replace('focus:ring-brand/20', 'focus:ring-red-200') + ' border-red-400'
      if (valido) return inputCls.replace('border-border', 'border-emerald-400').replace('focus:border-brand', 'focus:border-emerald-500').replace('focus:ring-brand/20', 'focus:ring-emerald-200') + ' border-emerald-400'
      return inputCls
    }

    return (
      <>
        {modalEanNuevoAbierto && <ScannerModal onScan={handleEanNuevoCapturado} onClose={() => setModalEanNuevoAbierto(false)} />}
        <div className="min-h-screen bg-surface-base flex flex-col">
          <SubHeader paso={1} titulo="Agregar producto" subtitulo="Completá los datos del nuevo producto" onBack={handleCancelarConfirmacion} />
          <div className="flex-1 overflow-y-auto px-4 pb-nav pt-4 flex flex-col gap-4">
            {errorNuevo && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2 animate-fade-in">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-red-600 text-sm">{errorNuevo}</p>
              </div>
            )}
            <div className="bg-white rounded-card shadow-card p-4 flex flex-col gap-4">

              {/* Cod. Art. — 7 dígitos exactos */}
              <div className="space-y-1.5">
                <label htmlFor="np-codart" className="block text-xs font-semibold text-foreground uppercase tracking-wide">
                  Cod. Art. <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="np-codart"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{7}"
                    maxLength={7}
                    value={nuevoProductoCodArt}
                    onChange={(e) => handleCodArtChange(e.target.value)}
                    placeholder="Ej: 1234567"
                    className={inputClsValidado(codArtTocado, codArtValido(), errorCodArt)}
                    aria-describedby={errorCodArt ? 'error-codart' : undefined}
                  />
                  {codArtTocado && (
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold ${codArtValido() ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                      {nuevoProductoCodArt.length}/7
                    </span>
                  )}
                </div>
                {errorCodArt && (
                  <p id="error-codart" className="text-red-500 text-xs flex items-center gap-1 animate-fade-in">
                    <AlertCircle className="h-3 w-3 shrink-0" />{errorCodArt}
                  </p>
                )}
              </div>

              {/* EAN — captura SOLO por cámara (13 dígitos) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wide">
                  Código EAN <span className="text-red-500">*</span>
                </label>
                {nuevoProductoEan ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-12 px-4 flex items-center justify-between bg-emerald-50 border border-emerald-400 rounded-lg">
                      <span className="font-mono text-sm text-foreground tracking-wide">{nuevoProductoEan}</span>
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalEanNuevoAbierto(true)}
                      className="h-12 px-3 bg-muted hover:bg-muted/70 rounded-lg text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0"
                      title="Volver a escanear"
                    >
                      <Barcode className="h-4 w-4" />
                      Reescanear
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setModalEanNuevoAbierto(true)}
                    className="w-full min-h-[48px] flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-lg transition-all duration-150 active:scale-[0.98]"
                  >
                    <ScanLine className="h-4 w-4" />
                    Escanear EAN con cámara
                  </button>
                )}
                {errorEanNuevo && (
                  <p id="error-ean" className="text-red-500 text-xs flex items-center gap-1 animate-fade-in">
                    <AlertCircle className="h-3 w-3 shrink-0" />{errorEanNuevo}
                  </p>
                )}
                <p className="text-muted-foreground text-xs">El EAN se captura únicamente con la cámara para garantizar lecturas exactas.</p>
              </div>

              {/* Descripción */}
              <div className="space-y-1.5">
                <label htmlFor="np-desc" className="block text-xs font-semibold text-foreground uppercase tracking-wide">
                  Descripción <span className="text-red-500">*</span>
                </label>
                <input id="np-desc" type="text" value={nuevoProductoDesc} onChange={(e) => setNuevoProductoDesc(e.target.value)} placeholder="Ej: Chocolate con leche 100g" className={inputCls} />
              </div>

              {/* Marca */}
              <div className="space-y-1.5">
                <label htmlFor="np-marca" className="block text-xs font-semibold text-foreground uppercase tracking-wide">Marca (opcional)</label>
                <input id="np-marca" type="text" value={nuevoProductoMarca} onChange={(e) => setNuevoProductoMarca(e.target.value)} placeholder="Ej: Milka" className={inputCls} />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="np-cat" className="block text-xs font-semibold text-foreground uppercase tracking-wide">Categoría</label>
                <select id="np-cat" value={nuevoProductoCategoria} onChange={(e) => setNuevoProductoCategoria(e.target.value as CategoriaProducto)} className={inputCls}>
                  {CATEGORIAS.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="np-stock" className="block text-xs font-semibold text-foreground uppercase tracking-wide">Stock actual</label>
                  <input id="np-stock" type="number" min={0} value={nuevoProductoStock} onChange={(e) => setNuevoProductoStock(Number(e.target.value))} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="np-venta" className="block text-xs font-semibold text-foreground uppercase tracking-wide">Venta/día</label>
                  <input id="np-venta" type="number" min={0} step={0.1} value={nuevoProductoVenta} onChange={(e) => setNuevoProductoVenta(parseFloat(e.target.value) || 0)} className={inputCls} />
                </div>
              </div>

              {/* Selector de familia — solo si el usuario tiene múltiples familias */}
              {mostrarSelectorFamilia && (
                <div className="space-y-1.5">
                  <label htmlFor="np-familia" className="block text-xs font-semibold text-foreground uppercase tracking-wide">Sector / Familia *</label>
                  <select
                    id="np-familia"
                    value={nuevoProductoFamiliaId}
                    onChange={(e) => setNuevoProductoFamiliaId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Seleccioná una familia</option>
                    {familiasUsuario.map((f) => (
                      <option key={f.id} value={f.id}>{f.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Info de familia única — solo lectura */}
              {familiaUnica && (
                <div className="bg-brand-light border border-brand-muted rounded-lg px-3 py-2.5 flex items-center gap-2">
                  <Package className="h-4 w-4 text-brand shrink-0" />
                  <p className="text-brand text-sm">
                    Se va a asignar a tu sector: <span className="font-semibold">{familiaUnica.nombre}</span>
                  </p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleAgregarNuevoProducto()}
              disabled={guardandoNuevo || !codArtValido() || !eanNuevoValido()}
              className="w-full min-h-[56px] flex items-center justify-center gap-3 bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base rounded-card shadow-brand transition-all duration-150 active:scale-[0.98]"
            >
              {guardandoNuevo ? (
                <><span className="h-5 w-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Agregando...</>
              ) : 'Agregar y continuar'}
            </button>
            <button type="button" onClick={handleCancelarConfirmacion} className="w-full py-3 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Pantalla principal — Paso 1: Hero Scanner ───────────────────────────────
  const errorVisible = scanError ?? errorBusqueda

  return (
    <>
      {modalAbierto && <ScannerModal onScan={handleScanFromCamera} onClose={() => setModalAbierto(false)} />}

      <div className="min-h-screen bg-surface-base flex flex-col">
        {/* Header */}
        <div className="px-4 pt-5 pb-4">
          <StepIndicator current={1} total={3} />
          <h1 className="text-foreground text-xl font-bold mt-3 tracking-tight">Registrar vencimiento</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Escaneá o ingresá el código del producto</p>
        </div>

        <div className="flex-1 flex flex-col px-4 pb-nav gap-5">

          {/* ── HERO scan button ── */}
          <button
            type="button"
            onClick={() => { setErrorBusqueda(null); setModalAbierto(true) }}
            disabled={scanning}
            className={[
              'relative overflow-hidden w-full',
              'flex flex-col items-center justify-center gap-5',
              'bg-brand hover:bg-brand-hover',
              'rounded-card py-14',
              'shadow-brand-lg hover:shadow-[0_12px_48px_rgba(13,148,136,0.52)]',
              'transition-all duration-200',
              'active:scale-[0.97] active:shadow-brand',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/40',
            ].join(' ')}
          >
            {/* Decorative rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-52 w-52 rounded-full border-2 border-white/10" />
              <div className="absolute h-36 w-36 rounded-full border border-white/8" />
            </div>

            {/* Icon container */}
            <div className="relative bg-white/20 p-5 rounded-[18px]">
              <ScanLine className="h-12 w-12 text-white" />
            </div>

            {/* Text */}
            <div className="relative text-center px-4">
              <p className="text-white font-bold text-xl tracking-tight">Escanear producto</p>
              <p className="text-white/70 text-sm mt-1">Tocá para abrir la cámara</p>
            </div>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted-foreground text-xs font-medium">o ingresá el código</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Manual input */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                ref={inputManualRef}
                type="text"
                inputMode="numeric"
                value={codigoManual}
                onChange={(e) => { setCodigoManual(e.target.value); setErrorBusqueda(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleBuscarManual() }}
                placeholder="Código de barras o cod. artículo"
                className={`flex-1 ${inputCls}`}
              />
              <button
                type="button"
                onClick={handleBuscarManual}
                disabled={scanning}
                className="h-12 px-4 bg-brand hover:bg-brand-hover disabled:opacity-50 rounded-lg text-white transition-colors flex items-center gap-2 font-semibold text-sm whitespace-nowrap"
              >
                {scanning ? (
                  <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Buscar
              </button>
            </div>

            {/* No encontrado */}
            {errorBusqueda === 'no_encontrado' && (
              <div className="bg-white rounded-card shadow-card p-4 flex flex-col gap-3 animate-fade-in">
                <div className="flex items-start gap-2">
                  <Package className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-foreground text-sm">Producto no encontrado en el sistema. ¿Querés agregarlo al surtido?</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaso('nuevo_producto')}
                  className="w-full py-2.5 text-center bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Agregar producto
                </button>
                <button
                  type="button"
                  onClick={handleCancelarConfirmacion}
                  className="w-full py-2.5 text-center bg-muted hover:bg-muted/70 text-foreground text-sm font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* Otro error */}
            {errorVisible && errorBusqueda !== 'no_encontrado' && (
              <div className="bg-white rounded-card shadow-card p-4 flex items-start gap-2 animate-fade-in">
                <Package className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-foreground text-sm">{errorVisible}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

interface SubHeaderProps {
  paso: number
  titulo: string
  subtitulo: string
  onBack: () => void
}

function SubHeader({ paso, titulo, subtitulo, onBack }: SubHeaderProps) {
  return (
    <div className="sticky top-0 z-10 px-4 md:px-8 pt-4 pb-3 bg-white border-b border-border/40">
      <div className="flex items-center gap-3 mb-2.5">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 active:scale-[0.94]"
          aria-label="Volver"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <StepIndicator current={paso} total={3} />
      </div>
      <h1 className="text-foreground text-lg font-bold tracking-tight">{titulo}</h1>
      <p className="text-muted-foreground text-sm mt-0.5">{subtitulo}</p>
    </div>
  )
}

interface StepIndicatorProps { current: number; total: number }

function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i + 1 <= current ? 'bg-brand w-6' : 'bg-border w-3'
          }`}
        />
      ))}
      <span className="text-muted-foreground text-xs ml-1 font-medium">{current}/{total}</span>
    </div>
  )
}
