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
  stage: string
  status:
    | 'Concluída'
    | 'Em andamento'
    | 'Aguardando validação'
    | 'Em validação'
    | 'Falhou'
    | 'Em quarentena'
  source?: string
  year?: string
  epsg?: string
  integrityHash?: string
  pauseReason?: string
  logs?: string[]
  quarantined?: boolean
  auditorRequested?: boolean
  assignedEditor?: string
}

export interface DashboardData {
  summary: DashboardSummary[]
  recentProcesses: ProcessLog[]
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
    case 'INGESTAO':
      return 'Ingestão'
    case 'TRATAMENTO':
      return 'Tratamento'
    case 'VALIDACAO':
      return 'Validação'
    case 'CALCULO_ANALITICO':
    case 'PUBLICACAO':
      return 'Publicação'
    default:
      return backendStage
  }
}

export function mapStatus(backendStatus: string): string {
  if (!backendStatus) return 'Em andamento'
  switch (backendStatus) {
    case 'CONCLUIDA':
    case 'COM_RESSALVA':
      return 'Concluída'
    case 'EM_ANDAMENTO':
      return 'Em andamento'
    case 'EM_VALIDACAO':
    case 'VALIDACAO':
      return 'Aguardando validação'
    case 'FALHOU':
      return 'Falhou'
    case 'EM_QUARENTENA':
      return 'Em quarentena'
    default:
      return backendStatus
  }
}

export function mapMetricasToSummary(metricas: ProcessoMetricasResponse): DashboardSummary[] {
  const getVal = (key: string) => metricas.porSituacao?.[key] || 0

  return [
    {
      title: 'TOTAL DE CARGAS',
      value: metricas.totalProcessos || 0,
      type: 'orange',
      iconType: 'down',
    },
    {
      title: 'CONCLUÍDAS',
      value: getVal('CONCLUIDA') + getVal('COM_RESSALVA') + getVal('Concluída'),
      type: 'success',
      iconType: 'check',
    },
    {
      title: 'EM ANDAMENTO',
      value: getVal('EM_ANDAMENTO') + getVal('Em andamento'),
      type: 'info',
      iconType: 'down',
    },
    {
      title: 'ERROS',
      value:
        getVal('FALHOU') +
        getVal('EM_VALIDACAO') +
        getVal('Falhou') +
        getVal('Aguardando validação'),
      type: 'danger',
      iconType: 'error',
    },
  ]
}

export const dashboardService = {
  async getDashboardSummary(): Promise<DashboardSummary[]> {
    try {
      const res = await api.get('/processos/metricas')
      return mapMetricasToSummary(res.data)
    } catch (err: any) {
      if (mockactive) throw err
      if (err.response && err.response.status !== 404) {
        throw err.response.data || err
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
      if (mockactive) throw err
      if (err.response && err.response.status !== 404) {
        throw err.response.data || err
      }
      console.warn('API indisponível (ou rota 404), usando mock para processos do dashboard')
      await delay(600)

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

  async requestAuditor(processId: string): Promise<void> {
    await api.post(`/dashboard/processes/${encodeURIComponent(processId)}/auditor`)
  },

  async getFilterOptions() {
    await delay(400)
    return mockFilterOptions
  },

  async getAvailableEditors(): Promise<string[]> {
    await delay(400)
    return mockAvailableEditors
  },

  async assignEditor(processId: string, editorName: string): Promise<ProcessLog | null> {
    try {
      const res = await api.put(`/processos/${processId}/editor`, { editorName })
      return res.data
    } catch (err: any) {
      if (mockactive) throw err
      if (err.response && err.response.status !== 404) {
        throw err.response.data || err
      }
      console.warn('API indisponível (ou rota 404), usando mock para alocação de editor')
      await delay(400)
      const process = mockProcessosPage.content.find((p) => p.id === processId)
      if (process) {
        process.assignedEditor = editorName
        process.status = 'Em andamento'
        process.pauseReason = `Editor ${editorName} alocado para correção do erro na etapa de ${process.stage}.`

        if (mockMetricasResponse.porSituacao) {
          mockMetricasResponse.porSituacao['Em andamento'] =
            (mockMetricasResponse.porSituacao['Em andamento'] || 0) + 1
          mockMetricasResponse.porSituacao['Falhou'] = Math.max(
            0,
            (mockMetricasResponse.porSituacao['Falhou'] || 0) - 1,
          )
        }
      }
      return process || null
    }
  },
}

