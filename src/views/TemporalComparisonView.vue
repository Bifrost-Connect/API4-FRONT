<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import TemporalComparisonMaps from '@/components/TemporalComparisonMaps.vue'

type FeatureCollection = GeoJSON.FeatureCollection
import {
  comparisonService,
  comparisonErrorMessage,
  type PublishedSeason,
  type EvolutionMetrics,
} from '@/services/comparacao'
import {
  featureIdentifier,
  normalizeBbox,
  parseBbox,
  percentageVariation,
} from '@/utils/comparacao'

const route = useRoute()
const seasons = ref<PublishedSeason[]>([])
const datasetId = ref('')
const seasonA = ref('')
const seasonB = ref('')
const coordinates = ref<(string | number)[]>(['', '', '', ''])
const coordinateLabels = ['Longitude oeste', 'Latitude sul', 'Longitude leste', 'Latitude norte']
const loadingCatalog = ref(true)
const catalogError = ref('')
const prefillMessage = ref('')
const errorMessage = ref('')
const loadingPair = ref(false)
const renderingA = ref(false)
const renderingB = ref(false)
const loadingMetrics = ref(false)
const layersA = ref<FeatureCollection | null>(null)
const layersB = ref<FeatureCollection | null>(null)
const metrics = ref<EvolutionMetrics | null>(null)
const simplifiedLayers = ref(false)
const mode = ref<'split' | 'swipe'>('split')
const showDelta = ref(true)
const panelOpen = ref(true)
const selectedId = ref('')
const mapsRef = ref<InstanceType<typeof TemporalComparisonMaps> | null>(null)
let requestSequence = 0
let activeRequest: AbortController | undefined
let catalogRequest: AbortController | undefined

const datasetOptions = computed(() => [
  ...new Map(seasons.value.map((s) => [s.datasetId, s.dataset])).entries(),
])
const availableSeasons = computed(() =>
  seasons.value.filter((s) => s.datasetId === datasetId.value),
)
const selectedA = computed(() => availableSeasons.value.find((s) => s.id === seasonA.value))
const selectedB = computed(() => availableSeasons.value.find((s) => s.id === seasonB.value))
const bbox = computed(() => parseBbox(coordinates.value))
const busy = computed(
  () => loadingPair.value || loadingMetrics.value || renderingA.value || renderingB.value,
)
const canCompare = computed(
  () =>
    !!datasetId.value &&
    !!selectedA.value &&
    !!selectedB.value &&
    seasonA.value !== seasonB.value &&
    !!bbox.value &&
    !loadingCatalog.value &&
    !busy.value,
)
const label = (season: PublishedSeason | undefined) =>
  season ? `${season.year} · ${season.version}` : 'Selecione uma safra'
const percent = computed(() =>
  metrics.value
    ? percentageVariation(metrics.value.areaSafraAHectares, metrics.value.areaSafraBHectares)
    : null,
)
function buildFeatureMap(collection: FeatureCollection | null): Map<string, GeoJSON.Feature> {
  const map = new Map<string, GeoJSON.Feature>()
  if (!collection) return map
  for (const feature of collection.features) {
    const id = featureIdentifier(feature)
    if (id) map.set(id, feature)
  }
  return map
}
const featureMapA = computed(() => buildFeatureMap(layersA.value))
const featureMapB = computed(() => buildFeatureMap(layersB.value))
const identifiers = computed(() => [
  ...new Set([...featureMapA.value.keys(), ...featureMapB.value.keys()]),
])
const selectedFeatures = computed(() => [
  featureMapA.value.get(selectedId.value),
  featureMapB.value.get(selectedId.value),
])
const area = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
const signed = (value: number) => `${value > 0 ? '+' : ''}${area(value)}`

function clearResults() {
  requestSequence++
  activeRequest?.abort()
  loadingPair.value = renderingA.value = renderingB.value = loadingMetrics.value = false
  layersA.value = layersB.value = null
  metrics.value = null
  simplifiedLayers.value = false
  selectedId.value = ''
  errorMessage.value = ''
}

async function loadSeasons() {
  catalogRequest?.abort()
  const controller = new AbortController()
  catalogRequest = controller
  loadingCatalog.value = true
  catalogError.value = ''
  prefillMessage.value = ''
  try {
    const result = await comparisonService.listPublishedSeasons(controller.signal)
    if (controller.signal.aborted) return
    seasons.value = result
    preselectSeason()
  } catch (error) {
    if (!controller.signal.aborted) catalogError.value = comparisonErrorMessage(error)
  } finally {
    if (!controller.signal.aborted) loadingCatalog.value = false
  }
}

