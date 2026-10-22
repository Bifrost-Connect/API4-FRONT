import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ProcessStageIngestao from '@/components/process-stages/ProcessStageIngestao.vue'
import ProcessStageQuarentena from '@/components/process-stages/ProcessStageQuarentena.vue'
import Auditoria from '@/components/Auditoria.vue'
import DashboardView from '../DashboardView.vue'
import { userService } from '@/services/user'
import { dashboardService } from '@/services/dashboard'
import type { ProcessLogDetails } from '@/services/process'
import type { ProcessVersion } from '@/services/auditoria'

vi.mock('vue-router', () => ({
  useRoute: () => ({
    path: '/auditor',
    params: { id: '9001' },
    query: {},
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  RouterLink: {
    template: '<a><slot /></a>',
  },
}))

const sampleDetails: ProcessLogDetails = {
  id: '9001',
  dataSource: 'API',
  dataset: 'Cálculo de Área de Preservação Permanente (APP)',
  stage: 'Validação',
  status: 'Falhou',
  dateTime: '10/10/2026 15:40',
  layerName: 'Camada APP Hidrográfica',
  source: 'IBAMA',
  year: '2026',
  epsg: 'EPSG:4674',
  epsgDetected: 'EPSG:31983',
  description: 'Submissão com divergência de projeção.',
  integrityHash: '38b7ba9ee2c2d7c9a199015b830184ae',
  originalFileUrl: '/carga/download/9001',
  mapCoordinates: [],
  logs: {
    Ingestão: ['Arquivo recebido'],
  },
  pauseReason: 'Polígonos com auto-interseção detectados',
  quarantineRecords: [],
}

const sampleVersions: ProcessVersion[] = [
  {
    ...sampleDetails,
    id: '9001-v3',
    versionTag: 'v3 (Atual)',
    dateTime: '12/10/2026 18:00',
    changeNote: 'Terceira tentativa após revisão topológica',
  },
  {
    ...sampleDetails,
    id: '9001-v2',
    versionTag: 'v2',
    dateTime: '11/10/2026 14:30',
    changeNote: 'Reprocessamento com ajuste de EPSG',
  },
  {
    ...sampleDetails,
    id: '9001-v1',
    versionTag: 'v1 (Original)',
    dateTime: '10/10/2026 15:40',
    changeNote: 'Submissão inicial do arquivo bruto',
  },
]

describe('US05 - Rastreabilidade da Origem do Indicador e Segurança do Auditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userService.setCurrentUserRole('Operador')
  })

  it('Tarefa 3, 4 e 11: renderiza a Árvore de Linhagem Reversa, o código Hash SHA-256 e destaca divergência de EPSG', () => {
    const wrapper = mount(ProcessStageIngestao, {
      props: {
        details: sampleDetails,
        readOnly: true,
        versions: sampleVersions,
      },
    })

    // Verifica Hash SHA-256
    expect(wrapper.find('[data-testid="integrity-hash"]').text()).toBe(
      '38b7ba9ee2c2d7c9a199015b830184ae',
    )

    // Verifica alerta de divergência entre EPSG Declarado e EPSG Detectado
    expect(wrapper.find('[data-testid="epsg-divergence-banner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="epsg-declared"]').text()).toBe('EPSG:4674')
    expect(wrapper.find('[data-testid="epsg-detected"]').text()).toBe('EPSG:31983')

    // Verifica Árvore de Linhagem Reversa (6 nós na ordem reversa)
    const nodes = wrapper.findAll('[data-testid="lineage-node"]')
    expect(nodes.length).toBe(6)
    expect(nodes[0]!.text()).toContain('1. Status de Publicação')
    expect(nodes[3]!.text()).toContain('2 tentativa(s) anterior(es) registrada(s) no histórico')
    expect(nodes[5]!.text()).toContain('38b7ba9ee2c2d7c9a199015b830184ae')
  })

  it('Tarefa 11: renderiza todas as tentativas de reprocessamento na ordem cronológica correta no painel de Auditoria', () => {
    const wrapper = mount(Auditoria, {
      props: {
        versions: sampleVersions,
        selectedVersionId: '9001-v3',
        cargaId: '9001',
      },
    })

    const items = wrapper.findAll('.location-item')
    expect(items.length).toBe(3)
    expect(items[0]!.text()).toContain('v3 (Atual)')
    expect(items[1]!.text()).toContain('v2')
    expect(items[2]!.text()).toContain('v1 (Original)')
  })

  it('Tarefa 6, 7, 8 e 10: exibe Toasts de erro para exportação vazia, reprocessamento sem arquivo e exige justificativa no cancelamento', async () => {
    userService.setCurrentUserRole('Operador')
    const wrapper = mount(ProcessStageQuarentena, {
      props: {
        details: { ...sampleDetails, quarantineRecords: [] },
        readOnly: false,
      },
    })

    // 1. Exportar relatório de rejeição vazio -> Toast vermelho
    await wrapper.find('[data-testid="btn-export-csv"]').trigger('click')
    expect(wrapper.find('[data-testid="quarantine-error-toast"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quarantine-error-toast"]').text()).toContain('vazio')

    // 2. Tentar confirmar reprocessamento sem anexar arquivo -> Toast vermelho
    await wrapper.find('[data-testid="btn-open-reprocess-modal"]').trigger('click')
    expect(wrapper.find('[data-testid="reprocess-modal"]').exists()).toBe(true)
    await wrapper.find('[data-testid="btn-confirm-reprocess"]').trigger('click')
    expect(wrapper.find('[data-testid="quarantine-error-toast"]').text()).toContain(
      'Anexe um novo arquivo corrigido válido',
    )

    // 3. Modal de Cancelar/Invalidar avisa sobre retenção do Hash e exige justificativa obrigatória
    await wrapper.find('[data-testid="btn-open-cancel-modal"]').trigger('click')
    expect(wrapper.find('[data-testid="cancel-modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="hash-retention-warning"]').text()).toContain(
      '38b7ba9ee2c2d7c9a199015b830184ae',
    )
    await wrapper.find('[data-testid="btn-confirm-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="quarantine-error-toast"]').text()).toContain(
      'justificativa textual obrigatória',
    )
  })

  it('Tarefa 9 e 12 (Segurança de Tela - Auditor): garante que nenhum botão de mutação existe no DOM quando logado como Auditor', async () => {
    userService.setCurrentUserRole('Auditor')

    vi.spyOn(dashboardService, 'getFilterOptions').mockResolvedValue({
      conjuntos: [],
      etapas: [],
      situacoes: [],
    })
    vi.spyOn(dashboardService, 'getAvailableEditors').mockResolvedValue([])
    vi.spyOn(dashboardService, 'getDashboardSummary').mockResolvedValue([])
    vi.spyOn(dashboardService, 'getDashboardProcesses').mockResolvedValue({
      content: [
        {
          id: '9001',
          dateTime: '10/10/2026 15:40',
          dataset: 'APP',
          stage: 'Validação',
          status: 'Falhou',
          quarantined: true,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      size: 10,
      number: 0,
    })

    // 1. Verifica no Dashboard que o Auditor não possui botão de Upload nem botões de Alocar Especialista
    const dashWrapper = mount(DashboardView)
    await flushPromises()
    expect(dashWrapper.find('.btn-upload').exists()).toBe(false)
    expect(dashWrapper.find('.btn_action_editor').exists()).toBe(false)

    // 2. Verifica na etapa de Ingestão que o botão de Editar metadados não existe para o Auditor
    const ingestaoWrapper = mount(ProcessStageIngestao, {
      props: {
        details: sampleDetails,
        readOnly: true,
      },
    })
    expect(ingestaoWrapper.find('[data-testid="btn-edit-metadata"]').exists()).toBe(false)

    // 3. Verifica na Quarentena que os botões de Reprocessar Carga e Cancelar Envio não existem para o Auditor, mas o de Sinalizar Operador existe
    const quarentenaWrapper = mount(ProcessStageQuarentena, {
      props: {
        details: sampleDetails,
        readOnly: true,
      },
    })
    expect(quarentenaWrapper.find('[data-testid="btn-open-reprocess-modal"]').exists()).toBe(false)
    expect(quarentenaWrapper.find('[data-testid="btn-open-cancel-modal"]').exists()).toBe(false)
    expect(quarentenaWrapper.find('[data-testid="btn-signal-operator"]').exists()).toBe(true)
  })
})
