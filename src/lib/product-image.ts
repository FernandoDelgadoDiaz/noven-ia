import { supabase } from '@/lib/supabase'
import { cacheBustPublicUrl, pathImagenProducto, prepararImagenProducto } from '@/lib/image-pipeline'

export type ModoImagenProducto = 'agregar' | 'reemplazar' | 'solo_lectura'

export interface ResultadoImagenProductoGlobal {
  publicUrl: string
  thumbUrl: string
  modoPosterior: ModoImagenProducto
}

function esModoImagenProducto(value: unknown): value is ModoImagenProducto {
  return value === 'agregar' || value === 'reemplazar' || value === 'solo_lectura'
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
  const paths = pathImagenProducto(organizacionId, productoId)

  const { error: fullError } = await supabase.storage
    .from('productos-imagenes')
    .upload(paths.full, preparada.full, {
      upsert: true,
      contentType: preparada.fullMimeType,
      cacheControl: '3600',
    })
  if (fullError) throw fullError

  const { error: thumbError } = await supabase.storage
    .from('productos-imagenes')
    .upload(paths.thumb, preparada.thumb, {
      upsert: true,
      contentType: preparada.thumbMimeType,
      cacheControl: '3600',
    })
  if (thumbError) throw thumbError

  const version = Date.now()
  const { data: fullUrlData } = supabase.storage.from('productos-imagenes').getPublicUrl(paths.full)
  const { data: thumbUrlData } = supabase.storage.from('productos-imagenes').getPublicUrl(paths.thumb)
  const publicUrl = cacheBustPublicUrl(fullUrlData.publicUrl, version)
  const thumbUrl = cacheBustPublicUrl(thumbUrlData.publicUrl, version)

  // La URL se persiste en productos, que es catálogo global por organización.
  // No se guarda una foto por sucursal.
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
