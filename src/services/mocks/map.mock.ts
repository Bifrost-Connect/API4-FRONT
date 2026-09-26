export interface TerritoryProperties {
  name: string
  category: string
  status: string
  source: string
}

export const mockTerritories: GeoJSON.FeatureCollection<GeoJSON.Polygon, TerritoryProperties> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        name: 'Território demonstrativo Brasília',
        category: 'Área de proteção',
        status: 'Em validação',
        source: 'Documento fictício de exemplo',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-48.12, -15.68],
            [-47.75, -15.68],
            [-47.75, -15.93],
            [-48.12, -15.93],
            [-48.12, -15.68],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'Território demonstrativo Manaus',
        category: 'Reserva indígena',
        status: 'Processado',
        source: 'Documento fictício de exemplo',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-60.28, -2.95],
            [-59.78, -2.95],
            [-59.78, -3.28],
            [-60.28, -3.28],
            [-60.28, -2.95],
          ],
        ],
      },
    },
  ],
}

export const mockLocations = [
  {
    id: '#993A-B12',
    name: 'Carga Brasília',
    type: 'Conjunto topográfico',
    latitude: -15.7939,
    longitude: -47.8828,
    status: 'Concluída',
  },
  {
    id: '#993A-B13',
    name: 'Carga São Paulo',
    type: 'Uso e cobertura do solo',
    latitude: -23.5505,
    longitude: -46.6333,
    status: 'Concluída',
  },
  {
    id: '#993A-B14',
    name: 'Carga Manaus',
    type: 'Imagem de satélite',
    latitude: -3.119,
    longitude: -60.0217,
    status: 'Concluída',
  },
]
