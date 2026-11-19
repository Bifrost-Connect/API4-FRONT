import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import UserView from '../UserView.vue'
import SecurityAuditTab from '@/components/admin/SecurityAuditTab.vue'
import SodExceptionModal from '@/components/admin/SodExceptionModal.vue'
import ProfileView from '../ProfileView.vue'
import { userService } from '@/services/user'
import { roleService } from '@/services/roles'
import { apiKeyService } from '@/services/apiKeyService'
import api from '@/services/api'
import { MOCK_ROLES, MOCK_USERS_LIST, MOCK_SECURITY_EVENTS } from '@/__tests__/mocks/user.mock'
import { setTestUserRole } from '@/__tests__/mocks/testAuthHelper'
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

describe('UserView - Permissões Granulares, Edição de Senha e Fluxos Administrativos (US13)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    localStorage.clear()
    setTestUserRole('ADMIN')
    vi.spyOn(userService, 'getUsersAsync').mockResolvedValue(
      MOCK_USERS_LIST.map((u) => ({ ...u, permissions: [...u.permissions] })),
    )
    vi.spyOn(roleService, 'getRoles').mockResolvedValue([...MOCK_ROLES])
    vi.spyOn(roleService, 'getRoleById').mockImplementation(async (id) =>
      MOCK_ROLES.find((r) => r.id === id),
    )
    vi.spyOn(userService, 'getSecurityEvents').mockResolvedValue([...MOCK_SECURITY_EVENTS])
    vi.spyOn(userService, 'getSecurityEventsPagedAsync').mockRejectedValue(new Error('offline'))
    vi.spyOn(apiKeyService, 'listKeys').mockResolvedValue([])
  })

  it('exibe botão de permissões (sem botão isolado de senha), badge de customização e abre permissions-modal', async () => {
    vi.spyOn(userService, 'getUsersAsync').mockResolvedValueOnce(
      MOCK_USERS_LIST.map((u, idx) => ({
        ...u,
        permissions: [...u.permissions],
        hasCustomPermissions: idx === 1,
      })),
    )

    const wrapper = mount(UserView)
    await flushPromises()

    expect(wrapper.findAll('[data-testid="btn-action-reset-password"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="badge-custom-permissions"]')).toHaveLength(1)
    const permBtns = wrapper.findAll('[data-testid="btn-action-permissions"]')
    expect(permBtns.length).toBeGreaterThan(0)
    expect(permBtns[1]!.attributes('title')).toContain('Customizadas')

    await permBtns[1]!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="permissions-modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reset-password-modal"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="permissions-modal"]').text()).toContain(MOCK_USERS_LIST[1]!.name)
  })

  it('salva permissões customizadas sem conflito SoD via userService.updateUserPermissionsAsync', async () => {
    const target = MOCK_USERS_LIST[1]! // Mariana Duarte (ANALISTA)
    const updatedUser = {
      ...target,
      permissions: [...target.permissions, 'INGESTAO:VISUALIZAR_PROCESSAMENTO'],
      hasCustomPermissions: true,
    }
    const updatePermsSpy = vi
      .spyOn(userService, 'updateUserPermissionsAsync')
      .mockResolvedValueOnce(updatedUser)

    const wrapper = mount(UserView)
    await flushPromises()

    await wrapper.findAll('[data-testid="btn-action-permissions"]')[1]!.trigger('click')
    await flushPromises()

    await wrapper
      .find('[data-testid="toggle-perm-INGESTAO-VISUALIZAR_PROCESSAMENTO"]')
      .trigger('click')
    await wrapper.find('[data-testid="btn-permissions-save"]').trigger('click')
    await flushPromises()

    expect(updatePermsSpy).toHaveBeenCalledWith(
      target.id,
      expect.arrayContaining(['INGESTAO:VISUALIZAR_PROCESSAMENTO']),
      undefined,
    )
    expect(wrapper.find('[data-testid="permissions-modal"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="toast-feedback"]').text()).toContain('Permissões de')
  })

  it('exige justificativa no SodExceptionModal quando permissões customizadas causam conflito SoD', async () => {
    const target = MOCK_USERS_LIST[1]! // Mariana Duarte (ANALISTA, sodException falsy)
    const updatedUser = {
      ...target,
      permissions: [...target.permissions, 'INGESTAO:UPLOAD', 'BASES:HOMOLOGAR'],
      sodException: true,
      sodJustification: 'Cobertura de safra autorizada pela diretoria',
      hasCustomPermissions: true,
    }
    const updatePermsSpy = vi
      .spyOn(userService, 'updateUserPermissionsAsync')
      .mockResolvedValueOnce(updatedUser)

    const wrapper = mount(UserView)
    await flushPromises()

    await wrapper.findAll('[data-testid="btn-action-permissions"]')[1]!.trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="toggle-perm-INGESTAO-UPLOAD"]').trigger('click')
    await wrapper.find('[data-testid="toggle-perm-BASES-HOMOLOGAR"]').trigger('click')
    await wrapper.find('[data-testid="btn-permissions-save"]').trigger('click')
    await flushPromises()

    expect(updatePermsSpy).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="sod-modal"]').exists()).toBe(true)

    await wrapper.find('[data-testid="sod-authorize-checkbox"]').setValue(true)
    await wrapper
      .find('[data-testid="sod-justification-input"]')
      .setValue('Cobertura de safra autorizada pela diretoria')
    await wrapper.find('[data-testid="sod-confirm-btn"]').trigger('click')
    await flushPromises()

    expect(updatePermsSpy).toHaveBeenCalledWith(
      target.id,
      expect.arrayContaining(['INGESTAO:UPLOAD', 'BASES:HOMOLOGAR']),
      {
        sodException: true,
        sodJustification: 'Cobertura de safra autorizada pela diretoria',
      },
    )
    expect(wrapper.find('[data-testid="permissions-modal"]').exists()).toBe(false)
  })

  it('restaura permissões padrão do cargo ao clicar em Restaurar Padrão do Cargo', async () => {
    const target = MOCK_USERS_LIST[1]!
    const defaults = ['BASES:VISUALIZAR', 'MAPA:VISUALIZAR']
    const resetPermsSpy = vi
      .spyOn(userService, 'resetPermissionsToRoleAsync')
      .mockResolvedValueOnce(defaults)

    const wrapper = mount(UserView)
    await flushPromises()

    await wrapper.findAll('[data-testid="btn-action-permissions"]')[1]!.trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="btn-reset-role-permissions"]').trigger('click')
    await flushPromises()

    expect(resetPermsSpy).toHaveBeenCalledWith(target.id)
    expect(wrapper.find('[data-testid="permissions-modal"]').text()).toContain('Total concedido: 2')
    expect(wrapper.find('[data-testid="toast-feedback"]').text()).toContain('restauradas')
  })

  it('exibe input de senha opcional no modal de edição: senha em branco não chama resetPasswordAsync, senha válida chama', async () => {
    const target = MOCK_USERS_LIST[1]! // Mariana Duarte
    const updateSpy = vi.spyOn(userService, 'updateUserAsync').mockResolvedValue(target)
    const resetPwdSpy = vi.spyOn(userService, 'resetPasswordAsync').mockResolvedValue()

    const wrapper = mount(UserView)
    await flushPromises()

    // Edição com senha em branco
    await wrapper.findAll('[data-testid="btn-action-edit"]')[1]!.trigger('click')
    await flushPromises()

    const pwdInput = wrapper.find('[data-testid="input-user-password"]')
    expect(pwdInput.exists()).toBe(true)
    expect((pwdInput.element as HTMLInputElement).value).toBe('')

    await wrapper.find('[data-testid="user-form-modal"] form').trigger('submit.prevent')
    await flushPromises()

    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect(resetPwdSpy).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="user-form-modal"]').exists()).toBe(false)

    // Edição com senha preenchida
    await wrapper.findAll('[data-testid="btn-action-edit"]')[1]!.trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="input-user-password"]').setValue('NovaSenha@123')
    await wrapper.find('[data-testid="user-form-modal"] form').trigger('submit.prevent')
    await flushPromises()

    expect(updateSpy).toHaveBeenCalledTimes(2)
    expect(resetPwdSpy).toHaveBeenCalledWith(target.id, 'NovaSenha@123')
  })

  it('ao editar o próprio administrador apenas redefinindo senha, chama resetPasswordAsync sem chamar updateUserAsync', async () => {
    userService.setCurrentUser({
      id: 1,
      name: 'Carlos Mendes',
      email: 'carlos.mendes@georural.com.br',
      role: 'ADMIN',
      roleId: 'ADMIN',
      permissions: ['USUARIOS:VISUALIZAR', 'USUARIOS:EDITAR'],
    })
    const updateSpy = vi.spyOn(userService, 'updateUserAsync').mockResolvedValue(MOCK_USERS_LIST[0]!)
    const resetPwdSpy = vi.spyOn(userService, 'resetPasswordAsync').mockResolvedValue()

    const wrapper = mount(UserView)
    await flushPromises()

    await wrapper.findAll('[data-testid="btn-action-edit"]')[0]!.trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="input-user-password"]').setValue('MinhaSenha@2026')
    await wrapper.find('[data-testid="user-form-modal"] form').trigger('submit.prevent')
    await flushPromises()

    expect(updateSpy).not.toHaveBeenCalled()
    expect(resetPwdSpy).toHaveBeenCalledWith(MOCK_USERS_LIST[0]!.id, 'MinhaSenha@2026')
  })

  it('trava permissões não read-only para AUDITOR no permissions-modal e exibe erro de API em toast ao salvar', async () => {
    const updatePermsSpy = vi
      .spyOn(userService, 'updateUserPermissionsAsync')
      .mockRejectedValueOnce(new Error('Falha simulada de permissão'))

    const wrapper = mount(UserView)
    await flushPromises()

    // MOCK_USERS_LIST[3] é Patrícia Souza (AUDITOR)
    await wrapper.findAll('[data-testid="btn-action-permissions"]')[3]!.trigger('click')
    await flushPromises()

    const lockedBtn = wrapper.find('[data-testid="toggle-perm-INGESTAO-UPLOAD"]')
    expect(lockedBtn.attributes('disabled')).toBeDefined()
    expect(lockedBtn.text()).toContain('Bloqueado')

    const readOnlyBtn = wrapper.find('[data-testid="toggle-perm-MAPA-VISUALIZAR"]')
    expect(readOnlyBtn.attributes('disabled')).toBeUndefined()

    await wrapper.find('[data-testid="btn-permissions-save"]').trigger('click')
    await flushPromises()

    expect(updatePermsSpy).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="permissions-modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="toast-feedback"]').text()).toContain('Falha simulada de permissão')
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
      },
      { accessToken: 'real-jwt' },
    )

    const wrapper = mount(ProfileView)
    expect(wrapper.text()).toContain('Carlos JWT')
    expect(wrapper.text()).toContain('carlos.jwt@georural.com.br')
    expect(wrapper.text()).toContain('USUARIOS:VISUALIZAR')
    expect(wrapper.text()).toContain('Autenticado via JWT')
  })

  it('exibe todas as 4 abas para ADMIN e inicia em Colaboradores e Acessos', async () => {
    setTestUserRole('ADMIN')
    const wrapper = mount(UserView)
    await flushPromises()

    expect(wrapper.find('[data-testid="tab-colaboradores"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tab-matriz"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tab-auditoria"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tab-chaves-api"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tab-colaboradores"]').classes()).toContain('active')
  })

  it('para GESTOR e INTEGRADOR_EXTERNO exibe apenas a aba Chaves de API, abre nela e não dispara buscas administrativas restritas', async () => {
    for (const role of ['GESTOR', 'INTEGRADOR_EXTERNO'] as const) {
      vi.clearAllMocks()
      const usersSpy = vi.spyOn(userService, 'getUsersAsync').mockResolvedValue([])
      const rolesSpy = vi.spyOn(roleService, 'getRoles').mockResolvedValue([])
      const eventsSpy = vi.spyOn(userService, 'getSecurityEvents').mockResolvedValue([])
      vi.spyOn(apiKeyService, 'listKeys').mockResolvedValue([])

      setTestUserRole(role)
      const wrapper = mount(UserView)
      await flushPromises()

      expect(wrapper.find('[data-testid="tab-colaboradores"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="tab-matriz"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="tab-auditoria"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="tab-chaves-api"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="tab-chaves-api"]').classes()).toContain('active')
      expect(wrapper.find('[data-testid="api-keys-tab"]').exists()).toBe(true)

      expect(usersSpy).not.toHaveBeenCalled()
      expect(rolesSpy).not.toHaveBeenCalled()
      expect(eventsSpy).not.toHaveBeenCalled()
    }
  })

  it('usa mapCustomUserPermissionsToFront no loginWithCredentials quando permissoes_customizadas é array e sincroniza sessão ao atualizar/resetar permissões', async () => {
    const futureExp = new Date(Date.now() + 3600_000).toISOString()
    vi.spyOn(api, 'post').mockResolvedValueOnce({
      data: {
        token: 'jwt-custom-123',
        tipo: 'Bearer',
        expira_em: futureExp,
        usuario: {
          id: 77,
          nome: 'Gestor Custom',
          email: 'gestor.custom@georural.com.br',
          perfil: 'GESTOR',
          permissoes: ['CATALOGO_CONSULTAR', 'CHAVE_API_GERENCIAR'],
          permissoes_customizadas: ['BASES:VISUALIZAR', 'MAPA:COMPARAR_SAFRAS'],
        },
      },
    })

    const session = await userService.loginWithCredentials('gestor.custom@georural.com.br', 'Senha@123')
    expect(session.permissions).toContain('BASES:VISUALIZAR')
    expect(session.permissions).toContain('MAPA:COMPARAR_SAFRAS')
    expect(session.permissions).not.toContain('API:VISUALIZAR_CHAVES')

    const mockRepo = {
      updateUserPermissions: vi
        .fn<
          (
            id: number,
            permissions: string[],
            sod?: { sodException?: boolean; sodJustification?: string },
          ) => Promise<typeof MOCK_USERS_LIST[number] | null>
        >()
        .mockResolvedValueOnce({
          ...MOCK_USERS_LIST[1]!,
          id: 77,
          permissions: ['PERFIL:VISUALIZAR', 'MAPA:VISUALIZAR'],
          hasCustomPermissions: true,
        }),
      resetUserPermissions: vi
        .fn<(id: number) => Promise<string[]>>()
        .mockResolvedValueOnce(['PERFIL:VISUALIZAR', 'BASES:HOMOLOGAR']),
    }
    vi.spyOn(roleService, 'getRepo').mockReturnValue(mockRepo as never)

    const updated = await userService.updateUserPermissionsAsync(
      77,
      ['MAPA:VISUALIZAR'],
      { sodException: false, sodJustification: '' },
    )
    expect(mockRepo.updateUserPermissions).toHaveBeenCalledWith(
      77,
      ['MAPA:VISUALIZAR'],
      { sodException: false, sodJustification: '' },
    )
    expect(updated?.permissions).toEqual(['PERFIL:VISUALIZAR', 'MAPA:VISUALIZAR'])
    expect(userService.getCurrentUser().permissions).toEqual(['PERFIL:VISUALIZAR', 'MAPA:VISUALIZAR'])
    expect(authStorage.getSession()?.permissions).toEqual(['PERFIL:VISUALIZAR', 'MAPA:VISUALIZAR'])

    const defaults = await userService.resetPermissionsToRoleAsync(77)
    expect(mockRepo.resetUserPermissions).toHaveBeenCalledWith(77)
    expect(defaults).toEqual(['PERFIL:VISUALIZAR', 'BASES:HOMOLOGAR'])
    expect(userService.getCurrentUser().permissions).toEqual(['PERFIL:VISUALIZAR', 'BASES:HOMOLOGAR'])
    expect(authStorage.getSession()?.permissions).toEqual(['PERFIL:VISUALIZAR', 'BASES:HOMOLOGAR'])
  })
})
