/**
 * Definições de tipos e interfaces para o Catálogo de Bases Geoespaciais.
 */

export type CatalogoStatus =
  | 'Concluída'
  | 'Disponível'
  | 'Em andamento'
  | 'Em validação'
  | 'Com ressalva'
  | 'Falhou'
  | 'Fechado'
  | 'Aguardando validação'
  | 'Em quarentena'

export interface CatalogoItem {
  id: string | number
  dataset: string
  stage: string
  status: string
  source: string
  year: string
  competencia?: string
  versao_oficial?: string
  data_publicacao?: string
  epsg?: string
  total_feicoes?: number
  classificacao_acesso?: string
  cobertura_espacial?: string
  cobertura_temporal?: string
  tamanho_arquivo?: string
  hash_integridade?: string
  previa_atributos?: Record<string, any>[]
  quarantined?: boolean
  pauseReason?: string
  assignedEditor?: string
}

export interface CatalogoKpis {
  totalCarregadas: number
  prontasConsulta: number
  emProcessamento: number
  historicasCongeladas: number | string
}

export type ViewMode = 'grid' | 'table'

export type CatalogoSortOption =
  | 'data_desc'
  | 'data_asc'
  | 'safra_desc'
  | 'safra_asc'
  | 'nome_asc'
  | 'nome_desc'
  | 'registros_desc'
