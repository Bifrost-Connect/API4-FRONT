<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  spatialAnalysisService,
  type SpatialAnalysisDocument,
  type SpatialAnalysisRequest,
  type SpatialAnalysisResult,
} from '../services/spatialAnalysis'

const documents = ref<SpatialAnalysisDocument[]>([])
const selectedCarId = ref('')
const selectedRestrictionIds = ref<string[]>([])
const selectedResult = ref<SpatialAnalysisResult | null>(null)
const analysisResults = ref<SpatialAnalysisResult[]>([])
const analysisId = ref('')
const analysisSource = ref<'API' | 'DEMONSTRACAO' | ''>('')
const isLoadingDocuments = ref(true)
const isCalculating = ref(false)
const loadError = ref('')
const actionMessage = ref('')
const layerError = ref('')
const baseMap = ref<'streets' | 'satellite' | 'topographic'>('streets')
const showCarLayer = ref(true)
const showRestrictionLayers = ref(true)
const showIntersectionLayer = ref(true)
const importCategory = ref<SpatialAnalysisDocument['category']>('CAR')
const fileInput = ref<HTMLInputElement | null>(null)
const mapElement = ref<HTMLElement | null>(null)

let map: L.Map | null = null
let activeBaseLayer: L.TileLayer | null = null
let renderedLayers: L.Layer[] = []
let mapRequestSequence = 0
let mapRefreshTimer: ReturnType<typeof setTimeout> | null = null

const carDocuments = computed(() =>
  documents.value.filter(
    (item) => item.category === 'CAR' || item.zone === 'PUBLICADA' || /^\d+$/.test(item.id),
  ),
)
const restrictionDocuments = computed(() =>
  documents.value.filter(
    (item) => item.zone !== 'PUBLICADA' && (!/^\d+$/.test(item.id) || item.category !== 'CAR'),
  ),
)
const selectedCar = computed(() => carDocuments.value.find((item) => item.id === selectedCarId.value))
const selectedRestrictions = computed(() =>
  restrictionDocuments.value.filter((item) => selectedRestrictionIds.value.includes(item.id)),
)
const failedResults = computed(
  () => analysisResults.value.filter((result) => result.status === 'FALHA_ANALITICA'),
)
const criticalResults = computed(
  () => analysisResults.value.filter((result) => result.percentualSobreposicao > 20),
)
const canCalculate = computed(
  () =>
    Boolean(selectedCarId.value || selectedCar.value) &&
    selectedRestrictionIds.value.length > 0 &&
    !selectedCar.value?.localOnly &&
    selectedRestrictions.value.every((item) => !item.localOnly) &&
    !isCalculating.value,
)

const formatArea = (value: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(value)
const formatPercent = (value: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
const categoryName = (category: SpatialAnalysisDocument['category']) => {
  const names = {
    CAR: 'Imóveis CAR',
    ALERTA: 'Alertas ambientais',
    APP: 'APP',
    RESERVA_LEGAL: 'Reserva Legal',
    TERRA_INDIGENA: 'Terra Indígena',
  }
  return names[category]
}

const setBaseLayer = () => {
  if (!map) return
  activeBaseLayer?.removeFrom(map)
  const layers = {
    streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }),
    satellite: L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri', maxZoom: 19 },
    ),
    topographic: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap',
      maxZoom: 17,
    }),
  }
  activeBaseLayer = layers[baseMap.value].addTo(map)
}

const createPopup = (result: SpatialAnalysisResult) => {
  const content = document.createElement('div')
  const title = document.createElement('strong')
  title.textContent = result.codigoCar
  const propertyArea = document.createElement('div')
  propertyArea.textContent = `Área do imóvel: ${formatArea(result.areaImovelHa)} ha`
  const overlapArea = document.createElement('div')
  overlapArea.textContent = `Área sobreposta: ${formatArea(result.areaSobrepostaHa)} ha`
  const percentage = document.createElement('div')
  percentage.textContent = `Comprometimento: ${formatPercent(result.percentualSobreposicao)}%`
  const year = document.createElement('div')
  year.textContent = `Safra: ${result.safra}`
  content.append(title, propertyArea, overlapArea, percentage, year)
  return content
}

