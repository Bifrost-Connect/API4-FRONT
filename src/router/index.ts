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

/**
 * Definição centralizada de rotas da aplicação.
 * As restrições de permissão mockadas foram removidas para permitir navegação livre
 * antes da integração com o login real do backend.
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
    },
    {
      path: '/analise-territorial',
      name: 'analise-territorial',
      component: TerritorialAnalysisView,
    },
    {
      path: '/catalogo',
      name: 'catalogo',
      component: CargaListView,
    },
    {
      path: '/processo/:id',
      alias: ['/processos/:id'],
      name: 'process-log',
      component: ProcessLogView,
    },
    {
      path: '/upload',
      name: 'upload',
      component: UploadView,
    },
    {
      path: '/mapa',
      name: 'mapa',
      component: MapView,
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
    },
  ],
})

export default router
