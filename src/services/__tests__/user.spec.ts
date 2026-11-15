import { describe, it, expect, beforeEach, vi } from 'vitest'
import { userService } from '../user'
import api from '../api'
import { authStorage } from '../storage/authStorage'

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

describe('User Service', () => {
  beforeEach(() => {
    localStorage.clear()
    userService.clearCurrentUser()
  })

  it('deve retornar o usuário padrão inicialmente', () => {
    const user = userService.getCurrentUser()
    expect(user).toBeDefined()
    expect(user.role).toBe('Operador')
    expect(user.name).toContain('João Silva')
  })

  it('deve alterar o papel do usuário e persistir no localStorage', () => {
    userService.setCurrentUserRole('Auditor')
    const user = userService.getCurrentUser()
    expect(user.role).toBe('Auditor')
    expect(user.name).toContain('Daniel Natan')
    expect(localStorage.getItem('api4-demo-role')).toBe('Auditor')
  })

  it('deve validar corretamente se o usuário é Administrador', () => {
    userService.setCurrentUserRole('Operador')
    expect(userService.isAdmin()).toBe(false)

    userService.setCurrentUserRole('Administrador')
    expect(userService.isAdmin()).toBe(true)
  })

  it('deve verificar permissão de acesso por perfil (canAccess)', () => {
    userService.setCurrentUserRole('Operador')
    expect(userService.canAccess(['Operador'])).toBe(true)
    expect(userService.canAccess(['Auditor'])).toBe(false)
    expect(userService.canAccess(['Operador', 'Auditor'])).toBe(true)

    // Administrador tem acesso a tudo
    userService.setCurrentUserRole('Administrador')
    expect(userService.canAccess(['Auditor'])).toBe(true)
    expect(userService.canAccess(['Analista'])).toBe(true)
  })

  it('deve retornar o catálogo de usuários de demonstração', () => {
    const demoUsers = userService.getDemoUsers()
    expect(demoUsers.Operador).toBeDefined()
    expect(demoUsers.Auditor).toBeDefined()
    expect(demoUsers.Analista).toBeDefined()
    expect(demoUsers.Administrador).toBeDefined()
  })

  it('deve autenticar via POST /auth/login salvando sessão real (isSimulated: false) com permissões adaptadas', async () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
      data: {
        token: 'jwt-real-token-123',
        tipo: 'Bearer',
        expira_em: '2026-11-16T18:00:00Z',
        usuario: {
          id: 7,
          nome: 'Carlos Admin',
          email: 'carlos.mendes@georural.com.br',
          perfil: 'ADMINISTRADOR',
          permissoes: ['USUARIO_GERENCIAR', 'GOVERNANCA_CONSULTAR'],
        },
      },
    })

    const session = await userService.loginWithCredentials('carlos.mendes@georural.com.br', 'Senha@123')

    expect(postSpy).toHaveBeenCalledWith('/auth/login', {
      email: 'carlos.mendes@georural.com.br',
      senha: 'Senha@123',
    })
    expect(session.id).toBe(7)
    expect(session.role).toBe('ADMIN')
    expect(session.permissions).toContain('USUARIOS:VISUALIZAR')
    expect(session.permissions).toContain('PERFIL:VISUALIZAR')

    const stored = authStorage.getSession()
    expect(stored?.isSimulated).toBe(false)
    expect(authStorage.getAccessToken()).toBe('jwt-real-token-123')
  })

  it('deve criar sessão simulada explicitamente via loginDemoOffline', () => {
    const session = userService.loginDemoOffline('Analista')
    expect(session.role).toBe('Analista')
    expect(authStorage.getSession()?.isSimulated).toBe(true)
  })

  it('delega resolução de perfil e preset de credenciais demo para o mockAuthService', () => {
    expect(userService.resolveDemoRoleFromEmail('gestor@georural.com.br')).toBe('Gestor')
    expect(userService.resolveDemoRoleFromEmail('inexistente@empresa.com')).toBeNull()

    const preset = userService.getDemoCredentialPreset('Operador')
    expect(preset).toEqual({
      email: 'operador@georural.com.br',
      password: expect.any(String),
    })
    expect(userService.getDemoCredentialPreset('Desconhecido')).toBeNull()
  })
})

