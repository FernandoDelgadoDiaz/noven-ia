import { useState, useRef, useCallback } from 'react'
import { Upload, FileUp, CheckCircle, AlertCircle, AlertTriangle, Loader2, X, FileText, Copy, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  decodificarCsv,
  parsearCsvGlaciar,
  similaridad,
  type EncodingDetectado,
  type ResultadoParser,
} from '@/lib/importar-csv'
import {
  reconciliar,
  type FilaConciliada,
  type Huerfano,
  type ProductoDb,
  type Reconciliacion,
  type MotivoCodArt,
} from '@/lib/importar-reconciliacion'

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface FamiliaInfo {
  id: string
  codigo: string
  nombre: string
}

/** Decisión del usuario sobre una coincidencia por descripción. */
type DecisionSimilar = 'mismo' | 'distinto'

interface ResultadoImportacion {
  actualizados: number
  nuevos: number
  errores: string[]
  codArtCorregidos: { de: string; a: string; descripcion: string }[]
  insertadosConSimilar: { codArt: string; descripcion: string; similarA: string }[]
}

/** Producto del CSV que se va a dar de alta teniendo un parecido en la app. */
interface AvisoSimilar {
  linea: number
  codArt: string
  descripcion: string
  producto: ProductoDb
  score: number
}

/**
 * Umbral de AVISO, más laxo que el de matcheo automático. Entre 0,70 y 0,85 hay
 * pares que probablemente sean el mismo producto pero que el módulo no da por
 * coincidencia; en vez de insertarlos en silencio se los muestra como sospecha.
 */
const UMBRAL_AVISO = 0.7

// ─── Utilidades ───────────────────────────────────────────────────────────────

/** PostgREST arma la query de `.in()` en la URL: con cientos de valores explota. */
function enLotes<T>(items: T[], tam: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += tam) out.push(items.slice(i, i + tam))
  return out
}

const CAMPOS_PRODUCTO =
  'id, cod_art, codigo_barras, descripcion, marca, gramaje, stock_actual, venta_media_diaria, familia_id'

const ETIQUETA_COD_ART: Record<Exclude<MotivoCodArt, null>, string> = {
  sin_asignar: 'cod_art sin asignar',
  ean: 'cod_art es un EAN, no un código de Glaciar',
  formato_invalido: 'cod_art inválido',
}

