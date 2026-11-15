/**
 * Contratos TypeScript para Gestão de Chaves de API e Logs de Acesso Externo (US12).
 * Espelha as tabelas V39 (chaves_api) e V40 (log_acessos_api_externa) do API4-BACK.
 */

export type ApiKeyStatus = 'ATIVA' | 'REVOGADA' | 'EXPIRADA'

export interface ApiKeyRecord {
  id: number
  usuario_id: number
  nome_parceiro: string
  prefixo_chave: string
  hash_chave_sha256?: string
  escopos: string[]
  status: ApiKeyStatus
  data_criacao: string
  data_expiracao: string | null
  data_revogacao: string | null
  usuario_revogacao_id?: number | null
  ultimo_uso_em: string | null
}

export interface CreateApiKeyDto {
  nome_parceiro: string
  escopos: string[]
  data_expiracao?: string | null
  usuario_id?: number
}

export interface CreateApiKeyResult {
  key: ApiKeyRecord
  rawSecret: string
}

export interface ExternalApiAccessLog {
  id: number
  chave_api_id: number
  rota_acessada: string
  status_http: number
  ip_origem: string
  data_acesso: string
}

export interface ApiKeyFilters {
  search?: string
  status?: '' | ApiKeyStatus
}

export interface ExternalLogFilters {
  search?: string
  statusGroup?: '' | '2xx' | '4xx' | '5xx'
}

export interface ApiKeyScopeOption {
  code: string
  label: string
}

export const API_KEY_AVAILABLE_SCOPES: readonly ApiKeyScopeOption[] = [
  { code: 'CATALOGO_CONSULTAR', label: 'Consultar Catálogo de Bases' },
  { code: 'MAPA_CONSULTAR', label: 'Consultar Camadas no Mapa' },
  { code: 'LINHAGEM_CONSULTAR', label: 'Consultar Linhagem de Dados' },
  { code: 'DOMINIO_CONSULTAR', label: 'Consultar Domínios Territoriais' },
  { code: 'PUBLICACAO_CONSULTAR', label: 'Consultar Versões Publicadas' },
  { code: 'ANALISE_EXECUTAR', label: 'Executar Análises Territoriais' },
]
