/**
 * Testes unitários para AppSidebar.vue:
 * - Ícone de logout (FiLogOut)
 * - Comportamento de recolher/expandir menu lateral
 * - Persistência do estado em localStorage
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { FiChevronLeft, FiChevronRight, FiLogOut, FiRotateCcw } from 'vue-icons-plus/fi'
import AppSidebar from '@/components/AppSidebar.vue'
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

const pushMock = vi.fn<(...args: unknown[]) => void>()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  RouterLink: {
    props: ['to'],
    template: '<a :href="to" class="router-link"><slot /></a>',
  },
}))

const SIDEBAR_STORAGE_KEY = 'georural_sidebar_collapsed'

describe('AppSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    userService.clearCurrentUser()
    setTestUserRole('GESTOR')
  })

  it('renderiza o ícone FiLogOut no botão de sair e não renderiza FiRotateCcw', () => {
    const wrapper = mount(AppSidebar)
    const logoutBtn = wrapper.find('.logout-btn')

    expect(logoutBtn.exists()).toBe(true)
    expect(logoutBtn.findComponent(FiLogOut).exists()).toBe(true)
    expect(logoutBtn.findComponent(FiRotateCcw).exists()).toBe(false)
  })

  it('inicia expandida por padrão, exibindo GeoRural, Navegação e rótulos dos links', () => {
    const wrapper = mount(AppSidebar)
    const aside = wrapper.find('aside.sidebar')
    const toggleBtn = wrapper.find('[data-testid="sidebar-toggle"]')

    expect(aside.classes()).not.toContain('sidebar-collapsed')
    expect(wrapper.text()).toContain('GeoRural')
    expect(wrapper.text()).toContain('Sistema de Cargas')
    expect(wrapper.text()).toContain('Navegação')
    expect(wrapper.text()).toContain('Dashboard')
    expect(wrapper.text()).toContain('Sair')

    expect(toggleBtn.exists()).toBe(true)
    expect(toggleBtn.findComponent(FiChevronLeft).exists()).toBe(true)
    expect(toggleBtn.attributes('title')).toBe('Recolher menu lateral')
    expect(toggleBtn.attributes('aria-label')).toBe('Recolher menu lateral')
  })

  it('recolhe o menu lateral ao clicar no botão de alternância, ocultando textos e mantendo ícones e titles', async () => {
    const wrapper = mount(AppSidebar)
    const toggleBtn = wrapper.find('[data-testid="sidebar-toggle"]')

    await toggleBtn.trigger('click')

    const aside = wrapper.find('aside.sidebar')
    expect(aside.classes()).toContain('sidebar-collapsed')

    expect(wrapper.find('.brand-mark').text()).toBe('A4')
    expect(wrapper.text()).not.toContain('GeoRural')
    expect(wrapper.text()).not.toContain('Sistema de Cargas')
    expect(wrapper.text()).not.toContain('Navegação')
    expect(wrapper.find('.sidebar-section-title').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Dashboard')
    expect(wrapper.text()).not.toContain('Sair')

    const navLinks = wrapper.findAll('.navigation-link')
    expect(navLinks.length).toBeGreaterThan(0)
    for (const link of navLinks) {
      expect(link.find('.navigation-icon').exists()).toBe(true)
      expect(link.attributes('title')).toBeTruthy()
    }

    const logoutBtn = wrapper.find('.logout-btn')
    expect(logoutBtn.find('.navigation-icon').exists()).toBe(true)
    expect(logoutBtn.attributes('title')).toBe('Sair')

    expect(toggleBtn.findComponent(FiChevronRight).exists()).toBe(true)
    expect(toggleBtn.attributes('title')).toBe('Expandir menu lateral')
    expect(toggleBtn.attributes('aria-label')).toBe('Expandir menu lateral')
  })

  it('restaura o estado expandido ao clicar novamente no botão de alternância', async () => {
    const wrapper = mount(AppSidebar)
    const toggleBtn = wrapper.find('[data-testid="sidebar-toggle"]')

    await toggleBtn.trigger('click')
    expect(wrapper.find('aside.sidebar').classes()).toContain('sidebar-collapsed')

    await toggleBtn.trigger('click')

    const aside = wrapper.find('aside.sidebar')
    expect(aside.classes()).not.toContain('sidebar-collapsed')
    expect(wrapper.text()).toContain('GeoRural')
    expect(wrapper.text()).toContain('Navegação')
    expect(wrapper.text()).toContain('Dashboard')
    expect(wrapper.text()).toContain('Sair')
    expect(wrapper.find('.logout-btn').attributes('title')).toBeUndefined()
    expect(toggleBtn.findComponent(FiChevronLeft).exists()).toBe(true)
  })

  it('persiste e restaura o estado recolhido no localStorage', async () => {
    const wrapper = mount(AppSidebar)
    const toggleBtn = wrapper.find('[data-testid="sidebar-toggle"]')

    await toggleBtn.trigger('click')
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true')

    const remounted = mount(AppSidebar)
    expect(remounted.find('aside.sidebar').classes()).toContain('sidebar-collapsed')
    expect(remounted.text()).not.toContain('GeoRural')

    await remounted.find('[data-testid="sidebar-toggle"]').trigger('click')
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('false')
    expect(remounted.find('aside.sidebar').classes()).not.toContain('sidebar-collapsed')
  })
})
