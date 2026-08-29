import { test, expect } from '@playwright/test'
import { IDS, installNovenFixture, login } from './fixtures/noven-fixture.mjs'
import { SCANNER_IDS, installScannerWriteFixture } from './fixtures/scanner-write-fixture.mjs'
import {
  INVITATION_IDS,
  installActivationFixture,
  installAnalysisFixture,
  installInvitationFixture,
} from './fixtures/analysis-invitations-fixture.mjs'

async function buscarProductoScanner(page) {
  await page.goto('/scanner')
  await expect(page.getByRole('heading', { name: 'Registrar vencimiento' })).toBeVisible()
  await page.getByPlaceholder('Código de barras o cod. artículo').fill(SCANNER_IDS.codArt)
  await page.getByRole('button', { name: 'Buscar' }).click()
}

test.describe('Noven · recorridos críticos multitenant', () => {
  test('cuenta multirrol 091 no expone otras sucursales por el rol jerárquico', async ({ page }) => {
    const fixture = await installNovenFixture(page)
    await login(page)

    // La jerarquía corporativa no amplía el alcance operativo. Aunque el mock de
    // sucursales devuelva más filas, la UI las intersecta con roles operativos.
    // Con una sola sucursal resultante el selector se oculta deliberadamente.
    const selector = page.locator('select[aria-label="Seleccionar sucursal de trabajo"]:visible')
    await expect(selector).toHaveCount(0)

    const riskCard = page.getByRole('button', { name: /UNIDADES EN RIESGO/i })
    await expect(riskCard).toContainText('5')
    await expect.poll(() => fixture.seenExpiryStores.includes(IDS.s091)).toBeTruthy()
    expect(fixture.seenExpiryStores.includes(IDS.s043)).toBeFalsy()
  })

  test('una cuenta desactivada no entra al shell operativo', async ({ page }) => {
    await installNovenFixture(page, { profileActive: false })
    await login(page)

    await expect(page.getByRole('heading', { name: 'Cuenta pendiente o desactivada' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
    await expect(page.getByText('UNIDADES EN RIESGO')).toHaveCount(0)
  })

  test('una cuenta activa sin accesos queda bloqueada antes del Dashboard', async ({ page }) => {
    await installNovenFixture(page, { accesses: [] })
    await login(page)

    await expect(page.getByRole('heading', { name: 'Sin acceso activo' })).toBeVisible()
    await expect(page.getByText('Tu cuenta está activa, pero no tiene ninguna organización, zona o sucursal habilitada.')).toBeVisible()
    await expect(page.getByText('UNIDADES EN RIESGO')).toHaveCount(0)
  })

  test('en móvil región → zona → sucursales permanece dentro de Noven', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const fixture = await installNovenFixture(page)
    await login(page)

    await page.goto('/admin/accesos')
    await expect(page.getByRole('heading', { name: 'Accesos y jerarquía' })).toBeVisible()

    const formatDetection = await page.locator('meta[name="format-detection"]').getAttribute('content')
    expect(formatDetection).toContain('address=no')

    await page.getByRole('button', { name: /Sur.*1 zona.*2 sucursales/i }).click()
    const zona = page.getByRole('button', { name: /Santa Cruz Sur.*2 sucursales/i })
    await expect(zona).toBeVisible()
    await zona.click()

    // Validamos las filas reales de la jerarquía, no los <option> del selector global.
    await expect(page.getByText('Sucursal 091', { exact: true })).toBeVisible()
    await expect(page.getByText('Sucursal 043', { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/accesos$/)
    expect(fixture.externalNavigations.some((url) => /google\./i.test(url))).toBeFalsy()

    const invitationButton = page.getByRole('button', { name: 'Gestionar invitaciones pendientes' })
    await expect(invitationButton).toBeVisible()
    await invitationButton.click()
    await expect(page.getByRole('heading', { name: 'Invitaciones pendientes' })).toBeVisible()
    await expect(page.getByText('No hay invitaciones pendientes')).toBeVisible()
  })

  test('Análisis IA mantiene cache y requests aislados por sucursal seleccionada', async ({ page }) => {
    const fixture = await installAnalysisFixture(page)
    await login(page)
    await page.goto('/analisis')

    await expect(page.getByRole('heading', { name: 'Análisis inteligente' })).toBeVisible()
    const selector = page.locator('select[aria-label="Seleccionar sucursal de trabajo"]:visible')
    await expect(selector).toBeVisible()
    await expect(selector).toHaveValue('')

    // Un zonal con más de una sucursal debe elegir explícitamente; Noven no inventa
    // una sucursal por defecto y tampoco hace una llamada de análisis sin contexto.
    await page.getByRole('button', { name: 'Generar análisis' }).click()
    await expect(page.getByText('Seleccioná una sucursal antes de generar el análisis.')).toBeVisible()
    expect(fixture.calls).toHaveLength(0)

    await selector.selectOption(IDS.s091)
    await page.getByRole('button', { name: 'Generar análisis' }).click()
    await expect(page.getByRole('heading', { name: '1. INFORME SUCURSAL 091' })).toBeVisible()

    await selector.selectOption(IDS.s043)
    await expect(page.getByRole('heading', { name: '1. INFORME SUCURSAL 091' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Generar análisis' }).click()
    await expect(page.getByRole('heading', { name: '1. INFORME SUCURSAL 043' })).toBeVisible()

    expect(fixture.calls).toEqual([
      { sucursal_id: IDS.s091 },
      { sucursal_id: IDS.s043 },
    ])

    await selector.selectOption(IDS.s091)
    await expect(page.getByRole('heading', { name: '1. INFORME SUCURSAL 091' })).toBeVisible()
    expect(fixture.calls).toHaveLength(2)
  })
})

test.describe('Noven · escrituras críticas Scanner', () => {
  test('un producto con control activo abre el editor directo y registra el control por RPC', async ({ page }) => {
    const fixture = await installScannerWriteFixture(page, { hasActiveControl: true })
    await login(page)
    await buscarProductoScanner(page)

    const dialog = page.getByRole('dialog', { name: 'Control de vencimiento' })
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sí, es este producto' })).toHaveCount(0)

    await dialog.getByLabel('Cantidad comprometida observada hoy').fill('6')
    await dialog.getByRole('button', { name: 'Registrar control' }).click()

    await expect(page.getByRole('heading', { name: 'Registrar vencimiento' })).toBeVisible()
    await expect.poll(() => fixture.rpcCalls.filter((call) => call.name === 'registrar_control_vencimiento_dashboard').length).toBe(1)

    const call = fixture.rpcCalls.find((item) => item.name === 'registrar_control_vencimiento_dashboard')
    expect(call?.body).toEqual({
      p_vencimiento_id: SCANNER_IDS.control,
      p_cantidad_comprometida: 6,
      p_fecha_vencimiento: '2026-10-20',
      p_stock_actual: 12,
      p_porcentaje_rag: null,
      p_nota: null,
    })
    expect(fixture.directTableWrites).toEqual([])
  })

  test('un producto sin control guarda vencimiento y stock mediante una sola RPC atómica', async ({ page }) => {
    const fixture = await installScannerWriteFixture(page)
    await login(page)
    await buscarProductoScanner(page)

    await expect(page.getByRole('heading', { name: 'Confirmar producto' })).toBeVisible()
    await page.getByRole('button', { name: 'Sí, es este producto' }).click()
    await expect(page.getByRole('heading', { name: 'Cargar vencimiento' })).toBeVisible()

    await page.getByLabel('Stock total Glaciar').fill('15')
    await page.getByLabel('Cantidad comprometida').fill('4')
    await page.getByLabel('Fecha de vencimiento').fill('2026-10-20')
    await page.getByLabel('Lote').fill('L-NEW-E2E')
    await page.getByRole('button', { name: 'Guardar vencimiento' }).click()

    await expect(page.getByRole('heading', { name: '¡Guardado!' })).toBeVisible()
    await expect.poll(() => fixture.rpcCalls.filter((call) => call.name === 'guardar_vencimiento_y_stock_scanner_v1').length).toBe(1)

    const call = fixture.rpcCalls.find((item) => item.name === 'guardar_vencimiento_y_stock_scanner_v1')
    expect(call?.body).toEqual({
      p_producto_id: SCANNER_IDS.product,
      p_sucursal_id: IDS.s091,
      p_cantidad: 4,
      p_fecha_vencimiento: '2026-10-20',
      p_lote: 'L-NEW-E2E',
      p_stock_actual: 15,
      p_vencimiento_id: null,
    })
    expect(fixture.directTableWrites).toEqual([])
  })

  test('si falla la RPC atómica el Scanner conserva el formulario y no hace escrituras parciales', async ({ page }) => {
    const fixture = await installScannerWriteFixture(page, { atomicSaveError: 'Fallo transaccional E2E' })
    await login(page)
    await buscarProductoScanner(page)

    await page.getByRole('button', { name: 'Sí, es este producto' }).click()
    await page.getByLabel('Stock total Glaciar').fill('15')
    await page.getByLabel('Cantidad comprometida').fill('4')
    await page.getByLabel('Fecha de vencimiento').fill('2026-10-20')
    await page.getByRole('button', { name: 'Guardar vencimiento' }).click()

    await expect(page.getByText('No se pudo guardar el control: Fallo transaccional E2E')).toBeVisible()
    await expect(page.getByRole('heading', { name: '¡Guardado!' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Cargar vencimiento' })).toBeVisible()
    expect(fixture.rpcCalls.filter((call) => call.name === 'guardar_vencimiento_y_stock_scanner_v1')).toHaveLength(1)
    expect(fixture.directTableWrites).toEqual([])
  })

  test('marcar vendido confirma y cierra por la RPC terminal sin DML directo', async ({ page }) => {
    const fixture = await installScannerWriteFixture(page, { hasActiveControl: true })
    await login(page)
    await buscarProductoScanner(page)

    const dialog = page.getByRole('dialog', { name: 'Control de vencimiento' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Marcar como vendido' }).click()
    const confirmar = page.getByRole('button', { name: 'Confirmar vendido' })
    await expect(confirmar).toBeVisible()
    await confirmar.click()

    await expect(page.getByRole('heading', { name: 'Registrar vencimiento' })).toBeVisible()
    await expect.poll(() => fixture.rpcCalls.filter((call) => call.name === 'cerrar_vencimiento_operativo').length).toBe(1)

    const call = fixture.rpcCalls.find((item) => item.name === 'cerrar_vencimiento_operativo')
    expect(call?.body).toEqual({
      p_vencimiento_id: SCANNER_IDS.control,
      p_resultado: 'vendido',
      p_observaciones: null,
    })
    expect(fixture.directTableWrites).toEqual([])
  })

  test('un control urgente registra un nuevo porcentaje RAG dentro de la RPC de control', async ({ page }) => {
    const fixture = await installScannerWriteFixture(page, {
      hasActiveControl: true,
      activeControlQuantity: 20,
      activeControlDate: '2026-09-12',
      productStock: 30,
      productVmd: 2,
    })
    await login(page)
    await buscarProductoScanner(page)

    const dialog = page.getByRole('dialog', { name: 'Control de vencimiento' })
    await expect(dialog).toBeVisible()
    const rag = dialog.getByPlaceholder('Ej. 30')
    await expect(rag).toBeVisible()
    await expect(rag).toBeEnabled()
    await rag.fill('30')
    await dialog.getByRole('button', { name: 'Registrar control' }).click()

    await expect(page.getByRole('heading', { name: 'Registrar vencimiento' })).toBeVisible()
    await expect.poll(() => fixture.rpcCalls.filter((call) => call.name === 'registrar_control_vencimiento_dashboard').length).toBe(1)

    const call = fixture.rpcCalls.find((item) => item.name === 'registrar_control_vencimiento_dashboard')
    expect(call?.body).toEqual({
      p_vencimiento_id: SCANNER_IDS.control,
      p_cantidad_comprometida: 20,
      p_fecha_vencimiento: '2026-09-12',
      p_stock_actual: 30,
      p_porcentaje_rag: 30,
      p_nota: null,
    })
    expect(fixture.directTableWrites).toEqual([])
  })
})

test.describe('Noven · invitaciones seguras', () => {
  test('crear operador, regenerar y anular conserva el scope local y cambia el enlace', async ({ page }) => {
    const fixture = await installInvitationFixture(page)
    await login(page)
    await page.goto('/admin')

    await expect(page.getByRole('heading', { name: 'Administración' })).toBeVisible()
    await page.getByRole('button', { name: 'Nuevo usuario' }).click()

    const dialog = page.getByRole('dialog', { name: 'Invitar usuario' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Nombre').fill('Operador E2E')
    await dialog.getByLabel('Email').fill('operador.e2e@noven.test')
    await dialog.getByLabel('Rol en esta sucursal').selectOption('operador')
    await dialog.getByRole('button', { name: /Almacén/ }).click()
    await dialog.getByRole('button', { name: /003.*Golosinas/ }).click()
    await dialog.getByRole('button', { name: 'Crear invitación' }).click()

    const creada = page.getByRole('dialog', { name: 'Invitación creada' })
    await expect(creada).toBeVisible()
    await expect(creada).toContainText('https://noven-ia.netlify.app/activar#e2e-original')

    const invitar = fixture.adminSucursalCalls.find((call) => call.accion === 'invitar')
    expect(invitar).toEqual({
      accion: 'invitar',
      sucursalId: IDS.s091,
      email: 'operador.e2e@noven.test',
      nombre: 'Operador E2E',
      rol: 'operador',
      familias: [INVITATION_IDS.family],
      canal: 'link',
    })

    await creada.getByRole('button', { name: 'Cerrar' }).click()
    await page.getByRole('button', { name: 'Gestionar invitaciones pendientes' }).click()
    const gestion = page.getByRole('dialog', { name: 'Invitaciones pendientes' })
    await expect(gestion.getByText('Operador E2E', { exact: true })).toBeVisible()

    await gestion.getByRole('button', { name: 'Regenerar' }).click()
    await expect(gestion.getByText('Nuevo enlace generado')).toBeVisible()
    await expect(gestion).toContainText('https://noven-ia.netlify.app/activar#e2e-regenerated')
    await expect.poll(() => fixture.currentInvitations()[0]?.id).toBe(INVITATION_IDS.regenerated)

    page.once('dialog', (confirm) => confirm.accept())
    await gestion.getByRole('button', { name: 'Anular' }).click()
    await expect(gestion.getByText('No hay invitaciones pendientes')).toBeVisible()

    expect(fixture.invitationCalls.some((call) => call.accion === 'regenerar' && call.invitacionId === INVITATION_IDS.pending)).toBeTruthy()
    expect(fixture.invitationCalls.some((call) => call.accion === 'anular' && call.invitacionId === INVITATION_IDS.regenerated)).toBeTruthy()
  })

  test('/activar guarda contraseña antes de aceptar y refresca el acceso antes del Dashboard', async ({ page }) => {
    const fixture = await installActivationFixture(page)

    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@noven.test')
    await page.getByLabel('Contraseña').fill('e2e-password')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await page.waitForURL('**/dashboard')
    await page.goto('/activar')

    await expect(page.getByRole('heading', { name: 'Activá tu acceso a Noven IA' })).toBeVisible()
    await page.getByLabel('Nueva contraseña').fill('NuevaClaveE2E!')
    await page.getByLabel('Repetir contraseña').fill('NuevaClaveE2E!')
    await page.getByRole('button', { name: 'Crear contraseña y entrar' }).click()

    await expect(page.getByText('Cuenta activada', { exact: true })).toBeVisible()
    await expect.poll(() => fixture.isAccepted()).toBeTruthy()
    expect(fixture.events.map((event) => event.type)).toEqual(['password', 'accept'])
    expect(fixture.events[0]?.body?.password).toBe('NuevaClaveE2E!')

    await page.waitForURL('**/dashboard')
    await expect(page.getByRole('heading', { name: 'Sin acceso activo' })).toHaveCount(0)
  })
})
