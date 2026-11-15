/**
 * Adaptador bidirecional entre os contratos RBAC do Back-End (API4-BACK)
 * e as chaves canônicas de papéis, permissões e auditoria do Front-End.
 */

import {
  ROLE_DEFAULT_PERMISSIONS,
  type RoleDef,
  type SecurityEvent,
  type UserItem,
} from '@/mocks/user.mock'
import { isAuditorReadOnlyLocked } from '@/utils/rbac'

export interface BackendRolePermissionRow {
  perfil_id: number
  perfil: string
  descricao: string
  recurso: string
  permissao: string
  descricao_permissao: string
  liberada_por_excecao_sod: boolean
}

export interface BackendUserRow {
  id: number
  nome: string
  email: string
  perfil_id: number
  perfil: string
  ativo: boolean
  excecao_sod_autorizada?: boolean
  justificativa_sod?: string | null
  data_criacao?: string
  data_atualizacao?: string
}

export interface BackendAuditLogRow {
  id: number
  usuario_id: number | null
  processo_id: number | null
  acao: string
  descricao: string
  detalhes: string | Record<string, unknown> | null
  ip: string | null
  data_hora: string
  usuario_nome?: string
  usuario_email?: string
}

const BACKEND_TO_FRONT_ROLE: Record<string, string> = {
  ADMINISTRADOR: 'ADMIN',
  ADMIN: 'ADMIN',
  OPERADOR: 'OPERADOR_DADOS',
  OPERADOR_DADOS: 'OPERADOR_DADOS',
  AUDITOR: 'AUDITOR',
  GESTOR: 'GESTOR',
  ANALISTA: 'ANALISTA',
  INTEGRADOR_EXTERNO: 'INTEGRADOR_EXTERNO',
  INTEGRADOR: 'INTEGRADOR_EXTERNO',
}

const FRONT_TO_BACKEND_ROLE: Record<string, string> = {
  ADMIN: 'ADMINISTRADOR',
  ADMINISTRADOR: 'ADMINISTRADOR',
  OPERADOR_DADOS: 'OPERADOR',
  OPERADOR: 'OPERADOR',
  AUDITOR: 'AUDITOR',
  GESTOR: 'GESTOR',
  ANALISTA: 'ANALISTA',
  INTEGRADOR_EXTERNO: 'INTEGRADOR_EXTERNO',
  INTEGRADOR: 'INTEGRADOR_EXTERNO',
}

/**
 * Expansão das 20 permissões do enum Permissao (API4-BACK) para chaves MODULO:SUBPERMISSAO do front-end.
 */
