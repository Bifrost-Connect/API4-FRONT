/**
 * Utilitários de controle de acesso baseado em permissões (RBAC) e segregação de funções (SoD).
 * O acesso a telas, menus e ações é estritamente orientado a permissões (MODULO:SUBPERMISSAO),
 * garantindo compatibilidade dinâmica com papéis padrão e customizados criados em tempo de execução.
 */

import {
  FiGrid,
  FiUploadCloud,
  FiDatabase,
  FiMap,
  FiPieChart,
  FiUser,
  FiUsers,
} from 'vue-icons-plus/fi'
import type { Component } from 'vue'

export interface SessionUser {
  id?: number
  name: string
  email?: string
  role: string
  roleId?: string
  permissions: string[]
}

/**
 * Catálogo das 5 roles padrão do GeoRural (fonte: Roles_Validadas.docx).
 */
export const STANDARD_ROLES = [
  'ADMIN',
  'OPERADOR_DADOS',
  'ANALISTA',
  'AUDITOR',
  'GESTOR',
] as const

export type StandardRole = (typeof STANDARD_ROLES)[number]

/**
 * Normaliza o identificador do papel para a chave padrão em maiúsculas.
 */
export function normalizeRoleKey(role?: string): string {
  if (!role) return 'OPERADOR_DADOS'
  const norm = role.toUpperCase().trim()
  if (norm === 'ADMINISTRADOR') return 'ADMIN'
  if (norm === 'OPERADOR') return 'OPERADOR_DADOS'
  return norm
}

/**
 * Verifica se a sessão possui uma permissão específica.
 */
export function can(session: SessionUser | null | undefined, permission: string): boolean {
  if (!session) return false
  if (!Array.isArray(session.permissions)) return false
  return session.permissions.includes(permission)
}

/**
 * Verifica se a sessão possui pelo menos uma das permissões informadas.
 */
export function canAny(session: SessionUser | null | undefined, permissions: string[]): boolean {
  if (!session) return false
  if (!Array.isArray(session.permissions) || session.permissions.length === 0) return false
  return permissions.some((p) => session.permissions.includes(p))
}

/**
 * Regra SoD (Segregação de Funções - Tarefa 5):
 * Alerta de conflito crítico quando há acúmulo de Ingestão de Cargas (Operador)
 * com Homologação/Aprovação de Bases ou Indicadores (Gestor).
 */
export function hasSoDConflict(permissions: string[]): boolean {
  if (!Array.isArray(permissions)) return false
  const hasIngestao = permissions.includes('INGESTAO:UPLOAD')
  const hasHomologacao =
    permissions.includes('BASES:HOMOLOGAR') || permissions.includes('INDICADORES:HOMOLOGAR')
  return hasIngestao && hasHomologacao
}

/**
 * Trava Imutável do Perfil Read-Only do Auditor (Tarefa 9):
 * O perfil Auditor Ambiental não pode receber permissões de escrita, upload,
 * aprovação, exclusão ou exportação.
 */
export function isAuditorReadOnlyLocked(permission: string): boolean {
  const [modulo, sub] = permission.split(':')
  if (!sub) return false

  const blockedActions = [
    'CRIAR',
    'EDITAR',
    'EXCLUIR',
    'DESATIVAR',
    'UPLOAD',
    'REPROCESSAR',
    'CANCELAR',
    'ENVIAR',
    'CORRIGIR',
    'DESCARTAR',
    'HOMOLOGAR',
    'BLOQUEAR_VERSAO',
    'DESBLOQUEAR_VERSAO',
    'SALVAR_RESULTADO',
    'CALCULAR',
    'ATRIBUIR_ROLE',
    'ATRIBUIR_PERMISSAO',
    'GERENCIAR_PERMISSOES',
    'GERAR_CHAVE',
    'REVOGAR_CHAVE',
    'CSV',
    'GEOJSON',
  ]

  if (blockedActions.includes(sub)) return true
  if (modulo === 'EXPORTACAO' || modulo === 'ROLES' || modulo === 'USUARIOS') return true
  return false
}

