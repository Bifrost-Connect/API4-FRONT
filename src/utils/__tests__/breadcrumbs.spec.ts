import { describe, it, expect } from 'vitest'
import { buildBreadcrumbs } from '@/utils/breadcrumbs'

describe('buildBreadcrumbs', () => {
  it('retorna apenas Geodatahub como item atual na rota raiz /', () => {
    expect(buildBreadcrumbs({ name: 'dashboard', path: '/' })).toEqual([
      { label: 'Geodatahub', to: '/', isCurrent: true },
    ])

    expect(buildBreadcrumbs({ path: '/' })).toEqual([
      { label: 'Geodatahub', to: '/', isCurrent: true },
    ])
  })

  it('retorna Geodatahub / Dashboard / Processo sem exibir o ID na tela de processo', () => {
    const result = buildBreadcrumbs({
      name: 'process-log',
      path: '/processo/42',
      params: { id: '42' },
    })

    expect(result).toEqual([
      { label: 'Geodatahub', to: '/' },
      { label: 'Dashboard', to: '/' },
      { label: 'Processo', isCurrent: true },
    ])
    expect(result.some((item) => item.label.includes('42'))).toBe(false)
  })

  it('retorna a mesma trilha para o alias /processos/:id', () => {
    expect(
      buildBreadcrumbs({
        name: 'process-log',
        path: '/processos/99',
        params: { id: '99' },
      }),
    ).toEqual([
      { label: 'Geodatahub', to: '/' },
      { label: 'Dashboard', to: '/' },
      { label: 'Processo', isCurrent: true },
    ])
  })

  it.each([
    ['catalogo', '/catalogo', 'Catálogo de Bases'],
    ['mapa', '/mapa', 'Mapa operacional'],
    ['analise-territorial', '/analise-territorial', 'Análise territorial'],
    ['comparacao-temporal', '/comparacao-temporal', 'Comparação temporal de safras'],
    ['exportacoes', '/exportacoes', 'Exportações'],
    ['upload', '/upload', 'Ingestão de Carga'],
    ['users', '/users', 'Gerenciamento de usuários'],
    ['profile', '/profile', 'Meu perfil'],
    ['styleguide', '/styleguide', 'Guia de estilos'],
    ['forbidden', '/acesso-negado', 'Acesso restrito (403)'],
  ])('mapeia corretamente a rota %s (%s)', (name, path, expectedLabel) => {
    expect(buildBreadcrumbs({ name, path })).toEqual([
      { label: 'Geodatahub', to: '/' },
      { label: expectedLabel, isCurrent: true },
    ])
  })

  it('usa fallback com o nome da rota ou Página quando a rota não está mapeada', () => {
    expect(buildBreadcrumbs({ name: 'custom-route', path: '/custom' })).toEqual([
      { label: 'Geodatahub', to: '/' },
      { label: 'custom-route', isCurrent: true },
    ])

    expect(buildBreadcrumbs({ name: null, path: '/desconhecida' })).toEqual([
      { label: 'Geodatahub', to: '/' },
      { label: 'Página', isCurrent: true },
    ])

    expect(buildBreadcrumbs({ path: '/sem-nome' })).toEqual([
      { label: 'Geodatahub', to: '/' },
      { label: 'Página', isCurrent: true },
    ])
  })
})
