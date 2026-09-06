export type RiesgoNivel = 'seguro' | 'radar' | 'urgente' | 'donacion' | 'decomiso'

// Rol legacy: se conserva mientras la UI actual de 091 migra gradualmente.
export type RolUsuario = 'admin' | 'operador' | 'supervisor'

// Fuente nueva de autorización multitenant.
export type RolAccesoMultitenant =
  | 'admin_organizacion'
  | 'gerente_zonal'
  | 'gerente_sucursal'
  | 'supervisor'
  | 'operador'

export interface UsuarioPerfil {
  id: string
  nombre: string
  rol: RolUsuario
  sucursal_id: string | null
  activo: boolean
}

export interface UsuarioConEmail extends UsuarioPerfil {
  email: string
  familias: FamiliaAsignada[]
}

export interface Organizacion {
  id: string
  codigo: string
  nombre: string
  activa: boolean
  created_at: string
  updated_at: string
}

export interface Zona {
  id: string
  organizacion_id: string
  codigo: string
  nombre: string
  activa: boolean
  created_at: string
  updated_at: string
}

export interface Sector {
  id: string
  nombre: string
  codigo: string
  organizacion_id?: string
  dias_donacion?: number | null
}

export interface Familia {
  id: string
  nombre: string
  codigo: string
  sector_id: string
}

export interface FamiliaAsignada {
  id: string
  nombre: string
  codigo: string
  sector_id: string
  sector_nombre: string
}

export interface Sucursal {
  id: string
  nombre: string
  direccion: string | null
  activa: boolean
  created_at: string
  // Campos V1 multitenant. Son opcionales durante la ventana de compatibilidad
  // con producción legacy; después del cutover DB pasan a ser obligatorios.
  codigo?: string
  organizacion_id?: string
  zona_id?: string
}

export interface UsuarioAcceso {
  id: string
  usuario_id: string
  organizacion_id: string
  rol: RolAccesoMultitenant
  zona_id: string | null
  sucursal_id: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface UsuarioFamiliaSucursal {
  id: string
  usuario_id: string
  organizacion_id: string
  sucursal_id: string
  familia_id: string
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Producto {
  id: string
  cod_art: string
  codigo_barras: string | null
  descripcion: string
  marca: string | null
  gramaje: string | null
  categoria: string | null
  proveedor: string | null
  sector: string | null
  venta_media_diaria: number
  stock_actual: number
  precio_costo: number | null
  imagen_url: string | null
  imagen_thumb_url?: string | null
  familia_id: string | null
  activo: boolean
  created_at: string
  updated_at: string
  // Se vuelve obligatorio en DB con la migración de catálogo V1, pero queda
  // opcional en el tipo mientras el frontend actual siga pudiendo hablar con 091.
  organizacion_id?: string
}

export interface ProductoCodigo {
  id: string
  organizacion_id: string
  producto_id: string
  codigo: string
  tipo: 'ean8' | 'upca' | 'ean13' | 'gtin14' | 'otro'
  es_principal: boolean
  activo: boolean
  created_at: string
  updated_at: string
}

/**
 * Estado operativo que antes vivía dentro de `productos`.
 * Es SKU × sucursal: dos locales pueden compartir catálogo sin compartir stock.
 */
export interface ProductoSucursal {
  id: string
  organizacion_id: string
  producto_id: string
  sucursal_id: string
  stock_actual: number
  venta_media_diaria: number
  fecha_ultima_importacion: string | null
  created_at: string
  updated_at: string
}

export type EstadoImportacion = 'recibida' | 'validada' | 'aplicada' | 'fallida' | 'cancelada'

export interface Importacion {
  id: string
  organizacion_id: string
  sucursal_id: string
  usuario_id: string | null
  tipo_reporte: 'reposicion_asistida'
  codigo_sucursal_fuente: string
  fecha_reporte: string | null
  nombre_archivo: string
  archivo_sha256: string
  filas_total: number
  filas_validas: number
  filas_descartadas: number
  estado: EstadoImportacion
  error_detalle: string | null
  created_at: string
  aplicada_at: string | null
}

export interface ProductoSnapshot {
  id: number
  importacion_id: string
  organizacion_id: string
  sucursal_id: string
  producto_id: string
  stock: number
  venta_media_diaria: number
  fila_origen: number | null
  captured_at: string
}

export interface VencimientoObservacion {
  id: number
  organizacion_id: string
  sucursal_id: string
  producto_id: string
  vencimiento_id: string
  usuario_id: string
  cantidad_comprometida: number
  observada_at: string
  nota: string | null
  created_at: string
}

export interface IntervencionRag {
  id: string
  organizacion_id: string
  sucursal_id: string
  producto_id: string
  vencimiento_id: string
  usuario_id: string
  porcentaje_descuento: number
  cantidad_comprometida_al_aplicar: number
  vmd_glaciar_al_aplicar: number | null
  aplicado_at: string
  nota: string | null
  created_at: string
}

export type EstadoSeguimientoRag =
  | 'decomiso'
  | 'donacion'
  | 'sin_rag'
  | 'pendiente_control_operador'
  | 'dato_a_revisar'
  | 'ventana_insuficiente'
  | 'sin_movimiento'
  | 'efectivo'
  | 'insuficiente'

export interface SeguimientoRagActual {
  vencimiento_id: string
  organizacion_id: string
  sucursal_id: string
  producto_id: string
  descripcion: string
  familia_id: string | null
  sector_id: string | null
  sector_nombre: string | null
  dias_donacion: number | null
  fecha_vencimiento: string
  dias_hasta_vencimiento: number
  dias_comerciales_restantes: number
  vmd_glaciar_actual: number
  fecha_ultima_importacion: string | null
  rag_id: string | null
  rag_porcentaje: number | null
  rag_aplicado_at: string | null
  cantidad_base_rag: number | null
  vmd_glaciar_al_aplicar: number | null
  observacion_id: number | null
  observada_at: string | null
  cantidad_observada: number | null
  cantidad_actual_estimacion: number
  unidades_vendidas_observadas: number | null
  dias_observados: number | null
  velocidad_observada: number | null
  velocidad_necesaria: number | null
  estado_seguimiento_rag: EstadoSeguimientoRag
}

export interface Vencimiento {
  id: string
  producto_id: string
  sucursal_id: string
  usuario_id: string
  cantidad: number
  lote: string | null
  fecha_vencimiento: string
  fecha_carga: string
  activo: boolean
  created_at: string
  producto?: Producto
  /** Política proveniente de sectores.dias_donacion; null/undefined durante compatibilidad legacy. */
  dias_donacion?: number | null
}

export interface VencimientoConRiesgo extends Vencimiento {
  dias_restantes: number
  cobertura_dias: number
  dias_donacion: number
  dias_comerciales_restantes: number
  velocidad_necesaria: number
  nivel_riesgo: RiesgoNivel
  acciones_sugeridas: string[]
  producto: Producto
}
