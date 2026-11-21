/**
 * Serviço de Upload e Ingestão de Cargas Geoespaciais.
 * Todas as operações utilizam a API REST do backend (/carga/*, /dominios/*).
 */
import api from './api'

export interface FormatoConfig {
  extensions: string[]
  label: string
  tag: string
}

export interface UploadFormOptions {
  anos: string[]
  epsgs: { id: string; label: string }[]
  orgaos: { id: string | number; label: string }[]
  conjuntos: { id: string | number; label: string }[]
}

export type TipoProtocoloConector = 'OGC_WFS' | 'HTTP_DIRECT' | 'GOOGLE_DRIVE' | 'ARCGIS_REST'
export type DestinoConector = 'CARGA' | 'REFERENCIA'
export type FormatoDadosConector = 'SHAPE-ZIP' | 'GEOJSON' | 'CSV' | 'GPKG'
export type TipoAutenticacaoConector =
  | 'NONE'
  | 'API_KEY_HEADER'
  | 'API_KEY_QUERY'
  | 'BEARER_TOKEN'
  | 'BASIC_AUTH'
  | 'SERVICE_ACCOUNT_JSON'
export type PeriodicidadeConector = 'MANUAL' | 'HORARIA' | 'DIARIA' | 'SEMANAL' | 'MENSAL' | 'CRON'
export type EtapaIngestaoUi = 'PENDENTE' | 'BAIXANDO' | 'PROCESSANDO_POSTGIS' | 'CONCLUIDO' | 'ERRO'

export interface ConectorTemplate {
  codigo: string
  nome: string
  descricao: string
  tipoProtocolo: TipoProtocoloConector
  urlBase: string
  destino: DestinoConector
  fonteReferencia: string | null
  nomeCamadaExibicao: string | null
  formatoDados: FormatoDadosConector
  epsgOrigem: string
  colunaIdentificador: string
  parametrosJson: Record<string, unknown>
  tipoAutenticacao: TipoAutenticacaoConector
  nomeCredencial: string | null
  periodicidade: PeriodicidadeConector
}

export interface ConectorFonteDados {
  id: number
  nome: string
  descricao: string | null
  tipoProtocolo: TipoProtocoloConector
  urlBase: string
  destino: DestinoConector
  fonteReferencia: string | null
  nomeCamadaExibicao: string | null
  orgaoId: number | null
  orgaoSigla: string | null
  conjuntoId: number | null
  conjuntoNome: string | null
  formatoDados: FormatoDadosConector
  epsgOrigem: string
  colunaIdentificador: string
  parametrosJson: Record<string, unknown>
  tipoAutenticacao: TipoAutenticacaoConector
  nomeCredencial: string | null
  prefixoCredencial: string | null
  possuiCredencial: boolean
  periodicidade: PeriodicidadeConector
  expressaoCron: string | null
  ativo: boolean
  ultimaExecucaoEm: string | null
  proximaExecucaoEm: string | null
  ultimoStatus: string | null
  criadoPorId: number | null
  dataCriacao: string | null
  dataAtualizacao: string | null
}

export interface ConectorFontePayload {
  nome: string
  descricao?: string | null
  tipoProtocolo: TipoProtocoloConector
  urlBase: string
  destino: DestinoConector
  fonteReferencia?: string | null
  nomeCamadaExibicao?: string | null
  orgaoId?: number | null
  conjuntoId?: number | null
  formatoDados: FormatoDadosConector
  epsgOrigem?: string | null
  colunaIdentificador?: string | null
  parametrosJson?: Record<string, unknown>
  tipoAutenticacao: TipoAutenticacaoConector
  nomeCredencial?: string | null
  credencial?: string | null
  periodicidade: PeriodicidadeConector
  expressaoCron?: string | null
  ativo?: boolean
}

export interface TesteConexaoResponse {
  sucesso: boolean
  statusHttp: number | null
  mensagem: string
  tempoMs: number
}

export interface IngestaoExecucaoItem {
  id: number
  conectorId: number | null
  conectorNome: string | null
  dagRunId: string | null
  nomeArquivo: string | null
  driveCaminho: string | null
  destino: string | null
  fonte: string | null
  statusBanco: string | null
  etapaUi: EtapaIngestaoUi
  processoId: number | null
  etapaProcesso: string | null
  situacaoProcesso: string | null
  linhasCarregadas: number | null
  linhasDescartadas: number | null
  tamanhoBytes: number | null
  hashSha256: string | null
  md5Drive: string | null
  mensagem: string | null
  dataInicio: string | null
  dataFim: string | null
  duracaoSegundos: number | null
}

export const UPLOAD_FORMATO_OPTIONS = ['GeoJSON', 'Shapefile (ZIP)', 'CSV', 'GeoPackage', 'KML']
export const UPLOAD_CLASSIFICACAO_OPTIONS = ['Público', 'Restrito', 'Confidencial']

export const UPLOAD_FORMATO_CONFIG_MAP: Record<string, FormatoConfig> = {
  GeoJSON: {
    extensions: ['.geojson', '.json'],
    label: 'GeoJSON (.geojson, .json)',
    tag: '.geojson, .json',
  },
  'Shapefile (ZIP)': {
    extensions: ['.zip'],
    label: 'Shapefile compactado (.zip)',
    tag: '.zip (Shapefile)',
  },
  CSV: {
    extensions: ['.csv'],
    label: 'Tabela delimitada (.csv)',
    tag: '.csv',
  },
  GeoPackage: {
    extensions: ['.gpkg'],
    label: 'GeoPackage (.gpkg)',
    tag: '.gpkg',
  },
  KML: {
    extensions: ['.kml', '.kmz'],
    label: 'Keyhole Markup Language (.kml, .kmz)',
    tag: '.kml, .kmz',
  },
}

