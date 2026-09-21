import api from './api';
import { mockDashboardData, mockFilterOptions } from './mocks/dashboard.mock';

export interface DashboardSummary {
  title: string;
  value: number;
  type: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'orange';
  iconType: 'down' | 'check' | 'warning' | 'error';
}

export interface ProcessLog {
  id: string;
  dateTime: string;
  dataset: string;
  stage: string;
  status: 'Concluída' | 'Em andamento' | 'Em validação' | 'Falhou';
  source?: string;
  year?: string;
  epsg?: string;
  integrityHash?: string;
  pauseReason?: string;
}



export interface DashboardFilters {
  dateBeggin?: string;
  dateEnd?: string;
  conjunto?: string;
  etapa?: string;
  situacao?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const dashboardService = {
  async getDashboardSummary(): Promise<DashboardSummary[]> {
    // Para chamar a API descomente a linha abaixo e remova/comente o mock:
    // return (await api.get('/dashboard/summary')).data;
    
    await delay(400);
    return mockDashboardData.summary;
  },

  async getDashboardProcesses(filters?: DashboardFilters): Promise<ProcessLog[]> {
    // Para chamar a API descomente a linha abaixo e remova/comente o mock:
    // return (await api.get('/dashboard/processes', { params: filters })).data;
    
    await delay(800);
    
    // Simulate filtering on mock data
    let filteredProcesses = [...mockDashboardData.recentProcesses];
    
    if (filters) {
      if (filters.conjunto) {
        // Find label for this id in mock options to compare with dataset string
        const option = mockFilterOptions.conjuntos.find(o => o.id === filters.conjunto);
        if (option) filteredProcesses = filteredProcesses.filter(p => p.dataset === option.label);
      }
      if (filters.etapa) {
        const option = mockFilterOptions.etapas.find(o => o.id === filters.etapa);
        if (option) filteredProcesses = filteredProcesses.filter(p => p.stage === option.label);
      }
      if (filters.situacao) {
        const option = mockFilterOptions.situacoes.find(o => o.id === filters.situacao);
        if (option) filteredProcesses = filteredProcesses.filter(p => p.status === option.label);
      }
    }

    return filteredProcesses;
  },
  
  async getFilterOptions() {
    // Para chamar a API descomente a linha abaixo e remova/comente o mock:
    // return (await api.get('/filters')).data;

    await delay(400);
    return mockFilterOptions;
  }
};
