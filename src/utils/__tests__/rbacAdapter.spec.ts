import { describe, it, expect } from 'vitest'
import {
  mapBackendRoleToFront,
  mapFrontRoleToBackend,
  mapBackendPermissionsToFront,
  mapBackendMatrixToRoles,
  mapBackendUserToUserItem,
  mapBackendAuditLogToSecurityEvent,
  extractPerfilIdMap,
} from '../rbacAdapter'

describe('rbacAdapter', () => {
  describe('mapeamento bidirecional de papéis', () => {
    it('converte nomes de perfis do back-end para chaves canônicas do front-end', () => {
      expect(mapBackendRoleToFront('ADMINISTRADOR')).toBe('ADMIN')
      expect(mapBackendRoleToFront('administrador')).toBe('ADMIN')
      expect(mapBackendRoleToFront('OPERADOR')).toBe('OPERADOR_DADOS')
      expect(mapBackendRoleToFront('AUDITOR')).toBe('AUDITOR')
      expect(mapBackendRoleToFront('GESTOR')).toBe('GESTOR')
      expect(mapBackendRoleToFront('ANALISTA')).toBe('ANALISTA')
      expect(mapBackendRoleToFront('INTEGRADOR_EXTERNO')).toBe('INTEGRADOR_EXTERNO')
    })

    it('converte chaves do front-end para os nomes de enum esperados pelo back-end', () => {
      expect(mapFrontRoleToBackend('ADMIN')).toBe('ADMINISTRADOR')
      expect(mapFrontRoleToBackend('Administrador')).toBe('ADMINISTRADOR')
      expect(mapFrontRoleToBackend('OPERADOR_DADOS')).toBe('OPERADOR')
      expect(mapFrontRoleToBackend('Operador')).toBe('OPERADOR')
      expect(mapFrontRoleToBackend('AUDITOR')).toBe('AUDITOR')
      expect(mapFrontRoleToBackend('GESTOR')).toBe('GESTOR')
      expect(mapFrontRoleToBackend('ANALISTA')).toBe('ANALISTA')
      expect(mapFrontRoleToBackend('INTEGRADOR_EXTERNO')).toBe('INTEGRADOR_EXTERNO')
    })
  })

  describe('mapeamento das 20 permissões do back-end para chaves MODULO:SUBPERMISSAO', () => {
    it('expande todas as permissões de CARGAS e QUARENTENA para o Operador', () => {
      const mapped = mapBackendPermissionsToFront(
        [
          'CARGA_ENVIAR',
          'CARGA_CANCELAR',
          'CARGA_CONSULTAR',
          'CARGA_ATRIBUIR',
          'ARQUIVO_BAIXAR',
          'QUARENTENA_CONSULTAR',
          'QUARENTENA_EXPORTAR',
          'NOTIFICACAO_ENVIAR',
          'CATALOGO_CONSULTAR',
        ],
        'OPERADOR',
      )

      expect(mapped).toContain('INGESTAO:UPLOAD')
      expect(mapped).toContain('CARGAS:UPLOAD')
      expect(mapped).toContain('INGESTAO:CANCELAR')
      expect(mapped).toContain('INGESTAO:VISUALIZAR_PROCESSAMENTO')
      expect(mapped).toContain('CARGAS:VISUALIZAR')
      expect(mapped).toContain('INGESTAO:REPROCESSAR')
      expect(mapped).toContain('QUARENTENA:VISUALIZAR')
      expect(mapped).toContain('QUARENTENA:CORRIGIR')
      expect(mapped).toContain('QUARENTENA:ENVIAR')
      expect(mapped).toContain('BASES:CONSULTAR_CATALOGO')
      expect(mapped).toContain('PERFIL:VISUALIZAR')
    })

    it('expande permissões TERRITORIAL e PUBLICACAO incluindo MAPA:EDITAR e homologação', () => {
      const mappedAnalista = mapBackendPermissionsToFront(
        ['GEOMETRIA_EDITAR', 'ANALISE_EXECUTAR', 'MAPA_CONSULTAR', 'DOMINIO_CONSULTAR'],
        'ANALISTA',
      )

      expect(mappedAnalista).toContain('MAPA:EDITAR')
      expect(mappedAnalista).toContain('ANALISE_TERRITORIAL:SALVAR_RESULTADO')
      expect(mappedAnalista).toContain('ANALISE_TERRITORIAL:EXECUTAR')
      expect(mappedAnalista).toContain('ANALISE_TERRITORIAL:CONSULTAR_RESULTADO')
      expect(mappedAnalista).toContain('MAPA:VISUALIZAR')
      expect(mappedAnalista).toContain('MAPA:COMPARAR_SAFRAS')

      const mappedGestor = mapBackendPermissionsToFront(
        ['CARGA_APROVAR', 'VERSAO_PUBLICAR', 'PUBLICACAO_CONSULTAR', 'RELATORIO_EXPORTAR'],
        'GESTOR',
      )
      expect(mappedGestor).toContain('BASES:HOMOLOGAR')
      expect(mappedGestor).toContain('INDICADORES:HOMOLOGAR')
      expect(mappedGestor).toContain('INDICADORES:BLOQUEAR_VERSAO')
      expect(mappedGestor).toContain('BASES:CONSULTAR_CATALOGO')
      expect(mappedGestor).toContain('EXPORTACAO:CSV')
      expect(mappedGestor).toContain('EXPORTACAO:GEOJSON')
    })

    it('expande permissões de ADMINISTRACAO para ADMIN sem expor rotas de ingestão/dashboard', () => {
      const mapped = mapBackendPermissionsToFront(
        ['USUARIO_GERENCIAR', 'GOVERNANCA_CONSULTAR'],
        'ADMINISTRADOR',
      )

      expect(mapped).toContain('USUARIOS:VISUALIZAR')
      expect(mapped).toContain('USUARIOS:GERENCIAR')
      expect(mapped).toContain('USUARIOS:CRIAR')
      expect(mapped).toContain('ROLES:VISUALIZAR')
      expect(mapped).toContain('AUDITORIA:VISUALIZAR')
      expect(mapped).toContain('PERFIL:VISUALIZAR')
      expect(mapped).toContain('API:VISUALIZAR_CHAVES')
      expect(mapped).toContain('API:GERAR_CHAVE')
      expect(mapped).toContain('API:REVOGAR_CHAVE')
      expect(mapped).not.toContain('INGESTAO:VISUALIZAR_PROCESSAMENTO')
      expect(mapped).not.toContain('AUDITORIA:VISUALIZAR_PROCESSAMENTOS')
    })

    it('inclui permissões de gestão de chaves de API (US12) para GESTOR e INTEGRADOR_EXTERNO e bloqueia para AUDITOR', () => {
      const mappedGestor = mapBackendPermissionsToFront(['CATALOGO_CONSULTAR', 'CARGA_APROVAR'], 'GESTOR')
      expect(mappedGestor).toContain('API:VISUALIZAR_CHAVES')
      expect(mappedGestor).toContain('API:GERAR_CHAVE')
      expect(mappedGestor).toContain('API:REVOGAR_CHAVE')

      const mappedIntegrador = mapBackendPermissionsToFront(
        ['CATALOGO_CONSULTAR', 'MAPA_CONSULTAR'],
        'INTEGRADOR_EXTERNO',
      )
      expect(mappedIntegrador).toContain('API:VISUALIZAR_CHAVES')
      expect(mappedIntegrador).toContain('API:GERAR_CHAVE')
      expect(mappedIntegrador).toContain('API:REVOGAR_CHAVE')
      expect(mappedIntegrador).not.toContain('MAPA:COMPARAR_SAFRAS')

      const mappedAuditor = mapBackendPermissionsToFront(['CATALOGO_CONSULTAR'], 'AUDITOR')
      expect(mappedAuditor).not.toContain('API:VISUALIZAR_CHAVES')
      expect(mappedAuditor).not.toContain('API:GERAR_CHAVE')
      expect(mappedAuditor).not.toContain('API:REVOGAR_CHAVE')
    })

    it('mantém trava read-only para AUDITOR ao mapear permissões', () => {
      const mapped = mapBackendPermissionsToFront(
        ['CATALOGO_CONSULTAR', 'MAPA_CONSULTAR', 'LINHAGEM_CONSULTAR', 'GOVERNANCA_CONSULTAR'],
        'AUDITOR',
      )

      expect(mapped).toContain('BASES:CONSULTAR_CATALOGO')
      expect(mapped).toContain('MAPA:VISUALIZAR')
      expect(mapped).toContain('AUDITORIA:RASTREAR_ORIGEM')
      expect(mapped).toContain('AUDITORIA:VISUALIZAR_PROCESSAMENTOS')
      expect(mapped).not.toContain('MAPA:COMPARAR_SAFRAS')
      expect(mapped).not.toContain('ROLES:VISUALIZAR')
      expect(mapped).not.toContain('INGESTAO:UPLOAD')
    })
  })

  describe('mapeamento de matriz, usuários e logs de segurança', () => {
    it('agrupa linhas de /admin/perfis-permissoes em RoleDef[] e extrai mapa de perfil_id', () => {
      const rows = [
        {
          perfil_id: 1,
          perfil: 'ADMINISTRADOR',
          descricao: 'Administrador do sistema',
          recurso: 'ADMINISTRACAO',
          permissao: 'USUARIO_GERENCIAR',
          descricao_permissao: 'Gerenciar usuários',
          liberada_por_excecao_sod: false,
        },
        {
          perfil_id: 1,
          perfil: 'ADMINISTRADOR',
          descricao: 'Administrador do sistema',
          recurso: 'ADMINISTRACAO',
          permissao: 'GOVERNANCA_CONSULTAR',
          descricao_permissao: 'Consultar governança',
          liberada_por_excecao_sod: false,
        },
        {
          perfil_id: 2,
          perfil: 'OPERADOR',
          descricao: 'Operador de cargas',
          recurso: 'CARGAS',
          permissao: 'CARGA_ENVIAR',
          descricao_permissao: 'Enviar carga',
          liberada_por_excecao_sod: false,
        },
      ]

      const roles = mapBackendMatrixToRoles(rows)
      expect(roles).toHaveLength(2)
      expect(roles[0]!.id).toBe('ADMIN')
      expect(roles[0]!.padrao).toBe(true)
      expect(roles[0]!.permissions).toContain('USUARIOS:VISUALIZAR')
      expect(roles[1]!.id).toBe('OPERADOR_DADOS')
      expect(roles[1]!.permissions).toContain('INGESTAO:UPLOAD')

      const idMap = extractPerfilIdMap(rows)
      expect(idMap.ADMIN).toBe(1)
      expect(idMap.ADMINISTRADOR).toBe(1)
      expect(idMap.OPERADOR_DADOS).toBe(2)
      expect(idMap.OPERADOR).toBe(2)
    })

    it('converte usuário do back-end para UserItem preservando flags SoD', () => {
      const user = mapBackendUserToUserItem({
        id: 42,
        nome: 'Maria Silva',
        email: 'maria@georural.com.br',
        perfil_id: 2,
        perfil: 'OPERADOR',
        ativo: true,
        excecao_sod_autorizada: true,
        justificativa_sod: 'Plantão emergencial de safra',
        data_criacao: '2026-11-10T14:30:00Z',
        data_atualizacao: '2026-11-15T10:15:00Z',
      })

      expect(user.id).toBe(42)
      expect(user.name).toBe('Maria Silva')
      expect(user.email).toBe('maria@georural.com.br')
      expect(user.role).toBe('OPERADOR_DADOS')
      expect(user.status).toBe('Ativo')
      expect(user.sodException).toBe(true)
      expect(user.sodJustification).toBe('Plantão emergencial de safra')
      expect(user.permissions).toContain('INGESTAO:UPLOAD')
    })

    it('converte log de auditoria do back-end para SecurityEvent com severidade e actionCode', () => {
      const ev = mapBackendAuditLogToSecurityEvent({
        id: 77,
        usuario_id: 1,
        processo_id: null,
        acao: 'PERMISSAO_ALTERADA_COM_EXCECAO_SOD',
        descricao: 'Permissão atualizada com exceção SoD para Operador.',
        detalhes: 'Cobrir escala de fechamento',
        ip: '127.0.0.1',
        data_hora: '2026-11-15T18:00:00Z',
      })

      expect(ev.id).toBe(77)
      expect(ev.actionCode).toBe('PERMISSAO_ALTERADA_COM_EXCECAO_SOD')
      expect(ev.action).toContain('SoD')
      expect(ev.severity).toBe('DANGER')
      expect(ev.details).toContain('Cobrir escala de fechamento')
      expect(ev.actorEmail).toContain('127.0.0.1')

      const ev403 = mapBackendAuditLogToSecurityEvent({
        id: 78,
        usuario_id: 3,
        processo_id: null,
        acao: 'ACESSO_NEGADO_403',
        descricao: 'Acesso negado à rota /api/admin/usuarios',
        detalhes: null,
        ip: '10.0.0.5',
        data_hora: '2026-11-15T18:05:00Z',
      })
      expect(ev403.action).toContain('403')
      expect(ev403.severity).toBe('WARNING')
    })
  })
})
