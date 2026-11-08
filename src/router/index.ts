import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import StyleguideView from '../views/StyleguideView.vue'
import LoginView from '../views/LoginView.vue'
import UploadView from '../views/UploadView.vue'
import ProcessLogView from '../views/ProcessLogView.vue'
import MapView from '../views/MapView.vue'
import CargaListView from '../views/CargaListView.vue'
import TerritorialAnalysisView from '../views/TerritorialAnalysisView.vue'
import ProfileView from '../views/ProfileView.vue'
import UserView from '../views/UserView.vue'
import ForbiddenView from '../views/ForbiddenView.vue'
import { userService } from '@/services/user'

/**
 * Definição centralizada de rotas com controle de acesso RBAC por permissão (Tarefa 6 e 7).
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
      meta: { permission: 'INGESTAO:VISUALIZAR_PROCESSAMENTO' },
    },
    {
      path: '/analise-territorial',
      name: 'analise-territorial',
      component: TerritorialAnalysisView,
      meta: { permission: 'ANALISE_TERRITORIAL:CONSULTAR_RESULTADO' },
    },
    {
      path: '/catalogo',
      name: 'catalogo',
      component: CargaListView,
      meta: { permission: 'BASES:CONSULTAR_CATALOGO' },
    },
    {
      path: '/processo/:id',
      alias: ['/processos/:id'],
      name: 'process-log',
      component: ProcessLogView,
      meta: {
        permission: [
          'QUARENTENA:VISUALIZAR',
          'AUDITORIA:VISUALIZAR_PROCESSAMENTOS',
          'BASES:HOMOLOGAR',
          'INGESTAO:VISUALIZAR_PROCESSAMENTO',
        ],
      },
    },
    {
      path: '/upload',
      name: 'upload',
      component: UploadView,
      meta: { permission: 'INGESTAO:UPLOAD' },
    },
    {
      path: '/mapa',
      name: 'mapa',
      component: MapView,
      meta: { permission: 'MAPA:VISUALIZAR' },
    },
    {
      path: '/styleguide',
      name: 'styleguide',
      component: StyleguideView,
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { hideMenu: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileView,
    },
    {
      path: '/users',
      name: 'users',
      component: UserView,
      meta: { permission: ['USUARIOS:VISUALIZAR', 'ROLES:VISUALIZAR'] },
    },
    {
      path: '/acesso-negado',
      name: 'forbidden',
      component: ForbiddenView,
      meta: { hideMenu: false },
    },
  ],
})

/**
 * Guardião global de rotas (ProtectedRoute) orientado a permissões (Tarefa 6 e 7).
 */
router.beforeEach(async (to, from, next) => {
  const reqPerm = to.meta.permission as string | string[] | undefined

  if (!reqPerm) {
    return next()
  }

  const hasAccess = Array.isArray(reqPerm)
    ? userService.canAny(reqPerm)
    : userService.can(reqPerm)

  if (hasAccess) {
    return next()
  }

  // Registra a tentativa de acesso não autorizado no log de segurança (Tarefa 3 e 7)
  try {
    userService.recordSecurityEvent({
      action: 'Tentativa de Acesso Barrada (403)',
      details: `Tentou acessar a rota "${to.fullPath}" sem a permissão necessária (${Array.isArray(reqPerm) ? reqPerm.join(', ') : reqPerm}).`,
      severity: 'WARNING',
    })
  } catch {}

  next({ name: 'forbidden' })
})

export default router
