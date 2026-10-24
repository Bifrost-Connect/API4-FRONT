import api, { mockactive } from './api'
import { mockProcessosPage, mockMetricasResponse } from './mocks/dashboard.mock'
import { mockFilterOptions, mockAvailableEditors } from './mocks/filter.mock'
import { userService } from './user'
import { processService } from './process'

export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  source?: 'API' | 'DEMONSTRACAO'
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
    | 'Fechado'
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
  page?: number
  size?: number
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
    case 'FECHADO':
      return 'Fechado'
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
      if (!mockactive) throw err
      console.warn('API indisponível ou não autorizada, usando mock para métricas do dashboard')
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
        if (filters.etapa) params.etapaId = filters.etapa
        if (filters.situacao) params.situacaoId = filters.situacao
        if (filters.page !== undefined) params.page = filters.page
        if (filters.size !== undefined) params.size = filters.size
      }

      const res = await api.get('/processos', { params })
      if (res.data && res.data.content) {
        res.data.content.forEach((item: any) => {
          item.stage = mapStage(item.stage)
          item.status = mapStatus(item.status)
        })
      }

      return { ...res.data, source: 'API' }
    } catch (err: any) {
      if (!mockactive) throw err
      console.warn('API indisponível ou não autorizada, usando mock para processos do dashboard')
      await delay(600)

      let filteredProcesses = [...mockProcessosPage.content]

      if (filters) {
        if (filters.conjunto) {
          const option = mockFilterOptions.conjuntos.find(
            (o) => String(o.id) === String(filters.conjunto),
          )
          if (option)
            filteredProcesses = filteredProcesses.filter((p) => p.dataset === option.label)
        }
        if (filters.etapa) {
          const option = mockFilterOptions.etapas.find(
            (o) => String(o.id) === String(filters.etapa),
          )
          if (option) filteredProcesses = filteredProcesses.filter((p) => p.stage === option.label)
        }
        if (filters.situacao) {
          const option = mockFilterOptions.situacoes.find(
            (o) => String(o.id) === String(filters.situacao),
          )
          if (option) filteredProcesses = filteredProcesses.filter((p) => p.status === option.label)
        }
      }

      return {
        content: filteredProcesses,
        totalElements: filteredProcesses.length,
        totalPages: 1,
        size: mockProcessosPage.size,
        number: mockProcessosPage.number,
        source: 'DEMONSTRACAO',
      }
    }
  },

  async requestAuditor(processId: string): Promise<void> {
    const numericId = Number(String(processId).replace(/\D/g, '')) || 1
    await api.post('/notificacoes/auditor', {
      processoId: numericId,
      mensagem: `Solicitação de auditoria para o processo ${processId}`,
    })
  },

  async getFilterOptions() {
    try {
      const res = await api.get('/dominios/filtros')
      return res.data
    } catch (err) {
      if (!mockactive) {
        return { conjuntos: [], etapas: [], situacoes: [] }
      }
      console.warn('Endpoint /dominios/filtros não encontrado, usando mockFilterOptions')
      await delay(400)
      return mockFilterOptions
    }
  },

  async getAvailableEditors(): Promise<{ id: number; name: string }[]> {
    try {
      const res = await api.get('/processos/usuarios/auditores')
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        return res.data.map((u: any) => ({
          id: u.id || u.usuarioId,
          name: u.nome || u.name || 'Auditor Sem Nome',
        }))
      }
      if (!mockactive) {
        return []
      }
      return mockAvailableEditors.map((name, idx) => ({ id: idx + 1, name }))
    } catch (err: any) {
      if (!mockactive) throw err
      console.warn('API indisponível, usando mock para auditores')
      await delay(400)
      return mockAvailableEditors.map((name, idx) => ({ id: idx + 1, name }))
    }
  },

  async assignEditor(
    processId: string,
    editorId: number,
    editorName: string,
  ): Promise<ProcessLog | null> {
    try {
      const res = await api.put(`/processos/${processId}/editor`, { editorId })
      return res.data
    } catch (err: any) {
      if (!mockactive) throw err
      console.warn('API indisponível ou não autorizada, usando mock para alocação de editor')
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

  /**
   * Aprova e fecha a versão oficial permanentemente na Publicação.
   */
  async aprovarEFecharVersao(
    item: any,
    responsavelNome = userService.getCurrentUser().name,
  ): Promise<{ success: boolean }> {
    const usuarioId = userService.getCurrentUser().id

    try {
      if (/^\d+$/.test(String(item.id))) {
        await api.patch(`/indicadores/${item.id}/fechar`, null, {
          headers: { 'X-Gestor-ID': String(usuarioId) },
        })
      }
    } catch (e) {
      if (!mockactive) throw e
      console.warn('Backend /fechar indisponível, simulando fechamento local:', e)
    }

    item.decided = true
    item.decision = 'aprovado'
    item.isClosed = true
    item.status = 'Fechado'
    item.versaoOficial = item.versaoOficial || 'v1.0 Oficial'
    item.aprovador = responsavelNome
    item.dataPublicacao = new Date().toLocaleString('pt-BR')
    item.pauseReason = 'Versão oficial bloqueada e publicada no catálogo.'

    return { success: true }
  },

  /**
   * Reprova a carga exigindo parecer obrigatório e selecionando destino
   * ('reprocessar' ou 'invalidar').
   */
  async reprovarCarga(
    item: any,
    parecer: string,
    destino: 'reprocessar' | 'invalidar',
  ): Promise<{ success: boolean }> {
    if (!parecer || !parecer.trim()) {
      throw new Error('O parecer técnico é obrigatório para reprovar a carga.')
    }

    try {
      if (/^\d+$/.test(String(item.id))) {
        await api.put(`/processos/${item.id}/editor`, {
          editorId: userService.getCurrentUser().id,
        })
      }
    } catch (e) {
      console.warn('Erro ao registrar reprovação no backend, simulando localmente:', e)
    }

    item.decided = true
    item.decision = 'reprovado'
    item.rejectionReason = parecer.trim()
    item.rejectionDestino = destino

    if (destino === 'reprocessar') {
      item.status = 'Em andamento'
      item.pauseReason = `Reprovado (${item.stage || 'Publicação'}): ${parecer.trim()}. Retornado ao Operador.`
    } else {
      item.status = 'Falhou'
      item.pauseReason = `Carga invalidada permanentemente: ${parecer.trim()}.`
    }

    return { success: true }
  },

  /**
   * Exporta a versão consolidada em formato CSV ou GeoJSON.
   */
  async exportarVersao(
    itemOrId: any,
    formato: 'csv' | 'geojson',
  ): Promise<Blob> {
    const id = typeof itemOrId === 'object' ? itemOrId.id : String(itemOrId)
    const item = typeof itemOrId === 'object' ? itemOrId : null

    try {
      if (/^\d+$/.test(id)) {
        return await processService.exportIndicator(id, formato)
      }
    } catch (err) {
      if (!mockactive) throw err
      // Fallback para download local
    }

    if (!mockactive) {
      throw new Error(`Exportação oficial indisponível no backend para o processo ${id}`)
    }

    const dataset = item?.dataset || 'Conjunto Territorial'
    const safra = item?.year || '2026'
    const orgao = item?.source || 'Órgão Responsável'
    const epsg = item?.epsg || 'EPSG:4674'
    const responsavel = item?.aprovador || userService.getCurrentUser().name
    const dataPub = item?.dataPublicacao || new Date().toLocaleString('pt-BR')

    if (formato === 'csv') {
      const csvContent =
        'id,dataset,safra,orgao,epsg,status,selo,aprovador,dataPublicacao\n' +
        `"${id}","${dataset}","${safra}","${orgao}","${epsg}","Fechado","Versão Oficial Bloqueada","${responsavel}","${dataPub}"\n`
      return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    } else {
      const geojsonContent = {
        type: 'FeatureCollection',
        name: `Exportacao_Oficial_${id}`,
        metadata: {
          id,
          dataset,
          safra,
          orgao,
          epsg,
          versaoOficialBloqueada: true,
          aprovador: responsavel,
          dataPublicacao: dataPub,
        },
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-47.882, -15.793],
                  [-47.8, -15.793],
                  [-47.8, -15.85],
                  [-47.882, -15.85],
                  [-47.882, -15.793],
                ],
              ],
            },
            properties: {
              id,
              dataset,
              status: 'Fechado',
              selo: 'Versão Oficial Bloqueada',
            },
          },
        ],
      }
      return new Blob([JSON.stringify(geojsonContent, null, 2)], {
        type: 'application/geo+json;charset=utf-8;',
      })
    }
  },
}
