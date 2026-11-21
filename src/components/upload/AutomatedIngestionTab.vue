<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  FiActivity,
  FiAlertCircle,
  FiCheck,
  FiClock,
  FiDatabase,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiKey,
  FiPause,
  FiPlay,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiZap,
} from 'vue-icons-plus/fi'
import CardContainer from '@/components/CardContainer.vue'
import DataTable, { type Column } from '@/components/DataTable.vue'
import {
  uploadService,
  type ConectorFonteDados,
  type ConectorFontePayload,
  type ConectorTemplate,
  type DestinoConector,
  type EtapaIngestaoUi,
  type FormatoDadosConector,
  type IngestaoExecucaoItem,
  type PeriodicidadeConector,
  type TesteConexaoResponse,
  type TipoAutenticacaoConector,
  type TipoProtocoloConector,
  type UploadFormOptions,
} from '@/services/upload'

const props = withDefaults(
  defineProps<{
    formOptions?: UploadFormOptions
  }>(),
  {
    formOptions: () => ({ anos: [], epsgs: [], orgaos: [], conjuntos: [] }),
  },
)

const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

const FONTES_REFERENCIA_SUGESTOES = [
  'INPE_QUEIMADA',
  'FUNAI_TERRA_INDIGENA',
  'IBAMA_EMBARGO',
  'INPE_DESMATAMENTO_CERRADO',
  'IBGE_BIOMA_250MIL',
]

const ACTIVE_ETAPAS: EtapaIngestaoUi[] = ['PENDENTE', 'BAIXANDO', 'PROCESSANDO_POSTGIS']

const templates = ref<ConectorTemplate[]>([])
const conectores = ref<ConectorFonteDados[]>([])
const execucoes = ref<IngestaoExecucaoItem[]>([])

const isLoadingData = ref(false)
const isSaving = ref(false)
const testingId = ref<number | null>(null)
const executingId = ref<number | null>(null)
const selectedTemplateCode = ref<string>('CUSTOM')

const editingId = ref<number | null>(null)
const editingPossuiCredencial = ref(false)
const editingPrefixoCredencial = ref<string | null>(null)
const showCredencial = ref(false)

const feedbackErro = ref<string | null>(null)
const feedbackSucesso = ref<string | null>(null)
const testeResultado = ref<(TesteConexaoResponse & { conectorNome: string }) | null>(null)
const latestTriggeredRunId = ref<number | null>(null)

let pollingTimer: ReturnType<typeof setInterval> | null = null

const form = reactive<{
  nome: string
  descricao: string
  tipoProtocolo: TipoProtocoloConector
  urlBase: string
  destino: DestinoConector
  fonteReferencia: string
  nomeCamadaExibicao: string
  orgaoId: string | number
  conjuntoId: string | number
  formatoDados: FormatoDadosConector
  epsgOrigem: string
  colunaIdentificador: string
  tipoAutenticacao: TipoAutenticacaoConector
  nomeCredencial: string
  credencial: string
  periodicidade: PeriodicidadeConector
  expressaoCron: string
  ativo: boolean
  wfsTypeName: string
  wfsUf: string
  wfsMunicipio: string
  wfsCar: string
  wfsSituacao: string
  wfsMaxFeatures: string
  wfsCql: string
  extraJsonText: string
  helperWhere: string
  helperLatColumn: string
  helperLonColumn: string
  driveFolderId: string
  driveSubfolder: string
  driveRegex: string
}>({
  nome: '',
  descricao: '',
  tipoProtocolo: 'HTTP_DIRECT',
  urlBase: '',
  destino: 'CARGA',
  fonteReferencia: '',
  nomeCamadaExibicao: '',
  orgaoId: '',
  conjuntoId: '',
  formatoDados: 'GEOJSON',
  epsgOrigem: '4674',
  colunaIdentificador: 'cod_imovel,ogc_fid',
  tipoAutenticacao: 'NONE',
  nomeCredencial: '',
  credencial: '',
  periodicidade: 'MANUAL',
  expressaoCron: '',
  ativo: true,
  wfsTypeName: '',
  wfsUf: '',
  wfsMunicipio: '',
  wfsCar: '',
  wfsSituacao: '',
  wfsMaxFeatures: '5000',
  wfsCql: '',
  extraJsonText: '{}',
  helperWhere: '',
  helperLatColumn: '',
  helperLonColumn: '',
  driveFolderId: '',
  driveSubfolder: '',
  driveRegex: '',
})

const conectoresColumns: Column[] = [
  { key: 'nome', label: 'Nome & Protocolo' },
  { key: 'destino', label: 'Destino / Fonte' },
  { key: 'autenticacao', label: 'Autenticação' },
  { key: 'periodicidade', label: 'Periodicidade' },
  { key: 'ultimoStatus', label: 'Último Status' },
  { key: 'acoes', label: 'Ações' },
]

const execucoesColumns: Column[] = [
  { key: 'id', label: 'ID / Run' },
  { key: 'nomeArquivo', label: 'Arquivo / Fonte' },
  { key: 'destino', label: 'Destino' },
  { key: 'linhasCarregadas', label: 'Feições' },
  { key: 'etapaUi', label: 'Status da DAG' },
  { key: 'duracaoSegundos', label: 'Duração' },
  { key: 'acoes', label: 'Ações' },
]

const kpiConectoresAtivos = computed(() => conectores.value.filter((c) => c.ativo).length)
const kpiAgendados = computed(
  () => conectores.value.filter((c) => c.ativo && c.periodicidade !== 'MANUAL').length,
)
const kpiEmExecucao = computed(
  () => execucoes.value.filter((e) => ACTIVE_ETAPAS.includes(e.etapaUi)).length,
)
const kpiConcluidas = computed(
  () => execucoes.value.filter((e) => e.etapaUi === 'CONCLUIDO').length,
)

const activeTrackerExecution = computed<IngestaoExecucaoItem | null>(() => {
  const running = execucoes.value.find((e) => ACTIVE_ETAPAS.includes(e.etapaUi))
  if (running) return running
  if (latestTriggeredRunId.value !== null) {
    return execucoes.value.find((e) => e.id === latestTriggeredRunId.value) ?? execucoes.value[0] ?? null
  }
  return null
})

const periodicidadeBadgeInfo = computed(() => {
  const map: Record<PeriodicidadeConector, string> = {
    MANUAL: 'Execução sob demanda',
    HORARIA: 'Cron automático: a cada hora (0 * * * *)',
    DIARIA: 'Cron automático: todo dia às 02:00 (0 2 * * *)',
    SEMANAL: 'Cron automático: toda segunda às 03:00 (0 3 * * 1)',
    MENSAL: 'Cron automático: dia 1 de cada mês às 04:00 (0 4 1 * *)',
    CRON: 'Expressão Cron personalizada',
  }
  return map[form.periodicidade]
})

