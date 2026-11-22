import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LoginView from '../LoginView.vue'
import { userService } from '@/services/user'

const storageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
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

const replaceMock = vi.fn<(...args: unknown[]) => void>()
const resolveMock = vi.fn<(...args: unknown[]) => unknown>()

vi.mock('vue-router', () => ({
  useRoute: () => ({
    path: '/login',
    query: {},
  }),
  useRouter: () => ({
    replace: replaceMock,
    resolve: resolveMock,
  }),
}))

describe('LoginView - Autenticação JWT Real', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    userService.clearCurrentUser()
  })

  it('autentica via loginWithCredentials com credenciais válidas e redireciona para homeFor', async () => {
    const loginSpy = vi.spyOn(userService, 'loginWithCredentials').mockResolvedValueOnce({
      id: 1,
      name: 'Carlos Mendes',
      email: 'admin@georural.com.br',
      role: 'ADMIN',
      roleId: 'ADMIN',
      permissions: ['USUARIOS:VISUALIZAR'],
    })

    const wrapper = mount(LoginView)
    await wrapper.find('[data-testid="login-email-input"]').setValue('admin@georural.com.br')
    await wrapper.find('[data-testid="login-password-input"]').setValue('Senha@123')

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(loginSpy).toHaveBeenCalledWith('admin@georural.com.br', 'Senha@123')
    expect(wrapper.find('[data-testid="login-error-banner"]').exists()).toBe(false)
    expect(replaceMock).toHaveBeenCalledWith('/users')
  })

  it('exibe erro na UI quando o back-end retorna 401', async () => {
    vi.spyOn(userService, 'loginWithCredentials').mockRejectedValueOnce({
      response: {
        status: 401,
        data: { erro: 'E-mail ou senha inválidos, ou usuário inativo.' },
      },
    })

    const wrapper = mount(LoginView)
    await wrapper.find('[data-testid="login-email-input"]').setValue('operador@georural.com.br')
    await wrapper.find('[data-testid="login-password-input"]').setValue('SenhaErrada')

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(replaceMock).not.toHaveBeenCalled()
    const banner = wrapper.find('[data-testid="login-error-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('E-mail ou senha inválidos')
  })

  it('exibe erro real de rede quando o back-end estiver indisponível', async () => {
    const loginSpy = vi.spyOn(userService, 'loginWithCredentials').mockRejectedValueOnce({
      code: 'ERR_NETWORK',
      message: 'Network Error',
    })

    const wrapper = mount(LoginView)
    await wrapper.find('[data-testid="login-email-input"]').setValue('operador@georural.com.br')
    await wrapper.find('[data-testid="login-password-input"]').setValue('Troca123')

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(loginSpy).toHaveBeenCalledWith('operador@georural.com.br', 'Troca123')
    expect(replaceMock).not.toHaveBeenCalled()
    const banner = wrapper.find('[data-testid="login-error-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('Network Error')
  })

  it('oculta a seção de Acesso Rápido na tela de login', () => {
    const wrapper = mount(LoginView)

    expect(wrapper.find('.notice-card').exists()).toBe(false)
    expect(wrapper.find('.roles-container').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Acesso Rápido')
  })

  it('exibe o nome GeodataHub e o logo do favicon na tela de login', () => {
    const wrapper = mount(LoginView)

    const logo = wrapper.find('img[src="/favicon.png"]')
    expect(logo.exists()).toBe(true)
    expect(logo.attributes('alt')?.trim()).toBeTruthy()

    const brand = wrapper.find('[data-testid="login-brand"]')
    expect(brand.exists()).toBe(true)
    expect(brand.text()).toContain('GeodataHub')
  })
})
