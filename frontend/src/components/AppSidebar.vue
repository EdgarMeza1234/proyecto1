<template>
  <aside class="sidebar" :class="{ collapsed: collapsed }">
    <div class="brand">
      <img class="brand-logo" src="/assets/coma-logo.png" alt="COM&A" />
      <div class="brand-collapsed-text">CO</div>
      <div class="brand-text">
        <small>Centro de operación mantenimiento y Administración</small>
      </div>
    </div>
    <nav>
      <template v-for="group in navGroups" :key="group.name">
        <div v-if="group.items.length > 0" class="nav-group">
          <button
            v-if="group.items.length > 1"
            class="nav-section"
            @click="toggleSection(group.name)"
          >
            <span class="nav-section-arrow" :class="{ open: openSections[group.name] }">
              <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
            </span>
            <span class="nav-section-label">{{ group.name }}</span>
          </button>
          <button
            v-for="(item, i) in group.items"
            :key="item.view"
            class="nav-item"
            :class="{
              active: currentView === item.view,
              'nav-subitem': group.items.length > 1,
              'nav-first-sub': i === 0 && group.items.length > 1
            }"
            :style="group.items.length > 1 && !openSections[group.name] ? { display: 'none' } : {}"
            @click="navigate(item.view)"
            :title="item.label"
          >
            <span class="nav-icon" v-html="item.icon"></span>
            <span class="nav-label">{{ item.label }}</span>
          </button>
        </div>
      </template>
    </nav>
  </aside>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const collapsed = ref(localStorage.getItem('telefonia-sidebar-collapsed') === 'true')

function getDefaultSections() {
  try {
    const saved = localStorage.getItem('telefonia-sections-open')
    return saved ? JSON.parse(saved) : {}
  } catch { return {} }
}

const openSections = reactive(getDefaultSections())

function toggleSection(name) {
  openSections[name] = !openSections[name]
  localStorage.setItem('telefonia-sections-open', JSON.stringify({ ...openSections }))
}

const navGroups = computed(() => {
  const permMap = { '/': 'dashboard', '/reclamos': 'reclamos', '/tickets': 'tickets', '/blocks': 'blocks', '/reports': 'reports', '/users': 'users', '/integrations': 'integrations', '/iskratel': 'iskratel', '/trafico': 'trafico', '/nortel': 'nortel', '/registro': 'registro', '/permisos': 'permisos', '/sisatt': 'sisatt', '/minerales': 'minerales' }

  const all = [
    { view: '/', label: 'Tablero', icon: '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>' },
    { view: '/reclamos', label: 'Reclamos', icon: '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>' },
    { view: '/tickets', label: 'Boletas', icon: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>' },
    { view: '/blocks', label: 'Bloques', icon: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>' },
    { view: '/reports', label: 'Reportes', icon: '<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>' },
    { view: '/users', label: 'Usuarios', icon: '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>' },
    { view: '/integrations', label: 'Integraciones', icon: '<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>' },
    { view: '/iskratel', label: 'Central Iskratel', icon: '<svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22 6 12 13 2 6"></polyline></svg>' },
    { view: '/trafico', label: 'Trafico Iskratel', icon: '<svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>' },
    { view: '/nortel', label: 'Trafico Nortel', icon: '<svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>' },
    { view: '/registro', label: 'Registro de Trabajos', icon: '<svg viewBox="0 0 24 24"><path d="M9 12h6"></path><path d="M9 16h6"></path><path d="M9 8h6"></path><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 8h18"></path></svg>' },
    { view: '/permisos', label: 'Permisos', icon: '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' },
    { view: '/sisatt', label: 'Trafico SISATT', icon: '<svg viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>' },
  ]

  const groups = [
    { name: 'General', items: ['/', '/tickets', '/reclamos', '/reports', '/registro'] },
    { name: 'Centrales', items: ['/iskratel', '/trafico', '/nortel', '/sisatt'] },
    { name: 'Facilidades', items: ['/blocks'] },
    { name: 'Administración', items: ['/users', '/permisos', '/integrations'] }
  ]

  return groups.map(g => ({
    name: g.name,
    items: all.filter(item => g.items.includes(item.view) && auth.hasPermission(permMap[item.view]))
  }))
})

const currentView = computed(() => route.path)

function navigate(view) {
  router.push(view)
}

function toggle() {
  collapsed.value = !collapsed.value
  localStorage.setItem('telefonia-sidebar-collapsed', String(collapsed.value))
}

defineExpose({ toggle })
</script>
