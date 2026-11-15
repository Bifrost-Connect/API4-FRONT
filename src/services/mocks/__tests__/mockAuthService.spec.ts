import { describe, it, expect } from 'vitest'
import {
  DEMO_USERS,
  resolveDemoRoleFromEmail,
  getDemoCredentialPreset,
  createDemoOfflineSession,
} from '../mockAuthService'

describe('mockAuthService', () => {
  describe('resolveDemoRoleFromEmail', () => {
    it('resolve perfis demo conhecidos ignorando maiúsculas e espaços', () => {
      expect(resolveDemoRoleFromEmail('operador@georural.com.br')).toBe('Operador')
      expect(resolveDemoRoleFromEmail('  ANALISTA@GEORURAL.COM.BR ')).toBe('Analista')
      expect(resolveDemoRoleFromEmail('auditor@georural.com.br')).toBe('Auditor')
      expect(resolveDemoRoleFromEmail('gestor@georural.com.br')).toBe('Gestor')
      expect(resolveDemoRoleFromEmail('admin@georural.com.br')).toBe('Administrador')
      expect(resolveDemoRoleFromEmail('administrador@georural.com.br')).toBe('Administrador')
      expect(resolveDemoRoleFromEmail('integrador@georural.com.br')).toBe('Integrador')
    })

    it('retorna null para e-mails desconhecidos ou vazios', () => {
      expect(resolveDemoRoleFromEmail('')).toBeNull()
      expect(resolveDemoRoleFromEmail('   ')).toBeNull()
      expect(resolveDemoRoleFromEmail('desconhecido@empresa.com')).toBeNull()
    })
  })

  describe('getDemoCredentialPreset', () => {
    it('retorna email e senha padrão para perfis de demonstração válidos', () => {
      const op = getDemoCredentialPreset('Operador')
      expect(op).toEqual({
        email: 'operador@georural.com.br',
        password: expect.any(String),
      })
      expect(op?.password.length).toBeGreaterThan(0)

      const admin = getDemoCredentialPreset('Administrador')
      expect(admin?.email).toBe('admin@georural.com.br')
      expect(admin?.password).toBe(op?.password)
    })

    it('retorna null para perfil vazio ou inexistente', () => {
      expect(getDemoCredentialPreset('')).toBeNull()
      expect(getDemoCredentialPreset('PERFIL_INEXISTENTE')).toBeNull()
    })
  })

  describe('createDemoOfflineSession', () => {
    it('cria sessão isolada com clone de permissões para perfil conhecido', () => {
      const session = createDemoOfflineSession('Analista')
      expect(session.role).toBe('Analista')
      expect(session.roleId).toBe('ANALISTA')
      expect(session.permissions.length).toBeGreaterThan(0)

      session.permissions.push('PERM:EXTRA')
      expect(DEMO_USERS.Analista?.permissions).not.toContain('PERM:EXTRA')
    })

    it('cria sessão normalizada de fallback para perfil customizado', () => {
      const session = createDemoOfflineSession('AUDITOR')
      expect(session.roleId).toBe('AUDITOR')

      const custom = createDemoOfflineSession('GESTOR')
      expect(custom.role).toBe('Gestor')
      expect(custom.roleId).toBe('GESTOR')

      const unknown = createDemoOfflineSession('Customizado')
      expect(unknown.role).toBe('Customizado')
      expect(unknown.roleId).toBe('CUSTOMIZADO')
      expect(unknown.permissions).toEqual([])
    })
  })
})
