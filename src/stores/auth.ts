/**
 * Store Pinia para Gerenciamento de Autenticação, Tokens e Sessão.
 * Oferece reatividade global inspecionável no Vue DevTools e sincronização entre abas.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  authStorage,
  type StoredAuthSession,
  type TokenPair,
} from '@/services/storage/authStorage'
import { geojsonCache } from '@/services/storage/geojsonCache'
import { uiPreferencesStorage } from '@/services/storage/uiPreferencesStorage'
import { userService } from '@/services/user'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<StoredAuthSession | null>(authStorage.getSession())
  const accessToken = ref<string | null>(authStorage.getAccessToken())

  const isAuthenticated = computed(() => {
    return Boolean(session.value && accessToken.value && !authStorage.isSessionExpired(session.value))
  })

  const currentUser = computed(() => session.value)
  const currentRole = computed(() => session.value?.role || '')
  const permissions = computed(() => session.value?.permissions || [])

  /**
   * Sincroniza a store com os dados persistidos no storage.
   */
  function syncFromStorage() {
    session.value = authStorage.getSession()
    accessToken.value = authStorage.getAccessToken()
  }

  /**
   * Atualiza a sessão autenticada completa e tokens.
   */
  function setSession(newSession: StoredAuthSession, tokens?: Partial<TokenPair>) {
    authStorage.saveSession(newSession, tokens)
    session.value = authStorage.getSession()
    accessToken.value = authStorage.getAccessToken()

    // Sincroniza o userService reativo
    userService.setCurrentUser({
      id: typeof newSession.userId === 'number' ? newSession.userId : Number(newSession.userId) || undefined,
      name: newSession.name,
      email: newSession.email,
      role: newSession.role,
      roleId: newSession.roleId,
      permissions: [...newSession.permissions],
    })
  }

  /**
   * Autentica o usuário via credenciais reais na API e sincroniza a store.
   */
  async function login(email: string, senha: string) {
    const user = await userService.loginWithCredentials(email, senha)
    syncFromStorage()
    return user
  }

  /**
   * Executa logout limpo: revoga credenciais, limpa filtros de sessão e
   * descarta camadas GeoJSON restritas no cache local (preservando bases públicas).
   */
  async function logout() {
    authStorage.clearSession()
    uiPreferencesStorage.clearCatalogFilters()
    session.value = null
    accessToken.value = null

    try {
      await geojsonCache.clearRestricted()
    } catch {}

    userService.clearCurrentUser()
  }

  // Registra listener para sincronização entre múltiplas abas abertas
  authStorage.subscribeToStorageChanges(() => {
    syncFromStorage()
    const current = authStorage.getSession()
    if (current) {
      userService.setCurrentUser({
        id: typeof current.userId === 'number' ? current.userId : Number(current.userId) || undefined,
        name: current.name,
        email: current.email,
        role: current.role,
        roleId: current.roleId,
        permissions: [...current.permissions],
      })
    }
  })

  return {
    session,
    accessToken,
    isAuthenticated,
    currentUser,
    currentRole,
    permissions,
    syncFromStorage,
    setSession,
    login,
    logout,
  }
})
