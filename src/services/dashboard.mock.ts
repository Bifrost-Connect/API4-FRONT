import type { DashboardData } from './dashboard';

export const mockDashboardData: DashboardData = {
  summary: [
    { title: 'CARGAS HOJE', value: 12, type: 'orange', iconType: 'down' },
    { title: 'CONCLUÍDAS', value: 8, type: 'success', iconType: 'check' },
    { title: 'EM VALIDAÇÃO', value: 3, type: 'warning', iconType: 'warning' },
    { title: 'FALHAS', value: 1, type: 'danger', iconType: 'error' },
  ],
  recentProcesses: [
    {
      id: '#993A-B12',
      dateTime: '07/09 13:00',
      dataset: 'Imóveis rurais',
      stage: 'Publicação',
      status: 'Concluída',
      source: 'IBGE',
      year: '2023',
      epsg: '4674 (US01)',
      integrityHash: 'a1b2c3d4...',
    },
    {
      id: '#994C-F88',
      dateTime: '07/09 12:45',
      dataset: 'Malha municipal',
      stage: 'Tratamento',
      status: 'Em andamento',
      source: 'Prefeitura Municipal',
      year: '2022',
      epsg: '31983 (US04)',
      integrityHash: '9f8e7d6c...',
    },
    {
      id: '#995X-Z01',
      dateTime: '07/09 11:30',
      dataset: 'Reserva legal',
      stage: 'Validação',
      status: 'Em quarentena',
      source: 'Órgão Estadual ABC',
      year: '2023',
      epsg: '4674 (US01)',
      integrityHash: '8f4e3b2a... (US02)',
      pauseReason: 'Carga desviada para quarentena após validação geométrica.',
      logs: [
        '[AVISO] Sobreposição detectada entre os polígonos 45 e 46.',
        '[ERRO] A validação topológica encontrou geometrias incompatíveis.',
        '[AÇÃO] Carga encaminhada para quarentena para revisão.',
      ],
      quarantined: true,
    },
    {
      id: '#996R-T55',
      dateTime: '07/09 10:15',
      dataset: 'Uso e cobertura do solo',
      stage: 'Ingestão',
      status: 'Falhou',
      source: 'MapBiomas',
      year: '2021',
      epsg: '4326',
      integrityHash: 'x9y8z7w6...',
      pauseReason: 'Erro de integridade geométrica no arquivo shapefile.',
      logs: ['[ERRO] O arquivo shapefile não passou na validação de integridade.'],
      quarantined: false,
    },
    {
      id: '#997Y-K22',
      dateTime: '07/09 09:00',
      dataset: 'APP_hidrografica',
      stage: 'Cálculo analítico',
      status: 'Concluída',
      source: 'ANA',
      year: '2023',
      epsg: '4674 (US01)',
      integrityHash: '1q2w3e4r...',
    },
  ],
};

export const mockFilterOptions = {
  conjuntos: [
    { id: 'imoveis', label: 'Imóveis rurais' },
    { id: 'malha', label: 'Malha municipal' },
    { id: 'reserva', label: 'Reserva legal' },
    { id: 'uso_solo', label: 'Uso e cobertura do solo' },
    { id: 'app', label: 'APP_hidrografica' }
  ],
  etapas: [
    { id: 'ingestao', label: 'Ingestão' },
    { id: 'validacao', label: 'Validação' },
    { id: 'calculo', label: 'Cálculo analítico' },
    { id: 'tratamento', label: 'Tratamento' },
    { id: 'publicacao', label: 'Publicação' }
  ],
  situacoes: [
    { id: 'concluida', label: 'Concluída' },
    { id: 'andamento', label: 'Em andamento' },
    { id: 'validacao', label: 'Em validação' },
    { id: 'falhou', label: 'Falhou' },
    { id: 'quarentena', label: 'Em quarentena' }
  ]
};
