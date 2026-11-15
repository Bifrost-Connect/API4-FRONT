import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '@/services/api'
import { HttpAccessRepository } from '../access/HttpAccessRepository'
import { DuplicateEmailError } from '../access/MockAccessRepository'

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}))

const mockMatrixResponse = [
  {
    perfil_id: 1,
    perfil: 'ADMINISTRADOR',
    descricao: 'Administrador do sistema',
    recurso: 'ADMINISTRACAO',
    permissao: 'USUARIO_GERENCIAR',
    descricao_permissao: 'Gerenciar usuários',
    liberada_por_excecao_sod: false,
  },
  {
    perfil_id: 2,
    perfil: 'ANALISTA',
    descricao: 'Analista territorial',
    recurso: 'TERRITORIAL',
    permissao: 'ANALISE_EXECUTAR',
    descricao_permissao: 'Executar análises',
    liberada_por_excecao_sod: false,
  },
  {
    perfil_id: 3,
    perfil: 'GESTOR',
    descricao: 'Gestor de governança',
    recurso: 'PUBLICACAO',
    permissao: 'CARGA_APROVAR',
    descricao_permissao: 'Aprovar cargas',
    liberada_por_excecao_sod: false,
  },
]

describe('HttpAccessRepository', () => {
  let repo: HttpAccessRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new HttpAccessRepository()
  })

  it('lista usuários paginados de GET /admin/usuarios e mapeia UserItem[]', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        content: [
          {
            id: 10,
            nome: 'Ana Paula',
            email: 'ana@georural.com.br',
            perfil_id: 2,
            perfil: 'ANALISTA',
            ativo: true,
            excecao_sod_autorizada: false,
            justificativa_sod: null,
            data_criacao: '2026-11-01T10:00:00Z',
            data_atualizacao: '2026-11-10T12:00:00Z',
          },
        ],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      },
    })

    const users = await repo.listUsers()

    expect(api.get).toHaveBeenCalledWith('/admin/usuarios', { params: expect.any(Object) })
    expect(users).toHaveLength(1)
    expect(users[0]!.name).toBe('Ana Paula')
    expect(users[0]!.role).toBe('ANALISTA')
    expect(users[0]!.status).toBe('Ativo')
  })

  it('resolve perfilId via /admin/perfis-permissoes ao criar usuário em POST /admin/usuarios', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockMatrixResponse })
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        id: 99,
        nome: 'Novo Analista',
        email: 'novo@georural.com.br',
        perfil_id: 2,
        perfil: 'ANALISTA',
        ativo: true,
        data_criacao: '2026-11-15T15:00:00Z',
        data_atualizacao: '2026-11-15T15:00:00Z',
      },
    })

    const created = await repo.createUser({
      name: 'Novo Analista',
      email: 'novo@georural.com.br',
      role: 'ANALISTA',
      temporaryPassword: 'Senha@123',
    })

    expect(api.get).toHaveBeenCalledWith('/admin/perfis-permissoes')
    expect(api.post).toHaveBeenCalledWith('/admin/usuarios', {
      nome: 'Novo Analista',
      email: 'novo@georural.com.br',
      senha: 'Senha@123',
      perfilId: 2,
    })
    expect(created.id).toBe(99)
    expect(created.role).toBe('ANALISTA')
  })

  it('lança DuplicateEmailError quando POST /admin/usuarios retorna HTTP 409', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockMatrixResponse })
    vi.mocked(api.post).mockRejectedValueOnce({
      response: {
        status: 409,
        data: { erro: 'E-mail já cadastrado.' },
      },
    })

    await expect(
      repo.createUser({
        name: 'Duplicado',
        email: 'dup@georural.com.br',
        role: 'ANALISTA',
        temporaryPassword: 'Senha@123',
      }),
    ).rejects.toThrow(DuplicateEmailError)
  })

  it('atualiza perfil e exceção SoD via PUT /admin/usuarios/{id}/permissoes', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockMatrixResponse })
    vi.mocked(api.put).mockResolvedValueOnce({
      data: {
        id: 10,
        nome: 'Ana Paula',
        email: 'ana@georural.com.br',
        perfil_id: 3,
        perfil: 'GESTOR',
        ativo: true,
        excecao_sod_autorizada: true,
        justificativa_sod: 'Substituição emergencial de gestor',
      },
    })

    const updated = await repo.updateUser(10, {
      name: 'Ana Paula',
      email: 'ana@georural.com.br',
      role: 'GESTOR',
      sodException: true,
      sodJustification: 'Substituição emergencial de gestor',
    })

    expect(api.put).toHaveBeenCalledWith('/admin/usuarios/10/permissoes', {
      perfilId: 3,
      excecaoSoD: true,
      justificativa: 'Substituição emergencial de gestor',
    })
    expect(updated?.role).toBe('GESTOR')
    expect(updated?.sodException).toBe(true)
  })

  it('alterna status via PATCH /admin/usuarios/{id}/status enviando ativo invertido', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        content: [
          {
            id: 10,
            nome: 'Ana Paula',
            email: 'ana@georural.com.br',
            perfil_id: 2,
            perfil: 'ANALISTA',
            ativo: true,
          },
        ],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      },
    })
    vi.mocked(api.patch).mockResolvedValueOnce({
      data: {
        id: 10,
        nome: 'Ana Paula',
        email: 'ana@georural.com.br',
        perfil_id: 2,
        perfil: 'ANALISTA',
        ativo: false,
      },
    })

    await repo.listUsers()
    const updated = await repo.toggleUserStatus(10)

    expect(api.patch).toHaveBeenCalledWith('/admin/usuarios/10/status', { ativo: false })
    expect(updated?.status).toBe('Inativo')
  })

  it('redefine senha via POST /admin/usuarios/{id}/redefinir-senha', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ status: 204, data: null })

    await repo.resetPassword(10, 'NovaSenha#2026')

    expect(api.post).toHaveBeenCalledWith('/admin/usuarios/10/redefinir-senha', {
      novaSenha: 'NovaSenha#2026',
    })
  })

  it('lista e pagina logs de segurança via GET /admin/logs-seguranca com filtros', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        content: [
          {
            id: 500,
            usuario_id: 1,
            processo_id: null,
            acao: 'SENHA_REDEFINIDA',
            descricao: 'Senha redefinida pelo administrador',
            detalhes: null,
            ip: '127.0.0.1',
            data_hora: '2026-11-15T16:00:00Z',
          },
        ],
        page: 1,
        size: 20,
        totalElements: 21,
        totalPages: 2,
      },
    })

    const paged = await repo.listSecurityEventsPaged({
      acao: 'SENHA_REDEFINIDA',
      de: '2026-11-01',
      ate: '2026-11-15',
      page: 1,
      size: 20,
    })

    expect(api.get).toHaveBeenCalledWith('/admin/logs-seguranca', {
      params: {
        acao: 'SENHA_REDEFINIDA',
        de: '2026-11-01',
        ate: '2026-11-15',
        page: 1,
        size: 20,
      },
    })
    expect(paged.items).toHaveLength(1)
    expect(paged.items[0]!.actionCode).toBe('SENHA_REDEFINIDA')
    expect(paged.page).toBe(1)
    expect(paged.totalPages).toBe(2)
    expect(paged.totalElements).toBe(21)
  })
})
