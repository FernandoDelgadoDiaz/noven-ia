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
}

export interface VencimientoConRiesgo extends Vencimiento {
  dias_restantes: number
  cobertura_dias: number
  nivel_riesgo: RiesgoNivel
  acciones_sugeridas: string[]
  producto: Producto
}
