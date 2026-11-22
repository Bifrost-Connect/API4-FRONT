import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import AutomatedIngestionTab from '../upload/AutomatedIngestionTab.vue'
import {
  uploadService,
  type ConectorFonteDados,
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
    vi.spyOn(uploadService, 'listarTemplatesConectores').mockResolvedValue([])
    vi.spyOn(uploadService, 'listarConectores').mockResolvedValue([baseConector])
    vi.spyOn(uploadService, 'listarExecucoesIngestao').mockResolvedValue([baseExecucaoConcluida])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('carrega conectores e execuções sem templates rápidos, exibe KPIs, tabelas na ordem correta e modal fechado inicialmente', async () => {
    const wrapper = mountTab()
    await flushPromises()

    expect(uploadService.listarTemplatesConectores).not.toHaveBeenCalled()
    expect(uploadService.listarConectores).toHaveBeenCalledTimes(1)
    expect(uploadService.listarExecucoesIngestao).toHaveBeenCalledTimes(1)

    expect(wrapper.find('[data-testid^="template-btn-"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Templates Públicos')

    expect(wrapper.text()).toContain('Conectores Ativos')
    expect(wrapper.text()).toContain('Agendados')
    expect(wrapper.text()).toContain('Em Execução')
    expect(wrapper.text()).toContain('Concluídas')

    expect(wrapper.find('[data-testid="conector-modal"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="btn-adicionar-fonte"]').exists()).toBe(true)

    const html = wrapper.html()
    const posConectores = html.indexOf('data-testid="tabela-conectores"')
    const posExecucoes = html.indexOf('data-testid="tabela-execucoes"')
    expect(posConectores).toBeGreaterThan(-1)
    expect(posExecucoes).toBeGreaterThan(posConectores)
    expect(wrapper.get('[data-testid="tabela-conectores"]').text()).toContain('NASA FIRMS Diário')
  })

  it('abre modal ao clicar em Adicionar Fonte, alterna placeholder por protocolo e valida URL antes de testar ou salvar', async () => {
    const wrapper = mountTab()
    await flushPromises()

    await wrapper.get('[data-testid="btn-adicionar-fonte"]').trigger('click')
    await flushPromises()

    const modal = wrapper.get('[data-testid="conector-modal"]')
    expect(modal.isVisible()).toBe(true)

    const protocoloSelect = modal.get('[data-testid="conector-protocolo"]')
    const urlInput = modal.get('[data-testid="conector-url"]')

    await protocoloSelect.setValue('OGC_WFS')
    expect(urlInput.attributes('placeholder')).toContain('geoserver')

    await protocoloSelect.setValue('GOOGLE_DRIVE')
    expect(urlInput.attributes('placeholder')).toContain('drive.google.com')

    await protocoloSelect.setValue('HTTP_DIRECT')
    await urlInput.setValue('ftp://invalido')
    await flushPromises()

    expect(modal.find('[data-testid="conector-url-error"]').exists()).toBe(true)
    expect((modal.get('[data-testid="btn-testar-conexao-modal"]').element as HTMLButtonElement).disabled).toBe(true)
    expect((modal.get('[data-testid="btn-salvar-conector"]').element as HTMLButtonElement).disabled).toBe(true)
    expect((modal.get('[data-testid="btn-salvar-executar"]').element as HTMLButtonElement).disabled).toBe(true)

    await urlInput.setValue('https://geoserver.car.gov.br/geoserver/sicar/wfs')
    await flushPromises()

    expect(modal.find('[data-testid="conector-url-error"]').exists()).toBe(false)
    expect((modal.get('[data-testid="btn-testar-conexao-modal"]').element as HTMLButtonElement).disabled).toBe(false)
    expect((modal.get('[data-testid="btn-salvar-conector"]').element as HTMLButtonElement).disabled).toBe(false)

    // Google Drive aceita ID de pasta não vazio
    await protocoloSelect.setValue('GOOGLE_DRIVE')
    await urlInput.setValue('1AbCDefGhIjKlMnOpQrStUvWxYz')
    await flushPromises()
    expect(modal.find('[data-testid="conector-url-error"]').exists()).toBe(false)
    expect((modal.get('[data-testid="btn-salvar-conector"]').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('testa conexão ad-hoc dentro do modal antes de salvar e fecha modal após cadastrar fonte', async () => {
    const testarAdHocSpy = vi
      .spyOn(uploadService, 'testarConectorAdHoc')
      .mockResolvedValueOnce({
        sucesso: true,
        statusHttp: 200,
        mensagem: 'Endpoint WFS respondeu Capabilities com sucesso.',
        tempoMs: 135,
      })
      .mockResolvedValueOnce({
        sucesso: false,
        statusHttp: 401,
        mensagem: 'Token ausente ou inválido.',
        tempoMs: 54,
      })

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

    await wrapper.get('[data-testid="btn-adicionar-fonte"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="conector-nome"]').setValue('NASA FIRMS Cron')
    await wrapper.get('[data-testid="conector-destino"]').setValue('REFERENCIA')
    await wrapper.get('[data-testid="conector-fonte-ref"]').setValue('INPE_QUEIMADA')
    await wrapper.get('[data-testid="conector-protocolo"]').setValue('HTTP_DIRECT')
    await wrapper.get('[data-testid="conector-url"]').setValue(
      'https://firms.modaps.eosdis.nasa.gov/api/country/csv/{API_KEY}/VIIRS_SNPP_NRT/BRA/1',
    )
    await wrapper.get('[data-testid="conector-auth-tipo"]').setValue('API_KEY_QUERY')
    await wrapper.get('[data-testid="conector-cred-nome"]').setValue('MAP_KEY')
    await wrapper.get('[data-testid="conector-cred-valor"]').setValue('super-secret-map-key')
    await wrapper.get('[data-testid="conector-periodicidade"]').setValue('CRON')
    await wrapper.get('[data-testid="conector-cron"]').setValue('0 2 * * *')

    // Teste ad-hoc antes de salvar
    await wrapper.get('[data-testid="btn-testar-conexao-modal"]').trigger('click')
    await flushPromises()

    expect(testarAdHocSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'NASA FIRMS Cron',
        tipoProtocolo: 'HTTP_DIRECT',
        urlBase: 'https://firms.modaps.eosdis.nasa.gov/api/country/csv/{API_KEY}/VIIRS_SNPP_NRT/BRA/1',
        credencial: 'super-secret-map-key',
      }),
    )
    const statusBox = wrapper.get('[data-testid="modal-teste-resultado"]')
    expect(statusBox.text()).toContain('200')
    expect(statusBox.text()).toContain('135')
    expect(statusBox.text()).toContain('Endpoint WFS respondeu Capabilities com sucesso.')

    // Segundo teste retornando erro
    await wrapper.get('[data-testid="btn-testar-conexao-modal"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="modal-teste-resultado"]').text()).toContain('401')
    expect(wrapper.get('[data-testid="modal-teste-resultado"]').text()).toContain('Token ausente ou inválido.')

    // Salva fonte e fecha modal
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
    expect(wrapper.find('[data-testid="conector-modal"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="tabela-conectores"]').text()).toContain('NASA FIRMS Cron')
  })

  it('edita conector existente no modal preservando credencial em branco, alterna visibilidade da senha e fecha após atualizar', async () => {
    const atualizarSpy = vi.spyOn(uploadService, 'atualizarConector').mockResolvedValue({
      ...baseConector,
      nome: 'NASA FIRMS Atualizado',
    })

    const wrapper = mountTab()
    await flushPromises()

    await wrapper.get('[data-testid="btn-editar-conector-1"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="conector-modal"]').exists()).toBe(true)
    const credInput = wrapper.get('[data-testid="conector-cred-valor"]')
    expect((credInput.element as HTMLInputElement).type).toBe('password')
    expect(wrapper.get('[data-testid="conector-modal"]').text()).toContain('nasa****')

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
    expect(wrapper.find('[data-testid="conector-modal"]').exists()).toBe(false)
  })

  it('testa conexão do conector na tabela e exibe resultado de sucesso e falha', async () => {
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
