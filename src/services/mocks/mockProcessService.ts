import type { ProcessStageCheck, QuarantineRecord } from '@/services/process'

export interface MockManagerDecision {
  id: number
  processoId: string | number
  gestorId: number
  gestorNome: string
  etapa: 'VALIDACAO' | 'TRATAMENTO' | 'PUBLICACAO'
  decisao: 'APROVADO' | 'REPROVADO'
  parecer?: string
  dataDecisao: string
}

export interface SaveMockDecisionPayload {
  gestorId: number
  etapa: 'VALIDACAO' | 'TRATAMENTO' | 'PUBLICACAO'
  decisao: 'APROVADO' | 'REPROVADO'
  parecer?: string
}

const DECISIONS_STORAGE_PREFIX = 'api4_decisoes_'

function decisionStorageKey(id: string | number): string {
  return `${DECISIONS_STORAGE_PREFIX}${id}`
}

function getStorage(): Storage | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage
    }
  } catch {
    // ignore storage access errors
  }
  return null
}

export const mockProcessService = {
  getDefaultValidationChecks(): ProcessStageCheck[] {
    return [
      {
        id: 'val-geom',
        label: 'Integridade Geométrica',
        description: 'Validação topológica de polígonos e ausência de auto-interseções.',
        status: 'success',
        detail: 'Topologia validada sem inconsistências.',
      },
      {
        id: 'val-crs',
        label: 'Sistema de Referência',
        description: 'Conferência do CRS/EPSG declarado com a camada oficial.',
        status: 'success',
        detail: 'CRS compatível com SIRGAS 2000.',
      },
    ]
  },

  getDefaultTreatmentChecks(epsg: string = 'EPSG:4674'): ProcessStageCheck[] {
    return [
      {
        id: 'trt-reproj',
        label: 'Padronização Espacial',
        description: 'Reprojeção e padronização de atributos da camada.',
        status: 'success',
        detail: `Camada padronizada em ${epsg}.`,
      },
    ]
  },

  saveMockDecision(id: string | number, payload: SaveMockDecisionPayload): MockManagerDecision {
    const decisaoObj: MockManagerDecision = {
      id: Date.now(),
      processoId: id,
      gestorId: payload.gestorId,
      gestorNome: 'Gestor',
      etapa: payload.etapa,
      decisao: payload.decisao,
      parecer: payload.parecer,
      dataDecisao: new Date().toISOString(),
    }

    const storage = getStorage()
    if (storage) {
      try {
        const list = this.getMockDecisions(id)
        list.unshift(decisaoObj)
        storage.setItem(decisionStorageKey(id), JSON.stringify(list))
      } catch {
        // ignore storage quota errors
      }
    }

    return decisaoObj
  },

  getMockDecisions(id: string | number): MockManagerDecision[] {
    const storage = getStorage()
    if (!storage) return []
    try {
      const raw = storage.getItem(decisionStorageKey(id))
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as MockManagerDecision[]) : []
    } catch {
      return []
    }
  },

  clearMockDecisions(id: string | number): void {
    const storage = getStorage()
    if (!storage) return
    try {
      storage.removeItem(decisionStorageKey(id))
    } catch {
      // ignore storage errors
    }
  },

  buildQuarantineExportBlob(
    id: string | number,
    format: 'csv' | 'json',
    records: QuarantineRecord[],
  ): { blob: Blob; filename: string } {
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('Não há registros em quarentena para exportar.')
    }

    if (format === 'json') {
      const content = JSON.stringify(records, null, 2)
      return {
        blob: new Blob([content], { type: 'application/json' }),
        filename: `rejeicoes_${id}.json`,
      }
    }

    const header = 'ID,Motivo,Etapa,Data,Campo,Valor Encontrado,Valor Esperado\n'
    const rows = records
      .map(
        (r) =>
          `${r.recordId},"${(r.motivo || '').replace(/"/g, '""')}",${r.etapaOrigem},${r.dataRejeicao},${r.campo || ''},"${r.valorEncontrado || ''}","${r.valorEsperado || ''}"`,
      )
      .join('\n')

    return {
      blob: new Blob([header + rows], { type: 'text/csv;charset=utf-8;' }),
      filename: `rejeicoes_${id}.csv`,
    }
  },

  async simulateSignalOperatorReprocess(
    id: string | number,
  ): Promise<{ simulated: true; processoId: string | number }> {
    return { simulated: true, processoId: id }
  },

  async simulateReprocessLoad(
    id: string | number,
    file: File,
  ): Promise<{ simulated: true; processoId: string | number; fileName: string }> {
    this.clearMockDecisions(id)
    return { simulated: true, processoId: id, fileName: file.name }
  },

  async simulateCancelLoad(
    id: string | number,
    justification: string,
  ): Promise<{ simulated: true; processoId: string | number; justification: string }> {
    return { simulated: true, processoId: id, justification }
  },

  async simulateProcessStart(
    id: string | number,
  ): Promise<{ success: true; simulated: true; processoId: string | number }> {
    return { success: true, simulated: true, processoId: id }
  },

  async simulateSpatialLog(): Promise<{ type: 'FeatureCollection'; features: never[] }> {
    return { type: 'FeatureCollection', features: [] }
  },

  async simulateAuditorAllocation(
    id: string | number,
    auditorId: number,
  ): Promise<{ sucesso: true; simulated: true; processoId: string | number; auditorId: number }> {
    return { sucesso: true, simulated: true, processoId: id, auditorId }
  },

  async simulatePublishAndClose(
    id: string | number,
    payload: { gestorId: number; parecer?: string },
  ): Promise<{ simulated: true; decisao: MockManagerDecision }> {
    const decisao = this.saveMockDecision(id, {
      gestorId: payload.gestorId,
      etapa: 'PUBLICACAO',
      decisao: 'APROVADO',
      parecer: payload.parecer,
    })
    return { simulated: true, decisao }
  },
}
