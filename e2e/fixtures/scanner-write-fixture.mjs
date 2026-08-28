import { IDS, installNovenFixture } from './noven-fixture.mjs'

export const SCANNER_IDS = {
  product: 'dddddddd-dddd-4ddd-8ddd-dddddddddd01',
  control: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01',
  family: 'ffffffff-ffff-4fff-8fff-fffffffffff1',
  codArt: '9101234',
  ean: '7790000910123',
}

function jsonHeaders(extra = {}) {
  return { 'content-type': 'application/json; charset=utf-8', ...extra }
}

function scannerProduct() {
  return {
    id: SCANNER_IDS.product,
    organizacion_id: IDS.org,
    cod_art: SCANNER_IDS.codArt,
    codigo_barras: SCANNER_IDS.ean,
    descripcion: 'PRODUCTO SCANNER E2E',
    marca: 'Noven Test',
    gramaje: '250 GR',
    categoria: 'TEST',
    proveedor: null,
    sector: 'ALMACEN',
    precio_costo: 100,
    imagen_url: null,
    imagen_thumb_url: null,
    familia_id: SCANNER_IDS.family,
    sector_id: null,
    activo: true,
    stock_actual: 12,
    venta_media_diaria: 2,
    dias_donacion: 10,
  }
}

function activeControl() {
  return {
    id: SCANNER_IDS.control,
    producto_id: SCANNER_IDS.product,
    sucursal_id: IDS.s091,
    usuario_id: IDS.user,
    cantidad: 8,
    lote: 'L-E2E',
    fecha_vencimiento: '2026-10-20',
    fecha_carga: '2026-08-28',
    activo: true,
    created_at: '2026-08-28T12:00:00Z',
    dias_donacion: 10,
  }
}

function rpcError(message) {
  return {
    status: 400,
    headers: jsonHeaders(),
    body: JSON.stringify({ code: 'P0001', details: null, hint: null, message }),
  }
}

function eqValue(url, name) {
  const raw = url.searchParams.get(name) ?? ''
  return raw.startsWith('eq.') ? raw.slice(3) : raw
}

export async function installScannerWriteFixture(page, options = {}) {
  const {
    hasActiveControl = false,
    atomicSaveError = null,
    controlSaveError = null,
  } = options

  await installNovenFixture(page)

  const rpcCalls = []
  const directTableWrites = []

  // Se registra después del fixture base y usa fallback para no alterar los
  // recorridos multitenant existentes. Sólo intercepta contratos del Scanner.
  await page.route('**/__supabase/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (!path.includes('/rest/v1/')) return route.fallback()

    if (!path.includes('/rest/v1/rpc/') && !['GET', 'HEAD'].includes(request.method())) {
      directTableWrites.push({ method: request.method(), path, body: request.postData() })
    }

    if (path.includes('/rest/v1/rpc/')) {
      const rpc = path.split('/rest/v1/rpc/')[1]?.split('/')[0] ?? ''
      let body = {}
      try { body = request.postDataJSON() ?? {} } catch { body = {} }

      if (rpc === 'buscar_producto_scanner') {
        const codigo = String(body.p_codigo ?? '').trim()
        const encontrado = codigo === SCANNER_IDS.codArt || codigo === SCANNER_IDS.ean
        return route.fulfill({
          status: 200,
          headers: jsonHeaders(),
          body: JSON.stringify(encontrado ? scannerProduct() : null),
        })
      }

      if (rpc === 'listar_familias_scanner') {
        return route.fulfill({ status: 200, headers: jsonHeaders(), body: '[]' })
      }

      if (rpc === 'modo_imagen_producto_operador') {
        return route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify('solo_lectura') })
      }

      if (rpc === 'guardar_vencimiento_y_stock_scanner_v1') {
        rpcCalls.push({ name: rpc, body })
        if (atomicSaveError) return route.fulfill(rpcError(atomicSaveError))
        return route.fulfill({ status: 200, headers: jsonHeaders(), body: 'null' })
      }

      if (rpc === 'registrar_control_vencimiento_dashboard') {
        rpcCalls.push({ name: rpc, body })
        if (controlSaveError) return route.fulfill(rpcError(controlSaveError))
        return route.fulfill({ status: 200, headers: jsonHeaders(), body: 'null' })
      }

      return route.fallback()
    }

    const table = path.split('/rest/v1/')[1]?.split('/')[0] ?? ''

    if (table === 'v_vencimientos_operativos' && eqValue(url, 'producto_id') === SCANNER_IDS.product) {
      return route.fulfill({
        status: 200,
        headers: jsonHeaders(),
        body: JSON.stringify(hasActiveControl ? [activeControl()] : []),
      })
    }

    if (table === 'v_seguimiento_rag_actual' && eqValue(url, 'vencimiento_id') === SCANNER_IDS.control) {
      const row = hasActiveControl
        ? {
            dias_donacion: 10,
            rag_porcentaje: null,
            rag_aplicado_at: null,
            cantidad_base_rag: null,
            cantidad_observada: 8,
            unidades_vendidas_observadas: null,
            velocidad_observada: null,
            velocidad_necesaria: 0.25,
            dias_comerciales_restantes: 43,
            estado_seguimiento_rag: 'sin_rag',
          }
        : null
      return route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify(row) })
    }

    return route.fallback()
  })

  return { rpcCalls, directTableWrites }
}
