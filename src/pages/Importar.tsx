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

function parsearCsvGlaciar(textoCompleto: string): FilaParseada[] {
  const lineas = textoCompleto.split(/\r?\n/)
  const resultado: FilaParseada[] = []
  let headerEncontrado = false
  const FOOTER_PATTERNS = ['rptPedidosReposicionAsistida', 'Usuario:', 'Cant.Artículos', 'Cant.Articulos', 'Fecha', 'Sucursal:', 'Proveedor:']
  for (const linea of lineas) {
    if (!headerEncontrado) { if (linea.includes('Cod.Art.')) headerEncontrado = true; continue }
    if (FOOTER_PATTERNS.some((p) => linea.includes(p))) continue
    const lineaTrimmed = linea.trim()
    if (lineaTrimmed === '') continue
    const campos = linea.split('\t')
    const codArt = campos[0]?.trim() ?? ''
    if (!/^\d{4,8}$/.test(codArt)) continue
    const descripcion = campos[1]?.trim() ?? codArt
    const marca = campos[2]?.trim() ?? ''
    const cont = campos[4]?.trim() ?? ''
    const um = campos[5]?.trim() ?? ''
    const gramaje: string | null = cont && um ? `${cont} ${um}` : null
    const stockRaw = campos[8]?.trim() ?? ''
    const stock = parseInt(stockRaw, 10)
    if (isNaN(stock)) continue
    const ventaRaw = campos[13]?.trim() ?? ''
    const ventaMedia = parseFloat(ventaRaw.replace(',', '.'))
    if (isNaN(ventaMedia)) continue
    resultado.push({ cod_art: codArt, descripcion, marca, gramaje, stockCsv: stock, ventaMediaCsv: ventaMedia })
  }
  return resultado
}