async function executeComparison() {
  if (!canCompare.value || !bbox.value) return
  clearResults()
  const sequence = requestSequence
  const controller = new AbortController()
  activeRequest = controller
  const parameters = { seasonA: seasonA.value, seasonB: seasonB.value, bbox: bbox.value }
  loadingPair.value = loadingMetrics.value = true
  const current = () => !controller.signal.aborted && sequence === requestSequence
  const reportError = (error: unknown) => {
    if (current() && !axios.isCancel(error)) errorMessage.value = comparisonErrorMessage(error)
  }
  await Promise.allSettled([
    comparisonService
      .getPairedLayers(parameters, controller.signal)
      .then((result) => {
        if (!current()) return
        if (!result.cargaA.features.length || !result.cargaB.features.length) {
          throw new Error(
            'Uma das safras não possui cobertura no recorte escolhido. Selecione outra área ou outra safra.',
          )
        }
        renderingA.value = renderingB.value = true
        layersA.value = result.cargaA
        layersB.value = result.cargaB
        simplifiedLayers.value = result.simplificada === true
      })
      .catch(reportError)
      .finally(() => {
        if (current()) loadingPair.value = false
      }),
    comparisonService
      .getEvolution(parameters, controller.signal)
      .then((result) => {
        if (current()) metrics.value = result
      })
      .catch(reportError)
      .finally(() => {
        if (current()) loadingMetrics.value = false
      }),
  ])
}

function useViewport(value: string) {
  const parts = value.split(',').map(Number)
  if (parts.length !== 4) return
  const [west, south, east, north] = parts
  if (west === undefined || south === undefined || east === undefined || north === undefined)
    return
  const normalized = normalizeBbox(west, south, east, north)
  if (normalized) coordinates.value = normalized
}
function rendered(side: 'a' | 'b') {
  if (side === 'a') renderingA.value = false
  else renderingB.value = false
}
function renderError(side: 'a' | 'b') {
  rendered(side)
  errorMessage.value = `Não foi possível desenhar a Safra ${side.toUpperCase()}. Tente novamente ou selecione um recorte menor.`
}

function preselectSeason() {
  const preselected = seasons.value.find((season) => season.id === String(route.query.baseA ?? ''))
  prefillMessage.value = ''
  if (preselected) {
    datasetId.value = preselected.datasetId
    seasonB.value = ''
    seasonA.value = preselected.id
  } else if (route.query.baseA) {
    prefillMessage.value =
      'A base indicada não está disponível como versão publicada para comparação.'
  }
}

watch(datasetId, () => {
  if (!selectedA.value) seasonA.value = ''
  if (!selectedB.value) seasonB.value = ''
})
watch([datasetId, seasonA, seasonB, () => coordinates.value.join(',')], clearResults)
watch(() => route.query.baseA, preselectSeason)
onMounted(loadSeasons)
onBeforeUnmount(() => {
  clearResults()
  catalogRequest?.abort()
})
</script>

