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

describe('LoginView - Autenticação Real e Fallback Offline', () => {
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

  it('exibe erro na UI e nunca faz fallback offline quando o back-end retorna 401', async () => {
    vi.spyOn(userService, 'loginWithCredentials').mockRejectedValueOnce({
      response: {
        status: 401,
        data: { erro: 'E-mail ou senha inválidos, ou usuário inativo.' },
      },
    })
    const demoSpy = vi.spyOn(userService, 'loginDemoOffline')

    const wrapper = mount(LoginView)
    await wrapper.find('[data-testid="login-email-input"]').setValue('operador@georural.com.br')
    await wrapper.find('[data-testid="login-password-input"]').setValue('SenhaErrada')

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(demoSpy).not.toHaveBeenCalled()
    expect(replaceMock).not.toHaveBeenCalled()
    const banner = wrapper.find('[data-testid="login-error-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('E-mail ou senha inválidos')
  })

  it('faz fallback para sessão demo offline apenas quando perfil demo é usado e o back-end está inacessível (erro de rede)', async () => {
    vi.spyOn(userService, 'loginWithCredentials').mockRejectedValueOnce({
      code: 'ERR_NETWORK',
      message: 'Network Error',
    })
    const demoSpy = vi.spyOn(userService, 'loginDemoOffline')

    const wrapper = mount(LoginView)
    // Clica no botão de perfil de demonstração "Entrar Operador"
    const buttons = wrapper.findAll('button')
    const opBtn = buttons.find((b) => b.text().includes('Entrar Operador'))
    expect(opBtn).toBeDefined()
    await opBtn!.trigger('click')

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(demoSpy).toHaveBeenCalledWith('Operador')
    expect(replaceMock).toHaveBeenCalledWith('/')
  })
})
