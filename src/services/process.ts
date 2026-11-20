/**
 * Serviço de Gerenciamento e Detalhes de Processos de Carga.
 * Todas as requisições utilizam a API REST do backend (/processos/*, /calculos/*).
 */
import api from './api'
import { dashboardService, mapStage, mapStatus } from './dashboard'
import { uploadService } from './upload'

/** Item de checklist retornado pela API para as etapas de Validação e Tratamento */
export interface ProcessStageCheck {
  id: string
  label: string
  description: string
  status: 'success' | 'error' | 'pending'
  detail: string
}

/** Linha de resultado analítico retornada pela API para a etapa de Publicação */
export interface ProcessAnalyticsRow {
  param: string
  result: string
  reference: string
  status: 'success' | 'error' | 'warning'
  statusLabel: string
}

export interface QuarantineRecord {
  recordId: string
  motivo: string
  etapaOrigem: string
  execucaoId: string
  dataRejeicao: string
  campo: string
  valorEncontrado: string
  valorEsperado: string
}

export interface ProcessLogDetails {
  id: string
  dataSource?: 'API'
  dataset: string
  stage: string
  status: 'Concluída' | 'Em andamento' | 'Aguardando validação' | 'Em quarentena' | 'Falhou' | 'Fechado'
  dateTime: string
  layerName: string
  source: string
  year: string
  epsg: string
  epsgDetected?: string
  description: string
  competencia?: string
  formato?: string
  classificacaoAcesso?: string
  coberturaEspacial?: string
  coberturaTemporalInicio?: string
  coberturaTemporalFim?: string
  integrityHash?: string
  originalFileUrl: string
  mapCoordinates: [number, number][]
  logs: Record<string, string[]>
  pauseReason?: string
  assignedEditor?: string
  validationChecks?: ProcessStageCheck[]
  treatmentChecks?: ProcessStageCheck[]
  analyticsData?: ProcessAnalyticsRow[]
  quarantineRecords?: QuarantineRecord[]
}

export interface ProcessTraceability {
  indicadorId: number
  processoId: number
  arquivoOriginalId: number
  nomeArquivoOriginal: string
  hashSha256: string
  parametrosProcessamento: string
  dataCarga: string
}

export type IndicatorExportFormat = 'geojson' | 'csv'

