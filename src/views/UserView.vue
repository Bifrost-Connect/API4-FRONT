<script setup lang="ts">
/**
 * View de gerenciamento e administração de usuários do sistema.
 * Permite associar uma role aos usuários e customizar permissões/subpermissões
 * adicionais ou revogadas através de um modal dedicado com módulos, subpermissões
 * e alternância simples de atribuição (Check / X).
 */
import { ref, computed } from 'vue'
import {
  FiUsers,
  FiUserPlus,
  FiSearch,
  FiFilter,
  FiShield,
  FiEdit2,
  FiCheckCircle,
  FiXCircle,
  FiX,
  FiCheck,
  FiSave,
  FiKey,
} from 'vue-icons-plus/fi'
import DataTable, { type Column } from '../components/DataTable.vue'

type SystemRole = 'ADMIN' | 'OPERADOR_DADOS' | 'ANALISTA' | 'AUDITOR' | 'GESTOR'

interface PermissionDefinition {
  modulo: string
  subpermissao: string
}

// Catálogo completo de módulos e subpermissões do GeoRural
const ALL_PERMISSIONS: PermissionDefinition[] = [
  // USUARIOS
  { modulo: 'USUARIOS', subpermissao: 'VISUALIZAR' },
  { modulo: 'USUARIOS', subpermissao: 'CRIAR' },
  { modulo: 'USUARIOS', subpermissao: 'EDITAR' },
  { modulo: 'USUARIOS', subpermissao: 'DESATIVAR' },
  { modulo: 'USUARIOS', subpermissao: 'ATRIBUIR_ROLE' },
  { modulo: 'USUARIOS', subpermissao: 'ATRIBUIR_PERMISSAO' },
  // ROLES
  { modulo: 'ROLES', subpermissao: 'VISUALIZAR' },
  { modulo: 'ROLES', subpermissao: 'CRIAR' },
  { modulo: 'ROLES', subpermissao: 'EDITAR' },
  { modulo: 'ROLES', subpermissao: 'EXCLUIR' },
  { modulo: 'ROLES', subpermissao: 'GERENCIAR_PERMISSOES' },
  // BASES
  { modulo: 'BASES', subpermissao: 'VISUALIZAR' },
  { modulo: 'BASES', subpermissao: 'EDITAR_METADADOS' },
  { modulo: 'BASES', subpermissao: 'CONSULTAR_CATALOGO' },
  { modulo: 'BASES', subpermissao: 'HOMOLOGAR' },
  // INGESTAO
  { modulo: 'INGESTAO', subpermissao: 'UPLOAD' },
  { modulo: 'INGESTAO', subpermissao: 'VISUALIZAR_PROCESSAMENTO' },
  { modulo: 'INGESTAO', subpermissao: 'REPROCESSAR' },
  { modulo: 'INGESTAO', subpermissao: 'CANCELAR' },
  // QUARENTENA
  { modulo: 'QUARENTENA', subpermissao: 'VISUALIZAR' },
  { modulo: 'QUARENTENA', subpermissao: 'ENVIAR' },
  { modulo: 'QUARENTENA', subpermissao: 'CORRIGIR' },
  { modulo: 'QUARENTENA', subpermissao: 'REPROCESSAR' },
  { modulo: 'QUARENTENA', subpermissao: 'DESCARTAR' },
  // MAPA
  { modulo: 'MAPA', subpermissao: 'VISUALIZAR' },
  { modulo: 'MAPA', subpermissao: 'VISUALIZAR_CAMADAS' },
  { modulo: 'MAPA', subpermissao: 'VISUALIZAR_SOBREPOSICOES' },
  { modulo: 'MAPA', subpermissao: 'COMPARAR_SAFRAS' },
  // ANALISE_TERRITORIAL
  { modulo: 'ANALISE_TERRITORIAL', subpermissao: 'EXECUTAR' },
  { modulo: 'ANALISE_TERRITORIAL', subpermissao: 'CALCULAR_SOBREPOSICAO' },
  { modulo: 'ANALISE_TERRITORIAL', subpermissao: 'CONSULTAR_RESULTADO' },
  { modulo: 'ANALISE_TERRITORIAL', subpermissao: 'SALVAR_RESULTADO' },
  // INDICADORES
  { modulo: 'INDICADORES', subpermissao: 'VISUALIZAR' },
  { modulo: 'INDICADORES', subpermissao: 'CALCULAR' },
  { modulo: 'INDICADORES', subpermissao: 'HOMOLOGAR' },
  { modulo: 'INDICADORES', subpermissao: 'BLOQUEAR_VERSAO' },
  { modulo: 'INDICADORES', subpermissao: 'DESBLOQUEAR_VERSAO' },
  // AUDITORIA
  { modulo: 'AUDITORIA', subpermissao: 'VISUALIZAR' },
  { modulo: 'AUDITORIA', subpermissao: 'RASTREAR_ORIGEM' },
  { modulo: 'AUDITORIA', subpermissao: 'VISUALIZAR_VERSOES' },
  { modulo: 'AUDITORIA', subpermissao: 'VISUALIZAR_HASH' },
  { modulo: 'AUDITORIA', subpermissao: 'VISUALIZAR_LOGS' },
  { modulo: 'AUDITORIA', subpermissao: 'VISUALIZAR_PROCESSAMENTOS' },
  { modulo: 'AUDITORIA', subpermissao: 'VISUALIZAR_ALTERACOES' },
  // EXPORTACAO
  { modulo: 'EXPORTACAO', subpermissao: 'CSV' },
  { modulo: 'EXPORTACAO', subpermissao: 'GEOJSON' },
  // API
  { modulo: 'API', subpermissao: 'VISUALIZAR_CHAVES' },
  { modulo: 'API', subpermissao: 'GERAR_CHAVE' },
  { modulo: 'API', subpermissao: 'REVOGAR_CHAVE' },
]

