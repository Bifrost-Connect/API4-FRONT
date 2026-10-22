import { dashboardService, type ProcessLog } from './dashboard'
import type { ProcessLogDetails } from './process'
import {
  mockAuditCargas,
  type AuditProcessCarga,
  type ProcessVersion,
} from './mocks/auditoria.mock'
import { validationChecksOk, treatmentChecksOk, analyticsDataOk } from './mocks/process.mock'

export type { AuditProcessCarga, ProcessVersion }

/**
 * Converte data "DD/MM/YYYY HH:mm" ou "DD/MM/YYYY" ou ISO para timestamp numérico para ordenação
 */
function parseDateToTimestamp(dateStr?: string): number {
  if (!dateStr) return 0
  const brMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/)
  if (brMatch) {
    const [, day, month, year, hour = '00', minute = '00'] = brMatch
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:00`).getTime()
  }
  const parsed = Date.parse(dateStr)
  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Gera uma nota de alteração ("changeNote") descritiva a partir do status, etapa e motivo de pausa
 */
function buildChangeNote(
  stage: string,
  status: string,
  pauseReason?: string,
  description?: string,
  isInitial?: boolean,
): string {
  if (pauseReason) {
    return pauseReason
  }
  if (description && description !== 'Processo não encontrado no mock. Exibindo dados padrão.') {
    return description
  }
  const normStatus = (status || '').toLowerCase()
  if (normStatus.includes('conclu')) {
    return 'Reprojeção concluída, validação aprovada e camada publicada no catálogo.'
  }
  if (normStatus.includes('falh') || normStatus.includes('quarentena')) {
    return `Inconsistência detectada na etapa de ${stage}. Encaminhado para revisão.`
  }
  if (normStatus.includes('aguardando') || normStatus.includes('valida')) {
    return `Aguardando validação técnica na etapa de ${stage}.`
  }
  if (isInitial) {
    return `Carga inicial recebida na etapa de ${stage}.`
  }
  return `Processamento em andamento na etapa de ${stage} (${status}).`
}

/**
 * Transforma um item resumido do Dashboard (`ProcessLog`) em um `ProcessVersion`
 */
function mapProcessLogToVersion(
  item: ProcessLog,
  versionNumber: number,
  isLatest: boolean,
  isInitial: boolean,
  currentDetails?: ProcessLogDetails | null,
): ProcessVersion {
  const isCurrent =
    currentDetails && String(currentDetails.id).toLowerCase() === String(item.id).toLowerCase()

  const normalizedStatus: ProcessLogDetails['status'] =
    item.status === 'Em validação'
      ? 'Aguardando validação'
      : item.status === 'Em quarentena'
        ? 'Falhou'
        : (item.status as ProcessLogDetails['status'])

  const versionTag = isLatest
    ? `v${versionNumber}.0 (Mais recente)`
    : isInitial && versionNumber === 1
      ? `v1.0 (Inicial)`
      : `v${versionNumber}.0`

  const baseDetails: ProcessLogDetails = isCurrent
    ? currentDetails
    : {
        id: String(item.id),
        dataset: item.dataset || currentDetails?.dataset || 'Conjunto Geoespacial',
        stage: (item.stage as ProcessLogDetails['stage']) || 'Ingestão',
        status: normalizedStatus || 'Em andamento',
        dateTime: item.dateTime || currentDetails?.dateTime || '',
        layerName: currentDetails?.layerName || item.dataset || `Camada ${item.id}`,
        source: item.source || currentDetails?.source || 'Órgão Responsável',
        year: item.year || currentDetails?.year || '2026',
        epsg: item.epsg || currentDetails?.epsg || 'EPSG:4674',
        description: currentDetails?.description || '',
        originalFileUrl: '#',
        integrityHash: item.integrityHash || '',
        assignedEditor: item.assignedEditor,
        pauseReason: item.pauseReason,
        mapCoordinates: currentDetails?.mapCoordinates || [
          [-15.793, -47.882],
          [-15.793, -47.8],
          [-15.85, -47.8],
          [-15.85, -47.882],
        ],
        logs: {
          Ingestão: [`[${item.dateTime || '—'}] Registro da carga ${item.id}.`],
        },
        validationChecks: validationChecksOk,
        treatmentChecks: treatmentChecksOk(item.epsg || 'EPSG:4674'),
        analyticsData: analyticsDataOk,
      }

  return {
    ...baseDetails,
    versionNumber,
    versionTag,
    isLatest,
    changeNote: buildChangeNote(
      baseDetails.stage,
      baseDetails.status,
      baseDetails.pauseReason,
      isCurrent ? currentDetails?.description : undefined,
      isInitial,
    ),
  }
}

export const auditoriaService = {
  /**
   * Busca ou sintetiza as versões de auditoria para um processo específico.
   * Adaptação no front-end: agrupa processos do mesmo dataset retornados por GET /processos.
   */
  async getVersionsForProcess(
    processId: string,
    currentDetails?: ProcessLogDetails | null,
  ): Promise<{ carga: AuditProcessCarga; versions: ProcessVersion[] }> {
    // 1. Verifica primeiro se pertence a uma carga explícita do mock de auditoria
    const foundMockCarga = mockAuditCargas.find(
      (c) =>
        c.id.toLowerCase() === processId.toLowerCase() ||
        c.versions.some((v) => v.id.toLowerCase() === processId.toLowerCase()),
    )

    if (foundMockCarga) {
      return {
        carga: foundMockCarga,
        versions: foundMockCarga.versions,
      }
    }

    // 2. Busca todos os processos na esteira para agrupar por dataset ("gambiarra")
    let allProcesses: ProcessLog[] = []
    try {
      const page = await dashboardService.getDashboardProcesses()
      allProcesses = page?.content || []
    } catch {
      allProcesses = []
    }

    const targetDataset = (currentDetails?.dataset || '').trim().toLowerCase()

    // Filtra processos que compartilham o mesmo dataset
    let relatedProcesses = targetDataset
      ? allProcesses.filter((p) => (p.dataset || '').trim().toLowerCase() === targetDataset)
      : allProcesses.filter((p) => String(p.id).toLowerCase() === processId.toLowerCase())

    // Garante que o processo atual esteja na lista mesmo se não veio na página da listagem
    if (
      currentDetails &&
      !relatedProcesses.some(
        (p) => String(p.id).toLowerCase() === String(currentDetails.id).toLowerCase(),
      )
    ) {
      relatedProcesses = [
        {
          id: String(currentDetails.id),
          dateTime: currentDetails.dateTime,
          dataset: currentDetails.dataset,
          stage: currentDetails.stage,
          status: currentDetails.status,
          source: currentDetails.source,
          year: currentDetails.year,
          epsg: currentDetails.epsg,
          integrityHash: currentDetails.integrityHash,
          pauseReason: currentDetails.pauseReason,
          assignedEditor: currentDetails.assignedEditor,
        },
        ...relatedProcesses,
      ]
    }

    // Ordena do mais antigo para o mais recente para numerar v1.0, v2.0, v3.0...
    const sortedOldestFirst = [...relatedProcesses].sort((a, b) => {
      const timeDiff = parseDateToTimestamp(a.dateTime) - parseDateToTimestamp(b.dateTime)
      if (timeDiff !== 0) return timeDiff
      return String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
    })

    const total = sortedOldestFirst.length
    const versionsOldestFirst = sortedOldestFirst.map((item, idx) => {
      const versionNumber = idx + 1
      const isLatest = idx === total - 1
      const isInitial = idx === 0 && total > 1
      return mapProcessLogToVersion(item, versionNumber, isLatest, isInitial, currentDetails)
    })

    // Inverte para exibir a versão mais recente no topo do painel lateral
    const versions = versionsOldestFirst.reverse()
    const latestVersion = versions[0]

    const carga: AuditProcessCarga = {
      id: String(currentDetails?.id || latestVersion?.id || processId),
      dataset:
        currentDetails?.dataset || latestVersion?.dataset || 'Conjunto de Dados Geoespaciais',
      layerName:
        currentDetails?.layerName ||
        latestVersion?.layerName ||
        currentDetails?.dataset ||
        `Camada ${processId}`,
      source: currentDetails?.source || latestVersion?.source || 'Fonte Oficial',
      lastUpdate: latestVersion?.dateTime || currentDetails?.dateTime || '',
      totalVersions: versions.length,
      currentStatus: (latestVersion?.status || currentDetails?.status || 'Em andamento') as AuditProcessCarga['currentStatus'],
      currentStage: latestVersion?.stage || currentDetails?.stage || 'Ingestão',
      versions,
    }

    return { carga, versions }
  },
}
