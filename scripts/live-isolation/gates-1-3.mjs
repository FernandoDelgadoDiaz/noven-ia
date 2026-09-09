import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const IDS = Object.freeze({
  orgA: '10000000-0000-4000-8000-000000000001',
  orgB: '10000000-0000-4000-8000-000000000002',
  regionA: '11000000-0000-4000-8000-000000000001',
  regionB: '11000000-0000-4000-8000-000000000002',
  zoneA1: '12000000-0000-4000-8000-000000000001',
  zoneA2: '12000000-0000-4000-8000-000000000002',
  zoneB1: '12000000-0000-4000-8000-000000000003',
  storeA1: '13000000-0000-4000-8000-000000000001',
  storeA2: '13000000-0000-4000-8000-000000000002',
  storeA3: '13000000-0000-4000-8000-000000000003',
  storeB1: '13000000-0000-4000-8000-000000000004',
  sectorA: '14000000-0000-4000-8000-000000000001',
  sectorB: '14000000-0000-4000-8000-000000000002',
  familyA: '15000000-0000-4000-8000-000000000001',
  familyB: '15000000-0000-4000-8000-000000000002',
  productA: '16000000-0000-4000-8000-000000000001',
  productB: '16000000-0000-4000-8000-000000000002',
  productStoreA1: '17000000-0000-4000-8000-000000000001',
  productStoreA2: '17000000-0000-4000-8000-000000000002',
  productStoreA3: '17000000-0000-4000-8000-000000000003',
  productStoreB1: '17000000-0000-4000-8000-000000000004',
  expiryA1: '18000000-0000-4000-8000-000000000001',
  ragRequestA1: '19000000-0000-4000-8000-000000000001',
})

const USERS = Object.freeze({
  operatorA1: {
    email: 'gate1.operator.a1@example.com',
    password: 'Noven-Live-Gate-Operator-2026!',
    name: 'Gate Operator A1',
    legacyRole: 'operador',
    scopeRole: 'operador',
    storeId: IDS.storeA1,
    zoneId: null,
  },
  managerA1: {
    email: 'gate2.manager.a1@example.com',
    password: 'Noven-Live-Gate-Manager-2026!',
    name: 'Gate Manager A1',
    legacyRole: 'admin',
    scopeRole: 'gerente_sucursal',
    storeId: IDS.storeA1,
    zoneId: null,
  },
  zoneManagerA1: {
    email: 'gate3.zone.a1@example.com',
    password: 'Noven-Live-Gate-Zone-2026!',
    name: 'Gate Zone Manager A1',
    legacyRole: 'supervisor',
    scopeRole: 'gerente_zonal',
    storeId: null,
    zoneId: IDS.zoneA1,
  },
  priceAdminA1: {
    email: 'gate4.prices.a1@example.com',
    password: 'Noven-Live-Gate-Prices-A1-2026!',
    name: 'Gate Price Admin A1',
    legacyRole: 'supervisor',
    scopeRole: 'administrativa_precios_zonal',
    storeId: null,
    zoneId: IDS.zoneA1,
  },
  priceAdminA2: {
    email: 'gate4.prices.a2@example.com',
    password: 'Noven-Live-Gate-Prices-A2-2026!',
    name: 'Gate Price Admin A2',
    legacyRole: 'supervisor',
    scopeRole: 'administrativa_precios_zonal',
    storeId: null,
    zoneId: IDS.zoneA2,
  },
})

function required(value, message) {
  assert.ok(value, message)
  return value
}

export function requireDisposableLocalEnvironment(env = process.env) {
  assert.equal(
    env.NOVEN_EPHEMERAL_REPLAY,
    '1',
    'live isolation requires NOVEN_EPHEMERAL_REPLAY=1',
  )

  const apiUrl = new URL(required(env.SUPABASE_URL, 'missing local SUPABASE_URL'))
  assert.ok(
    ['127.0.0.1', 'localhost'].includes(apiUrl.hostname),
    `refusing live isolation against non-local Supabase host: ${apiUrl.hostname}`,
  )
  assert.equal(apiUrl.protocol, 'http:', 'local Supabase URL must use http')

  return {
    apiUrl: apiUrl.toString().replace(/\/$/, ''),
    anonKey: required(env.SUPABASE_ANON_KEY, 'missing local SUPABASE_ANON_KEY'),
    serviceRoleKey: required(
      env.SUPABASE_SERVICE_ROLE_KEY,
      'missing local SUPABASE_SERVICE_ROLE_KEY',
    ),
  }
}

