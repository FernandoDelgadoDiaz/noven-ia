import { supabase } from '@/lib/supabase'
import { pathImagenProducto, prepararImagenProducto } from '@/lib/image-pipeline'

export type ModoImagenProducto = 'agregar' | 'reemplazar' | 'solo_lectura'

export interface ResultadoImagenProductoGlobal {
  publicUrl: string
  thumbUrl: string
  modoPosterior: ModoImagenProducto
}

function esModoImagenProducto(value: unknown): value is ModoImagenProducto {
  return value === 'agregar' || value === 'reemplazar' || value === 'solo_lectura'
}

function nuevaVersionImagen(): string {
  const randomUUID = globalThis.crypto?.randomUUID
  if (typeof randomUUID !== 'function') {
    throw new Error('Este navegador no puede generar una versión segura para la foto.')
  }
  return randomUUID.call(globalThis.crypto)
}

export async function consultarModoImagenProducto(
  sucursalId: string,
  productoId: string,
): Promise<ModoImagenProducto> {
  const { data, error } = await supabase.rpc('modo_imagen_producto_operador', {
    p_sucursal_id: sucursalId,
    p_producto_id: productoId,
  })
  if (error) throw error
  return esModoImagenProducto(data) ? data : 'solo_lectura'
}

export async function guardarImagenProductoGlobal(params: {
  file: File
  sucursalId: string
  productoId: string
  organizacionId: string
}): Promise<ResultadoImagenProductoGlobal> {
  const { file, sucursalId, productoId, organizacionId } = params

  // Revalidamos el permiso en el momento de guardar. La UI puede ocultar la
  // acción, pero la autorización real nunca depende del frontend.
  const modo = await consultarModoImagenProducto(sucursalId, productoId)
  if (modo === 'solo_lectura') {
    throw new Error('La foto ya es compartida por la organización y tu perfil no puede reemplazarla.')
  }

  const preparada = await prepararImagenProducto(file)
  const versionId = nuevaVersionImagen()
  const paths = pathImagenProducto(organizacionId, productoId, versionId)

  // Nunca pisamos la versión actualmente publicada. Ambos objetos se crean en
  // una versión nueva e inmutable; si uno falla, la DB sigue apuntando al par anterior.
  const { error: fullError } = await supabase.storage
    .from('productos-imagenes')
    .upload(paths.full, preparada.full, {
      upsert: false,
      contentType: preparada.fullMimeType,
      cacheControl: '31536000',
    })
  if (fullError) throw fullError

  const { error: thumbError } = await supabase.storage
    .from('productos-imagenes')
    .upload(paths.thumb, preparada.thumb, {
      upsert: false,
      contentType: preparada.thumbMimeType,
      cacheControl: '31536000',
    })
  if (thumbError) throw thumbError

  const { data: fullUrlData } = supabase.storage.from('productos-imagenes').getPublicUrl(paths.full)
  const { data: thumbUrlData } = supabase.storage.from('productos-imagenes').getPublicUrl(paths.thumb)
  const publicUrl = fullUrlData.publicUrl
  const thumbUrl = thumbUrlData.publicUrl

  // Esta RPC es el punto de publicación: valida que full y thumb sean de la
  // misma versión y actualiza ambas URLs juntas en el catálogo global.
  const { error: updateError } = await supabase.rpc('actualizar_imagen_producto_operador_v2', {
    p_sucursal_id: sucursalId,
    p_producto_id: productoId,
    p_imagen_url: publicUrl,
    p_imagen_thumb_url: thumbUrl,
  })
  if (updateError) throw updateError

  const modoPosterior = await consultarModoImagenProducto(sucursalId, productoId)
  return { publicUrl, thumbUrl, modoPosterior }
}