const ETIQUETA_ESTRATEGIA: Record<string, string> = {
  cod_art: 'Cód.',
  codigo_barras: 'EAN',
  descripcion: 'Descr.',
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function Importar() {
  const [dragging, setDragging] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [parseando, setParseando] = useState(false)
  const [errorParseo, setErrorParseo] = useState<string | null>(null)
  const [avisoHeader, setAvisoHeader] = useState<string | null>(null)
  const [encoding, setEncoding] = useState<EncodingDetectado | null>(null)

  const [parser, setParser] = useState<ResultadoParser | null>(null)
  const [familia, setFamilia] = useState<FamiliaInfo | null>(null)
  const [operadores, setOperadores] = useState<string[]>([])
  const [familiaConfirmada, setFamiliaConfirmada] = useState(false)
  const [mapaFamilias, setMapaFamilias] = useState<Map<string, FamiliaInfo>>(new Map())
  const [recon, setRecon] = useState<Reconciliacion | null>(null)

  const [avisosSimilares, setAvisosSimilares] = useState<AvisoSimilar[]>([])
  const [decisiones, setDecisiones] = useState<Record<number, DecisionSimilar>>({})
  const [familiasAprobadas, setFamiliasAprobadas] = useState<Set<string>>(new Set())
  const [verDescartadas, setVerDescartadas] = useState(false)

  const [importando, setImportando] = useState(false)
  const [progreso, setProgreso] = useState({ hechos: 0, total: 0 })
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)
  const [copiado, setCopiado] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  function limpiarEstado(): void {
    setErrorParseo(null)
    setAvisoHeader(null)
    setEncoding(null)
    setParser(null)
    setFamilia(null)
    setOperadores([])
    setFamiliaConfirmada(false)
    setRecon(null)
    setAvisosSimilares([])
    setDecisiones({})
    setFamiliasAprobadas(new Set())
    setResultado(null)
    setProgreso({ hechos: 0, total: 0 })
  }

  const procesarArchivo = useCallback(async (file: File): Promise<void> => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorParseo('El archivo debe ser un CSV. En Glaciar: Reposición Asistida → Exportar → CSV.')
      return
    }
    setArchivo(file)
    setParseando(true)
    limpiarEstado()

    try {
      const buffer = await file.arrayBuffer()
      const { texto, encoding: enc } = decodificarCsv(buffer)
      setEncoding(enc)

      const resultadoParser = parsearCsvGlaciar(texto)
      setParser(resultadoParser)

      // ── Validaciones de estructura: bloquean la importación ────────────────
      if (resultadoParser.headerAusente) {
        setErrorParseo(
          'No se encontró la fila de encabezado (Cod.Art.). Verificá que sea el reporte de Reposición Asistida completo de Glaciar.',
        )
        return
      }
      if (resultadoParser.faltantes.length > 0) {
        setErrorParseo(
          `Faltan columnas requeridas en el CSV: ${resultadoParser.faltantes.join(', ')}. ` +
            `Encabezados encontrados: ${resultadoParser.encabezados.join(' · ')}.`,
        )
        return
      }
      if (!resultadoParser.headerValidado) {
        setAvisoHeader(
          'No se pudo validar el encabezado por nombre de columna; se usó el orden de columnas por defecto. Revisá los valores antes de confirmar.',
        )
      }
      if (resultadoParser.filas.length === 0) {
        setErrorParseo('No se encontraron productos válidos en el CSV.')
        return
      }

      // ── C5 · La familia debe resolver, o no se importa ─────────────────────
      if (resultadoParser.codigoFamilia === null) {
        setErrorParseo(
          'No se pudo detectar la familia en el CSV. Verificá que sea el reporte de Reposición Asistida completo (incluye el encabezado con Cód.Familia).',
        )
        return
      }

      const { data: familiasData, error: errFamilias } = await supabase
        .from('familias')
        .select('id, codigo, nombre')
      if (errFamilias) {
        setErrorParseo(`Error al consultar las familias: ${errFamilias.message}`)
        return
      }

      const todas = (familiasData ?? []) as unknown as FamiliaInfo[]
      setMapaFamilias(new Map(todas.map((f) => [f.id, f])))

      const familiaCsv = todas.find((f) => f.codigo === resultadoParser.codigoFamilia) ?? null
      if (!familiaCsv) {
        setErrorParseo(
          `El CSV corresponde a la familia ${resultadoParser.codigoFamilia}, que no está dada de alta en el sistema. Pedile al administrador que la cree antes de importar.`,
        )
        return
      }
      setFamilia(familiaCsv)

      // ── Operadores asignados a esa familia (para el gate de confirmación) ──
      const [{ data: asignaciones }, { data: usuariosOperadores }] = await Promise.all([
        supabase.from('usuario_familias').select('usuario_id, familia_id').eq('familia_id', familiaCsv.id),
        supabase.from('usuarios').select('id, nombre').eq('rol', 'operador'),
      ])
      const idsOperadores = new Set(
        ((usuariosOperadores ?? []) as unknown as { id: string }[]).map((u) => u.id),
      )
      const nombrePorId = new Map(
        ((usuariosOperadores ?? []) as unknown as { id: string; nombre: string }[]).map((u) => [
          u.id,
          u.nombre,
        ]),
      )
      setOperadores(
        ((asignaciones ?? []) as unknown as { usuario_id: string }[])
          .filter((a) => idsOperadores.has(a.usuario_id))
          .map((a) => nombrePorId.get(a.usuario_id) ?? '—'),
      )

      // ── Candidatos: por cod_art, por codigo_barras y todos los de la familia ──
      const codArts = resultadoParser.filas.map((f) => f.cod_art)
      const porId = new Map<string, ProductoDb>()
      const sumar = (filas: unknown): void => {
        for (const p of (filas ?? []) as ProductoDb[]) if (!porId.has(p.id)) porId.set(p.id, p)
      }

      for (const lote of enLotes(codArts, 200)) {
        const [{ data: porCod }, { data: porEan }] = await Promise.all([
          supabase.from('productos').select(CAMPOS_PRODUCTO).in('cod_art', lote),
          supabase.from('productos').select(CAMPOS_PRODUCTO).in('codigo_barras', lote),
        ])
        sumar(porCod)
        sumar(porEan)
      }

      const { data: deLaFamilia, error: errFamiliaProds } = await supabase
        .from('productos')
        .select(CAMPOS_PRODUCTO)
        .eq('familia_id', familiaCsv.id)
        .eq('activo', true)
      if (errFamiliaProds) {
        setErrorParseo(`Error al consultar los productos de la familia: ${errFamiliaProds.message}`)
        return
      }
      sumar(deLaFamilia)

      const candidatos = [...porId.values()]
      const reconciliacion = reconciliar(resultadoParser.filas, candidatos, familiaCsv.id)
      setRecon(reconciliacion)

      // Los que van a insertarse como nuevos pero se parecen a algo que ya existe.
      // El módulo ya descartó los que superan el umbral de matcheo; acá se busca
      // en la franja de sospecha (0,70–0,85) y contra TODOS los candidatos,
      // incluidos los que otra fila ya tomó.
      const avisos: AvisoSimilar[] = []
      for (const fc of reconciliacion.nuevos) {
        let mejor: ProductoDb | null = null
        let mejorScore = 0
        for (const p of candidatos) {
          const s = similaridad(fc.fila.descripcion, p.descripcion)
          if (s > mejorScore) { mejorScore = s; mejor = p }
        }
        if (mejor && mejorScore >= UMBRAL_AVISO) {
          avisos.push({
            linea: fc.fila.linea,
            codArt: fc.fila.cod_art,
            descripcion: fc.fila.descripcion,
            producto: mejor,
            score: mejorScore,
          })
        }
      }
      avisos.sort((a, b) => b.score - a.score)
      setAvisosSimilares(avisos)
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

  function handleReset(): void {
    setArchivo(null)
    limpiarEstado()
    if (inputRef.current) inputRef.current.value = ''
  }

  // ─── Escritura ──────────────────────────────────────────────────────────────

  /** Un producto solo cambia de familia si estaba sin asignar o si el admin lo aprobó. */
  function debeAsignarFamilia(fc: FilaConciliada): boolean {
    if (!fc.match) return false
    if (fc.match.familia_id === null) return true
    return fc.conflictoFamilia && familiasAprobadas.has(fc.match.id)
  }

  async function handleConfirmarImportacion(): Promise<void> {
    if (!recon || !familia || !familiaConfirmada) return

    const decididas = recon.aConfirmar.filter((fc) => decisiones[fc.fila.linea] !== undefined)
    const mismos = decididas.filter((fc) => decisiones[fc.fila.linea] === 'mismo')
    const distintos = decididas.filter((fc) => decisiones[fc.fila.linea] === 'distinto')

    const aActualizar = [...recon.aActualizar, ...mismos]
    const aInsertar = [...recon.nuevos, ...distintos]

    setImportando(true)
    setProgreso({ hechos: 0, total: aActualizar.length + aInsertar.length })

    const errores: string[] = []
    const codArtCorregidos: ResultadoImportacion['codArtCorregidos'] = []
    let actualizados = 0
    let nuevos = 0
    let hechos = 0

    for (const lote of enLotes(aActualizar, 50)) {
      await Promise.all(
        lote.map(async (fc) => {
          if (!fc.match) return
          const { fila, match } = fc
          const payload: Record<string, unknown> = {
            stock_actual: fila.stockCsv,
            venta_media_diaria: fila.ventaMediaCsv,
            updated_at: new Date().toISOString(),
          }
          // No pisar con null/vacío lo que se cargó a mano en la app.
          if (fila.gramaje !== null) payload.gramaje = fila.gramaje
          if (fila.marca !== '') payload.marca = fila.marca
          if (debeAsignarFamilia(fc)) payload.familia_id = familia.id

          const corrigeCodArt = fc.estrategia === 'descripcion' && match.cod_art !== fila.cod_art
          if (corrigeCodArt) payload.cod_art = fila.cod_art

          const { error } = await supabase.from('productos').update(payload).eq('id', match.id)
          if (error) {
            errores.push(
              corrigeCodArt
                ? `${fila.cod_art}: no se pudo corregir el código (${error.message})`
                : `${fila.cod_art}: ${error.message}`,
            )
          } else {
            actualizados++
            if (corrigeCodArt) {
              codArtCorregidos.push({ de: match.cod_art, a: fila.cod_art, descripcion: match.descripcion })
            }
          }
        }),
      )
      hechos += lote.length
      setProgreso((p) => ({ ...p, hechos }))
    }

    for (const lote of enLotes(aInsertar, 50)) {
      await Promise.all(
        lote.map(async (fc) => {
          const { fila } = fc
          const { error } = await supabase.from('productos').insert({
            cod_art: fila.cod_art,
            descripcion: fila.descripcion,
            marca: fila.marca || '',
            gramaje: fila.gramaje,
            stock_actual: fila.stockCsv,
            venta_media_diaria: fila.ventaMediaCsv,
            activo: true,
            categoria: 'OTRO',
            familia_id: familia.id,
          })
          if (error) errores.push(`${fila.cod_art} (nuevo): ${error.message}`)
          else nuevos++
        }),
      )
      hechos += lote.length
      setProgreso((p) => ({ ...p, hechos }))
    }

    setResultado({
      actualizados,
      nuevos,
      errores,
      codArtCorregidos,
      insertadosConSimilar: [
        // Los que el usuario marcó explícitamente como "producto distinto".
        ...distintos.map((fc) => ({
          codArt: fc.fila.cod_art,
          descripcion: fc.fila.descripcion,
          similarA: fc.match ? `${fc.match.cod_art} — ${fc.match.descripcion}` : '',
        })),
        // Y los que entraron como nuevos cayendo en la franja de sospecha.
        ...avisosSimilares.map((a) => ({
          codArt: a.codArt,
          descripcion: a.descripcion,
          similarA: `${a.producto.cod_art} — ${a.producto.descripcion} (${Math.round(a.score * 100)}%)`,
        })),
      ],
    })
    setImportando(false)
  }

  // ─── Reporte copiable ───────────────────────────────────────────────────────

  function armarReporteTexto(): string {
    if (!resultado || !recon || !familia) return ''
    const L: string[] = []
    L.push(`IMPORTACIÓN GLACIAR — familia ${familia.codigo} ${familia.nombre}`)
    L.push(`Archivo: ${archivo?.name ?? '—'} · Codificación: ${encoding ?? '—'}`)
    L.push(`Fecha: ${new Date().toLocaleString('es-AR')}`)
    L.push('')
    L.push(`Actualizados: ${resultado.actualizados}`)
    L.push(`Nuevos insertados: ${resultado.nuevos}`)
    L.push(`Errores: ${resultado.errores.length}`)
    for (const e of resultado.errores) L.push(`  - ${e}`)

    if (recon.huerfanos.length > 0) {
      L.push('')
      L.push(`PRODUCTOS DE LA APP QUE NO VINIERON EN EL CSV (${recon.huerfanos.length})`)
      L.push('Posible cod_art desalineado con Glaciar: su stock NO se actualizó.')
      for (const h of recon.huerfanos) {
        const motivo = h.motivoCodArt ? ` [${ETIQUETA_COD_ART[h.motivoCodArt]}]` : ''
        L.push(`  - ${h.producto.cod_art} · ${h.producto.descripcion} · stock ${h.producto.stock_actual}${motivo}`)
      }
    }

    if (resultado.codArtCorregidos.length > 0) {
      L.push('')
      L.push(`CÓDIGOS CORREGIDOS (${resultado.codArtCorregidos.length})`)
      for (const c of resultado.codArtCorregidos) L.push(`  - ${c.descripcion}: ${c.de} → ${c.a}`)
    }

    if (resultado.insertadosConSimilar.length > 0) {
      L.push('')
      L.push(`INSERTADOS PESE A TENER UN SIMILAR (${resultado.insertadosConSimilar.length})`)
      for (const s of resultado.insertadosConSimilar) {
        L.push(`  - ${s.codArt} ${s.descripcion} — parecido a ${s.similarA}`)
      }
    }

    const descartadas = parser?.descartadas ?? []
    if (descartadas.length > 0) {
      L.push('')
      L.push(`FILAS DESCARTADAS DEL CSV (${descartadas.length})`)
      for (const d of descartadas) L.push(`  - línea ${d.linea} · ${d.codArt} · ${d.motivo}`)
    }
    return L.join('\n')
  }

  async function copiarReporte(): Promise<void> {
    try {
      await navigator.clipboard.writeText(armarReporteTexto())
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  // ─── Derivados de render ────────────────────────────────────────────────────

  const descartadas = parser?.descartadas ?? []
  const sinDecidir = recon ? recon.aConfirmar.filter((fc) => decisiones[fc.fila.linea] === undefined).length : 0
  const totalAEscribir = recon
    ? recon.aActualizar.length +
      recon.nuevos.length +
      recon.aConfirmar.filter((fc) => decisiones[fc.fila.linea] !== undefined).length
    : 0

  const thCls = 'text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-2.5'
  const tdCls = 'px-4 py-2.5 text-xs'

  function nombreFamilia(id: string | null): string {
    if (id === null) return 'sin familia'
    const f = mapaFamilias.get(id)
    return f ? `${f.codigo} ${f.nombre}` : 'familia desconocida'
  }

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-10 bg-white border-b border-border/40 px-4 md:px-8 py-4 md:py-5">
        <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-none">Importar desde Glaciar</h1>
        <p className="text-sm text-muted-foreground mt-1 leading-none">Subí el CSV exportado desde el sistema Glaciar</p>
      </header>

      <main className="px-4 md:px-8 py-5 md:py-6 max-w-4xl space-y-4 pb-28">
        {!archivo && (
          <div className="bg-white rounded-card shadow-card px-4 py-3.5 flex items-start gap-3">
            <FileText className="h-4 w-4 text-brand shrink-0 mt-0.5" />
            <p className="text-muted-foreground text-sm">
              En Glaciar: <span className="text-foreground font-semibold">Reposición Asistida → Exportar → CSV</span>
            </p>
          </div>
        )}

        {!archivo && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onClick={() => inputRef.current?.click()}
            className={[
              'rounded-[24px] p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 border',
              dragging
                ? 'border-brand bg-brand-light shadow-brand'
                : 'border-border/60 bg-white shadow-card hover:shadow-elevated hover:border-brand/40',
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

        {archivo && !resultado && (
          <div className="bg-white rounded-card shadow-card px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-light rounded-lg">
                <FileUp className="h-4 w-4 text-brand shrink-0" />
              </div>
              <div>
                <p className="text-foreground text-sm font-semibold">{archivo.name}</p>
                <p className="text-muted-foreground text-xs">
                  {(archivo.size / 1024).toFixed(1)} KB
                  {encoding && <> · Codificación: <span className="font-mono">{encoding}</span></>}
                </p>
              </div>
            </div>
            {!parseando && (
              <button type="button" onClick={handleReset} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" aria-label="Quitar archivo">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {parseando && (
          <div className="bg-white rounded-card shadow-card p-5 flex items-center gap-3 animate-fade-in">
            <Loader2 className="h-5 w-5 text-brand animate-spin shrink-0" />
            <div>
              <p className="text-foreground text-sm font-semibold">Procesando CSV...</p>
              <p className="text-muted-foreground text-xs mt-0.5">Analizando productos y consultando la base de datos</p>
            </div>
          </div>
        )}

        {errorParseo && (
          <div className="bg-red-50 border border-red-200 rounded-card px-4 py-4 flex items-start gap-3 animate-fade-in">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700 text-sm font-semibold">No se puede importar este archivo</p>
              <p className="text-red-500 text-xs mt-1">{errorParseo}</p>
              <button type="button" onClick={handleReset} className="mt-2 text-xs text-red-600 font-semibold underline underline-offset-2 hover:text-red-800 transition-colors">
                Intentar con otro archivo
              </button>
            </div>
          </div>
        )}

        {avisoHeader && !errorParseo && (
          <div className="bg-amber-50 border border-amber-200 rounded-card px-4 py-3.5 flex items-start gap-3 animate-fade-in">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-amber-800 text-xs">{avisoHeader}</p>
          </div>
        )}

        {/* ── C8 · Confirmación de familia: sin esto no hay preview ni escritura ── */}
        {familia && recon && !familiaConfirmada && !resultado && !parseando && (
          <div className="bg-white rounded-card shadow-card border border-brand/30 p-5 space-y-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-brand-light rounded-lg shrink-0">
                <FileText className="h-4 w-4 text-brand" />
              </div>
              <div className="space-y-2">
                <p className="text-foreground font-bold text-base leading-snug">
                  Este CSV corresponde a la familia{' '}
                  <span className="font-mono text-brand">{familia.codigo}</span> {familia.nombre}.
                </p>
                {operadores.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Actualmente asignada a: <span className="text-foreground font-semibold">{operadores.join(', ')}</span>.
                  </p>
                ) : (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-amber-800 text-xs font-medium">
                      Familia {familia.codigo} {familia.nombre} — sin operador asignado actualmente.
                    </p>
                  </div>
                )}
                <p className="text-sm text-foreground">
                  ¿Confirmás que los productos de este archivo pertenecen a esta familia?
                </p>
                <p className="text-xs text-muted-foreground">
                  {parser?.filas.length ?? 0} productos leídos del archivo. Todavía no se escribió nada.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setFamiliaConfirmada(true)}
                className="flex-1 min-h-[52px] bg-brand hover:bg-brand-hover text-white font-bold text-sm rounded-card shadow-brand transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Sí, importar a {familia.codigo} {familia.nombre}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="sm:w-32 min-h-[52px] bg-muted hover:bg-muted/70 text-foreground font-medium text-sm rounded-card transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── Preview: solo con la familia confirmada ────────────────────────── */}
        {recon && familia && familiaConfirmada && !resultado && (
          <>
            <div className="bg-brand-light border border-brand/20 rounded-card px-4 py-3 flex items-center gap-3 animate-fade-in">
              <div className="flex-1">
                <p className="text-brand text-xs font-semibold uppercase tracking-wide">Familia confirmada</p>
                <p className="text-foreground font-bold text-sm mt-0.5">
                  {familia.nombre} <span className="font-mono text-muted-foreground font-normal">({familia.codigo})</span>
                </p>
              </div>
              <span className="px-2.5 py-1 bg-brand text-white text-xs font-bold rounded-lg">{familia.codigo}</span>
            </div>

            {/* ── Huérfanos: el caso Turrocklets ───────────────────────────── */}
            {recon.huerfanos.length > 0 && (
              <div className="bg-white rounded-card shadow-card overflow-hidden border border-amber-300 animate-fade-in">
                <div className="px-4 py-3.5 bg-amber-50 border-b border-amber-200">
                  <h2 className="text-amber-900 font-bold text-sm">
                    Productos en la app que no vinieron en el CSV ({recon.huerfanos.length})
                  </h2>
                  <p className="text-amber-700 text-xs mt-0.5">
                    Posible cod_art desalineado con Glaciar. Su stock NO se va a actualizar y puede estar desactualizado.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className={thCls}>Cod.Art.</th>
                        <th className={thCls}>Descripción</th>
                        <th className={`${thCls} text-right`}>Stock app</th>
                        <th className={`${thCls} text-right`}>V.Media</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recon.huerfanos.map((h: Huerfano) => (
                        <tr key={h.producto.id} className="border-b border-border/50 last:border-0">
                          <td className={`${tdCls} font-mono text-foreground font-semibold whitespace-nowrap`}>
                            {h.producto.cod_art || '—'}
                            {h.motivoCodArt && (
                              <span className="ml-2 inline-flex px-1.5 py-0.5 bg-red-50 text-red-700 text-[10px] font-semibold rounded whitespace-nowrap">
                                {ETIQUETA_COD_ART[h.motivoCodArt]}
                              </span>
                            )}
                          </td>
                          <td className={`${tdCls} text-foreground`}>{h.producto.descripcion}</td>
                          <td className={`${tdCls} text-right text-foreground font-semibold`}>{h.producto.stock_actual}</td>
                          <td className={`${tdCls} text-right text-muted-foreground`}>{Number(h.producto.venta_media_diaria).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Coincidencias a confirmar: repara el desalineamiento ─────── */}
            {recon.aConfirmar.length > 0 && (
              <div className="bg-white rounded-card shadow-card overflow-hidden animate-fade-in">
                <div className="px-4 py-3.5 border-b border-border">
                  <h2 className="text-foreground font-bold text-sm">
                    Coincidencias a confirmar ({recon.aConfirmar.length})
                  </h2>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Encontramos productos muy parecidos con distinto código. Decidí caso por caso.
                    {sinDecidir > 0 && (
                      <span className="text-amber-700 font-semibold"> · {sinDecidir} sin decidir (se excluyen)</span>
                    )}
                  </p>
                </div>
                <div className="divide-y divide-border/60">
                  {recon.aConfirmar.map((fc: FilaConciliada) => (
                    <div key={fc.fila.linea} className="p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-brand-light/50 rounded-lg p-3">
                          <p className="text-[10px] uppercase tracking-wide text-brand font-bold">En el CSV</p>
                          <p className="text-foreground text-sm font-semibold mt-1">{fc.fila.descripcion}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-mono">{fc.fila.cod_art}</span> · stock {fc.fila.stockCsv} · v.media {fc.fila.ventaMediaCsv.toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-muted rounded-lg p-3">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">Ya existe en la app</p>
                          <p className="text-foreground text-sm font-semibold mt-1">{fc.match?.descripcion}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-mono">{fc.match?.cod_art}</span> · stock {fc.match?.stock_actual} · v.media {Number(fc.match?.venta_media_diaria ?? 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Similaridad: <span className="font-semibold text-foreground">{Math.round((fc.similaridad ?? 0) * 100)}%</span>
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => setDecisiones((d) => ({ ...d, [fc.fila.linea]: 'mismo' }))}
                          className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold border transition-colors text-left ${
                            decisiones[fc.fila.linea] === 'mismo'
                              ? 'bg-brand text-white border-brand'
                              : 'bg-white text-foreground border-border hover:border-brand/50'
                          }`}
                        >
                          Es el mismo producto
                          <span className={`block font-normal mt-0.5 ${decisiones[fc.fila.linea] === 'mismo' ? 'text-white/80' : 'text-muted-foreground'}`}>
                            Se corrige el código y se actualizan stock y venta media con los datos de Glaciar.
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecisiones((d) => ({ ...d, [fc.fila.linea]: 'distinto' }))}
                          className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold border transition-colors text-left ${
                            decisiones[fc.fila.linea] === 'distinto'
                              ? 'bg-foreground text-white border-foreground'
                              : 'bg-white text-foreground border-border hover:border-foreground/40'
                          }`}
                        >
                          Es un producto distinto
                          <span className={`block font-normal mt-0.5 ${decisiones[fc.fila.linea] === 'distinto' ? 'text-white/80' : 'text-muted-foreground'}`}>
                            Se inserta como producto nuevo.
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── C7 · Conflictos de familia: decisión por producto ────────── */}
            {recon.conflictosFamilia.length > 0 && (
              <div className="bg-white rounded-card shadow-card overflow-hidden border border-amber-300 animate-fade-in">
                <div className="px-4 py-3.5 bg-amber-50 border-b border-amber-200">
                  <h2 className="text-amber-900 font-bold text-sm">
                    Productos que cambiarían de familia ({recon.conflictosFamilia.length})
                  </h2>
                  <p className="text-amber-700 text-xs mt-0.5">
                    Estos productos figuran en otra familia en la app. Confirmá el cambio solo si Glaciar es la fuente correcta.
                    Sin tildar, se actualizan stock y venta media pero la familia queda como está.
                  </p>
                </div>
                <div className="divide-y divide-border/60">
                  {recon.conflictosFamilia.map((fc: FilaConciliada) => (
                    <label
                      key={`${fc.fila.linea}-${fc.match?.id}`}
                      className="flex items-start gap-3 p-4 cursor-pointer hover:bg-surface-base transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-[color:var(--brand,#0d9488)] shrink-0"
                        checked={fc.match ? familiasAprobadas.has(fc.match.id) : false}
                        onChange={(e) => {
                          if (!fc.match) return
                          const id = fc.match.id
                          setFamiliasAprobadas((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(id)
                            else next.delete(id)
                            return next
                          })
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-foreground text-sm font-semibold">
                          <span className="font-mono text-brand">{fc.fila.cod_art}</span> · {fc.fila.descripcion}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Figura en <span className="text-foreground font-semibold">{nombreFamilia(fc.match?.familia_id ?? null)}</span> en la app,
                          este CSV dice <span className="text-foreground font-semibold">{familia.codigo} {familia.nombre}</span>.
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ── Productos a actualizar ───────────────────────────────────── */}
            {recon.aActualizar.length > 0 && (
              <div className="bg-white rounded-card shadow-card overflow-hidden animate-fade-in">
                <div className="px-4 py-3.5 border-b border-border">
                  <h2 className="text-foreground font-bold text-sm">Productos a actualizar ({recon.aActualizar.length})</h2>
                  <p className="text-muted-foreground text-xs mt-0.5">Se actualizará stock actual y venta media</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className={thCls}>Cod.Art.</th>
                        <th className={thCls}>Descripción</th>
                        <th className={thCls}>Hallado por</th>
                        <th className={`${thCls} text-right`}>Stock DB</th>
                        <th className={`${thCls} text-right`}>Stock CSV</th>
                        <th className={`${thCls} text-right`}>V.Media DB</th>
                        <th className={`${thCls} text-right`}>V.Media CSV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recon.aActualizar.map((fc: FilaConciliada) => (
                        <tr key={fc.fila.linea} className="border-b border-border/50 last:border-0 hover:bg-surface-base transition-colors">
                          <td className={`${tdCls} font-mono text-brand font-semibold`}>{fc.fila.cod_art}</td>
                          <td className={`${tdCls} text-foreground max-w-[160px] truncate`}>
                            {fc.fila.descripcion}
                            {fc.fila.sinVentaMedia && (
                              <span className="ml-1.5 inline-flex px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-semibold rounded">sin venta media</span>
                            )}
                          </td>
                          <td className={tdCls}>
                            <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded ${
                              fc.estrategia === 'cod_art' ? 'bg-brand-light text-brand' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {ETIQUETA_ESTRATEGIA[fc.estrategia ?? ''] ?? '—'}
                            </span>
                          </td>
                          <td className={`${tdCls} text-right text-muted-foreground`}>{fc.match?.stock_actual ?? '—'}</td>
                          <td className={`${tdCls} text-right text-foreground font-semibold`}>{fc.fila.stockCsv}</td>
                          <td className={`${tdCls} text-right text-muted-foreground`}>{Number(fc.match?.venta_media_diaria ?? 0).toFixed(2)}</td>
                          <td className={`${tdCls} text-right text-brand font-semibold`}>{fc.fila.ventaMediaCsv.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Productos nuevos ─────────────────────────────────────────── */}
            {recon.nuevos.length > 0 && (
              <div className="bg-white rounded-card shadow-card overflow-hidden animate-fade-in">
                <div className="px-4 py-3.5 border-b border-border bg-brand-light">
                  <h2 className="text-brand font-bold text-sm">Productos nuevos ({recon.nuevos.length})</h2>
                  <p className="text-brand/60 text-xs mt-0.5">Se crearán con categoría OTRO en {familia.codigo} {familia.nombre}</p>
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
                      {recon.nuevos.map((fc: FilaConciliada) => (
                        <tr key={fc.fila.linea} className="border-b border-border/50 last:border-0 hover:bg-surface-base transition-colors">
                          <td className={`${tdCls} font-mono text-brand font-semibold`}>{fc.fila.cod_art}</td>
                          <td className={`${tdCls} text-foreground max-w-[160px] truncate`}>{fc.fila.descripcion}</td>
                          <td className={`${tdCls} text-muted-foreground`}>{fc.fila.marca || '—'}</td>
                          <td className={`${tdCls} text-right text-foreground font-semibold`}>{fc.fila.stockCsv}</td>
                          <td className={`${tdCls} text-right text-brand font-semibold`}>{fc.fila.ventaMediaCsv.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Sospecha de duplicado: nuevos que se parecen a algo existente ── */}
            {avisosSimilares.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-card px-4 py-3.5 animate-fade-in">
                <p className="text-amber-900 font-bold text-sm">
                  Posibles duplicados entre los productos nuevos ({avisosSimilares.length})
                </p>
                <p className="text-amber-700 text-xs mt-0.5 mb-2">
                  Se van a dar de alta como nuevos, pero ya existe un producto de descripción parecida.
                  Si es el mismo, cancelá y corregí el código en la app antes de importar.
                </p>
                <ul className="space-y-1.5">
                  {avisosSimilares.map((a) => (
                    <li key={a.linea} className="text-xs text-amber-800">
                      <span className="font-mono font-semibold">{a.codArt}</span> {a.descripcion}
                      <span className="text-amber-600"> — se parece {Math.round(a.score * 100)}% a </span>
                      <span className="font-mono font-semibold">{a.producto.cod_art}</span> {a.producto.descripcion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Colisiones ───────────────────────────────────────────────── */}
            {recon.colisiones.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-card px-4 py-3.5 animate-fade-in">
                <p className="text-amber-900 font-bold text-sm">Filas en colisión ({recon.colisiones.length})</p>
                <p className="text-amber-700 text-xs mt-0.5">Otra fila del CSV ya matcheó este registro. Se excluyen para no actualizar dos veces el mismo producto.</p>
                <ul className="mt-2 space-y-0.5">
                  {recon.colisiones.map((fc: FilaConciliada) => (
                    <li key={fc.fila.linea} className="text-amber-800 text-xs">
                      línea {fc.fila.linea} · <span className="font-mono">{fc.fila.cod_art}</span> · {fc.fila.descripcion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Filas descartadas ────────────────────────────────────────── */}
            {descartadas.length > 0 && (
              <div className="bg-white rounded-card shadow-card overflow-hidden animate-fade-in">
                <button
                  type="button"
                  onClick={() => setVerDescartadas((v) => !v)}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-surface-base transition-colors"
                >
                  <div>
                    <h2 className="text-foreground font-bold text-sm">{descartadas.length} filas descartadas del CSV</h2>
                    <p className="text-muted-foreground text-xs mt-0.5">No se van a importar. Tocá para ver el motivo de cada una.</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${verDescartadas ? 'rotate-180' : ''}`} />
                </button>
                {verDescartadas && (
                  <div className="overflow-x-auto border-t border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className={thCls}>Línea</th>
                          <th className={thCls}>Cod.Art.</th>
                          <th className={thCls}>Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {descartadas.map((d) => (
                          <tr key={`${d.linea}-${d.codArt}`} className="border-b border-border/50 last:border-0">
                            <td className={`${tdCls} text-muted-foreground`}>{d.linea}</td>
                            <td className={`${tdCls} font-mono text-foreground`}>{d.codArt || '—'}</td>
                            <td className={`${tdCls} text-muted-foreground`}>{d.motivo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Acciones ─────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => void handleConfirmarImportacion()}
                disabled={importando || totalAEscribir === 0}
                className="flex-1 min-h-[56px] bg-brand hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base rounded-card shadow-brand transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {importando ? (
                  <><Loader2 className="h-5 w-5 animate-spin" />Importando… {progreso.hechos}/{progreso.total}</>
                ) : (
                  <><CheckCircle className="h-5 w-5" />Confirmar importación ({totalAEscribir} productos)</>
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

        {/* ── Reporte post-importación ───────────────────────────────────────── */}
        {resultado && recon && familia && (
          <div className="space-y-4 animate-fade-in">
            <div className={`rounded-card border p-5 space-y-3 ${resultado.errores.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                <p className="text-foreground font-bold text-base">Importación completada</p>
              </div>
              <p className="text-sm text-foreground">
                <span className="font-bold">{resultado.actualizados}</span> actualizado{resultado.actualizados !== 1 ? 's' : ''} ·{' '}
                <span className="font-bold">{resultado.nuevos}</span> nuevo{resultado.nuevos !== 1 ? 's' : ''} insertado{resultado.nuevos !== 1 ? 's' : ''} ·{' '}
                <span className={`font-bold ${resultado.errores.length > 0 ? 'text-red-600' : ''}`}>{resultado.errores.length}</span> error{resultado.errores.length !== 1 ? 'es' : ''}
              </p>
              {resultado.errores.length > 0 && (
                <div className="bg-white/70 rounded-lg p-3">
                  <p className="text-red-700 text-xs font-semibold mb-1">
                    {resultado.errores.length} producto{resultado.errores.length !== 1 ? 's' : ''} NO se {resultado.errores.length !== 1 ? 'actualizaron' : 'actualizó'}:
                  </p>
                  {resultado.errores.map((e, i) => <p key={i} className="text-red-600 text-xs">{e}</p>)}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => void copiarReporte()}
                  className="px-5 py-2.5 bg-white border border-border rounded-lg text-foreground font-medium text-sm hover:bg-muted transition-colors shadow-card flex items-center justify-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  {copiado ? 'Copiado ✓' : 'Copiar reporte'}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-5 py-2.5 bg-white border border-border rounded-lg text-foreground font-medium text-sm hover:bg-muted transition-colors shadow-card"
                >
                  Importar otro archivo
                </button>
              </div>
            </div>

            {/* Huérfanos: se repiten en el reporte, no solo en el preview */}
            {recon.huerfanos.length > 0 && (
              <div className="bg-white rounded-card shadow-card overflow-hidden border border-amber-300">
                <div className="px-4 py-3.5 bg-amber-50 border-b border-amber-200">
                  <h2 className="text-amber-900 font-bold text-sm">
                    Productos de la app que no vinieron en el CSV ({recon.huerfanos.length})
                  </h2>
                  <p className="text-amber-700 text-xs mt-0.5">
                    Su stock quedó SIN actualizar. Posible cod_art desalineado con Glaciar: revisalos contra el sistema.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className={thCls}>Cod.Art.</th>
                        <th className={thCls}>Descripción</th>
                        <th className={`${thCls} text-right`}>Stock app</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recon.huerfanos.map((h: Huerfano) => (
                        <tr key={h.producto.id} className="border-b border-border/50 last:border-0">
                          <td className={`${tdCls} font-mono text-foreground font-semibold whitespace-nowrap`}>
                            {h.producto.cod_art || '—'}
                            {h.motivoCodArt && (
                              <span className="ml-2 inline-flex px-1.5 py-0.5 bg-red-50 text-red-700 text-[10px] font-semibold rounded">
                                {ETIQUETA_COD_ART[h.motivoCodArt]}
                              </span>
                            )}
                          </td>
                          <td className={`${tdCls} text-foreground`}>{h.producto.descripcion}</td>
                          <td className={`${tdCls} text-right text-foreground font-semibold`}>{h.producto.stock_actual}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {resultado.codArtCorregidos.length > 0 && (
              <div className="bg-white rounded-card shadow-card px-4 py-3.5">
                <h2 className="text-foreground font-bold text-sm">Códigos corregidos ({resultado.codArtCorregidos.length})</h2>
                <p className="text-muted-foreground text-xs mt-0.5 mb-2">Estos productos quedaron alineados con Glaciar.</p>
                {resultado.codArtCorregidos.map((c, i) => (
                  <p key={i} className="text-xs text-foreground">
                    {c.descripcion}: <span className="font-mono text-muted-foreground line-through">{c.de}</span>{' '}
                    <span className="font-mono text-brand font-semibold">{c.a}</span>
                  </p>
                ))}
              </div>
            )}

            {resultado.insertadosConSimilar.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-card px-4 py-3.5">
                <p className="text-amber-900 font-bold text-sm">
                  Insertados pese a tener un similar ({resultado.insertadosConSimilar.length})
                </p>
                <p className="text-amber-700 text-xs mt-0.5 mb-2">
                  Se crearon como productos nuevos. Si alguno era en realidad el mismo producto, quedó duplicado.
                </p>
                {resultado.insertadosConSimilar.map((s, i) => (
                  <p key={i} className="text-amber-800 text-xs">
                    <span className="font-mono">{s.codArt}</span> {s.descripcion} — parecido a {s.similarA}
                  </p>
                ))}
              </div>
            )}

            {descartadas.length > 0 && (
              <div className="bg-white rounded-card shadow-card px-4 py-3.5">
                <h2 className="text-foreground font-bold text-sm">Filas descartadas del CSV ({descartadas.length})</h2>
                <p className="text-muted-foreground text-xs mt-0.5 mb-2">No se importaron.</p>
                {descartadas.map((d) => (
                  <p key={`${d.linea}-${d.codArt}`} className="text-xs text-muted-foreground">
                    línea {d.linea} · <span className="font-mono text-foreground">{d.codArt || '—'}</span> · {d.motivo}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
