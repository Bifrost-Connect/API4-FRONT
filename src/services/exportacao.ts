import api from './api'
import { authStorage } from './storage/authStorage'

export interface ExportFilters {
  processo_id: number
  codigo_imovel?: string
  com_sobreposicao?: boolean
  hectares_min?: number
  fonte_camada?: string
}

export interface ExportPreview {
  processo_id: number
  versao_oficial: string
  filtros: Record<string, unknown>
  total_registros: number
  tamanho_amostra: number
  amostra: Record<string, unknown>[]
}

export interface ExportHistoryItem {
  id: number
  usuario_id: number
  usuario_nome: string
  usuario_email?: string
  processo_id: number
  conjunto: string
  ano_safra: string | number
  versao_oficial: string
  formato: 'CSV' | 'GEOJSON' | string
  filtros_utilizados?: Record<string, unknown> | string
  total_registros_exportados: number
  ip_solicitante?: string
  data_hora_exportacao: string
}

export interface ExportHistoryPage {
  items: ExportHistoryItem[]
  page: number
  size: number
  total_items: number
  total_pages: number
}

export interface ExportDownload {
  blob: Blob
  filename: string
  contentType: string
}

function filenameFromDisposition(disposition?: string, fallback = 'relatorio_georural'): string {
  if (!disposition) return fallback
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded.replace(/^"|"$/g, ''))
    } catch {
      return encoded.replace(/^"|"$/g, '')
    }
  }
  return disposition.match(/filename="?([^";]+)"?/i)?.[1] || fallback
}

export const exportacaoService = {
  async preview(filters: ExportFilters): Promise<ExportPreview> {
    const { data } = await api.get<ExportPreview>('/exportacoes/preview', { params: filters })
    return data
  },

  async historico(page = 0, size = 20): Promise<ExportHistoryPage> {
    const { data } = await api.get<ExportHistoryPage>('/exportacoes/historico', {
      params: { page, size },
    })
    return data
  },

  async baixar(
    filters: ExportFilters,
    formato: 'csv' | 'geojson',
    onProgress?: (loaded: number, total?: number) => void,
  ): Promise<ExportDownload> {
    const session = authStorage.getSession()
    const { data, headers } = await api.get<Blob>('/exportacoes/resultados', {
      params: { ...filters, formato },
      responseType: 'blob',
      headers: session?.userId ? { 'X-Gestor-ID': String(session.userId) } : undefined,
      onDownloadProgress: (event) => onProgress?.(event.loaded, event.total),
    })
    const responseContentType = headers['content-type']
    const contentType =
      typeof responseContentType === 'string'
        ? responseContentType
        : formato === 'csv'
          ? 'text/csv'
          : 'application/geo+json'
    return {
      blob: data,
      contentType,
      filename: filenameFromDisposition(
        headers['content-disposition'],
        `relatorio_georural.${formato}`,
      ),
    }
  },
}
