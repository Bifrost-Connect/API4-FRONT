import { describe, it, expect, beforeEach } from 'vitest'
import { mockProcessService } from '../mockProcessService'
import type { QuarantineRecord } from '@/services/process'

const storageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
})

const sampleRecords: QuarantineRecord[] = [
  {
    recordId: 'REC-001',
    motivo: 'Auto-interseção geométrica',
    etapaOrigem: 'Validação',
    execucaoId: 'EXEC-10',
    dataRejeicao: '2026-11-10T10:00:00Z',
    campo: 'geom',
    valorEncontrado: 'INVALID',
    valorEsperado: 'POLYGON VALID',
  },
]

describe('mockProcessService', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('decisões locais em localStorage', () => {
    it('salva, recupera e limpa decisões simuladas do gestor por processo', () => {
      const saved = mockProcessService.saveMockDecision(42, {
        gestorId: 1,
        etapa: 'PUBLICACAO',
        decisao: 'APROVADO',
        parecer: 'Homologado localmente.',
      })

      expect(saved.processoId).toBe(42)
      expect(saved.decisao).toBe('APROVADO')

      const list = mockProcessService.getMockDecisions(42)
      expect(list).toHaveLength(1)
      expect(list[0]?.parecer).toBe('Homologado localmente.')

      mockProcessService.clearMockDecisions(42)
      expect(mockProcessService.getMockDecisions(42)).toEqual([])
    })

    it('retorna lista vazia quando o JSON salvo em localStorage está corrompido', () => {
      localStorage.setItem('api4_decisoes_99', '{json-invalido')
      expect(mockProcessService.getMockDecisions(99)).toEqual([])
    })
  })

  describe('exportação simulada de quarentena', () => {
    it('gera Blob CSV e JSON com cabeçalho e nome de arquivo corretos', async () => {
      const csvExport = mockProcessService.buildQuarantineExportBlob('9001', 'csv', sampleRecords)
      expect(csvExport.filename).toBe('rejeicoes_9001.csv')
      expect(csvExport.blob.type).toContain('text/csv')
      const csvText = await csvExport.blob.text()
      expect(csvText).toContain('ID,Motivo,Etapa,Data')
      expect(csvText).toContain('REC-001,"Auto-interseção geométrica",Validação')

      const jsonExport = mockProcessService.buildQuarantineExportBlob('9001', 'json', sampleRecords)
      expect(jsonExport.filename).toBe('rejeicoes_9001.json')
      expect(jsonExport.blob.type).toContain('application/json')
      const jsonText = await jsonExport.blob.text()
      expect(JSON.parse(jsonText)).toEqual(sampleRecords)
    })

    it('lança erro ao tentar exportar lista vazia de rejeições', () => {
      expect(() => mockProcessService.buildQuarantineExportBlob('9001', 'csv', [])).toThrow(
        'Não há registros em quarentena',
      )
    })
  })

  describe('simulações operacionais de quarentena', () => {
    it('limpa decisões antigas ao simular reprocessamento', async () => {
      mockProcessService.saveMockDecision(77, {
        gestorId: 1,
        etapa: 'VALIDACAO',
        decisao: 'REPROVADO',
        parecer: 'Ajustar',
      })
      expect(mockProcessService.getMockDecisions(77)).toHaveLength(1)

      const file = new File(['{}'], 'corrigido.geojson', { type: 'application/geo+json' })
      const res = await mockProcessService.simulateReprocessLoad(77, file)

      expect(res.simulated).toBe(true)
      expect(mockProcessService.getMockDecisions(77)).toEqual([])
    })

    it('simula sinalização ao operador e cancelamento de carga', async () => {
      const signalRes = await mockProcessService.simulateSignalOperatorReprocess('CARG-1')
      expect(signalRes.simulated).toBe(true)

      const cancelRes = await mockProcessService.simulateCancelLoad('CARG-1', 'Arquivo duplicado')
      expect(cancelRes.simulated).toBe(true)
    })
  })
})
