/**
 * Suíte de Testes de Proteção de Rotas (ProtectedRoute) e Controle de Acessos por Perfil.
 * Valida o cruzamento de acesso a URLs para todos os 6 perfis padrão do GeoRural.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import router from '@/router'
import { userService } from '@/services/user'
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

describe('Proteção de Rotas e Controle de Acesso por Perfil (ProtectedRoute)', () => {
  beforeAll(async () => {
    await router.push('/login')
  })

  beforeEach(async () => {
    localStorage.clear()
    userService.clearCurrentUser()
    await router.push('/login')
  })

  describe('Usuário Não Autenticado', () => {
    it('redireciona para /login?redirect=... em qualquer rota protegida sem sessão JWT válida', async () => {
      await router.push('/profile')
      expect(router.currentRoute.value.name).toBe('login')
      expect(router.currentRoute.value.query.redirect).toBe('/profile')

      await router.push('/users')
      expect(router.currentRoute.value.name).toBe('login')
      expect(router.currentRoute.value.query.redirect).toBe('/users')
    })
  })

  describe('Perfil Administrador (ADMIN)', () => {
    it('redireciona para /acesso-negado ao tentar acessar rotas de negócio e permite /users', async () => {
      setTestUserRole('ADMIN')

      const forbiddenRoutes = [
        '/upload',
        '/catalogo',
        '/mapa',
        '/analise-territorial',
        '/comparacao-temporal',
        '/',
      ]

      for (const path of forbiddenRoutes) {
        await router.push('/profile')
        await router.push(path)
        expect(router.currentRoute.value.name).toBe('forbidden')
        expect(router.currentRoute.value.path).toBe('/acesso-negado')
      }

      await router.push('/profile')
      await router.push('/users')
      expect(router.currentRoute.value.name).toBe('users')
      expect(router.currentRoute.value.path).toBe('/users')
    })
  })

  describe('Perfil Operador de Dados (OPERADOR_DADOS)', () => {
    it('bloqueia /users, /analise-territorial, /comparacao-temporal e /mapa, permitindo /upload e /', async () => {
      setTestUserRole('OPERADOR_DADOS')

      const forbiddenRoutes = [
        '/users',
        '/analise-territorial',
        '/comparacao-temporal',
        '/mapa',
      ]

      for (const path of forbiddenRoutes) {
        await router.push('/profile')
        await router.push(path)
        expect(router.currentRoute.value.name).toBe('forbidden')
        expect(router.currentRoute.value.path).toBe('/acesso-negado')
      }

      await router.push('/profile')
      await router.push('/upload')
      expect(router.currentRoute.value.name).toBe('upload')
      expect(router.currentRoute.value.path).toBe('/upload')

      await router.push('/profile')
      await router.push('/')
      expect(router.currentRoute.value.name).toBe('dashboard')
      expect(router.currentRoute.value.path).toBe('/')
    })
  })

  describe('Perfil Analista (ANALISTA)', () => {
    it('bloqueia /users, /upload e /, permitindo /catalogo, /analise-territorial e /comparacao-temporal', async () => {
      setTestUserRole('ANALISTA')

      const forbiddenRoutes = ['/users', '/upload', '/']

      for (const path of forbiddenRoutes) {
        await router.push('/profile')
        await router.push(path)
        expect(router.currentRoute.value.name).toBe('forbidden')
        expect(router.currentRoute.value.path).toBe('/acesso-negado')
      }

      await router.push('/profile')
      await router.push('/catalogo')
      expect(router.currentRoute.value.name).toBe('catalogo')
      expect(router.currentRoute.value.path).toBe('/catalogo')

      await router.push('/profile')
      await router.push('/analise-territorial')
      expect(router.currentRoute.value.name).toBe('analise-territorial')
      expect(router.currentRoute.value.path).toBe('/analise-territorial')

      await router.push('/profile')
      await router.push('/comparacao-temporal')
      expect(router.currentRoute.value.name).toBe('comparacao-temporal')
      expect(router.currentRoute.value.path).toBe('/comparacao-temporal')
    })
  })

  describe('Perfil Auditor (AUDITOR)', () => {
    it('bloqueia /users e /upload, permitindo /catalogo e /', async () => {
      setTestUserRole('AUDITOR')

      const forbiddenRoutes = ['/users', '/upload']

      for (const path of forbiddenRoutes) {
        await router.push('/profile')
        await router.push(path)
        expect(router.currentRoute.value.name).toBe('forbidden')
        expect(router.currentRoute.value.path).toBe('/acesso-negado')
      }

      await router.push('/profile')
      await router.push('/catalogo')
      expect(router.currentRoute.value.name).toBe('catalogo')
      expect(router.currentRoute.value.path).toBe('/catalogo')

      await router.push('/profile')
      await router.push('/')
      expect(router.currentRoute.value.name).toBe('dashboard')
      expect(router.currentRoute.value.path).toBe('/')
    })
  })

  describe('Perfil Gestor de Dados (GESTOR)', () => {
    it('bloqueia /upload e permite /catalogo, /comparacao-temporal e /users (Chaves de API)', async () => {
      setTestUserRole('GESTOR')

      const forbiddenRoutes = ['/upload']

      for (const path of forbiddenRoutes) {
        await router.push('/profile')
        await router.push(path)
        expect(router.currentRoute.value.name).toBe('forbidden')
        expect(router.currentRoute.value.path).toBe('/acesso-negado')
      }

      await router.push('/profile')
      await router.push('/catalogo')
      expect(router.currentRoute.value.name).toBe('catalogo')
      expect(router.currentRoute.value.path).toBe('/catalogo')

      await router.push('/profile')
      await router.push('/comparacao-temporal')
      expect(router.currentRoute.value.name).toBe('comparacao-temporal')
      expect(router.currentRoute.value.path).toBe('/comparacao-temporal')

      await router.push('/profile')
      await router.push('/users')
      expect(router.currentRoute.value.name).toBe('users')
      expect(router.currentRoute.value.path).toBe('/users')
    })
  })

  describe('Perfil Integrador Externo (INTEGRADOR_EXTERNO)', () => {
    it('bloqueia /upload, /, /analise-territorial e /comparacao-temporal, permitindo /catalogo, /mapa e /users (Chaves de API)', async () => {
      setTestUserRole('INTEGRADOR_EXTERNO')

      const forbiddenRoutes = [
        '/upload',
        '/',
        '/analise-territorial',
        '/comparacao-temporal',
      ]

      for (const path of forbiddenRoutes) {
        await router.push('/profile')
        await router.push(path)
        expect(router.currentRoute.value.name).toBe('forbidden')
        expect(router.currentRoute.value.path).toBe('/acesso-negado')
      }

      await router.push('/profile')
      await router.push('/catalogo')
      expect(router.currentRoute.value.name).toBe('catalogo')
      expect(router.currentRoute.value.path).toBe('/catalogo')

      await router.push('/profile')
      await router.push('/mapa')
      expect(router.currentRoute.value.name).toBe('mapa')
      expect(router.currentRoute.value.path).toBe('/mapa')

      await router.push('/profile')
      await router.push('/users')
      expect(router.currentRoute.value.name).toBe('users')
      expect(router.currentRoute.value.path).toBe('/users')
    })
  })
})