// Permissões padrão associadas a cada role
const ROLE_DEFAULT_PERMISSIONS: Record<SystemRole, string[]> = {
  ADMIN: [
    'USUARIOS:VISUALIZAR',
    'USUARIOS:CRIAR',
    'USUARIOS:EDITAR',
    'USUARIOS:DESATIVAR',
    'USUARIOS:ATRIBUIR_ROLE',
    'USUARIOS:ATRIBUIR_PERMISSAO',
    'ROLES:VISUALIZAR',
    'ROLES:CRIAR',
    'ROLES:EDITAR',
    'ROLES:EXCLUIR',
    'ROLES:GERENCIAR_PERMISSOES',
    'API:VISUALIZAR_CHAVES',
    'API:GERAR_CHAVE',
    'API:REVOGAR_CHAVE',
  ],
  OPERADOR_DADOS: [
    'BASES:VISUALIZAR',
    'BASES:EDITAR_METADADOS',
    'BASES:CONSULTAR_CATALOGO',
    'INGESTAO:UPLOAD',
    'INGESTAO:VISUALIZAR_PROCESSAMENTO',
    'INGESTAO:REPROCESSAR',
    'INGESTAO:CANCELAR',
    'QUARENTENA:VISUALIZAR',
    'QUARENTENA:ENVIAR',
    'QUARENTENA:CORRIGIR',
    'QUARENTENA:REPROCESSAR',
    'QUARENTENA:DESCARTAR',
  ],
  ANALISTA: [
    'BASES:VISUALIZAR',
    'BASES:CONSULTAR_CATALOGO',
    'MAPA:VISUALIZAR',
    'MAPA:VISUALIZAR_CAMADAS',
    'MAPA:VISUALIZAR_SOBREPOSICOES',
    'MAPA:COMPARAR_SAFRAS',
    'ANALISE_TERRITORIAL:EXECUTAR',
    'ANALISE_TERRITORIAL:CALCULAR_SOBREPOSICAO',
    'ANALISE_TERRITORIAL:CONSULTAR_RESULTADO',
    'ANALISE_TERRITORIAL:SALVAR_RESULTADO',
    'INDICADORES:VISUALIZAR',
    'INDICADORES:CALCULAR',
    'AUDITORIA:VISUALIZAR',
  ],
  AUDITOR: [
    'BASES:VISUALIZAR',
    'BASES:CONSULTAR_CATALOGO',
    'MAPA:VISUALIZAR',
    'MAPA:VISUALIZAR_CAMADAS',
    'MAPA:VISUALIZAR_SOBREPOSICOES',
    'ANALISE_TERRITORIAL:CONSULTAR_RESULTADO',
    'INDICADORES:VISUALIZAR',
    'AUDITORIA:VISUALIZAR',
    'AUDITORIA:RASTREAR_ORIGEM',
    'AUDITORIA:VISUALIZAR_VERSOES',
    'AUDITORIA:VISUALIZAR_HASH',
    'AUDITORIA:VISUALIZAR_LOGS',
    'AUDITORIA:VISUALIZAR_PROCESSAMENTOS',
    'AUDITORIA:VISUALIZAR_ALTERACOES',
  ],
  GESTOR: [
    'BASES:VISUALIZAR',
    'BASES:CONSULTAR_CATALOGO',
    'BASES:HOMOLOGAR',
    'MAPA:VISUALIZAR',
    'MAPA:VISUALIZAR_CAMADAS',
    'MAPA:VISUALIZAR_SOBREPOSICOES',
    'MAPA:COMPARAR_SAFRAS',
    'ANALISE_TERRITORIAL:CONSULTAR_RESULTADO',
    'INDICADORES:VISUALIZAR',
    'INDICADORES:CALCULAR',
    'INDICADORES:HOMOLOGAR',
    'INDICADORES:BLOQUEAR_VERSAO',
    'INDICADORES:DESBLOQUEAR_VERSAO',
    'AUDITORIA:VISUALIZAR',
    'AUDITORIA:RASTREAR_ORIGEM',
    'AUDITORIA:VISUALIZAR_VERSOES',
    'AUDITORIA:VISUALIZAR_HASH',
    'AUDITORIA:VISUALIZAR_LOGS',
    'AUDITORIA:VISUALIZAR_PROCESSAMENTOS',
    'AUDITORIA:VISUALIZAR_ALTERACOES',
    'EXPORTACAO:CSV',
    'EXPORTACAO:GEOJSON',
  ],
}