<template>
  <main class="temporal-page">
    <header class="page-heading">
      <div>
        <span class="eyebrow">ANÁLISE TERRITORIAL</span>
        <h1>Comparação Temporal de Safras</h1>
        <p>
          Compare versões oficiais no mesmo recorte e acompanhe a evolução de alertas e
          desmatamento.
        </p>
      </div>
      <span class="official-badge">Somente versões publicadas</span>
    </header>

    <div v-if="catalogError" class="error-notice" role="alert">
      {{ catalogError }}
      <button type="button" class="btn-secondary" @click="loadSeasons">
        Tentar carregar safras novamente
      </button>
    </div>
    <p v-if="prefillMessage" class="info-notice" role="status">{{ prefillMessage }}</p>
    <p v-if="loadingCatalog" role="status" class="info-notice">
      Carregando versões oficialmente publicadas…
    </p>
    <p v-else-if="!catalogError && !seasons.length" class="info-notice">
      Nenhuma safra publicada está disponível. A comparação exige duas versões aprovadas de um mesmo
      conjunto.
    </p>

    <form class="parameters" @submit.prevent="executeComparison">
      <div class="parameter-selects">
        <label
          >Conjunto temático<select
            v-model="datasetId"
            :disabled="loadingCatalog"
            required
            aria-label="Conjunto temático"
          >
            <option value="">Selecione o conjunto</option>
            <option v-for="[id, name] in datasetOptions" :key="id" :value="id">{{ name }}</option>
          </select></label
        >
        <label
          >Safra inicial / Base A<select
            v-model="seasonA"
            :disabled="!datasetId || loadingCatalog"
            required
            aria-label="Safra inicial / Base A"
          >
            <option value="">Selecione a versão inicial</option>
            <option
              v-for="season in availableSeasons"
              :key="season.id"
              :value="season.id"
              :disabled="season.id === seasonB"
            >
              {{ label(season) }}
            </option>
          </select></label
        >
        <label
          >Safra comparada / Base B<select
            v-model="seasonB"
            :disabled="!datasetId || loadingCatalog"
            required
            aria-label="Safra comparada / Base B"
          >
            <option value="">Selecione outra versão</option>
            <option
              v-for="season in availableSeasons"
              :key="season.id"
              :value="season.id"
              :disabled="season.id === seasonA"
            >
              {{ label(season) }}
            </option>
          </select></label
        >
      </div>
      <fieldset class="region-fields">
        <legend>Região / recorte geográfico</legend>
        <div class="region-header">
          <p>Posicione os mapas e use a área visível, ou informe os limites em graus decimais.</p>
          <button
            type="button"
            class="btn-secondary btn-capture-viewport"
            data-testid="btn-capture-viewport"
            @click="mapsRef?.useViewport()"
          >
            Usar área visível do mapa
          </button>
        </div>
        <div class="coordinate-inputs">
          <label v-for="(name, index) in coordinateLabels" :key="name"
            >{{ name }}
            <input
              v-model="coordinates[index]"
              type="number"
              step="any"
              :aria-label="name"
              required
              :min="index % 2 ? -90 : -180"
              :max="index % 2 ? 90 : 180"
            />
          </label>
        </div>
        <p
          v-if="coordinates.every((v) => String(v).trim()) && !bbox"
          class="validation-message"
          role="alert"
        >
          Os limites oeste/sul devem ser menores que leste/norte e estar dentro das coordenadas
          válidas.
        </p>
      </fieldset>
      <footer class="form-footer">
        <p>Escolha duas versões diferentes do mesmo conjunto e um recorte válido.</p>
        <button class="btn-primary" type="submit" :disabled="!canCompare">
          {{ busy ? 'Comparando…' : 'Executar Comparação' }}
        </button>
      </footer>
    </form>

    <div v-if="errorMessage" class="error-notice error-toast" role="alert" aria-live="assertive">
      {{ errorMessage }}
      <button
        class="btn-secondary"
        type="button"
        :disabled="!canCompare"
        @click="executeComparison"
      >
        Tentar novamente
      </button>
      <button
        class="dismiss-button"
        type="button"
        aria-label="Fechar aviso"
        @click="errorMessage = ''"
      >
        ×
      </button>
    </div>

    <section class="map-section" aria-label="Comparação geográfica">
      <div class="view-options">
        <div class="view-switch" role="group" aria-label="Modo de comparação">
          <button type="button" :aria-pressed="mode === 'split'" @click="mode = 'split'">
            Lado a Lado (2 Mapas)
          </button>
          <button type="button" :aria-pressed="mode === 'swipe'" @click="mode = 'swipe'">
            Cortina Deslizante (Swipe)
          </button>
        </div>
        <label class="delta-toggle"
          ><input v-model="showDelta" type="checkbox" /> Destacar Evolução / Mudanças</label
        >
      </div>
      <TemporalComparisonMaps
        ref="mapsRef"
        v-model:selected-id="selectedId"
        :layers-a="layersA"
        :layers-b="layersB"
        :delta="metrics?.geoJsonClassificado ?? null"
        :show-delta="showDelta"
        :mode="mode"
        :loading-a="loadingPair || renderingA || (showDelta && loadingMetrics)"
        :loading-b="loadingPair || renderingB || (showDelta && loadingMetrics)"
        :label-a="label(selectedA)"
        :label-b="label(selectedB)"
        @rendered="rendered"
        @render-error="renderError"
        @viewport="useViewport"
      />
      <div v-if="showDelta" class="delta-legend" aria-label="Legenda de evolução">
        <span><i class="legend-new" />Novos alertas / desmatamento</span
        ><span><i class="legend-reduction" />Redução / recuperação</span
        ><span><i class="legend-kept" />Áreas mantidas</span>
      </div>
      <p v-if="metrics?.simplificada || simplifiedLayers" class="info-notice">
        As geometrias foram simplificadas para visualização. As métricas preservam as áreas
        originais.
      </p>
    </section>

    <section class="metrics-panel" aria-label="Indicadores de evolução">
      <button
        type="button"
        class="panel-toggle"
        :aria-expanded="panelOpen"
        aria-controls="temporal-metrics"
        @click="panelOpen = !panelOpen"
      >
        Indicadores de evolução <span>{{ panelOpen ? 'Recolher −' : 'Expandir +' }}</span>
      </button>
      <div v-show="panelOpen" id="temporal-metrics" class="metrics-body">
        <p v-if="loadingMetrics" role="status">Calculando diferenças e áreas em hectares…</p>
        <div v-else-if="metrics" class="metric-grid">
          <article>
            <h2>Área de alertas · Safra A</h2>
            <strong data-testid="area-a"
              >{{ area(metrics.areaSafraAHectares) }} <small>ha</small></strong
            >
            <p>{{ label(selectedA) }}</p>
          </article>
          <article>
            <h2>Área de alertas · Safra B</h2>
            <strong data-testid="area-b"
              >{{ area(metrics.areaSafraBHectares) }} <small>ha</small></strong
            >
            <p>{{ label(selectedB) }}</p>
          </article>
          <article :class="metrics.saldoVariacaoHectares > 0 ? 'increase' : 'reduction'">
            <h2>Diferença absoluta</h2>
            <strong data-testid="absolute-change"
              >{{ signed(metrics.saldoVariacaoHectares) }} <small>ha</small></strong
            >
            <p>Safra B − Safra A</p>
          </article>
          <article>
            <h2>Variação percentual</h2>
            <strong data-testid="percentage-change">{{
              percent === null ? 'Não aplicável' : `${signed(percent)}%`
            }}</strong>
            <p>
              {{
                percent === null
                  ? 'Sem base de referência: Safra A = 0 ha.'
                  : 'Em relação à Safra A'
              }}
            </p>
          </article>
          <article>
            <h2>Novas áreas</h2>
            <strong>{{ area(metrics.areaAumentoHectares) }} <small>ha</small></strong>
          </article>
          <article>
            <h2>Áreas reduzidas</h2>
            <strong>{{ area(metrics.areaReducaoHectares) }} <small>ha</small></strong>
          </article>
          <article>
            <h2>Áreas mantidas</h2>
            <strong>{{ area(metrics.areaMantidaHectares) }} <small>ha</small></strong>
          </article>
          <article>
            <h2>Imóveis com agravamento / redução</h2>
            <strong>— / —</strong>
            <p>A contagem por imóvel ainda não está disponível.</p>
          </article>
        </div>
        <p v-else>Execute uma comparação para consultar as métricas oficiais do recorte.</p>
      </div>
    </section>

    <section
      v-if="identifiers.length"
      class="inspection-panel"
      aria-label="Inspeção de imóvel ou feição"
    >
      <label
        >Inspecionar imóvel / feição<select
          v-model="selectedId"
          aria-label="Inspecionar imóvel / feição"
        >
          <option value="">Clique em um polígono ou selecione seu identificador</option>
          <option v-for="id in identifiers" :key="id" :value="id">{{ id }}</option>
        </select></label
      >
      <div v-if="selectedId" class="inspection-details" aria-live="polite">
        <strong>{{ selectedId }}</strong>
        <p>
          Safra A · {{ label(selectedA) }}:
          {{ selectedFeatures[0] ? 'presente no recorte' : 'sem correspondente no recorte' }}.
        </p>
        <p>
          Safra B · {{ label(selectedB) }}:
          {{ selectedFeatures[1] ? 'presente no recorte' : 'sem correspondente no recorte' }}.
        </p>
        <p class="muted">
          O histórico de áreas por imóvel ainda não está disponível. A presença da feição no recorte
          não indica, por si só, agravamento ou recuperação.
        </p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.temporal-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 28px;
  box-sizing: border-box;
  color: var(--color-text);
}
.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  min-width: 0;
  margin-bottom: 4px;
}
.page-heading > div {
  min-width: 0;
}
.eyebrow {
  color: var(--color-brand);
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  font-weight: 700;
}
h1 {
  color: var(--color-heading);
  font-size: 1.8rem;
  margin: 6px 0;
}
.page-heading p,
.form-footer p,
.region-fields p,
.muted {
  color: var(--color-text-muted);
  font-size: 0.86rem;
}
.official-badge {
  white-space: nowrap;
  flex-shrink: 0;
  background: var(--badge-success-bg);
  color: var(--badge-success-text);
  padding: 8px 12px;
  border: 1px solid var(--badge-success-border);
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}
.parameters,
.map-section,
.metrics-panel,
.inspection-panel {
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  box-shadow: var(--shadow-sm);
}
.parameters,
.map-section,
.inspection-panel {
  padding: 20px;
}
.parameter-selects {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  min-width: 0;
}
label {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
  font-size: 0.84rem;
  font-weight: 600;
}
select,
input[type='number'] {
  min-width: 0;
  min-height: 42px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  background: var(--color-surface);
  border-radius: 6px;
  font: inherit;
  font-weight: 400;
}
input:focus-visible,
select:focus-visible,
button:focus-visible {
  outline: 2px solid var(--color-brand);
  outline-offset: 2px;
}
.region-fields {
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin: 20px 0 0;
  padding: 14px;
}
legend {
  padding: 0 7px;
  font-weight: 700;
  font-size: 0.86rem;
}
.region-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.region-header p {
  margin: 0;
}
.btn-capture-viewport {
  flex-shrink: 0;
}
.coordinate-inputs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  min-width: 0;
}
.form-footer {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  align-items: center;
  margin-top: 16px;
}
.btn-primary,
.btn-secondary,
.view-switch button {
  padding: 10px 16px;
  min-height: 40px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
  font-size: 0.83rem;
}
.btn-primary {
  color: var(--color-brand-contrast);
  background: var(--color-brand);
  border-color: var(--color-brand);
  font-weight: 700;
}
.btn-secondary {
  color: var(--color-text);
  background: var(--color-surface);
}
button:disabled,
select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.view-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}
.view-switch {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.view-switch button {
  background: var(--color-surface-soft);
  color: var(--color-text);
}
.view-switch button[aria-pressed='true'] {
  background: var(--badge-primary-bg);
  color: var(--color-brand);
  border-color: var(--color-brand);
  font-weight: 700;
}
.delta-toggle {
  flex-direction: row;
  align-items: center;
}
.delta-legend {
  display: flex;
  gap: 22px;
  flex-wrap: wrap;
  font-size: 0.78rem;
  padding-top: 14px;
}
.delta-legend span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.delta-legend i {
  width: 12px;
  height: 12px;
}
.legend-new {
  background: var(--map-layer-restriction-stroke);
}
.legend-reduction {
  background: var(--map-layer-car-stroke);
}
.legend-kept {
  background: var(--map-layer-delta-kept);
}
.metrics-panel {
  padding: 0;
  overflow: hidden;
}
.panel-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  padding: 18px 20px;
  border: 0;
  background: var(--color-surface);
  color: var(--color-heading);
  cursor: pointer;
  font-weight: 700;
}
.panel-toggle span {
  color: var(--color-brand);
  font-size: 0.8rem;
}
.metrics-body {
  padding: 0 20px 20px;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  background: var(--color-border);
  border: 1px solid var(--color-border);
  min-width: 0;
}
.metric-grid article {
  min-width: 0;
  background: var(--color-surface);
  padding: 16px;
}
.metric-grid h2 {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--color-text-muted);
  margin: 0 0 10px;
}
.metric-grid strong {
  font-size: 1.35rem;
  color: var(--color-heading);
}
.metric-grid small {
  font-size: 0.76rem;
  font-weight: 400;
}
.metric-grid p {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  margin: 8px 0 0;
}
.metric-grid .increase strong {
  color: var(--badge-danger-text);
}
.metric-grid .reduction strong {
  color: var(--badge-success-text);
}
.inspection-details {
  margin-top: 16px;
  font-size: 0.86rem;
  overflow-wrap: anywhere;
}
.inspection-details p {
  margin: 8px 0;
}
.error-notice,
.info-notice {
  padding: 14px 16px;
  margin: 0;
  font-size: 0.86rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
}
.map-section .info-notice {
  margin-top: 14px;
}
.error-notice {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  background: var(--badge-danger-bg);
  color: var(--badge-danger-text);
  border-color: var(--badge-danger-border);
}
.info-notice {
  color: var(--color-text-muted);
  background: var(--color-surface-soft);
}
.validation-message {
  color: var(--badge-danger-text) !important;
  margin: 10px 0 0 !important;
}
.dismiss-button {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 22px;
  cursor: pointer;
  margin-left: auto;
}
@media (max-width: 1280px) {
  .coordinate-inputs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 1080px) {
  .parameter-selects {
    grid-template-columns: minmax(0, 1fr);
  }
  .page-heading {
    flex-direction: column;
    align-items: flex-start;
  }
}
@media (max-width: 760px) {
  .temporal-page {
    padding: 18px 12px;
  }
  .parameters,
  .map-section,
  .inspection-panel {
    padding: 14px;
  }
  .form-footer {
    flex-direction: column;
    align-items: stretch;
  }
  h1 {
    font-size: 1.45rem;
  }
  .view-switch button {
    font-size: 0.74rem;
    padding: 9px;
  }
}
@media (max-width: 640px) {
  .coordinate-inputs {
    grid-template-columns: minmax(0, 1fr);
  }
  .metric-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .btn-capture-viewport {
    width: 100%;
  }
}
</style>