export const processService = {
  /**
   * Busca os detalhes completos de um processo, incluindo os checklists de
   * Validação/Tratamento e os dados analíticos de Publicação.
   *
   * API esperada: GET /api/processos/{id}
   */
  async getProcessDetails(id: string): Promise<ProcessLogDetails> {
    const res = await api.get(`/processos/${id}`)
    if (res.data) {
      res.data.dataSource = 'API'
      res.data.stage = mapStage(res.data.stage)
      res.data.status = mapStatus(res.data.status)
      const baseURL = api.defaults.baseURL || 'http://localhost:8080'
      res.data.originalFileUrl = `${baseURL}/carga/download/${id}`

      if (res.data.logs && typeof res.data.logs === 'object') {
        const normalizedLogs: Record<string, string[]> = {}
        for (const [key, val] of Object.entries(res.data.logs)) {
          const mappedKey = mapStage(key)
          normalizedLogs[mappedKey] = [
            ...(normalizedLogs[mappedKey] || []),
            ...(Array.isArray(val) ? (val as string[]) : []),
          ]
        }
        res.data.logs = normalizedLogs
      }

      if (!Array.isArray(res.data.validationChecks)) {
        res.data.validationChecks = []
      }
      if (!Array.isArray(res.data.treatmentChecks)) {
        res.data.treatmentChecks = []
      }

      // Integração com cálculo analítico real do backend (/carga/{id}/calculos - US06)
      if (!res.data.analyticsData || res.data.analyticsData.length === 0) {
        if (/^\d+$/.test(id)) {
          try {
            const calculosRes = await api.get(`/carga/${id}/calculos`)
            const calculos = calculosRes.data
            if (calculos && calculos.areaTotalHectares !== undefined) {
              const totalAppHa = calculos.totaisPorCategoria?.APP?.hectares ?? 0
              const qtdApp = calculos.totaisPorCategoria?.APP?.quantidade ?? 0
              const totalRlHa = calculos.totaisPorCategoria?.RESERVA_LEGAL?.hectares ?? 0
              const qtdRl = calculos.totaisPorCategoria?.RESERVA_LEGAL?.quantidade ?? 0
              const totalAlertaHa = calculos.totaisPorCategoria?.ALERTA?.hectares ?? 0
              const qtdAlerta = calculos.totaisPorCategoria?.ALERTA?.quantidade ?? 0

              res.data.analyticsData = [
                {
                  param: 'Cálculo de Área Total Contínua',
                  result: `${Number(calculos.areaTotalHectares).toLocaleString('pt-BR')} ha`,
                  reference: `${calculos.poligonosCalculados || 0} feição(ões)`,
                  status: 'success',
                  statusLabel: 'Calculado',
                },
                {
                  param: 'Proporção de Reserva Legal',
                  result: `${totalRlHa} ha (${qtdRl} cruzamento(s))`,
                  reference: 'Camada de Referência INCRA/INCAR',
                  status: qtdRl > 0 ? 'success' : 'warning',
                  statusLabel: qtdRl > 0 ? 'Regular' : 'Não identificada',
                },
                {
                  param: 'Área de APP Hídrica',
                  result: `${totalAppHa} ha (${qtdApp} interseção(ões))`,
                  reference: 'Art. 4º — Lei 12.651/2012',
                  status: 'success',
                  statusLabel: qtdApp > 0 ? 'Conforme' : 'Sem sobreposição',
                },
                {
                  param: 'Sobreposição com Áreas Embargadas / Alertas',
                  result: `${totalAlertaHa} ha (${qtdAlerta} alerta(s))`,
                  reference: 'Cadastro IBAMA / INPE',
                  status: qtdAlerta > 0 ? 'danger' : 'success',
                  statusLabel: qtdAlerta > 0 ? 'Alerta Crítico' : 'Sem alertas',
                },
              ]
            } else {
              res.data.analyticsData = []
            }
          } catch {
            res.data.analyticsData = []
          }
        } else {
          res.data.analyticsData = []
        }
      }
    }
    return res.data
  },

  async getTraceability(id: string | number): Promise<ProcessTraceability> {
    const res = await api.get<ProcessTraceability>(`/indicadores/${encodeURIComponent(id)}/linhagem`)
    return res.data
  },

  async exportIndicator(id: string | number, format: IndicatorExportFormat): Promise<Blob> {
    const res = await api.get(`/indicadores/${encodeURIComponent(id)}/exportar`, {
      params: { formato: format },
      responseType: 'blob',
    })
    return res.data as Blob
  },

  async iniciarProcessamento(id: string | number, nomeArquivo?: string): Promise<any> {
    const params = nomeArquivo ? { nomeArquivo } : {}
    const res = await api.post(`/processos/${id}/processar`, null, { params })
    return res.data
  },

  async getLogEspacial(id: string | number): Promise<any> {
    const res = await api.get(`/processos/${id}/log-espacial`)
    return res.data
  },

  async registrarDecisaoGestor(
    id: string | number,
    payload: {
      gestorId: number
      etapa: 'VALIDACAO' | 'TRATAMENTO' | 'PUBLICACAO'
      decisao: 'APROVADO' | 'REPROVADO'
      parecer?: string
    },
  ): Promise<any> {
    const cleanId = encodeURIComponent(String(id))
    const res = await api.post(`/carga/${cleanId}/decisao-gestor`, payload)
    return res.data
  },

  async alocarAuditor(
    id: string | number,
    auditorId: number,
    gestorId: number,
  ): Promise<any> {
    const res = await api.post(`/carga/${id}/alocar-auditor`, { auditorId, gestorId })
    return res.data
  },

  async getAuditores(): Promise<Array<{ id: number; nome: string; email: string }>> {
    const res = await api.get('/carga/auditores')
    if (res.data && Array.isArray(res.data)) {
      return res.data
    }
    return []
  },

  async getDecisoesGestor(id: string | number): Promise<Array<{
    id: number
    processoId: number | string
    gestorId: number
    gestorNome?: string
    etapa: 'VALIDACAO' | 'TRATAMENTO' | 'PUBLICACAO'
    decisao: 'APROVADO' | 'REPROVADO'
    parecer?: string
    dataDecisao: string
  }>> {
    const cleanId = encodeURIComponent(String(id))
    const res = await api.get(`/carga/${cleanId}/decisoes-gestor`)
    return Array.isArray(res.data) ? res.data : []
  },

  async signalQuarantineReprocess(id: string | number): Promise<{ simulated: false }> {
    const numericId = Number(String(id).replace(/\D/g, ''))
    if (numericId) {
      await uploadService.notificarOperadorQuarentena(numericId)
    } else {
      await dashboardService.requestAuditor(String(id))
    }
    return { simulated: false }
  },

  async exportQuarantineReport(
    id: string | number,
    format: 'csv' | 'json',
    records: QuarantineRecord[],
  ): Promise<{ blob: Blob; filename: string; isOfficial: boolean }> {
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('Não foi possível exportar: o relatório de motivos de rejeição está vazio para esta carga.')
    }

    const numericId = Number(String(id).replace(/\D/g, ''))
    if (format === 'csv') {
      if (!numericId) {
        throw new Error('Identificador numérico da carga é obrigatório para exportar rejeições em CSV.')
      }
      const blob = await uploadService.exportarRejeicoesCsv(numericId)
      return {
        blob,
        filename: `rejeicoes_carga_${numericId}.csv`,
        isOfficial: true,
      }
    }

    const jsonBlob = new Blob([JSON.stringify(records, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    return {
      blob: jsonBlob,
      filename: `rejeicoes_carga_${numericId || id}.json`,
      isOfficial: true,
    }
  },

  async reprocessQuarantineLoad(id: string | number, file: File): Promise<{ simulated: false }> {
    const numericId = Number(String(id).replace(/\D/g, ''))
    if (!numericId) {
      throw new Error('Identificador numérico da carga é obrigatório para reprocessamento.')
    }
    await uploadService.reprocessarCarga(numericId, file)
    return { simulated: false }
  },

  async cancelQuarantineLoad(id: string | number, justification: string): Promise<{ simulated: false }> {
    const numericId = Number(String(id).replace(/\D/g, ''))
    if (!numericId) {
      throw new Error('Identificador numérico da carga é obrigatório para cancelamento.')
    }
    await uploadService.cancelarCarga(numericId, justification)
    return { simulated: false }
  },

  async publishAndCloseVersion(
    id: string | number,
    payload: { gestorId: number; parecer?: string },
    closeVersionFn: () => Promise<unknown>,
  ): Promise<{ simulated: false }> {
    if (/^\d+$/.test(String(id))) {
      await this.registrarDecisaoGestor(id, {
        gestorId: payload.gestorId,
        etapa: 'PUBLICACAO',
        decisao: 'APROVADO',
        parecer: payload.parecer,
      })
    }

    await closeVersionFn()
    return { simulated: false }
  },
}
