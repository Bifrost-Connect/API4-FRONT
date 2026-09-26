import api, { mockactive } from './api'
import { mockProcessosPage, mockMetricasResponse } from './mocks/dashboard.mock'
import { mockFilterOptions, mockAvailableEditors } from './mocks/filter.mock'

export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
}

export interface ProcessoMetricasResponse {
  totalProcessos: number
  porSituacao: Record<string, number>
  porEtapa: Record<string, number>
  porConjunto: Record<string, number>
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

export function mapStage(backendStage: string): string {
  if (!backendStage) return 'Ingestão'
  switch (backendStage) {
    case 'INGESTAO': return 'Ingestão'
    case 'TRATAMENTO': return 'Tratamento'
    case 'VALIDACAO': return 'Validação'
    case 'CALCULO_ANALITICO':
    case 'PUBLICACAO':
      return 'Publicação'
    default:
      return backendStage
  }
}

export function mapStatus(backendStatus: string): any {
  if (!backendStatus) return 'Em andamento'
  switch (backendStatus) {
    case 'CONCLUIDA': 
    case 'COM_RESSALVA':
      return 'Concluída'
    case 'EM_ANDAMENTO': return 'Em andamento'
    case 'EM_VALIDACAO': return 'Aguardando validação'
    case 'FALHOU': return 'Falhou'
    default: return backendStatus
  }
}

export function mapMetricasToSummary(metricas: ProcessoMetricasResponse): DashboardSummary[] {
  const getVal = (key: string) => metricas.porSituacao?.[key] || 0
  return [
    { title: 'TOTAL DE CARGAS', value: metricas.totalProcessos || 0, type: 'orange', iconType: 'down' },
    { title: 'CONCLUÍDAS', value: getVal('CONCLUIDA') + getVal('COM_RESSALVA') + getVal('Concluída'), type: 'success', iconType: 'check' },
    { title: 'EM ANDAMENTO', value: getVal('EM_ANDAMENTO') + getVal('Em andamento'), type: 'info', iconType: 'down' },
    { title: 'ERROS', value: getVal('FALHOU') + getVal('EM_VALIDACAO') + getVal('Falhou') + getVal('Aguardando validação'), type: 'danger', iconType: 'error' },
  ]
}

export const dashboardService = {
  async getDashboardSummary(): Promise<DashboardSummary[]> {
    try {
      const res = await api.get('/processos/metricas')
      return mapMetricasToSummary(res.data)
    } catch (err: any) {
      if (mockactive) throw err;
      if (err.response && err.response.status !== 404) {
        throw err.response.data || err;
      }
      console.warn('API indisponível (ou rota 404), usando mock para métricas')
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
      if (res.data && res.data.content) {
        res.data.content.forEach((item: any) => {
          item.stage = mapStage(item.stage)
          item.status = mapStatus(item.status)
        })
      }
      return res.data
    } catch (err: any) {
      if (mockactive) throw err;
      if (err.response && err.response.status !== 404) {
        throw err.response.data || err;
      }
      console.warn('API indisponível (ou rota 404), usando mock para processos do dashboard')
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
    // Retornando mock diretamente pois o endpoint não existe no backend ainda
    // Isso evita o erro 404 no console
    await delay(400)
    return mockFilterOptions
  },

  async getAvailableEditors(): Promise<string[]> {
    // Retornando mock diretamente pois o endpoint não existe no backend ainda
    // Isso evita o erro 404 no console
    await delay(400)
    return mockAvailableEditors
  },

  /**
   * Aloca um editor/auditor para corrigir o erro em Validação ou Tratamento.
   * O processo passa a ter status 'Em andamento' com o editor atribuído.
   */
  async assignEditor(processId: string, editorName: string): Promise<ProcessLog | null> {
    try {
      const res = await api.put(`/processos/${processId}/editor`, { editorName })
      return res.data
    } catch (err: any) {
      if (mockactive) throw err;
      if (err.response && err.response.status !== 404) {
        throw err.response.data || err;
      }
      console.warn('API indisponível (ou rota 404), usando mock para alocação de editor')
      await delay(400)
      const process = mockProcessosPage.content.find((p) => p.id === processId)
      if (process) {
        process.assignedEditor = editorName
        process.status = 'Em andamento'
        process.pauseReason = `Editor ${editorName} alocado para correção do erro na etapa de ${process.stage}.`
        
        // Update mocked metrics safely
        if (mockMetricasResponse.porSituacao) {
          mockMetricasResponse.porSituacao['Em andamento'] = (mockMetricasResponse.porSituacao['Em andamento'] || 0) + 1
          mockMetricasResponse.porSituacao['Falhou'] = Math.max(0, (mockMetricasResponse.porSituacao['Falhou'] || 0) - 1)
        }
      }
      return process || null
    }
  },
}