interface UserItem {
  id: number
  name: string
  email: string
  role: SystemRole
  permissions: string[] // Ex: ['USUARIOS:VISUALIZAR', 'BASES:VISUALIZAR']
  department: string
  status: 'Ativo' | 'Inativo'
  lastLogin: string
}

// Colunas para a DataTable
const columns: Column[] = [
  { key: 'name', label: 'Nome / Usuário' },
  { key: 'role', label: 'Role Associada' },
  { key: 'department', label: 'Departamento' },
  { key: 'status', label: 'Status' },
  { key: 'lastLogin', label: 'Último Acesso' },
  { key: 'actions', label: 'Ações' },
]

const availableRoles: { value: SystemRole; label: string; desc: string }[] = [
  { value: 'ADMIN', label: 'ADMIN', desc: 'Gerenciamento de usuários, roles e permissões.' },
  {
    value: 'OPERADOR_DADOS',
    label: 'OPERADOR_DADOS',
    desc: 'Entrada, processamento e controle de qualidade dos dados.',
  },
  {
    value: 'ANALISTA',
    label: 'ANALISTA',
    desc: 'Consulta, análise territorial, mapas e indicadores.',
  },
  {
    value: 'AUDITOR',
    label: 'AUDITOR',
    desc: 'Auditoria, histórico e rastreabilidade dos dados.',
  },
  {
    value: 'GESTOR',
    label: 'GESTOR',
    desc: 'Governança, homologação, exportação e integrações.',
  },
]

// Lista de usuários simulados
const usersList = ref<UserItem[]>([
  {
    id: 1,
    name: 'Carlos Mendes',
    email: 'carlos.mendes@georural.com.br',
    role: 'ADMIN',
    permissions: [...ROLE_DEFAULT_PERMISSIONS.ADMIN],
    department: 'Gestão Territorial',
    status: 'Ativo',
    lastLogin: '05/11/2026 14:32',
  },
  {
    id: 2,
    name: 'Mariana Duarte',
    email: 'mariana.duarte@georural.com.br',
    role: 'ANALISTA',
    permissions: [...ROLE_DEFAULT_PERMISSIONS.ANALISTA, 'EXPORTACAO:CSV'], // Permissão extra além da role
    department: 'Inteligência Espacial',
    status: 'Ativo',
    lastLogin: '05/11/2026 11:15',
  },
  {
    id: 3,
    name: 'Lucas Silveira',
    email: 'lucas.silveira@georural.com.br',
    role: 'OPERADOR_DADOS',
    permissions: [...ROLE_DEFAULT_PERMISSIONS.OPERADOR_DADOS],
    department: 'Operações de Ingestão',
    status: 'Ativo',
    lastLogin: '04/11/2026 18:20',
  },
  {
    id: 4,
    name: 'Patrícia Souza',
    email: 'patricia.souza@georural.com.br',
    role: 'AUDITOR',
    permissions: [...ROLE_DEFAULT_PERMISSIONS.AUDITOR],
    department: 'Compliance e Qualidade',
    status: 'Ativo',
    lastLogin: '03/11/2026 09:45',
  },
  {
    id: 5,
    name: 'Fernando Rocha',
    email: 'fernando.rocha@georural.com.br',
    role: 'GESTOR',
    permissions: [...ROLE_DEFAULT_PERMISSIONS.GESTOR],
    department: 'Diretoria de Governança',
    status: 'Inativo',
    lastLogin: '20/10/2026 16:10',
  },
])

// Filtros
const searchQuery = ref('')
const selectedRoleFilter = ref<string>('')
const selectedStatusFilter = ref<string>('')
const feedbackMsg = ref('')

