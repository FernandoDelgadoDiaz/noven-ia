// Los caminos que se miden en el ítem 3.3.
//
// Cada uno reproduce lo que la aplicación ejecuta de verdad, no una versión
// simplificada: si la consulta medida no es la que corre en producción, el plan
// tampoco lo es y la medición no autoriza nada.
//
// El reloj está fijo en la misma fecha que usa el dataset. Medir contra
// `now()` haría que el conjunto de filas devueltas cambiara según el día, y con
// él el plan: la comparación entre dos corridas dejaría de significar algo.

export const HOY = '2026-09-01'

/**
 * @param {{sucursal: string, organizacion: string}} ctx
 */
export function consultas(ctx) {
  const { sucursal } = ctx
  return [
    {
      id: 'vencimientos-lista',
      titulo: 'Vencimientos · lista operativa',
      porQue:
        'La pantalla más usada y la que más crece. Atraviesa la vista con ' +
        'security_invoker, así que mide también el costo de RLS por fila.',
      sql: `
        SELECT id, producto_id, sucursal_id, cantidad, fecha_vencimiento, nivel_actual
        FROM public.v_vencimientos_operativos
        WHERE sucursal_id = $1
          AND activo = true
          AND fecha_vencimiento >= DATE '${HOY}'
        ORDER BY fecha_vencimiento ASC
        LIMIT 200`,
      params: [sucursal],
    },
    {
      id: 'vencimientos-tabla-base',
      titulo: 'Vencimientos · misma consulta sobre la tabla base',
      porQue:
        'Control deliberado. Comparado contra el camino de la vista, aísla ' +
        'cuánto cuesta la vista en sí y cuánto cuestan las políticas de la ' +
        'tabla. Sin este par, una diferencia se le podría atribuir a cualquiera ' +
        'de los dos.',
      sql: `
        SELECT id, producto_id, sucursal_id, cantidad, fecha_vencimiento, nivel_actual
        FROM public.vencimientos
        WHERE sucursal_id = $1
          AND activo = true
          AND fecha_vencimiento >= DATE '${HOY}'
        ORDER BY fecha_vencimiento ASC
        LIMIT 200`,
      params: [sucursal],
    },
    {
      id: 'vencimientos-con-producto',
      titulo: 'Vencimientos · con datos de producto y presencia',
      porQue:
        'El join que necesita el motor de riesgo: venta media diaria y días de ' +
        'donación del sector salen de acá. Es el camino real de la pantalla, no ' +
        'la lista pelada.',
      sql: `
        SELECT v.id, v.fecha_vencimiento, v.cantidad,
               p.descripcion, ps.venta_media_diaria, s.dias_donacion
        FROM public.vencimientos v
        JOIN public.productos p ON p.id = v.producto_id
        JOIN public.producto_sucursal ps
          ON ps.producto_id = v.producto_id AND ps.sucursal_id = v.sucursal_id
        LEFT JOIN public.familias f ON f.id = p.familia_id
        LEFT JOIN public.sectores s ON s.id = f.sector_id
        WHERE v.sucursal_id = $1
          AND v.activo = true
          AND v.fecha_vencimiento >= DATE '${HOY}'
        ORDER BY v.fecha_vencimiento ASC
        LIMIT 200`,
      params: [sucursal],
    },
    {
      id: 'dashboard-por-familia',
      titulo: 'Dashboard · agregado por familia',
      porQue:
        'Agregación sobre toda la sucursal, sin LIMIT que la salve. Es el ' +
        'camino que peor debería escalar por volumen puro.',
      sql: `
        SELECT f.id, f.nombre,
               count(*) AS total,
               count(*) FILTER (WHERE v.fecha_vencimiento < DATE '${HOY}') AS vencidos
        FROM public.vencimientos v
        JOIN public.productos p ON p.id = v.producto_id
        LEFT JOIN public.familias f ON f.id = p.familia_id
        WHERE v.sucursal_id = $1 AND v.activo = true
        GROUP BY f.id, f.nombre
        ORDER BY total DESC`,
      params: [sucursal],
    },
    {
      id: 'scanner-por-codigo-barras',
      titulo: 'Scanner · lookup por código de barras',
      porQue:
        'El único camino con expectativa de latencia dura: lo usa una persona ' +
        'parada frente a la góndola. Devuelve una fila o ninguna.',
      sql: `
        SELECT p.id, p.cod_art, p.descripcion, ps.stock_actual
        FROM public.productos p
        LEFT JOIN public.producto_sucursal ps
          ON ps.producto_id = p.id AND ps.sucursal_id = $1
        WHERE p.codigo_barras = $2
        LIMIT 1`,
      params: [sucursal, '7791000000500'],
    },
    {
      id: 'scanner-por-cod-art',
      titulo: 'Scanner · lookup por cod_art',
      porQue: 'La otra mitad del scanner: cuando el código de barras no resuelve.',
      sql: `
        SELECT p.id, p.cod_art, p.descripcion, ps.stock_actual
        FROM public.productos p
        LEFT JOIN public.producto_sucursal ps
          ON ps.producto_id = p.id AND ps.sucursal_id = $1
        WHERE p.cod_art = $2
        LIMIT 1`,
      params: [sucursal, 'CA100000500'],
    },
    {
      id: 'analisis-ventana-trimestral',
      titulo: 'Análisis · sólo la parte SQL',
      porQue:
        'La consulta del trimestre en curso contra la ventana equivalente ' +
        'previa. NO se mide la llamada a OpenAI: es latencia de red de un ' +
        'tercero y contaminaría el resultado.',
      sql: `
        SELECT date_trunc('month', v.fecha_vencimiento) AS mes,
               count(*) AS total,
               sum(v.cantidad) AS unidades
        FROM public.vencimientos v
        WHERE v.sucursal_id = $1
          AND v.fecha_vencimiento >= DATE '${HOY}' - INTERVAL '6 months'
          AND v.fecha_vencimiento < DATE '${HOY}' + INTERVAL '3 months'
        GROUP BY 1
        ORDER BY 1`,
      params: [sucursal],
    },
  ]
}
