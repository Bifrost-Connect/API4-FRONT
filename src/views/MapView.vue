<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, ref, watch, type Raw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { mapService, DEFAULT_MAP_PALETTE, type PublishedLocation } from '../services/map'
import { geojsonCache } from '@/services/storage/geojsonCache'
import { uiPreferencesStorage } from '@/services/storage/uiPreferencesStorage'

interface MapLocation {
  id: string
  name: string
  type: string
  latitude: number
  longitude: number
  status: 'Processado' | 'Em validação' | 'Aguardando' | 'Concluída'
  total_feicoes: number
}

type RawLocationInput = PublishedLocation & {
  nome?: string
  tipo?: string
  lat?: number
  lng?: number
  totalFeicoes?: number
  feicoes?: number
  featureCount?: number
}

interface TerritoryProperties {
  id?: number | string
  processoId?: number | string
  codigoImovel?: string
  anoSafra?: string
  areaHectares?: number | string
  name?: string
  category?: string
  status?: string
  source?: string
}

const route = useRoute()
const router = useRouter()
const mapElement = ref<HTMLElement | null>(null)
const searchTerm = ref('')
const selectedLocation = ref<MapLocation | null>(null)
const selectedCoordinates = ref({ latitude: -15.78, longitude: -47.93 })
const mapError = ref('')
const isFromCache = ref(false)
const isRefreshingCache = ref(false)

const locations = ref<MapLocation[]>([])

interface BaseLayerItem {
  id: string
  name: string
  type: string
  processoId?: string | number
  color: string
  visible: boolean
  featureCount: number
  layer: Raw<L.GeoJSON>
  bounds?: L.LatLngBounds
}

interface CatalogBaseItem {
  id: string
  name: string
  type: string
  latitude: number
  longitude: number
  status: MapLocation['status']
  total_feicoes: number
  color: string
  visible: boolean
  loading: boolean
  loaded: boolean
}

const baseLayers = ref<BaseLayerItem[]>([])
const loadingBaseIds = ref<Record<string, boolean>>({})
const customColors = ref<Record<string, string>>({})

const DEFAULT_PALETTE = DEFAULT_MAP_PALETTE

const catalogBases = computed<CatalogBaseItem[]>(() => {
  return locations.value.map((location, index) => {
    const id = String(location.id)
    const layerMatch = baseLayers.value.find((b) => String(b.id) === id)
    const color =
      customColors.value[id] ??
      layerMatch?.color ??
      DEFAULT_PALETTE[index % DEFAULT_PALETTE.length] ??
      '#10b981'

    return {
      id,
      name: location.name,
      type: location.type,
      latitude: location.latitude,
      longitude: location.longitude,
      status: location.status,
      total_feicoes: location.total_feicoes,
      color,
      visible: layerMatch ? layerMatch.visible : false,
      loading: Boolean(loadingBaseIds.value[id]),
      loaded: Boolean(layerMatch),
    }
  })
})

let map: L.Map | null = null
let markers: L.LayerGroup | null = null

