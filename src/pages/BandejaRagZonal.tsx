import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Download, Loader2, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  agruparPorSucursal,
  etiquetaEstado,
  exportarBandejaXlsx,
  fechaCorta,
  fechaHoraArgentina,
  nombreArchivoExportacion,
  type BandejaZonal,
  type GrupoSucursal,
  type SolicitudBandeja,
  type ZonaBandeja,
} from '@/lib/bandeja-rag-zonal'

const EMPTY_DATA: BandejaZonal = { ahora_argentina: '', zonas: [], solicitudes: [] }

/**
 * ALINEACIÓN Y ANCHO DE CADA COLUMNA, DECLARADOS UNA SOLA VEZ. Encabezado y
 * celda leen de acá: si cada uno llevara su clase, derivarían —que es
 * exactamente lo que pasaba antes de este cambio, con títulos que no alineaban
 * con su dato.
 *
 * El criterio no es una preferencia: sale del archivo exportado, que quedó bien
 * ordenado y sirve de especificación. El escritor xlsx emite `t="n"` sólo para
 * números finitos, así que en el Excel se alinean a la derecha `RAG actual`,
 * `Nueva RAG` y `Stock comprometido`, y todo lo demás —`Código` incluido, que
 * viaja como texto— a la izquierda.
 *
 * El presupuesto de ancho está en `docs/BANDEJA_RAG_ZONAL_TABLA_V1.md`.
 */
const COLUMNAS = [
  { clave: 'sector', titulo: 'Sector / familia', clase: 'text-left w-[150px]' },
  { clave: 'codigo', titulo: 'Código', clase: 'text-left w-[110px]' },
  { clave: 'producto', titulo: 'Producto', clase: 'text-left min-w-[220px]' },
  { clave: 'ragActual', titulo: 'RAG actual', clase: 'text-right w-[85px]' },
  { clave: 'ragNueva', titulo: 'Nueva RAG', clase: 'text-right w-[85px]' },
  { clave: 'vencimiento', titulo: 'Vto. producto', clase: 'text-left w-[88px]' },
  { clave: 'finAccion', titulo: 'Fin de acción', clase: 'text-left w-[88px]' },
  { clave: 'stock', titulo: 'Stock compr.', clase: 'text-right w-[80px]' },
  { clave: 'validadaPor', titulo: 'Validado por', clase: 'text-left w-[130px]' },
  { clave: 'fechaValidacion', titulo: 'Fecha de validación', clase: 'text-left w-[120px]' },
  { clave: 'estado', titulo: 'Estado', clase: 'text-left w-[170px]' },
  { clave: 'accion', titulo: 'Acción', clase: 'text-left w-[130px]' },
] as const

type ClaveColumna = (typeof COLUMNAS)[number]['clave']

const CLASE_COLUMNA = Object.fromEntries(
  COLUMNAS.map((columna) => [columna.clave, columna.clase]),
) as Record<ClaveColumna, string>

/** El encabezado tiene contraste propio: gris sobre gris no se lee. */
const CLASE_ENCABEZADO = 'bg-slate-100 text-foreground'

/** Anclaje de las tres primeras columnas y de la acción. Ver el documento. */
const ANCLAJE: Partial<Record<ClaveColumna, string>> = {
  sector: 'md:sticky md:left-0 z-20',
  codigo: 'md:sticky md:left-[150px] z-20',
  producto: 'md:sticky md:left-[260px] z-20 shadow-[1px_0_0_0_hsl(var(--border))]',
  accion: 'md:sticky md:right-0 z-20 shadow-[-1px_0_0_0_hsl(var(--border))]',
}

function porcentaje(value: number | null): string {
  return value == null ? 'Sin RAG' : `${Number(value).toLocaleString('es-AR')}%`
}

function mensajeError(error: { code?: string; message?: string }): string {
  if (error.code === 'PGRST202' || /listar_bandeja_rag_zonal/i.test(error.message ?? '')) {
    return 'La bandeja zonal todavía no está habilitada en este entorno.'
  }
  return error.message || 'No se pudo cargar la bandeja zonal.'
}

function descargar(nombre: string, bytes: Uint8Array): void {
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)
}