function responseSummary(response, body) {
  return `${response.status} ${response.statusText}: ${body.slice(0, 500)}`
}

async function requestJson(url, { apikey, token, method = 'GET', body, prefer } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      apikey,
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const raw = await response.text()
  let data = null
  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      data = raw
    }
  }
  return { response, raw, data }
}

function assertOk(label, result) {
  assert.ok(result.response.ok, `${label}: ${responseSummary(result.response, result.raw)}`)
  return result.data
}

function authHeaders(environment) {
  return {
    apikey: environment.anonKey,
  }
}

function serviceHeaders(environment) {
  return {
    apikey: environment.serviceRoleKey,
    token: environment.serviceRoleKey,
  }
}

async function createAuthUser(environment, user) {
  const result = await requestJson(`${environment.apiUrl}/auth/v1/admin/users`, {
    ...serviceHeaders(environment),
    method: 'POST',
    body: {
      email: user.email,
      password: user.password,
      email_confirm: true,
    },
  })
  const created = assertOk(`create Auth user ${user.email}`, result)
  const id = created?.id ?? created?.user?.id
  assert.match(id ?? '', /^[0-9a-f-]{36}$/i, `Auth did not return an id for ${user.email}`)
  return { ...user, id }
}

async function signIn(environment, user) {
  const result = await requestJson(
    `${environment.apiUrl}/auth/v1/token?grant_type=password`,
    {
      ...authHeaders(environment),
      token: environment.anonKey,
      method: 'POST',
      body: { email: user.email, password: user.password },
    },
  )
  const session = assertOk(`sign in ${user.email}`, result)
  assert.equal(session?.user?.id, user.id, `Auth returned another user for ${user.email}`)
  assert.match(session?.access_token ?? '', /^[^.]+\.[^.]+\.[^.]+$/)

  const payload = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url'))
  assert.equal(payload.sub, user.id)
  assert.equal(payload.role, 'authenticated')
  return session.access_token
}

async function insertRows(environment, table, rows) {
  const result = await requestJson(`${environment.apiUrl}/rest/v1/${table}`, {
    ...serviceHeaders(environment),
    method: 'POST',
    prefer: 'return=representation',
    body: rows,
  })
  const inserted = assertOk(`insert ${table}`, result)
  assert.equal(inserted.length, rows.length, `${table}: unexpected inserted row count`)
  return inserted
}

async function selectRows(environment, table, token, query) {
  const result = await requestJson(`${environment.apiUrl}/rest/v1/${table}?${query}`, {
    apikey: environment.anonKey,
    token,
  })
  const rows = assertOk(`select ${table}`, result)
  assert.ok(Array.isArray(rows), `${table}: expected an array`)
  return rows
}

async function selectAsService(environment, table, query) {
  const result = await requestJson(`${environment.apiUrl}/rest/v1/${table}?${query}`, {
    ...serviceHeaders(environment),
  })
  const rows = assertOk(`service select ${table}`, result)
  assert.ok(Array.isArray(rows), `${table}: expected a service array`)
  return rows
}

function sortedIds(rows, field) {
  return rows.map((row) => row[field]).sort()
}