const markerIcon = L.divIcon({
  className: 'map-marker-wrapper',
  html: '<span class="map-marker"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

const selectLocation = (location: MapLocation) => {
  selectedLocation.value = location
  selectedCoordinates.value = { latitude: location.latitude, longitude: location.longitude }
  map?.flyTo([location.latitude, location.longitude], 8, { duration: 0.8 })
}

const clearBaseLayers = () => {
  baseLayers.value.forEach((b) => {
    if (b.layer && map && map.hasLayer(b.layer)) {
      map.removeLayer(b.layer)
    }
  })
  baseLayers.value = []
}

const createGeoJsonLayer = (
  features: GeoJSON.Feature[],
  color: string,
  baseName: string,
): L.GeoJSON => {
  return L.geoJSON(
    { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection,
    {
      style: () => ({
        color,
        weight: 2,
        opacity: 1,
        fillColor: color,
        fillOpacity: 0.3,
      }),
      onEachFeature: (feature, fLayer) => {
        const props = (feature.properties || {}) as TerritoryProperties
        const title = props.codigoImovel || props.name || `Feição #${props.id || ''}`
        const details = [
          props.areaHectares ? `Área: ${props.areaHectares} ha` : null,
          props.category ? `Categoria: ${props.category}` : null,
          props.anoSafra ? `Safra: ${props.anoSafra}` : null,
          props.processoId ? `Processo: #${props.processoId}` : null,
          baseName ? `Base: ${baseName}` : null,
        ].filter(Boolean)

        fLayer.bindTooltip(title)
        fLayer.bindPopup(
          `<div style="font-size: 0.85rem; line-height: 1.4;">
            <strong style="color: ${color}; font-size: 0.95rem;">${title}</strong><br />
            ${details.join('<br />')}
            ${
              props.processoId
                ? `<div style="margin-top: 8px; border-top: 1px solid var(--color-border); padding-top: 4px;">
              <a href="/processo/${props.processoId}" style="color: var(--color-accent-link); text-decoration: underline; font-weight: 600;">Ver Detalhes do Processo</a>
            </div>`
                : ''
            }
          </div>`,
        )
      },
    },
  )
}

const toggleBaseVisibility = (base: BaseLayerItem) => {
  if (!map || !base.layer) return
  if (base.visible) {
    if (!map.hasLayer(base.layer)) {
      base.layer.addTo(map)
    }
  } else {
    if (map.hasLayer(base.layer)) {
      map.removeLayer(base.layer)
    }
  }
}

const updateBaseColor = (base: BaseLayerItem) => {
  if (!base.layer) return
  base.layer.setStyle({
    color: base.color,
    fillColor: base.color,
  })
}

const zoomToBase = (base: BaseLayerItem) => {
  if (!map) return
  if (base.bounds && base.bounds.isValid()) {
    map.fitBounds(base.bounds.pad(0.12), { maxZoom: 14 })
  } else {
    const loc = locations.value.find((l) => String(l.id) === String(base.id))
    if (loc) selectLocation(loc)
  }
}

const upsertBaseLayerFromFeatures = (
  baseId: string,
  features: GeoJSON.Feature[],
  options?: { fitBounds?: boolean },
): BaseLayerItem | null => {
  if (!map || features.length === 0) return null

  const normalizedId = String(baseId)
  const existingIndex = baseLayers.value.findIndex((b) => String(b.id) === normalizedId)
  const existing = existingIndex >= 0 ? baseLayers.value[existingIndex] : undefined

  const locIndex = locations.value.findIndex((l) => String(l.id) === normalizedId)
  const locMatch = locIndex >= 0 ? locations.value[locIndex] : undefined
  const paletteIndex = locIndex >= 0 ? locIndex : baseLayers.value.length

  const color =
    customColors.value[normalizedId] ??
    existing?.color ??
    DEFAULT_PALETTE[paletteIndex % DEFAULT_PALETTE.length] ??
    '#10b981'

  const firstProps = (features[0]?.properties || {}) as TerritoryProperties
  const baseName =
    locMatch?.name || firstProps.name || firstProps.category || `Base #${normalizedId}`
  const baseType =
    locMatch?.type ||
    (firstProps.anoSafra ? `Safra ${firstProps.anoSafra}` : 'Camada Territorial')

  if (existing?.layer && map.hasLayer(existing.layer)) {
    map.removeLayer(existing.layer)
  }

  const layer = createGeoJsonLayer(features, color, baseName)
  layer.addTo(map)

  const rawBounds = layer.getBounds()
  const bounds = rawBounds && rawBounds.isValid() ? rawBounds : undefined

  const item: BaseLayerItem = {
    id: normalizedId,
    name: baseName,
    type: baseType,
    processoId: firstProps.processoId ?? locMatch?.id,
    color,
    visible: true,
    featureCount: features.length,
    layer: markRaw(layer),
    bounds,
  }

  if (existingIndex >= 0) {
    baseLayers.value.splice(existingIndex, 1, item)
  } else {
    baseLayers.value.push(item)
  }

  if (options?.fitBounds) {
    zoomToBase(item)
  }

  return item
}

const mergeGeoJsonIntoBaseLayers = (geojson: { features?: GeoJSON.Feature[] }) => {
  if (!map || !Array.isArray(geojson.features) || geojson.features.length === 0) return

  const groups = new Map<string, GeoJSON.Feature[]>()
  geojson.features.forEach((feature) => {
    const props = (feature.properties || {}) as TerritoryProperties
    const key = String(props.processoId || props.category || props.source || 'base_padrao')
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(feature)
  })

  const mergedBounds: L.LatLngBounds[] = []
  groups.forEach((groupFeatures, key) => {
    const item = upsertBaseLayerFromFeatures(key, groupFeatures, { fitBounds: false })
    if (item?.bounds) {
      mergedBounds.push(item.bounds)
    }
  })

  if (mergedBounds.length > 0) {
    const combined = mergedBounds[0]
    if (combined) {
      for (let i = 1; i < mergedBounds.length; i++) {
        const nextBound = mergedBounds[i]
        if (nextBound) {
          combined.extend(nextBound)
        }
      }
      if (combined.isValid()) {
        map.fitBounds(combined.pad(0.12), { maxZoom: 14 })
      }
    }
  }
}

const toggleAllBases = (visible: boolean) => {
  baseLayers.value.forEach((base) => {
    base.visible = visible
    toggleBaseVisibility(base)
  })
}

const loadBaseLayerOnDemand = async (
  baseId: string,
  options?: { forceRefresh?: boolean; fitBounds?: boolean },
) => {
  const normalizedBaseId = String(baseId).trim()
  if (!normalizedBaseId) return
  if (loadingBaseIds.value[normalizedBaseId]) return

  const existing = baseLayers.value.find((b) => String(b.id) === normalizedBaseId)
  if (existing && !options?.forceRefresh) {
    existing.visible = true
    toggleBaseVisibility(existing)
    if (options?.fitBounds) {
      zoomToBase(existing)
    }
    return
  }

  loadingBaseIds.value = { ...loadingBaseIds.value, [normalizedBaseId]: true }
  try {
    const numericOrStringId = /^\d+$/.test(normalizedBaseId)
      ? Number(normalizedBaseId)
      : normalizedBaseId

    const fetchedTerritories = await mapService.getTerritories(
      { processoId: numericOrStringId, baseId: numericOrStringId },
      { forceRefresh: options?.forceRefresh },
    )
    if (!map) return

    isFromCache.value = Boolean(fetchedTerritories.fromCache)
    mapError.value = ''

    const features = Array.isArray(fetchedTerritories.features)
      ? (fetchedTerritories.features as GeoJSON.Feature[])
      : []

    if (features.length > 0) {
      upsertBaseLayerFromFeatures(normalizedBaseId, features, {
        fitBounds: options?.fitBounds,
      })
    } else {
      if (existing) {
        if (existing.layer && map.hasLayer(existing.layer)) {
          map.removeLayer(existing.layer)
        }
        baseLayers.value = baseLayers.value.filter((b) => String(b.id) !== normalizedBaseId)
      }
      if (options?.fitBounds) {
        const loc = locations.value.find((l) => String(l.id) === normalizedBaseId)
        if (loc) selectLocation(loc)
      }
    }
  } catch (err) {
    console.warn('Falha ao carregar camada da base:', err)
    mapError.value = 'Não foi possível carregar os polígonos desta base.'
  } finally {
    loadingBaseIds.value = { ...loadingBaseIds.value, [normalizedBaseId]: false }
  }
}

const onToggleBase = async (base: CatalogBaseItem, event?: Event) => {
  const existing = baseLayers.value.find((b) => String(b.id) === base.id)
  if (!existing) {
    await loadBaseLayerOnDemand(base.id, { fitBounds: true })
    const loaded = baseLayers.value.find((b) => String(b.id) === base.id)
    if (!loaded && event?.target instanceof HTMLInputElement) {
      event.target.checked = false
    }
    return
  }

  existing.visible = !existing.visible
  toggleBaseVisibility(existing)
}

const onFocusBase = async (base: CatalogBaseItem) => {
  if (loadingBaseIds.value[base.id]) return

  const loc = locations.value.find((l) => String(l.id) === base.id)
  if (loc) {
    selectLocation(loc)
  } else {
    selectedLocation.value = null
    selectedCoordinates.value = { latitude: base.latitude, longitude: base.longitude }
  }

  const existing = baseLayers.value.find((b) => String(b.id) === base.id)
  if (!existing) {
    await loadBaseLayerOnDemand(base.id, { fitBounds: true })
    return
  }

  existing.visible = true
  toggleBaseVisibility(existing)
  zoomToBase(existing)
}

const onColorInput = (base: CatalogBaseItem, event: Event) => {
  const target = event.target as HTMLInputElement | null
  const nextColor = target?.value
  if (!nextColor) return

  customColors.value = {
    ...customColors.value,
    [base.id]: nextColor,
  }

  const existing = baseLayers.value.find((b) => String(b.id) === base.id)
  if (existing) {
    existing.color = nextColor
    updateBaseColor(existing)
  }
}

const findLocation = async () => {
  const rawTerm = searchTerm.value.trim()
  const normalizedTerm = rawTerm.toLowerCase()
  if (!normalizedTerm) return

  const parts = normalizedTerm.split(',').map((part) => part.trim())
  if (parts.length === 2 && parts.every((part) => part !== '' && !Number.isNaN(Number(part)))) {
    const latitude = Number(parts[0])
    const longitude = Number(parts[1])
    if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
      selectedLocation.value = null
      selectedCoordinates.value = { latitude, longitude }
      mapError.value = ''
      map?.flyTo([latitude, longitude], 8, { duration: 0.8 })
      return
    }
  }

  const location = locations.value.find(
    (item) =>
      item.name.toLowerCase().includes(normalizedTerm) ||
      item.type.toLowerCase().includes(normalizedTerm),
  )
  if (location) {
    mapError.value = ''
    selectLocation(location)
    await loadBaseLayerOnDemand(location.id, { fitBounds: true })
    return
  }

  // Fallback para busca textual de feições no servidor preservando o catálogo de bases
  try {
    const fetchedTerritories = await mapService.getTerritories({ busca: rawTerm })
    if (!map) return
    if (Array.isArray(fetchedTerritories.features) && fetchedTerritories.features.length > 0) {
      mapError.value = ''
      isFromCache.value = Boolean(fetchedTerritories.fromCache)
      mergeGeoJsonIntoBaseLayers({ features: fetchedTerritories.features as GeoJSON.Feature[] })
    } else {
      mapError.value = 'Nenhuma base ou feição encontrada para a busca informada.'
    }
  } catch (err) {
    console.warn('Falha ao filtrar camadas no mapa:', err)
    mapError.value = 'Não foi possível realizar a busca no mapa.'
  }
}

const locateUser = () => {
  if (!navigator.geolocation) {
    mapError.value = 'A geolocalização não está disponível neste navegador.'
    return
  }

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      selectedLocation.value = null
      selectedCoordinates.value = { latitude: coords.latitude, longitude: coords.longitude }
      map?.flyTo([coords.latitude, coords.longitude], 12, { duration: 0.8 })
      mapError.value = ''
    },
    () => {
      mapError.value = 'Não foi possível obter sua localização atual.'
    },
  )
}

