import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import AutomatedIngestionTab from '../upload/AutomatedIngestionTab.vue'
import {
  uploadService,
  type ConectorFonteDados,
  type ConectorTemplate,
  type IngestaoExecucaoItem,
} from '@/services/upload'

enableAutoUnmount(afterEach)

const mockFormOptions = {
  anos: ['2025', '2026'],
  epsgs: [
    { id: '4674', label: 'EPSG:4674 - SIRGAS 2000' },
    { id: '4326', label: 'EPSG:4326 - WGS 84' },
  ],
  orgaos: [
    { id: 1, label: 'SICAR - Sistema Nacional de Cadastro Ambiental Rural' },
    { id: 2, label: 'IBAMA' },
  ],
  conjuntos: [
    { id: 10, label: 'Imóveis rurais (CAR)' },
    { id: 20, label: 'Áreas Embargadas' },
  ],
}

const mockTemplates: ConectorTemplate[] = [
  {
    codigo: 'SICAR_WFS',
    nome: 'SICAR Nacional - Imóveis Rurais',
    descricao: 'Consulta direta ao GeoServer oficial do SICAR.',
    tipoProtocolo: 'OGC_WFS',
    urlBase: 'https://geoserver.car.gov.br/geoserver/sicar/wfs',
    destino: 'CARGA',
    fonteReferencia: null,
    nomeCamadaExibicao: 'Imóveis Rurais SICAR (WFS)',
    formatoDados: 'SHAPE-ZIP',
    epsgOrigem: '4674',
    colunaIdentificador: 'cod_imovel,cod_imovel_,cod_car',
    parametrosJson: { version: '1.0.0', typeName: 'sicar:sicar_imoveis_pr', uf: 'PR', maxFeatures: 5000 },
    tipoAutenticacao: 'NONE',
    nomeCredencial: null,
    periodicidade: 'MANUAL',
  },
  {
    codigo: 'NASA_FIRMS_API',
    nome: 'NASA FIRMS - Focos de Calor Ativos VIIRS',
    descricao: 'Focos ativos de calor VIIRS NRT Brasil via API REST da NASA FIRMS.',
    tipoProtocolo: 'HTTP_DIRECT',
    urlBase: 'https://firms.modaps.eosdis.nasa.gov/api/country/csv/{API_KEY}/VIIRS_SNPP_NRT/BRA/1',
    destino: 'REFERENCIA',
    fonteReferencia: 'INPE_QUEIMADA',
    nomeCamadaExibicao: 'Focos de Calor Ativos VIIRS (NASA FIRMS)',
    formatoDados: 'CSV',
    epsgOrigem: '4326',
    colunaIdentificador: 'latitude,acq_date',
    parametrosJson: {},
    tipoAutenticacao: 'API_KEY_QUERY',
    nomeCredencial: 'MAP_KEY',
    periodicidade: 'MANUAL',
  },
]

const baseConector: ConectorFonteDados = {
  id: 1,
  nome: 'NASA FIRMS Diário',
  descricao: 'Focos de calor',
  tipoProtocolo: 'HTTP_DIRECT',
  urlBase: 'https://firms.modaps.eosdis.nasa.gov/api/country/csv/{API_KEY}/VIIRS_SNPP_NRT/BRA/1',
  destino: 'REFERENCIA',
  fonteReferencia: 'INPE_QUEIMADA',
  nomeCamadaExibicao: 'Focos VIIRS',
  orgaoId: null,
  orgaoSigla: null,
  conjuntoId: null,
  conjuntoNome: null,
  formatoDados: 'CSV',
  epsgOrigem: '4326',
  colunaIdentificador: 'latitude,acq_date',
  parametrosJson: {},
  tipoAutenticacao: 'API_KEY_QUERY',
  nomeCredencial: 'MAP_KEY',
  prefixoCredencial: 'nasa****',
  possuiCredencial: true,
  periodicidade: 'DIARIA',
  expressaoCron: null,
  ativo: true,
  ultimaExecucaoEm: '2026-11-20T10:00:00',
  proximaExecucaoEm: '2026-11-21T10:00:00',
  ultimoStatus: 'CARREGADO',
  criadoPorId: 1,
  dataCriacao: '2026-11-20T09:00:00',
  dataAtualizacao: '2026-11-20T10:00:00',
}