const createCarPopup = (
  feature: GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>,
  spatialDocument: SpatialAnalysisDocument,
) => {
  const properties = feature.properties ?? {}
  const code = String(properties.codigoCar ?? properties.codigo_car ?? properties.id ?? spatialDocument.name)
  const result = analysisResults.value.find((item) => item.codigoCar === code)
  const content = document.createElement('div')
  const title = document.createElement('strong')
  title.textContent = code
  content.append(title)

  const addLine = (label: string, value: string) => {
    const line = document.createElement('div')
    line.textContent = `${label}: ${value}`
    content.append(line)
  }

  const area = Number(properties.areaImovelHa ?? properties.area_ha)
  if (Number.isFinite(area)) addLine('Área do imóvel', `${formatArea(area)} ha`)
  if (result) {
    addLine('Área sobreposta', `${formatArea(result.areaSobrepostaHa)} ha`)
    addLine('Comprometimento', `${formatPercent(result.percentualSobreposicao)}%`)
  } else {
    addLine('Área sobreposta', 'Calcule a análise para consultar')
  }
  addLine('Safra', String(properties.safra ?? spatialDocument.year))
  return content
}

const addIntersectionPattern = () => {
  const svg = map?.getPanes().overlayPane.querySelector('svg') as SVGSVGElement | null
  if (!svg) return
  let defs = svg.querySelector('defs')
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    svg.prepend(defs)
  }
  if (svg.querySelector('#territorial-intersection-pattern')) return

  const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern')
  pattern.setAttribute('id', 'territorial-intersection-pattern')
  pattern.setAttribute('width', '8')
  pattern.setAttribute('height', '8')
  pattern.setAttribute('patternUnits', 'userSpaceOnUse')
  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  background.setAttribute('width', '8')
  background.setAttribute('height', '8')
  background.setAttribute('fill', '#fef08a')
  const hatch = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  hatch.setAttribute('d', 'M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4')
  hatch.setAttribute('stroke', '#ea580c')
  hatch.setAttribute('stroke-width', '1.5')
  pattern.append(background, hatch)
  defs.append(pattern)
}

const updateMapLayers = async () => {
  if (!map) return
  const requestId = ++mapRequestSequence
  layerError.value = ''
  renderedLayers.forEach((layer) => layer.removeFrom(map as L.Map))
  renderedLayers = []

  const addLayer = (layer: L.Layer) => {
    layer.addTo(map as L.Map)
    renderedLayers.push(layer)
  }

  try {
    if (showCarLayer.value && selectedCar.value) {
      const geometry = await spatialAnalysisService.getDocumentGeoJSON(
        selectedCar.value.id,
        map.getBounds().toBBoxString(),
      )
      if (requestId !== mapRequestSequence) return
      addLayer(
        L.geoJSON(geometry, {
          style: { color: '#15803d', weight: 2, fillColor: '#22c55e', fillOpacity: 0.16 },
          onEachFeature: (feature, layer) => {
            layer.bindTooltip(selectedCar.value?.name ?? 'Imóvel CAR')
            if (selectedCar.value) {
              layer.bindPopup(() => createCarPopup(feature, selectedCar.value as SpatialAnalysisDocument))
            }
          },
        }),
      )
    }

    if (showRestrictionLayers.value) {
      for (const restriction of selectedRestrictions.value) {
        const geometry = await spatialAnalysisService.getDocumentGeoJSON(
          restriction.id,
          map.getBounds().toBBoxString(),
        )
        if (requestId !== mapRequestSequence) return
        const colors: Record<SpatialAnalysisDocument['category'], string> = {
          CAR: '#15803d',
          ALERTA: '#dc2626',
          APP: '#7c3aed',
          RESERVA_LEGAL: '#c2410c',
          TERRA_INDIGENA: '#0f766e',
        }
        const color = colors[restriction.category]
        addLayer(
          L.geoJSON(geometry, {
            style: { color, weight: 2, fillColor: color, fillOpacity: 0.2, dashArray: '5 4' },
            onEachFeature: (_feature, layer) => layer.bindTooltip(restriction.name),
          }),
        )
      }
    }

    if (showIntersectionLayer.value) {
      const intersectionFeatures: GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>[] =
        analysisResults.value.flatMap((result) =>
          result.geometry
            ? [
                {
                  type: 'Feature',
                  properties: { resultId: result.id },
                  geometry: result.geometry,
                },
              ]
            : [],
        )
      if (intersectionFeatures.length > 0) {
        const intersectionCollection = {
          type: 'FeatureCollection' as const,
          features: intersectionFeatures,
        } as GeoJSON.GeoJsonObject
        const intersectionLayer = L.geoJSON(
          intersectionCollection,
          {
            style: {
              color: '#c2410c',
              weight: 2,
              fillColor: '#facc15',
              fillOpacity: 0.62,
              dashArray: '3 3',
            },
            onEachFeature: (feature, layer) => {
              const result = analysisResults.value.find(
                (item) => item.id === String(feature.properties?.resultId ?? ''),
              )
              if (!result) return
              layer.bindPopup(() => createPopup(result))
              layer.on('click', () => (selectedResult.value = result))
            },
          },
        )
        addLayer(intersectionLayer)
        addIntersectionPattern()
        intersectionLayer.eachLayer((layer) => {
          if (layer instanceof L.Path) {
            layer.getElement()?.setAttribute('fill', 'url(#territorial-intersection-pattern)')
          }
        })
      }
    }
  } catch (error) {
    console.error('Falha ao carregar geometrias territoriais:', error)
    if (requestId === mapRequestSequence) {
      layerError.value = 'Não foi possível carregar uma das geometrias. Tente atualizar a seleção.'
    }
  }
}