const limparFiltroProcesso = async () => {
  searchTerm.value = ''
  mapError.value = ''
  selectedLocation.value = null
  clearBaseLayers()
  await router.push({ path: '/mapa' })
}

const carregarCamadasElocais = async (forceRefresh = false) => {
  isRefreshingCache.value = true
  try {
    const rawLocations = await mapService.getPublishedLocations()
    if (!map) return

    locations.value = Array.isArray(rawLocations)
      ? (rawLocations as RawLocationInput[]).map((loc) => ({
          id: String(loc.id ?? ''),
          name: String(loc.name ?? loc.nome ?? `Base #${loc.id ?? ''}`),
          type: String(loc.type ?? loc.tipo ?? 'Base Territorial'),
          latitude: Number(loc.latitude ?? loc.lat ?? -15.78),
          longitude: Number(loc.longitude ?? loc.lng ?? -47.93),
          status: (loc.status ?? 'Concluída') as MapLocation['status'],
          total_feicoes: Number(
            loc.total_feicoes ?? loc.totalFeicoes ?? loc.feicoes ?? loc.featureCount ?? 0,
          ),
        }))
      : []

    if (markers && map) {
      markers.clearLayers()
      locations.value.forEach((location) => {
        if (!Number.isNaN(location.latitude) && !Number.isNaN(location.longitude)) {
          const marker = L.marker([location.latitude, location.longitude], { icon: markerIcon })
            .bindTooltip(location.name)
            .on('click', () => selectLocation(location))
          marker.addTo(markers as L.LayerGroup)
        }
      })
    }

    const rawProcessoId = route.query?.processoId || route.query?.id
    const targetProcessoId = rawProcessoId ? String(rawProcessoId).trim() : ''
    const requestedBase = String(route.query?.base || '').trim()
    const requestedYear = String(route.query?.year || '').trim()

    if (targetProcessoId) {
      const matchedLocation = locations.value.find((l) => String(l.id) === targetProcessoId)
      if (matchedLocation) {
        selectedLocation.value = matchedLocation
        selectedCoordinates.value = {
          latitude: matchedLocation.latitude,
          longitude: matchedLocation.longitude,
        }
      }
      await loadBaseLayerOnDemand(targetProcessoId, { forceRefresh, fitBounds: true })
    } else if (requestedBase || requestedYear) {
      if (requestedBase) searchTerm.value = requestedBase
      const normalizedBase = requestedBase.toLowerCase()
      const normalizedYear = requestedYear.toLowerCase()

      const exactMatch = locations.value.find((item) => {
        const name = item.name.toLowerCase()
        const type = item.type.toLowerCase()
        const matchesBase =
          !normalizedBase || name.includes(normalizedBase) || type.includes(normalizedBase)
        const matchesYear =
          !normalizedYear || type.includes(normalizedYear) || name.includes(normalizedYear)
        return matchesBase && matchesYear
      })

      const match =
        exactMatch ||
        (normalizedBase
          ? locations.value.find(
              (item) =>
                item.name.toLowerCase().includes(normalizedBase) ||
                item.type.toLowerCase().includes(normalizedBase),
            )
          : undefined)

      if (match) {
        selectLocation(match)
        await loadBaseLayerOnDemand(match.id, { forceRefresh, fitBounds: true })
      } else if (locations.value[0]) {
        selectLocation(locations.value[0])
      }
    }
  } finally {
    isRefreshingCache.value = false
  }
}

