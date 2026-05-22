import { useState, useRef, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Upload, FileUp, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Configurar worker de pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface FilaParseada {
  cod_art: string
  descripcion: string
  marca: string
  stockPdf: number
  ventaMediaPdf: number
}

interface FilaPreview extends FilaParseada {
  id: string | null
  stockDb: number | null
  encontrado: boolean
}

interface ResultadoImportacion {
  actualizados: number
  nuevos: number
  errores: string[]
}

/**
 * Extrae texto de todas las páginas de un PDF usando pdfjs-dist.
 */
async function extraerTextoPdf(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const lineas: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const textoPagina = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    lineas.push(textoPagina)
  }

  return lineas
}

/**
 * Parsea las líneas de texto del PDF buscando filas con el formato:
 * Cod.Art. | Descripción | Marca | Stock Suc. | Venta Media
 *
 * El código de artículo son 7 dígitos numéricos.
 * Las últimas 2 columnas numéricas son Stock y Venta Media.
 */
function parsearLineasPdf(lineas: string[]): FilaParseada[] {
  const resultado: FilaParseada[] = []
  const textoCompleto = lineas.join(' ')

  // Tokenizar por espacios múltiples para separar columnas
  // Buscamos patrones: 7 dígitos seguido de texto de descripción y luego números
  // Regex: captura cod_art (7 dígitos), descripción, y los últimos 2 números (stock, venta_media)
  const regexFila = /\b(\d{7})\b\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s*(?=\d{7}|$)/g

  let match: RegExpExecArray | null
  while ((match = regexFila.exec(textoCompleto)) !== null) {
    const codArt = match[1]
    const descripcionRaw = match[2].trim()
    const stockRaw = match[3].replace(',', '.')
    const ventaMediaRaw = match[4].replace(',', '.')

    const stockPdf = parseInt(stockRaw, 10)
    const ventaMediaPdf = parseFloat(ventaMediaRaw)

    // Limpiar la descripción (puede contener la marca al final)
    // Quitamos tokens que parecen ser la marca (generalmente 1 palabra en mayúsculas al final)
    const marcaMatch = descripcionRaw.match(/\s+([A-Z]{2,})\s*$/)
    const marca = marcaMatch ? marcaMatch[1] : ''
    const descripcion = descripcionRaw.replace(/\s+[A-Z]{2,}\s*$/, '').trim() || descripcionRaw

    if (!isNaN(stockPdf) && !isNaN(ventaMediaPdf)) {
      resultado.push({ cod_art: codArt, descripcion, marca, stockPdf, ventaMediaPdf })
    }
  }

  // Fallback: si el regex anterior no encontró nada, intentar con línea por línea
  if (resultado.length === 0) {
    for (const linea of lineas) {
      // Dividir cada línea por espacios y buscar tokens
      const tokens = linea.trim().split(/\s+/)

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]
        if (/^\d{7}$/.test(token)) {
          // Encontramos un cod_art, buscamos los 2 últimos números como stock y venta_media
          const numericos: number[] = []
          const descTokens: string[] = []

          for (let j = i + 1; j < tokens.length; j++) {
            const t = tokens[j]
            if (/^\d+([.,]\d+)?$/.test(t)) {
              numericos.push(parseFloat(t.replace(',', '.')))
            } else if (numericos.length === 0) {
              descTokens.push(t)
            }
          }

          if (numericos.length >= 2) {
            const stockPdf = Math.floor(numericos[numericos.length - 2])
            const ventaMediaPdf = numericos[numericos.length - 1]
            const descCompleta = descTokens.join(' ').trim() || token
            const marcaMatch = descCompleta.match(/\s+([A-Z]{2,})\s*$/)
            const marca = marcaMatch ? marcaMatch[1] : ''
            const descripcion = descCompleta.replace(/\s+[A-Z]{2,}\s*$/, '').trim() || descCompleta

            resultado.push({ cod_art: token, descripcion, marca, stockPdf, ventaMediaPdf })
          }

          break
        }
      }
    }
  }

  return resultado
}

