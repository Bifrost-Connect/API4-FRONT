import { describe, it, expect, vi, beforeEach } from 'vitest'
import { auditoriaService } from '../auditoria'
import { processService } from '../process'
import { dashboardService } from '../dashboard'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  return {
    ...actual,
    default: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
    },
    mockactive: false,
  }
})

vi.mock('../process', () => ({
  processService: {
    getTraceability: vi.fn(),
    getProcessDetails: vi.fn(),
  },
}))

vi.mock('../dashboard', () => ({
  dashboardService: {
    getDashboardProcesses: vi.fn(),
  },
}))

describe('Auditoria Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve montar versões a partir do histórico real de etapas da linhagem do backend', async () => {
    vi.mocked(processService.getTraceability).mockResolvedValueOnce({
      indicadorId: 1,
      processoId: 1,
      arquivoOriginalId: 10,
      nomeArquivoOriginal: 'malha_sidrolandia.geojson',
      hashSha256: 'a1b2c3d4e5f6',
      parametrosProcessamento: 'Validação Padrão',
      dataCarga: '2026-10-23T10:00:00',
      statusAtual: 'Concluída',
      etapaAtual: 'Tratamento',
      historicoEtapas: [
        {
          etapa: 'INGESTAO',
          situacao: 'CONCLUIDA',
          dataInicio: '2026-10-23T10:00:00',
          dataFim: '2026-10-23T10:01:00',
          mensagem: 'Upload e hash conferidos',
          resultado: 'OK',
        },
        {
          etapa: 'TRATAMENTO',
          situacao: 'CONCLUIDA',
          dataInicio: '2026-10-23T10:01:00',
          dataFim: '2026-10-23T10:03:00',
          mensagem: 'Reprojeção concluída com sucesso',
          resultado: 'OK',
        },
      ],
    } as any)

    const resultado = await auditoriaService.getVersionsForProcess('1')
    expect(processService.getTraceability).toHaveBeenCalledWith('1')
    expect(resultado.carga).toBeDefined()
    expect(resultado.carga.id).toBe('1')
    expect(resultado.versions.length).toBe(2)
    // A versão mais recente fica no topo (índice 0)
    expect(resultado.versions[0].versionTag).toContain('Mais recente')
    expect(resultado.versions[0].stage).toBe('TRATAMENTO')
    expect(resultado.versions[1].versionTag).toContain('Inicial')
    expect(resultado.versions[1].stage).toBe('INGESTAO')
  })

  it('deve retornar lista vazia de versões quando o banco não tiver histórico e mockactive for false', async () => {
    vi.mocked(processService.getTraceability).mockRejectedValueOnce(new Error('Processo 999 não encontrado'))
    vi.mocked(dashboardService.getDashboardProcesses).mockResolvedValueOnce({
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: 10,
      number: 0,
    })

    const resultado = await auditoriaService.getVersionsForProcess('999')
    expect(resultado.versions).toEqual([])
    expect(resultado.carga.totalVersions).toBe(0)
  })

  it('não deve usar mockAuditCargas quando mockactive for false mesmo com ID de mock', async () => {
    vi.mocked(processService.getTraceability).mockRejectedValueOnce(new Error('Não é numérico'))
    vi.mocked(dashboardService.getDashboardProcesses).mockResolvedValueOnce({
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: 10,
      number: 0,
    })

    // ID que existe no mock de auditoria
    const resultado = await auditoriaService.getVersionsForProcess('CAR-2026-001')
    // Como mockactive é false e o dashboard retornou vazio, não deve inventar versões do mock
    expect(resultado.versions).toEqual([])
  })
})