const forcarAtualizacaoCache = async () => {
  clearBaseLayers()
  await geojsonCache.clearAll()
  await carregarCamadasElocais(true)
}

onMounted(async () => {
  const scrollContainer = document.querySelector('.content-scroll-container')
  if (scrollContainer) {
    scrollContainer.scrollTop = 0
  }

  if (!mapElement.value) return

  const savedCamera = uiPreferencesStorage.getMapCamera()
  const initialLat = savedCamera?.lat ?? -15.78
  const initialLng = savedCamera?.lng ?? -47.93
  const initialZoom = savedCamera?.zoom ?? 4

  map = L.map(mapElement.value, { zoomControl: false }).setView([initialLat, initialLng], initialZoom)
  L.control.zoom({ position: 'bottomright' }).addTo(map)

  map.on('moveend', () => {
    if (!map) return
    const center = map.getCenter()
    uiPreferencesStorage.setMapCamera({
      lat: Number(center.lat.toFixed(4)),
      lng: Number(center.lng.toFixed(4)),
      zoom: map.getZoom(),
    })
  })

  map.on('click', ({ latlng }) => {
    selectedLocation.value = null
    selectedCoordinates.value = { latitude: latlng.lat, longitude: latlng.lng }
    mapError.value = ''
  })

  const satelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19,
    },
  ).addTo(map)
  const streetsLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  })

  L.control
    .layers(
      {
        Satélite: satelliteLayer,
        'Mapa de ruas': streetsLayer,
      },
      {},
      { position: 'topright' },
    )
    .addTo(map)

  markers = L.layerGroup().addTo(map)

  await carregarCamadasElocais()
})

