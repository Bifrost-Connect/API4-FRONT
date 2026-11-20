/**
 * @file Fixtures para testes automatizados.
 */
import { ROLE_DEFAULT_PERMISSIONS, type RoleDef, type SecurityEvent, type UserItem } from '@/types/access'

export const mockCurrentUser = {
  id: 1,
  name: 'João Silva',
  role: 'Operador',
}

export const MOCK_ROLES: RoleDef[] = [
  {
    id: 'ADMIN',
    nome: 'Administrador',
    descricao: 'Gestão completa de usuários, cargos e chaves de API.',
    padrao: true,
    permissions: [...ROLE_DEFAULT_PERMISSIONS.ADMIN],
  },
  {
    id: 'ANALISTA',
    nome: 'Analista',
    descricao: 'Análise territorial e comparação temporal.',
    padrao: true,
    permissions: [...ROLE_DEFAULT_PERMISSIONS.ANALISTA],
  },
  {
    id: 'OPERADOR_DADOS',
    nome: 'Operador de Dados',
    descricao: 'Ingestão e tratamento operacional de cargas.',
    padrao: true,
    permissions: [...ROLE_DEFAULT_PERMISSIONS.OPERADOR_DADOS],
  },
  {
    id: 'AUDITOR',
    nome: 'Auditor',
    descricao: 'Consulta somente leitura e auditoria.',
    padrao: true,
    permissions: [...ROLE_DEFAULT_PERMISSIONS.AUDITOR],
  },
  {
    id: 'GESTOR',
    nome: 'Gestor',
    descricao: 'Homologação de bases e gestão de chaves de API.',
    padrao: true,
    permissions: [...ROLE_DEFAULT_PERMISSIONS.GESTOR],
  },
]

export const MOCK_USERS_LIST: UserItem[] = [
  {
    id: 1,
    name: 'Carlos Mendes',
    email: 'carlos.mendes@georural.com.br',
    role: 'ADMIN',
    permissions: [...ROLE_DEFAULT_PERMISSIONS.ADMIN],
    department: 'Diretoria',
    status: 'Ativo',
    lastLogin: '10/11/2026 09:00',
  },
  {
    id: 2,
    name: 'Mariana Duarte',
    email: 'mariana.duarte@georural.com.br',
    role: 'ANALISTA',
    permissions: [...ROLE_DEFAULT_PERMISSIONS.ANALISTA],
    department: 'Inteligência Territorial',
    status: 'Ativo',
    lastLogin: '10/11/2026 08:30',
  },
  {
    id: 3,
    name: 'João Silva',
    email: 'joao.silva@georural.com.br',
    role: 'OPERADOR_DADOS',
    permissions: [...ROLE_DEFAULT_PERMISSIONS.OPERADOR_DADOS],
    department: 'Operações',
    status: 'Ativo',
    lastLogin: '09/11/2026 17:45',
  },
  {
    id: 4,
    name: 'Patrícia Souza',
    email: 'patricia.souza@georural.com.br',
    role: 'AUDITOR',
    permissions: [...ROLE_DEFAULT_PERMISSIONS.AUDITOR],
    department: 'Compliance',
    status: 'Ativo',
    lastLogin: '09/11/2026 15:20',
  },
]

export const MOCK_SECURITY_EVENTS: SecurityEvent[] = [
  {
    id: 1,
    timestamp: '10/11/2026 10:00',
    actorName: 'Carlos Mendes',
    actorEmail: 'carlos.mendes@georural.com.br',
    action: 'Criação de Conta',
    actionCode: 'USUARIO_CRIADO',
    details: 'Cadastrou o usuário Mariana Duarte.',
    severity: 'INFO',
  },
]