// ─── Componente ───────────────────────────────────────────────────────────────

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
      const texto = await file.text()
      const filasParsed = parsearCsvGlaciar(texto)
      if (filasParsed.length === 0) {
        setErrorParseo('No se encontraron productos en el CSV. Verificá que sea el reporte de Reposición Asistida de Glaciar.')
        setParseando(false)
        return
      }
      const codArts = filasParsed.map((f) => f.cod_art)
      const { data: productosDb, error: dbError } = await supabase
        .from('productos')
        .select('id, cod_art, descripcion, stock_actual, venta_media_diaria')
        .in('cod_art', codArts)
      if (dbError) { setErrorParseo(`Error al consultar la base de datos: ${dbError.message}`); setParseando(false); return }
      const mapaDb = new Map((productosDb ?? []).map((p) => [p.cod_art as string, { id: p.id as string, stockDb: p.stock_actual as number, ventaMediaDb: p.venta_media_diaria as number }]))
      const filasPreview: FilaPreview[] = filasParsed.map((fila) => {
        const dbProd = mapaDb.get(fila.cod_art)
        return { ...fila, id: dbProd?.id ?? null, stockDb: dbProd?.stockDb ?? null, ventaMediaDb: dbProd?.ventaMediaDb ?? null, encontrado: dbProd !== undefined }
      })
      setFilas(filasPreview)
    } catch (err) {
      setErrorParseo(`Error al procesar el CSV: ${err instanceof Error ? err.message : String(err)}`)
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
    for (const fila of filasExistentes) {
      const { error } = await supabase.from('productos').update({ stock_actual: fila.stockCsv, venta_media_diaria: fila.ventaMediaCsv, gramaje: fila.gramaje }).eq('id', fila.id!)
      if (error) errores.push(`${fila.cod_art}: ${error.message}`)
      else actualizados++
    }
    for (const fila of filasNuevas) {
      const { error } = await supabase.from('productos').insert({ cod_art: fila.cod_art, descripcion: fila.descripcion, marca: fila.marca || '', gramaje: fila.gramaje, stock_actual: fila.stockCsv, venta_media_diaria: fila.ventaMediaCsv, activo: true, categoria: 'OTRO' })
      if (error) errores.push(`${fila.cod_art} (nuevo): ${error.message}`)
      else nuevos++
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

  const thCls = 'text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-2.5'
  const tdCls = 'px-4 py-2.5 text-xs'

  return (
    <div className="min-h-screen bg-surface-base">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-border shadow-nav px-4 py-3.5">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <div className="p-2 bg-brand-light rounded-lg">
            <FileUp className="h-4 w-4 text-brand" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground leading-tight">Importar desde Glaciar</h1>
            <p className="text-xs text-muted-foreground">Subí el CSV exportado desde el sistema Glaciar</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-4">

        {/* Instrucciones */}
        {!archivo && (
          <div className="bg-white rounded-card shadow-card px-4 py-3.5 flex items-start gap-3">
            <FileText className="h-4 w-4 text-brand shrink-0 mt-0.5" />
            <p className="text-muted-foreground text-sm">
              En Glaciar: <span className="text-foreground font-semibold">Reposición Asistida → Exportar → CSV</span>
            </p>
          </div>
        )}

        {/* Drop zone */}
        {!archivo && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onClick={() => inputRef.current?.click()}
            className={[
              'rounded-card border-2 border-dashed p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200',
              dragging
                ? 'border-brand bg-brand-light shadow-brand'
                : 'border-border bg-white shadow-card hover:border-brand/40 hover:shadow-elevated',
            ].join(' ')}
          >
            <div className={`p-4 rounded-[18px] transition-colors ${dragging ? 'bg-brand/10' : 'bg-muted'}`}>
              <Upload className={`h-10 w-10 transition-colors ${dragging ? 'text-brand' : 'text-muted-foreground'}`} />
            </div>
            <div className="text-center">
              <p className="text-foreground font-bold text-base">Arrastrá el CSV aquí o hacé click</p>
              <p className="text-muted-foreground text-sm mt-1">Reposición Asistida exportada desde Glaciar (.csv)</p>
            </div>
            <button type="button" className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-lg shadow-brand transition-all duration-150 active:scale-[0.97]">
              Subir CSV
            </button>
            <input ref={inputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
          </div>
        )}

        {/* Archivo seleccionado */}
        {archivo && !resultado && (
          <div className="bg-white rounded-card shadow-card px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-light rounded-lg">
                <FileUp className="h-4 w-4 text-brand shrink-0" />
              </div>
              <div>
                <p className="text-foreground text-sm font-semibold">{archivo.name}</p>
                <p className="text-muted-foreground text-xs">{(archivo.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            {!parseando && (
              <button type="button" onClick={handleReset} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" aria-label="Quitar archivo">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Procesando */}
        {parseando && (
          <div className="bg-white rounded-card shadow-card p-5 flex items-center gap-3 animate-fade-in">
            <Loader2 className="h-5 w-5 text-brand animate-spin shrink-0" />
            <div>
              <p className="text-foreground text-sm font-semibold">Procesando CSV...</p>
              <p className="text-muted-foreground text-xs mt-0.5">Analizando productos y consultando la base de datos</p>
            </div>
          </div>
        )}

        {/* Error parseo */}
        {errorParseo && (
          <div className="bg-red-50 border border-red-200 rounded-card px-4 py-4 flex items-start gap-3 animate-fade-in">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700 text-sm font-semibold">Error al procesar el archivo</p>
              <p className="text-red-500 text-xs mt-1">{errorParseo}</p>
              <button type="button" onClick={handleReset} className="mt-2 text-xs text-red-600 font-semibold underline underline-offset-2 hover:text-red-800 transition-colors">
                Intentar con otro archivo
              </button>
            </div>
          </div>
        )}

        {/* Resultado */}
        {resultado && (
          <div className={`rounded-card border p-5 flex flex-col gap-3 animate-fade-in ${resultado.errores.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
              <p className="text-foreground font-bold text-base">Importación completada</p>
            </div>
            <p className="text-emerald-700 text-sm">
              {resultado.actualizados} actualizado{resultado.actualizados !== 1 ? 's' : ''}, {resultado.nuevos} nuevo{resultado.nuevos !== 1 ? 's' : ''} insertado{resultado.nuevos !== 1 ? 's' : ''}
            </p>
            {resultado.errores.length > 0 && (
              <div>
                <p className="text-red-600 text-xs font-semibold mb-1">{resultado.errores.length} error{resultado.errores.length !== 1 ? 'es' : ''}:</p>
                {resultado.errores.map((e, i) => <p key={i} className="text-red-500 text-xs">{e}</p>)}
              </div>
            )}
            <button type="button" onClick={handleReset} className="mt-1 px-5 py-2.5 bg-white border border-border rounded-lg text-foreground font-medium text-sm hover:bg-muted transition-colors self-start shadow-card">
              Importar otro archivo
            </button>
          </div>
        )}

        {/* Preview */}
        {filas.length > 0 && !resultado && !parseando && (
          <>
            {/* Resumen */}
            <div className="bg-white rounded-card shadow-card px-4 py-3.5 animate-fade-in">
              <p className="text-foreground font-bold text-sm">
                {filas.length} producto{filas.length !== 1 ? 's' : ''} encontrado{filas.length !== 1 ? 's' : ''} en el CSV
              </p>
              <p className="text-muted-foreground text-xs mt-0.5">
                {filasEncontradas.length} a actualizar · {filasNoEncontradas.length} nuevos a agregar
              </p>
            </div>

            {/* Tabla: existentes */}
            {filasEncontradas.length > 0 && (
              <div className="bg-white rounded-card shadow-card overflow-hidden">
                <div className="px-4 py-3.5 border-b border-border">
                  <h2 className="text-foreground font-bold text-sm">Productos a actualizar ({filasEncontradas.length})</h2>
                  <p className="text-muted-foreground text-xs mt-0.5">Se actualizará stock actual y venta media</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className={thCls}>Cod.Art.</th>
                        <th className={thCls}>Descripción</th>
                        <th className={`${thCls} text-right`}>Stock DB</th>
                        <th className={`${thCls} text-right`}>Stock CSV</th>
                        <th className={`${thCls} text-right`}>V.Media DB</th>
                        <th className={`${thCls} text-right`}>V.Media CSV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasEncontradas.map((fila, idx) => (
                        <tr key={idx} className="border-b border-border/50 last:border-0 hover:bg-surface-base transition-colors">
                          <td className={`${tdCls} font-mono text-brand font-semibold`}>{fila.cod_art}</td>
                          <td className={`${tdCls} text-foreground max-w-[160px] truncate`}>{fila.descripcion}</td>
                          <td className={`${tdCls} text-right text-muted-foreground`}>{fila.stockDb ?? '—'}</td>
                          <td className={`${tdCls} text-right text-foreground font-semibold`}>{fila.stockCsv}</td>
                          <td className={`${tdCls} text-right text-muted-foreground`}>{fila.ventaMediaDb !== null ? fila.ventaMediaDb.toFixed(2) : '—'}</td>
                          <td className={`${tdCls} text-right text-brand font-semibold`}>{fila.ventaMediaCsv.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tabla: nuevos */}
            {filasNoEncontradas.length > 0 && (
              <div className="bg-white rounded-card shadow-card overflow-hidden">
                <div className="px-4 py-3.5 border-b border-border bg-brand-light">
                  <h2 className="text-brand font-bold text-sm">Productos nuevos ({filasNoEncontradas.length})</h2>
                  <p className="text-brand/60 text-xs mt-0.5">Se crearán con categoría OTRO</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className={thCls}>Cod.Art.</th>
                        <th className={thCls}>Descripción</th>
                        <th className={thCls}>Marca</th>
                        <th className={`${thCls} text-right`}>Stock CSV</th>
                        <th className={`${thCls} text-right`}>V.Media CSV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasNoEncontradas.map((fila, idx) => (
                        <tr key={idx} className="border-b border-border/50 last:border-0 hover:bg-surface-base transition-colors">
                          <td className={`${tdCls} font-mono text-brand font-semibold`}>{fila.cod_art}</td>
                          <td className={`${tdCls} text-foreground max-w-[160px] truncate`}>{fila.descripcion}</td>
                          <td className={`${tdCls} text-muted-foreground`}>{fila.marca || '—'}</td>
                          <td className={`${tdCls} text-right text-foreground font-semibold`}>{fila.stockCsv}</td>
                          <td className={`${tdCls} text-right text-brand font-semibold`}>{fila.ventaMediaCsv.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Acciones */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => void handleConfirmarImportacion()}
                disabled={importando}
                className="flex-1 min-h-[56px] bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base rounded-card shadow-brand transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {importando ? (
                  <><Loader2 className="h-5 w-5 animate-spin" />Importando...</>
                ) : (
                  <><CheckCircle className="h-5 w-5" />Confirmar importación ({filas.length} productos)</>
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={importando}
                className="sm:w-32 min-h-[56px] bg-muted hover:bg-muted/70 disabled:opacity-50 text-foreground font-medium text-sm rounded-card transition-colors"
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
