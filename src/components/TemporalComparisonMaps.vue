<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Feature, FeatureCollection } from 'geojson'
import { featureIdentifier, synchronizeCameras } from '@/utils/comparacao'

const props = defineProps<{
  layersA: FeatureCollection | null
  layersB: FeatureCollection | null
  delta: FeatureCollection | null
  showDelta: boolean
  loadingA: boolean
  loadingB: boolean
  mode: 'split' | 'swipe'
  labelA: string
  labelB: string
  selectedId: string
}>()
const emit = defineEmits<{
  rendered: [side: 'a' | 'b']
  renderError: [side: 'a' | 'b']
  viewport: [bbox: string]
  'update:selectedId': [id: string]
}>()
const stage = ref<HTMLElement | null>(null)
const elementA = ref<HTMLElement | null>(null)
const elementB = ref<HTMLElement | null>(null)
const divider = ref(50)
const dragging = ref(false)
const tileErrorA = ref(false)
const tileErrorB = ref(false)
const clip = computed(() => (props.mode === 'swipe' ? `inset(0 0 0 ${divider.value}%)` : undefined))
let maps: [L.Map, L.Map] | null = null
const layers: [L.GeoJSON | null, L.GeoJSON | null] = [null, null]
const deltaLayers: [L.GeoJSON | null, L.GeoJSON | null] = [null, null]
let stopSync: (() => void) | undefined
let resizeObserver: ResizeObserver | undefined
let disposed = false
let renderSequence = 0

const colors = { NOVO_ALERTA: '#dc2626', REDUCAO_ALERTA: '#15803d', MANTIDO: '#d6a217' }
function style(feature: Feature | undefined, side: number): L.PathOptions {
  const selected =
    !!feature && !!props.selectedId && featureIdentifier(feature) === props.selectedId
  return {
    color: selected ? '#f26522' : side === 0 ? '#2563eb' : '#7c3aed',
    weight: selected ? 5 : 2,
    fillOpacity: selected ? 0.42 : 0.18,
  }
}

function popupContent(identifier: string): HTMLElement {
  const root = document.createElement('div')
  root.className = 'temporal-popup'
  const title = document.createElement('strong')
  title.textContent = `Imóvel / feição ${identifier}`
  root.append(title)
  for (const [label, collection] of [
    [props.labelA, props.layersA],
    [props.labelB, props.layersB],
  ] as const) {
    const feature = collection?.features.find((item) => featureIdentifier(item) === identifier)
    const line = document.createElement('p')
    line.textContent = `${label}: ${feature ? 'presente no recorte' : 'sem correspondente no recorte'}.`
    root.append(line)
    const area = feature?.properties?.areaHectares ?? feature?.properties?.area_ha
    if (typeof area === 'number' && Number.isFinite(area)) {
      const detail = document.createElement('p')
      detail.textContent = `Área registrada: ${area.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ha`
      root.append(detail)
    }
  }
  return root
}

function inspect(identifier: string, coordinate?: L.LatLng) {
  if (!maps || !identifier) return
  for (const side of [0, 1] as const) {
    const map = maps[side]
    let anchor = coordinate
    layers[side]?.setStyle((feature) => style(feature, side))
    layers[side]?.eachLayer((layer) => {
      if (!('feature' in layer)) return
      if (featureIdentifier(layer.feature as Feature) !== identifier) return
      if ('bringToFront' in layer && typeof layer.bringToFront === 'function') layer.bringToFront()
      if (!anchor && layer instanceof L.Polygon) anchor = layer.getBounds().getCenter()
    })
    L.popup({ autoPan: false, maxWidth: 290 })
      .setLatLng(anchor ?? map.getCenter())
      .setContent(popupContent(identifier))
      .openOn(map)
  }
}

function updateDelta() {
  if (!maps) return
  for (const side of [0, 1] as const) {
    const map = maps[side]
    try {
      if (!deltaLayers[side]) {
        deltaLayers[side] = L.geoJSON(undefined, {
          interactive: false,
          style: (feature) => ({
            color: colors[feature?.properties?.classe as keyof typeof colors] ?? '#64748b',
            weight: 2,
            fillOpacity: 0.5,
          }),
        })
        deltaLayers[side].addTo(map)
      }
      const deltaLayer = deltaLayers[side]
      deltaLayer.clearLayers()
      if (props.showDelta && props.delta) deltaLayer.addData(props.delta)
    } catch {
      deltaLayers[side]?.clearLayers()
      emit('renderError', side === 0 ? 'a' : 'b')
    }
  }
}

