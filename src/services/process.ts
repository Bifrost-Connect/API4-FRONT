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

export const processService = {
  /**
   * Busca os detalhes completos de um processo, incluindo os checklists de
   * Validação/Tratamento e os dados analíticos de Publicação.
   *
   * API esperada: GET /api/processes/{id}
   *
   * Resposta esperada (JSON):
   * {
   *   "id": "string",
   *   "dataset": "string",
   *   "stage": "Ingestão" | "Validação" | "Tratamento" | "Publicação",
   *   "status": "Concluída" | "Em andamento" | "Aguardando validação" | "Falhou",
   *   "date": "string (DD/MM/YYYY)",
   *   "layerName": "string",
   *   "source": "string",
   *   "year": "string",
   *   "epsg": "string",
   *   "description": "string",
   *   "originalFileUrl": "string (URL do arquivo para download)",
   *   "mapCoordinates": [[lat, lng], ...],
   *   "logs": { "Ingestão": ["string"], "Validação": ["string"], ... },
   *   "pauseReason": "string | null",
   *   "validationChecks": [ { id, label, description, status, detail } ],
   *   "treatmentChecks":  [ { id, label, description, status, detail } ],
   *   "analyticsData":    [ { param, result, reference, status, statusLabel } ]
   * }
   */
  async getProcessDetails(id: string): Promise<ProcessLogDetails> {
    // Para chamar a API real, descomente e substitua:
    // return (await api.get(`/processes/${id}`)).data

    await delay(600)
    const details = mockProcessDetails[id]
    if (!details) {
      return {
        id,
        dataset: 'Conjunto Desconhecido',
        stage: 'Ingestão',
        status: 'Em andamento',
        date: new Date().toLocaleDateString('pt-BR'),
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
  },
}