async function installFixtures(environment) {
  const users = {}
  for (const [key, user] of Object.entries(USERS)) {
    users[key] = await createAuthUser(environment, user)
  }

  await insertRows(environment, 'organizaciones', [
    { id: IDS.orgA, codigo: 'GATE_ORG_A', nombre: 'Gate Organization A' },
    { id: IDS.orgB, codigo: 'GATE_ORG_B', nombre: 'Gate Organization B' },
  ])
  await insertRows(environment, 'regiones', [
    { id: IDS.regionA, organizacion_id: IDS.orgA, codigo: 'RA', nombre: 'Region A' },
    { id: IDS.regionB, organizacion_id: IDS.orgB, codigo: 'RB', nombre: 'Region B' },
  ])
  await insertRows(environment, 'zonas', [
    {
      id: IDS.zoneA1,
      organizacion_id: IDS.orgA,
      region_id: IDS.regionA,
      codigo: 'ZA1',
      nombre: 'Zone A1',
    },
    {
      id: IDS.zoneA2,
      organizacion_id: IDS.orgA,
      region_id: IDS.regionA,
      codigo: 'ZA2',
      nombre: 'Zone A2',
    },
    {
      id: IDS.zoneB1,
      organizacion_id: IDS.orgB,
      region_id: IDS.regionB,
      codigo: 'ZB1',
      nombre: 'Zone B1',
    },
  ])
  await insertRows(environment, 'sucursales', [
    {
      id: IDS.storeA1,
      organizacion_id: IDS.orgA,
      zona_id: IDS.zoneA1,
      codigo: 'A01',
      nombre: 'Store A1',
    },
    {
      id: IDS.storeA2,
      organizacion_id: IDS.orgA,
      zona_id: IDS.zoneA1,
      codigo: 'A02',
      nombre: 'Store A2',
    },
    {
      id: IDS.storeA3,
      organizacion_id: IDS.orgA,
      zona_id: IDS.zoneA2,
      codigo: 'A03',
      nombre: 'Store A3',
    },
    {
      id: IDS.storeB1,
      organizacion_id: IDS.orgB,
      zona_id: IDS.zoneB1,
      codigo: 'B01',
      nombre: 'Store B1',
    },
  ])
  await insertRows(environment, 'sectores', [
    {
      id: IDS.sectorA,
      organizacion_id: IDS.orgA,
      codigo: 'SA',
      nombre: 'Sector A',
      dias_donacion: 10,
    },
    {
      id: IDS.sectorB,
      organizacion_id: IDS.orgB,
      codigo: 'SB',
      nombre: 'Sector B',
      dias_donacion: 10,
    },
  ])
  await insertRows(environment, 'familias', [
    {
      id: IDS.familyA,
      organizacion_id: IDS.orgA,
      sector_id: IDS.sectorA,
      codigo: 'FA',
      nombre: 'Family A',
    },
    {
      id: IDS.familyB,
      organizacion_id: IDS.orgB,
      sector_id: IDS.sectorB,
      codigo: 'FB',
      nombre: 'Family B',
    },
  ])
  await insertRows(environment, 'productos', [
    {
      id: IDS.productA,
      organizacion_id: IDS.orgA,
      familia_id: IDS.familyA,
      cod_art: '1000001',
      descripcion: 'Gate Product A',
      stock_actual: 0,
      venta_media_diaria: 0,
    },
    {
      id: IDS.productB,
      organizacion_id: IDS.orgB,
      familia_id: IDS.familyB,
      cod_art: '2000001',
      descripcion: 'Gate Product B',
      stock_actual: 0,
      venta_media_diaria: 0,
    },
  ])
  await insertRows(environment, 'producto_sucursal', [
    {
      id: IDS.productStoreA1,
      organizacion_id: IDS.orgA,
      producto_id: IDS.productA,
      sucursal_id: IDS.storeA1,
      stock_actual: 11,
      venta_media_diaria: 1,
    },
    {
      id: IDS.productStoreA2,
      organizacion_id: IDS.orgA,
      producto_id: IDS.productA,
      sucursal_id: IDS.storeA2,
      stock_actual: 22,
      venta_media_diaria: 2,
    },
    {
      id: IDS.productStoreA3,
      organizacion_id: IDS.orgA,
      producto_id: IDS.productA,
      sucursal_id: IDS.storeA3,
      stock_actual: 33,
      venta_media_diaria: 3,
    },
    {
      id: IDS.productStoreB1,
      organizacion_id: IDS.orgB,
      producto_id: IDS.productB,
      sucursal_id: IDS.storeB1,
      stock_actual: 44,
      venta_media_diaria: 4,
    },
  ])

  await insertRows(
    environment,
    'usuarios',
    Object.values(users).map((user) => ({
      id: user.id,
      nombre: user.name,
      rol: user.legacyRole,
      sucursal_id: user.storeId,
      activo: true,
    })),
  )
  await insertRows(
    environment,
    'usuario_accesos',
    Object.values(users).map((user) => ({
      usuario_id: user.id,
      organizacion_id: IDS.orgA,
      rol: user.scopeRole,
      zona_id: user.zoneId,
      sucursal_id: user.storeId,
      activo: true,
    })),
  )
  await insertRows(environment, 'usuario_familias_sucursal', [
    {
      usuario_id: users.operatorA1.id,
      organizacion_id: IDS.orgA,
      sucursal_id: IDS.storeA1,
      familia_id: IDS.familyA,
      activo: true,
    },
  ])
  await insertRows(environment, 'rag_escala_descuento', [
    { organizacion_id: IDS.orgA, escalon: 1, porcentaje: 20 },
    { organizacion_id: IDS.orgA, escalon: 2, porcentaje: 30 },
  ])
  await insertRows(environment, 'vencimientos', [{
    id: IDS.expiryA1,
    producto_id: IDS.productA,
    sucursal_id: IDS.storeA1,
    usuario_id: users.managerA1.id,
    cantidad: 12,
    fecha_vencimiento: '2030-12-31',
    fecha_carga: '2030-12-01',
    activo: true,
  }])
  await insertRows(environment, 'solicitudes_cambio_rag', [{
    id: IDS.ragRequestA1,
    organizacion_id: IDS.orgA,
    zona_id: IDS.zoneA1,
    sucursal_id: IDS.storeA1,
    producto_id: IDS.productA,
    vencimiento_id: IDS.expiryA1,
    solicitada_por: users.managerA1.id,
    porcentaje_rag_vigente: 20,
    porcentaje_solicitado: 30,
    cobertura_al_sugerir: 0.5,
    escalones_sugeridos: 1,
    velocidad_observada: 0.5,
    velocidad_necesaria: 1,
    dias_comerciales_restantes: 10,
    cantidad_comprometida: 12,
    vmd_glaciar: 1,
    fecha_vencimiento: '2030-12-31',
    fin_accion: '2030-12-21',
    producto_codigo: '1000001',
    producto_descripcion: 'Gate Product A',
    sector_nombre: 'Sector A',
    familia_nombre: 'Family A',
  }])
  await insertRows(environment, 'solicitud_cambio_rag_eventos', [{
    solicitud_id: IDS.ragRequestA1,
    tipo: 'solicitada',
    actor_id: users.managerA1.id,
  }])

  return users
}

