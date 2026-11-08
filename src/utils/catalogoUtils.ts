/**
 * Utilitários de regras de negócio, blindagem e formatação do Catálogo de Bases (US09).
 */

import type { CatalogoItem, CatalogoSortOption } from '@/types/catalogo'

/**
 * Mensagem oficial obrigatória da trava visual de quarentena (Tarefa 8).
 */
export const QUARANTINE_TOOLTIP =
  'Base em processamento ou retida em validação — aguardando publicação oficial pelo Gestor'

/**
 * Valida se uma base está plenamente disponível para ações analíticas e inspeção.
 * REGRA DE ESCOPO: A blindagem baseia-se estritamente no status operacional da base.
 * Apenas bases Publicadas e Concluídas liberam mapa, comparação de safra e ficha técnica.
 */
export function isBaseDisponivel(item?: { status?: string; stage?: string } | null): boolean {
  if (!item || !item.status) return false

  const status = String(item.status).toLowerCase().trim()
  const stage = String(item.stage || '').toLowerCase().trim()

  // Se tiver falha, quarentena, ressalva, validação ou andamento no status -> NÃO disponível
  if (
    status.includes('falh') ||
    status.includes('quarentena') ||
    status.includes('valida') ||
    status.includes('ressalva') ||
    status.includes('andamento') ||
    status.includes('aguardando')
  ) {
    return false
  }

  // Se a etapa indicar validação, ingestão ou tratamento sem conclusão -> NÃO disponível
  if (stage && !stage.includes('publica') && !stage.includes('conclu')) {
    if (stage.includes('valida') || stage.includes('trata') || stage.includes('ingest')) {
      return false
    }
  }

  // Deve explicitamente indicar conclusão / publicação / fechamento oficial
  return (
    status.includes('conclu') ||
    status.includes('publicad') ||
    status.includes('disponív') ||
    status.includes('disponiv') ||
    status.includes('fechad') ||
    status.includes('vigente')
  )
}

export interface SituacaoBadgeInfo {
  label: string
  badgeClass: string
  color: string
}

/**
 * Normaliza o badge de situação sem rótulos compostos ou barras de separação.
 */
export function normalizeSituacaoBadge(status?: string): SituacaoBadgeInfo {
  const norm = String(status || '').toLowerCase().trim()

  if (norm.includes('falh')) {
    return {
      label: 'Falhou',
      badgeClass: 'badge-status-falhou',
      color: '#ef4444',
    }
  }

  if (norm.includes('ressalva')) {
    return {
      label: 'Com ressalva',
      badgeClass: 'badge-status-ressalva',
      color: '#f97316',
    }
  }

  if (norm.includes('quarentena') || norm.includes('valida')) {
    return {
      label: 'Em validação',
      badgeClass: 'badge-status-quarentena',
      color: '#eab308',
    }
  }

  if (norm.includes('andamento')) {
    return {
      label: 'Em andamento',
      badgeClass: 'badge-status-andamento',
      color: '#3b82f6',
    }
  }

  if (
    norm.includes('conclu') ||
    norm.includes('publicad') ||
    norm.includes('disponív') ||
    norm.includes('disponiv') ||
    norm.includes('fechad') ||
    norm.includes('vigente')
  ) {
    return {
      label: 'Disponível',
      badgeClass: 'badge-status-concluida',
      color: '#22c55e',
    }
  }

  return {
    label: status || 'Desconhecido',
    badgeClass: 'badge-status-default',
    color: '#94a3b8',
  }
}

/**
 * Ordena a lista de bases conforme a opção selecionada (Tarefa 5).
 */
export function sortCatalogoItems(items: CatalogoItem[], sortOption: CatalogoSortOption): CatalogoItem[] {
  const list = [...items]

  switch (sortOption) {
    case 'data_desc':
      return list.sort((a, b) => {
        const da = a.data_publicacao || ''
        const db = b.data_publicacao || ''
        return db.localeCompare(da) || String(b.id).localeCompare(String(a.id), undefined, { numeric: true })
      })

    case 'data_asc':
      return list.sort((a, b) => {
        const da = a.data_publicacao || ''
        const db = b.data_publicacao || ''
        return da.localeCompare(db) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
      })

    case 'safra_desc':
      return list.sort((a, b) => String(b.year || '').localeCompare(String(a.year || '')))

    case 'safra_asc':
      return list.sort((a, b) => String(a.year || '').localeCompare(String(b.year || '')))

    case 'nome_asc':
      return list.sort((a, b) => String(a.dataset || '').localeCompare(String(b.dataset || '')))

    case 'nome_desc':
      return list.sort((a, b) => String(b.dataset || '').localeCompare(String(a.dataset || '')))

    case 'registros_desc':
      return list.sort((a, b) => (Number(b.total_feicoes) || 0) - (Number(a.total_feicoes) || 0))

    default:
      return list
  }
}
