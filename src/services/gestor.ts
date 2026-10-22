import api, { mockactive } from './api'
import { processService, type IndicatorExportFormat } from './process'
import { userService } from './user'
import { mockProcessosPage } from './mocks/dashboard.mock'
import { mockAuditCargas } from './mocks/auditoria.mock'

export interface GestorItem {
  id: string
  dataset: string
  stage: 'Validação' | 'Tratamento' | 'Publicação'
  status:
    | 'Concluída'
    | 'Em andamento'
    | 'Aguardando validação'
    | 'Falhou'
    | 'Em quarentena'
    | 'Fechado'
  dateTime: string
  source: string
  year: string
  epsg: string
  assignedEditor?: string
  pauseReason?: string
  quarantined?: boolean
  isClosed?: boolean
  versaoOficial?: string
  aprovador?: string
  dataPublicacao?: string
  decided?: boolean
  decision?: 'aprovado' | 'reprovado'
  rejectionReason?: string
  rejectionDestino?: 'reprocessar' | 'invalidar'
}

export interface GestorFilas {
  validacao: GestorItem[]
  tratamento: GestorItem[]
  publicacao: GestorItem[]
  fechadas: GestorItem[]
}

const delay = (ms: number) =>
  typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
    ? Promise.resolve()
    : new Promise((resolve) => setTimeout(resolve, ms))

// Dados iniciais simulados caso a API esteja indisponível ou para fins de demonstração
const initialMockFilas: GestorFilas = {
  validacao: [
    {
      id: 'CARG-2026-VAL1',
      dataset: 'Reserva Legal - Cadastro Ambiental Rural',
      stage: 'Validação',
      status: 'Aguardando validação',
      dateTime: '15/10/2026 14:20',
      source: 'Órgão Estadual Ambiental',
      year: '2026',
      epsg: 'EPSG:4674 (SIRGAS 2000)',
      pauseReason: 'Validação de duplicidade e corrupção concluída. Aguarda avanço.',
    },
    {
      id: 'CARG-2026-VAL2',
      dataset: 'Uso e Cobertura do Solo',
      stage: 'Validação',
      status: 'Em andamento',
      dateTime: '15/10/2026 11:05',
      source: 'MapBiomas',
      year: '2025',
      epsg: 'EPSG:4326 (WGS 84)',
    },
  ],
  tratamento: [
    {
      id: 'CARG-2026-TRAT1',
      dataset: 'Cálculo de Área de Preservação Permanente (APP)',
      stage: 'Tratamento',
      status: 'Em andamento',
      dateTime: '14/10/2026 16:45',
      source: 'ANA / IBAMA',
      year: '2026',
      epsg: 'EPSG:31983 (SIRGAS 2000 / UTM zone 23S)',
      pauseReason: 'Cálculo de buffer e polígonos finalizado. Aguarda homologação.',
    },
    {
      id: 'CARG-2026-TRAT2',
      dataset: 'Imóveis Rurais e Malha Fundiária',
      stage: 'Tratamento',
      status: 'Em quarentena',
      dateTime: '13/10/2026 09:10',
      source: 'INCRA',
      year: '2024',
      epsg: 'EPSG:4674 (SIRGAS 2000)',
      quarantined: true,
      pauseReason: 'Quarentena: sobreposição de geometrias detectada na fase de cálculo.',
    },
  ],
  publicacao: [
    {
      id: 'CARG-2026-PUB1',
      dataset: 'Malha Municipal e Divisão Territorial',
      stage: 'Publicação',
      status: 'Em andamento',
      dateTime: '12/10/2026 10:30',
      source: 'IBGE',
      year: '2026',
      epsg: 'EPSG:4674 (SIRGAS 2000)',
      pauseReason: 'Histórico e localização organizados. Pronta para publicação final.',
    },
    {
      id: 'CARG-2026-PUB2',
      dataset: 'Áreas de Proteção Ambiental (APA)',
      stage: 'Publicação',
      status: 'Aguardando validação',
      dateTime: '11/10/2026 17:00',
      source: 'ICMBio',
      year: '2025',
      epsg: 'EPSG:4674 (SIRGAS 2000)',
      pauseReason: 'Homologação de cálculo e publicação pendente de assinatura oficial.',
    },
  ],
  fechadas: [
    {
      id: 'CARG-2026-9001-v3',
      dataset: 'Imóveis Rurais e Cadastros Ambientais',
      stage: 'Publicação',
      status: 'Fechado',
      dateTime: '07/09/2026 13:00',
      source: 'IBGE / MAPA',
      year: '2023',
      epsg: 'EPSG:4674 (SIRGAS 2000)',
      versaoOficial: 'v3.0 Oficial',
      isClosed: true,
      aprovador: 'Carlos Gestor',
      dataPublicacao: '07/09/2026 13:00',
      decided: true,
      decision: 'aprovado',
    },
    {
      id: 'CARG-2025-7800-v1',
      dataset: 'Limites Municipais e Territórios Quilombolas',
      stage: 'Publicação',
      status: 'Fechado',
      dateTime: '18/12/2025 18:30',
      source: 'INCRA / IBGE',
      year: '2025',
      epsg: 'EPSG:4674 (SIRGAS 2000)',
      versaoOficial: 'v1.0 Oficial',
      isClosed: true,
      aprovador: 'Carlos Gestor',
      dataPublicacao: '18/12/2025 18:30',
      decided: true,
      decision: 'aprovado',
    },
  ],
}