watch(
  () => [route.query?.processoId, route.query?.id, route.query?.base, route.query?.year],
  async () => {
    if (map) {
      await carregarCamadasElocais()
    }
  },
)

onBeforeUnmount(() => {
  clearBaseLayers()
  map?.remove()
  map = null
  markers = null
})
</script>

<template>
  <main class="map-view">
    <div class="page-heading">
      <div>
        <p class="eyebrow">Visualização territorial compartilhada</p>
        <h1>Mapa territorial</h1>
        <p class="page-description">
          Consulte as bases e os limites geográficos disponíveis. As áreas seguem a geometria dos documentos, incluindo contornos irregulares e multipartes.
        </p>
      </div>
      <button class="btn btn_outline locate-button" type="button" @click="locateUser">
        <span aria-hidden="true">⌖</span>
        Minha localização
      </button>
    </div>

    <div v-if="route.query?.processoId || route.query?.id" class="filter-badge-banner" role="status">
      <span>Exibindo delimitações da <strong>Carga #{{ route.query?.processoId || route.query?.id }}</strong></span>
      <button type="button" class="btn-clear-filter" @click="limparFiltroProcesso">Ver todas as cargas</button>
    </div>

    <!-- Indicador de Cache e Ação de Atualização -->
    <div class="cache-status-bar">
      <span v-if="isFromCache" class="cache-badge cache-hit" title="Camadas carregadas instantaneamente do IndexedDB local">
        ⚡ Carregado do cache local
      </span>
      <span v-else class="cache-badge cache-miss" title="Camadas sincronizadas diretamente da API REST">
        🌐 Sincronizado da API
      </span>
      <button
        type="button"
        class="btn-refresh-cache"
        :disabled="isRefreshingCache"
        @click="forcarAtualizacaoCache"
        title="Limpar cache e buscar feições atualizadas da API"
      >
        {{ isRefreshingCache ? 'Atualizando...' : '🔄 Atualizar camadas (limpar cache)' }}
      </button>
    </div>

    <section class="map-toolbar" aria-label="Ferramentas do mapa">
      <form class="search-form" @submit.prevent="findLocation">
        <label for="map-search">Buscar base ou coordenadas</label>
        <div class="search-controls">
          <input
            id="map-search"
            v-model="searchTerm"
            type="search"
            placeholder="Ex.: Base Brasília ou -15.78, -47.93"
          />
          <button class="btn" type="submit">Buscar</button>
        </div>
      </form>
      <p v-if="mapError" class="map-error" role="alert">{{ mapError }}</p>
    </section>

    <section class="map-layout">
      <div
        ref="mapElement"
        class="map-canvas"
        aria-label="Mapa interativo das bases operacionais e delimitações territoriais"
      ></div>

      <aside class="locations-panel" aria-label="Bases cadastradas">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Camadas e Delimitações</p>
            <h2>Bases cadastradas</h2>
          </div>
          <span class="location-count">{{ locations.length }}</span>
        </div>

        <!-- Atalhos de visualização rápida -->
        <div v-if="baseLayers.length > 0" class="layer-quick-actions">
          <button type="button" class="btn-quick-toggle" @click="toggleAllBases(true)">
            Mostrar todas
          </button>
          <span class="action-divider">|</span>
          <button type="button" class="btn-quick-toggle" @click="toggleAllBases(false)">
            Ocultar todas
          </button>
        </div>

        <div class="location-list">
          <div
            v-if="locations.length === 0"
            class="empty-locations-state"
            style="padding: 1.5rem 0.5rem; text-align: center; color: var(--color-text-muted); font-size: 0.82rem;"
          >
            Nenhuma base oficial cadastrada ainda.
          </div>

          <div
            v-for="base in catalogBases"
            :key="base.id"
            class="base-layer-card"
            :class="{ 'base-layer-inactive': !base.visible && !base.loading }"
          >
            <div class="base-layer-header">
              <!-- Checkbox de ativação/desativação da base -->
              <label class="base-checkbox-label" title="Ativar ou desativar esta base no mapa">
                <input
                  type="checkbox"
                  :checked="base.visible"
                  :disabled="base.loading"
                  class="base-checkbox"
                  @change="onToggleBase(base, $event)"
                />
              </label>

              <!-- Seletor de cor com amostra interativa -->
              <div class="color-picker-control" title="Clique para escolher a cor dos polígonos desta base">
                <input
                  type="color"
                  :value="base.color"
                  class="native-color-picker"
                  @input="onColorInput(base, $event)"
                />
                <span
                  class="color-indicator-swatch"
                  :style="{ backgroundColor: base.color }"
                ></span>
              </div>

              <!-- Informações e zoom na base -->
              <div class="base-layer-info" @click="onFocusBase(base)">
                <strong>{{ base.name }}</strong>
                <small>{{ base.type }} &bull; {{ base.total_feicoes }} polígonos</small>
                <small v-if="base.loading" class="base-loading-indicator">Carregando polígonos...</small>
              </div>

              <button
                type="button"
                class="btn-zoom-target"
                title="Focar nesta base no mapa"
                :disabled="base.loading"
                @click="onFocusBase(base)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div class="coordinates-card">
          <span>Coordenada selecionada</span>
          <strong>
            {{ selectedCoordinates.latitude.toFixed(4) }}, {{ selectedCoordinates.longitude.toFixed(4) }}
          </strong>
          <small>{{ selectedLocation?.name ?? 'Clique em qualquer ponto do mapa' }}</small>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.map-view {
  display: grid;
  gap: 18px;
}

