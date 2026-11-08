/**
 * Contrato da camada de dados de Controle de Acesso (RBAC).
 * Permite alternar de forma transparente entre a implementação simulada (Mock)
 * e a integração real com o Back-End quando os endpoints estiverem disponíveis.
 */

import type {
  UserItem,
  RoleDef,
  PermissionDefinition,
  SecurityEvent,
} from '@/mocks/user.mock'

export interface CreateUserDto {
  name: string
  email: string
  role: string
  department?: string
  status?: 'Ativo' | 'Inativo'
  temporaryPassword?: string
  sodException?: boolean
  sodJustification?: string
}

export interface UpdateUserDto {
  name: string
  email: string
  role: string
  department?: string
  status?: 'Ativo' | 'Inativo'
  sodException?: boolean
  sodJustification?: string
}

export interface CreateRoleDto {
  id: string
  nome: string
  descricao: string
  permissions: string[]
}

export interface UpdateRoleDto {
  nome: string
  descricao: string
  permissions: string[]
}

export interface RecordSecurityEventDto {
  action: string
  details: string
  severity?: 'INFO' | 'WARNING' | 'DANGER'
  actorEmail?: string
  actorName?: string
}

export interface AccessRepository {
  // Usuários
  listUsers(): Promise<UserItem[]>
  getUserById(id: number): Promise<UserItem | undefined>
  createUser(dto: CreateUserDto): Promise<UserItem>
  updateUser(id: number, dto: UpdateUserDto): Promise<UserItem | null>
  toggleUserStatus(id: number): Promise<UserItem | null>
  updateUserPermissions(id: number, permissions: string[]): Promise<UserItem | null>
  resetUserPermissions(id: number): Promise<string[]>

  // Roles
  listRoles(): Promise<RoleDef[]>
  getRoleById(id: string): Promise<RoleDef | undefined>
  createRole(dto: CreateRoleDto): Promise<RoleDef>
  updateRole(id: string, dto: UpdateRoleDto): Promise<RoleDef | null>
  deleteRole(id: string): Promise<boolean>

  // Permissões
  listPermissions(): Promise<PermissionDefinition[]>

  // Auditoria de Segurança
  listSecurityEvents(): Promise<SecurityEvent[]>
  recordSecurityEvent(dto: RecordSecurityEventDto): Promise<SecurityEvent>
}