async function renderLayers() {
  const sequence = ++renderSequence
  await nextTick()
  if (!maps || disposed || sequence !== renderSequence) return
  const bounds = L.latLngBounds([])
  for (const side of [0, 1] as const) {
    const map = maps[side]
    try {
      layers[side]?.remove()
      map.closePopup()
      const collection = side === 0 ? props.layersA : props.layersB
      layers[side] = collection
        ? L.geoJSON(collection, {
            style: (feature) => style(feature, side),
            onEachFeature: (feature, layer) => {
              layer.on('click', (event: L.LeafletMouseEvent) => {
                const id = featureIdentifier(feature)
                emit('update:selectedId', id)
                inspect(id, event.latlng)
              })
            },
          }).addTo(map)
        : null
      const extent = layers[side]?.getBounds()
      if (extent?.isValid()) bounds.extend(extent)
      emit('rendered', side === 0 ? 'a' : 'b')
    } catch {
      layers[side]?.remove()
      layers[side] = null
      emit('renderError', side === 0 ? 'a' : 'b')
    }
  }
  updateDelta()
  if (bounds.isValid())
    maps[0].fitBounds(bounds, { padding: [32, 32], maxZoom: 14, animate: false })
}

function resizeMaps() {
  if (!maps || disposed) return
  const center = maps[0].getCenter()
  const zoom = maps[0].getZoom()
  for (const map of maps) {
    map.invalidateSize({ pan: false })
    map.setView(center, zoom, { animate: false })
  }
}

function useViewport() {
  if (maps) emit('viewport', maps[0].getBounds().toBBoxString())
}
function moveDivider(event: PointerEvent) {
  if (!dragging.value || !stage.value) return
  const rect = stage.value.getBoundingClientRect()
  divider.value = Math.max(5, Math.min(95, ((event.clientX - rect.left) / rect.width) * 100))
}
function beginDrag(event: PointerEvent) {
  dragging.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  moveDivider(event)
}
function dividerKey(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  divider.value =
    event.key === 'Home'
      ? 5
      : event.key === 'End'
        ? 95
        : Math.max(5, Math.min(95, divider.value + (event.key === 'ArrowLeft' ? -2 : 2)))
}

onMounted(() => {
  if (!elementA.value || !elementB.value) return
  const create = (element: HTMLElement, side: number) => {
    const map = L.map(element, { center: [-15.78, -47.93], zoom: 4, zoomControl: false })
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    })
      .on('tileerror', () => {
        if (side === 0) tileErrorA.value = true
        else tileErrorB.value = true
      })
      .addTo(map)
    return map
  }
  maps = [create(elementA.value, 0), create(elementB.value, 1)]
  stopSync = synchronizeCameras(maps[0], maps[1])
  if (typeof ResizeObserver !== 'undefined' && stage.value) {
    resizeObserver = new ResizeObserver(resizeMaps)
    resizeObserver.observe(stage.value)
  }
  void renderLayers()
})
watch(() => [props.layersA, props.layersB], renderLayers, { flush: 'post' })
watch(() => [props.showDelta, props.delta], updateDelta, { flush: 'post' })
watch(
  () => props.selectedId,
  (id) => {
    if (id) inspect(id)
    else
      maps?.forEach((map, side) => {
        map.closePopup()
        layers[side]?.setStyle((feature) => style(feature, side))
      })
  },
)
watch(
  () => props.mode,
  async () => {
    await nextTick()
    resizeMaps()
  },
)
onBeforeUnmount(() => {
  disposed = true
  stopSync?.()
  resizeObserver?.disconnect()
  maps?.forEach((map) => map.remove())
  maps = null
})
</script>

