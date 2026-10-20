import api, { mockactive } from './api'
import {
  mockProcessDetails,
  validationChecksOk,
  treatmentChecksOk,
  analyticsDataOk,
  type ProcessLogDetails as MockProcessLogDetails,
  type ProcessStageCheck as MockProcessStageCheck,
  type ProcessAnalyticsRow as MockProcessAnalyticsRow,
} from './mocks/process.mock'

export type ProcessLogDetails = MockProcessLogDetails
export type ProcessStageCheck = MockProcessStageCheck
export type ProcessAnalyticsRow = MockProcessAnalyticsRow

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

import { mapStage, mapStatus } from './dashboard'

export const processService = {
  /**
   * Busca os detalhes completos de um processo, incluindo os checklists de
   * Validação/Tratamento e os dados analíticos de Publicação.
   *
   * API esperada: GET /api/processes/{id}
   */
  async getProcessDetails(id: string): Promise<ProcessLogDetails> {
    try {
      const res = await api.get(`/processos/${id}`)
      if (res.data) {
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

        // Fake data since backend doesn't populate these yet
        if (!res.data.validationChecks || res.data.validationChecks.length === 0) {
          res.data.validationChecks = validationChecksOk
        }
        if (!res.data.treatmentChecks || res.data.treatmentChecks.length === 0) {
          res.data.treatmentChecks = treatmentChecksOk(res.data.epsg || 'EPSG:4674')
        }
        if (!res.data.analyticsData || res.data.analyticsData.length === 0) {
          res.data.analyticsData = analyticsDataOk
        }
      }
      return res.data
    } catch (err) {
      if (mockactive) throw err
      console.warn('API indisponível, usando mock para detalhes do processo')
      await delay(600)
      const details = mockProcessDetails[id]
      if (!details) {
        return {
          id,
          dataset: 'Conjunto Desconhecido',
          stage: 'Ingestão',
          status: 'Em andamento',
          dateTime: new Date().toLocaleDateString('pt-BR'),
          layerName: `Camada ${id}`,
          source: 'Fonte Desconhecida',
          year: '2026',
          epsg: 'EPSG:4674',
          description: 'Processo não encontrado no mock. Exibindo dados padrão.',
          originalFileUrl: '#',
          mapCoordinates: [
            [-15.793, -47.882],
            [-15.793, -47.8],
            [-15.85, -47.8],
            [-15.85, -47.882],
          ],
          logs: {
            Ingestão: [`[2026-09-07 10:00:00] Iniciando processo ${id}...`],
          },
        } as ProcessLogDetails
      }

      return details
    }
  },

    async getTraceability(id: string | number): Promise<any> {
    const res = await api.get(`/indicadores/${id}/linhagem`);
    return res.data;
  },

  async iniciarProcessamento(id: string | number, nomeArquivo?: string): Promise<any> {
    try {
      const params = nomeArquivo ? { nomeArquivo } : {}
      const res = await api.post(`/processos/${id}/processar`, null, { params })
      return res.data
    } catch (err: any) {
      if (mockactive) throw err
      if (err.response && err.response.status !== 404) {
        throw err.response.data || err
      }
      console.warn('API indisponível, mockando sucesso do início de processamento')
      await delay(500)
      return { success: true }
    }
  },

  async getLogEspacial(id: string | number): Promise<any> {
    try {
      const res = await api.get(`/processos/${id}/log-espacial`)
      return res.data
    } catch (err: any) {
      if (mockactive) throw err
      if (err.response && err.response.status !== 404) {
        throw err.response.data || err
      }
      console.warn('API indisponível, mockando log espacial')
      await delay(300)
      return { type: 'FeatureCollection', features: [] }
    }
  },
}
