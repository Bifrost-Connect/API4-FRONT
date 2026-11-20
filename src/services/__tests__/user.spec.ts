import { describe, it, expect, beforeEach, vi } from 'vitest'
import { userService } from '../user'
import api from '../api'
import { authStorage } from '../storage/authStorage'
import { setTestUserRole } from '@/__tests__/mocks/testAuthHelper'

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
    vi.restoreAllMocks()
  })

  it('deve retornar sessão vazia não autenticada inicialmente', () => {
    const user = userService.getCurrentUser()
    expect(user).toBeDefined()
    expect(user.id).toBeUndefined()
    expect(user.role).toBe('')
    expect(user.email).toBe('')
    expect(user.permissions).toEqual([])
    expect(userService.isAuthenticated()).toBe(false)
  })

  it('deve atualizar a sessão autenticada e persistir no authStorage quando token é informado', () => {
    setTestUserRole('Auditor', 'jwt-auditor-123')
    const user = userService.getCurrentUser()
    expect(user.role).toBe('Auditor')
    expect(user.name).toContain('Daniel Natan')
    expect(userService.isAuthenticated()).toBe(true)
    expect(authStorage.getAccessToken()).toBe('jwt-auditor-123')
  })

  it('deve validar corretamente se o usuário é Administrador', () => {
    setTestUserRole('Operador')
    expect(userService.isAdmin()).toBe(false)

    setTestUserRole('Administrador')
    expect(userService.isAdmin()).toBe(true)
  })

  it('deve verificar permissão de acesso por perfil (canAccess)', () => {
    setTestUserRole('Operador')
    expect(userService.canAccess(['Operador'])).toBe(true)
    expect(userService.canAccess(['Auditor'])).toBe(false)
    expect(userService.canAccess(['Operador', 'Auditor'])).toBe(true)

    // Administrador tem acesso a tudo
    setTestUserRole('Administrador')
    expect(userService.canAccess(['Auditor'])).toBe(true)
    expect(userService.canAccess(['Analista'])).toBe(true)
  })

  it('deve autenticar via POST /auth/login salvando sessão JWT real com permissões adaptadas', async () => {
    const futureIso = new Date(Date.now() + 3600_000).toISOString()
    const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
      data: {
        token: 'jwt-real-token-123',
        tipo: 'Bearer',
        expira_em: futureIso,
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
    expect(stored?.email).toBe('carlos.mendes@georural.com.br')
    expect(authStorage.getAccessToken()).toBe('jwt-real-token-123')
    expect(userService.isAuthenticated()).toBe(true)
  })

  it('deve limpar sessão e estado de autenticação ao chamar clearCurrentUser', () => {
    setTestUserRole('Analista', 'jwt-analista')
    expect(userService.isAuthenticated()).toBe(true)

    userService.clearCurrentUser()
    expect(userService.isAuthenticated()).toBe(false)
    expect(userService.getCurrentUser().role).toBe('')
    expect(authStorage.getSession()).toBeNull()
    expect(authStorage.getAccessToken()).toBeNull()
  })
})