// Modal 1: Cadastro / Edição Básica
const isModalOpen = ref(false)
const isEditing = ref(false)
const modalUserId = ref<number | null>(null)
const modalName = ref('')
const modalEmail = ref('')
const modalRole = ref<SystemRole>('ANALISTA')
const modalDepartment = ref('')
const modalStatus = ref<'Ativo' | 'Inativo'>('Ativo')

// Modal 2: Gerenciamento Exclusivo de Permissões
const isPermModalOpen = ref(false)
const permUser = ref<UserItem | null>(null)
const selectedPermissions = ref<Set<string>>(new Set())
const permModuleFilter = ref('')
const permSearchFilter = ref('')

// Usuários filtrados
const filteredUsers = computed(() => {
  return usersList.value.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      user.department.toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesRole = !selectedRoleFilter.value || user.role === selectedRoleFilter.value
    const matchesStatus = !selectedStatusFilter.value || user.status === selectedStatusFilter.value

    return matchesSearch && matchesRole && matchesStatus
  })
})

// Módulos únicos para filtro do modal de permissões
const uniqueModules = computed(() => {
  const set = new Set<string>()
  ALL_PERMISSIONS.forEach((p) => set.add(p.modulo))
  return Array.from(set)
})

// Subpermissões filtradas no modal
const filteredPermissionDefs = computed(() => {
  return ALL_PERMISSIONS.filter((p) => {
    const matchesMod = !permModuleFilter.value || p.modulo === permModuleFilter.value
    const matchesQuery =
      !permSearchFilter.value ||
      p.modulo.toLowerCase().includes(permSearchFilter.value.toLowerCase()) ||
      p.subpermissao.toLowerCase().includes(permSearchFilter.value.toLowerCase())
    return matchesMod && matchesQuery
  })
})

const getPermKey = (p: PermissionDefinition) => `${p.modulo}:${p.subpermissao}`

const openCreateModal = () => {
  isEditing.value = false
  modalUserId.value = null
  modalName.value = ''
  modalEmail.value = ''
  modalRole.value = 'ANALISTA'
  modalDepartment.value = 'Geoprocessamento'
  modalStatus.value = 'Ativo'
  isModalOpen.value = true
}

const openEditModal = (user: UserItem) => {
  isEditing.value = true
  modalUserId.value = user.id
  modalName.value = user.name
  modalEmail.value = user.email
  modalRole.value = user.role
  modalDepartment.value = user.department
  modalStatus.value = user.status
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
}

const saveUser = () => {
  if (!modalName.value || !modalEmail.value) {
    return
  }

  if (isEditing.value && modalUserId.value !== null) {
    const idx = usersList.value.findIndex((u) => u.id === modalUserId.value)
    if (idx !== -1) {
      const existing = usersList.value[idx]!
      const roleChanged = existing.role !== modalRole.value
      // Se a role mudou, reseta para os padrões da nova role; senão mantém as permissões atuais
      const newPerms = roleChanged
        ? [...ROLE_DEFAULT_PERMISSIONS[modalRole.value]]
        : [...existing.permissions]

      usersList.value[idx] = {
        id: existing.id,
        lastLogin: existing.lastLogin,
        name: modalName.value,
        email: modalEmail.value,
        role: modalRole.value,
        permissions: newPerms,
        department: modalDepartment.value || 'Geral',
        status: modalStatus.value,
      }
      showFeedback('Usuário atualizado com sucesso!')
    }
  } else {
    const newUser: UserItem = {
      id: Date.now(),
      name: modalName.value,
      email: modalEmail.value,
      role: modalRole.value,
      permissions: [...ROLE_DEFAULT_PERMISSIONS[modalRole.value]],
      department: modalDepartment.value || 'Geral',
      status: modalStatus.value,
      lastLogin: 'Nunca',
    }
    usersList.value.unshift(newUser)
    showFeedback('Novo usuário cadastrado com sucesso!')
  }

  closeModal()
}

// Abrir modal de permissões para um usuário específico
const openPermissionsModal = (user: UserItem) => {
  permUser.value = user
  selectedPermissions.value = new Set(user.permissions)
  permModuleFilter.value = ''
  permSearchFilter.value = ''
  isPermModalOpen.value = true
}

const closePermissionsModal = () => {
  isPermModalOpen.value = false
  permUser.value = null
}

const togglePermission = (key: string) => {
  const updated = new Set(selectedPermissions.value)
  if (updated.has(key)) {
    updated.delete(key)
  } else {
    updated.add(key)
  }
  selectedPermissions.value = updated
}

