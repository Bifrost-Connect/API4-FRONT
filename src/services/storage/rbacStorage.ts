/**
 * Camada de persistência local para dados do Mock RBAC (US13).
 * Garante que usuários criados, papéis customizados, matriz de permissões e eventos
 * de segurança não se percam após recarregar a página (F5), mantendo versionamento de seed.
 */

import type { UserItem, RoleDef, SecurityEvent } from '@/mocks/user.mock'

export const RBAC_STORAGE_KEYS = {
  USERS: 'api4_rbac_users',
  ROLES: 'api4_rbac_roles',
  EVENTS: 'api4_rbac_security_events',
  SEED_VERSION: 'api4_rbac_seed_version',
} as const

export const CURRENT_RBAC_SEED_VERSION = '1.0.0'

export interface RbacStorageSnapshot {
  version: string
  users: UserItem[]
  roles: RoleDef[]
  securityEvents: SecurityEvent[]
}

const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key)
      }
    } catch {}
    return null
  },
  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value)
      }
    } catch {}
  },
  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key)
      }
    } catch {}
  },
}

export const rbacStorage = {
  /**
   * Verifica se a versão dos dados persistidos é compatível com a versão atual do seed.
   */
  isSeedOutdated(): boolean {
    const savedVersion = safeStorage.getItem(RBAC_STORAGE_KEYS.SEED_VERSION)
    return savedVersion !== CURRENT_RBAC_SEED_VERSION
  },

  /**
   * Carrega o snapshot completo de colaboradores, papéis e trilha de auditoria.
   */
  loadSnapshot(): RbacStorageSnapshot | null {
    if (this.isSeedOutdated()) {
      return null
    }

    try {
      const usersRaw = safeStorage.getItem(RBAC_STORAGE_KEYS.USERS)
      const rolesRaw = safeStorage.getItem(RBAC_STORAGE_KEYS.ROLES)
      const eventsRaw = safeStorage.getItem(RBAC_STORAGE_KEYS.EVENTS)

      if (!usersRaw || !rolesRaw) {
        return null
      }

      return {
        version: CURRENT_RBAC_SEED_VERSION,
        users: JSON.parse(usersRaw),
        roles: JSON.parse(rolesRaw),
        securityEvents: eventsRaw ? JSON.parse(eventsRaw) : [],
      }
    } catch {
      return null
    }
  },

  /**
   * Persiste o estado atual dos usuários, papéis e trilha de auditoria.
   */
  saveSnapshot(snapshot: {
    users: UserItem[]
    roles: RoleDef[]
    securityEvents: SecurityEvent[]
  }): void {
    try {
      safeStorage.setItem(RBAC_STORAGE_KEYS.SEED_VERSION, CURRENT_RBAC_SEED_VERSION)
      safeStorage.setItem(RBAC_STORAGE_KEYS.USERS, JSON.stringify(snapshot.users))
      safeStorage.setItem(RBAC_STORAGE_KEYS.ROLES, JSON.stringify(snapshot.roles))
      safeStorage.setItem(RBAC_STORAGE_KEYS.EVENTS, JSON.stringify(snapshot.securityEvents))
    } catch {
      // Ignora falhas de cota
    }
  },

  /**
   * Remove todos os dados persistidos do RBAC, forçando re-inicialização a partir do seed padrão.
   */
  clear(): void {
    safeStorage.removeItem(RBAC_STORAGE_KEYS.SEED_VERSION)
    safeStorage.removeItem(RBAC_STORAGE_KEYS.USERS)
    safeStorage.removeItem(RBAC_STORAGE_KEYS.ROLES)
    safeStorage.removeItem(RBAC_STORAGE_KEYS.EVENTS)
  },
}