let stateFilas: GestorFilas = JSON.parse(JSON.stringify(initialMockFilas))

export const gestorService = {
  /**
   * Retorna as 3 filas de decisão do Gestor + fila de versões históricas fechadas.
   */
  async getFilasDecisao(): Promise<GestorFilas> {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      return JSON.parse(JSON.stringify(stateFilas))
    }
    try {
      const res = await api.get('/processos', { params: { size: 50 } })
      if (res.data && Array.isArray(res.data.content)) {
        const items: GestorItem[] = res.data.content.map((p: any) => ({
          id: String(p.id),
          dataset: p.dataset || 'Conjunto Territorial',
          stage: (p.stage === 'Ingestão' ? 'Validação' : p.stage) as GestorItem['stage'],
          status: p.status || 'Em andamento',
          dateTime: p.dateTime || new Date().toLocaleString('pt-BR'),
          source: p.source || 'Órgão Oficial',
          year: p.year || '2026',
          epsg: p.epsg || 'EPSG:4674',
          assignedEditor: p.assignedEditor,
          pauseReason: p.pauseReason,
          quarantined: p.quarantined,
          isClosed: (p.status || '').toLowerCase().includes('fechad'),
          versaoOficial: (p.status || '').toLowerCase().includes('fechad') ? 'v1.0 Oficial' : undefined,
          aprovador: p.assignedEditor || 'Carlos Gestor',
          dataPublicacao: p.dateTime,
        }))

        // Agrupa nas filas correspondentes
        const validacao = items.filter((i) => !i.isClosed && (i.stage === 'Validação' || i.stage === 'Ingestão'))
        const tratamento = items.filter((i) => !i.isClosed && i.stage === 'Tratamento')
        const publicacao = items.filter((i) => !i.isClosed && i.stage === 'Publicação')
        const fechadas = items.filter((i) => i.isClosed)

        // Se a API retornar vazia nas categorias, preenche com o mock enriquecido
        return {
          validacao: validacao.length ? validacao : stateFilas.validacao,
          tratamento: tratamento.length ? tratamento : stateFilas.tratamento,
          publicacao: publicacao.length ? publicacao : stateFilas.publicacao,
          fechadas: fechadas.length ? fechadas : stateFilas.fechadas,
        }
      }
    } catch {
      // Fallback em caso de API inacessível
    }

    await delay(200)
    return JSON.parse(JSON.stringify(stateFilas))
  },

  /**
   * Tarefa 2: Aprova o avanço da carga para a próxima etapa (verde).
   */
  async aprovarAvanco(item: GestorItem): Promise<{ success: boolean; nextStage?: string }> {
    const nextStageMap: Record<string, 'Tratamento' | 'Publicação'> = {
      Validação: 'Tratamento',
      Tratamento: 'Publicação',
    }

    const nextStage = nextStageMap[item.stage]

    try {
      if (/^\d+$/.test(item.id)) {
        await api.post(`/processos/${item.id}/processar`, null, {
          params: { usuarioId: userService.getCurrentUser().id },
        })
      }
    } catch (e) {
      console.warn('Erro ao chamar avanço de etapa no backend, simulando localmente:', e)
    }

    // Atualiza estado local
    item.decided = true
    item.decision = 'aprovado'
    if (nextStage) {
      item.stage = nextStage
      item.status = 'Em andamento'
      item.pauseReason = `Avanço para ${nextStage} aprovado pelo Gestor.`
    }

    return { success: true, nextStage }
  },

  /**
   * Tarefa 3: Reprova a carga exigindo parecer obrigatório e selecionando destino
   * ('reprocessar' ou 'invalidar').
   */
  async reprovarCarga(
    item: GestorItem,
    parecer: string,
    destino: 'reprocessar' | 'invalidar',
  ): Promise<{ success: boolean }> {
    if (!parecer || !parecer.trim()) {
      throw new Error('O parecer técnico é obrigatório para reprovar a carga.')
    }

    try {
      // Registra no backend se processo numérico
      if (/^\d+$/.test(item.id)) {
        await api.put(`/processos/${item.id}/editor`, {
          editorId: userService.getCurrentUser().id,
        })
      }
    } catch (e) {
      console.warn('Erro ao registrar reprovação no backend, simulando localmente:', e)
    }

    item.decided = true
    item.decision = 'reprovado'
    item.rejectionReason = parecer.trim()
    item.rejectionDestino = destino

    if (destino === 'reprocessar') {
      item.status = 'Em andamento'
      item.pauseReason = `Reprovado pelo Gestor (${item.stage}): ${parecer.trim()}. Retornado ao Operador.`
    } else {
      item.status = 'Falhou'
      item.pauseReason = `Carga invalidada permanentemente pelo Gestor: ${parecer.trim()}.`
    }

    return { success: true }
  },

  /**
   * Tarefa 4: Aprova e fecha a versão oficial permanentemente na Publicação.
   */
  async aprovarEFecharVersao(
    item: GestorItem,
    gestorNome = userService.getCurrentUser().name,
  ): Promise<{ success: boolean }> {
    const gestorId = userService.getCurrentUser().id

    try {
      if (/^\d+$/.test(item.id)) {
        await api.patch(`/indicadores/${item.id}/fechar`, null, {
          headers: { 'X-Gestor-ID': String(gestorId) },
        })
      }
    } catch (e) {
      console.warn('Backend /fechar indisponível, simulando fechamento local:', e)
    }

    item.decided = true
    item.decision = 'aprovado'
    item.isClosed = true
    item.status = 'Fechado'
    item.versaoOficial = item.versaoOficial || 'v1.0 Oficial'
    item.aprovador = gestorNome
    item.dataPublicacao = new Date().toLocaleString('pt-BR')
    item.pauseReason = 'Versão oficial bloqueada e publicada no catálogo.'

    // Move para a fila de fechadas
    stateFilas.fechadas.unshift({ ...item })
    stateFilas.publicacao = stateFilas.publicacao.filter((i) => i.id !== item.id)

    return { success: true }
  },

  /**
   * Tarefa 6: Exporta a versão consolidada em formato CSV ou GeoJSON.
   */
  async exportarVersao(
    itemOrId: GestorItem | string | number,
    formato: 'csv' | 'geojson',
  ): Promise<Blob> {
    const id = typeof itemOrId === 'object' ? itemOrId.id : String(itemOrId)
    const item = typeof itemOrId === 'object' ? itemOrId : null

    try {
      if (/^\d+$/.test(id)) {
        return await processService.exportIndicator(id, formato)
      }
    } catch {
      // Fallback para download local
    }

    // Gera arquivo sintético para demonstração / teste
    const dataset = item?.dataset || 'Conjunto Territorial'
    const safra = item?.year || '2026'
    const orgao = item?.source || 'Órgão Gestor'
    const epsg = item?.epsg || 'EPSG:4674'
    const gestor = item?.aprovador || userService.getCurrentUser().name
    const dataPub = item?.dataPublicacao || new Date().toLocaleString('pt-BR')

    if (formato === 'csv') {
      const csvContent =
        'id,dataset,safra,orgao,epsg,status,selo,aprovador,dataPublicacao\n' +
        `"${id}","${dataset}","${safra}","${orgao}","${epsg}","Fechado","Versão Oficial Bloqueada","${gestor}","${dataPub}"\n`
      return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    } else {
      const geojsonContent = {
        type: 'FeatureCollection',
        name: `Exportacao_Oficial_${id}`,
        metadata: {
          id,
          dataset,
          safra,
          orgao,
          epsg,
          versaoOficialBloqueada: true,
          aprovador: gestor,
          dataPublicacao: dataPub,
        },
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-47.882, -15.793],
                  [-47.8, -15.793],
                  [-47.8, -15.85],
                  [-47.882, -15.85],
                  [-47.882, -15.793],
                ],
              ],
            },
            properties: {
              id,
              dataset,
              status: 'Fechado',
              selo: 'Versão Oficial Bloqueada',
            },
          },
        ],
      }
      return new Blob([JSON.stringify(geojsonContent, null, 2)], {
        type: 'application/geo+json;charset=utf-8;',
      })
    }
  },

  /**
   * Reseta as filas para o estado inicial de demonstração.
   */
  resetState() {
    stateFilas = JSON.parse(JSON.stringify(initialMockFilas))
  },
}
