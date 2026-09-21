export interface ProcessLogDetails {
  id: string;
  dataset: string;
  stage: string;
  status: 'Concluída' | 'Em andamento' | 'Em validação' | 'Falhou';
  date: string;
  layerName: string;      // "Nome da Fonte de Dados / Camada"
  source: string;         // "Órgão Emissor"
  year: string;           // "Ano de Referência"
  epsg: string;           // "Sistema de Coordenadas"
  description: string;    // "Descrição (opcional)"
  logs: Record<string, string[]>;
  mapCoordinates: [number, number][]; // Polígono delimitando o local
  originalFileUrl: string;
  pauseReason?: string;
}

/**
 * ==========================================
 * CONTRATO DE API ESPERADO (BACK-END)
 * ==========================================
 * Rota: GET /api/processes/:id
 * 
 * Como o back-end deve receber a requisição:
 * - Método: GET
 * - Parâmetros de Rota: `id` (string) - O ID único do processo a ser detalhado.
 * - Headers: Autenticação via token Bearer (se aplicável).
 * 
 * Como o back-end deve responder:
 * - Status 200 OK
 * - Corpo da resposta (JSON) contendo as informações simuladas abaixo na constante `mockProcessDetails`
 * - A chave `logs` deve ser um objeto onde cada chave é o nome da etapa e o valor é um array de strings com o histórico de logs.
 * - A chave `mapCoordinates` deve ser um array de coordenadas [latitude, longitude] delimitando a bounding box ou o polígono da área processada para o mapa.
 */

export const mockProcessDetails: Record<string, ProcessLogDetails> = {
  'PRC-001': {
    id: 'PRC-001',
    dataset: 'Limites Municipais',
    stage: 'Validação',
    status: 'Falhou',
    date: '07/09/2026',
    layerName: 'Limites MG 2026',
    source: 'IBGE',
    year: '2026',
    epsg: 'EPSG:4674',
    description: 'Arquivos brutos dos limites de Minas Gerais atualizados.',
    pauseReason: 'Falha de integridade geométrica na linha 452. Polígono auto-interceptado.',
    originalFileUrl: '#',
    mapCoordinates: [
      [-19.916, -43.934],
      [-19.916, -43.900],
      [-19.950, -43.900],
      [-19.950, -43.934]
    ],
    logs: {
      'Ingestão': [
        '[2026-09-07 10:00:00] Início do processamento da carga.',
        '[2026-09-07 10:01:15] Validando formato do arquivo (Shapefile)... OK.',
        '[2026-09-07 10:02:30] Extraindo geometrias e atributos...'
      ],
      'Validação': [
        '[2026-09-07 10:03:00] Iniciando checagem de integridade espacial.',
        '[2026-09-07 10:03:15] ERRO: Falha de integridade geométrica na linha 452. Movendo para quarentena.'
      ]
    }
  },
  'PRC-002': {
    id: 'PRC-002',
    dataset: 'Áreas de Risco',
    stage: 'Publicação',
    status: 'Concluída',
    date: '06/09/2026',
    layerName: 'Mapeamento Zonas de Risco SP',
    source: 'Defesa Civil',
    year: '2025',
    epsg: 'EPSG:4326',
    description: 'Mapeamento de encostas sujeitas a deslizamento.',
    originalFileUrl: '#',
    mapCoordinates: [
      [-23.550, -46.633],
      [-23.550, -46.600],
      [-23.580, -46.600],
      [-23.580, -46.633]
    ],
    logs: {
      'Ingestão': [
        '[2026-09-06 14:00:00] Início do processamento da carga.',
        '[2026-09-06 14:01:00] Validando formato do arquivo (GeoJSON)... OK.'
      ],
      'Validação': [
        '[2026-09-06 14:02:00] Integridade espacial verificada com sucesso.'
      ],
      'Tratamento': [
        '[2026-09-06 14:05:00] Dados normalizados.'
      ],
      'Cálculo analítico': [
        '[2026-09-06 14:10:00] Índices de risco calculados.'
      ],
      'Publicação': [
        '[2026-09-06 14:15:00] Carga concluída com sucesso no banco de dados.'
      ]
    }
  }
};
