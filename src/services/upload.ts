import api from './api';
import { mockUploadSuccessResponse, mockUploadErrorResponse, mockUploadOptions } from './mocks/upload.mock';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const uploadService = {
  /**
   * Envia o pacote .zip (Shapefile) juntamente com as informações (metadata)
   * e processa na base de dados espacial.
   */
  async uploadShapefile(formData: FormData): Promise<any> {
    // Para chamar a API real, descomente a linha abaixo e remova/comente o mock:
    // return (await api.post('/upload', formData, {
    //   headers: {
    //     'Content-Type': 'multipart/form-data'
    //   }
    // })).data;
    
    await delay(2000); // Simulando upload e processamento backend

    const nome = formData.get('nome') as string;

    // Regra do mock: se a palavra 'erro' estiver no nome da camada, simula falha HTTP 400.
    if (nome && nome.toLowerCase().includes('erro')) {
      return Promise.reject(mockUploadErrorResponse);
    }

    return mockUploadSuccessResponse(nome);
  },

  /**
   * Busca as opções dinâmicas para preenchimento do formulário (anos, epsg, conjuntos)
   */
  async getUploadOptions() {
    // Para chamar a API real, descomente a linha abaixo e remova/comente o mock:
    // return (await api.get('/upload/options')).data;

    await delay(400);
    return mockUploadOptions;
  }
};
