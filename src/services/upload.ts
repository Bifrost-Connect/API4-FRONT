import api, { mockactive } from './api';
import { mockProcessoCriado, mockArquivoOriginalSuccess, mockUploadErrorResponse, mockUploadOptions } from './mocks/upload.mock';
import { mockCurrentUser } from './mocks/user.mock';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const uploadService = {
  async cadastrarMetadados(payload: Record<string, any>): Promise<any> {
    try {
      const backendPayload = {
        operadorId: mockCurrentUser.id,
        orgaoId: parseInt(payload.orgaoEmissor) || 1,
        conjuntoId: parseInt(payload.conjuntoDados) || 1,
        anoSafra: payload.anoReferencia,
        epsgOrigem: payload.epsg
      };
      const res = await api.post('/carga/metadados', backendPayload)
      return res.data
    } catch (err: any) {
      if (mockactive) throw err;
      if (err.response && err.response.status !== 404) {
        throw err.response.data || err;
      }
      console.warn('API indisponível (ou rota 404), usando mock para cadastrar metadados')
      await delay(1000);
      if (payload.nomeCamada && payload.nomeCamada.toLowerCase().includes('erro')) {
        return Promise.reject(mockUploadErrorResponse);
      }
      return mockProcessoCriado;
    }
  },

  async uploadArquivo(processoId: number, file: File, usuarioId: number = mockCurrentUser.id): Promise<any> {
    try {
      const formData = new FormData()
      formData.append('processoId', processoId.toString())
      formData.append('file', file)
      
      const baseURL = api.defaults.baseURL || 'http://localhost:8080'
      const res = await fetch(`${baseURL}/carga/upload`, {
        method: 'POST',
        body: formData,
        // O navegador irá injetar automaticamente o Content-Type com o boundary correto!
      })
      
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await res.json() : await res.text();
      
      if (!res.ok) {
        throw { response: { status: res.status, data: isJson ? data : { erro: 'Erro', mensagem: data } } }
      }
      return data
    } catch (err: any) {
      if (mockactive) throw err;
      if (err.response && err.response.status !== 404) {
        throw err.response.data || err;
      }
      console.warn('API indisponível (ou rota 404), usando mock para upload de arquivo')
      await delay(1500);
      return mockArquivoOriginalSuccess(file);
    }
  },

  /**
   * Busca as opções dinâmicas para preenchimento do formulário (anos, epsg, conjuntos)
   */
  async getUploadOptions() {
    // Retornando os mocks diretamente para evitar o erro 404 de "Not Found" no console, 
    // já que o endpoint /dominios/carga ainda não existe no back-end.
    await delay(300);
    return mockUploadOptions;
  }
};
