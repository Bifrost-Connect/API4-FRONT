<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { FiDownload, FiRefreshCw, FiShield, FiAlertCircle } from 'vue-icons-plus/fi'
import { exportacaoService, type ExportHistoryItem, type ExportPreview } from '@/services/exportacao'
import api, { extractApiErrorMessage } from '@/services/api'
import type { CatalogoBase } from '@/services/catalogo'
import { processService } from '@/services/process'
import { userService } from '@/services/user'
import { normalizeRoleKey } from '@/utils/rbac'

const bases = ref<CatalogoBase[]>([])
const selectedBaseId = ref('')
const selectedDatasetId = ref('')
const codigoImovel = ref('')
const hectaresMin = ref('')
const fonteCamada = ref('')
const scope = ref<'all' | 'alerts' | 'regional'>('all')
const formato = ref<'csv' | 'geojson'>('csv')

const preview = ref<ExportPreview | null>(null)
const previewLoading = ref(false)
const previewError = ref('')
const basesLoading = ref(false)
const baseError = ref('')
const history = ref<ExportHistoryItem[]>([])
const historyLoading = ref(false)
const historyError = ref('')
const lineageHash = ref('')
const lineageLoading = ref(false)
const downloadLoading = ref(false)
const downloadProgress = ref<number | null>(null)
const toastError = ref('')
const route = useRoute()

const currentRole = computed(() => normalizeRoleKey(userService.getCurrentUser()?.role))
const canExportCsv = computed(
  () =>
    currentRole.value !== 'AUDITOR' &&
    userService.can('EXPORTACAO:CSV'),
)
const canExportGeojson = computed(
  () => currentRole.value !== 'AUDITOR' && userService.can('EXPORTACAO:GEOJSON'),
)
const canExport = computed(() => canExportCsv.value || canExportGeojson.value)
const canViewHistory = computed(() => userService.can('AUDITORIA:VISUALIZAR_LOGS'))

const datasets = computed(() => {
  const values = new Map<string, string>()
  for (const base of bases.value) {
    const id = String(base.conjunto_id ?? base.conjunto ?? '')
    const label = base.conjunto || `Conjunto ${id}`
    if (id) values.set(id, label)
  }
  return Array.from(values, ([id, label]) => ({ id, label })).sort((a, b) =>
    a.label.localeCompare(b.label, 'pt-BR'),
  )
})

const visibleBases = computed(() =>
  selectedDatasetId.value
    ? bases.value.filter(
        (base) => String(base.conjunto_id ?? base.conjunto ?? '') === selectedDatasetId.value,
      )
    : bases.value,
)

const selectedBase = computed(
  () => visibleBases.value.find((base) => String(base.id) === selectedBaseId.value) || null,
)

const activeFilters = computed(() => {
  if (!selectedBase.value) return null
  return {
    processo_id: Number(selectedBase.value.id),
    ...(codigoImovel.value.trim() ? { codigo_imovel: codigoImovel.value.trim() } : {}),
    ...(scope.value === 'alerts' ? { com_sobreposicao: true } : {}),
    ...(hectaresMin.value !== '' ? { hectares_min: Number(hectaresMin.value) } : {}),
    ...(fonteCamada.value.trim() ? { fonte_camada: fonteCamada.value.trim() } : {}),
  }
})

const sampleRows = computed(() => preview.value?.amostra || [])
const resultCount = computed(() => Number(preview.value?.total_registros || 0))
const downloadDisabled = computed(
  () => !canExport.value || !selectedBase.value || !preview.value || resultCount.value === 0 || previewLoading.value || downloadLoading.value,
)

const estimateBytes = computed(() => {
  if (!preview.value || resultCount.value === 0) return 0
  const sample = sampleRows.value
  const average = sample.length
    ? sample.reduce((sum, row) => sum + new TextEncoder().encode(JSON.stringify(row)).length, 0) /
      sample.length
    : 0
  // Preview omits geometry. GeoJSON size is therefore a rough estimate, not a promise.
  const geometryFactor = formato.value === 'geojson' ? 2.5 : 1.25
  return Math.ceil((average + 80) * resultCount.value * geometryFactor)
})

const traceabilityEpsg = computed(
  () => selectedBase.value?.epsg_destino || 'Não informado',
)