async function gate1(environment, token) {
  const productRows = await selectRows(
    environment,
    'producto_sucursal',
    token,
    `select=sucursal_id,producto_id,stock_actual&producto_id=eq.${IDS.productA}`,
  )
  assert.deepEqual(sortedIds(productRows, 'sucursal_id'), [IDS.storeA1])

  const foreignOrgRows = await selectRows(
    environment,
    'producto_sucursal',
    token,
    `select=sucursal_id&producto_id=eq.${IDS.productB}`,
  )
  assert.deepEqual(foreignOrgRows, [])

  const directMutation = await requestJson(
    `${environment.apiUrl}/rest/v1/producto_sucursal?sucursal_id=eq.${IDS.storeA2}&producto_id=eq.${IDS.productA}`,
    {
      apikey: environment.anonKey,
      token,
      method: 'PATCH',
      prefer: 'return=representation',
      body: { stock_actual: 999 },
    },
  )
  assert.equal(
    directMutation.response.status,
    403,
    `cross-store direct PATCH was not rejected: ${responseSummary(directMutation.response, directMutation.raw)}`,
  )

  const allowedRpc = await requestJson(
    `${environment.apiUrl}/rest/v1/rpc/guardar_vencimiento_y_stock_scanner_v1`,
    {
      apikey: environment.anonKey,
      token,
      method: 'POST',
      body: {
        p_producto_id: IDS.productA,
        p_sucursal_id: IDS.storeA1,
        p_cantidad: 1,
        p_fecha_vencimiento: '2030-12-31',
        p_lote: 'GATE-A1',
        p_stock_actual: 12,
        p_vencimiento_id: null,
      },
    },
  )
  assertOk('operator in-scope RPC', allowedRpc)

  const blockedRpc = await requestJson(
    `${environment.apiUrl}/rest/v1/rpc/guardar_vencimiento_y_stock_scanner_v1`,
    {
      apikey: environment.anonKey,
      token,
      method: 'POST',
      body: {
        p_producto_id: IDS.productA,
        p_sucursal_id: IDS.storeA2,
        p_cantidad: 1,
        p_fecha_vencimiento: '2030-12-31',
        p_lote: 'GATE-A2-BLOCKED',
        p_stock_actual: 999,
        p_vencimiento_id: null,
      },
    },
  )
  assert.equal(
    blockedRpc.response.status,
    403,
    `cross-store RPC was not rejected: ${responseSummary(blockedRpc.response, blockedRpc.raw)}`,
  )

  const storeA2 = await selectAsService(
    environment,
    'producto_sucursal',
    `select=stock_actual&sucursal_id=eq.${IDS.storeA2}&producto_id=eq.${IDS.productA}`,
  )
  assert.deepEqual(storeA2, [{ stock_actual: 22 }])
  const storeA2Expiries = await selectAsService(
    environment,
    'vencimientos',
    `select=id&sucursal_id=eq.${IDS.storeA2}&producto_id=eq.${IDS.productA}`,
  )
  assert.deepEqual(storeA2Expiries, [])

  console.log('✓ Gate 1: operador A1 lee/escribe A1 y no consulta ni muta A2/Org B')
}

