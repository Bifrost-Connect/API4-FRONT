/**
 * @file Fixtures e dados simulados para gerenciamento de usuários, papéis e permissões.
 */

import {
  ALL_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  type StandardRole,
  type SystemRole,
  type RoleDef,
  type SecurityEvent,
  type PermissionDefinition,
  type UserItem,
  type RoleOption,
} from '@/types/access'

export {
  ALL_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  type StandardRole,
  type SystemRole,
  type RoleDef,
  type SecurityEvent,
  type PermissionDefinition,
  type UserItem,
  type RoleOption,
}

export const MOCK_AVAILABLE_ROLES: RoleOption[] = [
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
  {
    value: 'INTEGRADOR_EXTERNO',
    label: 'INTEGRADOR_EXTERNO',
    desc: 'Consumo externo de catálogo, mapas e exportação via API.',
  },
]

export const MOCK_USERS_LIST: UserItem[] = [
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
    permissions: [...ROLE_DEFAULT_PERMISSIONS.ANALISTA, 'EXPORTACAO:CSV'],
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
]

export const MOCK_ROLES: RoleDef[] = [
  {
    id: 'ADMIN',
    nome: 'ADMIN',
    descricao: 'Gerenciamento de usuários, roles e permissões.',
    padrao: true,
    permissions: [...ROLE_DEFAULT_PERMISSIONS.ADMIN],
  },
  {
    id: 'OPERADOR_DADOS',
    nome: 'OPERADOR_DADOS',
    descricao: 'Entrada, processamento e controle de qualidade dos dados.',
    padrao: true,
    permissions: [...ROLE_DEFAULT_PERMISSIONS.OPERADOR_DADOS],
  },
  {
    id: 'ANALISTA',
    nome: 'ANALISTA',
    descricao: 'Consulta, análise territorial, mapas e indicadores.',
    padrao: true,
    permissions: [...ROLE_DEFAULT_PERMISSIONS.ANALISTA],
  },
  {
    id: 'AUDITOR',
    nome: 'AUDITOR',
    descricao: 'Auditoria, histórico e rastreabilidade dos dados.',
    padrao: true,
    permissions: [...ROLE_DEFAULT_PERMISSIONS.AUDITOR],
  },
  {
    id: 'GESTOR',
    nome: 'GESTOR',
    descricao: 'Governança, homologação, exportação e integrações.',
    padrao: true,
    permissions: [...ROLE_DEFAULT_PERMISSIONS.GESTOR],
  },
  {
    id: 'INTEGRADOR_EXTERNO',
    nome: 'INTEGRADOR_EXTERNO',
    descricao: 'Consumo externo de catálogo, mapas e exportação via API.',
    padrao: true,
    permissions: [...ROLE_DEFAULT_PERMISSIONS.INTEGRADOR_EXTERNO],
  },
]

export const MOCK_SECURITY_EVENTS: SecurityEvent[] = [
  {
    id: 1,
    timestamp: '08/11/2026 14:10',
    actorEmail: 'carlos.mendes@georural.com.br',
    actorName: 'Carlos Mendes',
    action: 'Criação de Conta',
    details: 'Cadastrou o usuário Patrícia Souza com papel AUDITOR.',
    severity: 'INFO',
  },
  {
    id: 2,
    timestamp: '08/11/2026 11:30',
    actorEmail: 'carlos.mendes@georural.com.br',
    actorName: 'Carlos Mendes',
    action: 'Troca de Cargo',
    details: 'Alterou o papel de Mariana Duarte para ANALISTA.',
    severity: 'INFO',
  },
  {
    id: 3,
    timestamp: '07/11/2026 16:45',
    actorEmail: 'carlos.mendes@georural.com.br',
    actorName: 'Carlos Mendes',
    action: 'Inativação de Conta',
    details: 'Inativou o acesso de Fernando Rocha (Diretoria de Governança).',
    severity: 'WARNING',
  },
  {
    id: 4,
    timestamp: '06/11/2026 10:20',
    actorEmail: 'carlos.mendes@georural.com.br',
    actorName: 'Carlos Mendes',
    action: 'Exceção SoD Concedida',
    details: 'Autorizou acúmulo de Ingestão e Homologação para usuário emergencial. Justificativa: Cobrir plantão de safra.',
    severity: 'DANGER',
  },
]

// Mantém compatibilidade com testes legados
export const mockCurrentUser = {
  id: 1,
  name: 'João Silva',
  role: 'Operador',
}
