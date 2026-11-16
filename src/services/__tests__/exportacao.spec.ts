import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosResponse } from 'axios'
import api from '../api'
import { exportacaoService } from '../exportacao'

describe('exportacaoService', () => {
  beforeEach(() => vi.restoreAllMocks())

  it.each([
    ['csv', 'text/csv; charset=UTF-8', 'relatorio.csv'],
    ['geojson', 'application/geo+json', 'relatorio.geojson'],
  ] as const)('baixa %s como Blob com nome e MIME do servidor', async (format, mime, filename) => {
    const blob = new Blob(['conteudo'], { type: mime })
    const get = vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: blob,
      headers: {
        'content-type': mime,
        'content-disposition': `attachment; filename="${filename}"`,
      },
    } as unknown as AxiosResponse<Blob>)

    const result = await exportacaoService.baixar({ processo_id: 9 }, format)

    expect(get).toHaveBeenCalledWith(
      '/exportacoes/resultados',
      expect.objectContaining({
        params: { processo_id: 9, formato: format },
        responseType: 'blob',
      }),
    )
    expect(result.blob.type).toBe(mime.toLowerCase())
    expect(result.contentType).toBe(mime)
    expect(result.filename).toBe(filename)
  })
})