const fitToLayer = (layer: L.Layer) => {
  if (layer instanceof L.GeoJSON && layer.getBounds().isValid()) {
    map?.fitBounds(layer.getBounds().pad(0.12), { maxZoom: 14 })
  }
}

const resetCalculation = () => {
  analysisId.value = ''
  analysisSource.value = ''
  analysisResults.value = []
  selectedResult.value = null
}

const focusResult = (result: SpatialAnalysisResult) => {
  selectedResult.value = result
  if (!map || !result.geometry) return
  const layer = L.geoJSON(result.geometry)
  fitToLayer(layer)
}

const toggleRestriction = (documentId: string) => {
  selectedRestrictionIds.value = selectedRestrictionIds.value.includes(documentId)
    ? selectedRestrictionIds.value.filter((id) => id !== documentId)
    : [...selectedRestrictionIds.value, documentId]
  resetCalculation()
}

const runCalculation = async () => {
  if (!canCalculate.value || !selectedCar.value) return
  isCalculating.value = true
  actionMessage.value = ''
  loadError.value = ''
  resetCalculation()
  const request: SpatialAnalysisRequest = {
    carDocumentId: selectedCar.value.id,
    restrictionDocumentIds: [...selectedRestrictionIds.value],
    safra: selectedCar.value.year,
  }

  try {
    const response = await spatialAnalysisService.calculate(request)
    analysisId.value = response.id
    analysisSource.value = response.source ?? 'API'
    analysisResults.value = response.results
    selectedResult.value = response.results[0] ?? null
    actionMessage.value = `Cálculo concluído: ${response.results.length} imóvel(is) processado(s).`
    await nextTick()
    await updateMapLayers()
    const intersectionLayer = [...renderedLayers]
      .reverse()
      .find((layer) => layer instanceof L.GeoJSON)
    if (intersectionLayer) fitToLayer(intersectionLayer)
  } catch (error: any) {
    loadError.value =
      typeof error === 'string'
        ? error
        : error?.message ?? 'Não foi possível calcular as sobreposições selecionadas.'
  } finally {
    isCalculating.value = false
  }
}

