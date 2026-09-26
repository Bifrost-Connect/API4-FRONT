export const mockFilterOptions = {
  conjuntos: [
    { id: 'imoveis', label: 'Imóveis rurais' },
    { id: 'malha', label: 'Malha municipal' },
    { id: 'reserva', label: 'Reserva legal' },
    { id: 'uso-solo', label: 'Uso e cobertura do solo' },
    { id: 'app-hidrografica', label: 'APP Hidrográfica' },
  ],
  etapas: [
    { id: 'ingestao', label: 'Ingestão' },
    { id: 'validacao', label: 'Validação' },
    { id: 'tratamento', label: 'Tratamento' },
    { id: 'publicacao', label: 'Publicação' },
  ],
  situacoes: [
    { id: 'concluida', label: 'Concluída' },
    { id: 'andamento', label: 'Em andamento' },
    { id: 'validacao', label: 'Aguardando validação' },
    { id: 'falhou', label: 'Falhou' },
  ],
}

export const mockAvailableEditors = [
  'Carlos Mendes (Topologia)',
  'Mariana Silva (Validação Geométrica)',
  'Roberto Alves (Auditor Geral)',
  'Fernanda Lima (Atributos e Schema)',
]
