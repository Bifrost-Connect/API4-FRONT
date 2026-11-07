/**
 * @file Fixtures e dados simulados para gerenciamento de usuários, papéis e permissões.
 */

export type SystemRole = 'ADMIN' | 'OPERADOR_DADOS' | 'ANALISTA' | 'AUDITOR' | 'GESTOR'

export interface PermissionDefinition {
  modulo: string
  subpermissao: string
}

export interface UserItem {
  id: number
  name: string
  email: string
  role: SystemRole
  permissions: string[]
  department: string
  status: 'Ativo' | 'Inativo'
  lastLogin: string
}

export interface RoleOption {
  value: SystemRole
  label: string
  desc: string
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
]

// Catálogo completo de módulos e subpermissões do GeoRural
export const ALL_PERMISSIONS: PermissionDefinition[] = [
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

export const ROLE_DEFAULT_PERMISSIONS: Record<SystemRole, string[]> = {
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

// Mantém compatibilidade com testes legados
export const mockCurrentUser = {
  id: 1,
  name: 'João Silva',
  role: 'Operador',
}
