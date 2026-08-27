export interface ImagenProductoPreparada {
  full: Blob
  thumb: Blob
  fullWidth: number
  fullHeight: number
  thumbWidth: number
  thumbHeight: number
}

const MAX_SOURCE_BYTES = 20 * 1024 * 1024
const FULL_MAX_SIDE = 1200
const THUMB_MAX_SIDE = 240
const FULL_QUALITY = 0.78
const THUMB_QUALITY = 0.72

function dimensionesAjustadas(width: number, height: number, maxSide: number): { width: number; height: number } {
  if (width <= maxSide && height <= maxSide) return { width, height }
  const scale = maxSide / Math.max(width, height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function cargarImagen(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; dispose: () => void }> {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    }
  }

  const url = URL.createObjectURL(file)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
  await img.decode()

  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    dispose: () => URL.revokeObjectURL(url),
  }
}

function canvasAWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('El navegador no pudo convertir la imagen a WebP.'))
          return
        }
        resolve(blob)
      },
      'image/webp',
      quality,
    )
  })
}

async function renderWebp(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxSide: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const size = dimensionesAjustadas(sourceWidth, sourceHeight, maxSide)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height

  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('No se pudo preparar la imagen.')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, size.width, size.height)

  const blob = await canvasAWebp(canvas, quality)
  return { blob, width: size.width, height: size.height }
}

export async function prepararImagenProducto(file: File): Promise<ImagenProductoPreparada> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Seleccioná un archivo de imagen.')
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('La foto original supera 20 MB.')
  }

  const imagen = await cargarImagen(file)
  try {
    const [full, thumb] = await Promise.all([
      renderWebp(imagen.source, imagen.width, imagen.height, FULL_MAX_SIDE, FULL_QUALITY),
      renderWebp(imagen.source, imagen.width, imagen.height, THUMB_MAX_SIDE, THUMB_QUALITY),
    ])

    if (full.blob.size > 1024 * 1024) {
      throw new Error('La foto optimizada todavía supera 1 MB. Probá con otra imagen.')
    }
    if (thumb.blob.size > 300 * 1024) {
      throw new Error('La miniatura optimizada quedó demasiado pesada.')
    }

    return {
      full: full.blob,
      thumb: thumb.blob,
      fullWidth: full.width,
      fullHeight: full.height,
      thumbWidth: thumb.width,
      thumbHeight: thumb.height,
    }
  } finally {
    imagen.dispose()
  }
}

export function pathImagenProducto(organizacionId: string, productoId: string): {
  full: string
  thumb: string
} {
  return {
    full: `${organizacionId}/productos/${productoId}/full.webp`,
    thumb: `${organizacionId}/productos/${productoId}/thumb.webp`,
  }
}

export function cacheBustPublicUrl(url: string, version: number): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}v=${version}`
}
