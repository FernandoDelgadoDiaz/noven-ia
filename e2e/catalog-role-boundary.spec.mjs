import { test, expect } from '@playwright/test'
import { IDS, installNovenFixture, login } from './fixtures/noven-fixture.mjs'

const PENDING_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

function access({ id, rol, zona_id = null, sucursal_id = null }) {
  return {
    id,
    usuario_id: IDS.user,
    organizacion_id: IDS.org,
    rol,
    zona_id,
    sucursal_id,
    activo: true,
    created_at: '2026-08-28T00:00:00Z',
    updated_at: '2026-08-28T00:00:00Z',
  }
}

async function mockPendingList(page) {
  await page.route('**/.netlify/functions/listar-pendientes-catalogo', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        success: true,
        pendientes: [{
          id: PENDING_ID,
          organizacion_id: IDS.org,
          cod_art: '7654321',
          descripcion: 'PRODUCTO PENDIENTE E2E',
          marca: 'Noven Test',
          gramaje: '100 GR',
          producto_id: null,
          first_detected_at: '2026-08-28T10:00:00Z',
          last_detected_at: '2026-08-28T12:00:00Z',
          detecciones: 2,
          sucursales: [
            { id: IDS.s091, codigo: '091', nombre: 'Sucursal 091 E2E' },
            { id: IDS.s043, codigo: '043', nombre: 'Sucursal 043 E2E' },
          ],
        }],
      }),
    })
  })
}

test.describe('Noven · frontera de catálogo por rol', () => {
  test('gerente zonal ve pendientes pero no puede clasificar ni abrir aprendizaje CSV', async ({ page }) => {
    await installNovenFixture(page, {
      accesses: [access({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa31',
        rol: 'gerente_zonal',
        zona_id: IDS.zona,
      })],
    })
    await mockPendingList(page)
    await login(page)

    await page.goto('/importar/pendientes')
    await expect(page.getByRole('heading', { name: 'Pendientes de catálogo' })).toBeVisible()
    await expect(page.getByText('PRODUCTO PENDIENTE E2E')).toBeVisible()
    await expect(page.getByText('Parte de esta bandeja es sólo lectura')).toBeVisible()
    await expect(page.getByLabel('Solo lectura 7654321')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Clasificar para toda la organización' })).toHaveCount(0)
    await expect(page.getByLabel('Seleccionar 7654321')).toHaveCount(0)
    await expect(page.getByLabel('Familia para 7654321')).toHaveCount(0)

    await page.goto('/importar/pendientes/aprender')
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Aprender desde CSV filtrado' })).toHaveCount(0)
  })

  test('supervisor local puede importar catálogo pero no obtiene administración de usuarios', async ({ page }) => {
    await installNovenFixture(page, {
      accesses: [access({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa32',
        rol: 'supervisor',
        sucursal_id: IDS.s091,
      })],
    })
    await login(page)

    const importar = page.getByRole('link', { name: 'Importar', exact: true })
    await expect(importar).toBeVisible()
    await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0)

    await importar.click()
    await expect(page.getByRole('heading', { name: 'Importar desde Glaciar' })).toBeVisible()

    await page.goto('/importar/pendientes/aprender')
    await expect(page.getByRole('heading', { name: 'Aprender desde CSV filtrado' })).toBeVisible()
  })
})