const addGeoJSONDocument = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  loadError.value = ''
  actionMessage.value = ''

  try {
    const parsed = JSON.parse(await file.text()) as GeoJSON.GeoJsonObject
    if (
      parsed.type !== 'FeatureCollection' ||
      !Array.isArray((parsed as GeoJSON.FeatureCollection).features) ||
      !(parsed as GeoJSON.FeatureCollection).features.length
    ) {
      throw new Error('O arquivo precisa ser um GeoJSON FeatureCollection com pelo menos uma feição.')
    }
    const featureCollection = parsed as GeoJSON.FeatureCollection<
      GeoJSON.Geometry,
      Record<string, unknown>
    >
    const invalidFeature = featureCollection.features.some(
      (feature) =>
        !feature.geometry ||
        (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon'),
    )
    if (invalidFeature) {
      throw new Error('A camada deve conter apenas geometrias Polygon ou MultiPolygon.')
    }

    const declaredCrs = (parsed as { crs?: { properties?: { name?: string } } }).crs?.properties?.name
    if (declaredCrs && !/(4326|crs:?84|wgs.?84)/i.test(declaredCrs)) {
      throw new Error('Reprojete o GeoJSON para EPSG:4326 antes de adicioná-lo ao mapa.')
    }
    const isPosition = (position: unknown): position is number[] =>
      Array.isArray(position) &&
      position.length >= 2 &&
      position.every((ordinate) => typeof ordinate === 'number' && Number.isFinite(ordinate)) &&
      Math.abs(position[0] ?? Infinity) <= 180 &&
      Math.abs(position[1] ?? Infinity) <= 90
    const isClosedRing = (ring: unknown): ring is number[][] => {
      if (!Array.isArray(ring) || ring.length < 4 || !ring.every(isPosition)) return false
      const first = ring[0]
      const last = ring[ring.length - 1]
      return !!first && !!last && first[0] === last[0] && first[1] === last[1]
    }
    const hasValidPolygonRings = (coordinates: unknown): boolean =>
      Array.isArray(coordinates) &&
      coordinates.length > 0 &&
      coordinates.every(isClosedRing)
    const hasInvalidGeometry = featureCollection.features.some((feature) => {
      const geometry = feature.geometry
      if (!geometry || !('coordinates' in geometry)) return true
      if (geometry.type === 'Polygon') return !hasValidPolygonRings(geometry.coordinates)
      if (geometry.type === 'MultiPolygon') {
        return (
          !Array.isArray(geometry.coordinates) ||
          geometry.coordinates.length === 0 ||
          !geometry.coordinates.every(hasValidPolygonRings)
        )
      }
      return true
    })
    if (hasInvalidGeometry) {
      throw new Error('As geometrias devem ter anéis fechados e coordenadas válidas em EPSG:4326.')
    }

    const documentId = `local-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`
    const name = file.name.replace(/\.geojson$|\.json$/i, '')
    const addedDocument = spatialAnalysisService.registerLocalDocument(
      {
        id: documentId,
        name,
        category: importCategory.value,
        source: 'Arquivo local',
        year: selectedCar.value?.year ?? '2024',
        zone: 'LOCAL',
        status: 'PRÉ-VISUALIZAÇÃO',
        featureCount: featureCollection.features.length,
      },
      featureCollection,
    )
    documents.value = [...documents.value, addedDocument]
    if (addedDocument.category === 'CAR') selectedCarId.value = addedDocument.id
    else selectedRestrictionIds.value = [...selectedRestrictionIds.value, addedDocument.id]
    resetCalculation()
    actionMessage.value = `${name} foi adicionado para pré-visualização nesta sessão.`
  } catch (error: any) {
    loadError.value = error?.message ?? 'Não foi possível ler este GeoJSON.'
  } finally {
    input.value = ''
  }
}

const initializeMap = () => {
  if (!mapElement.value || map) return
  map = L.map(mapElement.value, { zoomControl: false }).setView([-15.79, -47.91], 11)
  L.control.zoom({ position: 'bottomright' }).addTo(map)
  setBaseLayer()
  map.on('moveend zoomend', scheduleVisibleMapRefresh)
}

const scheduleVisibleMapRefresh = () => {
  if (mapRefreshTimer) clearTimeout(mapRefreshTimer)
  mapRefreshTimer = setTimeout(() => {
    mapRefreshTimer = null
    void updateMapLayers()
  }, 250)
}

watch(
  [selectedCarId, selectedRestrictionIds, showCarLayer, showRestrictionLayers, showIntersectionLayer, analysisResults],
  () => void updateMapLayers(),
)

watch(baseMap, setBaseLayer)
watch(selectedCarId, () => {
  const matchingRestrictions = restrictionDocuments.value.filter(
    (document) => !document.year || !selectedCar.value?.year || document.year === selectedCar.value?.year,
  )
  selectedRestrictionIds.value = selectedRestrictionIds.value.filter((id) =>
    matchingRestrictions.some((document) => document.id === id),
  )
  if (selectedRestrictionIds.value.length === 0 && matchingRestrictions.length > 0) {
    const firstMatchingRestriction = matchingRestrictions[0]
    if (firstMatchingRestriction) selectedRestrictionIds.value = [firstMatchingRestriction.id]
  }
  resetCalculation()
})

