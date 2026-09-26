import type { DashboardSummary, ProcessLog, Page, ProcessoMetricasResponse } from '../dashboard'

export const mockProcessosPage: Page<ProcessLog> = {
  content: [
    {
      // STATUS: Concluída — processo finalizado e publicado na base de produção
      id: '#993A-B12',
      dateTime: '07/09 13:00',
      dataset: 'Imóveis rurais',
      stage: 'Publicação',
      status: 'Concluída',
      source: 'IBGE',
      year: '2023',
      epsg: 'EPSG:4674 (SIRGAS 2000)',
    },
    {
      // STATUS: Em andamento — processo em execução automática de tratamento
      id: '#994C-F88',
      dateTime: '07/09 12:45',
      dataset: 'Malha municipal',
      stage: 'Tratamento',
      status: 'Em andamento',
      source: 'Prefeitura Municipal',
      year: '2022',
      epsg: 'EPSG:31983 (SIRGAS 2000 / UTM zone 23S)',
    },
    {
      // STATUS: Falhou — erro de validação (sobreposição). Sem editor alocado -> aguardando editor
      id: '#995X-Z01',
      dateTime: '07/09 11:30',
      dataset: 'Reserva legal',
      stage: 'Validação',
      status: 'Falhou',
      source: 'Órgão Estadual ABC',
      year: '2023',
      epsg: 'EPSG:4674 (SIRGAS 2000)',
      pauseReason: 'Sobreposição detectada no polígono 45. Necessário alocar editor.',
    },
    {
      // STATUS: Falhou — Ingestão concluída com sucesso após upload; erro detectado na Validação
      id: '#996R-T55',
      dateTime: '07/09 10:15',
      dataset: 'Uso e cobertura do solo',
      stage: 'Validação',
      status: 'Falhou',
      source: 'MapBiomas',
      year: '2021',
      epsg: 'EPSG:4326',
      pauseReason:
        'Erro de integridade geométrica no shapefile detectado na Validação. Necessário alocar editor.',
    },
    {
      // STATUS: Em andamento — Publicação só aguarda validação para publicar a carga
      id: '#881A-B01',
      dateTime: '07/09 09:30',
      dataset: 'APP Hidrográfica',
      stage: 'Publicação',
      status: 'Em andamento',
      source: 'ANA',
      year: '2023',
      epsg: 'EPSG:4674 (SIRGAS 2000)',
    },
    {
      // STATUS: Falhou — erro crítico na etapa de Tratamento. Sem editor alocado -> aguardando editor
      id: '#882A-C02',
      dateTime: '07/09 08:45',
      dataset: 'Imóveis rurais',
      stage: 'Tratamento',
      status: 'Falhou',
      source: 'INCRA',
      year: '2022',
      epsg: 'EPSG:31983 (SIRGAS 2000 / UTM zone 23S)',
      pauseReason:
        'Falha na correção topológica. Auto-interseções irreparáveis. Necessário alocar editor.',
    },
    {
      // STATUS: Em andamento — auditor/editor alocado para corrigir erro anterior de tratamento!
      id: '#883X-Z03',
      dateTime: '07/09 08:15',
      dataset: 'Reserva legal',
      stage: 'Tratamento',
      status: 'Em andamento',
      source: 'Órgão Ambiental DEF',
      year: '2021',
      epsg: 'EPSG:4674 (SIRGAS 2000)',
      assignedEditor: 'Carlos Mendes (Editor)',
      pauseReason: 'Editor alocado para correção manual de inconsistências topológicas.',
    },
    {
      // STATUS: Em andamento — Ingestão concluída após upload com sucesso; Validação em processamento
      id: '#884R-T04',
      dateTime: '07/09 08:00',
      dataset: 'Malha municipal',
      stage: 'Validação',
      status: 'Em andamento',
      source: 'IBGE',
      year: '2022',
      epsg: 'EPSG:4326',
    },
  ],
  totalElements: 8,
  totalPages: 1,
  size: 10,
  number: 0,
}

export const mockMetricasResponse: ProcessoMetricasResponse = {
  totalProcessos: 8,
  porSituacao: {
    'Concluída': 1,
    'Em andamento': 4,
    'Falhou': 3
  },
  porEtapa: {},
  porConjunto: {}
}

