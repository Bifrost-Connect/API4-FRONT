/**
 * Utilitários e helpers de regras de negócio compartilhados para processos de carga.
 * Centraliza cálculos de etapas, verificação de inconsistências, correspondência
 * de filtros e mapeamento de classes visuais (badges/status).
 */
import type { ProcessLog } from '../services/dashboard'

/** Etapas sequenciais da esteira de processamento de cargas */
export const PROCESS_STEPS = ['Ingestão', 'Validação', 'Tratamento', 'Publicação']

/** Categorias rápidas para filtros em abas */
export type ProcessCategory =
  | 'CONCLUIDAS'
  | 'TODAS'
  | 'ATTENTION'
  | 'QUARENTENA'
  | 'VALIDACAO'
  | 'TRATAMENTO'
  | 'EM_CORRECAO'

/**
 * Identifica se uma carga possui falha, retenção em quarentena,
 * inconsistência ou especialista designado para correção.
 */
export function isErrorOrQuarantined(item: ProcessLog): boolean {
  const status = (item.status || '').toLowerCase()
  const stage = (item.stage || '').toLowerCase()

  if (
    status.includes('falh') ||
    status.includes('quarentena') ||
    status.includes('valida') ||
    status.includes('ressalva')
  ) {
    return true
  }

  if (stage.includes('valida') || stage.includes('trata')) {
    if (!status.includes('conclu')) {
      return true
    }
  }

  if (item.assignedEditor) {
    return true
  }

  if (item.quarantined || Boolean(item.pauseReason)) {
    return true
  }

  return false
}

/**
 * Verifica se a carga foi concluída, publicada ou fechada (vigente no catálogo).
 */
export function isProcessVigente(item: ProcessLog): boolean {
  const norm = (item.status || '').toLowerCase()
  return (
    norm.includes('conclu') ||
    norm.includes('fechad') ||
    norm.includes('publicad') ||
    norm.includes('vigente')
  )
}

/**
 * Verifica se o processo foi concluído com sucesso.
 */
export function isProcessDone(item: ProcessLog): boolean {
  return (item.status || '').toLowerCase().includes('conclu')
}

/**
 * Retorna o índice numérico (1 a 4) da etapa da esteira.
 */
export function getStepIndex(stageOrItem: string | ProcessLog): number {
  const stage = (typeof stageOrItem === 'string' ? stageOrItem : stageOrItem.stage || '').toLowerCase()
  if (stage.includes('publica') || stage.includes('calculo')) return 4
  if (stage.includes('trata')) return 3
  if (stage.includes('valida')) return 2
  return 1
}

/**
 * Calcula a etapa de progresso para exibição no Stepper.
 * Se a carga estiver concluída e na última etapa, avança para o índice final.
 */
export function getProgressStep(item: ProcessLog): number {
  const idx = getStepIndex(item)
  return isProcessDone(item) && idx === PROCESS_STEPS.length ? idx + 1 : idx
}

/**
 * Identifica se a etapa atual deve exibir indicador de alerta no Stepper.
 */
export function getWarningStep(item: ProcessLog): number | undefined {
  const status = (item.status || '').toLowerCase()
  if (status.includes('falh') || status.includes('quarentena') || status.includes('ressalva') || item.quarantined) {
    return getStepIndex(item)
  }
  return undefined
}

/**
 * Testa se uma carga atende ao critério da aba de categoria rápida selecionada.
 */
export function matchesCategory(item: ProcessLog, category: ProcessCategory): boolean {
  const status = (item.status || '').toLowerCase()
  const stage = (item.stage || '').toLowerCase()

  switch (category) {
    case 'CONCLUIDAS':
      return isProcessVigente(item)
    case 'ATTENTION':
      return isErrorOrQuarantined(item)
    case 'QUARENTENA':
      return status.includes('quarentena') || Boolean(item.quarantined)
    case 'VALIDACAO':
      return stage.includes('valida')
    case 'TRATAMENTO':
      return stage.includes('trata')
    case 'EM_CORRECAO':
      return Boolean(item.assignedEditor)
    case 'TODAS':
    default:
      return true
  }
}

/**
 * Aplica os filtros padrão de formulário (Conjunto, Etapa, Situação) sobre um item.
 */
export function matchesStandardFilters(
  item: ProcessLog,
  filters: { conjunto?: string; etapa?: string; situacao?: string },
  filterOptions?: {
    conjuntos?: Array<{ id: string | number; label: string }>
    etapas?: Array<{ id: string | number; label: string }>
    situacoes?: Array<{ id: string | number; label: string }>
  },
): boolean {
  const status = (item.status || '').toLowerCase()
  const stage = (item.stage || '').toLowerCase()

  if (filters.conjunto) {
    const opt = filterOptions?.conjuntos?.find((c) => String(c.id) === String(filters.conjunto))
    const expected = opt ? opt.label.toLowerCase() : filters.conjunto.toLowerCase()
    const itemDs = String(item.dataset || '').toLowerCase()
    if (itemDs !== expected && !itemDs.includes(expected)) {
      return false
    }
  }

  if (filters.etapa) {
    const opt = filterOptions?.etapas?.find((e) => String(e.id) === String(filters.etapa))
    if (opt && !stage.includes(opt.label.toLowerCase())) {
      return false
    }
  }

  if (filters.situacao) {
    const opt = filterOptions?.situacoes?.find((s) => String(s.id) === String(filters.situacao))
    if (opt && !status.includes(opt.label.toLowerCase())) {
      return false
    }
  }

  return true
}

/**
 * Retorna a classe CSS semântica do badge conforme o status do processo.
 * Suporta o formato padrão `badge badge_...` ou `status-badge status-...`.
 */
export function getStatusBadgeClass(status?: string, variant: 'badge' | 'status-badge' = 'badge'): string {
  const norm = (status || '').toLowerCase()
  const isConcluida = norm.includes('conclu') || norm.includes('fechad') || norm.includes('publicad')
  const isAndamento = norm.includes('andamento')
  const isValidacao = norm.includes('valida')
  const isFalha = norm.includes('falh') || norm.includes('quarentena') || norm.includes('cancel')

  if (variant === 'status-badge') {
    if (isConcluida) return 'status-badge status-concluida'
    if (isAndamento) return 'status-badge status-andamento'
    if (isValidacao) return 'status-badge status-validacao'
    if (isFalha) return 'status-badge status-falhou'
    return 'status-badge'
  }

  if (isConcluida) return 'badge badge_success'
  if (isAndamento) return 'badge badge_info'
  if (isValidacao) return 'badge badge_warning'
  if (isFalha) return 'badge badge_danger'
  return 'badge badge_primary'
}