const extractErrorMessage = (err: any): string => {
  const data = err?.response?.data
  if (typeof data === 'string' && data.trim()) return data
  if (data && typeof data === 'object') {
    return data.message || data.mensagem || data.erro || data.error || err.message || 'Falha na requisição.'
  }
  return err?.message || 'Ocorreu um erro inesperado na comunicação com o servidor.'
}

const syncProtocolFieldsFromJson = (protocolo: TipoProtocoloConector, params: Record<string, unknown> | null | undefined) => {
  const p = params || {}
  if (protocolo === 'OGC_WFS') {
    form.wfsTypeName = typeof p.typeName === 'string' ? p.typeName : ''
    form.wfsUf = typeof p.uf === 'string' ? p.uf : ''
    form.wfsMunicipio = typeof p.municipio === 'string' ? p.municipio : typeof p.cod_municipio === 'string' ? p.cod_municipio : ''
    form.wfsCar = typeof p.cod_imovel === 'string' ? p.cod_imovel : ''
    form.wfsSituacao = typeof p.situacao === 'string' ? p.situacao : ''
    form.wfsMaxFeatures = p.maxFeatures !== undefined && p.maxFeatures !== null ? String(p.maxFeatures) : '5000'
    form.wfsCql = typeof p.cql_filter === 'string' ? p.cql_filter : ''
  } else if (protocolo === 'GOOGLE_DRIVE') {
    form.driveFolderId = typeof p.folderId === 'string' ? p.folderId : typeof p.fileId === 'string' ? p.fileId : ''
    form.driveSubfolder = typeof p.subfolder === 'string' ? p.subfolder : ''
    form.driveRegex = typeof p.fileRegex === 'string' ? p.fileRegex : ''
  } else {
    form.helperWhere = typeof p.where === 'string' ? p.where : ''
    form.helperLatColumn = typeof p.latColumn === 'string' ? p.latColumn : ''
    form.helperLonColumn = typeof p.lonColumn === 'string' ? p.lonColumn : ''
    form.extraJsonText = Object.keys(p).length > 0 ? JSON.stringify(p, null, 2) : '{}'
  }
}

const buildParametrosJson = (): Record<string, unknown> => {
  if (form.tipoProtocolo === 'OGC_WFS') {
    const out: Record<string, unknown> = { version: '1.0.0' }
    if (form.wfsTypeName.trim()) out.typeName = form.wfsTypeName.trim()
    if (form.wfsUf.trim()) out.uf = form.wfsUf.trim().toUpperCase()
    if (form.wfsMunicipio.trim()) out.municipio = form.wfsMunicipio.trim()
    if (form.wfsCar.trim()) out.cod_imovel = form.wfsCar.trim()
    if (form.wfsSituacao.trim()) out.situacao = form.wfsSituacao.trim()
    const maxFeat = Number(form.wfsMaxFeatures)
    if (Number.isFinite(maxFeat) && maxFeat > 0) out.maxFeatures = maxFeat
    if (form.wfsCql.trim()) out.cql_filter = form.wfsCql.trim()
    return out
  }
  if (form.tipoProtocolo === 'GOOGLE_DRIVE') {
    const out: Record<string, unknown> = {}
    if (form.driveFolderId.trim()) out.folderId = form.driveFolderId.trim()
    if (form.driveSubfolder.trim()) out.subfolder = form.driveSubfolder.trim()
    if (form.driveRegex.trim()) out.fileRegex = form.driveRegex.trim()
    return out
  }

  let parsed: Record<string, unknown> = {}
  const raw = form.extraJsonText.trim()
  if (raw) {
    try {
      const val = JSON.parse(raw)
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        parsed = val
      }
    } catch {
      throw new Error('JSON de parâmetros extras inválido. Verifique a sintaxe.')
    }
  }
  if (form.helperWhere.trim()) parsed.where = form.helperWhere.trim()
  if (form.helperLatColumn.trim()) parsed.latColumn = form.helperLatColumn.trim()
  if (form.helperLonColumn.trim()) parsed.lonColumn = form.helperLonColumn.trim()
  return parsed
}

const onWfsUfChange = () => {
  if (!form.wfsUf) return
  const ufLower = form.wfsUf.toLowerCase()
  if (!form.wfsTypeName || form.wfsTypeName.startsWith('sicar:sicar_imoveis_')) {
    form.wfsTypeName = `sicar:sicar_imoveis_${ufLower}`
  }
}

const autoSelectCargaOptions = () => {
  if (form.destino !== 'CARGA') return
  if (!form.orgaoId && props.formOptions.orgaos.length > 0) {
    const sicarOrgao = props.formOptions.orgaos.find((o) =>
      o.label.toLowerCase().includes('sicar') || o.label.toLowerCase().includes('car'),
    )
    form.orgaoId = (sicarOrgao ?? props.formOptions.orgaos[0])!.id
  }
  if (!form.conjuntoId && props.formOptions.conjuntos.length > 0) {
    const imoveisConjunto = props.formOptions.conjuntos.find((c) => {
      const l = c.label.toLowerCase()
      return l.includes('imóv') || l.includes('imov') || l.includes('car')
    })
    form.conjuntoId = (imoveisConjunto ?? props.formOptions.conjuntos[0])!.id
  }
}

const resetForm = () => {
  editingId.value = null
  editingPossuiCredencial.value = false
  editingPrefixoCredencial.value = null
  showCredencial.value = false
  selectedTemplateCode.value = 'CUSTOM'

  form.nome = ''
  form.descricao = ''
  form.tipoProtocolo = 'HTTP_DIRECT'
  form.urlBase = ''
  form.destino = 'CARGA'
  form.fonteReferencia = ''
  form.nomeCamadaExibicao = ''
  form.orgaoId = ''
  form.conjuntoId = ''
  form.formatoDados = 'GEOJSON'
  form.epsgOrigem = '4674'
  form.colunaIdentificador = 'cod_imovel,ogc_fid'
  form.tipoAutenticacao = 'NONE'
  form.nomeCredencial = ''
  form.credencial = ''
  form.periodicidade = 'MANUAL'
  form.expressaoCron = ''
  form.ativo = true
  syncProtocolFieldsFromJson('HTTP_DIRECT', {})
}

