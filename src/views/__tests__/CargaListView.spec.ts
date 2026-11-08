/**
 * Testes integrados e funcionais do Catálogo de Bases Geoespaciais.
 * Valida a exibição de indicadores, alternância de modos de visão,
 * filtros, pesquisa textual, trava de blindagem por status e ficha técnica.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CargaListView from '../CargaListView.vue'
import CatalogDetailDrawer from '@/components/catalog/CatalogDetailDrawer.vue'
import { dashboardService, type ProcessLog } from '@/services/dashboard'
import { catalogoService } from '@/services/catalogo'
import {
  isBaseDisponivel,
  normalizeSituacaoBadge,
  sortCatalogoItems,
  QUARANTINE_TOOLTIP,
} from '@/utils/catalogoUtils'
import type { CatalogoItem } from '@/types/catalogo'

const pushMock = vi.fn<(...args: any[]) => void>()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useRoute: () => ({
    query: {},
  }),
}))

const basesCadastradasMock: ProcessLog[] = [
  {
    id: '101',
    dateTime: '19/10/2026 20:05',
    dataset: 'Imóveis Rurais (CAR)',
    stage: 'Publicação',
    status: 'Concluída',
    source: 'INCRA',
    year: '2026',
    epsg: 'EPSG:4674',
  },
  {
    id: '102',
    dateTime: '15/08/2025 14:20',
    dataset: 'Reserva Legal',
    stage: 'Publicação',
    status: 'Concluída',
    source: 'SICAR',
    year: '2025',
    epsg: 'EPSG:4674',
  },
  {
    id: '103',
    dateTime: '10/10/2026 11:40',
    dataset: 'Área de Preservação Permanente (APP)',
    stage: 'Validação',
    status: 'Em validação',
    source: 'IBAMA',
    year: '2026',
    epsg: 'EPSG:4674',
  },
  {
    id: '104',
    dateTime: '05/09/2026 09:15',
    dataset: 'Uso e Cobertura do Solo',
    stage: 'Ingestão',
    status: 'Falhou',
    source: 'MapBiomas',
    year: '2026',
    epsg: 'EPSG:4674',
  },
  {
    id: '105',
    dateTime: '01/09/2026 16:30',
    dataset: 'Malha Municipal',
    stage: 'Tratamento',
    status: 'Em andamento',
    source: 'IBGE',
    year: '2026',
    epsg: 'EPSG:4674',
  },
]

describe('Catálogo de Bases Geoespaciais', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    try {
      if (typeof localStorage !== 'undefined') localStorage.clear()
      if (typeof sessionStorage !== 'undefined') sessionStorage.clear()
    } catch {}
    vi.spyOn(dashboardService, 'getDashboardProcesses').mockResolvedValue({
      content: [...basesCadastradasMock],
      totalElements: basesCadastradasMock.length,
      totalPages: 1,
      size: 50,
      number: 0,
      source: 'API',
    })

    vi.spyOn(dashboardService, 'getFilterOptions').mockResolvedValue({
      conjuntos: [
        { id: 1, label: 'Imóveis Rurais (CAR)' },
        { id: 2, label: 'Reserva Legal' },
        { id: 3, label: 'Área de Preservação Permanente (APP)' },
      ],
      etapas: [
        { id: 1, label: 'Ingestão' },
        { id: 2, label: 'Validação' },
        { id: 3, label: 'Tratamento' },
        { id: 4, label: 'Publicação' },
      ],
      situacoes: [
        { id: 1, label: 'Concluída' },
        { id: 2, label: 'Em andamento' },
        { id: 3, label: 'Em validação' },
        { id: 4, label: 'Falhou' },
      ],
    })

    vi.spyOn(catalogoService, 'listarBases').mockResolvedValue([
      {
        id: 101,
        ano_safra: '2026',
        versao_oficial: 'v1.0 (Oficial)',
        data_publicacao: '19/10/2026 20:05',
        total_feicoes: 1420,
      },
      {
        id: 102,
        ano_safra: '2025',
        versao_oficial: 'v2.1 (Oficial)',
        data_publicacao: '15/08/2025 14:20',
        total_feicoes: 890,
      },
    ])
  })

  describe('Painel de Indicadores e Alternância de Visualização', () => {
    it('exibe contadores de resumo com total de bases, prontas para uso e em processamento', async () => {
      const wrapper = mount(CargaListView)
      await flushPromises()

      expect(wrapper.find('[data-testid="kpis-header"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="kpi-value-total"]').text()).toBe('5')
      expect(wrapper.find('[data-testid="kpi-value-prontas"]').text()).toBe('2')
      expect(wrapper.find('[data-testid="kpi-value-processamento"]').text()).toBe('3')
    })

    it('permite alternar a exibição entre o modo grade de cards e o modo tabela detalhada', async () => {
      const wrapper = mount(CargaListView)
      await flushPromises()

      // Inicia em modo grade
      expect(wrapper.find('[data-testid="catalog-grid"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="catalog-table"]').exists()).toBe(false)

      // Alterna para o modo tabela
      await wrapper.find('[data-testid="toggle-view-table"]').trigger('click')
      expect(wrapper.find('[data-testid="catalog-grid"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="catalog-table"]').exists()).toBe(true)

      // Retorna para o modo grade
      await wrapper.find('[data-testid="toggle-view-grid"]').trigger('click')
      expect(wrapper.find('[data-testid="catalog-grid"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="catalog-table"]').exists()).toBe(false)
    })
  })

  describe('Filtros e Pesquisas Operacionais', () => {
    it('aplica por padrão o filtro de apenas bases prontas para consulta', async () => {
      const wrapper = mount(CargaListView)
      await flushPromises()

      const toggleCheckbox = wrapper.find<HTMLInputElement>('[data-testid="toggle-only-prontas"]')
      expect(toggleCheckbox.element.checked).toBe(true)

      const cards = wrapper.findAll('[data-testid="catalog-card"]')
      expect(cards.length).toBe(2)

      const gridText = wrapper.find('[data-testid="catalog-grid"]').text()
      expect(gridText).toContain('Imóveis Rurais (CAR)')
      expect(gridText).toContain('Reserva Legal')
      expect(gridText).not.toContain('Área de Preservação Permanente (APP)')
      expect(gridText).not.toContain('Uso e Cobertura do Solo')
    })

    it('exibe todas as bases cadastradas ao desmarcar o filtro de prontas', async () => {
      const wrapper = mount(CargaListView)
      await flushPromises()

      await wrapper.find<HTMLInputElement>('[data-testid="toggle-only-prontas"]').setValue(false)
      await flushPromises()

      const cards = wrapper.findAll('[data-testid="catalog-card"]')
      expect(cards.length).toBe(5)
      expect(wrapper.text()).toContain('Área de Preservação Permanente (APP)')
      expect(wrapper.text()).toContain('Uso e Cobertura do Solo')
      expect(wrapper.text()).toContain('Malha Municipal')
    })

    it('filtra a listagem por busca textual de nome, órgão ou identificador', async () => {
      const wrapper = mount(CargaListView)
      await flushPromises()

      const searchInput = wrapper.find('[data-testid="search-input"]')

      // Busca por código identificador
      await searchInput.setValue('102')
      expect(wrapper.findAll('[data-testid="catalog-card"]').length).toBe(1)
      expect(wrapper.text()).toContain('Reserva Legal')

      // Busca por nome do conjunto
      await searchInput.setValue('Imóveis')
      expect(wrapper.findAll('[data-testid="catalog-card"]').length).toBe(1)
      expect(wrapper.text()).toContain('Imóveis Rurais (CAR)')

      // Busca por sigla do órgão emissor
      await searchInput.setValue('INCRA')
      expect(wrapper.findAll('[data-testid="catalog-card"]').length).toBe(1)
      expect(wrapper.text()).toContain('Imóveis Rurais (CAR)')
    })

    it('filtra a listagem por ano da safra e órgão de origem', async () => {
      const wrapper = mount(CargaListView)
      await flushPromises()

      await wrapper.find('[data-testid="tab-todas"]').trigger('click')

      // Filtro por safra 2025
      const yearSelect = wrapper.find('[data-testid="filter-year"]')
      await yearSelect.setValue('2025')
      expect(wrapper.findAll('[data-testid="catalog-card"]').length).toBe(1)
      expect(wrapper.text()).toContain('Reserva Legal')

      // Limpa safra e filtra por órgão IBAMA
      await yearSelect.setValue('')
      const sourceSelect = wrapper.find('[data-testid="filter-source"]')
      await sourceSelect.setValue('IBAMA')
      expect(wrapper.findAll('[data-testid="catalog-card"]').length).toBe(1)
      expect(wrapper.text()).toContain('Área de Preservação Permanente (APP)')
    })

    it('envia os filtros selecionados para o servidor ao acionar o botão filtrar', async () => {
      const getProcessesSpy = vi.spyOn(dashboardService, 'getDashboardProcesses')
      const wrapper = mount(CargaListView)
      await flushPromises()

      getProcessesSpy.mockResolvedValueOnce({
        content: [basesCadastradasMock[1]!],
        totalElements: 1,
        totalPages: 1,
        size: 12,
        number: 0,
        source: 'API',
      })

      await wrapper.find('[data-testid="filter-conjunto"]').setValue('2')
      await wrapper.find('[data-testid="apply-filters"]').trigger('click')
      await flushPromises()

      expect(getProcessesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ conjunto: '2', page: 0 }),
      )
    })

    it('exibe tela de aviso amigável e botão de restauração quando nenhum item corresponder aos filtros', async () => {
      const wrapper = mount(CargaListView)
      await flushPromises()

      await wrapper.find('[data-testid="search-input"]').setValue('termo-sem-resultado-xyz')

      const emptyState = wrapper.find('[data-testid="empty-state"]')
      expect(emptyState.exists()).toBe(true)
      expect(emptyState.text()).toContain('Nenhuma base encontrada para os filtros aplicados')

      // Restaura todos os filtros ao clicar no botão
      await wrapper.find('[data-testid="empty-clear-filters"]').trigger('click')
      await flushPromises()

      expect(wrapper.findAll('[data-testid="catalog-card"]').length).toBeGreaterThan(0)
    })

    it('exibe alerta de erro quando houver timeout ou falha de rede no carregamento', async () => {
      vi.spyOn(dashboardService, 'getDashboardProcesses').mockRejectedValueOnce({
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      })

      const wrapper = mount(CargaListView)
      await flushPromises()

      const toast = wrapper.find('[data-testid="catalog-error-toast"]')
      expect(toast.exists()).toBe(true)
      expect(toast.text().toLowerCase()).toContain('timeout')
    })
  })

  describe('Blindagem de Segurança e Trava de Quarentena por Situação', () => {
    it('desabilita botões analíticos e inspeção para bases em validação ou com falha operacional', async () => {
      const wrapper = mount(CargaListView)
      await flushPromises()

      await wrapper.find<HTMLInputElement>('[data-testid="toggle-only-prontas"]').setValue(false)
      await flushPromises()

      const cards = wrapper.findAll('[data-testid="catalog-card"]')
      const cardValidacao = cards[2]! // Base #103 (Em validação)

      const btnMap = cardValidacao.find('[data-testid="btn-view-map"]')
      const btnCompare = cardValidacao.find('[data-testid="btn-compare-safra"]')
      const btnInspect = cardValidacao.find('[data-testid="btn-inspect-base"]')
      const btnAudit = cardValidacao.find('[data-testid="btn-audit-process"]')

      // Todos os botões devem estar com atributo disabled e classe visual apropriada
      expect(btnMap.attributes('disabled')).toBeDefined()
      expect(btnCompare.attributes('disabled')).toBeDefined()
      expect(btnInspect.attributes('disabled')).toBeDefined()
      expect(btnAudit.attributes('disabled')).toBeDefined()
      expect(btnMap.classes()).toContain('btn-disabled')

      // Mensagem explicativa no tooltip ao passar o cursor
      expect(btnMap.attributes('title')).toBe(QUARANTINE_TOOLTIP)
      expect(btnCompare.attributes('title')).toBe(QUARANTINE_TOOLTIP)
      expect(btnInspect.attributes('title')).toBe(QUARANTINE_TOOLTIP)

      // Clicar em ações bloqueadas não deve executar navegação nem abrir ficha técnica
      await btnMap.trigger('click')
      await btnCompare.trigger('click')
      await btnInspect.trigger('click')

      expect(pushMock).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="catalog-detail-drawer"]').exists()).toBe(false)
    })

    it('permite abrir o mapa interativo e comparar safras para bases com status concluído', async () => {
      const wrapper = mount(CargaListView)
      await flushPromises()

      const firstCard = wrapper.find('[data-testid="catalog-card"]')
      const btnMap = firstCard.find('[data-testid="btn-view-map"]')
      const btnCompare = firstCard.find('[data-testid="btn-compare-safra"]')

      expect(btnMap.attributes('disabled')).toBeUndefined()
      expect(btnCompare.attributes('disabled')).toBeUndefined()

      // Abre no mapa interativo
      await btnMap.trigger('click')
      expect(pushMock).toHaveBeenCalledWith({
        name: 'mapa',
        query: {
          base: 'Imóveis Rurais (CAR)',
          id: '101',
          source: 'INCRA',
          year: '2026',
        },
      })

      // Redireciona para comparação de safra
      await btnCompare.trigger('click')
      expect(pushMock).toHaveBeenCalledWith({
        name: 'analise-territorial',
        query: {
          baseId: '101',
          safra: '2026',
        },
      })
    })

    it('abre o painel lateral com a ficha técnica e metadados ao inspecionar base disponível', async () => {
      const wrapper = mount(CargaListView)
      await flushPromises()

      const firstCard = wrapper.find('[data-testid="catalog-card"]')
      await firstCard.find('[data-testid="btn-inspect-base"]').trigger('click')
      await flushPromises()

      const drawer = wrapper.find('[data-testid="catalog-detail-drawer"]')
      expect(drawer.exists()).toBe(true)
      expect(drawer.text()).toContain('Ficha Técnica e Metadados')
    })
  })

  describe('Painel Lateral de Ficha Técnica e Prévia de Atributos', () => {
    it('renderiza os metadados ricos e as primeiras linhas de atributos recebidas', () => {
      const baseComAtributos: CatalogoItem = {
        id: 101,
        dataset: 'Imóveis Rurais (CAR)',
        stage: 'Publicação',
        status: 'Concluída',
        source: 'INCRA',
        year: '2026',
        tamanho_arquivo: '24.5 MB',
        total_feicoes: 5000,
        epsg: 'SIRGAS 2000 (EPSG:4674)',
        hash_integridade: 'SHA256: abc123def456',
        previa_atributos: [
          { imovel: 'FAZENDA_BOA_VISTA', area_ha: 450.5, status: 'Ativo' },
          { imovel: 'SITIO_ESPERANCA', area_ha: 120.0, status: 'Pendente' },
        ],
      }

      const wrapper = mount(CatalogDetailDrawer, {
        props: {
          base: baseComAtributos,
          isOpen: true,
        },
      })

      expect(wrapper.find('[data-testid="meta-tamanho"]').text()).toBe('24.5 MB')
      expect(wrapper.find('[data-testid="meta-hash"]').text()).toContain('abc123def456')

      const previewTable = wrapper.find('[data-testid="preview-table"]')
      expect(previewTable.exists()).toBe(true)
      expect(previewTable.text()).toContain('FAZENDA_BOA_VISTA')
      expect(previewTable.text()).toContain('SITIO_ESPERANCA')
    })

    it('exibe mensagem informativa quando a base não possuir prévia de atributos', () => {
      const baseSemAtributos: CatalogoItem = {
        id: 102,
        dataset: 'Reserva Legal',
        stage: 'Publicação',
        status: 'Concluída',
        source: 'SICAR',
        year: '2025',
      }

      const wrapper = mount(CatalogDetailDrawer, {
        props: {
          base: baseSemAtributos,
          isOpen: true,
        },
      })

      expect(wrapper.find('[data-testid="preview-empty-state"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Prévia de atributos pontuais não retornada')
    })
  })

  describe('Funções de Negócio: Regras de Disponibilidade, Badges e Ordenação', () => {
    it('avalia a disponibilidade da base estritamente pelo status de conclusão', () => {
      // Casos com liberação autorizada
      expect(isBaseDisponivel({ status: 'Concluída', stage: 'Publicação' })).toBe(true)
      expect(isBaseDisponivel({ status: 'Publicada', stage: 'Publicação' })).toBe(true)
      expect(isBaseDisponivel({ status: 'Disponível' })).toBe(true)

      // Casos retidos ou em processamento
      expect(isBaseDisponivel({ status: 'Em validação', stage: 'Validação' })).toBe(false)
      expect(isBaseDisponivel({ status: 'Em quarentena', stage: 'Validação' })).toBe(false)
      expect(isBaseDisponivel({ status: 'Falhou', stage: 'Ingestão' })).toBe(false)
      expect(isBaseDisponivel({ status: 'Em andamento', stage: 'Tratamento' })).toBe(false)
      expect(isBaseDisponivel(null)).toBe(false)
    })

    it('atribui o rótulo e estilo correto para cada situação operacional da base', () => {
      expect(normalizeSituacaoBadge('Concluída').label).toBe('Disponível')
      expect(normalizeSituacaoBadge('Em andamento').label).toBe('Em andamento')
      expect(normalizeSituacaoBadge('Em validação').label).toBe('Em validação')
      expect(normalizeSituacaoBadge('Falhou').label).toBe('Falhou')
      expect(normalizeSituacaoBadge('Com ressalva').label).toBe('Com ressalva')
    })

    it('ordena coleções de bases por data, ano da safra, nome do conjunto e registros', () => {
      const colecao: CatalogoItem[] = [
        { id: 1, dataset: 'CAR', stage: 'Publicação', status: 'Concluída', source: 'INCRA', year: '2024', data_publicacao: '2026-01-10', total_feicoes: 100 },
        { id: 2, dataset: 'APP', stage: 'Publicação', status: 'Concluída', source: 'IBAMA', year: '2026', data_publicacao: '2026-05-20', total_feicoes: 500 },
        { id: 3, dataset: 'Reserva', stage: 'Publicação', status: 'Concluída', source: 'SICAR', year: '2025', data_publicacao: '2026-03-15', total_feicoes: 300 },
      ]

      // Ordenação por data mais recente
      const porData = sortCatalogoItems(colecao, 'data_desc')
      expect(porData[0]?.id).toBe(2)
      expect(porData[1]?.id).toBe(3)
      expect(porData[2]?.id).toBe(1)

      // Ordenação por safra decrescente
      const porSafra = sortCatalogoItems(colecao, 'safra_desc')
      expect(porSafra[0]?.year).toBe('2026')
      expect(porSafra[1]?.year).toBe('2025')
      expect(porSafra[2]?.year).toBe('2024')

      // Ordenação alfabética pelo nome
      const porNome = sortCatalogoItems(colecao, 'nome_asc')
      expect(porNome[0]?.dataset).toBe('APP')
      expect(porNome[1]?.dataset).toBe('CAR')
      expect(porNome[2]?.dataset).toBe('Reserva')

      // Ordenação por contagem de feições lidas
      const porRegistros = sortCatalogoItems(colecao, 'registros_desc')
      expect(porRegistros[0]?.total_feicoes).toBe(500)
      expect(porRegistros[1]?.total_feicoes).toBe(300)
      expect(porRegistros[2]?.total_feicoes).toBe(100)
    })
  })
})