export default function Importar() {
  const [dragging, setDragging] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [parseando, setParseando] = useState(false)
  const [errorParseo, setErrorParseo] = useState<string | null>(null)
  const [filas, setFilas] = useState<FilaPreview[]>([])
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  const procesarArchivo = useCallback(async (file: File): Promise<void> => {
    if (!file.name.endsWith('.pdf')) {
      setErrorParseo('El archivo debe ser un PDF.')
      return
    }

    setArchivo(file)
    setParseando(true)
    setErrorParseo(null)
    setFilas([])
    setResultado(null)

    try {
      const lineas = await extraerTextoPdf(file)
      const filasParsed = parsearLineasPdf(lineas)

      if (filasParsed.length === 0) {
        setErrorParseo(
          'No se encontraron productos en el PDF. Verificá que sea el listado de reposición asistida correcto.',
        )
        setParseando(false)
        return
      }

      // Buscar los productos en la DB para comparar stock
      const codArts = filasParsed.map((f) => f.cod_art)
      const { data: productosDb, error: dbError } = await supabase
        .from('productos')
        .select('id, cod_art, descripcion, stock_actual')
        .in('cod_art', codArts)

      if (dbError) {
        setErrorParseo(`Error al consultar la base de datos: ${dbError.message}`)
        setParseando(false)
        return
      }

      const mapaDb = new Map(
        (productosDb ?? []).map((p) => [
          p.cod_art as string,
          { id: p.id as string, stockDb: p.stock_actual as number, descripcion: p.descripcion as string },
        ]),
      )

      const filasPreview: FilaPreview[] = filasParsed.map((fila) => {
        const dbProd = mapaDb.get(fila.cod_art)
        return {
          ...fila,
          id: dbProd?.id ?? null,
          stockDb: dbProd?.stockDb ?? null,
          encontrado: dbProd !== undefined,
        }
      })

      setFilas(filasPreview)
    } catch (err) {
      setErrorParseo(
        `Error al procesar el PDF: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setParseando(false)
    }
  }, [])

  function handleDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void procesarArchivo(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    if (file) void procesarArchivo(file)
  }

  async function handleConfirmarImportacion(): Promise<void> {
    const filasExistentes = filas.filter((f) => f.encontrado && f.id)
    const filasNuevas = filas.filter((f) => !f.encontrado)

    if (filasExistentes.length === 0 && filasNuevas.length === 0) return

    setImportando(true)
    const errores: string[] = []
    let actualizados = 0
    let nuevos = 0

    // UPDATE para productos existentes
    for (const fila of filasExistentes) {
      const { error } = await supabase
        .from('productos')
        .update({
          stock_actual: fila.stockPdf,
          venta_media_diaria: fila.ventaMediaPdf,
        })
        .eq('id', fila.id!)

      if (error) {
        errores.push(`${fila.cod_art}: ${error.message}`)
      } else {
        actualizados++
      }
    }

    // INSERT para productos nuevos
    for (const fila of filasNuevas) {
      const { error } = await supabase
        .from('productos')
        .insert({
          cod_art: fila.cod_art,
          descripcion: fila.descripcion,
          marca: fila.marca || '',
          stock_actual: fila.stockPdf,
          venta_media_diaria: fila.ventaMediaPdf,
          activo: true,
          categoria: 'OTRO',
        })

      if (error) {
        errores.push(`${fila.cod_art} (nuevo): ${error.message}`)
      } else {
        nuevos++
      }
    }

    setResultado({ actualizados, nuevos, errores })
    setImportando(false)
  }

  function handleReset(): void {
    setArchivo(null)
    setFilas([])
    setErrorParseo(null)
    setResultado(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const filasEncontradas = filas.filter((f) => f.encontrado)
  const filasNoEncontradas = filas.filter((f) => !f.encontrado)

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <FileUp className="h-5 w-5 text-green-400" />
          <div>
            <h1 className="text-base font-bold text-white leading-tight">
              Importar PDF
            </h1>
            <p className="text-xs text-gray-500">Listado de pedido de reposición asistida</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">
        {/* Zona de carga — visible cuando no hay archivo o hay error */}
        {!archivo && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onClick={() => inputRef.current?.click()}
            className={[
              'rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all',
              dragging
                ? 'border-green-500 bg-green-500/10'
                : 'border-gray-700 bg-gray-900 hover:border-gray-500 hover:bg-gray-900/80',
            ].join(' ')}
          >
            <div className="p-4 bg-gray-800 rounded-2xl">
              <Upload className={`h-10 w-10 ${dragging ? 'text-green-400' : 'text-gray-400'}`} />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-base">
                Arrastrá el PDF acá o hacé click para seleccionarlo
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Solo archivos PDF — Listado de Reposición Asistida
              </p>
            </div>
            <button
              type="button"
              className="px-5 py-2.5 bg-green-500 hover:bg-green-400 text-white font-semibold text-sm rounded-xl transition-colors"
            >
              Subir PDF
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {/* Archivo seleccionado + boton cambiar */}
        {archivo && !resultado && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileUp className="h-5 w-5 text-green-400 shrink-0" />
              <div>
                <p className="text-white text-sm font-medium">{archivo.name}</p>
                <p className="text-gray-500 text-xs">
                  {(archivo.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              aria-label="Quitar archivo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Loading */}
        {parseando && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-8 w-8 text-green-400 animate-spin" />
            <p className="text-gray-400 text-sm">Procesando PDF...</p>
          </div>
        )}

        {/* Error de parseo */}
        {errorParseo && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-2xl px-4 py-3 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 text-sm font-medium">Error al procesar el archivo</p>
              <p className="text-red-400/70 text-xs mt-1">{errorParseo}</p>
            </div>
          </div>
        )}

        {/* Resultado de importación */}
        {resultado && (
          <div className={`rounded-2xl border p-5 flex flex-col gap-3 ${
            resultado.errores.length > 0
              ? 'bg-yellow-900/20 border-yellow-700/50'
              : 'bg-green-900/20 border-green-700/50'
          }`}>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-400 shrink-0" />
              <p className="text-white font-bold text-base">Importación completada</p>
            </div>
            {resultado.actualizados > 0 && (
              <p className="text-green-300 text-sm">
                {resultado.actualizados} producto{resultado.actualizados !== 1 ? 's' : ''} actualizado{resultado.actualizados !== 1 ? 's' : ''} correctamente.
              </p>
            )}
            {resultado.nuevos > 0 && (
              <p className="text-blue-300 text-sm">
                {resultado.nuevos} producto{resultado.nuevos !== 1 ? 's' : ''} nuevo{resultado.nuevos !== 1 ? 's' : ''} agregado{resultado.nuevos !== 1 ? 's' : ''}.
              </p>
            )}
            {resultado.errores.length > 0 && (
              <div className="mt-1">
                <p className="text-red-300 text-xs font-medium mb-1">
                  {resultado.errores.length} error{resultado.errores.length !== 1 ? 'es' : ''}:
                </p>
                {resultado.errores.map((e, i) => (
                  <p key={i} className="text-red-400/70 text-xs">{e}</p>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="mt-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm rounded-xl transition-colors self-start"
            >
              Importar otro PDF
            </button>
          </div>
        )}

        {/* Preview separado por secciones */}
        {filas.length > 0 && !resultado && !parseando && (
          <>
            {/* Resumen */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3">
              <p className="text-white font-semibold text-sm">
                Preview — {filas.length} producto{filas.length !== 1 ? 's' : ''} en el PDF
              </p>
              <p className="text-gray-500 text-xs mt-0.5">
                {filasEncontradas.length} a actualizar · {filasNoEncontradas.length} nuevos a agregar
              </p>
            </div>

            {/* Seccion: Productos a actualizar */}
            {filasEncontradas.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800">
                  <h2 className="text-white font-semibold text-sm">
                    Productos a actualizar ({filasEncontradas.length})
                  </h2>
                  <p className="text-gray-500 text-xs mt-0.5">Se actualizara stock y venta media</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-2.5">Cod.Art.</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-2.5">Descripcion</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-2.5">Stock DB</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-2.5">Stock PDF</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-2.5">Venta Media</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasEncontradas.map((fila, idx) => (
                        <tr key={idx} className="border-b border-gray-800/50 last:border-0">
                          <td className="px-4 py-2.5 font-mono text-green-400 text-xs">{fila.cod_art}</td>
                          <td className="px-4 py-2.5 text-white text-xs max-w-[200px] truncate">{fila.descripcion}</td>
                          <td className="px-4 py-2.5 text-right text-gray-400 text-xs">
                            {fila.stockDb !== null ? fila.stockDb : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right text-white text-xs font-medium">{fila.stockPdf}</td>
                          <td className="px-4 py-2.5 text-right text-blue-400 text-xs">{fila.ventaMediaPdf.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Seccion: Productos nuevos a agregar */}
            {filasNoEncontradas.length > 0 && (
              <div className="bg-gray-900 border border-blue-800/40 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-blue-800/40 bg-blue-900/10">
                  <h2 className="text-blue-300 font-semibold text-sm">
                    Productos nuevos a agregar ({filasNoEncontradas.length})
                  </h2>
                  <p className="text-blue-400/60 text-xs mt-0.5">Se crearan con categoria OTRO</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-2.5">Cod.Art.</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-2.5">Descripcion</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-2.5">Stock PDF</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-2.5">Venta Media</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasNoEncontradas.map((fila, idx) => (
                        <tr key={idx} className="border-b border-gray-800/50 last:border-0">
                          <td className="px-4 py-2.5 font-mono text-blue-400 text-xs">{fila.cod_art}</td>
                          <td className="px-4 py-2.5 text-white text-xs max-w-[200px] truncate">{fila.descripcion}</td>
                          <td className="px-4 py-2.5 text-right text-white text-xs font-medium">{fila.stockPdf}</td>
                          <td className="px-4 py-2.5 text-right text-blue-400 text-xs">{fila.ventaMediaPdf.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Botón confirmar */}
            {(filasEncontradas.length > 0 || filasNoEncontradas.length > 0) && (
              <button
                type="button"
                onClick={() => void handleConfirmarImportacion()}
                disabled={importando}
                className="w-full min-h-14 bg-green-500 hover:bg-green-400 active:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                {importando ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Confirmar importacion ({filas.length} productos)
                  </>
                )}
              </button>
            )}
          </>
        )}
      </main>
    </div>
  )
}
