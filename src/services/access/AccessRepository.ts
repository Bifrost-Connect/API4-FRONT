/**
 * Contrato da camada de dados de Controle de Acesso (RBAC).
 * Permite alternar de forma transparente entre a implementação simulada (Mock)
 * e a integração real com o Back-End (API4-BACK).
 */

import type {
  UserItem,
  RoleDef,
  PermissionDefinition,
  SecurityEvent,
} from '@/types/access'

export interface PaginatedResult<T> {
  items: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface UserListFilters {
  nome?: string
  email?: string
  perfilId?: number
  ativo?: boolean
  page?: number
  size?: number
}

export interface SecurityEventFilters {
  usuarioId?: number
  acao?: string
  de?: string
  ate?: string
  page?: number
  size?: number
}

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
  password?: string
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
  listUsers(filters?: UserListFilters): Promise<UserItem[]>
  listUsersPaged(filters?: UserListFilters): Promise<PaginatedResult<UserItem>>
  getUserById(id: number): Promise<UserItem | undefined>
  createUser(dto: CreateUserDto): Promise<UserItem>
  updateUser(id: number, dto: UpdateUserDto): Promise<UserItem | null>
  toggleUserStatus(id: number, targetAtivo?: boolean): Promise<UserItem | null>
  resetPassword(id: number, novaSenha: string): Promise<void>
  updateUserPermissions(
    id: number,
    permissions: string[],
    sod?: { sodException?: boolean; sodJustification?: string },
  ): Promise<UserItem | null>
  resetUserPermissions(id: number): Promise<string[]>

  // Roles
  listRoles(): Promise<RoleDef[]>
  getRoleById(id: string): Promise<RoleDef | undefined>
  // TODO: Aguardando endpoint no API4-BACK (CRUD de cargos customizados)
  createRole(dto: CreateRoleDto): Promise<RoleDef>
  updateRole(id: string, dto: UpdateRoleDto): Promise<RoleDef | null>
  deleteRole(id: string): Promise<boolean>

  // Permissões
  listPermissions(): Promise<PermissionDefinition[]>

  // Auditoria de Segurança
  listSecurityEvents(filters?: SecurityEventFilters): Promise<SecurityEvent[]>
  listSecurityEventsPaged(filters?: SecurityEventFilters): Promise<PaginatedResult<SecurityEvent>>
  recordSecurityEvent(dto: RecordSecurityEventDto): Promise<SecurityEvent>
}