.page-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.panel-heading,
.search-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.eyebrow {
  margin-bottom: 4px;
  color: var(--color-brand);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1,
h2 {
  color: var(--color-heading);
}

h1 {
  font-size: clamp(1.6rem, 2.5vw, 2.2rem);
  font-weight: 750;
}

h2 {
  font-size: 1.1rem;
  font-weight: 700;
}

.page-description {
  margin-top: 4px;
  color: var(--color-text);
}

.filter-badge-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1rem;
  background: var(--badge-primary-bg);
  border: 1px solid var(--badge-primary-border);
  border-radius: 6px;
  font-size: 0.88rem;
  color: var(--color-heading);
}

.btn-clear-filter {
  background: transparent;
  border: 1px solid var(--color-brand);
  color: var(--color-brand);
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-clear-filter:hover {
  background: var(--color-brand);
  color: var(--color-brand-contrast);
}

.locate-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  flex-shrink: 0;
  padding: 0.6rem 1.1rem;
}

.map-toolbar {
  padding: 18px 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-top: 3px solid var(--color-brand);
}

.search-form {
  display: grid;
  gap: 8px;
}

.search-form label {
  color: var(--color-heading);
  font-size: 0.78rem;
  font-weight: 700;
}

.search-controls {
  justify-content: initial;
}

