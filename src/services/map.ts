import api from './api'
import { mockLocations, mockTerritories } from './mocks/map.mock'

export const mapService = {
  async getPublishedLocations() {
    try {
      const response = await api.get('/api/v1/mapa/monitoramento')
      return response.data
    } catch (error: any) {
      if (error.response && error.response.status !== 404) {
        throw error.response.data || error;
      }
      console.warn('Failed to fetch map locations. Using mocked data instead.', error)
      return mockLocations
    }
  },
  async getTerritories() {
    return mockTerritories
  },
}