const resetToRoleDefaults = () => {
  if (!permUser.value) return
  const defaults = ROLE_DEFAULT_PERMISSIONS[permUser.value.role] || []
  selectedPermissions.value = new Set(defaults)
  showFeedback(`Permissões restauradas para os padrões da role ${permUser.value.role}.`)
}

const savePermissions = () => {
  if (!permUser.value) return
  const idx = usersList.value.findIndex((u) => u.id === permUser.value!.id)
  if (idx !== -1) {
    usersList.value[idx]!.permissions = Array.from(selectedPermissions.value)
    showFeedback(`Permissões de ${permUser.value.name} atualizadas com sucesso!`)
  }
  closePermissionsModal()
}

const toggleUserStatus = (user: UserItem) => {
  user.status = user.status === 'Ativo' ? 'Inativo' : 'Ativo'
  showFeedback(`Status de ${user.name} alterado para ${user.status}.`)
}

const showFeedback = (msg: string) => {
  feedbackMsg.value = msg
  setTimeout(() => {
    feedbackMsg.value = ''
  }, 4000)
}
</script>

<template>
  <main class="users-view">
    <header class="page-heading">
      <div class="heading-content">
        <div>
          <p class="eyebrow">Administração e Acesso</p>
          <h1>Gerenciamento de Usuários e Permissões</h1>
          <p class="page-description">
            Associe papéis aos usuários e configure subpermissões personalizadas para controle de
            acesso granular na plataforma GeoRural.
          </p>
        </div>
        <button type="button" class="btn btn_primary" @click="openCreateModal">
          <FiUserPlus size="16" />
          <span>Novo Usuário</span>
        </button>
      </div>
    </header>

    <!-- Feedback Banner -->
    <div v-if="feedbackMsg" class="alert-banner alert-success">
      <FiCheckCircle size="18" />
      <span>{{ feedbackMsg }}</span>
    </div>

    <!-- Barra de Filtros e Busca -->
    <section class="card filter-card">
      <div class="filter-grid">
        <div class="search-box">
          <FiSearch class="search-icon" size="16" />
          <input
            v-model="searchQuery"
            type="text"
            class="input search-input"
            placeholder="Buscar por nome, e-mail ou departamento..."
          />
        </div>

        <div class="filter-selects">
          <div class="select-group">
            <FiShield size="14" class="select-icon" />
            <select v-model="selectedRoleFilter" class="select">
              <option value="">Todas as Roles</option>
              <option v-for="r in availableRoles" :key="r.value" :value="r.value">
                {{ r.label }}
              </option>
            </select>
          </div>

          <div class="select-group">
            <FiFilter size="14" class="select-icon" />
            <select v-model="selectedStatusFilter" class="select">
              <option value="">Todos os Status</option>
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>
        </div>
      </div>
    </section>

    <!-- Tabela de Usuários com DataTable (expand desabilitado) -->
    <section class="card table-card">
      <DataTable :columns="columns" :data="filteredUsers" row-key="id" :disable-expand="true">
        <template #cell-name="{ item }">
          <div class="user-cell">
            <div class="user-avatar-mini">
              {{ item.name.charAt(0).toUpperCase() }}
            </div>
            <div>
              <strong class="user-cell-name">{{ item.name }}</strong>
              <span class="user-cell-email">{{ item.email }}</span>
            </div>
          </div>
        </template>

        <template #cell-role="{ item }">
          <span class="role-badge" :class="item.role.toLowerCase()">
            {{ item.role }}
          </span>
        </template>

        <template #cell-department="{ item }">
          <span class="dept-text">{{ item.department }}</span>
        </template>

        <template #cell-status="{ item }">
          <span class="status-pill" :class="item.status.toLowerCase()">
            <span class="status-dot"></span>
            {{ item.status }}
          </span>
        </template>

        <template #cell-lastLogin="{ item }">
          <span class="date-text">{{ item.lastLogin }}</span>
        </template>

        <template #cell-actions="{ item }">
          <div class="table-actions">
            <button
              type="button"
              class="btn-action permissions"
              title="Gerenciar Subpermissões"
              @click.stop="openPermissionsModal(item)"
            >
              <FiKey size="14" />
            </button>
            <button
              type="button"
              class="btn-action edit"
              title="Editar Dados do Usuário"
              @click.stop="openEditModal(item)"
            >
              <FiEdit2 size="14" />
            </button>
            <button
              type="button"
              class="btn-action status"
              :title="item.status === 'Ativo' ? 'Desativar Usuário' : 'Ativar Usuário'"
              @click.stop="toggleUserStatus(item)"
            >
              <FiXCircle v-if="item.status === 'Ativo'" size="14" />
              <FiCheckCircle v-else size="14" />
            </button>
          </div>
        </template>
      </DataTable>

      <div v-if="filteredUsers.length === 0" class="empty-state">
        <FiUsers size="36" />
        <p>Nenhum usuário encontrado com os filtros atuais.</p>
      </div>
    </section>

    <!-- MODAL 1: Criação / Edição do Usuário e Associação da Role -->
    <div v-if="isModalOpen" class="modal-backdrop" @click.self="closeModal">
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>{{ isEditing ? 'Editar Usuário' : 'Cadastrar Novo Usuário' }}</h3>
          <button type="button" class="btn-close" @click="closeModal">
            <FiX size="18" />
          </button>
        </div>

        <form @submit.prevent="saveUser" class="modal-body">
          <div class="form-group">
            <label class="label">Nome Completo</label>
            <input
              v-model="modalName"
              type="text"
              class="input"
              placeholder="Ex: Ana Silva"
              required
            />
          </div>

          <div class="form-group">
            <label class="label">E-mail Corporativo</label>
            <input
              v-model="modalEmail"
              type="email"
              class="input"
              placeholder="ana.silva@georural.com.br"
              required
            />
          </div>

          <div class="form-row two-cols">
            <div class="form-group">
              <label class="label">Role Associada</label>
              <select v-model="modalRole" class="select">
                <option v-for="r in availableRoles" :key="r.value" :value="r.value">
                  {{ r.label }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label class="label">Status Inicial</label>
              <select v-model="modalStatus" class="select">
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="label">Departamento</label>
            <input
              v-model="modalDepartment"
              type="text"
              class="input"
              placeholder="Ex: Análise Espacial"
            />
          </div>

          <p class="modal-role-tip">
            <FiShield size="14" />
            Ao associar a role <strong>{{ modalRole }}</strong
            >, o usuário receberá o pacote básico de subpermissões desta role. Você poderá anexar ou
            remover permissões específicas a qualquer momento no modal de acessos.
          </p>

          <div class="modal-footer">
            <button type="button" class="btn btn_outline" @click="closeModal">Cancelar</button>
            <button type="submit" class="btn btn_primary">
              <FiSave size="16" />
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL 2: Modal Dedicado de Permissões (Módulo, Subpermissão, Check/X) -->
    <div v-if="isPermModalOpen" class="modal-backdrop" @click.self="closePermissionsModal">
      <div class="modal-dialog modal-permissions-dialog">
        <div class="modal-header">
          <div>
            <h3>Gerenciamento de Subpermissões</h3>
            <p class="modal-subtitle">
              Usuário: <strong>{{ permUser?.name }}</strong> &bull; Role Associada:
              <span class="role-badge" :class="permUser?.role.toLowerCase()">{{
                permUser?.role
              }}</span>
            </p>
          </div>
          <button type="button" class="btn-close" @click="closePermissionsModal">
            <FiX size="18" />
          </button>
        </div>

        <div class="modal-body-permissions">
          <!-- Barra de Ações Rápidas e Filtro -->
          <div class="perm-toolbar">
            <div class="perm-search-box">
              <FiSearch class="search-icon" size="14" />
              <input
                v-model="permSearchFilter"
                type="text"
                class="input perm-input"
                placeholder="Buscar por módulo ou subpermissão..."
              />
            </div>

            <div class="perm-module-select">
              <select v-model="permModuleFilter" class="select">
                <option value="">Todos os Módulos ({{ uniqueModules.length }})</option>
                <option v-for="m in uniqueModules" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>

            <button
              type="button"
              class="btn btn_outline btn-sm"
              title="Restaurar para as permissões originais da role"
              @click="resetToRoleDefaults"
            >
              Restaurar Padrão da Role
            </button>
          </div>

          <!-- Tabela de Subpermissões com Check / X -->
          <div class="permissions-table-wrapper">
            <table class="perm-table">
              <thead>
                <tr>
                  <th style="width: 25%">Módulo</th>
                  <th style="width: 45%">Subpermissão</th>
                  <th style="width: 30%; text-align: center">Atribuição / Status</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in filteredPermissionDefs"
                  :key="getPermKey(p)"
                  :class="{ 'row-active': selectedPermissions.has(getPermKey(p)) }"
                  @click="togglePermission(getPermKey(p))"
                >
                  <td class="cell-module">
                    <span class="module-tag">{{ p.modulo }}</span>
                  </td>
                  <td class="cell-subperm">
                    <strong>{{ p.subpermissao }}</strong>
                  </td>
                  <td class="cell-toggle" style="text-align: center">
                    <button
                      type="button"
                      class="toggle-perm-btn"
                      :class="selectedPermissions.has(getPermKey(p)) ? 'is-granted' : 'is-revoked'"
                      @click.stop="togglePermission(getPermKey(p))"
                    >
                      <template v-if="selectedPermissions.has(getPermKey(p))">
                        <FiCheck size="16" />
                        <span>Permitido (Check)</span>
                      </template>
                      <template v-else>
                        <FiX size="16" />
                        <span>Sem Acesso (X)</span>
                      </template>
                    </button>
                  </td>
                </tr>

                <tr v-if="filteredPermissionDefs.length === 0">
                  <td colspan="3" class="text-center p-4">
                    Nenhuma subpermissão encontrada com o filtro informado.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="perm-summary-footer">
            <span class="summary-text">
              Total concedido: <strong>{{ selectedPermissions.size }}</strong> de
              {{ ALL_PERMISSIONS.length }} subpermissões do sistema.
            </span>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn_outline" @click="closePermissionsModal">
              Cancelar
            </button>
            <button type="button" class="btn btn_primary" @click="savePermissions">
              <FiSave size="16" />
              Salvar Permissões
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="matrix-expanded-container">
      <header class="matrix-header">
        <h4>Matriz Referencial de Roles</h4>
        <p>
          Mapeamento padrão das roles no GeoRural. Você pode anexar permissões personalizadas pelo
          botão <strong>Editar Acessos</strong>.
        </p>
      </header>

      <div class="matrix-table-wrapper">
        <h5 class="matrix-subtitle">Finalidade das Roles</h5>
        <table class="matrix-table">
          <thead>
            <tr>
              <th style="width: 220px">Role</th>
              <th>Finalidade</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="role-badge admin">ADMIN</span></td>
              <td>Gerenciamento de usuarios, roles e permissoes.</td>
            </tr>
            <tr>
              <td><span class="role-badge operador_dados">OPERADOR_DADOS</span></td>
              <td>Entrada, processamento e controle de qualidade dos dados.</td>
            </tr>
            <tr>
              <td><span class="role-badge analista">ANALISTA</span></td>
              <td>Consulta, analise territorial, mapas e indicadores.</td>
            </tr>
            <tr>
              <td><span class="role-badge auditor">AUDITOR</span></td>
              <td>Auditoria, historico e rastreabilidade dos dados.</td>
            </tr>
            <tr>
              <td><span class="role-badge gestor">GESTOR</span></td>
              <td>Governanca, homologacao, exportacao e integracoes.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </main>
</template>

<style scoped>
.users-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
}

