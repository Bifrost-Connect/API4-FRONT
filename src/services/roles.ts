/**
 * Serviço de Gerenciamento de Papéis (Roles) e Permissões.
 * Alterna automaticamente entre MockAccessRepository (sessão simulada/offline)
 * e HttpAccessRepository (sessão JWT real).
 */

import { ref } from 'vue'
import type { RoleDef } from '@/mocks/user.mock'
import { MockAccessRepository } from './access/MockAccessRepository'
import { HttpAccessRepository } from './access/HttpAccessRepository'
import type { AccessRepository, CreateRoleDto, UpdateRoleDto } from './access/AccessRepository'
import { authStorage } from './storage/authStorage'

const mockRepo = new MockAccessRepository()
const httpRepo = new HttpAccessRepository()
const rolesList = ref<RoleDef[]>([])

export const roleService = {
  /**
   * Seleciona o repositório ativo conforme o tipo de sessão (real JWT vs simulada).
   */
  getRepo(): AccessRepository {
    const session = authStorage.getSession()
    if (session && session.isSimulated === false) {
      return httpRepo
    }
    return mockRepo
  },

  /**
   * Acesso direto ao repositório simulado para compatibilidade com métodos síncronos legados.
   */
  getMockRepo(): MockAccessRepository {
    return mockRepo
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
   * // TODO: Aguardando endpoint no API4-BACK
   */
  async createRole(dto: CreateRoleDto): Promise<RoleDef> {
    const created = await this.getRepo().createRole(dto)
    await this.getRoles()
    return created
  },

  /**
   * Atualiza nome, descrição e permissões de um papel.
   * // TODO: Aguardando endpoint no API4-BACK
   */
  async updateRole(id: string, dto: UpdateRoleDto): Promise<RoleDef | null> {
    const updated = await this.getRepo().updateRole(id, dto)
    await this.getRoles()
    return updated
  },

  /**
   * Remove um papel customizado.
   * // TODO: Aguardando endpoint no API4-BACK
   */
  async deleteRole(id: string): Promise<boolean> {
    const ok = await this.getRepo().deleteRole(id)
    await this.getRoles()
    return ok
  },
}