const baseExecucaoConcluida: IngestaoExecucaoItem = {
  id: 101,
  conectorId: 1,
  conectorNome: 'NASA FIRMS Diário',
  dagRunId: 'manual__2026-11-20T10:00:00',
  nomeArquivo: 'firms_bra.csv',
  driveCaminho: 'https://firms.modaps.eosdis.nasa.gov/...',
  destino: 'CARGA',
  fonte: 'INPE_QUEIMADA',
  statusBanco: 'CARREGADO',
  etapaUi: 'CONCLUIDO',
  processoId: 77,
  etapaProcesso: 'VALIDACAO',
  situacaoProcesso: 'EM_ANDAMENTO',
  linhasCarregadas: 1250,
  linhasDescartadas: 2,
  tamanhoBytes: 65536,
  hashSha256: 'abc123sha256hash',
  md5Drive: 'md5xyz987',
  mensagem: 'Ingestão finalizada com sucesso.',
  dataInicio: '2026-11-20T10:00:00',
  dataFim: '2026-11-20T10:00:15',
  duracaoSegundos: 15,
}

const mountTab = () =>
  mount(AutomatedIngestionTab, {
    props: { formOptions: mockFormOptions },
    global: {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a :href="typeof to === \'string\' ? to : String(to)"><slot /></a>',
        },
      },
    },
  })

