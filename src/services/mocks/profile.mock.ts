/**
 * @file Fixtures e dados mockados para o perfil do usuário logado.
 */

export interface UserProfileMock {
  id: number
  name: string
  email: string
  role: string
  cargo: string
  departamento: string
  lastLogin: string
  status: 'Ativo' | 'Inativo'
}

export const MOCK_USER_PROFILE: UserProfileMock = {
  id: 1,
  name: 'Usuário do Sistema',
  email: 'usuario@georural.com.br',
  role: 'Administrador',
  cargo: 'Analista Geoespacial Sênior',
  departamento: 'Diretoria de Inteligência Territorial',
  lastLogin: 'Hoje, às 14:32',
  status: 'Ativo',
}

