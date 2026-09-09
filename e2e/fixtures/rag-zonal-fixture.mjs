import { IDS, installNovenFixture } from './noven-fixture.mjs'

export const RAG_ZONAL_IDS = {
  access: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  request: '99999999-9999-4999-8999-999999999993',
}

function jsonHeaders() {
  return { 'content-type': 'application/json; charset=utf-8' }
}

export async function installRagZonalFixture(page) {
  await installNovenFixture(page, {
    accesses: [{
      id: RAG_ZONAL_IDS.access,
      usuario_id: IDS.user,
      organizacion_id: IDS.org,
      rol: 'administrativa_precios_zonal',
      zona_id: IDS.zona,
      sucursal_id: null,
      activo: true,
      created_at: '2026-09-09T14:00:00Z',
      updated_at: '2026-09-09T14:00:00Z',
    }],
  })

  const rpcCalls = []
  const directTableWrites = []
  let executed = false

  await page.route('**/__supabase/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (!path.includes('/rest/v1/')) return route.fallback()
    if (!path.includes('/rest/v1/rpc/') && !['GET', 'HEAD'].includes(request.method())) {
      directTableWrites.push({ method: request.method(), path, body: request.postData() })
    }
    if (!path.includes('/rest/v1/rpc/')) return route.fallback()

    const rpc = path.split('/rest/v1/rpc/')[1]?.split('/')[0] ?? ''
    let body = {}
    try { body = request.postDataJSON() ?? {} } catch { body = {} }

    if (rpc === 'ejecutar_solicitud_cambio_rag') {
      rpcCalls.push({ name: rpc, body })
      executed = true
      return route.fulfill({ status: 200, headers: jsonHeaders(), body: '9001' })
    }

    if (rpc === 'listar_bandeja_rag_zonal') {
      rpcCalls.push({ name: rpc, body })
      const response = {
        zonas: [{
          id: IDS.zona,
          codigo: 'SCS',
          nombre: 'Santa Cruz Sur',
          organizacion_id: IDS.org,
        }],
        solicitudes: [{
          id: RAG_ZONAL_IDS.request,
          zona_id: IDS.zona,
          zona_nombre: 'Santa Cruz Sur',
          sucursal_id: IDS.s043,
          sucursal_codigo: '043',
          sucursal_nombre: 'Sucursal 043 E2E',
          producto_codigo: '4300001',
          producto_descripcion: 'PRODUCTO RAG ZONAL E2E',
          sector_nombre: 'ALMACEN',
          familia_nombre: 'CONSERVAS',
          porcentaje_rag_vigente: 20,
          porcentaje_solicitado: 30,
          fecha_vencimiento: '2026-09-20',
          fin_accion: '2026-09-10',
          cantidad_comprometida: 12,
          creada_at: '2026-09-09T14:30:00Z',
          ultimo_evento: executed ? 'ejecutada' : 'solicitada',
          ultimo_evento_at: executed ? '2026-09-09T15:00:00Z' : '2026-09-09T14:30:00Z',
          habilitada_desde: executed ? '2026-09-10' : null,
          estado_actual: executed ? 'ejecutada_no_habilitada' : 'solicitada',
          validada_por_nombre: 'Gerencia E2E',
          requiere_ejecucion: !executed,
        }],
      }
      return route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify(response) })
    }

    return route.fallback()
  })

  return { rpcCalls, directTableWrites }
}
