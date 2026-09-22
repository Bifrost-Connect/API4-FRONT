export interface ProcessLogDetails {
  id: string;
  dataset: string;
  stage: string;
  status: 'Concluída' | 'Em andamento' | 'Em validação' | 'Falhou';
  date: string;
  layerName: string;
  source: string;
  year: string;
  epsg: string;
  description: string;
  logs: Record<string, string[]>;
  mapCoordinates: [number, number][];
  originalFileUrl: string;
  pauseReason?: string;
}

export const mockProcessDetails: Record<string, ProcessLogDetails> = {
  '#993A-B12': {
    id: '#993A-B12',
    dataset: 'Imóveis rurais',
    stage: 'Publicação',
    status: 'Concluída',
    date: '07/09/2026',
    layerName: 'Imóveis Rurais 2023',
    source: 'IBGE',
    year: '2023',
    epsg: 'EPSG:4674 (US01)',
    description: 'Atualização da base de imóveis rurais.',
    originalFileUrl: '#',
    mapCoordinates: [
      [-15.793, -47.882],
      [-15.793, -47.800],
      [-15.850, -47.800],
      [-15.850, -47.882]
    ],
    logs: {
      'Ingestão': ['[2026-09-07 10:00:00] Ingestão concluída.'],
      'Validação': ['[2026-09-07 10:05:00] Validação concluída.'],
      'Tratamento': ['[2026-09-07 10:10:00] Tratamento concluído.'],
      'Cálculo analítico': ['[2026-09-07 10:15:00] Cálculo concluído.'],
      'Publicação': ['[2026-09-07 10:20:00] Publicação concluída.']
    }
  },
  '#994C-F88': {
    id: '#994C-F88',
    dataset: 'Malha municipal',
    stage: 'Tratamento',
    status: 'Em andamento',
    date: '07/09/2026',
    layerName: 'Malha Municipal 2022',
    source: 'Prefeitura Municipal',
    year: '2022',
    epsg: 'EPSG:31983 (US04)',
    description: 'Malha municipal fornecida pela prefeitura.',
    originalFileUrl: '#',
    mapCoordinates: [
      [-23.550, -46.633],
      [-23.550, -46.600],
      [-23.580, -46.600],
      [-23.580, -46.633]
    ],
    logs: {
      'Ingestão': ['[2026-09-07 11:00:00] Ingestão concluída.'],
      'Validação': ['[2026-09-07 11:05:00] Validação concluída.'],
      'Tratamento': ['[2026-09-07 11:10:00] Em andamento...'],
      'Cálculo analítico': [],
      'Publicação': []
    }
  },
  '#995X-Z01': {
    id: '#995X-Z01',
    dataset: 'Reserva legal',
    stage: 'Validação',
    status: 'Em validação',
    date: '07/09/2026',
    layerName: 'Reserva Legal 2023',
    source: 'Órgão Estadual ABC',
    year: '2023',
    epsg: 'EPSG:4674 (US01)',
    description: 'Dados de reserva legal para validação.',
    pauseReason: 'Sobreposição detectada no polígono 45. (US03)',
    originalFileUrl: '#',
    mapCoordinates: [
      [-19.916, -43.934],
      [-19.916, -43.900],
      [-19.950, -43.900],
      [-19.950, -43.934]
    ],
    logs: {
      'Ingestão': ['[2026-09-07 12:00:00] Ingestão concluída.'],
      'Validação': ['[2026-09-07 12:05:00] Inconsistências detectadas.'],
      'Tratamento': [],
      'Cálculo analítico': [],
      'Publicação': []
    }
  },
  '#996R-T55': {
    id: '#996R-T55',
    dataset: 'Uso e cobertura do solo',
    stage: 'Ingestão',
    status: 'Falhou',
    date: '07/09/2026',
    layerName: 'Uso Solo MapBiomas 2021',
    source: 'MapBiomas',
    year: '2021',
    epsg: 'EPSG:4326',
    description: 'Dados brutos do MapBiomas.',
    pauseReason: 'Erro de integridade geométrica no arquivo shapefile.',
    originalFileUrl: '#',
    mapCoordinates: [
      [-3.119, -60.021],
      [-3.119, -60.000],
      [-3.150, -60.000],
      [-3.150, -60.021]
    ],
    logs: {
      'Ingestão': ['[2026-09-07 13:00:00] Falha na leitura do arquivo.'],
      'Validação': [],
      'Tratamento': [],
      'Cálculo analítico': [],
      'Publicação': []
    }
  },
  '#997Y-K22': {
    id: '#997Y-K22',
    dataset: 'APP_hidrografica',
    stage: 'Publicação',
    status: 'Em andamento',
    date: '07/09/2026',
    layerName: 'APP Hidrográfica 2023',
    source: 'ANA',
    year: '2023',
    epsg: 'EPSG:4674 (US01)',
    description: 'Delimitação de APP.',
    originalFileUrl: '#',
    mapCoordinates: [
      [-15.793, -47.882],
      [-15.793, -47.800],
      [-15.850, -47.800],
      [-15.850, -47.882]
    ],
    logs: {
      'Ingestão': ['[2026-09-07 14:00:00] Ingestão concluída.'],
      'Validação': ['[2026-09-07 14:05:00] Validação concluída.'],
      'Tratamento': ['[2026-09-07 14:10:00] Tratamento concluído.'],
      'Cálculo analítico': ['[2026-09-07 14:15:00] Cálculo concluído.'],
      'Publicação': []
    }
  }
};
