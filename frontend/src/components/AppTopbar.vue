<template>
  <header class="topbar">
    <div class="topbar-left">
      <img class="topbar-logo" src="/assets/coma-logo.png" alt="COM&A" />
      <strong class="topbar-brand">COM&A</strong>
      <span class="topbar-title">{{ title }}</span>
      <button class="menu-toggle" @click="$emit('toggle')" aria-label="Menu">
        <svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;stroke-width:2.5;fill:none;stroke-linecap:round;"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      </button>
    </div>
    <div class="topbar-right">
      <button v-if="showNewTicket" class="primary topbar-btn" @click="openNewTicket">
        <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Nueva boleta
      </button>
      <button class="theme-toggle" @click="toggleTheme" :title="theme === 'dark' ? 'Modo claro' : 'Modo oscuro'">
        <svg v-if="theme === 'dark'" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        <svg v-else viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
      <div class="user-info">
        <div class="user-avatar">{{ initials }}</div>
        <span class="user-name">{{ auth.name }}</span>
        <button class="topbar-logout" @click="logout">Salir</button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useTheme } from '../composables/useTheme'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { theme, toggle: toggleTheme } = useTheme()

const titles = {
  '/': 'Control de tiempos y atencion',
  '/reclamos': 'Reclamos telefonicos - ODECO',
  '/tickets': 'Boletas de reparacion',
  '/blocks': 'Administracion de pares por bloque',
  '/reports': 'Reportes operativos',
  '/users': 'Administracion de usuarios',
  '/integrations': 'Conexion con API y base de datos'
}

const title = computed(() => titles[route.path] || 'Sistema de reparacion')

const showNewTicket = computed(() => auth.hasPermission('createTicket') && route.path === '/tickets')

const initials = computed(() => {
  return auth.name ? auth.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U'
})

function openNewTicket() {
  window.dispatchEvent(new CustomEvent('open-new-ticket'))
}

function logout() {
  auth.logout()
  router.push('/login')
}
</script>