.heading-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 24px;
}

@media (max-width: 640px) {
  .heading-content {
    flex-direction: column;
    align-items: flex-start;
  }
}

.eyebrow {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--vis-brand-orange, #e67e22);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.heading-content h1 {
  font-size: 1.85rem;
  font-weight: 700;
  color: var(--color-heading);
  margin-bottom: 6px;
}

.page-description {
  color: var(--color-text-muted, #718096);
  font-size: 0.95rem;
}

.card {
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
}

.filter-card {
  padding: 16px 20px;
}

.filter-grid {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 280px;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--color-text-muted, #a0aec0);
  pointer-events: none;
}

.search-input {
  padding-left: 38px !important;
  width: 100%;
}

.filter-selects {
  display: flex;
  gap: 12px;
}

.select-group {
  position: relative;
  display: flex;
  align-items: center;
}

.select-icon {
  position: absolute;
  left: 12px;
  color: var(--color-text-muted, #a0aec0);
  pointer-events: none;
}

.select {
  padding-left: 34px !important;
}

.table-card {
  overflow: hidden;
  padding: 0;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar-mini {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--color-background-soft, #edf2f7);
  color: var(--vis-brand-orange, #e67e22);
  font-weight: 700;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-cell-name {
  display: block;
  font-size: 0.92rem;
  color: var(--color-heading);
}

.user-cell-email {
  display: block;
  font-size: 0.78rem;
  color: var(--color-text-muted, #718096);
}

.perms-count-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-count {
  font-size: 0.78rem;
  background: var(--color-background-soft, #edf2f7);
  padding: 2px 8px;
  border-radius: 4px;
  color: var(--color-heading);
  font-weight: 600;
}

.btn-perm-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--vis-brand-orange, #e67e22);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
}

.btn-perm-link:hover {
  opacity: 0.85;
}

.dept-text,
.date-text {
  font-size: 0.88rem;
  color: var(--color-text);
}

.role-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  text-transform: uppercase;
}

.role-badge.admin {
  background: #feebc8;
  color: #c05621;
}

.role-badge.analista {
  background: #e2e8f0;
  color: #2b6cb0;
}

.role-badge.auditor {
  background: #fed7d7;
  color: #9b2c2c;
}

.role-badge.operador_dados {
  background: #c6f6d5;
  color: #22543d;
}

.role-badge.gestor {
  background: #e9d8fd;
  color: #553c9e;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  font-weight: 600;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-pill.ativo {
  color: #38a169;
}

.status-pill.ativo .status-dot {
  background: #38a169;
}

.status-pill.inativo {
  color: #a0aec0;
}

.status-pill.inativo .status-dot {
  background: #a0aec0;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-action {
  background: transparent;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 4px;
  padding: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted, #718096);
  transition: all 0.2s ease;
}

.btn-action:hover {
  background: var(--color-background-soft, #f7fafc);
  color: var(--color-heading);
}

.btn-action.permissions:hover {
  color: var(--vis-brand-orange, #e67e22);
  border-color: var(--vis-brand-orange, #e67e22);
}

.btn-action.edit:hover {
  color: #3182ce;
  border-color: #3182ce;
}

.btn-action.status:hover {
  color: var(--vis-brand-orange, #e67e22);
  border-color: var(--vis-brand-orange, #e67e22);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 16px;
  color: var(--color-text-muted, #a0aec0);
}

.alert-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 0.88rem;
  font-weight: 500;
  margin-bottom: 20px;
}

.alert-success {
  background-color: #f0fff4;
  color: #276749;
  border: 1px solid #c6f6d5;
}

/* Modais */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-dialog {
  background: var(--color-surface, #ffffff);
  border-radius: 8px;
  width: 100%;
  max-width: 520px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.modal-permissions-dialog {
  max-width: 760px;
}

.modal-header {
  padding: 18px 24px;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-heading);
}

.modal-subtitle {
  font-size: 0.84rem;
  color: var(--color-text-muted, #718096);
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-close {
  background: transparent;
  border: 0;
  color: var(--color-text-muted, #a0aec0);
  cursor: pointer;
}

.modal-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-body-permissions {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.perm-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.perm-search-box {
  position: relative;
  flex: 1;
  min-width: 200px;
  display: flex;
  align-items: center;
}

.perm-input {
  padding-left: 32px !important;
  font-size: 0.85rem;
}

.perm-module-select select {
  font-size: 0.85rem;
  padding: 6px 12px;
}

.btn-sm {
  font-size: 0.8rem;
  padding: 6px 12px;
}

.permissions-table-wrapper {
  max-height: 420px;
  overflow-y: auto;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
}

.perm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}

.perm-table th,
.perm-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
}

.perm-table th {
  position: sticky;
  top: 0;
  background: var(--color-background-soft, #edf2f7);
  z-index: 2;
  font-weight: 700;
  color: var(--color-heading);
  text-align: left;
}

.perm-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}

.perm-table tbody tr:hover {
  background: var(--color-background-soft, #f7fafc);
}

.perm-table tbody tr.row-active {
  background: rgba(230, 126, 34, 0.04);
}

.module-tag {
  background: #edf2f7;
  color: #4a5568;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}

.toggle-perm-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 999px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.toggle-perm-btn.is-granted {
  background: #c6f6d5;
  color: #22543d;
  border-color: #9ae6b4;
}

.toggle-perm-btn.is-revoked {
  background: #fed7d7;
  color: #9b2c2c;
  border-color: #feb2b2;
}

.perm-summary-footer {
  font-size: 0.84rem;
  color: var(--color-text-muted, #718096);
  padding: 4px 0;
}

.modal-role-tip {
  font-size: 0.82rem;
  color: var(--color-text-muted, #718096);
  background: var(--color-background-soft, #f8fafc);
  padding: 10px 14px;
  border-radius: 6px;
  border-left: 3px solid var(--vis-brand-orange, #e67e22);
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.4;
}

.form-row.two-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--color-heading);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border, #e2e8f0);
}

/* Matriz no Expanded Container */
.matrix-expanded-container {
  padding: 24px;
  background: var(--color-background-soft, #f8fafc);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.matrix-header h4 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-heading);
  margin-bottom: 4px;
}

.matrix-header p {
  font-size: 0.86rem;
  color: var(--color-text-muted, #718096);
}

.matrix-table-wrapper {
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
}

.matrix-subtitle {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-heading);
  margin-bottom: 12px;
}

.matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.matrix-table th,
.matrix-table td {
  padding: 9px 12px;
  border: 1px solid var(--color-border, #e2e8f0);
  text-align: left;
}

.matrix-table th {
  background: var(--color-background-soft, #edf2f7);
  color: var(--color-heading);
  font-weight: 700;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.text-center {
  text-align: center !important;
}
</style>
