import { mockProcessDetails, type ProcessLogDetails as MockProcessLogDetails } from './mocks/process.mock';

export type ProcessLogDetails = MockProcessLogDetails;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const processService = {
  async getProcessDetails(id: string): Promise<ProcessLogDetails> {
    // Expected Backend Request: GET /api/processes/{id}
    // No specific request body expected. Path parameter 'id' is used to fetch the process.
    //
    // Expected Backend Response:
    // {
    //   "id": "string",
    //   "dataset": "string",
    //   "stage": "string",
    //   "status": "string",
    //   "date": "string",
    //   ... (match the ProcessLogDetails interface)
    // }
    
    // Para chamar a API descomente a linha abaixo e remova/comente o mock:
    // return (await api.get(`/processes/${id}`)).data;

    await delay(600);
    const details = mockProcessDetails[id]
    if (!details) {
      // Fallback for non-mocked IDs
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
          [-15.793, -47.800],
          [-15.850, -47.800],
          [-15.850, -47.882]
        ],
        logs: {
          'Ingestão': [
            `[2026-09-07 10:00:00] Iniciando processo ${id}...`
          ]
        }
      } as ProcessLogDetails
    }
    
    return details
  }
};