export default function BandejaRagZonal() {
  const [data, setData] = useState<BandejaZonal>(EMPTY_DATA)
  const [zonaId, setZonaId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ejecutando, setEjecutando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: result, error: rpcError } = await supabase.rpc('listar_bandeja_rag_zonal')
    if (rpcError) {
      setData(EMPTY_DATA)
      setError(mensajeError(rpcError))
      setLoading(false)
      return
    }

    const next = (result ?? EMPTY_DATA) as BandejaZonal
    setData({
      ahora_argentina: next.ahora_argentina ?? '',
      zonas: next.zonas ?? [],
      solicitudes: next.solicitudes ?? [],
    })
    setZonaId((actual) => {
      if (actual && next.zonas?.some((zona) => zona.id === actual)) return actual
      return next.zonas?.[0]?.id ?? ''
    })
    setLoading(false)
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  const zona: ZonaBandeja | undefined = data.zonas.find((item) => item.id === zonaId)
  const solicitudes = useMemo(
    () => data.solicitudes.filter((solicitud) => solicitud.zona_id === zonaId),
    [data.solicitudes, zonaId],
  )
  const grupos = useMemo(() => agruparPorSucursal(solicitudes), [solicitudes])
  const pendientes = solicitudes.filter((solicitud) => solicitud.requiere_ejecucion).length

  async function ejecutar(solicitud: SolicitudBandeja) {
    const confirma = window.confirm(
      `¿Confirmás que cargaste ${solicitud.porcentaje_solicitado}% para ${solicitud.producto_descripcion} en la sucursal ${solicitud.sucursal_codigo}?`,
    )
    if (!confirma) return

    setEjecutando(solicitud.id)
    setError(null)
    const { error: rpcError } = await supabase.rpc('ejecutar_solicitud_cambio_rag', {
      p_solicitud_id: solicitud.id,
    })
    if (rpcError) setError(mensajeError(rpcError))
    else await cargar()
    setEjecutando(null)
  }

  function exportar(sucursal: GrupoSucursal | null) {
    if (!zona) return
    const alcance = sucursal ? sucursal.solicitudes : solicitudes
    if (alcance.length === 0) return
    const exportacion = { zona, sucursal, solicitudes: alcance }
    descargar(nombreArchivoExportacion(exportacion), exportarBandejaXlsx(exportacion))
  }

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="sticky top-0 z-10 bg-white border-b border-border/40 px-4 md:px-8 py-4 md:py-5">
        <div className="max-w-[1600px] mx-auto flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Bandeja zonal RAG</h1>
            <p className="text-sm text-muted-foreground mt-1">Cambios validados que deben cargarse en el sistema de precios.</p>
          </div>
          <button type="button" onClick={() => void cargar()} disabled={loading} className="h-10 px-3 rounded-xl border border-border bg-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 md:px-8 py-5 md:py-6 pb-28 space-y-4">
        {data.zonas.length > 1 && (
          <div className="bg-white rounded-card shadow-card p-4">
            <label className="text-xs font-bold uppercase tracking-wide text-foreground" htmlFor="zona-bandeja">Zona asignada</label>
            <select id="zona-bandeja" value={zonaId} onChange={(event) => setZonaId(event.target.value)} className="mt-1.5 w-full md:max-w-sm h-11 px-3 rounded-xl bg-surface-base border border-border">
              {data.zonas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </div>
        )}

        {zona && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-3 gap-3" aria-label="Resumen de la bandeja">
              <div className="bg-white rounded-card shadow-card p-4">
                <p className="text-xs text-muted-foreground">Zona</p>
                <p className="text-base font-bold text-foreground mt-1">{zona.nombre}</p>
              </div>
              <div className="bg-white rounded-card shadow-card p-4">
                <p className="text-xs text-muted-foreground">Pendientes de ejecución</p>
                <p className="text-2xl font-bold text-brand mt-1">{pendientes}</p>
              </div>
              <div className="bg-white rounded-card shadow-card p-4 col-span-2 md:col-span-1">
                <p className="text-xs text-muted-foreground">Ventana de recepción</p>
                <p className="text-base font-bold text-foreground mt-1">{zona.jornada_inicio} a {zona.jornada_corte}</p>
              </div>
            </section>

            <div className={`rounded-xl px-4 py-3 text-sm flex items-start gap-2 border ${zona.jornada_visible ? 'bg-white border-border text-foreground' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <Clock className="h-4 w-4 shrink-0 mt-0.5" />
              {zona.jornada_visible ? (
                <span>
                  Jornada del <strong>{fechaCorta(zona.jornada_visible)}</strong>.{' '}
                  {zona.ventana_abierta
                    ? 'La ventana está abierta: las solicitudes nuevas entran en tiempo real, dentro del bloque de su sucursal.'
                    : `La ventana cerró a las ${zona.jornada_corte}. Lo que se registre desde ahora se verá en la jornada del ${fechaCorta(zona.jornada_en_curso)}.`}
                </span>
              ) : (
                <span>
                  La ventana abre a las <strong>{zona.jornada_inicio}</strong>. Lo registrado para hoy espera hasta esa hora; acá sólo se muestran los pendientes de jornadas anteriores.
                </span>
              )}
            </div>
          </>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{error}
          </div>
        )}

        {zona && solicitudes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => exportar(null)} className="h-10 px-4 rounded-xl border border-border bg-white text-sm font-semibold flex items-center gap-2">
              <Download className="h-4 w-4" />Exportar toda la zona
            </button>
          </div>
        )}

        {loading && solicitudes.length === 0 ? (
          <div className="bg-white rounded-card shadow-card py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-brand" />
            <p className="text-sm">Cargando solicitudes de la zona...</p>
          </div>
        ) : solicitudes.length === 0 && !error ? (
          <div className="bg-white rounded-card shadow-card py-16 text-center px-5">
            <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
            <p className="mt-3 font-bold text-foreground">No hay cambios en esta jornada</p>
            <p className="mt-1 text-sm text-muted-foreground">Las solicitudes validadas de esta zona aparecerán acá al abrir la ventana.</p>
          </div>
        ) : (
          grupos.map((grupo) => (
            <section key={grupo.sucursal_id} className="space-y-2" aria-label={`Sucursal ${grupo.sucursal_codigo}`}>
              {/*
                * El encabezado del grupo, el título y los botones viven FUERA
                * del contenedor que scrollea: con la tabla corrida hacia la
                * derecha, perder de vista de qué sucursal es el bloque sería
                * peor que no agrupar.
                */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <h2 className="text-sm font-bold text-foreground">
                  Sucursal {grupo.sucursal_codigo} · {grupo.sucursal_nombre}
                  <span className="ml-2 text-xs font-semibold text-muted-foreground">{grupo.solicitudes.length}</span>
                </h2>
                <button type="button" onClick={() => exportar(grupo)} className="h-9 px-3 rounded-xl border border-border bg-white text-xs font-semibold flex items-center gap-2 shrink-0">
                  <Download className="h-3.5 w-3.5" />Exportar sucursal
                </button>
              </div>

              {/*
                * El scroll horizontal vive acá y no en la página. Debajo de
                * ~1400px la tabla se corre; `Código` y `Producto` quedan fijas
                * porque son las que identifican la fila —si se van, cada celda
                * restante queda sin dueño— y `Acción` queda fija a la derecha
                * porque el botón que resuelve la fila no puede salir de vista.
                *
                * En teléfono se suelta el anclaje: `Código` + `Producto` son
                * ~330px y en 390px dejarían 60px de ventana para scrollear.
                */}
              <div className="bg-white rounded-card shadow-card overflow-x-auto">
                <table className="w-full min-w-[1456px] border-collapse text-xs">
                  <caption className="sr-only">
                    Solicitudes de cambio RAG de la sucursal {grupo.sucursal_codigo}, {grupo.sucursal_nombre}
                  </caption>
                  <thead>
                    <tr className={`border-b-2 border-border ${CLASE_ENCABEZADO}`}>
                      {COLUMNAS.map((columna) => (
                        <Th key={columna.clave} columna={columna.clave} className={CLASE_ENCABEZADO}>
                          {columna.titulo}
                        </Th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.solicitudes.map((solicitud) => (
                      <tr key={solicitud.id} className="border-b border-border/60 last:border-0 hover:bg-surface-base/60">
                        <Td columna="sector" className="bg-white text-muted-foreground">
                          {solicitud.sector_nombre}
                          <span className="block">{solicitud.familia_nombre}</span>
                        </Td>
                        <Td columna="codigo" className="bg-white tabular-nums">{solicitud.producto_codigo}</Td>
                        <Td columna="producto" className="bg-white font-semibold text-foreground">
                          {solicitud.producto_descripcion}
                        </Td>
                        {/*
                          * El RAG vigente es CONTEXTO, no lo que se transcribe:
                          * va atenuado. Antes compartía celda con el nuevo
                          * —`30% → 50%`— y dos números con una flecha en el
                          * medio son más fáciles de copiar mal que uno solo en
                          * su columna. El archivo ya los tenía separados.
                          */}
                        <Td columna="ragActual" className="bg-white tabular-nums">
                          {porcentaje(solicitud.porcentaje_rag_vigente)}
                        </Td>
                        {/*
                          * `Nueva RAG` es EL dato de esta pantalla: es el único
                          * que se copia al sistema de precios, y un error acá
                          * es un precio mal cargado en góndola. Destacado con
                          * el color de marca y no con rojo, que en una tabla
                          * operativa se lee como alerta —lo contrario de lo que
                          * es—.
                          */}
                        <Td columna="ragNueva" className="bg-white tabular-nums font-bold text-brand text-sm">
                          {porcentaje(solicitud.porcentaje_solicitado)}
                        </Td>
                        <Td columna="vencimiento" className="bg-white tabular-nums whitespace-nowrap">{fechaCorta(solicitud.fecha_vencimiento) || '—'}</Td>
                        <Td columna="finAccion" className="bg-white tabular-nums whitespace-nowrap">{fechaCorta(solicitud.fin_accion) || '—'}</Td>
                        <Td columna="stock" className="bg-white tabular-nums">{Number(solicitud.cantidad_comprometida).toLocaleString('es-AR')}</Td>
                        <Td columna="validadaPor" className="bg-white">{solicitud.validada_por_nombre}</Td>
                        <Td columna="fechaValidacion" className="bg-white tabular-nums whitespace-nowrap">{fechaHoraArgentina(solicitud.creada_at) || 'Sin dato'}</Td>
                        <Td columna="estado" className="bg-white">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${solicitud.requiere_ejecucion ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {etiquetaEstado(solicitud.estado_actual)}
                          </span>
                          {/*
                            * Lo que antes era un párrafo por fila —«Carga
                            * informada. La sucursal podrá verificarla en
                            * góndola desde…»— cabe acá en un renglón.
                            */}
                          {!solicitud.requiere_ejecucion && solicitud.habilitada_desde && (
                            <span className="block mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                              Verifica desde {fechaCorta(solicitud.habilitada_desde)}
                            </span>
                          )}
                          {/*
                            * Una solicitud que volvió de góndola y se
                            * re-ejecutó queda otra vez en `lista_confirmacion`:
                            * sin esta marca es idéntica a una que nunca falló.
                            */}
                          {solicitud.reintentos_no_aplicada > 0 && (
                            <span className="block mt-0.5 text-[10px] font-bold text-amber-800">
                              {solicitud.reintentos_no_aplicada === 1
                                ? 'Ya volvió de góndola'
                                : `Volvió de góndola ${solicitud.reintentos_no_aplicada} veces`}
                            </span>
                          )}
                        </Td>
                        <Td columna="accion" className="bg-white">
                          {solicitud.requiere_ejecucion ? (
                            <button type="button" onClick={() => void ejecutar(solicitud)} disabled={ejecutando === solicitud.id} className="w-full h-9 px-3 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
                              {ejecutando === solicitud.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              Marcar Activo
                            </button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Carga informada</span>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  )
}

interface CeldaProps {
  columna: ClaveColumna
  children: ReactNode
  className?: string
}

/**
 * Encabezado y celda toman de `COLUMNAS` la MISMA clase de alineación y ancho.
 * Es la única forma de que el título siga alineado con su dato cuando alguien
 * cambie una de las dos cosas dentro de seis meses.
 */
function Th({ columna, children, className = '' }: CeldaProps) {
  return (
    <th
      scope="col"
      className={`px-3 py-2.5 font-semibold whitespace-nowrap ${CLASE_COLUMNA[columna]} ${ANCLAJE[columna] ?? ''} ${className}`}
    >
      {children}
    </th>
  )
}

function Td({ columna, children, className = '' }: CeldaProps) {
  return (
    <td className={`px-3 py-2 align-top text-muted-foreground ${CLASE_COLUMNA[columna]} ${ANCLAJE[columna] ?? ''} ${className}`}>
      {children}
    </td>
  )
}
