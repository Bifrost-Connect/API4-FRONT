import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppNavbar from '@/components/AppNavbar.vue'
import ThemeButton from '@/components/ThemeButton.vue'
import { userService } from '@/services/user'
import { setTestUserRole } from '@/__tests__/mocks/testAuthHelper'

const storageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn<(query: string) => MediaQueryList>().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn<() => void>(),
    removeListener: vi.fn<() => void>(),
    addEventListener: vi.fn<() => void>(),
    removeEventListener: vi.fn<() => void>(),
    dispatchEvent: vi.fn<() => boolean>(),
  }) as unknown as MediaQueryList),
})

const DummyView = { template: '<div>View</div>' }

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: DummyView },
      { path: '/processo/:id', name: 'process-log', component: DummyView },
      { path: '/catalogo', name: 'catalogo', component: DummyView },
      { path: '/mapa', name: 'mapa', component: DummyView },
      { path: '/upload', name: 'upload', component: DummyView },
    ],
  })
}

async function mountNavbarAt(path: string) {
  const router = createTestRouter()
  await router.push(path)
  await router.isReady()

  const wrapper = mount(AppNavbar, {
    global: {
      plugins: [router],
    },
  })

  return { wrapper, router }
}

describe('AppNavbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    userService.clearCurrentUser()
    setTestUserRole('OPERADOR_DADOS')
  })

  it('exibe apenas Geodatahub como item atual na rota raiz /', async () => {
    const { wrapper } = await mountNavbarAt('/')

    const nav = wrapper.find('nav.breadcrumb')
    expect(nav.exists()).toBe(true)
    expect(nav.attributes('aria-label')).toBe('Navegação contextual')
    expect(nav.find('ol.breadcrumb-list').exists()).toBe(true)

    const current = nav.find('strong.breadcrumb-current')
    expect(current.exists()).toBe(true)
    expect(current.text()).toBe('Geodatahub')
    expect(current.classes()).toContain('breadcrumb-root')
    expect(current.attributes('aria-current')).toBe('page')

    expect(nav.findAll('.breadcrumb-link')).toHaveLength(0)
    expect(nav.findAll('.breadcrumb-separator')).toHaveLength(0)
  })

  it('exibe Geodatahub / Dashboard / Processo na rota /processo/42 sem mostrar o ID', async () => {
    const { wrapper } = await mountNavbarAt('/processo/42')

    const nav = wrapper.find('nav.breadcrumb')
    const links = nav.findAll('a.breadcrumb-link')
    const current = nav.find('strong.breadcrumb-current')
    const separators = nav.findAll('.breadcrumb-separator')

    expect(links).toHaveLength(2)
    expect(links[0]!.text()).toBe('Geodatahub')
    expect(links[0]!.attributes('href')).toBe('/')
    expect(links[0]!.classes()).toContain('breadcrumb-root')

    expect(links[1]!.text()).toBe('Dashboard')
    expect(links[1]!.attributes('href')).toBe('/')
    expect(links[1]!.classes()).not.toContain('breadcrumb-root')

    expect(current.text()).toBe('Processo')
    expect(current.attributes('aria-current')).toBe('page')
    expect(nav.text()).not.toContain('42')

    expect(separators).toHaveLength(2)
    for (const sep of separators) {
      expect(sep.text()).toBe('/')
      expect(sep.attributes('aria-hidden')).toBe('true')
    }
  })

  it('exibe Geodatahub / Catálogo de Bases na rota /catalogo', async () => {
    const { wrapper } = await mountNavbarAt('/catalogo')

    const nav = wrapper.find('nav.breadcrumb')
    const links = nav.findAll('a.breadcrumb-link')
    const current = nav.find('strong.breadcrumb-current')

    expect(links).toHaveLength(1)
    expect(links[0]!.text()).toBe('Geodatahub')
    expect(links[0]!.attributes('href')).toBe('/')
    expect(current.text()).toBe('Catálogo de Bases')
    expect(current.attributes('aria-current')).toBe('page')
  })

  it('navega ao clicar nos links intermediários do breadcrumb', async () => {
    const { wrapper, router } = await mountNavbarAt('/processo/42')

    const dashboardLink = wrapper.findAll('a.breadcrumb-link')[1]!
    await dashboardLink.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/')
    expect(wrapper.find('strong.breadcrumb-current').text()).toBe('Geodatahub')
    expect(wrapper.findAll('a.breadcrumb-link')).toHaveLength(0)

    await router.push('/catalogo')
    await flushPromises()
    expect(wrapper.find('strong.breadcrumb-current').text()).toBe('Catálogo de Bases')

    await wrapper.find('a.breadcrumb-link').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('mantém os atalhos de Mapa/Upload conforme permissão e o ThemeButton funcional', async () => {
    const { wrapper } = await mountNavbarAt('/')

    expect(wrapper.find('.navbar-actions a[href="/mapa"]').exists()).toBe(false)
    expect(wrapper.find('.navbar-actions a[href="/upload"]').exists()).toBe(true)

    const themeButton = wrapper.findComponent(ThemeButton)
    expect(themeButton.exists()).toBe(true)
    await themeButton.trigger('click')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    setTestUserRole('ANALISTA')
    const { wrapper: analistaWrapper } = await mountNavbarAt('/')
    expect(analistaWrapper.find('.navbar-actions a[href="/mapa"]').exists()).toBe(true)
    expect(analistaWrapper.find('.navbar-actions a[href="/upload"]').exists()).toBe(false)

    setTestUserRole('ADMIN')
    const { wrapper: adminWrapper } = await mountNavbarAt('/')
    expect(adminWrapper.find('.navbar-actions a[href="/mapa"]').exists()).toBe(false)
    expect(adminWrapper.find('.navbar-actions a[href="/upload"]').exists()).toBe(false)
  })
})
