import { expect, test } from '@playwright/test'

test.use({ headless: true })

test('analista compara safras publicadas com mapas reais, cortina e inspeção sincronizada', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('api4-demo-role', 'Analista'))
  await page.route('https://*.tile.openstreetmap.org/**', (route) => route.abort())
  const published = {
    conjunto_id: 2,
    conjunto: 'Alertas',
    pronta_para_consulta: true,
    etapa_atual: 'PUBLICACAO',
    situacao: 'CONCLUIDA',
  }
  const collection = (year: string) => ({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { codigoImovel: 'CAR-TESTE', anoSafra: year },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-47, -16],
              [-46, -16],
              [-46, -15],
              [-47, -15],
              [-47, -16],
            ],
          ],
        },
      },
    ],
  })
  let requests = 0
  await page.route('**/api/catalogo/bases?**', (route) =>
    route.fulfill({
      json: {
        items: [
          { ...published, id: 1, ano_safra: '2023', versao_oficial: 'v1' },
          { ...published, id: 2, ano_safra: '2025', versao_oficial: 'v2' },
          { ...published, id: 3, ano_safra: '2026', versao_fechada: false },
        ],
        total_pages: 1,
      },
    }),
  )
  await page.route('**/api/analise/comparacao/camadas?**', (route) => {
    requests++
    expect(new URL(route.request().url()).searchParams.get('bbox')).toBe('-50,-20,-40,-10')
    return route.fulfill({ json: { cargaA: collection('2023'), cargaB: collection('2025') } })
  })
  await page.route('**/api/analise/comparacao/evolucao', (route) =>
    route.fulfill({
      json: {
        areaSafraAHectares: 40,
        areaSafraBHectares: 70,
        saldoVariacaoHectares: 30,
        areaAumentoHectares: 35,
        areaReducaoHectares: 5,
        areaMantidaHectares: 35,
        geoJsonClassificado: JSON.stringify({
          type: 'FeatureCollection',
          features: ['NOVO_ALERTA', 'REDUCAO_ALERTA', 'MANTIDO'].map((classe) => ({
            ...collection('2025').features[0],
            properties: { classe },
          })),
        }),
      },
    }),
  )
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/comparacao-temporal?baseA=1')
  await expect(page.getByRole('heading', { name: 'Comparação Temporal de Safras' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Comparação temporal' })).toBeVisible()
  await expect(page.getByLabel('Safra inicial / Base A')).toHaveValue('1')
  await expect(page.getByLabel('Safra comparada / Base B').locator('option')).toHaveCount(3)
  await page.getByLabel('Safra comparada / Base B').selectOption('2')
  await expect(page.getByRole('button', { name: 'Executar Comparação' })).toBeDisabled()
  for (const [label, value] of [
    ['Longitude oeste', '-50'],
    ['Latitude sul', '-20'],
    ['Longitude leste', '-40'],
    ['Latitude norte', '-10'],
  ]) {
    await page.getByRole('spinbutton', { name: label, exact: true }).fill(value!)
  }
  await page.getByRole('button', { name: 'Executar Comparação' }).click()
  await expect(page.getByTestId('percentage-change')).toHaveText('+75,00%')
  await expect(page.getByTestId('map-a').locator('path.leaflet-interactive')).toHaveCount(1)
  await expect(page.getByTestId('map-b').locator('path.leaflet-interactive')).toHaveCount(1)
  for (const color of ['#dc2626', '#15803d', '#d6a217']) {
    await expect(page.getByTestId('map-a').locator(`path[stroke="${color}"]`)).toHaveCount(1)
    await expect(page.getByTestId('map-b').locator(`path[stroke="${color}"]`)).toHaveCount(1)
  }
  await page.getByTestId('map-a').locator('path.leaflet-interactive').click()
  await expect(page.locator('.leaflet-popup')).toHaveCount(2)
  await expect(page.getByLabel('Inspecionar imóvel / feição', { exact: true })).toHaveValue(
    'CAR-TESTE',
  )
  for (const side of ['map-a', 'map-b']) {
    await expect(page.getByTestId(side).locator('path.leaflet-interactive')).toHaveAttribute(
      'stroke',
      '#f26522',
    )
  }
  await page.getByRole('button', { name: 'Cortina Deslizante (Swipe)' }).click()
  const slider = page.getByRole('slider', { name: 'Posição da cortina' })
  await slider.focus()
  await page.keyboard.press('ArrowRight')
  await expect(slider).toHaveAttribute('aria-valuenow', '52')
  await page.getByLabel('Destacar Evolução / Mudanças').uncheck()
  await expect(page.getByLabel('Legenda de evolução')).toHaveCount(0)
  await expect(page.getByTestId('map-a').locator('.leaflet-overlay-pane path')).toHaveCount(1)
  await page.getByRole('button', { name: 'Lado a Lado (2 Mapas)' }).click()
  await page.getByRole('button', { name: 'Indicadores de evolução' }).click()
  await expect(page.getByTestId('percentage-change')).toBeHidden()
  expect(requests).toBe(1)
  expect(errors).toEqual([])
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test('atalho do catálogo preenche a versão inicial publicada', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('api4-demo-role', 'Analista'))
  await page.route('https://*.tile.openstreetmap.org/**', (route) => route.abort())
  await page.route('**/api/dominios/filtros', (route) =>
    route.fulfill({ json: { conjuntos: [], etapas: [], situacoes: [] } }),
  )
  await page.route('**/api/processos?**', (route) =>
    route.fulfill({
      json: {
        content: [
          {
            id: '1',
            dataset: 'Alertas',
            stage: 'PUBLICACAO',
            status: 'CONCLUIDA',
            year: '2023',
            dateTime: '01/11/2026',
          },
        ],
        number: 0,
        totalPages: 1,
        totalElements: 1,
      },
    }),
  )
  await page.route('**/api/catalogo/bases?**', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: 1,
            conjunto_id: 2,
            conjunto: 'Alertas',
            ano_safra: '2023',
            pronta_para_consulta: true,
          },
        ],
        total_pages: 1,
      },
    }),
  )
  await page.goto('/catalogo')
  await page.getByRole('button', { name: /Comparar safra/i }).click()
  await expect(page).toHaveURL('/comparacao-temporal?baseA=1')
  await expect(page.getByLabel('Conjunto temático', { exact: true })).toHaveValue('2')
  await expect(page.getByLabel('Safra inicial / Base A')).toHaveValue('1')
})

test('operador não acessa a comparação por URL', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('api4-demo-role', 'Operador'))
  await page.route('**/api/**', (route) => route.fulfill({ json: [] }))
  await page.goto('/comparacao-temporal')
  await expect(page).toHaveURL('/acesso-negado')
  await expect(page.getByRole('link', { name: 'Comparação temporal' })).toHaveCount(0)
})
