export type RiesgoNivel = 'seguro' | 'radar' | 'urgente' | 'donacion' | 'decomiso'

export type RolUsuario = 'admin' | 'operador' | 'supervisor'

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
