import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/LoginView.vue') },
  { path: '/', name: 'Dashboard', component: () => import('../views/DashboardView.vue'), meta: { requiresAuth: true } },
  { path: '/tickets', name: 'Tickets', component: () => import('../views/TicketsView.vue'), meta: { requiresAuth: true } },
  { path: '/blocks', name: 'Blocks', component: () => import('../views/BlocksView.vue'), meta: { requiresAuth: true } },
  { path: '/reports', name: 'Reports', component: () => import('../views/ReportsView.vue'), meta: { requiresAuth: true } },
  { path: '/users', name: 'Users', component: () => import('../views/UsersView.vue'), meta: { requiresAuth: true } },
  { path: '/integrations', name: 'Integrations', component: () => import('../views/IntegrationsView.vue'), meta: { requiresAuth: true } },
  { path: '/reclamos', name: 'Reclamos', component: () => import('../views/ReclamosView.vue'), meta: { requiresAuth: true } },
  { path: '/iskratel', name: 'Iskratel', component: () => import('../views/IskratelView.vue'), meta: { requiresAuth: true } },
  { path: '/registro', name: 'RegistroTrabajos', component: () => import('../views/RegistroTrabajosView.vue'), meta: { requiresAuth: true } },
  { path: '/trafico', name: 'Trafico', component: () => import('../views/TraficoView.vue'), meta: { requiresAuth: true } },
  { path: '/nortel', name: 'Nortel', component: () => import('../views/NortelView.vue'), meta: { requiresAuth: true } },
  { path: '/permisos', name: 'Permisos', component: () => import('../views/PermisosView.vue'), meta: { requiresAuth: true } },
  { path: '/sisatt', name: 'SISATT', component: () => import('../views/SISATTView.vue'), meta: { requiresAuth: true } },
  { path: '/minerales', name: 'Minerales', component: () => import('../views/MineralesView.vue'), meta: { requiresAuth: true } }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    next('/login')
  } else if (to.path === '/login' && auth.isLoggedIn) {
    next(auth.role === 'operador' ? '/registro' : '/')
  } else {
    next()
  }
})

export default router