async function gate2(environment, token) {
  const storeRows = await selectRows(
    environment,
    'sucursales',
    token,
    'select=id&order=id.asc',
  )
  assert.deepEqual(sortedIds(storeRows, 'id'), [IDS.storeA1])

  const productRows = await selectRows(
    environment,
    'producto_sucursal',
    token,
    `select=sucursal_id&producto_id=eq.${IDS.productA}`,
  )
  assert.deepEqual(sortedIds(productRows, 'sucursal_id'), [IDS.storeA1])

  const storeA2Rows = await selectRows(
    environment,
    'producto_sucursal',
    token,
    `select=sucursal_id&sucursal_id=eq.${IDS.storeA2}`,
  )
  assert.deepEqual(storeA2Rows, [])

  console.log('✓ Gate 2: gerente de sucursal A1 no consulta A2 ni otra organización')
}

async function gate3(environment, token) {
  const stores = await selectRows(environment, 'sucursales', token, 'select=id&order=id.asc')
  assert.deepEqual(sortedIds(stores, 'id'), [IDS.storeA1, IDS.storeA2])

  const products = await selectRows(
    environment,
    'producto_sucursal',
    token,
    `select=sucursal_id&producto_id=eq.${IDS.productA}`,
  )
  assert.deepEqual(sortedIds(products, 'sucursal_id'), [IDS.storeA1, IDS.storeA2])

  const zones = await selectRows(environment, 'zonas', token, 'select=id&order=id.asc')
  assert.deepEqual(sortedIds(zones, 'id'), [IDS.zoneA1])

  const organizations = await selectRows(
    environment,
    'organizaciones',
    token,
    'select=id&order=id.asc',
  )
  assert.deepEqual(sortedIds(organizations, 'id'), [IDS.orgA])

  console.log('✓ Gate 3: gerente zonal A1 ve A1/A2 y queda fuera de Zona A2/Org B')
}

