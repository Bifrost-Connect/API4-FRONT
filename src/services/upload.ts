import api, { mockactive } from './api'
import {
  mockProcessoCriado,
  mockArquivoOriginalSuccess,
  mockUploadErrorResponse,
  mockUploadOptions,
} from './mocks/upload.mock'
import { userService } from './user'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const uploadService = {
  async cadastrarMetadados(payload: Record<string, any>): Promise<any> {
    try {
      const backendPayload = {
        operadorId: userService.getCurrentUser().id || 1,
        orgaoId: parseInt(payload.orgaoEmissor) || 1,
        conjuntoId: parseInt(payload.conjuntoDados) || 1,
        anoSafra: String(payload.anoReferencia || '2026').trim(),
        epsgOrigem: String(payload.epsg || '4674').replace(/\D/g, '') || '4674',
        competencia: payload.competencia,
        formato: payload.formato,
        classificacaoAcesso: payload.classificacaoAcesso,
        coberturaEspacial: payload.coberturaEspacial,
        coberturaTemporalInicio: payload.coberturaTemporalInicio || undefined,
        coberturaTemporalFim: payload.coberturaTemporalFim || undefined,
      }
      const res = await api.post('/carga/metadados', backendPayload)
      return res.data
    } catch (err: any) {
      if (mockactive) throw err
      if (err.response && err.response.status !== 404) {
        throw err.response.data || err
      }
      console.warn('API indisponível (ou rota 404), usando mock para cadastrar metadados')
      await delay(1000)
      if (payload.nomeCamada && payload.nomeCamada.toLowerCase().includes('erro')) {
        return Promise.reject(mockUploadErrorResponse)
      }
      return mockProcessoCriado
    }
  },

  async uploadArquivo(
    processoId: number,
    file: File,
    usuarioId: number = userService.getCurrentUser().id,
  ): Promise<any> {
    try {
      const formData = new FormData()
      formData.append('processoId', processoId.toString())
      formData.append('file', file)
      if (usuarioId) {
        formData.append('usuarioId', usuarioId.toString())
      }

      const res = await api.post('/carga/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return res.data
    } catch (err: any) {
      if (mockactive) throw err
      if (err.response && err.response.status !== 404) {
        throw err.response.data || err
      }
      console.warn('API indisponível (ou rota 404), usando mock para upload de arquivo')
      await delay(1500)
      return mockArquivoOriginalSuccess(file)
    }
  },

  /**
   * Busca as opções dinâmicas para preenchimento do formulário (anos, epsg, conjuntos, órgãos)
   */
  async getUploadOptions() {
    try {
      const res = await api.get('/dominios/carga')
      if (res.data) {
        return res.data
      }
      return mockUploadOptions
    } catch (err: any) {
      if (mockactive) throw err
      console.warn('Endpoint /dominios/carga indisponível, usando mockUploadOptions')
      await delay(300)
      return mockUploadOptions
    }
  },

  async downloadArquivoOriginal(processoId: number): Promise<Blob> {
    try {
      const res = await api.get(`/carga/download/${processoId}`, {
        responseType: 'blob',
      })
      return res.data
    } catch (err: any) {
      if (mockactive) throw err
      if (err.response && err.response.status !== 404) {
        throw err.response.data || err
      }
      console.warn('API indisponível (ou rota 404), mock indisponível para download.')
      throw err
    }
  },

  async reprocessarCarga(
    processoId: number,
    file: File,
    usuarioId: number = userService.getCurrentUser().id,
  ): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    if (usuarioId) {
      formData.append('usuarioId', usuarioId.toString())
    }
    const res = await api.post(`/carga/${processoId}/reprocessar`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return res.data
  },

  async cancelarCarga(
    processoId: number,
    motivo: string,
    usuarioId: number = userService.getCurrentUser().id,
  ): Promise<void> {
    await api.patch(
      `/carga/${processoId}/cancelar`,
      { motivo },
      {
        params: { usuarioId },
      },
    )
  },

  async notificarOperadorQuarentena(
    processoId: number,
    usuarioId: number = userService.getCurrentUser().id,
  ): Promise<void> {
    await api.post(`/carga/${processoId}/quarentena/notificar-operador`, null, {
      params: { usuarioId },
    })
  },

  async exportarRejeicoesCsv(processoId: number): Promise<Blob> {
    const res = await api.get(`/carga/${processoId}/rejeicoes/exportar`, {
      responseType: 'blob',
    })
    return res.data
  },
}
