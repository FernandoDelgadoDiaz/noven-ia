import { useState, useRef, useCallback } from 'react'
import { Upload, FileUp, CheckCircle, AlertCircle, Loader2, X, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface FilaParseada {
  cod_art: string
  descripcion: string
  marca: string
  gramaje: string | null
  stockCsv: number
  ventaMediaCsv: number
}

interface FilaPreview extends FilaParseada {
  id: string | null
  stockDb: number | null
  ventaMediaDb: number | null
  encontrado: boolean
}

interface ResultadoImportacion {
  actualizados: number
  nuevos: number
  errores: string[]
}

// ─── Parser CSV de Glaciar ────────────────────────────────────────────────────

/**
 * Parsea el CSV exportado desde Glaciar (Reposición Asistida).
 *
 * Estructura del archivo:
 * - ~20 filas de header con parámetros del reporte (ignorar)
 * - Fila de columnas que comienza con "Cod.Art." (separada por tabs)
 * - Filas de datos: primer campo es número de 4-8 dígitos
 * - Footer: filas con "rptPedidosReposicionAsistida", "Usuario:", etc. (ignorar)
 *
 * Columnas relevantes (índice 0-based, separadas por \t):
 *   0  → Cod.Art.
 *   1  → Descripción
 *   2  → Marca
 *   3  → Bto (bultos)
 *   4  → Cont (contenido)
 *   5  → U/M (unidad de medida: GR, CU, ML, etc.)
 *   8  → Stock Suc.
 *   13 → Venta Media
 */
function parsearCsvGlaciar(textoCompleto: string): FilaParseada[] {
  const lineas = textoCompleto.split(/\r?\n/)
  const resultado: FilaParseada[] = []

  // Encontrar la fila de header de columnas
  let headerEncontrado = false

  const FOOTER_PATTERNS = [
    'rptPedidosReposicionAsistida',
    'Usuario:',
    'Cant.Artículos',
    'Cant.Articulos',
    'Fecha',
    'Sucursal:',
    'Proveedor:',
  ]

  for (const linea of lineas) {
    // Buscar la fila de header de columnas
    if (!headerEncontrado) {
      if (linea.includes('Cod.Art.')) {
        headerEncontrado = true
      }
      continue
    }

    // Ignorar líneas de footer
    if (FOOTER_PATTERNS.some((p) => linea.includes(p))) continue

    // Ignorar líneas vacías
    const lineaTrimmed = linea.trim()
    if (lineaTrimmed === '') continue

    // Separar por tab
    const campos = linea.split('\t')

    // El primer campo debe ser un número de 4-8 dígitos
    const codArt = campos[0]?.trim() ?? ''
    if (!/^\d{4,8}$/.test(codArt)) continue

    const descripcion = campos[1]?.trim() ?? codArt
    const marca = campos[2]?.trim() ?? ''

    // Índices 4 y 5 → Gramaje (Cont + U/M)
    const cont = campos[4]?.trim() ?? ''
    const um = campos[5]?.trim() ?? ''
    const gramaje: string | null = cont && um ? `${cont} ${um}` : null

    // Índice 8 → Stock Suc.
    const stockRaw = campos[8]?.trim() ?? ''
    const stock = parseInt(stockRaw, 10)
    if (isNaN(stock)) continue

    // Índice 13 → Venta Media
    const ventaRaw = campos[13]?.trim() ?? ''
    // Los decimales pueden venir con coma (formato argentino)
    const ventaNormalizada = ventaRaw.replace(',', '.')
    const ventaMedia = parseFloat(ventaNormalizada)
    if (isNaN(ventaMedia)) continue

    resultado.push({
      cod_art: codArt,
      descripcion,
      marca,
      gramaje,
      stockCsv: stock,
      ventaMediaCsv: ventaMedia,
    })
  }

  return resultado
}

// ─── Componente principal ─────────────────────────────────────────────────────

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
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorParseo('El archivo debe ser un CSV. En Glaciar: Reposición Asistida → Exportar → CSV.')
      return
    }

    setArchivo(file)
    setParseando(true)
    setErrorParseo(null)
    setFilas([])
    setResultado(null)

    try {
      // Leer el archivo como texto en memoria — no se sube a ningún servidor
      const texto = await file.text()

      const filasParsed = parsearCsvGlaciar(texto)

      if (filasParsed.length === 0) {
        setErrorParseo(
          'No se encontraron productos en el CSV. Verificá que el archivo sea el reporte de Reposición Asistida exportado desde Glaciar.',
        )
        setParseando(false)
        return
      }

      // Consultar DB para comparar con los códigos encontrados
      const codArts = filasParsed.map((f) => f.cod_art)
      const { data: productosDb, error: dbError } = await supabase
        .from('productos')
        .select('id, cod_art, descripcion, stock_actual, venta_media_diaria')
        .in('cod_art', codArts)

      if (dbError) {
        setErrorParseo(`Error al consultar la base de datos: ${dbError.message}`)
        setParseando(false)
        return
      }

      const mapaDb = new Map(
        (productosDb ?? []).map((p) => [
          p.cod_art as string,
          {
            id: p.id as string,
            stockDb: p.stock_actual as number,
            ventaMediaDb: p.venta_media_diaria as number,
          },
        ]),
      )

      const filasPreview: FilaPreview[] = filasParsed.map((fila) => {
        const dbProd = mapaDb.get(fila.cod_art)
        return {
          ...fila,
          id: dbProd?.id ?? null,
          stockDb: dbProd?.stockDb ?? null,
          ventaMediaDb: dbProd?.ventaMediaDb ?? null,
          encontrado: dbProd !== undefined,
        }
      })

      setFilas(filasPreview)
    } catch (err) {
      setErrorParseo(
        `Error al procesar el CSV: ${err instanceof Error ? err.message : String(err)}`,
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

    // UPDATE masivo: stock_actual y venta_media_diaria para productos existentes
    for (const fila of filasExistentes) {
      const { error } = await supabase
        .from('productos')
        .update({
          stock_actual: fila.stockCsv,
          venta_media_diaria: fila.ventaMediaCsv,
          gramaje: fila.gramaje,
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
      const { error } = await supabase.from('productos').insert({
        cod_art: fila.cod_art,
        descripcion: fila.descripcion,
        marca: fila.marca || '',
        gramaje: fila.gramaje,
        stock_actual: fila.stockCsv,
        venta_media_diaria: fila.ventaMediaCsv,
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
            <h1 className="text-base font-bold text-white leading-tight">Importar desde Glaciar</h1>
            <p className="text-xs text-gray-500">Subí el CSV exportado desde el sistema Glaciar</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">

        {/* Instrucciones */}
        {!archivo && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 flex items-start gap-3">
            <FileText className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-gray-400 text-sm">
              En Glaciar: <span className="text-white font-medium">Reposición Asistida → Exportar → CSV</span>
            </p>
          </div>
        )}

        {/* Zona de drag & drop */}
        {!archivo && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
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
                Arrastrá el CSV aquí o hacé click para seleccionar
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Reposición Asistida exportada desde Glaciar (.csv)
              </p>
            </div>
            <button
              type="button"
              className="px-5 py-2.5 bg-green-500 hover:bg-green-400 text-white font-semibold text-sm rounded-xl transition-colors"
            >
              Subir CSV
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {/* Archivo seleccionado */}
        {archivo && !resultado && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileUp className="h-5 w-5 text-green-400 shrink-0" />
              <div>
                <p className="text-white text-sm font-medium">{archivo.name}</p>
                <p className="text-gray-500 text-xs">{(archivo.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            {!parseando && (
              <button
                type="button"
                onClick={handleReset}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                aria-label="Quitar archivo"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Estado: procesando */}
        {parseando && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-blue-400 animate-spin shrink-0" />
            <div>
              <p className="text-white text-sm font-semibold">Procesando CSV...</p>
              <p className="text-gray-500 text-xs mt-0.5">Analizando productos y consultando la base de datos</p>
            </div>
          </div>
        )}

        {/* Error de parseo */}
        {errorParseo && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-2xl px-4 py-3 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 text-sm font-medium">Error al procesar el archivo</p>
              <p className="text-red-400/70 text-xs mt-1">{errorParseo}</p>
              <button
                type="button"
                onClick={handleReset}
                className="mt-2 text-xs text-red-300 underline underline-offset-2"
              >
                Intentar con otro archivo
              </button>
            </div>
          </div>
        )}

        {/* Resultado de importación */}
        {resultado && (
          <div
            className={`rounded-2xl border p-5 flex flex-col gap-3 ${
              resultado.errores.length > 0
                ? 'bg-yellow-900/20 border-yellow-700/50'
                : 'bg-green-900/20 border-green-700/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-400 shrink-0" />
              <p className="text-white font-bold text-base">Importación completada</p>
            </div>
            <p className="text-green-300 text-sm">
              {resultado.actualizados} actualizado{resultado.actualizados !== 1 ? 's' : ''},{' '}
              {resultado.nuevos} nuevo{resultado.nuevos !== 1 ? 's' : ''} insertado
              {resultado.nuevos !== 1 ? 's' : ''} correctamente
            </p>
            {resultado.errores.length > 0 && (
              <div className="mt-1">
                <p className="text-red-300 text-xs font-medium mb-1">
                  {resultado.errores.length} error{resultado.errores.length !== 1 ? 'es' : ''}:
                </p>
                {resultado.errores.map((e, i) => (
                  <p key={i} className="text-red-400/70 text-xs">
                    {e}
                  </p>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="mt-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm rounded-xl transition-colors self-start"
            >
              Importar otro archivo
            </button>
          </div>
        )}

        {/* Preview de productos */}
        {filas.length > 0 && !resultado && !parseando && (
          <>
            {/* Resumen contadores */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3">
              <p className="text-white font-semibold text-sm">
                {filas.length} producto{filas.length !== 1 ? 's' : ''} encontrado{filas.length !== 1 ? 's' : ''} en el CSV
              </p>
              <p className="text-gray-500 text-xs mt-0.5">
                {filasEncontradas.length} a actualizar · {filasNoEncontradas.length} nuevos a agregar
              </p>
            </div>

            {/* Productos a actualizar (existen en DB) */}
            {filasEncontradas.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800">
                  <h2 className="text-white font-semibold text-sm">
                    Productos a actualizar ({filasEncontradas.length})
                  </h2>
                  <p className="text-gray-500 text-xs mt-0.5">Se actualizará stock actual y venta media</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-2.5">Cod.Art.</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-2.5">Descripción</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-2.5">Stock DB</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-2.5">Stock CSV</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-2.5">V.Media DB</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-2.5">V.Media CSV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasEncontradas.map((fila, idx) => (
                        <tr key={idx} className="border-b border-gray-800/50 last:border-0">
                          <td className="px-4 py-2.5 font-mono text-green-400 text-xs">{fila.cod_art}</td>
                          <td className="px-4 py-2.5 text-white text-xs max-w-[180px] truncate">{fila.descripcion}</td>
                          <td className="px-4 py-2.5 text-right text-gray-400 text-xs">
                            {fila.stockDb !== null ? fila.stockDb : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right text-white text-xs font-medium">{fila.stockCsv}</td>
                          <td className="px-4 py-2.5 text-right text-gray-400 text-xs">
                            {fila.ventaMediaDb !== null ? fila.ventaMediaDb.toFixed(2) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right text-blue-400 text-xs">{fila.ventaMediaCsv.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Productos nuevos (no existen en DB) */}
            {filasNoEncontradas.length > 0 && (
              <div className="bg-gray-900 border border-blue-800/40 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-blue-800/40 bg-blue-900/10">
                  <h2 className="text-blue-300 font-semibold text-sm">
                    Productos nuevos ({filasNoEncontradas.length})
                  </h2>
                  <p className="text-blue-400/60 text-xs mt-0.5">Se crearán con categoría OTRO</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-2.5">Cod.Art.</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-2.5">Descripción</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-2.5">Marca</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-2.5">Stock CSV</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-2.5">V.Media CSV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasNoEncontradas.map((fila, idx) => (
                        <tr key={idx} className="border-b border-gray-800/50 last:border-0">
                          <td className="px-4 py-2.5 font-mono text-blue-400 text-xs">{fila.cod_art}</td>
                          <td className="px-4 py-2.5 text-white text-xs max-w-[180px] truncate">{fila.descripcion}</td>
                          <td className="px-4 py-2.5 text-gray-400 text-xs">{fila.marca || '—'}</td>
                          <td className="px-4 py-2.5 text-right text-white text-xs font-medium">{fila.stockCsv}</td>
                          <td className="px-4 py-2.5 text-right text-blue-400 text-xs">{fila.ventaMediaCsv.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => void handleConfirmarImportacion()}
                disabled={importando}
                className="flex-1 min-h-14 bg-green-500 hover:bg-green-400 active:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                {importando ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Confirmar importación ({filas.length} productos)
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={importando}
                className="sm:w-32 min-h-14 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm rounded-2xl transition-colors"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
