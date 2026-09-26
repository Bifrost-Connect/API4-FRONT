import api from './api'
import { mockProcessosPage, mockMetricasResponse, mockFilterOptions, mockAvailableEditors } from './mocks/dashboard.mock'

export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
}

export interface ProcessoMetricasResponse {
  total: number
  concluidas: number
  emAndamento: number
  erros: number
}

export interface DashboardSummary {
  title: string
  value: number
  type: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'orange'
  iconType: 'down' | 'check' | 'warning' | 'error'
}

export interface ProcessLog {
  id: string
  dateTime: string
  dataset: string
  /** "Ingestão" | "Validação" | "Tratamento" | "Publicação" */
  stage: string
  status: 'Concluída' | 'Em andamento' | 'Aguardando validação' | 'Falhou'
  source?: string
  year?: string
  epsg?: string
  /** Motivo de pausa/quarentena — presente se houver erro em Validação/Tratamento ou estiver em correção */
  pauseReason?: string
  /** Editor/auditor alocado para corrigir erro de validação ou tratamento */
  assignedEditor?: string
  // NOTA: integrityHash não é exposto no dashboard.
  // É retornado apenas por GET /api/processes/{id} e exibido na etapa de Ingestão.
}

export interface DashboardFilters {
  dateBegin?: string
  dateEnd?: string
  conjunto?: string
  etapa?: string
  situacao?: string
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function mapMetricasToSummary(metricas: ProcessoMetricasResponse): DashboardSummary[] {
  return [
    { title: 'TOTAL DE CARGAS', value: metricas.total, type: 'orange', iconType: 'down' },
    { title: 'CONCLUÍDAS', value: metricas.concluidas, type: 'success', iconType: 'check' },
    { title: 'EM ANDAMENTO', value: metricas.emAndamento, type: 'info', iconType: 'down' },
    { title: 'ERROS', value: metricas.erros, type: 'danger', iconType: 'error' },
  ]
}

export const dashboardService = {
  async getDashboardSummary(): Promise<DashboardSummary[]> {
    try {
      const res = await api.get('/processos/metricas')
      return mapMetricasToSummary(res.data)
    } catch (err) {
      console.warn('API indisponível, usando mock para métricas')
      await delay(400)
      return mapMetricasToSummary(mockMetricasResponse)
    }
  },

  async getDashboardProcesses(filters?: DashboardFilters): Promise<Page<ProcessLog>> {
    try {
      const params: any = {}
      if (filters) {
        if (filters.dateBegin) params.dataInicio = filters.dateBegin
        if (filters.dateEnd) params.dataFim = filters.dateEnd
        if (filters.conjunto) params.conjuntoId = filters.conjunto
        if (filters.etapa) params.etapa = filters.etapa
        if (filters.situacao) params.situacao = filters.situacao
      }
      const res = await api.get('/processos', { params })
      return res.data
    } catch (err) {
      console.warn('API indisponível, usando mock para processos do dashboard')
      await delay(600)

      // Simulate filtering on mock data
      let filteredProcesses = [...mockProcessosPage.content]

      if (filters) {
        if (filters.conjunto) {
          const option = mockFilterOptions.conjuntos.find((o) => o.id === filters.conjunto)
          if (option) filteredProcesses = filteredProcesses.filter((p) => p.dataset === option.label)
        }
        if (filters.etapa) {
          const option = mockFilterOptions.etapas.find((o) => o.id === filters.etapa)
          if (option) filteredProcesses = filteredProcesses.filter((p) => p.stage === option.label)
        }
        if (filters.situacao) {
          const option = mockFilterOptions.situacoes.find((o) => o.id === filters.situacao)
          if (option) filteredProcesses = filteredProcesses.filter((p) => p.status === option.label)
        }
      }

      return {
        content: filteredProcesses,
        totalElements: filteredProcesses.length,
        totalPages: 1,
        size: mockProcessosPage.size,
        number: mockProcessosPage.number,
      }
    }
  },

  async getFilterOptions() {
    try {
      const res = await api.get('/api/v1/dominios/processos')
      return res.data
    } catch (err) {
      console.warn('API indisponível, usando mock para opções de filtro')
      await delay(400)
      return mockFilterOptions
    }
  },

  async getAvailableEditors(): Promise<string[]> {
    try {
      const res = await api.get('/api/v1/usuarios?perfil=EDITOR')
      return res.data
    } catch (err) {
      console.warn('API indisponível, usando mock para editores')
      await delay(400)
      return mockAvailableEditors
    }
  },

  /**
   * Aloca um editor/auditor para corrigir o erro em Validação ou Tratamento.
   * O processo passa a ter status 'Em andamento' com o editor atribuído.
   */
  async assignEditor(processId: string, editorName: string): Promise<ProcessLog | null> {
    try {
      const res = await api.put(`/processos/${processId}/editor`, { editorName })
      return res.data
    } catch (err) {
      console.warn('API indisponível, usando mock para alocação de editor')
      await delay(400)
      const process = mockProcessosPage.content.find((p) => p.id === processId)
      if (process) {
        process.assignedEditor = editorName
        process.status = 'Em andamento'
        process.pauseReason = `Editor ${editorName} alocado para correção do erro na etapa de ${process.stage}.`
        
        // Update mocked metrics
        mockMetricasResponse.emAndamento++
        mockMetricasResponse.erros--
      }
      return process || null
    }
  },
}