const applyTemplate = (tpl: ConectorTemplate) => {
  editingId.value = null
  editingPossuiCredencial.value = false
  editingPrefixoCredencial.value = null
  showCredencial.value = false
  selectedTemplateCode.value = tpl.codigo
  feedbackErro.value = null

  form.nome = tpl.nome
  form.descricao = tpl.descricao || ''
  form.tipoProtocolo = tpl.tipoProtocolo
  form.urlBase = tpl.urlBase
  form.destino = tpl.destino
  form.fonteReferencia = tpl.fonteReferencia || ''
  form.nomeCamadaExibicao = tpl.nomeCamadaExibicao || ''
  form.orgaoId = ''
  form.conjuntoId = ''
  form.formatoDados = tpl.formatoDados
  form.epsgOrigem = tpl.epsgOrigem || '4674'
  form.colunaIdentificador = tpl.colunaIdentificador || 'cod_imovel,ogc_fid'
  form.tipoAutenticacao = tpl.tipoAutenticacao || 'NONE'
  form.nomeCredencial = tpl.nomeCredencial || ''
  form.credencial = ''
  form.periodicidade = tpl.periodicidade || 'MANUAL'
  form.expressaoCron = ''
  form.ativo = true

  syncProtocolFieldsFromJson(tpl.tipoProtocolo, tpl.parametrosJson)
  autoSelectCargaOptions()
}

const editConector = (item: ConectorFonteDados) => {
  editingId.value = item.id
  editingPossuiCredencial.value = item.possuiCredencial
  editingPrefixoCredencial.value = item.prefixoCredencial
  showCredencial.value = false
  selectedTemplateCode.value = 'CUSTOM'
  feedbackErro.value = null
  feedbackSucesso.value = null

  form.nome = item.nome
  form.descricao = item.descricao || ''
  form.tipoProtocolo = item.tipoProtocolo
  form.urlBase = item.urlBase
  form.destino = item.destino
  form.fonteReferencia = item.fonteReferencia || ''
  form.nomeCamadaExibicao = item.nomeCamadaExibicao || ''
  form.orgaoId = item.orgaoId ?? ''
  form.conjuntoId = item.conjuntoId ?? ''
  form.formatoDados = item.formatoDados
  form.epsgOrigem = item.epsgOrigem || '4674'
  form.colunaIdentificador = item.colunaIdentificador || 'cod_imovel,ogc_fid'
  form.tipoAutenticacao = item.tipoAutenticacao || 'NONE'
  form.nomeCredencial = item.nomeCredencial || ''
  form.credencial = ''
  form.periodicidade = item.periodicidade || 'MANUAL'
  form.expressaoCron = item.expressaoCron || ''
  form.ativo = item.ativo

  syncProtocolFieldsFromJson(item.tipoProtocolo, item.parametrosJson)
}

const buildPayload = (): ConectorFontePayload => {
  const parametrosJson = buildParametrosJson()
  const trimmedCred = form.credencial.trim()
  return {
    nome: form.nome.trim(),
    descricao: form.descricao.trim() || null,
    tipoProtocolo: form.tipoProtocolo,
    urlBase: form.urlBase.trim(),
    destino: form.destino,
    fonteReferencia: form.destino === 'REFERENCIA' ? form.fonteReferencia.trim() || null : null,
    nomeCamadaExibicao: form.nomeCamadaExibicao.trim() || null,
    orgaoId: form.destino === 'CARGA' && form.orgaoId !== '' ? Number(form.orgaoId) : null,
    conjuntoId: form.destino === 'CARGA' && form.conjuntoId !== '' ? Number(form.conjuntoId) : null,
    formatoDados: form.formatoDados,
    epsgOrigem: form.epsgOrigem.trim() || '4674',
    colunaIdentificador: form.colunaIdentificador.trim() || 'cod_imovel,ogc_fid',
    parametrosJson,
    tipoAutenticacao: form.tipoAutenticacao,
    nomeCredencial: form.tipoAutenticacao !== 'NONE' ? form.nomeCredencial.trim() || null : null,
    credencial:
      form.tipoAutenticacao !== 'NONE' && trimmedCred.length > 0 ? trimmedCred : undefined,
    periodicidade: form.periodicidade,
    expressaoCron: form.periodicidade === 'CRON' ? form.expressaoCron.trim() || null : null,
    ativo: form.ativo,
  }
}

const stopPolling = () => {
  if (pollingTimer !== null) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
}

const ensurePollingState = () => {
  const hasActive = execucoes.value.some((e) => ACTIVE_ETAPAS.includes(e.etapaUi))
  if (hasActive && pollingTimer === null) {
    pollingTimer = setInterval(() => {
      void refreshExecucoes()
    }, 3000)
  } else if (!hasActive && pollingTimer !== null) {
    stopPolling()
  }
}

const refreshExecucoes = async () => {
  try {
    execucoes.value = await uploadService.listarExecucoesIngestao({ limit: 50 })
    ensurePollingState()
  } catch (err) {
    feedbackErro.value = extractErrorMessage(err)
  }
}

const loadAll = async () => {
  isLoadingData.value = true
  try {
    const [tpls, conns, execs] = await Promise.all([
      uploadService.listarTemplatesConectores(),
      uploadService.listarConectores(),
      uploadService.listarExecucoesIngestao({ limit: 50 }),
    ])
    templates.value = tpls
    conectores.value = conns
    execucoes.value = execs
    ensurePollingState()
  } catch (err) {
    feedbackErro.value = extractErrorMessage(err)
  } finally {
    isLoadingData.value = false
  }
}

const saveConector = async (executarAposSalvar = false) => {
  feedbackErro.value = null
  feedbackSucesso.value = null
  if (!form.nome.trim() || !form.urlBase.trim()) {
    feedbackErro.value = 'Preencha os campos obrigatórios: Nome do Conector e URL Base.'
    return
  }
  if (form.destino === 'REFERENCIA' && !form.fonteReferencia.trim()) {
    feedbackErro.value = 'Informe o Código da Fonte de Referência para conectores do tipo REFERENCIA.'
    return
  }

  isSaving.value = true
  try {
    const payload = buildPayload()
    let saved: ConectorFonteDados
    if (editingId.value !== null) {
      saved = await uploadService.atualizarConector(editingId.value, payload)
      conectores.value = conectores.value.map((c) => (c.id === saved.id ? saved : c))
      feedbackSucesso.value = `Conector "${saved.nome}" atualizado com sucesso.`
    } else {
      saved = await uploadService.criarConector(payload)
      conectores.value = [saved, ...conectores.value]
      feedbackSucesso.value = `Conector "${saved.nome}" cadastrado com sucesso.`
    }
    resetForm()

    if (executarAposSalvar) {
      await runConector(saved)
    }
  } catch (err) {
    feedbackErro.value = extractErrorMessage(err)
  } finally {
    isSaving.value = false
  }
}

const testConector = async (item: ConectorFonteDados) => {
  feedbackErro.value = null
  testeResultado.value = null
  testingId.value = item.id
  try {
    const res = await uploadService.testarConector(item.id)
    testeResultado.value = { ...res, conectorNome: item.nome }
  } catch (err) {
    feedbackErro.value = extractErrorMessage(err)
  } finally {
    testingId.value = null
  }
}

