export interface BreadcrumbItem {
  label: string
  to?: string
  isCurrent?: boolean
}

const ROUTE_LABELS: Record<string, string> = {
  catalogo: 'Catálogo de Bases',
  mapa: 'Mapa operacional',
  'analise-territorial': 'Análise territorial',
  'comparacao-temporal': 'Comparação temporal de safras',
  exportacoes: 'Exportações',
  upload: 'Ingestão de Carga',
  users: 'Gerenciamento de usuários',
  profile: 'Meu perfil',
  styleguide: 'Guia de estilos',
  forbidden: 'Acesso restrito (403)',
}

export function buildBreadcrumbs(route: {
  name?: string | symbol | null
  path: string
  params?: Record<string, string | string[]>
  query?: Record<string, string | null | (string | null)[]>
}): BreadcrumbItem[] {
  const routeName = route.name != null ? String(route.name) : ''

  if (routeName === 'dashboard' || route.path === '/') {
    return [{ label: 'Geodatahub', to: '/', isCurrent: true }]
  }

  if (routeName === 'process-log' || /^\/processos?\//.test(route.path)) {
    return [
      { label: 'Geodatahub', to: '/' },
      { label: 'Dashboard', to: '/' },
      { label: 'Processo', isCurrent: true },
    ]
  }

  return [
    { label: 'Geodatahub', to: '/' },
    { label: ROUTE_LABELS[routeName] ?? (routeName || 'Página'), isCurrent: true },
  ]
}