export const uploadService = {
  async cadastrarMetadados(payload: Record<string, any>): Promise<any> {
    const backendPayload = {
      operadorId: payload.operadorId || 1,
      orgaoId: parseInt(payload.orgaoEmissor) || 1,
      conjuntoId: parseInt(payload.conjuntoDados) || 1,
      anoSafra: String(payload.anoReferencia || '2026').trim(),
      epsgOrigem: String(payload.epsg || '4674').replace(/\D/g, '') || '4674',
      competencia: payload.competencia,
      formato: payload.formato,
      classificacaoAcesso: payload.classificacaoAcesso,
      coberturaEspacial: payload.coberturaEspacial,
      coberturaTemporalInicio: payload.coberturaTemporalInicio || undefined,
      coberturaTemporalFim: payload.coberturaTemporalFim || undefined,
    }
    const res = await api.post('/carga/metadados', backendPayload)
    return res.data
  },

  async uploadArquivo(
    processoId: number,
    file: File,
    usuarioId?: number,
  ): Promise<any> {
    const formData = new FormData()
    formData.append('processoId', processoId.toString())
    formData.append('file', file)
    if (usuarioId) {
      formData.append('usuarioId', usuarioId.toString())
    }

    const res = await api.post('/carga/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return res.data
  },

  /**
   * Busca as opções dinâmicas para preenchimento do formulário (anos, epsg, conjuntos, órgãos)
   */
  async getUploadOptions() {
    try {
      const res = await api.get('/dominios/carga')
      if (res.data) {
        return res.data
      }
      return { anos: [], epsgs: [], conjuntos: [], orgaos: [] }
    } catch {
      return { anos: [], epsgs: [], conjuntos: [], orgaos: [] }
    }
  },

  async downloadArquivoOriginal(processoId: number): Promise<Blob> {
    try {
      const res = await api.get(`/carga/download/${processoId}`, {
        responseType: 'blob',
      })
      return res.data
    } catch (err: any) {
      throw err.response?.data || err
    }
  },

  async reprocessarCarga(
    processoId: number,
    file: File,
    usuarioId?: number,
  ): Promise<any> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (usuarioId) {
        formData.append('usuarioId', usuarioId.toString())
      }
      const res = await api.post(`/carga/${processoId}/reprocessar`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return res.data
    } catch (err: any) {
      throw err.response?.data || err
    }
  },

  async cancelarCarga(
    processoId: number,
    motivo: string,
    usuarioId?: number,
  ): Promise<void> {
    const params: Record<string, any> = {}
    if (usuarioId) params.usuarioId = usuarioId
    await api.patch(
      `/carga/${processoId}/cancelar`,
      { motivo },
      { params },
    )
  },

  async notificarOperadorQuarentena(
    processoId: number,
    usuarioId?: number,
  ): Promise<void> {
    const params: Record<string, any> = {}
    if (usuarioId) params.usuarioId = usuarioId
    await api.post(`/carga/${processoId}/quarentena/notificar-operador`, null, {
      params,
    })
  },

  async exportarRejeicoesCsv(processoId: number): Promise<Blob> {
    const res = await api.get(`/carga/${processoId}/rejeicoes/exportar`, {
      responseType: 'blob',
    })
    return res.data
  },

  async importarReferenciasGeoespaciais(
    fonte?: string,
    limitePorFonte: number = 5000,
  ): Promise<any> {
    const res = await api.post('/carga/referencias/importar', null, {
      params: { fonte, limitePorFonte },
    })
    return res.data
  },

  async listarTemplatesConectores(): Promise<ConectorTemplate[]> {
    const res = await api.get<ConectorTemplate[]>('/conectores/templates')
    return res.data
  },

  async listarConectores(): Promise<ConectorFonteDados[]> {
    const res = await api.get<ConectorFonteDados[]>('/conectores')
    return res.data
  },

  async criarConector(payload: ConectorFontePayload): Promise<ConectorFonteDados> {
    const res = await api.post<ConectorFonteDados>('/conectores', payload)
    return res.data
  },

  async atualizarConector(id: number, payload: ConectorFontePayload): Promise<ConectorFonteDados> {
    const res = await api.put<ConectorFonteDados>(`/conectores/${id}`, payload)
    return res.data
  },

  async alternarAtivoConector(id: number, ativo: boolean): Promise<ConectorFonteDados> {
    const res = await api.patch<ConectorFonteDados>(`/conectores/${id}/ativo`, { ativo })
    return res.data
  },

  async excluirConector(id: number): Promise<void> {
    await api.delete(`/conectores/${id}`)
  },

  async testarConector(id: number): Promise<TesteConexaoResponse> {
    const res = await api.post<TesteConexaoResponse>(`/conectores/${id}/testar`)
    return res.data
  },

  async executarConector(
    id: number,
    payload?: { parametrosOverride?: Record<string, unknown>; forcarReprocessamento?: boolean },
  ): Promise<IngestaoExecucaoItem> {
    const res = await api.post<IngestaoExecucaoItem>(`/conectores/${id}/executar`, payload ?? {})
    return res.data
  },

  async listarExecucoesIngestao(params?: {
    conectorId?: number
    destino?: string
    status?: string
    limit?: number
  }): Promise<IngestaoExecucaoItem[]> {
    const res = await api.get<IngestaoExecucaoItem[]>('/conectores/execucoes', { params })
    return res.data
  },
}
