/**
 * @file Serviço de Gerenciamento do Perfil do Usuário Logado e Segurança.
 * Centraliza regras de atualização de perfil e regras de alteração de senha.
 */
import { ref } from 'vue'
import { MOCK_USER_PROFILE, type UserProfileMock } from '../mocks/profile.mock'
import { userService } from './user'

export type UserProfile = UserProfileMock

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface ServiceResult {
  success: boolean
  message: string
}

const profileData = ref<UserProfile>({ ...MOCK_USER_PROFILE })

export const profileService = {
  /**
   * Retorna os dados completos do perfil do usuário autenticado.
   */
  getProfile(): UserProfile {
    // Sincroniza nome e email com a sessão ativa caso tenham sido alterados
    const session = userService.getCurrentUser()
    return {
      ...profileData.value,
      name: session.name || profileData.value.name,
      email: session.email || profileData.value.email,
    }
  },

  /**
   * Atualiza as informações cadastrais do perfil e reflete na sessão de usuário.
   */
  updateProfile(data: Partial<UserProfile>): ServiceResult {
    profileData.value = {
      ...profileData.value,
      ...data,
    }

    // Sincroniza com a sessão do usuário
    const currentSession = userService.getCurrentUser()
    userService.setCurrentUser({
      ...currentSession,
      name: profileData.value.name,
      email: profileData.value.email,
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

