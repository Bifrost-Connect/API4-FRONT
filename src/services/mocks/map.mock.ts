export interface TerritoryProperties {
  name: string
  category: string
  status: string
  source: string
}

export const mockTerritories: GeoJSON.FeatureCollection<GeoJSON.Geometry, TerritoryProperties> = {
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
        coordinates: [[
          [-48.12, -15.76], [-48.06, -15.69], [-47.96, -15.71], [-47.91, -15.77],
          [-47.84, -15.79], [-47.78, -15.86], [-47.81, -15.92], [-47.91, -15.94],
          [-47.99, -15.90], [-48.08, -15.91], [-48.14, -15.84], [-48.12, -15.76],
        ]],
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
        type: 'MultiPolygon',
        coordinates: [
          [[
            [-60.28, -2.98], [-60.21, -2.91], [-60.12, -2.93], [-60.07, -3.00],
            [-60.10, -3.09], [-60.19, -3.12], [-60.27, -3.08], [-60.31, -3.03],
            [-60.28, -2.98],
          ]],
          [[
            [-59.94, -3.16], [-59.88, -3.12], [-59.81, -3.15], [-59.78, -3.21],
            [-59.83, -3.27], [-59.91, -3.29], [-59.97, -3.24], [-59.94, -3.16],
          ]],
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