describe('AutomatedIngestionTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.spyOn(uploadService, 'listarTemplatesConectores').mockResolvedValue(mockTemplates)
    vi.spyOn(uploadService, 'listarConectores').mockResolvedValue([baseConector])
    vi.spyOn(uploadService, 'listarExecucoesIngestao').mockResolvedValue([baseExecucaoConcluida])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('carrega templates, conectores e KPIs na inicialização', async () => {
    const wrapper = mountTab()
    await flushPromises()

    expect(uploadService.listarTemplatesConectores).toHaveBeenCalledTimes(1)
    expect(uploadService.listarConectores).toHaveBeenCalledTimes(1)
    expect(uploadService.listarExecucoesIngestao).toHaveBeenCalledTimes(1)

    expect(wrapper.text()).toContain('Conectores Ativos')
    expect(wrapper.text()).toContain('Agendados (Automáticos)')
    expect(wrapper.text()).toContain('Em Execução na DAG')
    expect(wrapper.text()).toContain('Concluídas no PostGIS')
    expect(wrapper.get('[data-testid="tabela-conectores"]').text()).toContain('NASA FIRMS Diário')
  })

  it('aplica template SICAR_WFS autopreenchendo WFS e órgão/conjunto de CARGA e limpa com Conector Personalizado', async () => {
    const wrapper = mountTab()
    await flushPromises()

    await wrapper.get('[data-testid="template-btn-SICAR_WFS"]').trigger('click')
    await flushPromises()

    expect((wrapper.get('[data-testid="conector-nome"]').element as HTMLInputElement).value).toBe(
      'SICAR Nacional - Imóveis Rurais',
    )
    expect((wrapper.get('[data-testid="conector-destino"]').element as HTMLSelectElement).value).toBe('CARGA')
    expect((wrapper.get('[data-testid="conector-protocolo"]').element as HTMLSelectElement).value).toBe('OGC_WFS')
    expect((wrapper.get('[data-testid="conector-wfs-typename"]').element as HTMLInputElement).value).toBe(
      'sicar:sicar_imoveis_pr',
    )
    expect((wrapper.get('[data-testid="conector-wfs-uf"]').element as HTMLSelectElement).value).toBe('PR')
    expect((wrapper.get('[data-testid="conector-orgao"]').element as HTMLSelectElement).value).toBe('1')
    expect((wrapper.get('[data-testid="conector-conjunto"]').element as HTMLSelectElement).value).toBe('10')

    await wrapper.get('[data-testid="template-btn-CUSTOM"]').trigger('click')
    expect((wrapper.get('[data-testid="conector-nome"]').element as HTMLInputElement).value).toBe('')
    expect((wrapper.get('[data-testid="conector-url"]').element as HTMLInputElement).value).toBe('')
  })

  it('cadastra conector NASA_FIRMS_API com chave de API e agendamento CRON', async () => {
    const createdConector: ConectorFonteDados = {
      ...baseConector,
      id: 2,
      nome: 'NASA FIRMS Cron',
      periodicidade: 'CRON',
      expressaoCron: '0 2 * * *',
    }
    const criarSpy = vi.spyOn(uploadService, 'criarConector').mockResolvedValue(createdConector)

    const wrapper = mountTab()
    await flushPromises()

    await wrapper.get('[data-testid="template-btn-NASA_FIRMS_API"]').trigger('click')
    await wrapper.get('[data-testid="conector-nome"]').setValue('NASA FIRMS Cron')
    await wrapper.get('[data-testid="conector-cred-valor"]').setValue('super-secret-map-key')
    await wrapper.get('[data-testid="conector-periodicidade"]').setValue('CRON')
    await wrapper.get('[data-testid="conector-cron"]').setValue('0 2 * * *')

    await wrapper.get('[data-testid="btn-salvar-conector"]').trigger('click')
    await flushPromises()

    expect(criarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'NASA FIRMS Cron',
        tipoProtocolo: 'HTTP_DIRECT',
        destino: 'REFERENCIA',
        fonteReferencia: 'INPE_QUEIMADA',
        tipoAutenticacao: 'API_KEY_QUERY',
        nomeCredencial: 'MAP_KEY',
        credencial: 'super-secret-map-key',
        periodicidade: 'CRON',
        expressaoCron: '0 2 * * *',
      }),
    )
  })

  it('edita conector existente preservando credencial quando campo é mantido em branco e alterna visibilidade da senha', async () => {
    const atualizarSpy = vi.spyOn(uploadService, 'atualizarConector').mockResolvedValue({
      ...baseConector,
      nome: 'NASA FIRMS Atualizado',
    })

    const wrapper = mountTab()
    await flushPromises()

    await wrapper.get('[data-testid="btn-editar-conector-1"]').trigger('click')
    await flushPromises()

    const credInput = wrapper.get('[data-testid="conector-cred-valor"]')
    expect((credInput.element as HTMLInputElement).type).toBe('password')
    expect(wrapper.text()).toContain('nasa****')

    await wrapper.get('[data-testid="btn-toggle-cred-visibility"]').trigger('click')
    expect((credInput.element as HTMLInputElement).type).toBe('text')

    await wrapper.get('[data-testid="conector-nome"]').setValue('NASA FIRMS Atualizado')
    await wrapper.get('[data-testid="btn-salvar-conector"]').trigger('click')
    await flushPromises()

    expect(atualizarSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        nome: 'NASA FIRMS Atualizado',
        credencial: undefined,
      }),
    )
  })

  it('testa conexão do conector e exibe resultado de sucesso e falha', async () => {
    const testarSpy = vi
      .spyOn(uploadService, 'testarConector')
      .mockResolvedValueOnce({
        sucesso: true,
        statusHttp: 200,
        mensagem: 'Conexão validada com sucesso.',
        tempoMs: 142,
      })
      .mockResolvedValueOnce({
        sucesso: false,
        statusHttp: 403,
        mensagem: 'Chave de API inválida.',
        tempoMs: 88,
      })

    const wrapper = mountTab()
    await flushPromises()

    await wrapper.get('[data-testid="btn-testar-conector-1"]').trigger('click')
    await flushPromises()

    expect(testarSpy).toHaveBeenCalledWith(1)
    expect(wrapper.text()).toContain('200')
    expect(wrapper.text()).toContain('142')
    expect(wrapper.text()).toContain('Conexão validada com sucesso.')

    await wrapper.get('[data-testid="btn-testar-conector-1"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('403')
    expect(wrapper.text()).toContain('Chave de API inválida.')
  })

  it('dispara execução da DAG, faz polling automático das etapas até CONCLUIDO e limpa timer ao desmontar', async () => {
    vi.useFakeTimers()

    const execPendente: IngestaoExecucaoItem = {
      ...baseExecucaoConcluida,
      id: 200,
      dagRunId: 'manual__2026-11-21T12:00:00',
      statusBanco: 'EM_ANDAMENTO',
      etapaUi: 'PENDENTE',
      processoId: null,
      mensagem: 'Aguardando worker Airflow',
    }
    const execBaixando: IngestaoExecucaoItem = {
      ...execPendente,
      etapaUi: 'BAIXANDO',
      mensagem: '[BAIXANDO] Baixando pacote remoto...',
    }
    const execPostgis: IngestaoExecucaoItem = {
      ...execPendente,
      etapaUi: 'PROCESSANDO_POSTGIS',
      mensagem: '[PROCESSANDO_POSTGIS] Gravando feições no PostGIS...',
    }
    const execConcluida: IngestaoExecucaoItem = {
      ...execPendente,
      statusBanco: 'CARREGADO',
      etapaUi: 'CONCLUIDO',
      processoId: 99,
      mensagem: 'Carga concluída.',
    }

    const listExecSpy = vi
      .spyOn(uploadService, 'listarExecucoesIngestao')
      .mockResolvedValueOnce([baseExecucaoConcluida])
      .mockResolvedValueOnce([execBaixando])
      .mockResolvedValueOnce([execPostgis])
      .mockResolvedValueOnce([execConcluida])

    vi.spyOn(uploadService, 'executarConector').mockResolvedValue(execPendente)

    const wrapper = mountTab()
    await flushPromises()

    await wrapper.get('[data-testid="btn-executar-conector-1"]').trigger('click')
    await flushPromises()

    const tracker = wrapper.get('[data-testid="dag-realtime-tracker"]')
    expect(tracker.text()).toContain('Pendente')

    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()
    expect(wrapper.get('[data-testid="dag-realtime-tracker"]').text()).toContain('Baixando')

    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()
    expect(wrapper.get('[data-testid="dag-realtime-tracker"]').text()).toContain('Processando PostGIS')

    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()
    expect(wrapper.get('[data-testid="dag-realtime-tracker"]').text()).toContain('Concluído')

    // Terminal state stops polling
    const callsAtCompletion = listExecSpy.mock.calls.length
    await vi.advanceTimersByTimeAsync(6000)
    await flushPromises()
    expect(listExecSpy).toHaveBeenCalledTimes(callsAtCompletion)

    // Also verify unmount clears interval while active execution is running
    listExecSpy.mockResolvedValue([execBaixando])
    await wrapper.get('[data-testid="btn-executar-conector-1"]').trigger('click')
    await flushPromises()
    const callsBeforeUnmount = listExecSpy.mock.calls.length
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(9000)
    expect(listExecSpy).toHaveBeenCalledTimes(callsBeforeUnmount)
  })

  it('renderiza histórico com link para /processo/:id, detalhes expandidos e estado de erro', async () => {
    const execErro: IngestaoExecucaoItem = {
      ...baseExecucaoConcluida,
      id: 102,
      dagRunId: 'manual__erro',
      statusBanco: 'FALHOU',
      etapaUi: 'ERRO',
      processoId: null,
      mensagem: 'Timeout ao conectar na fonte externa.',
    }
    vi.spyOn(uploadService, 'listarExecucoesIngestao').mockResolvedValue([
      baseExecucaoConcluida,
      execErro,
    ])

    const wrapper = mountTab()
    await flushPromises()

    const tabelaExec = wrapper.get('[data-testid="tabela-execucoes"]')
    expect(tabelaExec.text()).toContain('Concluído')
    expect(tabelaExec.text()).toContain('Erro')

    const esteiraLink = tabelaExec.get('a[href="/processo/77"]')
    expect(esteiraLink.text()).toContain('Ver na Esteira')

    // Click row to expand details
    const rows = tabelaExec.findAll('tbody tr.clickable-row')
    await rows[0]!.trigger('click')
    await flushPromises()

    expect(tabelaExec.text()).toContain('abc123sha256hash')
    expect(tabelaExec.text()).toContain('md5xyz987')
    expect(tabelaExec.text()).toContain('manual__2026-11-20T10:00:00')
  })

  it('permite alternar ativo/pausado e excluir conector e exibe erro se ação falhar', async () => {
    const toggleSpy = vi.spyOn(uploadService, 'alternarAtivoConector').mockResolvedValue({
      ...baseConector,
      ativo: false,
    })
    const excluirSpy = vi
      .spyOn(uploadService, 'excluirConector')
      .mockRejectedValueOnce(new Error('Falha ao remover'))
      .mockResolvedValueOnce(undefined)

    const wrapper = mountTab()
    await flushPromises()

    await wrapper.get('[data-testid="btn-toggle-conector-1"]').trigger('click')
    await flushPromises()
    expect(toggleSpy).toHaveBeenCalledWith(1, false)

    await wrapper.get('[data-testid="btn-excluir-conector-1"]').trigger('click')
    await flushPromises()
    expect(excluirSpy).toHaveBeenCalledWith(1)
    expect(wrapper.text()).toContain('Falha ao remover')

    await wrapper.get('[data-testid="btn-excluir-conector-1"]').trigger('click')
    await flushPromises()
    expect(excluirSpy).toHaveBeenCalledTimes(2)
  })
})