onMounted(async () => {
  const scrollContainer = document.querySelector('.content-scroll-container')
  if (scrollContainer) {
    scrollContainer.scrollTop = 0
  }
  initializeMap()
  try {
    documents.value = await spatialAnalysisService.listDocuments()
    selectedCarId.value = carDocuments.value[0]?.id ?? ''
    selectedRestrictionIds.value = restrictionDocuments.value
      .filter((document) => !document.year || !selectedCar.value?.year || document.year === selectedCar.value?.year)
      .slice(0, 3)
      .map((document) => document.id)
    await updateMapLayers()
    await nextTick()
    map?.invalidateSize()
  } catch (error) {
    console.error('Não foi possível carregar os documentos espaciais:', error)
    loadError.value = 'Não foi possível carregar os documentos territoriais disponíveis.'
  } finally {
    isLoadingDocuments.value = false
  }
})

onBeforeUnmount(() => {
  if (mapRefreshTimer) clearTimeout(mapRefreshTimer)
  map?.remove()
  map = null
  activeBaseLayer = null
  renderedLayers = []
})
</script>

<template>
  <main class="analysis-page">
    <header class="analysis-header">
      <div>
        <p class="eyebrow">Área do analista territorial</p>
        <h1>Análise de sobreposição territorial</h1>
        <p class="page-description">
          Selecione documentos geoespaciais tratados, calcule intersecções e inspecione as feições no mapa.
        </p>
      </div>
      <span v-if="analysisSource === 'DEMONSTRACAO'" class="demo-label">Dados demonstrativos</span>
    </header>

    <div v-if="loadError" class="feedback feedback-error" role="alert">{{ loadError }}</div>
    <div v-if="actionMessage" class="feedback feedback-success" role="status">{{ actionMessage }}</div>

    <section class="selection-panel" aria-labelledby="selection-heading">
      <div class="section-heading">
        <div>
          <h2 id="selection-heading">Documentos da análise</h2>
          <p>Use bases já processadas para calcular métricas comparáveis e rastreáveis.</p>
          <p class="field-hint">Os limites podem ser irregulares ou multipartes. A forma exibida segue a geometria do GeoJSON.</p>
        </div>
        <div class="import-control">
          <label for="import-category">Importar prévia</label>
          <select id="import-category" v-model="importCategory">
            <option value="CAR">Imóvel CAR</option>
            <option value="ALERTA">Alerta ambiental</option>
            <option value="APP">APP</option>
            <option value="RESERVA_LEGAL">Reserva Legal</option>
            <option value="TERRA_INDIGENA">Terra Indígena</option>
          </select>
          <button class="button-secondary" type="button" @click="fileInput?.click()">Adicionar GeoJSON</button>
          <input ref="fileInput" class="visually-hidden" type="file" accept=".geojson,.json,application/geo+json,application/json" @change="addGeoJSONDocument" />
        </div>
      </div>

      <div v-if="isLoadingDocuments" class="empty-state">Carregando documentos espaciais…</div>
      <div v-else-if="documents.length === 0" class="empty-state" style="text-align: center; padding: 2rem;">
        <strong style="color: var(--color-heading); font-size: 1rem;">Nenhuma base homologada disponível</strong>
        <p style="margin-top: 0.5rem; color: var(--vis-c-text-dark-2); font-size: 0.85rem;">
          Para realizar cálculos de sobreposição territorial, cadastre e homologue as bases oficiais no sistema ou importe uma prévia GeoJSON acima.
        </p>
      </div>
      <div v-else class="document-grid">
        <div class="form-field car-field">
          <label for="car-document">Imóveis rurais (CAR)</label>
          <select id="car-document" v-model="selectedCarId">
            <option value="" disabled>Selecione a camada de imóveis</option>
            <option v-for="document in carDocuments" :key="document.id" :value="document.id">
              {{ document.name }} · Safra {{ document.year }}{{ document.localOnly ? ' · prévia local' : '' }}
            </option>
          </select>
          <small v-if="selectedCar">{{ selectedCar.source }} · {{ selectedCar.featureCount }} feição(ões) · {{ selectedCar.zone === 'LOCAL' ? 'somente nesta sessão' : 'Zona Tratada' }}</small>
        </div>

        <fieldset class="form-field restriction-field">
          <legend>Camadas de restrição · Safra {{ selectedCar?.year ?? '—' }}</legend>
          <label v-for="document in restrictionDocuments" :key="document.id" class="document-option">
            <input
              type="checkbox"
              :checked="selectedRestrictionIds.includes(document.id)"
              :disabled="!!selectedCar && !!document.year && document.year !== selectedCar.year"
              @change="toggleRestriction(document.id)"
            />
            <span class="document-option-copy">
              <strong>{{ document.name }}</strong>
              <small>{{ document.source }} · {{ document.featureCount }} feição(ões){{ document.localOnly ? ' · prévia local' : '' }}</small>
            </span>
            <span class="category-tag">{{ categoryName(document.category) }}</span>
          </label>
          <p v-if="restrictionDocuments.length === 0" class="field-hint">Nenhuma camada de restrição disponível.</p>
        </fieldset>
      </div>

      <div class="selection-footer">
        <p class="field-hint">
          O cálculo usa documentos processados. GeoJSON local pode ser visualizado, mas precisa passar pela ingestão da aplicação antes de entrar no cálculo oficial.
        </p>
        <button class="calculate-button" type="button" :disabled="!canCalculate" @click="runCalculation">
          {{ isCalculating ? 'Calculando…' : 'Calcular sobreposição' }}
        </button>
      </div>
    </section>

    <div class="analysis-workspace">
      <section class="map-panel" aria-label="Mapa das camadas e intersecções territoriais">
        <div class="map-toolbar">
          <div class="map-title"><strong>Mapa de inspeção</strong><span v-if="analysisId">Análise {{ analysisId }}</span></div>
          <label class="base-map-select">Mapa base
            <select v-model="baseMap">
              <option value="streets">Ruas</option>
              <option value="satellite">Satélite</option>
              <option value="topographic">Topográfico</option>
            </select>
          </label>
        </div>
        <div ref="mapElement" class="map-canvas" aria-label="Mapa interativo de imóveis CAR, restrições e sobreposições"></div>
        <div class="map-layer-controls" aria-label="Camadas visíveis">
          <label><input v-model="showCarLayer" type="checkbox" /><span class="legend-swatch swatch-car"></span>Imóveis CAR</label>
          <label><input v-model="showRestrictionLayers" type="checkbox" /><span class="legend-swatch swatch-restriction"></span>Alertas e restrições</label>
          <label><input v-model="showIntersectionLayer" type="checkbox" /><span class="legend-swatch swatch-intersection"></span>Área de intersecção</label>
        </div>
        <p v-if="layerError" class="map-error" role="alert">{{ layerError }}</p>
      </section>

      <aside class="results-panel" aria-label="Resultados do cálculo territorial">
        <div class="results-heading">
          <div><p class="eyebrow">Cálculo</p><h2>Resultados</h2></div>
          <span class="result-count">{{ analysisResults.length }}</span>
        </div>
        <div v-if="analysisResults.length === 0" class="empty-state results-empty">
          <strong>Nenhum cálculo nesta sessão</strong>
          <span>Escolha uma camada CAR e ao menos uma restrição para iniciar a análise.</span>
        </div>
        <template v-else>
          <p class="result-summary">
            {{ criticalResults.length }} imóvel(is) com sobreposição acima de 20%
            <span v-if="failedResults.length"> · {{ failedResults.length }} falha(s) analítica(s)</span>
          </p>
          <div class="result-list">
            <button
              v-for="result in analysisResults"
              :key="result.id"
              class="result-item"
              :class="{ 'result-item-active': selectedResult?.id === result.id, 'result-item-failed': result.status === 'FALHA_ANALITICA' }"
              type="button"
              @click="focusResult(result)"
            >
              <span class="result-item-heading"><strong>{{ result.codigoCar }}</strong><span>{{ result.status === 'PROCESSADO' ? `${formatPercent(result.percentualSobreposicao)}%` : 'Falha' }}</span></span>
              <span v-if="result.status === 'PROCESSADO'" class="result-metrics">
                {{ formatArea(result.areaImovelHa) }} ha no imóvel · {{ formatArea(result.areaSobrepostaHa) }} ha sobrepostos
              </span>
              <span v-else class="result-metrics">{{ result.message ?? 'Falha topológica neste imóvel.' }}</span>
              <span class="result-year">Safra {{ result.safra }}</span>
            </button>
          </div>
          <div v-if="selectedResult" class="selected-result-card">
            <strong>Feição selecionada</strong>
            <span>{{ selectedResult.codigoCar }}</span>
            <small>Área: {{ formatArea(selectedResult.areaImovelHa) }} ha</small>
            <small>Sobreposição: {{ formatArea(selectedResult.areaSobrepostaHa) }} ha ({{ formatPercent(selectedResult.percentualSobreposicao) }}%)</small>
            <small>Safra: {{ selectedResult.safra }}</small>
          </div>
        </template>
        <p class="precision-note">Áreas em hectares com quatro casas decimais; percentual com duas.</p>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.analysis-page { display: grid; gap: 20px; max-width: 1500px; margin: 0 auto; color: var(--color-text); }
