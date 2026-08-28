export const IDS = {
  user: '11111111-1111-4111-8111-111111111111',
  org: '10000000-0000-4000-8000-000000000001',
  zona: '20000000-0000-4000-8000-000000000001',
  region: '30000000-0000-4000-8000-000000000001',
  s091: '00000000-0000-0000-0000-000000000001',
  s043: '00000000-0000-0000-0000-000000000043',
  accessOrg: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  accessStore: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
}

function jwtForUser() {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    aud: 'authenticated',
    exp: now + 7200,
    iat: now,
    sub: IDS.user,
    email: 'admin@noven.test',
    role: 'authenticated',
  })}.e2e-signature`
}

function authUser() {
  const now = new Date().toISOString()
  return {
    id: IDS.user,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'admin@noven.test',
    email_confirmed_at: now,
    confirmed_at: now,
    last_sign_in_at: now,
    phone: '',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { nombre: 'Admin E2E' },
    identities: [],
    created_at: now,
    updated_at: now,
  }
}

function authSession() {
  return {
    access_token: jwtForUser(),
    token_type: 'bearer',
    expires_in: 7200,
    expires_at: Math.floor(Date.now() / 1000) + 7200,
    refresh_token: 'e2e-refresh-token',
    user: authUser(),
  }
}

function expiryRow(storeId, quantity, code) {
  return {
    id: `bbbbbbbb-bbbb-4bbb-8bbb-${code.padStart(12, '0')}`,
    producto_id: `cccccccc-cccc-4ccc-8ccc-${code.padStart(12, '0')}`,
    sucursal_id: storeId,
    usuario_id: IDS.user,
    cantidad: quantity,
    lote: null,
    fecha_vencimiento: '2020-01-01',
    fecha_carga: '2026-08-28',
    activo: true,
    created_at: '2026-08-28T12:00:00Z',
    nivel_actual: 'decomiso',
    organizacion_id: IDS.org,
    cod_art: code,
    codigo_barras: `7790000${code}`,
    descripcion: storeId === IDS.s091 ? 'PRODUCTO E2E 091' : 'PRODUCTO E2E 043',
    marca: 'Noven Test',
    gramaje: '100 GR',
    categoria: 'TEST',
    proveedor: null,
    sector: 'ALMACEN',
    precio_costo: 100,
    imagen_url: null,
    imagen_thumb_url: null,
    familia_id: null,
    sector_id: null,
    sector_nombre: 'ALMACEN',
    dias_donacion: 10,
    producto_activo: true,
    producto_created_at: '2026-08-01T00:00:00Z',
    producto_updated_at: '2026-08-01T00:00:00Z',
    stock_actual: quantity,
    venta_media_diaria: 1,
  }
}

function eqValue(url, name) {
  const raw = url.searchParams.get(name) ?? ''
  return raw.startsWith('eq.') ? raw.slice(3) : raw
}

function jsonHeaders(extra = {}) {
  return { 'content-type': 'application/json; charset=utf-8', ...extra }
}

export async function installNovenFixture(page, options = {}) {
  const {
    profileActive = true,
    accesses = [
      {
        id: IDS.accessOrg,
        usuario_id: IDS.user,
        organizacion_id: IDS.org,
        rol: 'admin_organizacion',
        zona_id: null,
        sucursal_id: null,
        activo: true,
        created_at: '2026-08-28T00:00:00Z',
        updated_at: '2026-08-28T00:00:00Z',
      },
      {
        id: IDS.accessStore,
        usuario_id: IDS.user,
        organizacion_id: IDS.org,
        rol: 'gerente_sucursal',
        zona_id: null,
        sucursal_id: IDS.s091,
        activo: true,
        created_at: '2026-08-28T00:00:01Z',
        updated_at: '2026-08-28T00:00:01Z',
      },
    ],
  } = options

  const seenExpiryStores = []
  const externalNavigations = []

  page.on('request', (request) => {
    try {
      const url = new URL(request.url())
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) externalNavigations.push(url.href)
    } catch {
      // Ignorar URLs no estándar del navegador.
    }
  })

  await page.route('**/__supabase/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (path.endsWith('/auth/v1/token')) {
      return route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify(authSession()) })
    }
    if (path.endsWith('/auth/v1/user')) {
      return route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify(authUser()) })
    }
    if (path.includes('/auth/v1/logout')) {
      return route.fulfill({ status: 204, body: '' })
    }

    if (path.includes('/rest/v1/rpc/')) {
      return route.fulfill({ status: 200, headers: jsonHeaders(), body: '[]' })
    }

    const table = path.split('/rest/v1/')[1]?.split('/')[0] ?? ''
    if (table === 'usuarios') {
      return route.fulfill({
        status: 200,
        headers: jsonHeaders(),
        body: JSON.stringify({
          id: IDS.user,
          nombre: 'Admin E2E',
          rol: 'admin',
          sucursal_id: null,
          activo: profileActive,
        }),
      })
    }
    if (table === 'usuario_accesos') {
      return route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify(accesses) })
    }
    if (table === 'sucursales') {
      return route.fulfill({
        status: 200,
        headers: jsonHeaders(),
        body: JSON.stringify([
          { id: IDS.s091, codigo: '091', nombre: 'Sucursal 091 E2E', zona_id: IDS.zona, organizacion_id: IDS.org },
          { id: IDS.s043, codigo: '043', nombre: 'Sucursal 043 E2E', zona_id: IDS.zona, organizacion_id: IDS.org },
        ]),
      })
    }
    if (table === 'v_vencimientos_operativos') {
      const store = eqValue(url, 'sucursal_id')
      if (store) seenExpiryStores.push(store)
      const rows = store === IDS.s043
        ? [expiryRow(IDS.s043, 17, '4300001')]
        : store === IDS.s091
          ? [expiryRow(IDS.s091, 5, '9100001')]
          : []
      return route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify(rows) })
    }
    if (table === 'v_acciones_operativas_historial') {
      return route.fulfill({ status: 200, headers: jsonHeaders(), body: '[]' })
    }

    return route.fulfill({ status: 200, headers: jsonHeaders(), body: '[]' })
  })

  await page.route('**/.netlify/functions/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const fn = url.pathname.split('/.netlify/functions/')[1] ?? ''
    let body = {}
    try { body = request.postDataJSON() ?? {} } catch { body = {} }

    if (fn === 'admin-accesos') {
      if (body.accion !== 'listar') {
        return route.fulfill({ status: 400, headers: jsonHeaders(), body: JSON.stringify({ success: false, error: 'Acción E2E no soportada' }) })
      }
      return route.fulfill({
        status: 200,
        headers: jsonHeaders(),
        body: JSON.stringify({
          success: true,
          puede_crear_zonal: true,
          regiones: [{ id: IDS.region, codigo: 'SUR', nombre: 'Sur', organizacion_id: IDS.org }],
          zonas: [{ id: IDS.zona, codigo: 'SCS', nombre: 'Santa Cruz Sur', region_id: IDS.region, organizacion_id: IDS.org }],
          sucursales: [
            { id: IDS.s091, codigo: '091', nombre: 'Sucursal 091 E2E', zona_id: IDS.zona, organizacion_id: IDS.org },
            { id: IDS.s043, codigo: '043', nombre: 'Sucursal 043 E2E', zona_id: IDS.zona, organizacion_id: IDS.org },
          ],
          accesos_actor: accesses,
        }),
      })
    }
    if (fn === 'admin-invitaciones') {
      return route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify({ success: true, invitaciones: [] }) })
    }
    if (fn === 'admin-sucursal') {
      return route.fulfill({
        status: 200,
        headers: jsonHeaders(),
        body: JSON.stringify({
          success: true,
          sucursal: { id: IDS.s091, codigo: '091', nombre: 'Sucursal 091 E2E', organizacion_id: IDS.org },
          familias: [],
          sectores: [],
          usuarios: [],
        }),
      })
    }

    return route.fulfill({ status: 401, headers: jsonHeaders(), body: JSON.stringify({ success: false, error: 'No autorizado E2E' }) })
  })

  return { seenExpiryStores, externalNavigations }
}

export async function login(page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@noven.test')
  await page.getByLabel('Contraseña').fill('e2e-password')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL('**/dashboard')
}