/**
 * Mapeamento das permissões necessárias para cada rota da aplicação.
 */
export const ROUTE_PERMISSIONS: Record<string, string | string[]> = {
  dashboard: 'INGESTAO:VISUALIZAR_PROCESSAMENTO',
  upload: 'INGESTAO:UPLOAD',
  catalogo: 'BASES:CONSULTAR_CATALOGO',
  mapa: 'MAPA:VISUALIZAR',
  'analise-territorial': 'ANALISE_TERRITORIAL:CONSULTAR_RESULTADO',
  'process-log': [
    'QUARENTENA:VISUALIZAR',
    'AUDITORIA:VISUALIZAR_PROCESSAMENTOS',
    'BASES:HOMOLOGAR',
    'INGESTAO:VISUALIZAR_PROCESSAMENTO',
  ],
  users: ['USUARIOS:VISUALIZAR', 'ROLES:VISUALIZAR'],
}

/**
 * Determina a tela inicial ("Minha Área Inicial") mais adequada ao perfil
 * com base nas permissões concedidas.
 */
export function homeFor(session: SessionUser | null | undefined): string {
  if (!session) return '/login'

  // Administrador focado em governança de acessos
  if (can(session, 'USUARIOS:VISUALIZAR') && !can(session, 'INGESTAO:VISUALIZAR_PROCESSAMENTO')) {
    return '/users'
  }

  // Operador focado no Dashboard de Cargas
  if (can(session, 'INGESTAO:VISUALIZAR_PROCESSAMENTO')) {
    return '/'
  }

  // Gestor com poder de homologação de bases
  if (can(session, 'BASES:HOMOLOGAR')) {
    return '/catalogo'
  }

  // Analista com execução analítica territorial
  if (can(session, 'ANALISE_TERRITORIAL:EXECUTAR')) {
    return '/analise-territorial'
  }

  // Auditor com foco em auditoria e catálogo de bases
  if (can(session, 'AUDITORIA:RASTREAR_ORIGEM')) {
    return '/catalogo'
  }

  // Consulta ao catálogo geral
  if (can(session, 'BASES:CONSULTAR_CATALOGO')) {
    return '/catalogo'
  }

  if (can(session, 'MAPA:VISUALIZAR')) {
    return '/mapa'
  }

  return '/profile'
}

export interface MenuItem {
  label: string
  to: string
  icon: Component
  permission?: string | string[]
}

/**
 * Itens canônicos da barra lateral de navegação com suas permissões requeridas.
 */
export const MENU_ITEMS: MenuItem[] = [
  {
    label: 'Dashboard',
    to: '/',
    icon: FiGrid,
    permission: 'INGESTAO:VISUALIZAR_PROCESSAMENTO',
  },
  {
    label: 'Upload de carga',
    to: '/upload',
    icon: FiUploadCloud,
    permission: 'INGESTAO:UPLOAD',
  },
  {
    label: 'Catálogo de Bases',
    to: '/catalogo',
    icon: FiDatabase,
    permission: 'BASES:CONSULTAR_CATALOGO',
  },
  {
    label: 'Mapa operacional',
    to: '/mapa',
    icon: FiMap,
    permission: 'MAPA:VISUALIZAR',
  },
  {
    label: 'Análise territorial',
    to: '/analise-territorial',
    icon: FiPieChart,
    permission: 'ANALISE_TERRITORIAL:CONSULTAR_RESULTADO',
  },
  {
    label: 'Perfil do usuário',
    to: '/profile',
    icon: FiUser,
  },
  {
    label: 'Gerenciamento de usuários',
    to: '/users',
    icon: FiUsers,
    permission: ['USUARIOS:VISUALIZAR', 'ROLES:VISUALIZAR'],
  },
]

/**
 * Filtra os itens do menu conforme as permissões da sessão ativa.
 */
export function getVisibleMenuItems(session: SessionUser | null | undefined): MenuItem[] {
  return MENU_ITEMS.filter((item) => {
    if (!item.permission) return true
    if (Array.isArray(item.permission)) {
      return canAny(session, item.permission)
    }
    return can(session, item.permission)
  })
}
