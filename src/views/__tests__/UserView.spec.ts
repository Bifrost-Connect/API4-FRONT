import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import UserView from '../UserView.vue'
import SecurityAuditTab from '@/components/admin/SecurityAuditTab.vue'
import SodExceptionModal from '@/components/admin/SodExceptionModal.vue'
import ProfileView from '../ProfileView.vue'
import { userService } from '@/services/user'
import { roleService } from '@/services/roles'
import { MOCK_ROLES, MOCK_USERS_LIST, MOCK_SECURITY_EVENTS } from '@/mocks/user.mock'
import { authStorage } from '@/services/storage/authStorage'

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

describe('UserView - Redefinição de Senha e Fluxos Administrativos (US13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    userService.setCurrentUserRole('ADMIN')
    vi.spyOn(userService, 'getUsersAsync').mockResolvedValue([...MOCK_USERS_LIST])
    vi.spyOn(roleService, 'getRoles').mockResolvedValue([...MOCK_ROLES])
    vi.spyOn(userService, 'getSecurityEvents').mockResolvedValue([...MOCK_SECURITY_EVENTS])
  })

  it('abre modal de redefinição de senha, valida confirmação e chama resetPasswordAsync', async () => {
    const resetSpy = vi.spyOn(userService, 'resetPasswordAsync').mockResolvedValueOnce()

    const wrapper = mount(UserView)
    await flushPromises()

    const resetBtns = wrapper.findAll('[data-testid="btn-action-reset-password"]')
    expect(resetBtns.length).toBeGreaterThan(0)
    await resetBtns[0]!.trigger('click')

    expect(wrapper.find('[data-testid="reset-password-modal"]').exists()).toBe(true)

    // Senhas divergentes devem mostrar erro e não chamar API
    await wrapper.find('[data-testid="input-reset-new-password"]').setValue('NovaSenha@123')
    await wrapper.find('[data-testid="input-reset-confirm-password"]').setValue('Diferente@123')
    await wrapper.find('[data-testid="reset-password-modal"] form').trigger('submit.prevent')
    await flushPromises()

    expect(resetSpy).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="reset-password-modal"]').text()).toContain('não conferem')

    // Senhas iguais e >= 8 caracteres devem chamar resetPasswordAsync
    await wrapper.find('[data-testid="input-reset-confirm-password"]').setValue('NovaSenha@123')
    await wrapper.find('[data-testid="reset-password-modal"] form').trigger('submit.prevent')
    await flushPromises()

    expect(resetSpy).toHaveBeenCalledWith(MOCK_USERS_LIST[0]!.id, 'NovaSenha@123')
    expect(wrapper.find('[data-testid="reset-password-modal"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="toast-feedback"]').text()).toContain('redefinida com sucesso')
  })

  it('exige justificativa com pelo menos 10 caracteres no modal SoD', async () => {
    const wrapper = mount(SodExceptionModal, {
      props: {
        isOpen: true,
        userName: 'Operador Teste',
      },
    })

    await wrapper.find('[data-testid="sod-authorize-checkbox"]').setValue(true)
    await wrapper.find('[data-testid="sod-justification-input"]').setValue('curto')

    expect(wrapper.find('[data-testid="sod-confirm-btn"]').attributes('disabled')).toBeDefined()

    await wrapper
      .find('[data-testid="sod-justification-input"]')
      .setValue('Justificativa válida com mais de dez caracteres')
    expect(wrapper.find('[data-testid="sod-confirm-btn"]').attributes('disabled')).toBeUndefined()
  })

  it('filtra eventos na aba de auditoria por ação enum e intervalo de datas', async () => {
    const events = [
      {
        id: 1,
        timestamp: '10/11/2026 10:00',
        actorName: 'Admin',
        actorEmail: 'admin@georural.com.br',
        action: 'Criação de Conta',
        actionCode: 'USUARIO_CRIADO',
        details: 'Criou usuário A',
        severity: 'INFO' as const,
      },
      {
        id: 2,
        timestamp: '15/11/2026 15:00',
        actorName: 'Admin',
        actorEmail: 'admin@georural.com.br',
        action: 'Redefinição de Senha',
        actionCode: 'SENHA_REDEFINIDA',
        details: 'Redefiniu senha de B',
        severity: 'INFO' as const,
      },
    ]

    const wrapper = mount(SecurityAuditTab, { props: { events } })
    expect(wrapper.findAll('[data-testid="audit-event-row"]')).toHaveLength(2)

    await wrapper.find('[data-testid="filter-audit-type"]').setValue('SENHA_REDEFINIDA')
    expect(wrapper.findAll('[data-testid="audit-event-row"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Redefiniu senha de B')

    await wrapper.find('[data-testid="filter-audit-type"]').setValue('')
    await wrapper.find('[data-testid="audit-date-from"]').setValue('2026-11-12')
    expect(wrapper.findAll('[data-testid="audit-event-row"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('15/11/2026 15:00')
  })

  it('exibe dados e permissões ativas da sessão JWT na ProfileView', () => {
    userService.setCurrentUser({
      id: 1,
      name: 'Carlos JWT',
      email: 'carlos.jwt@georural.com.br',
      role: 'ADMIN',
      roleId: 'ADMIN',
      permissions: ['USUARIOS:VISUALIZAR', 'PERFIL:VISUALIZAR'],
    })
    authStorage.saveSession(
      {
        userId: 1,
        name: 'Carlos JWT',
        email: 'carlos.jwt@georural.com.br',
        role: 'ADMIN',
        roleId: 'ADMIN',
        permissions: ['USUARIOS:VISUALIZAR', 'PERFIL:VISUALIZAR'],
        loggedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        isSimulated: false,
      },
      { accessToken: 'real-jwt' },
    )

    const wrapper = mount(ProfileView)
    expect(wrapper.text()).toContain('Carlos JWT')
    expect(wrapper.text()).toContain('carlos.jwt@georural.com.br')
    expect(wrapper.text()).toContain('USUARIOS:VISUALIZAR')
    expect(wrapper.text()).toContain('Autenticado via JWT')
  })
})
