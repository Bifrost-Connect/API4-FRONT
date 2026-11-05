/**
 * Serviço de Upload e Ingestão de Cargas Geoespaciais.
 * Todas as operações utilizam a API REST do backend (/carga/*, /dominios/*).
 */
import api from './api'

export const uploadService = {
  async cadastrarMetadados(payload: Record<string, any>): Promise<any> {
    const backendPayload = {
      operadorId: payload.operadorId || 1,
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
  },

  async uploadArquivo(
    processoId: number,
    file: File,
    usuarioId?: number,
  ): Promise<any> {
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
      return { anos: [], epsgs: [], conjuntos: [], orgaos: [] }
    } catch {
      return { anos: [], epsgs: [], conjuntos: [], orgaos: [] }
    }
  },

  async downloadArquivoOriginal(processoId: number): Promise<Blob> {
    try {
      const res = await api.get(`/carga/download/${processoId}`, {
        responseType: 'blob',
      })
      return res.data
    } catch (err: any) {
      throw err.response?.data || err
    }
  },

  async reprocessarCarga(
    processoId: number,
    file: File,
    usuarioId?: number,
  ): Promise<any> {
    try {
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
    } catch (err: any) {
      throw err.response?.data || err
    }
  },

  async cancelarCarga(
    processoId: number,
    motivo: string,
    usuarioId?: number,
  ): Promise<void> {
    const params: Record<string, any> = {}
    if (usuarioId) params.usuarioId = usuarioId
    await api.patch(
      `/carga/${processoId}/cancelar`,
      { motivo },
      { params },
    )
  },

  async notificarOperadorQuarentena(
    processoId: number,
    usuarioId?: number,
  ): Promise<void> {
    const params: Record<string, any> = {}
    if (usuarioId) params.usuarioId = usuarioId
    await api.post(`/carga/${processoId}/quarentena/notificar-operador`, null, {
      params,
    })
  },

  async exportarRejeicoesCsv(processoId: number): Promise<Blob> {
    const res = await api.get(`/carga/${processoId}/rejeicoes/exportar`, {
      responseType: 'blob',
    })
    return res.data
  },

  async importarReferenciasGeoespaciais(
    fonte?: string,
    limitePorFonte: number = 5000,
  ): Promise<any> {
    const res = await api.post('/carga/referencias/importar', null, {
      params: { fonte, limitePorFonte },
    })
    return res.data
  },
}