.analysis-header, .section-heading, .selection-footer, .map-toolbar, .results-heading, .result-item-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.analysis-header { align-items: flex-end; }
.eyebrow { margin: 0 0 5px; color: var(--vis-brand-orange); font-size: .72rem; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; }
h1, h2 { margin: 0; color: var(--color-heading); }
h1 { font-size: clamp(1.45rem, 2.5vw, 1.95rem); }
h2 { font-size: 1.05rem; }
.page-description, .section-heading p { margin: 7px 0 0; color: var(--vis-c-text-dark-2); font-size: .88rem; }
.demo-label { padding: 6px 10px; color: #92400e; background: #fef3c7; border-radius: 999px; font-size: .75rem; font-weight: 700; white-space: nowrap; }
.feedback { padding: 11px 14px; border-radius: 6px; font-size: .86rem; }
.feedback-error { color: #991b1b; background: #fee2e2; border: 1px solid #fecaca; }
.feedback-success { color: #166534; background: #dcfce7; border: 1px solid #bbf7d0; }
.selection-panel, .map-panel, .results-panel { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; }
.selection-panel { padding: 18px 20px; }
.section-heading { align-items: flex-start; margin-bottom: 18px; }
.import-control { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 7px; }
.import-control label, .base-map-select { color: var(--vis-c-text-dark-2); font-size: .76rem; font-weight: 700; }
.import-control select, .base-map-select select, .form-field select { min-height: 38px; padding: 0 10px; color: var(--color-text); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 5px; }
.button-secondary { min-height: 38px; padding: 0 12px; color: var(--vis-brand-primary); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 5px; font: inherit; font-size: .8rem; font-weight: 700; cursor: pointer; }
.button-secondary:hover { background: var(--color-surface-soft); }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; clip-path: inset(50%); }
.document-grid { display: grid; grid-template-columns: minmax(250px, .9fr) minmax(350px, 1.4fr); gap: 18px; }
.form-field { min-width: 0; margin: 0; padding: 0; border: 0; }
.form-field > label, .form-field legend { display: block; margin-bottom: 8px; color: var(--color-heading); font-size: .8rem; font-weight: 700; }
.car-field select { width: 100%; }
.form-field > small { display: block; margin-top: 7px; color: var(--vis-c-text-dark-2); font-size: .74rem; }
.restriction-field { display: grid; align-content: start; gap: 7px; }
.restriction-field legend { float: left; width: 100%; }
.document-option { display: flex; align-items: center; gap: 9px; min-width: 0; padding: 8px 9px; border: 1px solid var(--color-border); border-radius: 6px; cursor: pointer; }
.document-option:has(input:disabled) { opacity: .55; cursor: not-allowed; }
.document-option input, .map-layer-controls input { accent-color: var(--vis-brand-primary); }
.document-option-copy { display: grid; gap: 2px; min-width: 0; flex: 1; }
.document-option-copy strong { overflow: hidden; color: var(--color-heading); font-size: .76rem; text-overflow: ellipsis; white-space: nowrap; }
.document-option-copy small { color: var(--vis-c-text-dark-2); font-size: .69rem; }
.category-tag { flex-shrink: 0; padding: 3px 6px; color: var(--vis-brand-primary); background: var(--color-surface-soft); border-radius: 4px; font-size: .64rem; font-weight: 700; }
.selection-footer { align-items: flex-end; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--color-border); }
.field-hint { margin: 0; color: var(--vis-c-text-dark-2); font-size: .74rem; line-height: 1.45; }
.calculate-button { flex-shrink: 0; min-height: 42px; padding: 0 18px; color: white; background: var(--vis-brand-primary); border: 0; border-radius: 6px; font: inherit; font-size: .84rem; font-weight: 700; cursor: pointer; }
.calculate-button:disabled { opacity: .5; cursor: not-allowed; }
.analysis-workspace { display: grid; grid-template-columns: minmax(0, 1fr) 340px; min-height: 610px; gap: 16px; }
.map-panel { display: flex; min-width: 0; flex-direction: column; overflow: hidden; }
.map-toolbar { min-height: 54px; padding: 9px 14px; border-bottom: 1px solid var(--color-border); }
.map-title { display: grid; gap: 2px; }
.map-title strong { color: var(--color-heading); font-size: .86rem; }
.map-title span { color: var(--vis-c-text-dark-2); font-size: .68rem; }
.base-map-select { display: flex; align-items: center; gap: 7px; }
.base-map-select select { min-height: 32px; }
.map-canvas { z-index: 0; min-height: 490px; flex: 1; }
.map-layer-controls { display: flex; flex-wrap: wrap; gap: 10px 18px; padding: 11px 14px; border-top: 1px solid var(--color-border); }
.map-layer-controls label { display: inline-flex; align-items: center; gap: 6px; color: var(--color-text); font-size: .73rem; cursor: pointer; }
.legend-swatch { width: 12px; height: 12px; border: 2px solid; border-radius: 3px; }
.swatch-car { border-color: #15803d; background: #bbf7d0; }
.swatch-restriction { border-color: #dc2626; background: #fecaca; }
.swatch-intersection { border-color: #c2410c; background: #facc15; }
.map-error { margin: 0; padding: 8px 14px; color: var(--vis-c-danger); font-size: .78rem; }
.results-panel { display: flex; min-width: 0; flex-direction: column; padding: 17px 15px; }
.results-heading { padding-bottom: 12px; border-bottom: 1px solid var(--color-border); }
.result-count { display: grid; width: 28px; height: 28px; place-items: center; color: white; background: var(--vis-brand-orange); border-radius: 50%; font-size: .77rem; font-weight: 800; }
.result-summary { margin: 12px 0 8px; color: var(--vis-c-text-dark-2); font-size: .72rem; line-height: 1.4; }
.result-list { display: grid; max-height: 310px; gap: 7px; overflow-y: auto; }
.result-item { display: grid; gap: 5px; padding: 10px; color: var(--color-text); text-align: left; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 6px; cursor: pointer; }
.result-item:hover, .result-item-active { border-color: var(--vis-brand-primary); background: var(--color-surface-soft); }
.result-item-failed { border-left: 3px solid var(--vis-c-danger); }
.result-item-heading strong { color: var(--color-heading); font-size: .73rem; }
.result-item-heading span { color: var(--vis-brand-primary); font-size: .78rem; font-weight: 800; }
.result-metrics, .result-year { color: var(--vis-c-text-dark-2); font-size: .68rem; line-height: 1.35; }
.result-year { font-weight: 700; }
.selected-result-card { display: grid; gap: 5px; margin-top: auto; padding: 11px; background: var(--color-surface-soft); border-left: 3px solid var(--vis-brand-orange); border-radius: 4px; }
.selected-result-card strong { margin-bottom: 2px; color: var(--vis-c-text-dark-2); font-size: .67rem; text-transform: uppercase; }
.selected-result-card span { color: var(--color-heading); font-size: .78rem; font-weight: 700; }
.selected-result-card small { color: var(--color-text); font-size: .7rem; }
.precision-note { margin: 14px 0 0; color: var(--vis-c-text-dark-2); font-size: .66rem; }
.empty-state { padding: 15px 12px; color: var(--vis-c-text-dark-2); font-size: .76rem; }
.results-empty { display: grid; gap: 7px; margin: auto 0; text-align: center; }
.results-empty strong { color: var(--color-heading); }
@media (max-width: 1050px) {
  .analysis-workspace { grid-template-columns: minmax(0, 1fr) 300px; }
  .document-grid { grid-template-columns: 1fr; }
}
@media (max-width: 800px) {
  .analysis-workspace { grid-template-columns: 1fr; }
  .map-canvas { min-height: 420px; }
  .results-panel { min-height: 280px; }
}
@media (max-width: 620px) {
  .analysis-header, .section-heading, .selection-footer { align-items: stretch; flex-direction: column; }
  .import-control { justify-content: flex-start; }
  .calculate-button { width: 100%; }
  .map-toolbar { align-items: flex-start; flex-direction: column; }
  .base-map-select { width: 100%; justify-content: space-between; }
  .map-layer-controls { display: grid; }
}
</style>