async function gate4(environment, tokens, users) {
  const managerList = await requestJson(
    `${environment.apiUrl}/rest/v1/rpc/listar_bandeja_rag_zonal`,
    { apikey: environment.anonKey, token: tokens.managerA1, method: 'POST', body: {} },
  )
  assert.equal(
    managerList.response.status,
    403,
    `manager entered price-admin tray: ${responseSummary(managerList.response, managerList.raw)}`,
  )

  const zoneA2List = assertOk('price admin A2 tray', await requestJson(
    `${environment.apiUrl}/rest/v1/rpc/listar_bandeja_rag_zonal`,
    { apikey: environment.anonKey, token: tokens.priceAdminA2, method: 'POST', body: {} },
  ))
  assert.deepEqual(zoneA2List.zonas.map((zone) => zone.id), [IDS.zoneA2])
  assert.deepEqual(zoneA2List.solicitudes, [])

  const blockedExecution = await requestJson(
    `${environment.apiUrl}/rest/v1/rpc/ejecutar_solicitud_cambio_rag`,
    {
      apikey: environment.anonKey,
      token: tokens.priceAdminA2,
      method: 'POST',
      body: { p_solicitud_id: IDS.ragRequestA1 },
    },
  )
  assert.equal(
    blockedExecution.response.status,
    403,
    `cross-zone execution was not rejected: ${responseSummary(blockedExecution.response, blockedExecution.raw)}`,
  )

  const zoneA1List = assertOk('price admin A1 tray', await requestJson(
    `${environment.apiUrl}/rest/v1/rpc/listar_bandeja_rag_zonal`,
    { apikey: environment.anonKey, token: tokens.priceAdminA1, method: 'POST', body: {} },
  ))
  assert.deepEqual(zoneA1List.zonas.map((zone) => zone.id), [IDS.zoneA1])
  assert.deepEqual(zoneA1List.solicitudes.map((request) => request.id), [IDS.ragRequestA1])
  assert.equal(zoneA1List.solicitudes[0].requiere_ejecucion, true)

  const directEvent = await requestJson(
    `${environment.apiUrl}/rest/v1/solicitud_cambio_rag_eventos`,
    {
      apikey: environment.anonKey,
      token: tokens.priceAdminA1,
      method: 'POST',
      prefer: 'return=representation',
      body: {
        solicitud_id: IDS.ragRequestA1,
        tipo: 'ejecutada',
        actor_id: users.priceAdminA1.id,
        habilitada_desde: '2030-01-01',
      },
    },
  )
  assert.equal(
    directEvent.response.status,
    403,
    `direct event INSERT was not rejected: ${responseSummary(directEvent.response, directEvent.raw)}`,
  )

  const firstExecution = assertOk('price admin A1 execution', await requestJson(
    `${environment.apiUrl}/rest/v1/rpc/ejecutar_solicitud_cambio_rag`,
    {
      apikey: environment.anonKey,
      token: tokens.priceAdminA1,
      method: 'POST',
      body: { p_solicitud_id: IDS.ragRequestA1 },
    },
  ))
  const repeatedExecution = assertOk('price admin A1 repeated execution', await requestJson(
    `${environment.apiUrl}/rest/v1/rpc/ejecutar_solicitud_cambio_rag`,
    {
      apikey: environment.anonKey,
      token: tokens.priceAdminA1,
      method: 'POST',
      body: { p_solicitud_id: IDS.ragRequestA1 },
    },
  ))
  assert.equal(repeatedExecution, firstExecution, 'retry returned a different event')

  const events = await selectAsService(
    environment,
    'solicitud_cambio_rag_eventos',
    `select=id,tipo,actor_id,habilitada_desde&solicitud_id=eq.${IDS.ragRequestA1}&order=id.asc`,
  )
  assert.equal(events.length, 2, 'double click created more than one execution event')
  assert.deepEqual(events.map((event) => event.tipo), ['solicitada', 'ejecutada'])
  assert.equal(events[1].actor_id, users.priceAdminA1.id)
  assert.match(events[1].habilitada_desde ?? '', /^\d{4}-\d{2}-\d{2}$/)

  const interventions = await selectAsService(
    environment,
    'intervenciones_rag',
    `select=id&solicitud_cambio_rag_id=eq.${IDS.ragRequestA1}`,
  )
  assert.deepEqual(interventions, [], 'execution opened a RAG intervention')

  const afterExecution = assertOk('price admin A1 tray after execution', await requestJson(
    `${environment.apiUrl}/rest/v1/rpc/listar_bandeja_rag_zonal`,
    { apikey: environment.anonKey, token: tokens.priceAdminA1, method: 'POST', body: {} },
  ))
  assert.equal(afterExecution.solicitudes[0].requiere_ejecucion, false)

  console.log('✓ Gate 4: administrativa ejecuta sólo su zona, sin DML directo, duplicados ni intervención')
}

export async function runGates(env = process.env) {
  const environment = requireDisposableLocalEnvironment(env)
  const rootProbe = await requestJson(
    `${environment.apiUrl}/rest/v1/organizaciones?select=id&limit=1`,
    {
      ...serviceHeaders(environment),
    },
  )
  assertOk('PostgREST table probe', rootProbe)

  const users = await installFixtures(environment)
  const tokens = {
    operatorA1: await signIn(environment, users.operatorA1),
    managerA1: await signIn(environment, users.managerA1),
    zoneManagerA1: await signIn(environment, users.zoneManagerA1),
    priceAdminA1: await signIn(environment, users.priceAdminA1),
    priceAdminA2: await signIn(environment, users.priceAdminA2),
  }
  console.log('✓ Auth local emitió JWT reales para roles locales y zonales')

  await gate1(environment, tokens.operatorA1)
  await gate2(environment, tokens.managerA1)
  await gate3(environment, tokens.zoneManagerA1)
  await gate4(environment, tokens, users)
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isCli) {
  runGates().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
