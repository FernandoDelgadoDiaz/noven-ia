import { test, expect } from '@playwright/test'
import { IDS, installNovenFixture, login } from './fixtures/noven-fixture.mjs'

test.describe('Noven · recorridos críticos multitenant', () => {
  test('cuenta multirrol abre en 091 y cambiar sucursal actualiza el Dashboard en el acto', async ({ page }) => {
    const fixture = await installNovenFixture(page)
    await login(page)

    const selector = page.getByLabel('Seleccionar sucursal de trabajo')
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

    await expect(page.getByText(/091/)).toBeVisible()
    await expect(page.getByText(/043/)).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/accesos$/)
    expect(fixture.externalNavigations.some((url) => /google\./i.test(url))).toBeFalsy()

    const invitationButton = page.getByRole('button', { name: 'Gestionar invitaciones pendientes' })
    await expect(invitationButton).toBeVisible()
    await invitationButton.click()
    await expect(page.getByRole('heading', { name: 'Invitaciones pendientes' })).toBeVisible()
    await expect(page.getByText('No hay invitaciones pendientes')).toBeVisible()
  })
})