const runConector = async (item: ConectorFonteDados) => {
  feedbackErro.value = null
  feedbackSucesso.value = null
  executingId.value = item.id
  try {
    const exec = await uploadService.executarConector(item.id)
    latestTriggeredRunId.value = exec.id
    execucoes.value = [exec, ...execucoes.value.filter((e) => e.id !== exec.id)]
    ensurePollingState()
    feedbackSucesso.value = `Execução da DAG disparada para "${item.nome}".`
  } catch (err) {
    feedbackErro.value = extractErrorMessage(err)
  } finally {
    executingId.value = null
  }
}

const toggleAtivo = async (item: ConectorFonteDados) => {
  feedbackErro.value = null
  try {
    const updated = await uploadService.alternarAtivoConector(item.id, !item.ativo)
    conectores.value = conectores.value.map((c) => (c.id === updated.id ? updated : c))
  } catch (err) {
    feedbackErro.value = extractErrorMessage(err)
  }
}

const removeConector = async (item: ConectorFonteDados) => {
  feedbackErro.value = null
  try {
    await uploadService.excluirConector(item.id)
    conectores.value = conectores.value.filter((c) => c.id !== item.id)
    if (editingId.value === item.id) {
      resetForm()
    }
  } catch (err) {
    feedbackErro.value = extractErrorMessage(err)
  }
}

const formatEtapaLabel = (etapa: EtapaIngestaoUi): string => {
  const labels: Record<EtapaIngestaoUi, string> = {
    PENDENTE: 'Pendente',
    BAIXANDO: 'Baixando',
    PROCESSANDO_POSTGIS: 'Processando PostGIS',
    CONCLUIDO: 'Concluído',
    ERRO: 'Erro',
  }
  return labels[etapa] || etapa
}

const formatEtapaBadgeClass = (etapa: EtapaIngestaoUi): string => {
  switch (etapa) {
    case 'CONCLUIDO':
      return 'badge badge_success'
    case 'ERRO':
      return 'badge badge_danger'
    case 'BAIXANDO':
      return 'badge badge_info'
    case 'PROCESSANDO_POSTGIS':
      return 'badge badge_primary'
    default:
      return 'badge badge_warning'
  }
}

const trackerStepState = (stepKey: 'PENDENTE' | 'BAIXANDO' | 'PROCESSANDO_POSTGIS' | 'CONCLUIDO') => {
  const exec = activeTrackerExecution.value
  if (!exec) return 'idle'
  if (exec.etapaUi === 'ERRO') {
    return stepKey === 'PENDENTE' ? 'done' : 'error'
  }
  const order: EtapaIngestaoUi[] = ['PENDENTE', 'BAIXANDO', 'PROCESSANDO_POSTGIS', 'CONCLUIDO']
  const currentIdx = order.indexOf(exec.etapaUi)
  const stepIdx = order.indexOf(stepKey)
  if (currentIdx > stepIdx || exec.etapaUi === 'CONCLUIDO') return 'done'
  if (currentIdx === stepIdx) return 'active'
  return 'idle'
}