function formatBytes(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `cerca de ${Math.max(1, Math.round(bytes / 1024))} KB`
  return `cerca de ${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function readableDate(value?: string): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('pt-BR')
}

function displayFormat(value: string): string {
  return value?.toUpperCase() === 'GEOJSON' ? 'GeoJSON' : 'CSV'
}

let previewTimer: ReturnType<typeof setTimeout> | undefined
let previewSequence = 0
let lineageSequence = 0

async function loadBases() {
  basesLoading.value = true
  baseError.value = ''
  try {
    // A API responde uma página { items, ... }; a adaptação também aceita o contrato legado em array.
    const response = await api.get('/catalogo/bases', {
      params: { apenas_disponiveis: true, page: 0, size: 100, sort: 'data_publicacao', direcao: 'desc' },
    })
    const data = response.data
    const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
    bases.value = items.filter(
      (base: CatalogoBase & { pronta_para_consulta?: boolean }) => base.pronta_para_consulta !== false,
    )
    if (!selectedBaseId.value && bases.value.length) {
      const requestedId = String(route.query.processo_id || '')
      const first = bases.value.find((base) => String(base.id) === requestedId) || bases.value[0]
      if (first) {
        selectedBaseId.value = String(first.id)
        selectedDatasetId.value = String(first.conjunto_id ?? first.conjunto ?? '')
      }
    }
  } catch (error) {
    baseError.value = extractApiErrorMessage(error, 'Não foi possível carregar as versões publicadas.')
  } finally {
    basesLoading.value = false
  }
}

async function loadHistory() {
  if (!canViewHistory.value) return
  historyLoading.value = true
  historyError.value = ''
  try {
    const page = await exportacaoService.historico(0, 20)
    history.value = page.items || []
  } catch (error) {
    historyError.value = extractApiErrorMessage(
      error,
      'Não foi possível carregar o histórico de exportações.',
    )
  } finally {
    historyLoading.value = false
  }
}

async function loadPreview() {
  const sequence = ++previewSequence
  const filters = activeFilters.value
  preview.value = null
  previewError.value = ''
  if (!filters || !canExport.value) return
  previewLoading.value = true
  try {
    const result = await exportacaoService.preview(filters)
    if (sequence === previewSequence) preview.value = result
  } catch (error) {
    if (sequence === previewSequence) {
      previewError.value = extractApiErrorMessage(
        error,
        'Não foi possível gerar a pré-visualização. Tente novamente.',
      )
    }
  } finally {
    if (sequence === previewSequence) previewLoading.value = false
  }
}

function schedulePreview() {
  if (previewTimer) clearTimeout(previewTimer)
  previewSequence++
  previewLoading.value = false
  preview.value = null
  previewTimer = setTimeout(() => void loadPreview(), 250)
}

async function loadTraceability() {
  const sequence = ++lineageSequence
  lineageHash.value = ''
  if (!selectedBase.value) return
  lineageLoading.value = true
  try {
    const details = await processService.getTraceability(String(selectedBase.value.id))
    if (sequence === lineageSequence) lineageHash.value = details.hashSha256 || ''
  } catch {
    if (sequence === lineageSequence) lineageHash.value = ''
  } finally {
    if (sequence === lineageSequence) lineageLoading.value = false
  }
}

function selectDataset() {
  const first = visibleBases.value[0]
  selectedBaseId.value = first ? String(first.id) : ''
}

async function downloadReport(targetFormat: 'csv' | 'geojson' = formato.value) {
  const filters = activeFilters.value
  if (downloadDisabled.value || !filters) return
  toastError.value = ''
  downloadLoading.value = true
  downloadProgress.value = null
  formato.value = targetFormat
  try {
    const file = await exportacaoService.baixar(filters, targetFormat, (loaded, total) => {
      downloadProgress.value = total ? Math.min(100, Math.round((loaded / total) * 100)) : null
    })
    const url = URL.createObjectURL(file.blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    await loadHistory()
  } catch {
    toastError.value = 'Falha ao gerar o arquivo de exportação. Tente novamente.'
  } finally {
    downloadLoading.value = false
    downloadProgress.value = null
  }
}

watch(selectedDatasetId, selectDataset)
watch(selectedBaseId, () => {
  void loadTraceability()
  schedulePreview()
})
watch([codigoImovel, hectaresMin, fonteCamada, scope, formato], schedulePreview)

onMounted(() => {
  void loadBases()
  void loadHistory()
})

onBeforeUnmount(() => {
  if (previewTimer) clearTimeout(previewTimer)
  previewSequence++
  lineageSequence++
})
</script>

<template>
  <main class="export-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">MÓDULO DO GESTOR AMBIENTAL</p>
        <h1>Exportação de resultados e relatórios</h1>
        <p>Configure o pacote, confira uma amostra e gere arquivos oficiais de versões publicadas.</p>
      </div>
      <span class="official-badge"><FiShield size="16" /> Exportação rastreável</span>
    </header>

    <div v-if="toastError" class="notice notice-error" role="alert" data-testid="export-error-toast">
      <FiAlertCircle size="18" /> <span>{{ toastError }}</span>
    </div>
    <div v-if="baseError" class="notice notice-error" role="alert">{{ baseError }}</div>
    <div v-if="!canExport" class="notice notice-info" role="status">
      Seu perfil pode consultar o histórico, mas não tem permissão para gerar downloads.
    </div>

    <section v-if="canExport" class="panel configuration-panel" aria-labelledby="config-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">PACOTE DE EXPORTAÇÃO</p>
          <h2 id="config-title">Parâmetros do relatório</h2>
        </div>
        <span class="step-label">1. Configure · 2. Confira · 3. Baixe</span>
      </div>

      <div class="filters-grid">
        <label class="field">
          <span>Conjunto de dados</span>
          <select v-model="selectedDatasetId" data-testid="export-dataset-select">
            <option value="">Todos os conjuntos</option>
            <option v-for="dataset in datasets" :key="dataset.id" :value="dataset.id">
              {{ dataset.label }}
            </option>
          </select>
        </label>

        <label class="field">
          <span>Versão oficial / safra publicada</span>
          <select v-model="selectedBaseId" :disabled="basesLoading || !visibleBases.length" data-testid="export-version-select">
            <option value="">{{ basesLoading ? 'Carregando versões…' : 'Selecione uma versão' }}</option>
            <option v-for="base in visibleBases" :key="base.id" :value="String(base.id)">
              {{ base.conjunto || 'Conjunto' }} · Safra {{ base.ano_safra }} · {{ base.versao_oficial }}
            </option>
          </select>
        </label>

        <label class="field">
          <span>Escopo dos dados</span>
          <select v-model="scope" data-testid="export-scope-select">
            <option value="all">Tabela completa de imóveis e métricas</option>
            <option value="alerts">Apenas áreas com alertas / sobreposições</option>
            <option value="regional" disabled>Resumo agregado por região (indisponível)</option>
          </select>
        </label>

        <label class="field">
          <span>Formato de saída</span>
          <select v-model="formato" data-testid="export-format-select">
            <option value="csv">Tabela CSV</option>
            <option value="geojson">Mapa GeoJSON</option>
          </select>
        </label>

        <label class="field">
          <span>Código do imóvel <small>opcional</small></span>
          <input v-model="codigoImovel" type="search" placeholder="Ex.: CAR-MS-000123" data-testid="export-property-filter" />
        </label>

        <label class="field">
          <span>Sobreposição mínima (ha) <small>opcional</small></span>
          <input v-model="hectaresMin" type="number" min="0" step="0.01" placeholder="0" data-testid="export-hectares-filter" />
        </label>

        <label class="field">
          <span>Fonte da camada <small>opcional</small></span>
          <input v-model="fonteCamada" type="text" placeholder="Ex.: IBAMA" data-testid="export-layer-filter" />
        </label>

        <label class="field">
          <span>Região / município <small>opcional</small></span>
          <input type="text" disabled placeholder="Aguardando filtro regional na API" title="O endpoint atual não recebe município ou região." />
        </label>
      </div>
      <p class="dependency-note">
        O resumo agregado e o filtro por município dependem de novos parâmetros no back. O filtro de alertas e os demais filtros acima já usam o contrato de exportação disponível.
      </p>
    </section>

    <section v-if="canExport" class="panel preview-panel" aria-labelledby="preview-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">PRÉ-VISUALIZAÇÃO</p>
          <h2 id="preview-title">Amostra do arquivo</h2>
        </div>
        <div class="preview-summary" aria-live="polite">
          <span><strong data-testid="export-result-count">{{ previewLoading ? '…' : resultCount }}</strong> registros</span>
          <span>Arquivo estimado: <strong data-testid="export-size-estimate">{{ formatBytes(estimateBytes) }}</strong></span>
        </div>
      </div>

      <div v-if="previewLoading" class="empty-state" role="status">Atualizando a pré-visualização…</div>
      <div v-else-if="previewError" class="notice notice-error" role="alert" data-testid="export-preview-error">{{ previewError }}</div>
      <div v-else-if="preview && resultCount === 0" class="empty-state" data-testid="export-empty-state">
        Nenhum registro corresponde aos filtros. Ajuste os parâmetros para habilitar o download.
      </div>
      <div v-else-if="preview && sampleRows.length" class="table-wrap">
        <table class="sample-table">
          <thead>
            <tr>
              <th>Código do imóvel</th><th>Conjunto</th><th>Órgão</th><th>Safra</th>
              <th>Versão oficial</th><th>Área sobreposta (ha)</th><th>Sobreposições</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in sampleRows" :key="String(row.feicao_id || row.codigo_imovel || index)">
              <td>{{ displayValue(row.codigo_imovel) }}</td>
              <td>{{ displayValue(row.conjunto) }}</td>
              <td>{{ displayValue(row.orgao_sigla || row.orgao) }}</td>
              <td>{{ displayValue(row.ano_safra) }}</td>
              <td>{{ displayValue(row.versao_oficial) }}</td>
              <td>{{ displayValue(row.hectares_sobrepostos_total) }}</td>
              <td>{{ displayValue(row.qtd_sobreposicoes) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="table-footnote">Exibindo {{ sampleRows.length }} de até 10 linhas retornadas pela API.</p>
      </div>
      <div v-else class="empty-state">Selecione uma versão publicada para ver a amostra.</div>

      <div v-if="selectedBase" class="traceability-seal" data-testid="export-traceability">
        <FiShield size="19" />
        <div>
          <strong>Metadados oficiais acompanham o arquivo</strong>
          <p>
            Versão {{ preview?.versao_oficial || selectedBase.versao_oficial || '—' }} ·
            Publicação {{ readableDate(selectedBase.data_publicacao) }} ·
            EPSG {{ traceabilityEpsg }} ·
            Hash de origem {{ lineageLoading ? 'consultando…' : lineageHash || 'indisponível' }}
          </p>
        </div>
      </div>

      <div class="download-actions">
        <div class="download-buttons">
          <button
            type="button"
            class="primary-button"
            :disabled="downloadDisabled || !canExportCsv"
            data-testid="export-download-csv"
            @click="downloadReport('csv')"
          >
            <FiDownload size="17" /> Baixar Tabela CSV
          </button>
          <button
            type="button"
            class="secondary-button"
            :disabled="downloadDisabled || !canExportGeojson"
            data-testid="export-download-geojson"
            @click="downloadReport('geojson')"
          >
            <FiDownload size="17" /> Baixar Arquivo GeoJSON
          </button>
        </div>
        <div v-if="downloadLoading" class="download-progress" role="status" data-testid="export-download-progress">
          <span>{{ downloadProgress === null ? 'Gerando arquivo…' : `Baixando ${downloadProgress}%` }}</span>
          <progress v-if="downloadProgress !== null" :value="downloadProgress" max="100" />
          <span v-else class="progress-spinner" aria-hidden="true"></span>
        </div>
      </div>
    </section>

    <section v-if="canViewHistory" class="panel history-panel" aria-labelledby="history-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">RASTREABILIDADE</p>
          <h2 id="history-title">Histórico de exportações</h2>
        </div>
        <button type="button" class="refresh-button" :disabled="historyLoading" @click="loadHistory">
          <FiRefreshCw size="15" /> Atualizar
        </button>
      </div>
      <div v-if="historyLoading" class="empty-state" role="status">Carregando histórico…</div>
      <div v-else-if="historyError" class="notice notice-info" role="status" data-testid="export-history-error">{{ historyError }}</div>
      <div v-else-if="!history.length" class="empty-state" data-testid="export-history-empty">Nenhuma exportação registrada ainda.</div>
      <div v-else class="table-wrap">
        <table class="sample-table history-table">
          <thead><tr><th>Data e hora</th><th>Solicitante</th><th>Base / versão</th><th>Formato</th><th>Registros</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="item in history" :key="item.id">
              <td>{{ readableDate(item.data_hora_exportacao) }}</td>
              <td>{{ item.usuario_nome || item.usuario_email || `Usuário ${item.usuario_id}` }}</td>
              <td>{{ item.conjunto }} · Safra {{ item.ano_safra }} · {{ item.versao_oficial }}</td>
              <td>{{ displayFormat(item.formato) }}</td>
              <td>{{ item.total_registros_exportados }}</td>
              <td><span class="status-chip">Registrada</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<style scoped>
.export-page { display: grid; gap: 20px; max-width: 1440px; margin: 0 auto; padding: 28px; color: var(--color-text, #182230); }
.page-heading, .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.page-heading h1 { margin: 4px 0 8px; font-size: clamp(1.55rem, 2.5vw, 2.1rem); }
.page-heading > div > p:last-child { margin: 0; color: var(--color-text-muted, #64748b); }
.eyebrow { margin: 0; color: var(--vis-brand-orange, #d87518); font-size: .7rem; font-weight: 800; letter-spacing: .12em; }
.official-badge, .status-chip { display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px; border-radius: 999px; color: #24543b; background: #e8f5ec; font-size: .82rem; font-weight: 700; white-space: nowrap; }
.panel { padding: 22px; border: 1px solid var(--color-border, #dce2e8); border-radius: 14px; background: var(--color-surface, #fff); box-shadow: var(--shadow-sm, 0 2px 8px #1020300d); }
.section-heading { margin-bottom: 18px; }
.section-heading h2 { margin: 5px 0 0; font-size: 1.2rem; }
.step-label { color: var(--color-text-muted, #64748b); font-size: .82rem; }
.filters-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.field { display: grid; gap: 7px; color: var(--color-heading, #263445); font-size: .86rem; font-weight: 650; }
.field small { color: var(--color-text-muted, #748194); font-weight: 400; }
.field input, .field select { width: 100%; min-height: 42px; padding: 9px 11px; border: 1px solid var(--color-border, #cbd5df); border-radius: 8px; color: inherit; background: var(--color-surface, #fff); font: inherit; font-weight: 400; }
.field input:focus, .field select:focus { outline: 2px solid #f29b46; outline-offset: 1px; }
.field input:disabled { background: var(--color-surface-muted, #f2f4f7); cursor: not-allowed; }
.dependency-note, .table-footnote { margin: 14px 0 0; color: var(--color-text-muted, #667085); font-size: .8rem; }
.preview-summary { display: flex; flex-wrap: wrap; gap: 20px; color: var(--color-text-muted, #667085); font-size: .87rem; }
.preview-summary strong { color: var(--color-heading, #263445); }
.table-wrap { width: 100%; overflow-x: auto; }
.sample-table { width: 100%; border-collapse: collapse; font-size: .84rem; }
.sample-table th, .sample-table td { padding: 11px 12px; border-bottom: 1px solid var(--color-border, #e3e8ee); text-align: left; white-space: nowrap; }
.sample-table th { color: var(--color-text-muted, #667085); background: var(--color-surface-muted, #f7f8fa); font-size: .72rem; letter-spacing: .04em; text-transform: uppercase; }
.sample-table tbody tr:hover { background: var(--color-surface-muted, #fafbfc); }
.empty-state { padding: 26px 16px; border: 1px dashed var(--color-border, #cbd5df); border-radius: 10px; color: var(--color-text-muted, #667085); text-align: center; }
.traceability-seal { display: flex; gap: 12px; align-items: flex-start; margin-top: 18px; padding: 15px; border: 1px solid #b8dec5; border-radius: 10px; color: #24543b; background: #f1faf4; }
.traceability-seal p { margin: 4px 0 0; color: #41634e; font-size: .82rem; line-height: 1.6; overflow-wrap: anywhere; }
.download-actions { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 20px; }
.download-buttons { display: flex; flex-wrap: wrap; gap: 10px; }
.primary-button, .secondary-button, .refresh-button { display: inline-flex; min-height: 42px; align-items: center; justify-content: center; gap: 8px; padding: 9px 14px; border: 1px solid transparent; border-radius: 8px; font: inherit; font-size: .86rem; font-weight: 700; cursor: pointer; }
.primary-button { color: #fff; background: var(--vis-brand-orange, #d87518); }
.secondary-button, .refresh-button { color: var(--color-heading, #263445); background: var(--color-surface, #fff); border-color: var(--color-border, #cbd5df); }
.primary-button:disabled, .secondary-button:disabled, .refresh-button:disabled { opacity: .48; cursor: not-allowed; }
.download-progress { display: flex; min-width: 180px; align-items: center; gap: 10px; color: var(--color-text-muted, #667085); font-size: .84rem; }
.download-progress progress { width: 110px; accent-color: var(--vis-brand-orange, #d87518); }
.progress-spinner { width: 18px; height: 18px; border: 2px solid #ead5c3; border-top-color: var(--vis-brand-orange, #d87518); border-radius: 50%; animation: spin .8s linear infinite; }
.refresh-button { min-height: 36px; font-size: .8rem; }
.notice { display: flex; align-items: center; gap: 9px; padding: 12px 14px; border-radius: 9px; font-size: .86rem; }
.notice-error { color: #872a25; border: 1px solid #efb8b4; background: #fff2f1; }
.notice-info { color: #36516e; border: 1px solid #c8d9eb; background: #f1f7fd; }
.status-chip { padding: 5px 9px; font-size: .74rem; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 980px) { .filters-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .export-page { padding: 18px 12px; } .page-heading, .section-heading, .download-actions { align-items: flex-start; flex-direction: column; } .official-badge { align-self: flex-start; } .filters-grid { grid-template-columns: 1fr; } .panel { padding: 16px; } .preview-summary { gap: 8px 16px; } }
</style>
