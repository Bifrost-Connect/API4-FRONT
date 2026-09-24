import type { DashboardSummary, ProcessLog } from '../dashboard'

export interface DashboardData {
  summary: DashboardSummary[]
  recentProcesses: ProcessLog[]
}

/**
 * ==========================================
 * CONTRATO DE API ESPERADO (BACK-END)
 * ==========================================
 *
 * Rota 1: GET /api/dashboard/summary
 * Resposta:
 * - Status 200 OK
 * - Corpo: Array de { title: string, value: number, type: string, iconType: string }
 *
 * Rota 2: GET /api/dashboard/processes
 * Query params opcionais: ?dateBeggin=&dateEnd=&conjunto=&etapa=&situacao=
 * Resposta:
 * - Status 200 OK
 * - Corpo: Array de ProcessLog:
 *   {
 *     id: string,          // ex: "#993A-B12"
 *     dateTime: string,    // ex: "07/09 13:00"
 *     dataset: string,     // nome do conjunto de dados
 *     stage: string,       // "Ingestão" | "Validação" | "Tratamento" | "Publicação"
 *     status: string,      // "Concluída" | "Em andamento" | "Aguardando validação" | "Falhou"
 *     source?: string,     // fonte/órgão emissor
 *     year?: string,       // ano base
 *     epsg?: string,       // código EPSG
 *     pauseReason?: string // mensagem de erro/quarentena (apenas se Falhou ou Aguardando validação)
 *   }
 *
 * NOTA: integrityHash NÃO é retornado pela API do dashboard.
 * Ele é exibido apenas na tela de detalhes (GET /api/processes/{id}) — etapa de Ingestão.
 *
 * Rota 3: GET /api/filters
 * Resposta:
 * - Status 200 OK
 * - Corpo: { conjuntos: [{id, label}], etapas: [{id, label}], situacoes: [{id, label}] }
 */

export const mockDashboardData: DashboardData = {
  summary: [
    { title: 'CARGAS HOJE', value: 8, type: 'orange', iconType: 'down' },
    { title: 'CONCLUÍDAS', value: 2, type: 'success', iconType: 'check' },
    { title: 'EM VALIDAÇÃO', value: 1, type: 'warning', iconType: 'warning' },
    { title: 'FALHAS', value: 2, type: 'danger', iconType: 'error' },
  ],
  recentProcesses: [
    {
      // STATUS: Concluída — processo que passou por todas as etapas com sucesso
      id: '#993A-B12',
      dateTime: '07/09 13:00',
      dataset: 'Imóveis rurais',
      stage: 'Publicação',
      status: 'Concluída',
      source: 'IBGE',
      year: '2023',
      epsg: 'EPSG:4674 (US01)',
    },
    {
      // STATUS: Em andamento — processo em processamento automático (Tratamento)
      id: '#994C-F88',
      dateTime: '07/09 12:45',
      dataset: 'Malha municipal',
      stage: 'Tratamento',
      status: 'Em andamento',
      source: 'Prefeitura Municipal',
      year: '2022',
      epsg: 'EPSG:31983 (US04)',
    },
    {
      // STATUS: Aguardando validação — processo parado em quarentena por erro detectado
      id: '#995X-Z01',
      dateTime: '07/09 11:30',
      dataset: 'Reserva legal',
      stage: 'Validação',
      status: 'Aguardando validação',
      source: 'Órgão Estadual ABC',
      year: '2023',
      epsg: 'EPSG:4674 (US01)',
      pauseReason: 'Sobreposição detectada no polígono 45.',
    },
    {
      // STATUS: Falhou — erro crítico na etapa de Ingestão (arquivo inválido)
      id: '#996R-T55',
      dateTime: '07/09 10:15',
      dataset: 'Uso e cobertura do solo',
      stage: 'Ingestão',
      status: 'Falhou',
      source: 'MapBiomas',
      year: '2021',
      epsg: 'EPSG:4326',
      pauseReason: 'Erro de integridade geométrica no arquivo shapefile.',
    },
    {
      // STATUS: Em andamento — aguardando auditoria na etapa de Publicação
      id: '#881A-B01',
      dateTime: '07/09 09:30',
      dataset: 'APP_hidrografica',
      stage: 'Publicação',
      status: 'Em andamento',
      source: 'ANA',
      year: '2023',
      epsg: 'EPSG:4674 (US01)',
    },
    {
      // STATUS: Falhou — erro crítico na etapa de Tratamento
      id: '#882A-C02',
      dateTime: '07/09 08:45',
      dataset: 'Imóveis rurais',
      stage: 'Tratamento',
      status: 'Falhou',
      source: 'INCRA',
      year: '2022',
      epsg: 'EPSG:31983 (US04)',
      pauseReason: 'Falha na correção topológica. Auto-interseções irreparáveis.',
    },
    {
      // STATUS: Concluída — processo validado aguardando próximo step
      id: '#883X-Z03',
      dateTime: '07/09 08:15',
      dataset: 'Reserva legal',
      stage: 'Validação',
      status: 'Concluída',
      source: 'Órgão Ambiental DEF',
      year: '2021',
      epsg: 'EPSG:4674 (US01)',
    },
    {
      // STATUS: Em andamento — ingestão do arquivo pesado ocorrendo
      id: '#884R-T04',
      dateTime: '07/09 08:00',
      dataset: 'Malha municipal',
      stage: 'Ingestão',
      status: 'Em andamento',
      source: 'IBGE',
      year: '2022',
      epsg: 'EPSG:4326',
    },
  ],
}

export const mockFilterOptions = {
  conjuntos: [
    { id: 'imoveis', label: 'Imóveis rurais' },
    { id: 'malha', label: 'Malha municipal' },
    { id: 'reserva', label: 'Reserva legal' },
    { id: 'uso_solo', label: 'Uso e cobertura do solo' },
  ],
  etapas: [
    { id: 'ingestao', label: 'Ingestão' },
    { id: 'validacao', label: 'Validação' },
    { id: 'tratamento', label: 'Tratamento' },
    { id: 'publicacao', label: 'Publicação' },
  ],
  situacoes: [
    { id: 'concluida', label: 'Concluída' },
    { id: 'andamento', label: 'Em andamento' },
    { id: 'validacao', label: 'Aguardando validação' },
    { id: 'falhou', label: 'Falhou' },
  ],
}
