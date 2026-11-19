/**
 * Serviço de Gerenciamento de Papéis (Roles) e Permissões.
 * Utiliza exclusivamente HttpAccessRepository para comunicação com o API4-BACK.
 */

import { ref } from 'vue'
import type { RoleDef } from '@/types/access'
import { HttpAccessRepository } from './access/HttpAccessRepository'
import type { AccessRepository, CreateRoleDto, UpdateRoleDto } from './access/AccessRepository'

const httpRepo = new HttpAccessRepository()
const rolesList = ref<RoleDef[]>([])

export const roleService = {
  /**
   * Retorna o repositório HTTP de acessos.
   */
  getRepo(): AccessRepository {
    return httpRepo
  },

  /**
   * Obtém a lista atualizada de papéis do sistema.
   */
  async getRoles(): Promise<RoleDef[]> {
    rolesList.value = await this.getRepo().listRoles()
    return rolesList.value
  },

  /**
   * Busca um papel pelo seu identificador único.
   */
  async getRoleById(id: string): Promise<RoleDef | undefined> {
    return this.getRepo().getRoleById(id)
  },

  /**
   * Cria um novo papel customizado.
   */
  async createRole(dto: CreateRoleDto): Promise<RoleDef> {
    const created = await this.getRepo().createRole(dto)
    await this.getRoles()
    return created
  },

  /**
   * Atualiza nome, descrição e permissões de um papel.
   */
  async updateRole(id: string, dto: UpdateRoleDto): Promise<RoleDef | null> {
    const updated = await this.getRepo().updateRole(id, dto)
    await this.getRoles()
    return updated
  },

  /**
   * Remove um papel customizado.
   */
  async deleteRole(id: string): Promise<boolean> {
    const ok = await this.getRepo().deleteRole(id)
    await this.getRoles()
    return ok
  },
}