onMounted(() => {
  void loadAll()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<template>
  <section class="automated-ingestion-tab" data-testid="automated-ingestion-tab">
    <!-- KPIs Row -->
    <div class="kpi-grid">
      <CardContainer
        title="Conectores Ativos"
        :value="kpiConectoresAtivos"
        variant="primary"
        iconType="database"
        valueTestId="kpi-conectores-ativos"
      />
      <CardContainer
        title="Agendados (Automáticos)"
        :value="kpiAgendados"
        variant="info"
        iconType="clock"
        valueTestId="kpi-agendados"
      />
      <CardContainer
        title="Em Execução na DAG"
        :value="kpiEmExecucao"
        variant="orange"
        iconType="down"
        valueTestId="kpi-em-execucao"
      />
      <CardContainer
        title="Concluídas no PostGIS"
        :value="kpiConcluidas"
        variant="success"
        iconType="check"
        valueTestId="kpi-concluidas"
      />
    </div>

    <!-- Alertas Globais -->
    <div v-if="feedbackErro" class="alert-banner alert-banner--error" role="alert">
      <FiAlertCircle size="18" />
      <span>{{ feedbackErro }}</span>
    </div>

    <div v-if="feedbackSucesso" class="alert-banner alert-banner--success" role="status">
      <FiCheck size="18" />
      <span>{{ feedbackSucesso }}</span>
    </div>

    <div
      v-if="testeResultado"
      class="alert-banner"
      :class="testeResultado.sucesso ? 'alert-banner--success' : 'alert-banner--error'"
      data-testid="teste-conexao-banner"
    >
      <FiActivity size="18" />
      <div>
        <strong>Teste de Conexão ({{ testeResultado.conectorNome }}):</strong>
        <span>
          HTTP {{ testeResultado.statusHttp ?? 'N/A' }} • {{ testeResultado.tempoMs }} ms —
          {{ testeResultado.mensagem }}
        </span>
      </div>
    </div>

    <!-- Tracker em Tempo Real da DAG -->
    <div
      v-if="activeTrackerExecution"
      class="upload-card tracker-card"
      data-testid="dag-realtime-tracker"
    >
      <div class="tracker-header">
        <div>
          <h3 class="section-title">
            <FiActivity size="18" />
            Acompanhamento em Tempo Real da DAG
          </h3>
          <p class="section-subtitle">
            Conector: <strong>{{ activeTrackerExecution.conectorNome || 'Execução Manual' }}</strong>
            <span v-if="activeTrackerExecution.dagRunId">
              • Run: <code>{{ activeTrackerExecution.dagRunId }}</code>
            </span>
          </p>
        </div>
        <span :class="formatEtapaBadgeClass(activeTrackerExecution.etapaUi)">
          {{ formatEtapaLabel(activeTrackerExecution.etapaUi) }}
        </span>
      </div>

      <div class="dag-steps">
        <div class="dag-step" :class="`dag-step--${trackerStepState('PENDENTE')}`">
          <span class="dag-step__dot">1</span>
          <span class="dag-step__label">Pendente</span>
        </div>
        <div class="dag-step" :class="`dag-step--${trackerStepState('BAIXANDO')}`">
          <span class="dag-step__dot">2</span>
          <span class="dag-step__label">Baixando</span>
        </div>
        <div class="dag-step" :class="`dag-step--${trackerStepState('PROCESSANDO_POSTGIS')}`">
          <span class="dag-step__dot">3</span>
          <span class="dag-step__label">Processando PostGIS</span>
        </div>
        <div class="dag-step" :class="`dag-step--${trackerStepState('CONCLUIDO')}`">
          <span class="dag-step__dot">4</span>
          <span class="dag-step__label">
            {{ activeTrackerExecution.etapaUi === 'ERRO' ? 'Erro' : 'Concluído' }}
          </span>
        </div>
      </div>

      <p v-if="activeTrackerExecution.mensagem" class="tracker-message">
        {{ activeTrackerExecution.mensagem }}
      </p>
    </div>

    <!-- Seletor de Templates Públicos (1-Click Presets) -->
    <div class="upload-card">
      <div class="section-header">
        <div>
          <h3 class="section-title">
            <FiZap size="18" />
            Templates Públicos (1-Clique)
          </h3>
          <p class="section-subtitle">
            Escolha um conector pré-configurado para fontes governamentais ou comece um conector personalizado.
          </p>
        </div>
      </div>

      <div class="templates-grid">
        <button
          v-for="tpl in templates"
          :key="tpl.codigo"
          type="button"
          class="template-chip"
          :class="{ 'template-chip--active': selectedTemplateCode === tpl.codigo }"
          :data-testid="`template-btn-${tpl.codigo}`"
          @click="applyTemplate(tpl)"
        >
          <strong>{{ tpl.nome }}</strong>
          <span class="template-chip__meta">{{ tpl.tipoProtocolo }} • {{ tpl.destino }}</span>
        </button>

        <button
          type="button"
          class="template-chip"
          :class="{ 'template-chip--active': selectedTemplateCode === 'CUSTOM' && editingId === null }"
          data-testid="template-btn-CUSTOM"
          @click="resetForm"
        >
          <strong>Conector Personalizado</strong>
          <span class="template-chip__meta">HTTP / OGC WFS / ArcGIS REST / Drive</span>
        </button>
      </div>
    </div>

    <!-- Formulário de Cadastro / Edição de Conector -->
    <div class="upload-card">
      <div class="section-header">
        <div>
          <h3 class="section-title">
            <FiPlus v-if="editingId === null" size="18" />
            <FiEdit2 v-else size="18" />
            {{ editingId === null ? 'Cadastrar Novo Conector Externo' : `Editando Conector #${editingId}` }}
          </h3>
          <p class="section-subtitle">
            Configure o protocolo, destino no GeoDataHub, credenciais cifradas e periodicidade de ingestão no Airflow.
          </p>
        </div>
        <button
          v-if="editingId !== null"
          type="button"
          class="btn btn_outline btn-sm"
          data-testid="btn-cancelar-edicao"
          @click="resetForm"
        >
          Cancelar Edição
        </button>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label class="label" for="conector-nome">Nome do Conector *</label>
          <input
            id="conector-nome"
            v-model="form.nome"
            type="text"
            class="input"
            data-testid="conector-nome"
            placeholder="Ex: SICAR Imóveis PR ou NASA FIRMS Diário"
          />
        </div>

        <div class="form-group">
          <label class="label" for="conector-destino">Destino no GeoDataHub *</label>
          <select
            id="conector-destino"
            v-model="form.destino"
            class="input"
            data-testid="conector-destino"
            @change="autoSelectCargaOptions"
          >
            <option value="CARGA">CARGA (Esteira de Processamento)</option>
            <option value="REFERENCIA">REFERENCIA (Camada Territorial de Referência)</option>
          </select>
        </div>

        <template v-if="form.destino === 'CARGA'">
          <div class="form-group">
            <label class="label" for="conector-orgao">Órgão Emissor</label>
            <select
              id="conector-orgao"
              v-model="form.orgaoId"
              class="input"
              data-testid="conector-orgao"
            >
              <option value="">Selecione o órgão</option>
              <option v-for="orgao in formOptions.orgaos" :key="orgao.id" :value="orgao.id">
                {{ orgao.label }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="label" for="conector-conjunto">Conjunto de Dados</label>
            <select
              id="conector-conjunto"
              v-model="form.conjuntoId"
              class="input"
              data-testid="conector-conjunto"
            >
              <option value="">Selecione o conjunto</option>
              <option v-for="conj in formOptions.conjuntos" :key="conj.id" :value="conj.id">
                {{ conj.label }}
              </option>
            </select>
          </div>
        </template>

        <template v-else>
          <div class="form-group">
            <label class="label" for="conector-fonte-ref">Código da Fonte de Referência *</label>
            <input
              id="conector-fonte-ref"
              v-model="form.fonteReferencia"
              type="text"
              class="input"
              list="fontes-referencia-sugestoes"
              data-testid="conector-fonte-ref"
              placeholder="Ex: INPE_QUEIMADA"
            />
            <datalist id="fontes-referencia-sugestoes">
              <option v-for="f in FONTES_REFERENCIA_SUGESTOES" :key="f" :value="f" />
            </datalist>
          </div>

          <div class="form-group">
            <label class="label" for="conector-nome-camada">Nome da Camada</label>
            <input
              id="conector-nome-camada"
              v-model="form.nomeCamadaExibicao"
              type="text"
              class="input"
              data-testid="conector-nome-camada"
              placeholder="Nome amigável de exibição no catálogo"
            />
          </div>
        </template>

        <div class="form-group">
          <label class="label" for="conector-protocolo">Protocolo *</label>
          <select
            id="conector-protocolo"
            v-model="form.tipoProtocolo"
            class="input"
            data-testid="conector-protocolo"
          >
            <option value="OGC_WFS">OGC WFS (GeoServer / OWS)</option>
            <option value="HTTP_DIRECT">HTTP Direct / API REST</option>
            <option value="ARCGIS_REST">ArcGIS FeatureServer REST</option>
            <option value="GOOGLE_DRIVE">Google Drive Institucional</option>
          </select>
        </div>

        <div class="form-group">
          <label class="label" for="conector-formato">Formato de Dados *</label>
          <select
            id="conector-formato"
            v-model="form.formatoDados"
            class="input"
            data-testid="conector-formato"
          >
            <option value="SHAPE-ZIP">Shapefile (SHAPE-ZIP)</option>
            <option value="GEOJSON">GeoJSON</option>
            <option value="CSV">CSV (Coordenadas)</option>
            <option value="GPKG">GeoPackage (GPKG)</option>
          </select>
        </div>

        <div class="form-group form-group--full">
          <label class="label" for="conector-url">URL Base / Endpoint *</label>
          <input
            id="conector-url"
            v-model="form.urlBase"
            type="url"
            class="input"
            data-testid="conector-url"
            placeholder="https://..."
          />
        </div>

        <div class="form-group">
          <label class="label" for="conector-epsg">EPSG de Origem</label>
          <input
            id="conector-epsg"
            v-model="form.epsgOrigem"
            type="text"
            class="input"
            data-testid="conector-epsg"
            placeholder="4674"
          />
        </div>

        <div class="form-group">
          <label class="label" for="conector-colunas-id">Coluna(s) Identificadora(s)</label>
          <input
            id="conector-colunas-id"
            v-model="form.colunaIdentificador"
            type="text"
            class="input"
            data-testid="conector-colunas-id"
            placeholder="cod_imovel,ogc_fid"
          />
        </div>

        <!-- Autenticação & Chave de API -->
        <div class="form-section-divider form-group--full">
          <FiKey size="16" />
          <span>Autenticação & Chave de API</span>
        </div>

        <div class="form-group">
          <label class="label" for="conector-auth-tipo">Tipo de Autenticação</label>
          <select
            id="conector-auth-tipo"
            v-model="form.tipoAutenticacao"
            class="input"
            data-testid="conector-auth-tipo"
          >
            <option value="NONE">Sem Autenticação (Público)</option>
            <option value="API_KEY_HEADER">API Key via Header HTTP</option>
            <option value="API_KEY_QUERY">API Key via Query / Path ({API_KEY})</option>
            <option value="BEARER_TOKEN">Bearer Token</option>
            <option value="BASIC_AUTH">Basic Auth (usuário:senha)</option>
            <option value="SERVICE_ACCOUNT_JSON">Google Service Account (JSON)</option>
          </select>
        </div>

        <template v-if="form.tipoAutenticacao !== 'NONE'">
          <div class="form-group">
            <label class="label" for="conector-cred-nome">Nome do Header / Parâmetro</label>
            <input
              id="conector-cred-nome"
              v-model="form.nomeCredencial"
              type="text"
              class="input"
              data-testid="conector-cred-nome"
              placeholder="Ex: X-API-Key ou MAP_KEY"
            />
          </div>

          <div class="form-group form-group--full">
            <label class="label" for="conector-cred-valor">Chave de API / Token / Segredo</label>
            <div class="password-field">
              <input
                id="conector-cred-valor"
                v-model="form.credencial"
                :type="showCredencial ? 'text' : 'password'"
                class="input"
                data-testid="conector-cred-valor"
                autocomplete="new-password"
                :placeholder="
                  editingId !== null && editingPossuiCredencial
                    ? 'Deixe em branco para manter a chave atual'
                    : 'Informe o token, API key ou segredo'
                "
              />
              <button
                type="button"
                class="btn btn_outline btn-icon"
                data-testid="btn-toggle-cred-visibility"
                :title="showCredencial ? 'Ocultar credencial' : 'Exibir credencial'"
                @click="showCredencial = !showCredencial"
              >
                <FiEyeOff v-if="showCredencial" size="16" />
                <FiEye v-else size="16" />
              </button>
            </div>
            <small v-if="editingId !== null && editingPossuiCredencial" class="field-hint">
              Credencial salva ({{ editingPrefixoCredencial || '****' }}). Deixe em branco para manter a chave atual.
            </small>
          </div>
        </template>

        <!-- Parâmetros Dinâmicos por Protocolo -->
        <div class="form-section-divider form-group--full">
          <FiDatabase size="16" />
          <span>Parâmetros do Protocolo ({{ form.tipoProtocolo }})</span>
        </div>

        <template v-if="form.tipoProtocolo === 'OGC_WFS'">
          <div class="form-group">
            <label class="label" for="conector-wfs-typename">Camada (typeName)</label>
            <input
              id="conector-wfs-typename"
              v-model="form.wfsTypeName"
              type="text"
              class="input"
              data-testid="conector-wfs-typename"
              placeholder="Ex: sicar:sicar_imoveis_pr"
            />
          </div>

          <div class="form-group">
            <label class="label" for="conector-wfs-uf">UF (Opcional — atualiza sicar_imoveis_&lt;uf&gt;)</label>
            <select
              id="conector-wfs-uf"
              v-model="form.wfsUf"
              class="input"
              data-testid="conector-wfs-uf"
              @change="onWfsUfChange"
            >
              <option value="">Todas / Não especificar</option>
              <option v-for="uf in UFS_BRASIL" :key="uf" :value="uf">{{ uf }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="label" for="conector-wfs-municipio">Município ou Cód. IBGE</label>
            <input
              id="conector-wfs-municipio"
              v-model="form.wfsMunicipio"
              type="text"
              class="input"
              data-testid="conector-wfs-municipio"
              placeholder="Ex: Goiânia ou 5208707"
            />
          </div>

          <div class="form-group">
            <label class="label" for="conector-wfs-car">Código CAR (cod_imovel)</label>
            <input
              id="conector-wfs-car"
              v-model="form.wfsCar"
              type="text"
              class="input"
              data-testid="conector-wfs-car"
              placeholder="Ex: PR-4106902-..."
            />
          </div>

          <div class="form-group">
            <label class="label" for="conector-wfs-situacao">Situação do Imóvel</label>
            <select
              id="conector-wfs-situacao"
              v-model="form.wfsSituacao"
              class="input"
              data-testid="conector-wfs-situacao"
            >
              <option value="">Todas</option>
              <option value="AT">AT - Ativo</option>
              <option value="PE">PE - Pendente</option>
              <option value="SU">SU - Suspenso</option>
              <option value="CA">CA - Cancelado</option>
            </select>
          </div>

          <div class="form-group">
            <label class="label" for="conector-wfs-max">Limite de Feições (maxFeatures)</label>
            <input
              id="conector-wfs-max"
              v-model="form.wfsMaxFeatures"
              type="number"
              min="1"
              class="input"
              data-testid="conector-wfs-max"
            />
          </div>

          <div class="form-group form-group--full">
            <label class="label" for="conector-wfs-cql">Filtro CQL Customizado</label>
            <input
              id="conector-wfs-cql"
              v-model="form.wfsCql"
              type="text"
              class="input"
              data-testid="conector-wfs-cql"
              placeholder="Ex: ind_status='AT' AND num_area > 50"
            />
          </div>
        </template>

        <template v-else-if="form.tipoProtocolo === 'GOOGLE_DRIVE'">
          <div class="form-group">
            <label class="label" for="conector-drive-id">ID da Pasta / Arquivo</label>
            <input
              id="conector-drive-id"
              v-model="form.driveFolderId"
              type="text"
              class="input"
              data-testid="conector-drive-id"
            />
          </div>

          <div class="form-group">
            <label class="label" for="conector-drive-subfolder">Subpasta</label>
            <input
              id="conector-drive-subfolder"
              v-model="form.driveSubfolder"
              type="text"
              class="input"
              data-testid="conector-drive-subfolder"
            />
          </div>

          <div class="form-group form-group--full">
            <label class="label" for="conector-drive-regex">Regex de Arquivo</label>
            <input
              id="conector-drive-regex"
              v-model="form.driveRegex"
              type="text"
              class="input"
              data-testid="conector-drive-regex"
              placeholder="Ex: .*\.zip$"
            />
          </div>
        </template>

        <template v-else>
          <div class="form-group">
            <label class="label" for="conector-helper-where">Filtro where (opcional)</label>
            <input
              id="conector-helper-where"
              v-model="form.helperWhere"
              type="text"
              class="input"
              placeholder="Ex: 1=1"
            />
          </div>

          <div class="form-group">
            <label class="label" for="conector-helper-lat">Coluna Latitude / Longitude (CSV)</label>
            <div class="inline-pair">
              <input
                id="conector-helper-lat"
                v-model="form.helperLatColumn"
                type="text"
                class="input"
                placeholder="latColumn"
              />
              <input
                v-model="form.helperLonColumn"
                type="text"
                class="input"
                placeholder="lonColumn"
              />
            </div>
          </div>

          <div class="form-group form-group--full">
            <label class="label" for="conector-extra-json">Parâmetros JSON / Query Extras</label>
            <textarea
              id="conector-extra-json"
              v-model="form.extraJsonText"
              class="input textarea"
              rows="3"
              data-testid="conector-extra-json"
            ></textarea>
          </div>
        </template>

        <!-- Periodicidade e Agendamento -->
        <div class="form-section-divider form-group--full">
          <FiClock size="16" />
          <span>Periodicidade e Agendamento</span>
        </div>

        <div class="form-group">
          <label class="label" for="conector-periodicidade">Periodicidade *</label>
          <select
            id="conector-periodicidade"
            v-model="form.periodicidade"
            class="input"
            data-testid="conector-periodicidade"
          >
            <option value="MANUAL">Manual (Sob Demanda)</option>
            <option value="HORARIA">Horária</option>
            <option value="DIARIA">Diária</option>
            <option value="SEMANAL">Semanal</option>
            <option value="MENSAL">Mensal</option>
            <option value="CRON">Cron Personalizado</option>
          </select>
        </div>

        <div v-if="form.periodicidade === 'CRON'" class="form-group">
          <label class="label" for="conector-cron">Expressão Cron</label>
          <input
            id="conector-cron"
            v-model="form.expressaoCron"
            type="text"
            class="input"
            data-testid="conector-cron"
            placeholder="0 2 * * *"
          />
        </div>

        <div v-else class="form-group">
          <span class="label">Regra de Disparo</span>
          <div class="cron-info-badge">
            <span class="badge badge_info">{{ periodicidadeBadgeInfo }}</span>
          </div>
        </div>

        <div class="form-group form-group--full">
          <label class="checkbox-label">
            <input
              v-model="form.ativo"
              type="checkbox"
              class="checkbox"
              data-testid="conector-ativo"
            />
            <span>Agendamento Ativo</span>
          </label>
        </div>
      </div>

      <div class="form-actions">
        <button
          type="button"
          class="btn"
          :disabled="isSaving"
          data-testid="btn-salvar-conector"
          @click="saveConector(false)"
        >
          {{ editingId === null ? 'Salvar Conector' : 'Atualizar Conector' }}
        </button>

        <button
          type="button"
          class="btn btn_success"
          :disabled="isSaving"
          data-testid="btn-salvar-executar"
          @click="saveConector(true)"
        >
          <FiPlay size="15" />
          Salvar e Executar Agora
        </button>
      </div>
    </div>

    <!-- Tabela de Conectores Cadastrados -->
    <div class="upload-card">
      <div class="section-header">
        <div>
          <h3 class="section-title">Conectores Cadastrados</h3>
          <p class="section-subtitle">
            Gerencie fontes externas, teste conectividade HTTP/WFS e dispare ingestões manuais no Airflow.
          </p>
        </div>
        <button type="button" class="btn btn_outline btn-sm" @click="loadAll">
          <FiRefreshCw size="14" />
          Atualizar
        </button>
      </div>

      <DataTable
        :columns="conectoresColumns"
        :data="conectores"
        row-key="id"
        table-test-id="tabela-conectores"
        :disable-expand="true"
        :loading="isLoadingData"
      >
        <template #cell-nome="{ item }">
          <div class="cell-stack">
            <strong>{{ item.nome }}</strong>
            <span class="badge badge_neutral">{{ item.tipoProtocolo }}</span>
          </div>
        </template>

        <template #cell-destino="{ item }">
          <div class="cell-stack">
            <span class="badge" :class="item.destino === 'CARGA' ? 'badge_primary' : 'badge_info'">
              {{ item.destino }}
            </span>
            <small class="text-muted">
              {{ item.fonteReferencia || item.conjuntoNome || item.orgaoSigla || '—' }}
            </small>
          </div>
        </template>

        <template #cell-autenticacao="{ item }">
          <div class="cell-stack">
            <span>{{ item.tipoAutenticacao }}</span>
            <small v-if="item.possuiCredencial" class="text-muted">
              {{ item.prefixoCredencial || '****' }}
            </small>
          </div>
        </template>

        <template #cell-periodicidade="{ item }">
          <div class="cell-stack">
            <span>{{ item.periodicidade }}</span>
            <small v-if="item.expressaoCron" class="text-muted">
              <code>{{ item.expressaoCron }}</code>
            </small>
          </div>
        </template>

        <template #cell-ultimoStatus="{ item }">
          <div class="cell-stack">
            <span class="badge" :class="item.ativo ? 'badge_success' : 'badge_neutral'">
              {{ item.ativo ? 'Ativo' : 'Pausado' }}
            </span>
            <small v-if="item.ultimoStatus" class="text-muted">{{ item.ultimoStatus }}</small>
          </div>
        </template>

        <template #cell-acoes="{ item }">
          <div class="table-actions actions-wrap">
            <button
              type="button"
              class="btn btn_success btn-xs"
              :disabled="executingId === item.id"
              :data-testid="`btn-executar-conector-${item.id}`"
              @click="runConector(item)"
            >
              <FiPlay size="13" />
              Executar
            </button>

            <button
              type="button"
              class="btn btn_outline btn-xs"
              :disabled="testingId === item.id"
              :data-testid="`btn-testar-conector-${item.id}`"
              @click="testConector(item)"
            >
              Testar
            </button>

            <button
              type="button"
              class="btn btn_outline btn-xs"
              :data-testid="`btn-editar-conector-${item.id}`"
              @click="editConector(item)"
            >
              Editar
            </button>

            <button
              type="button"
              class="btn btn_outline btn-xs"
              :data-testid="`btn-toggle-conector-${item.id}`"
              @click="toggleAtivo(item)"
            >
              <FiPause v-if="item.ativo" size="13" />
              <FiPlay v-else size="13" />
              {{ item.ativo ? 'Pausar' : 'Ativar' }}
            </button>

            <button
              type="button"
              class="btn btn_recuse btn-xs"
              :data-testid="`btn-excluir-conector-${item.id}`"
              @click="removeConector(item)"
            >
              <FiTrash2 size="13" />
              Excluir
            </button>
          </div>
        </template>

        <template #empty>
          Nenhum conector cadastrado ainda. Escolha um template acima para iniciar.
        </template>
      </DataTable>
    </div>

    <!-- Histórico de Execuções / Cargas Importadas -->
    <div class="upload-card">
      <div class="section-header">
        <div>
          <h3 class="section-title">Histórico de Execuções / Cargas Importadas</h3>
          <p class="section-subtitle">
            Clique em uma linha para inspecionar SHA-256, MD5, URL/caminho, ID da DAG e log detalhado.
          </p>
        </div>
      </div>

      <DataTable
        :columns="execucoesColumns"
        :data="execucoes"
        row-key="id"
        table-test-id="tabela-execucoes"
        :loading="isLoadingData"
      >
        <template #cell-id="{ item }">
          <div class="cell-stack">
            <strong>#{{ item.id }}</strong>
            <small class="text-muted">{{ item.conectorNome || '—' }}</small>
          </div>
        </template>

        <template #cell-nomeArquivo="{ item }">
          <div class="cell-stack">
            <span>{{ item.nomeArquivo || item.fonte || '—' }}</span>
            <small v-if="item.fonte" class="text-muted">{{ item.fonte }}</small>
          </div>
        </template>

        <template #cell-destino="{ item }">
          <span class="badge badge_neutral">{{ item.destino || '—' }}</span>
        </template>

        <template #cell-linhasCarregadas="{ item }">
          <span>{{ item.linhasCarregadas ?? 0 }}</span>
        </template>

        <template #cell-etapaUi="{ item }">
          <span :class="formatEtapaBadgeClass(item.etapaUi)">
            {{ formatEtapaLabel(item.etapaUi) }}
          </span>
        </template>

        <template #cell-duracaoSegundos="{ item }">
          <span>{{ item.duracaoSegundos !== null ? `${item.duracaoSegundos}s` : '—' }}</span>
        </template>

        <template #cell-acoes="{ item }">
          <div class="table-actions">
            <router-link
              v-if="item.processoId"
              :to="`/processo/${item.processoId}`"
              class="btn btn_outline btn-xs"
            >
              Ver na Esteira
            </router-link>
            <span v-else class="text-muted">—</span>
          </div>
        </template>

        <template #expanded-row="{ item }">
          <div class="expanded-details-grid">
            <div>
              <span class="detail-label">DAG Run ID</span>
              <code>{{ item.dagRunId || '—' }}</code>
            </div>
            <div>
              <span class="detail-label">URL / Caminho</span>
              <code>{{ item.driveCaminho || '—' }}</code>
            </div>
            <div>
              <span class="detail-label">SHA-256</span>
              <code>{{ item.hashSha256 || '—' }}</code>
            </div>
            <div>
              <span class="detail-label">MD5</span>
              <code>{{ item.md5Drive || '—' }}</code>
            </div>
            <div class="expanded-details-grid__full">
              <span class="detail-label">Mensagem / Log</span>
              <p class="expanded-message">{{ item.mensagem || 'Sem mensagens registradas.' }}</p>
            </div>
          </div>
        </template>

        <template #empty>
          Nenhuma execução registrada até o momento.
        </template>
      </DataTable>
    </div>
  </section>
</template>

<style scoped>
.automated-ingestion-tab {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.upload-card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.25rem 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-heading);
}

.section-subtitle {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.alert-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1.1rem;
  border-radius: 8px;
  font-size: 0.9rem;
}

.alert-banner--error {
  background-color: var(--badge-danger-bg);
  color: var(--badge-danger-text);
  border: 1px solid var(--badge-danger-border);
}

.alert-banner--success {
  background-color: var(--badge-success-bg);
  color: var(--badge-success-text);
  border: 1px solid var(--badge-success-border);
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 0.75rem;
}

.template-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.85rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-surface-soft);
  color: var(--color-heading);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.template-chip:hover {
  border-color: var(--color-brand);
}

.template-chip--active {
  border-color: var(--color-brand);
  background-color: var(--color-brand-soft);
}

.template-chip__meta {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group--full {
  grid-column: 1 / -1;
}

.form-section-divider {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--color-border);
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--color-heading);
}

.password-field {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.inline-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.field-hint {
  margin-top: 0.35rem;
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.cron-info-badge {
  display: flex;
  align-items: center;
  min-height: 40px;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-heading);
  cursor: pointer;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border);
}

.btn-sm {
  padding: 0.45rem 0.9rem;
  font-size: 0.8rem;
  gap: 0.4rem;
}

.btn-xs {
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
  gap: 0.3rem;
}

.btn-icon {
  padding: 0.55rem 0.75rem;
  flex-shrink: 0;
}

.cell-stack {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-start;
}

.text-muted {
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.actions-wrap {
  flex-wrap: wrap;
}

/* Tracker em Tempo Real */
.tracker-card {
  border-left: 4px solid var(--vis-brand-orange);
}

.tracker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.dag-steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.dag-step {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-surface-soft);
  color: var(--color-text-muted);
  font-size: 0.85rem;
  font-weight: 600;
}

.dag-step__dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  background-color: var(--color-border);
  color: var(--color-heading);
}

