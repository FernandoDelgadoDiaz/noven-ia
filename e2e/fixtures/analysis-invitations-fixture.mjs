import { IDS, installNovenFixture } from './noven-fixture.mjs'

export const INVITATION_IDS = {
  sector: '12121212-1212-4121-8121-121212121212',
  family: '13131313-1313-4131-8131-131313131313',
  pending: '14141414-1414-4141-8141-141414141414',
  regenerated: '15151515-1515-4151-8151-151515151515',
  access: '16161616-1616-4161-8161-161616161616',
}

function jsonHeaders(extra = {}) {
  return { 'content-type': 'application/json; charset=utf-8', ...extra }
}

export async function installAnalysisFixture(page) {
  await installNovenFixture(page, {
    accesses: [{
      id: IDS.accessOrg,
      usuario_id: IDS.user,
      organizacion_id: IDS.org,
      rol: 'gerente_zonal',
      zona_id: IDS.zona,
      sucursal_id: null,
      activo: true,
      created_at: '2026-08-28T00:00:00Z',
      updated_at: '2026-08-28T00:00:00Z',
    }],
  })
  const calls = []

  await page.route('**/.netlify/functions/analisis', async (route) => {
    const request = route.request()
    let body = {}
    try { body = request.postDataJSON() ?? {} } catch { body = {} }
    calls.push(body)

    const storeId = String(body.sucursal_id ?? '')
    const label = storeId === IDS.s043 ? '043' : storeId === IDS.s091 ? '091' : 'DESCONOCIDA'
    return route.fulfill({
      status: 200,
      headers: jsonHeaders(),
      body: JSON.stringify({
        success: true,
        sucursal_id: storeId,
        generado_en: label === '043' ? '2026-08-28T18:43:00-03:00' : '2026-08-28T18:41:00-03:00',
        analisis: `1. INFORME SUCURSAL ${label}\n- Resultado aislado para sucursal ${label}`,
      }),
    })
  })

  return { calls }
}

function localInvitation(id = INVITATION_IDS.pending) {
  return {
    id,
    email: 'operador.e2e@noven.test',
    nombre: 'Operador E2E',
    rol: 'operador',
    canal: 'link',
    estado: 'pendiente',
    created_at: '2026-08-28T18:00:00-03:00',
    expires_at: '2026-08-31T18:00:00-03:00',
    zona_nombre: null,
    sucursal_codigo: '091',
    sucursal_nombre: 'Sucursal 091 E2E',
    familias_ids: [INVITATION_IDS.family],
  }
}

export async function installInvitationFixture(page) {
  await installNovenFixture(page)

  const adminSucursalCalls = []
  const invitationCalls = []
  let invitations = []

  await page.route('**/api/admin/*/sucursal', async (route) => {
    const request = route.request()
    let body = {}
    try { body = request.postDataJSON() ?? {} } catch { body = {} }
    adminSucursalCalls.push(body)

    if (body.accion === 'listar') {
      return route.fulfill({
        status: 200,
        headers: jsonHeaders(),
        body: JSON.stringify({
          success: true,
          sucursal: { id: IDS.s091, codigo: '091', nombre: 'Sucursal 091 E2E', organizacion_id: IDS.org },
          sectores: [{ id: INVITATION_IDS.sector, codigo: 'ALM', nombre: 'Almacén' }],
          familias: [{ id: INVITATION_IDS.family, codigo: '003', nombre: 'Golosinas', sector_id: INVITATION_IDS.sector }],
          usuarios: [],
        }),
      })
    }

    if (body.accion === 'invitar') {
      invitations = [localInvitation()]
      return route.fulfill({
        status: 201,
        headers: jsonHeaders(),
        body: JSON.stringify({
          success: true,
          canal: body.canal ?? 'link',
          link: 'https://noven-ia.netlify.app/activar#e2e-original',
        }),
      })
    }

    return route.fulfill({ status: 400, headers: jsonHeaders(), body: JSON.stringify({ success: false, error: 'Acción local E2E no soportada' }) })
  })

  await page.route('**/api/admin/*/invitaciones', async (route) => {
    const request = route.request()
    let body = {}
    try { body = request.postDataJSON() ?? {} } catch { body = {} }
    invitationCalls.push(body)

    if (body.accion === 'listar') {
      return route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify({ success: true, invitaciones: invitations }) })
    }

    if (body.accion === 'regenerar') {
      invitations = [localInvitation(INVITATION_IDS.regenerated)]
      return route.fulfill({
        status: 201,
        headers: jsonHeaders(),
        body: JSON.stringify({ success: true, canal: 'link', link: 'https://noven-ia.netlify.app/activar#e2e-regenerated' }),
      })
    }

    if (body.accion === 'anular') {
      invitations = []
      return route.fulfill({ status: 200, headers: jsonHeaders(), body: JSON.stringify({ success: true, invitacion_id: body.invitacionId, estado: 'anulada' }) })
    }

    return route.fulfill({ status: 400, headers: jsonHeaders(), body: JSON.stringify({ success: false, error: 'Acción invitación E2E no soportada' }) })
  })

  return { adminSucursalCalls, invitationCalls, currentInvitations: () => invitations }
}

export async function installActivationFixture(page) {
  const pendingAccess = {
    id: INVITATION_IDS.access,
    usuario_id: IDS.user,
    organizacion_id: IDS.org,
    rol: 'operador',
    zona_id: null,
    sucursal_id: IDS.s091,
    activo: false,
    created_at: '2026-08-28T18:00:00-03:00',
    updated_at: '2026-08-28T18:00:00-03:00',
  }

  await installNovenFixture(page, { accesses: [pendingAccess] })

  const events = []
  let accepted = false

  await page.route('**/__supabase/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (path.endsWith('/auth/v1/user') && request.method() === 'PUT') {
      let body = {}
      try { body = request.postDataJSON() ?? {} } catch { body = {} }
      events.push({ type: 'password', body })
      return route.fulfill({
        status: 200,
        headers: jsonHeaders(),
        body: JSON.stringify({
          id: IDS.user,
          email: 'admin@noven.test',
          role: 'authenticated',
          user_metadata: { nombre: 'Admin E2E' },
          app_metadata: { provider: 'email', providers: ['email'] },
          identities: [],
          created_at: '2026-08-28T18:00:00-03:00',
          updated_at: '2026-08-28T18:00:01-03:00',
        }),
      })
    }

    if (path.includes('/rest/v1/rpc/aceptar_invitacion_acceso_v1')) {
      events.push({ type: 'accept' })
      accepted = true
      return route.fulfill({ status: 200, headers: jsonHeaders(), body: '1' })
    }

    if (path.includes('/rest/v1/usuario_accesos')) {
      return route.fulfill({
        status: 200,
        headers: jsonHeaders(),
        body: JSON.stringify([{ ...pendingAccess, activo: accepted, updated_at: accepted ? '2026-08-28T18:01:00-03:00' : pendingAccess.updated_at }]),
      })
    }

    return route.fallback()
  })

  return { events, isAccepted: () => accepted }
}