.search-controls input {
  width: min(620px, 100%);
  min-height: 42px;
  padding: 0 12px;
  color: var(--color-text);
  background: var(--color-surface-soft);
  border: 1px solid var(--color-border);
}

.map-error {
  margin-top: 8px;
  color: var(--vis-c-danger);
  font-size: 0.82rem;
}

.map-layout {
  min-height: 560px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.map-canvas {
  min-height: 560px;
  z-index: 0;
}

.locations-panel {
  display: flex;
  flex-direction: column;
  padding: 22px 18px;
  border-left: 1px solid var(--color-border);
}

.location-count {
  min-width: 28px;
  min-height: 28px;
  display: grid;
  place-items: center;
  color: var(--color-brand-contrast);
  background: var(--color-brand);
  border-radius: 50%;
  font-size: 0.8rem;
  font-weight: 800;
}

.location-list {
  display: grid;
  gap: 4px;
  margin-top: 18px;
  max-height: 380px;
  overflow-y: auto;
  align-content: start;
  padding-right: 4px;
}

/* Controles de Camadas e Cores */
.layer-quick-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 0.76rem;
}

.btn-quick-toggle {
  background: transparent;
  border: none;
  color: var(--color-brand);
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

.btn-quick-toggle:hover {
  opacity: 0.8;
}

.action-divider {
  color: var(--color-border);
}

.base-layer-card {
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--color-surface-soft);
  border: 1px solid var(--color-border);
  transition: all 0.2s ease;
  margin-bottom: 6px;
}