.dag-step--active {
  border-color: var(--vis-brand-orange);
  background-color: var(--color-brand-soft);
  color: var(--color-heading);
}

.dag-step--active .dag-step__dot {
  background-color: var(--vis-brand-orange);
  color: var(--color-brand-contrast);
}

.dag-step--done {
  border-color: var(--badge-success-border);
  background-color: var(--badge-success-bg);
  color: var(--badge-success-text);
}

.dag-step--done .dag-step__dot {
  background-color: var(--vis-c-success);
  color: var(--color-brand-contrast);
}

.dag-step--error {
  border-color: var(--badge-danger-border);
  background-color: var(--badge-danger-bg);
  color: var(--badge-danger-text);
}

.dag-step--error .dag-step__dot {
  background-color: var(--vis-c-danger);
  color: var(--color-brand-contrast);
}

.tracker-message {
  margin: 0.85rem 0 0 0;
  font-size: 0.85rem;
  color: var(--color-text);
}

.expanded-details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
  font-size: 0.85rem;
}

.expanded-details-grid__full {
  grid-column: 1 / -1;
}

.detail-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: 0.2rem;
}

.expanded-message {
  margin: 0;
  color: var(--color-text);
}

@media (max-width: 960px) {
  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dag-steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .kpi-grid,
  .form-grid,
  .dag-steps,
  .expanded-details-grid {
    grid-template-columns: 1fr;
  }
}
</style>