export const BACKEND_TO_FRONT_PERMISSION_MAP: Record<string, string[]> = {
  // CARGAS
  CARGA_ENVIAR: ['INGESTAO:UPLOAD', 'CARGAS:UPLOAD', 'QUARENTENA:ENVIAR'],
  CARGA_CANCELAR: ['INGESTAO:CANCELAR'],
  CARGA_CONSULTAR: ['INGESTAO:VISUALIZAR_PROCESSAMENTO', 'CARGAS:VISUALIZAR', 'BASES:VISUALIZAR'],
  CARGA_ATRIBUIR: ['INGESTAO:REPROCESSAR', 'BASES:EDITAR_METADADOS'],
  ARQUIVO_BAIXAR: ['BASES:VISUALIZAR'],

  // QUARENTENA
  QUARENTENA_CONSULTAR: ['QUARENTENA:VISUALIZAR'],
  QUARENTENA_EXPORTAR: ['QUARENTENA:CORRIGIR', 'QUARENTENA:REPROCESSAR', 'QUARENTENA:DESCARTAR'],
  NOTIFICACAO_ENVIAR: ['QUARENTENA:ENVIAR'],

  // TERRITORIAL
  GEOMETRIA_EDITAR: ['MAPA:EDITAR', 'ANALISE_TERRITORIAL:SALVAR_RESULTADO'],
  ANALISE_EXECUTAR: [
    'ANALISE_TERRITORIAL:EXECUTAR',
    'ANALISE_TERRITORIAL:CALCULAR_SOBREPOSICAO',
    'ANALISE_TERRITORIAL:CONSULTAR_RESULTADO',
    'INDICADORES:VISUALIZAR',
    'INDICADORES:CALCULAR',
  ],

  // PUBLICACAO
  CARGA_APROVAR: ['BASES:HOMOLOGAR', 'INDICADORES:HOMOLOGAR'],
  VERSAO_PUBLICAR: ['INDICADORES:BLOQUEAR_VERSAO', 'INDICADORES:DESBLOQUEAR_VERSAO'],
  PUBLICACAO_CONSULTAR: ['BASES:CONSULTAR_CATALOGO', 'BASES:VISUALIZAR', 'INDICADORES:VISUALIZAR'],
  RELATORIO_EXPORTAR: ['EXPORTACAO:CSV', 'EXPORTACAO:GEOJSON'],

  // CONSUMO
  CATALOGO_CONSULTAR: ['BASES:CONSULTAR_CATALOGO', 'BASES:VISUALIZAR'],
  MAPA_CONSULTAR: [
    'MAPA:VISUALIZAR',
    'MAPA:VISUALIZAR_CAMADAS',
    'MAPA:VISUALIZAR_SOBREPOSICOES',
    'MAPA:COMPARAR_SAFRAS',
  ],
  LINHAGEM_CONSULTAR: [
    'AUDITORIA:RASTREAR_ORIGEM',
    'AUDITORIA:VISUALIZAR_VERSOES',
    'AUDITORIA:VISUALIZAR_HASH',
    'AUDITORIA:VISUALIZAR_PROCESSAMENTOS',
    'AUDITORIA:VISUALIZAR_ALTERACOES',
    'AUDITORIA:VISUALIZAR',
  ],
  DOMINIO_CONSULTAR: ['ANALISE_TERRITORIAL:CONSULTAR_RESULTADO', 'INDICADORES:VISUALIZAR'],

  // ADMINISTRACAO
  USUARIO_GERENCIAR: [
    'USUARIOS:VISUALIZAR',
    'USUARIOS:GERENCIAR',
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
  GOVERNANCA_CONSULTAR: [
    'AUDITORIA:VISUALIZAR',
    'AUDITORIA:VISUALIZAR_LOGS',
    'AUDITORIA:VISUALIZAR_ALTERACOES',
    'ROLES:VISUALIZAR',
  ],
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  USUARIO_CRIADO: 'Criação de Conta',
  USUARIO_ATIVADO: 'Ativação de Conta',
  USUARIO_INATIVADO: 'Inativação de Conta',
  PERMISSAO_ALTERADA: 'Troca de Cargo / Permissão',
  PERMISSAO_ALTERADA_COM_EXCECAO_SOD: 'Exceção SoD Concedida',
  SENHA_REDEFINIDA: 'Redefinição de Senha',
  ALERTA_SOD: 'Alerta de Conflito SoD',
  ACESSO_NEGADO_403: 'Tentativa de Acesso Barrada (403)',
}

const AUDIT_ACTION_SEVERITY: Record<string, SecurityEvent['severity']> = {
  USUARIO_CRIADO: 'INFO',
  USUARIO_ATIVADO: 'INFO',
  USUARIO_INATIVADO: 'WARNING',
  PERMISSAO_ALTERADA: 'INFO',
  PERMISSAO_ALTERADA_COM_EXCECAO_SOD: 'DANGER',
  SENHA_REDEFINIDA: 'INFO',
  ALERTA_SOD: 'DANGER',
  ACESSO_NEGADO_403: 'WARNING',
}

export function mapBackendRoleToFront(perfil?: string | null): string {
  if (!perfil) return 'OPERADOR_DADOS'
  const norm = perfil.trim().toUpperCase()
  return BACKEND_TO_FRONT_ROLE[norm] || norm
}

export function mapFrontRoleToBackend(roleId?: string | null): string {
  if (!roleId) return 'OPERADOR'
  const norm = roleId.trim().toUpperCase()
  return FRONT_TO_BACKEND_ROLE[norm] || norm
}

/**
 * Converte a lista de códigos de permissão do back-end para chaves MODULO:SUBPERMISSAO do front-end.
 * Aplica também ajustes específicos do perfil (ex.: trava read-only do Auditor).
 */
export function mapBackendPermissionsToFront(
  permissoes: string[] | null | undefined,
  perfil?: string | null,
): string[] {
  const result = new Set<string>(['PERFIL:VISUALIZAR'])
  const frontRole = perfil ? mapBackendRoleToFront(perfil) : undefined

  if (Array.isArray(permissoes)) {
    for (const raw of permissoes) {
      if (!raw) continue
      const code = raw.trim().toUpperCase()
      if (code.includes(':')) {
        result.add(code)
        continue
      }
      const expanded = BACKEND_TO_FRONT_PERMISSION_MAP[code]
      if (expanded) {
        for (const permKey of expanded) {
          result.add(permKey)
        }
      }
    }
  }

  if (frontRole === 'AUDITOR') {
    result.delete('MAPA:COMPARAR_SAFRAS')
    for (const key of Array.from(result)) {
      if (isAuditorReadOnlyLocked(key)) {
        result.delete(key)
      }
    }
  }

  if (frontRole === 'INTEGRADOR_EXTERNO') {
    result.delete('MAPA:COMPARAR_SAFRAS')
  }

  if (frontRole === 'ADMIN' || frontRole === 'GESTOR' || frontRole === 'INTEGRADOR_EXTERNO') {
    result.add('API:VISUALIZAR_CHAVES')
    result.add('API:GERAR_CHAVE')
    result.add('API:REVOGAR_CHAVE')
  }

  return Array.from(result)
}

/**
 * Mapeamento reverso de uma chave do front-end para os possíveis códigos do back-end.
 */
export function mapFrontPermissionToBackend(permissionKey: string): string[] {
  const normalized = permissionKey.trim().toUpperCase()
  const matches: string[] = []
  for (const [backendCode, frontList] of Object.entries(BACKEND_TO_FRONT_PERMISSION_MAP)) {
    if (frontList.includes(normalized)) {
      matches.push(backendCode)
    }
  }
  return matches
}

/**
 * Extrai mapa normalizado { roleId -> perfil_id } a partir de /admin/perfis-permissoes.
 */
export function extractPerfilIdMap(rows: BackendRolePermissionRow[]): Record<string, number> {
  const map: Record<string, number> = {}
  if (!Array.isArray(rows)) return map

  for (const row of rows) {
    if (!row || !row.perfil || typeof row.perfil_id !== 'number') continue
    const backendName = row.perfil.trim().toUpperCase()
    const frontName = mapBackendRoleToFront(backendName)
    map[backendName] = row.perfil_id
    map[frontName] = row.perfil_id
  }
  return map
}

/**
 * Agrupa as linhas planas de GET /admin/perfis-permissoes em RoleDef[] para a Matriz RBAC.
 */
export function mapBackendMatrixToRoles(rows: BackendRolePermissionRow[]): RoleDef[] {
  if (!Array.isArray(rows)) return []

  const grouped = new Map<
    string,
    {
      id: string
      backendPerfil: string
      descricao: string
      rawPerms: string[]
    }
  >()

  for (const row of rows) {
    if (!row || !row.perfil) continue
    const frontId = mapBackendRoleToFront(row.perfil)
    let entry = grouped.get(frontId)
    if (!entry) {
      entry = {
        id: frontId,
        backendPerfil: row.perfil,
        descricao: row.descricao || '',
        rawPerms: [],
      }
      grouped.set(frontId, entry)
    }
    if (row.permissao) {
      entry.rawPerms.push(row.permissao)
    }
  }

  return Array.from(grouped.values()).map((entry) => ({
    id: entry.id,
    nome: entry.id,
    descricao: entry.descricao,
    padrao: true,
    permissions: mapBackendPermissionsToFront(entry.rawPerms, entry.backendPerfil),
  }))
}

function formatDateTimeBr(iso?: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

export function mapBackendUserToUserItem(row: BackendUserRow, rolePermissions?: string[]): UserItem {
  const frontRole = mapBackendRoleToFront(row.perfil)
  const defaultPerms =
    rolePermissions ||
    (ROLE_DEFAULT_PERMISSIONS as Record<string, string[]>)[frontRole] ||
    []

  return {
    id: row.id,
    name: row.nome,
    email: row.email,
    role: frontRole,
    roleId: frontRole,
    permissions: [...defaultPerms],
    department: 'Corporativo',
    status: row.ativo ? 'Ativo' : 'Inativo',
    lastLogin: formatDateTimeBr(row.data_atualizacao || row.data_criacao),
    sodException: Boolean(row.excecao_sod_autorizada),
    sodJustification: row.justificativa_sod ?? undefined,
  }
}

export function mapBackendAuditLogToSecurityEvent(row: BackendAuditLogRow): SecurityEvent {
  const acao = (row.acao || '').trim().toUpperCase()
  const friendlyAction = AUDIT_ACTION_LABELS[acao] || row.acao || 'Evento de Segurança'
  const severity = AUDIT_ACTION_SEVERITY[acao] || 'INFO'

  let detailsText = row.descricao || ''
  if (row.detalhes) {
    const extra =
      typeof row.detalhes === 'string' ? row.detalhes.trim() : JSON.stringify(row.detalhes)
    if (extra && !detailsText.includes(extra)) {
      detailsText = detailsText ? `${detailsText} — ${extra}` : extra
    }
  }

  return {
    id: row.id,
    timestamp: formatDateTimeBr(row.data_hora),
    actorName: row.usuario_nome || (row.usuario_id ? `Usuário #${row.usuario_id}` : 'Sistema'),
    actorEmail: row.usuario_email || (row.ip ? `IP: ${row.ip}` : '—'),
    action: friendlyAction,
    actionCode: acao,
    details: detailsText || friendlyAction,
    severity,
    ip: row.ip ?? undefined,
    userId: row.usuario_id,
  }
}
