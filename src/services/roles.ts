/**
 * Serviço de Gerenciamento de Papéis (Roles) e Permissões.
 * Permite listar, criar, editar e excluir papéis do sistema.
 */

import { ref } from 'vue'
import type { RoleDef } from '@/mocks/user.mock'
import { MockAccessRepository } from './access/MockAccessRepository'
import type { CreateRoleDto, UpdateRoleDto } from './access/AccessRepository'

// Instância compartilhada do repositório
const repo = new MockAccessRepository()
const rolesList = ref<RoleDef[]>([])

export const roleService = {
  /**
   * Obtém a lista atualizada de papéis do sistema.
   */
  async getRoles(): Promise<RoleDef[]> {
    rolesList.value = await repo.listRoles()
    return rolesList.value
  },

  /**
   * Busca um papel pelo seu identificador único.
   */
  async getRoleById(id: string): Promise<RoleDef | undefined> {
    return repo.getRoleById(id)
  },

  /**
   * Cria um novo papel customizado.
   */
  async createRole(dto: CreateRoleDto): Promise<RoleDef> {
    const created = await repo.createRole(dto)
    await this.getRoles()
    return created
  },

  /**
   * Atualiza nome, descrição e permissões de um papel.
   */
  async updateRole(id: string, dto: UpdateRoleDto): Promise<RoleDef | null> {
    const updated = await repo.updateRole(id, dto)
    await this.getRoles()
    return updated
  },

  /**
   * Remove um papel customizado.
   * Lança exceção se o papel for padrão ou estiver em uso por usuários cadastrados.
   */
  async deleteRole(id: string): Promise<boolean> {
    const ok = await repo.deleteRole(id)
    await this.getRoles()
    return ok
  },

  /**
   * Retorna a referência do repositório para composição no userService.
   */
  getRepo(): MockAccessRepository {
    return repo
  },
}
