/**
 * @file Serviço de Gerenciamento do Perfil do Usuário Logado e Segurança.
 * Constrói o perfil exclusivamente a partir da sessão JWT autenticada.
 */
import { ref } from 'vue'
import { userService } from './user'

export interface UserProfile {
  id: number | undefined
  name: string
  email: string
  role: string
  cargo: string
  departamento: string
  lastLogin: string
  status: 'Ativo' | 'Inativo'
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface ServiceResult {
  success: boolean
  message: string
}

const emptyProfile = (): UserProfile => ({
  id: undefined,
  name: '',
  email: '',
  role: '',
  cargo: '',
  departamento: '',
  lastLogin: '',
  status: 'Inativo',
})

const profileOverrides = ref<Partial<UserProfile>>({})

export const profileService = {
  /**
   * Retorna os dados completos do perfil do usuário autenticado.
   */
  getProfile(): UserProfile {
    const session = userService.getCurrentUser()
    const isAuthenticated = Boolean(session.email || session.name || session.role)
    if (!isAuthenticated) {
      return emptyProfile()
    }

    return {
      id: session.id,
      name: profileOverrides.value.name ?? session.name,
      email: profileOverrides.value.email ?? session.email ?? '',
      role: session.role,
      cargo: profileOverrides.value.cargo ?? session.role,
      departamento: profileOverrides.value.departamento ?? '',
      lastLogin: profileOverrides.value.lastLogin ?? 'Sessão ativa',
      status: profileOverrides.value.status ?? 'Ativo',
    }
  },

  /**
   * Atualiza as informações cadastrais do perfil e reflete na sessão de usuário.
   */
  updateProfile(data: Partial<UserProfile>): ServiceResult {
    profileOverrides.value = {
      ...profileOverrides.value,
      ...data,
    }

    const currentSession = userService.getCurrentUser()
    userService.setCurrentUser({
      ...currentSession,
      name: profileOverrides.value.name ?? currentSession.name,
      email: profileOverrides.value.email ?? currentSession.email,
    })

    return {
      success: true,
      message: 'Dados do perfil atualizados com sucesso!',
    }
  },

  /**
   * Executa a regra de negócio para alteração de credenciais/senha.
   */
  changePassword(payload: ChangePasswordPayload): ServiceResult {
    const { currentPassword, newPassword, confirmPassword } = payload

    if (!currentPassword?.trim() || !newPassword?.trim() || !confirmPassword?.trim()) {
      return {
        success: false,
        message: 'Por favor, preencha todos os campos de senha.',
      }
    }

    if (newPassword !== confirmPassword) {
      return {
        success: false,
        message: 'A nova senha e a confirmação não conferem.',
      }
    }

    if (newPassword.length < 6) {
      return {
        success: false,
        message: 'A nova senha deve ter no mínimo 6 caracteres.',
      }
    }

    return {
      success: true,
      message: 'Senha alterada com sucesso!',
    }
  },
}
