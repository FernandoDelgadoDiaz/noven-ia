import { test, expect } from '@playwright/test'
import { IDS, installNovenFixture, login } from './fixtures/noven-fixture.mjs'
import { SCANNER_IDS, installScannerWriteFixture } from './fixtures/scanner-write-fixture.mjs'

async function buscarProductoScanner(page) {
  await page.goto('/scanner')
  await expect(page.getByRole('heading', { name: 'Registrar vencimiento' })).toBeVisible()
  await page.getByPlaceholder('Código de barras o cod. artículo').fill(SCANNER_IDS.ean)
  await page.getByRole('button', { name: 'Buscar' }).click()
}

test.describe('Noven · recorridos críticos multitenant', () => {
  test('cuenta multirrol abre en 091 y cambiar sucursal actualiza el Dashboard en el acto', async ({ page }) => {
    const fixture = await installNovenFixture(page)
    await login(page)

    // AppLayout mantiene simultáneamente las variantes desktop/mobile en el DOM;
    // el test debe operar sobre el selector realmente visible en el viewport.
    const selector = page.locator('select[aria-label="Seleccionar sucursal de trabajo"]:visible')
    await expect(selector).toHaveCount(1)
    await expect(selector).toBeVisible()
    await expect(selector).toHaveValue(IDS.s091)

    const riskCard = page.getByRole('button', { name: /UNIDADES EN RIESGO/i })
    await expect(riskCard).toContainText('5')
    await expect.poll(() => fixture.seenExpiryStores.includes(IDS.s091)).toBeTruthy()

    await selector.selectOption(IDS.s043)
    await expect(selector).toHaveValue(IDS.s043)
    await expect(riskCard).toContainText('17')
    await expect.poll(() => fixture.seenExpiryStores.at(-1)).toBe(IDS.s043)

    const persisted = await page.evaluate(() => localStorage.getItem('noven_sucursal_actual'))
    expect(persisted).toBe(IDS.s043)
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
