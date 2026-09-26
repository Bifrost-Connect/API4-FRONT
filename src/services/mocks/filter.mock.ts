export const mockFilterOptions = {
  conjuntos: [
    { id: 1, label: 'Imóveis rurais' },
    { id: 2, label: 'Malha municipal' },
    { id: 3, label: 'Reserva legal' },
    { id: 4, label: 'Uso e cobertura do solo' },
    { id: 5, label: 'APP Hidrográfica' },
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
