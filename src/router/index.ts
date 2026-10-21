import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import StyleguideView from '../views/StyleguideView.vue'
import LoginView from '../views/LoginView.vue'
import UploadView from '../views/UploadView.vue'
import ProcessLogView from '../views/ProcessLogView.vue'
import MapView from '../views/MapView.vue'
import CargaListView from '../views/CargaListView.vue'
import AuditorDashboardView from '../views/AuditorDashboardView.vue'
import TerritorialAnalysisView from '../views/TerritorialAnalysisView.vue'
import { userService } from '../services/user'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
      meta: { allowedRoles: ['Operador', 'Administrador'] },
    },
    {
      path: '/analise-territorial',
      name: 'analise-territorial',
      component: TerritorialAnalysisView,
      meta: { allowedRoles: ['Analista'] },
    },
    {
      path: '/auditor',
      name: 'auditor',
      component: AuditorDashboardView,
      meta: { allowedRoles: ['Auditor'] },
    },
    {
      path: '/auditoria',
      name: 'auditoria',
      component: CargaListView,
      meta: { allowedRoles: ['Auditor'] },
    },
    {
      path: '/processo/:id',
      name: 'process-log',
      component: ProcessLogView,
    },
    {
      path: '/upload',
      name: 'upload',
      component: UploadView,
      meta: { allowedRoles: ['Operador', 'Administrador'] },
    },
    {
      path: '/mapa',
      name: 'mapa',
      component: MapView,
      meta: { allowedRoles: ['Operador', 'Auditor', 'Analista', 'Administrador'] },
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
  ],
})

export default router

router.beforeEach((to) => {
  if (to.name === 'login') return true

  const currentRole = userService.getCurrentUser().role
  const allowedRoles = to.meta.allowedRoles as string[] | undefined
  const homeByRole: Record<string, string> = {
    Auditor: 'auditor',
    Analista: 'analise-territorial',
    Operador: 'dashboard',
    Administrador: 'dashboard',
  }
  const home = homeByRole[currentRole] ?? 'dashboard'

  if (allowedRoles && !allowedRoles.includes(currentRole)) {
    return { name: home }
  }

  if (to.name === 'dashboard' && currentRole !== 'Operador' && currentRole !== 'Administrador') {
    return { name: home }
  }

  return true
})
