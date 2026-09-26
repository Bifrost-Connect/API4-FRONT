import api from './api';
import { mockProcessoCriado, mockArquivoOriginalSuccess, mockUploadErrorResponse, mockUploadOptions } from './mocks/upload.mock';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const uploadService = {
  async cadastrarMetadados(payload: Record<string, any>): Promise<any> {
    try {
      const res = await api.post('/carga/metadados', payload)
      return res.data
    } catch (err) {
      console.warn('API indisponível, usando mock para cadastrar metadados')
      await delay(1000);
      if (payload.nomeCamada && payload.nomeCamada.toLowerCase().includes('erro')) {
        return Promise.reject(mockUploadErrorResponse);
      }
      return mockProcessoCriado;
    }
  },

  async uploadArquivo(processoId: number, file: File, usuarioId: number = 1): Promise<any> {
    try {
      const formData = new FormData()
      formData.append('processoId', processoId.toString())
      formData.append('file', file)
      const res = await api.post('/carga/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      return res.data
    } catch (err) {
      console.warn('API indisponível, usando mock para upload de arquivo')
      await delay(1500);
      return mockArquivoOriginalSuccess(file);
    }
  },

  /**
   * Busca as opções dinâmicas para preenchimento do formulário (anos, epsg, conjuntos)
   */
  async getUploadOptions() {
    try {
      const res = await api.get('/api/v1/dominios/carga')
      return res.data
    } catch (err) {
      console.warn('API indisponível, usando mock para opções de upload')
      await delay(400)
      return mockUploadOptions
    }
  }
};