<template>
  <div class="map-toolbar">
    <span>Arraste ou use o zoom em qualquer mapa. As câmeras permanecem sincronizadas.</span>
    <button type="button" class="btn-secondary" @click="useViewport">
      Usar área visível como recorte
    </button>
  </div>
  <div ref="stage" class="comparison-maps" :class="{ swipe: mode === 'swipe' }" :data-mode="mode">
    <section class="map-shell" aria-label="Mapa da Safra A" :aria-busy="loadingA">
      <div ref="elementA" class="map-canvas" data-testid="map-a" />
      <span class="map-label">A · {{ labelA }}</span>
      <div v-if="loadingA" class="map-loading" role="status">
        <span class="spinner" />Carregando Safra A…
      </div>
      <p v-if="tileErrorA" class="tile-warning">
        Mapa-base indisponível. As feições continuam disponíveis.
      </p>
    </section>
    <section
      class="map-shell map-b"
      :style="{ clipPath: clip }"
      aria-label="Mapa da Safra B"
      :aria-busy="loadingB"
    >
      <div ref="elementB" class="map-canvas" data-testid="map-b" />
      <span class="map-label">B · {{ labelB }}</span>
      <div v-if="loadingB" class="map-loading" role="status">
        <span class="spinner" />Carregando Safra B…
      </div>
      <p v-if="tileErrorB" class="tile-warning">
        Mapa-base indisponível. As feições continuam disponíveis.
      </p>
    </section>
    <button
      v-if="mode === 'swipe'"
      class="swipe-divider"
      type="button"
      role="slider"
      aria-label="Posição da cortina"
      aria-valuemin="5"
      aria-valuemax="95"
      :aria-valuenow="Math.round(divider)"
      :style="{ left: `${divider}%` }"
      @pointerdown="beginDrag"
      @pointermove="moveDivider"
      @pointerup="dragging = false"
      @pointercancel="dragging = false"
      @keydown="dividerKey"
    >
      <span>↔</span>
    </button>
  </div>
</template>

<style scoped>
.map-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  font-size: 0.83rem;
  color: var(--color-text-muted);
}
.map-toolbar button {
  flex-shrink: 0;
  padding: 10px 16px;
  min-height: 40px;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  background: var(--color-surface);
  cursor: pointer;
  font: inherit;
}
.map-toolbar button:focus-visible {
  outline: 2px solid var(--color-brand);
  outline-offset: 2px;
}
.comparison-maps {
  position: relative;
  display: flex;
  height: 480px;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
}
.map-shell {
  position: relative;
  width: 50%;
  min-width: 0;
  height: 100%;
}
.map-shell + .map-shell {
  border-left: 2px solid var(--color-border);
}
.map-canvas {
  position: absolute;
  inset: 0;
  height: 100%;
  width: 100%;
  background: var(--color-surface-soft);
}
.map-label {
  position: absolute;
  z-index: 450;
  top: 12px;
  left: 12px;
  max-width: calc(100% - 24px);
  padding: 7px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-heading);
  font-weight: 700;
  font-size: 0.82rem;
  pointer-events: none;
}
.map-loading {
  position: absolute;
  z-index: 500;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: var(--color-surface);
  opacity: 0.88;
  color: var(--color-heading);
}
.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-brand);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.tile-warning {
  position: absolute;
  z-index: 450;
  bottom: 22px;
  left: 8px;
  max-width: 75%;
  padding: 4px 8px;
  background: var(--color-surface);
  font-size: 0.72rem;
}
.swipe .map-shell {
  width: 100%;
}
.swipe .map-b {
  position: absolute;
  inset: 0;
  border: 0;
}
.swipe .map-b .map-label {
  left: auto;
  right: 12px;
}
.swipe-divider {
  position: absolute;
  z-index: 600;
  top: 0;
  bottom: 0;
  width: 5px;
  padding: 0;
  border: 0;
  background: var(--color-brand);
  cursor: ew-resize;
  touch-action: none;
  transform: translateX(-50%);
}
.swipe-divider span {
  position: absolute;
  top: 48%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  background: var(--color-surface);
  color: var(--color-heading);
  border: 2px solid var(--color-brand);
  border-radius: 50%;
  font-size: 23px;
}
.swipe-divider:focus-visible span {
  outline: 3px solid var(--color-heading);
  outline-offset: 4px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 760px) {
  .comparison-maps {
    height: 410px;
  }
  .map-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .map-label {
    font-size: 0.7rem;
    padding: 5px;
  }
}
</style>