.base-layer-card:hover {
  border-color: var(--color-brand);
}

.base-layer-inactive {
  opacity: 0.55;
  background: transparent;
}

.base-layer-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.base-checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin: 0;
}

.base-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--color-brand);
  cursor: pointer;
}

.color-picker-control {
  position: relative;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  cursor: pointer;
}

.native-color-picker {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.color-indicator-swatch {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--color-surface);
  box-shadow: var(--shadow-sm);
  pointer-events: none;
  transition: transform 0.15s ease;
}

.color-picker-control:hover .color-indicator-swatch {
  transform: scale(1.15);
}

.base-layer-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
}

.base-layer-info strong {
  font-size: 0.82rem;
  color: var(--color-heading);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.base-layer-info small {
  font-size: 0.72rem;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.base-layer-info small.base-loading-indicator {
  color: var(--color-brand);
  font-weight: 600;
  font-size: 0.7rem;
}

.base-checkbox:disabled,
.btn-zoom-target:disabled {
  opacity: 0.5;
  cursor: wait;
}

.btn-zoom-target {
  background: transparent;
  border: none;
  color: var(--color-text);
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.btn-zoom-target:hover {
  color: var(--color-brand);
}

.location-item {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 8px;
  color: var(--color-text);
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
}

.location-item:hover,
.location-item-active {
  background: var(--color-surface-soft);
  border-color: var(--color-border);
}

.location-dot {
  width: 9px;
  height: 9px;
  margin-top: 5px;
  flex-shrink: 0;
  background: var(--vis-c-success);
  border-radius: 50%;
}

.status-em-validação {
  background: var(--vis-c-warning);
}

.status-aguardando {
  background: var(--vis-c-info);
}

.location-content {
  display: grid;
  gap: 2px;
}

.location-content strong {
  color: var(--color-heading);
  font-size: 0.88rem;
}

.location-content small,
.coordinates-card span,
.coordinates-card small {
  color: var(--color-text);
  font-size: 0.74rem;
}

.coordinates-card {
  display: grid;
  gap: 4px;
  margin-top: auto;
  padding: 14px;
  background: var(--color-surface-soft);
  border-left: 3px solid var(--color-brand);
}

.coordinates-card strong {
  color: var(--color-heading);
  font-size: 0.86rem;
}

@media (max-width: 900px) {
  .map-layout {
    grid-template-columns: 1fr;
  }

  .locations-panel {
    border-top: 1px solid var(--color-border);
    border-left: 0;
  }

  .location-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .locate-button {
    width: 100%;
    justify-content: center;
  }

  .search-controls {
    align-items: stretch;
    flex-direction: column;
  }

  .search-controls input {
    width: 100%;
  }

  .location-list {
    grid-template-columns: 1fr;
  }

  .cache-status-bar {
    justify-content: flex-start;
    flex-wrap: wrap;
    margin: 0;
  }
}

.cache-status-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin: -8px 0 0;
}

.cache-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
}

.cache-badge.cache-hit {
  background: var(--badge-success-bg);
  color: var(--badge-success-text);
  border: 1px solid var(--badge-success-border);
}

.cache-badge.cache-miss {
  background: var(--badge-info-bg);
  color: var(--badge-info-text);
  border: 1px solid var(--badge-info-border);
}

.btn-refresh-cache {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 0.78rem;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-refresh-cache:hover:not(:disabled) {
  border-color: var(--color-brand);
  color: var(--color-brand);
}

.btn-refresh-cache:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
