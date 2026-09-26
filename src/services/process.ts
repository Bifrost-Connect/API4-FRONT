import api, { mockactive } from './api'
import {
  mockProcessDetails,
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
      }
      return res.data
    } catch (err) {
      if (mockactive) throw err;
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
}
