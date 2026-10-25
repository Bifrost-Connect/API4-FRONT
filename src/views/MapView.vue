<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { mapService } from '../services/map'

interface MapLocation {
  id: string
  name: string
  type: string
  latitude: number
  longitude: number
  status: 'Processado' | 'Em validação' | 'Aguardando' | 'Concluída'
}

interface TerritoryProperties {
  id?: number | string
  processoId?: number | string
  codigoImovel?: string
  anoSafra?: string
  name?: string
  category?: string
  status?: string
  source?: string
}

const route = useRoute()
const mapElement = ref<HTMLElement | null>(null)
const searchTerm = ref('')
const selectedLocation = ref<MapLocation | null>(null)
const selectedCoordinates = ref({ latitude: -15.78, longitude: -47.93 })
const mapError = ref('')

const locations = ref<MapLocation[]>([])

let map: L.Map | null = null
let markers: L.LayerGroup | null = null
let territories: L.GeoJSON | null = null

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

const findLocation = async () => {
  const normalizedTerm = searchTerm.value.trim().toLowerCase()
  if (!normalizedTerm) return

  const location = locations.value.find((item) => item.name.toLowerCase().includes(normalizedTerm))
  if (location) {
    selectLocation(location)
  }

  // US09: Atualiza as camadas territoriais filtradas por busca textual no servidor
  try {
    const fetchedTerritories = await mapService.getTerritories({ busca: searchTerm.value.trim() })
    if (territories && map) {
      map.removeLayer(territories)
      territories = createTerritoryLayer(fetchedTerritories as any).addTo(map)
    }
  } catch (err) {
    console.warn('Falha ao filtrar camadas no mapa:', err)
  }

  const coordinates = normalizedTerm.split(',').map(Number)
  if (coordinates.length === 2 && coordinates.every((coordinate) => !Number.isNaN(coordinate))) {
    const latitude = coordinates[0]
    const longitude = coordinates[1]
    if (
      latitude !== undefined &&
      longitude !== undefined &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      selectedLocation.value = null
      selectedCoordinates.value = { latitude, longitude }
      map?.flyTo([latitude, longitude], 8, { duration: 0.8 })
      return
    }
  }

  if (location) {
    mapError.value = ''
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

const territoryStyle: L.PathOptions = {
  color: '#f26522',
  weight: 2,
  opacity: 1,
  fillColor: '#f26522',
  fillOpacity: 0.28,
}

const createTerritoryLayer = (data: GeoJSON.GeoJsonObject) =>
  L.geoJSON(data, {
    style: territoryStyle,
    onEachFeature: (feature, layer) => {
      const properties = feature.properties as any
      if (!properties) return

      const title =
        properties.codigoImovel || properties.name || `Feição #${properties.id || ''}`
      const details = [
        properties.areaHectares ? `Área: ${properties.areaHectares} ha` : null,
        properties.category ? properties.category : null,
        properties.anoSafra ? `Safra: ${properties.anoSafra}` : null,
        properties.processoId ? `Processo: #${properties.processoId}` : null,
        properties.status ? `Status: ${properties.status}` : null,
        properties.source ? `<small>${properties.source}</small>` : null,
      ].filter(Boolean)

      layer.bindTooltip(title)
      layer.bindPopup(
        `<div style="font-size: 0.85rem; line-height: 1.4;">
          <strong style="color: #f26522; font-size: 0.95rem;">${title}</strong><br />
          ${details.join('<br />')}
          ${properties.processoId ? `<div style="margin-top: 8px; border-top: 1px solid #eee; padding-top: 4px;">
            <a href="/processo/${properties.processoId}" style="color: #0284c7; text-decoration: underline; font-weight: 600;">Ver Detalhes do Processo</a>
          </div>` : ''}
        </div>`,
      )
    },
  })

const limparFiltroProcesso = async () => {
  router.push({ path: '/mapa' })
  searchTerm.value = ''
  try {
    const fetchedTerritories = await mapService.getTerritories()
    if (territories && map) {
      map.removeLayer(territories)
      territories = createTerritoryLayer(fetchedTerritories).addTo(map)
      if (territories.getLayers().length > 0 && territories.getBounds().isValid()) {
        map.fitBounds(territories.getBounds().pad(0.12), { maxZoom: 14 })
      }
    }
  } catch (err) {
    console.warn('Erro ao restaurar territórios:', err)
  }
}

onMounted(async () => {
  const scrollContainer = document.querySelector('.content-scroll-container')
  if (scrollContainer) {
    scrollContainer.scrollTop = 0
  }

  if (!mapElement.value) return

  map = L.map(mapElement.value, { zoomControl: false }).setView([-15.78, -47.93], 4)
  L.control.zoom({ position: 'bottomright' }).addTo(map)

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

  const requestedProcessoId = route.query?.processoId ? Number(route.query.processoId) : undefined
  const requestedBase = String(route.query?.base || '').trim()
  const requestedYear = String(route.query?.year || '').trim()

  const initialFilters: any = {}
  if (requestedProcessoId) initialFilters.processoId = requestedProcessoId
  if (requestedBase) initialFilters.busca = requestedBase
  if (requestedYear) initialFilters.anoSafra = requestedYear

  const fetchedTerritories = await mapService.getTerritories(initialFilters)
  territories = createTerritoryLayer(fetchedTerritories).addTo(map)

  if (territories.getLayers().length > 0 && territories.getBounds().isValid()) {
    map.fitBounds(territories.getBounds().pad(0.12), { maxZoom: 14 })
  }

  L.control
    .layers(
      {
        Satélite: satelliteLayer,
        'Mapa de ruas': streetsLayer,
      },
      {
        Delimitações: territories,
      },
      { position: 'topright' },
    )
    .addTo(map)

  const rawLocations = await mapService.getPublishedLocations()
  locations.value = Array.isArray(rawLocations)
    ? rawLocations.map((loc: any) => ({
        id: String(loc.id ?? ''),
        name: String(loc.name ?? loc.nome ?? `Base #${loc.id}`),
        type: String(loc.type ?? loc.tipo ?? 'Base Territorial'),
        latitude: Number(loc.latitude ?? loc.lat ?? -15.78),
        longitude: Number(loc.longitude ?? loc.lng ?? -47.93),
        status: (loc.status ?? 'Concluída') as any,
      }))
    : []

  markers = L.layerGroup().addTo(map)
  locations.value.forEach((location) => {
    if (!Number.isNaN(location.latitude) && !Number.isNaN(location.longitude)) {
      const marker = L.marker([location.latitude, location.longitude], { icon: markerIcon })
        .bindTooltip(location.name)
        .on('click', () => selectLocation(location))
      marker.addTo(markers as L.LayerGroup)
    }
  })

  if (requestedBase || requestedYear) {
    if (requestedBase) searchTerm.value = requestedBase
    const match = locations.value.find(
      (item) =>
        item.name.toLowerCase().includes(requestedBase.toLowerCase()) ||
        item.type.toLowerCase().includes(requestedBase.toLowerCase()),
    )
    if (match) {
      selectLocation(match)
    } else if (locations.value[0]) {
      selectLocation(locations.value[0])
    }
  }

  map.on('click', ({ latlng }) => {
    selectedLocation.value = null
    selectedCoordinates.value = { latitude: latlng.lat, longitude: latlng.lng }
    mapError.value = ''
  })
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
  markers = null
  territories = null
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

    <div v-if="route.query?.processoId" class="filter-badge-banner" role="status">
      <span>Exibindo delimitações da <strong>Carga #{{ route.query.processoId }}</strong></span>
      <button type="button" class="btn-clear-filter" @click="limparFiltroProcesso">Ver todas as cargas</button>
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
            <p class="eyebrow">Pontos monitorados</p>
            <h2>Bases cadastradas</h2>
          </div>
          <span class="location-count">{{ locations.length }}</span>
        </div>

        <div class="location-list">
          <div v-if="locations.length === 0" class="empty-locations-state" style="padding: 1.5rem 0.5rem; text-align: center; color: var(--vis-c-text-dark-2); font-size: 0.82rem;">
            Nenhuma base oficial cadastrada ainda.
          </div>
          <button
            v-for="location in locations"
            :key="location.id"
            type="button"
            class="location-item"
            :class="{ 'location-item-active': selectedLocation?.id === location.id }"
            @click="selectLocation(location)"
          >
            <span class="location-dot" :class="`status-${location.status.toLowerCase().replace(' ', '-')}`"></span>
            <span class="location-content">
              <strong>{{ location.name }}</strong>
              <small>{{ location.type }}</small>
              <small>{{ location.latitude.toFixed(4) }}, {{ location.longitude.toFixed(4) }}</small>
            </span>
          </button>
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
  gap: 24px;
}

.page-heading,
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
  font-size: clamp(1.8rem, 3vw, 2.6rem);
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
  background: rgba(242, 101, 34, 0.12);
  border: 1px solid rgba(242, 101, 34, 0.35);
  border-radius: 6px;
  font-size: 0.88rem;
  color: var(--color-heading);
}

.btn-clear-filter {
  background: transparent;
  border: 1px solid var(--vis-brand-orange, #f26522);
  color: var(--vis-brand-orange, #f26522);
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-clear-filter:hover {
  background: var(--vis-brand-orange, #f26522);
  color: #fff;
}

.locate-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
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
  color: white;
  background: var(--color-brand);
  border-radius: 50%;
  font-size: 0.8rem;
  font-weight: 800;
}

.location-list {
  display: grid;
  gap: 4px;
  margin-top: 18px;
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
}
</style>
