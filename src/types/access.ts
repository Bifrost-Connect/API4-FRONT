/**
 * Contratos de domínio, constantes canônicas e erros de Controle de Acesso (RBAC).
 */

export type StandardRole =
  | 'ADMIN'
  | 'OPERADOR_DADOS'
  | 'ANALISTA'
  | 'AUDITOR'
  | 'GESTOR'

export type SystemRole = StandardRole | (string & {})

export const ALL_MODULES = [
  'USUARIOS',
  'ROLES',
  'BASES',
  'INGESTAO',
  'QUARENTENA',
  'MAPA',
  'ANALISE_TERRITORIAL',
  'INDICADORES',
  'AUDITORIA',
  'EXPORTACAO',
  'API',
] as const

export type ModuleKey = (typeof ALL_MODULES)[number] | (string & {})

export const ALL_SUB_PERMISSIONS = [
  'VISUALIZAR',
  'CRIAR',
  'EDITAR',
  'DESATIVAR',
  'EXCLUIR',
  'ATRIBUIR_ROLE',
  'ATRIBUIR_PERMISSAO',
  'GERENCIAR_PERMISSOES',
  'EDITAR_METADADOS',
  'CONSULTAR_CATALOGO',
  'HOMOLOGAR',
  'UPLOAD',
  'VISUALIZAR_PROCESSAMENTO',
  'REPROCESSAR',
  'CANCELAR',
  'ENVIAR',
  'CORRIGIR',
  'DESCARTAR',
  'VISUALIZAR_CAMADAS',
  'VISUALIZAR_SOBREPOSICOES',
  'COMPARAR_SAFRAS',
  'EXECUTAR',
  'CALCULAR_SOBREPOSICAO',
  'CONSULTAR_RESULTADO',
  'SALVAR_RESULTADO',
  'CALCULAR',
  'BLOQUEAR_VERSAO',
  'DESBLOQUEAR_VERSAO',
  'RASTREAR_ORIGEM',
  'VISUALIZAR_VERSOES',
  'VISUALIZAR_HASH',
  'VISUALIZAR_LOGS',
  'VISUALIZAR_PROCESSAMENTOS',
  'VISUALIZAR_ALTERACOES',
  'CSV',
  'GEOJSON',
  'VISUALIZAR_CHAVES',
  'GERAR_CHAVE',
  'REVOGAR_CHAVE',
] as const

export type SubPermissionKey = (typeof ALL_SUB_PERMISSIONS)[number] | (string & {})

export interface PermissionDefinition {
  modulo: ModuleKey
  subpermissao: SubPermissionKey
}

export interface RoleDef {
  id: string
  nome: string
  descricao: string
  padrao: boolean
  permissions: string[]
}

export interface SecurityEvent {
  id: number
  timestamp: string
  actorEmail: string
  actorName: string
  action: string
  details: string
  severity: 'INFO' | 'WARNING' | 'DANGER'
  actionCode?: string
  ip?: string
  userId?: number | null
}

export interface UserItem {
  id: number
  name: string
  email: string
  role: SystemRole
  roleId?: string
  permissions: string[]
  hasCustomPermissions?: boolean
  department: string
  status: 'Ativo' | 'Inativo'
  lastLogin: string
  sodException?: boolean
  sodJustification?: string
}

export interface RoleOption {
  value: SystemRole
  label: string
  desc: string
}

export interface UserSession {
  id?: number
  name: string
  email?: string
  role: string
  roleId?: string
  permissions: string[]
  token?: string
}

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
  { modulo: 'MAPA', subpermissao: 'EDITAR' },
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

export const PERMISSION_CATALOG = ALL_PERMISSIONS

export const ROLE_DEFAULT_PERMISSIONS: Record<StandardRole, string[]> = {
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
    'AUDITORIA:VISUALIZAR',
    'AUDITORIA:VISUALIZAR_LOGS',
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
    'INGESTAO:VISUALIZAR_PROCESSAMENTO',
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
    'INGESTAO:VISUALIZAR_PROCESSAMENTO',
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
    'API:VISUALIZAR_CHAVES',
    'API:GERAR_CHAVE',
    'API:REVOGAR_CHAVE',
  ],
}

export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`O e-mail "${email}" já está cadastrado no sistema.`)
    this.name = 'DuplicateEmailError'
  }
}

export class StandardRoleProtectedError extends Error {
  constructor(roleId: string) {
    super(`O papel padrão "${roleId}" não pode ser removido do sistema.`)
    this.name = 'StandardRoleProtectedError'
  }
}

export class RoleInUseError extends Error {
  constructor(roleId: string, count: number) {
    super(`O papel "${roleId}" está vinculado a ${count} usuário(s) e não pode ser excluído.`)
    this.name = 'RoleInUseError'
  }
}
