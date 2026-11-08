/**
 * Suíte de Testes de Controle de Acessos, RBAC Dinâmico e Segregação de Funções (SoD).
 * Testes orientados a comportamentos e funções do sistema GeoRural.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AppSidebar from '@/components/AppSidebar.vue'
import AppNavbar from '@/components/AppNavbar.vue'
import ForbiddenView from '@/views/ForbiddenView.vue'
import UserManagementTab from '@/components/admin/UserManagementTab.vue'
import UserFormModal from '@/components/admin/UserFormModal.vue'
import SodExceptionModal from '@/components/admin/SodExceptionModal.vue'
import SecurityAuditTab from '@/components/admin/SecurityAuditTab.vue'
import { userService, type UserItem } from '@/services/user'
import {
  hasSoDConflict,
  isAuditorReadOnlyLocked,
  homeFor,
  getVisibleMenuItems,
} from '@/utils/rbac'
import { ROLE_DEFAULT_PERMISSIONS } from '@/mocks/user.mock'

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
  } as unknown as MediaQueryList)),
})

// Mock do Vue Router
const pushMock = vi.fn<(...args: unknown[]) => void>()
const replaceMock = vi.fn<(...args: unknown[]) => void>()

vi.mock('vue-router', () => ({
  useRoute: () => ({
    path: '/users',
    name: 'users',
  }),
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
  RouterLink: {
    props: ['to'],
    template: '<a :href="to" class="router-link"><slot /></a>',
  },
}))

describe('Controle de Acessos e Matriz de Permissões (RBAC)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userService.clearCurrentUser()
  })

  describe('Renderização Dinâmica do Menu Lateral e Navbar por Perfil', () => {
    it('exibe exclusivamente gerenciamento de usuários para o perfil Administrador', () => {
      userService.setCurrentUserRole('ADMIN')
      const menu = getVisibleMenuItems(userService.getCurrentUser())
      const labels = menu.map((m) => m.label)

      expect(labels).toContain('Gerenciamento de usuários')
      expect(labels).toContain('Perfil do usuário')
      expect(labels).not.toContain('Upload de carga')
      expect(labels).not.toContain('Dashboard')
      expect(labels).not.toContain('Catálogo de Bases')
      expect(labels).not.toContain('Mapa operacional')
    })

    it('exibe Dashboard, Upload, Catálogo e Mapa para o Operador de Dados', () => {
      userService.setCurrentUserRole('OPERADOR_DADOS')
      const menu = getVisibleMenuItems(userService.getCurrentUser())
      const labels = menu.map((m) => m.label)

      expect(labels).toContain('Dashboard')
      expect(labels).toContain('Upload de carga')
      expect(labels).toContain('Catálogo de Bases')
      expect(labels).not.toContain('Gerenciamento de usuários')
    })

    it('exibe Catálogo, Mapa e Análise Territorial para o Analista sem atalhos de ingestão', () => {
      userService.setCurrentUserRole('ANALISTA')
      const menu = getVisibleMenuItems(userService.getCurrentUser())
      const labels = menu.map((m) => m.label)

      expect(labels).toContain('Catálogo de Bases')
      expect(labels).toContain('Mapa operacional')
      expect(labels).toContain('Análise territorial')
      expect(labels).not.toContain('Upload de carga')
      expect(labels).not.toContain('Dashboard')
      expect(labels).not.toContain('Gerenciamento de usuários')
    })

    it('exibe módulos de consulta e auditoria para o Auditor Ambiental sem opções de escrita', () => {
      userService.setCurrentUserRole('AUDITOR')
      const menu = getVisibleMenuItems(userService.getCurrentUser())
      const labels = menu.map((m) => m.label)

      expect(labels).toContain('Dashboard')
      expect(labels).toContain('Catálogo de Bases')
      expect(labels).toContain('Mapa operacional')
      expect(labels).toContain('Análise territorial')
      expect(labels).not.toContain('Upload de carga')
      expect(labels).not.toContain('Gerenciamento de usuários')
    })

    it('exibe Dashboard, Catálogo, Mapa e Análise Territorial para o Gestor de Dados', () => {
      userService.setCurrentUserRole('GESTOR')
      const menu = getVisibleMenuItems(userService.getCurrentUser())
      const labels = menu.map((m) => m.label)

      expect(labels).toContain('Dashboard')
      expect(labels).toContain('Catálogo de Bases')
      expect(labels).toContain('Mapa operacional')
      expect(labels).toContain('Análise territorial')
      expect(labels).not.toContain('Upload de carga')
      expect(labels).not.toContain('Gerenciamento de usuários')
    })

    it('reflete dinamicamente as permissões concedidas a uma role customizada', () => {
      userService.setCurrentUser({
        id: 99,
        name: 'Analista Especialista',
        email: 'especialista@georural.com.br',
        role: 'ANALISTA_CUSTOM',
        permissions: ['MAPA:VISUALIZAR', 'BASES:CONSULTAR_CATALOGO'],
      })

      const menu = getVisibleMenuItems(userService.getCurrentUser())
      const labels = menu.map((m) => m.label)

      expect(labels).toContain('Catálogo de Bases')
      expect(labels).toContain('Mapa operacional')
      expect(labels).not.toContain('Upload de carga')
      expect(labels).not.toContain('Dashboard')
      expect(labels).not.toContain('Gerenciamento de usuários')
    })

    it('renderiza os links na Sidebar no DOM respeitando o filtro da sessão ativa', () => {
      userService.setCurrentUserRole('ADMIN')
      const sidebarWrapper = mount(AppSidebar)

      expect(sidebarWrapper.text()).toContain('Gerenciamento de usuários')
      expect(sidebarWrapper.text()).not.toContain('Upload de carga')
      expect(sidebarWrapper.text()).not.toContain('Dashboard')
    })

    it('oculta atalhos de mapa e nova carga na barra superior quando o usuário não tiver permissão', () => {
      userService.setCurrentUserRole('ADMIN')
      const navbarWrapper = mount(AppNavbar)

      expect(navbarWrapper.find('a[href="/upload"]').exists()).toBe(false)
      expect(navbarWrapper.find('a[href="/mapa"]').exists()).toBe(false)

      userService.setCurrentUserRole('OPERADOR_DADOS')
      const opNavbar = mount(AppNavbar)
      expect(opNavbar.find('a[href="/upload"]').exists()).toBe(true)
    })
  })

  describe('Página de Bloqueio 403 e Navegação Segura', () => {
    it('renderiza o aviso de acesso não autorizado e a role do usuário bloqueado', () => {
      userService.setCurrentUserRole('OPERADOR_DADOS')
      const wrapper = mount(ForbiddenView)

      expect(wrapper.find('h1').text()).toContain('Acesso Não Autorizado')
      expect(wrapper.text()).toContain('Operador')
      expect(wrapper.find('[data-testid="btn-return-home"]').exists()).toBe(true)
    })

    it('redireciona para a área inicial do perfil ao acionar o botão de retorno', async () => {
      userService.setCurrentUserRole('ADMIN')
      const wrapper = mount(ForbiddenView)

      await wrapper.find('[data-testid="btn-return-home"]').trigger('click')
      expect(pushMock).toHaveBeenCalledWith('/users')

      userService.setCurrentUserRole('OPERADOR_DADOS')
      const opWrapper = mount(ForbiddenView)
      await opWrapper.find('[data-testid="btn-return-home"]').trigger('click')
      expect(pushMock).toHaveBeenCalledWith('/')
    })

    it('calcula corretamente a rota inicial padrão para cada perfil', () => {
      expect(homeFor({ name: 'A', role: 'ADMIN', permissions: ROLE_DEFAULT_PERMISSIONS.ADMIN })).toBe('/users')
      expect(homeFor({ name: 'B', role: 'OPERADOR_DADOS', permissions: ROLE_DEFAULT_PERMISSIONS.OPERADOR_DADOS })).toBe('/')
      expect(homeFor({ name: 'C', role: 'ANALISTA', permissions: ROLE_DEFAULT_PERMISSIONS.ANALISTA })).toBe('/analise-territorial')
      expect(homeFor({ name: 'D', role: 'AUDITOR', permissions: ROLE_DEFAULT_PERMISSIONS.AUDITOR })).toBe('/catalogo')
      expect(homeFor({ name: 'E', role: 'GESTOR', permissions: ROLE_DEFAULT_PERMISSIONS.GESTOR })).toBe('/catalogo')
    })
  })

  describe('Travas Visuais de Integridade e Auto-Exclusão', () => {
    const mockUsers: UserItem[] = [
      {
        id: 1,
        name: 'Carlos Admin',
        email: 'admin@georural.com.br',
        role: 'ADMIN',
        permissions: [...ROLE_DEFAULT_PERMISSIONS.ADMIN],
        department: 'Diretoria',
        status: 'Ativo',
        lastLogin: 'Hoje',
      },
      {
        id: 2,
        name: 'Mariana Analista',
        email: 'mariana@georural.com.br',
        role: 'ANALISTA',
        permissions: [...ROLE_DEFAULT_PERMISSIONS.ANALISTA],
        department: 'Espacial',
        status: 'Ativo',
        lastLogin: 'Ontem',
      },
    ]

    it('desabilita o botão de inativação para a conta do próprio administrador logado', () => {
      const wrapper = mount(UserManagementTab, {
        props: {
          users: mockUsers,
          availableRoles: [{ value: 'ADMIN', label: 'ADMIN', desc: '' }],
          loggedInAdminEmail: 'admin@georural.com.br',
        },
      })

      const statusButtons = wrapper.findAll('[data-testid="btn-action-toggle-status"]')
      expect(statusButtons.length).toBe(2)

      // Linha 1 é o próprio admin logado -> deve estar desabilitado
      expect(statusButtons[0]!.attributes('disabled')).toBeDefined()
      expect(statusButtons[0]!.classes()).toContain('btn-disabled')

      // Linha 2 é outro colaborador -> habilitado
      expect(statusButtons[1]!.attributes('disabled')).toBeUndefined()
    })

    it('bloqueia o seletor de cargo no formulário de edição para evitar auto-rebaixamento', () => {
      const wrapper = mount(UserFormModal, {
        props: {
          isOpen: true,
          isEditing: true,
          userToEdit: mockUsers[0],
          availableRoles: [{ value: 'ADMIN', label: 'ADMIN', desc: '' }],
          loggedInAdminEmail: 'admin@georural.com.br',
        },
      })

      const roleSelect = wrapper.find('[data-testid="select-user-role"]')
      expect(roleSelect.attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toContain('Auto-rebaixamento bloqueado')
    })

    it('mantém as caixas de mutação do Auditor permanentemente travadas na matriz', () => {
      expect(isAuditorReadOnlyLocked('INGESTAO:UPLOAD')).toBe(true)
      expect(isAuditorReadOnlyLocked('BASES:HOMOLOGAR')).toBe(true)
      expect(isAuditorReadOnlyLocked('QUARENTENA:DESCARTAR')).toBe(true)
      expect(isAuditorReadOnlyLocked('EXPORTACAO:CSV')).toBe(true)

      // Permissões de leitura permitidas para o Auditor
      expect(isAuditorReadOnlyLocked('AUDITORIA:VISUALIZAR')).toBe(false)
      expect(isAuditorReadOnlyLocked('BASES:CONSULTAR_CATALOGO')).toBe(false)
      expect(isAuditorReadOnlyLocked('MAPA:VISUALIZAR')).toBe(false)
    })
  })

  describe('Segregação de Funções (SoD) e Validações', () => {
    it('detecta conflito SoD quando há acúmulo de Ingestão de Cargas e Homologação', () => {
      // Incompatível
      expect(hasSoDConflict(['INGESTAO:UPLOAD', 'BASES:HOMOLOGAR'])).toBe(true)
      expect(hasSoDConflict(['INGESTAO:UPLOAD', 'INDICADORES:HOMOLOGAR'])).toBe(true)

      // Compatível
      expect(hasSoDConflict(['INGESTAO:UPLOAD', 'MAPA:VISUALIZAR'])).toBe(false)
      expect(hasSoDConflict(['BASES:HOMOLOGAR', 'INDICADORES:VISUALIZAR'])).toBe(false)
      expect(hasSoDConflict(ROLE_DEFAULT_PERMISSIONS.OPERADOR_DADOS)).toBe(false)
      expect(hasSoDConflict(ROLE_DEFAULT_PERMISSIONS.GESTOR)).toBe(false)
    })

    it('exige marcação explícita e justificativa no modal de autorização SoD', async () => {
      const wrapper = mount(SodExceptionModal, {
        props: {
          isOpen: true,
          userName: 'Lucas Operador-Gestor',
        },
      })

      const confirmBtn = wrapper.find('[data-testid="sod-confirm-btn"]')
      expect(confirmBtn.attributes('disabled')).toBeDefined()

      // Marca o checkbox
      const checkbox = wrapper.find('[data-testid="sod-authorize-checkbox"]')
      await checkbox.setValue(true)
      expect(confirmBtn.attributes('disabled')).toBeDefined()

      // Preenche a justificativa obrigatória
      const textarea = wrapper.find('[data-testid="sod-justification-input"]')
      await textarea.setValue('Autorização temporária para cobrir escala de fechamento de safra')

      expect(confirmBtn.attributes('disabled')).toBeUndefined()

      await confirmBtn.trigger('click')
      expect(wrapper.emitted('confirm')).toBeDefined()
      expect(wrapper.emitted('confirm')![0]![0]).toContain('fechamento de safra')
    })

    it('valida obrigatoriedade de campos e força mínima da senha no cadastro', async () => {
      const wrapper = mount(UserFormModal, {
        props: {
          isOpen: true,
          isEditing: false,
          availableRoles: [{ value: 'ANALISTA', label: 'ANALISTA', desc: '' }],
        },
      })

      // Submete formulário em branco
      await wrapper.find('form').trigger('submit.prevent')
      await flushPromises()

      expect(wrapper.find('[data-testid="error-user-name"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="error-user-email"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="error-user-password"]').exists()).toBe(true)

      // Senha fraca sem símbolos
      const passwordInput = wrapper.find('[data-testid="input-user-password"]')
      await passwordInput.setValue('senhafraca123')
      await wrapper.find('form').trigger('submit.prevent')
      await flushPromises()

      expect(wrapper.text()).toContain('letra maiúscula, minúscula, número e caractere especial')
    })

    it('exibe badge de exceção SoD na tabela de colaboradores quando concedida', () => {
      const usersWithSod: UserItem[] = [
        {
          id: 10,
          name: 'Usuário SoD',
          email: 'sod@georural.com.br',
          role: 'OPERADOR_DADOS',
          permissions: ['INGESTAO:UPLOAD', 'BASES:HOMOLOGAR'],
          department: 'Operações',
          status: 'Ativo',
          lastLogin: 'Hoje',
          sodException: true,
          sodJustification: 'Plantão emergencial',
        },
      ]

      const wrapper = mount(UserManagementTab, {
        props: {
          users: usersWithSod,
          availableRoles: [],
        },
      })

      expect(wrapper.find('[data-testid="badge-sod-active"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="badge-sod-active"]').text()).toContain('Exceção SoD')
    })
  })

  describe('Auditoria de Segurança e Trilha de Eventos Administrativos', () => {
    it('renderiza os registros de criação, trocas de cargo, inativações e tentativas 403', () => {
      const mockEvents = [
        {
          id: 1,
          timestamp: '08/11/2026 10:00',
          actorName: 'Carlos Admin',
          actorEmail: 'admin@georural.com.br',
          action: 'Criação de Conta',
          details: 'Cadastrou o usuário Patrícia Souza com papel AUDITOR.',
          severity: 'INFO' as const,
        },
        {
          id: 2,
          timestamp: '08/11/2026 11:00',
          actorName: 'Carlos Admin',
          actorEmail: 'admin@georural.com.br',
          action: 'Tentativa de Acesso Barrada (403)',
          details: 'Tentou acessar a rota "/users" sem permissão.',
          severity: 'WARNING' as const,
        },
      ]

      const wrapper = mount(SecurityAuditTab, {
        props: {
          events: mockEvents,
        },
      })

      const rows = wrapper.findAll('[data-testid="audit-event-row"]')
      expect(rows.length).toBe(2)
      expect(wrapper.text()).toContain('Criação de Conta')
      expect(wrapper.text()).toContain('Tentativa de Acesso Barrada (403)')
      expect(wrapper.text()).toContain('Patrícia Souza')
    })
  })
})
