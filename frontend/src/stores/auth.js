import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api'

const STORAGE_KEY = 'telefonia-session-v2'

const DEFAULT_PERMISSIONS = {
  dashboard: ['admin', 'jefe', 'operador', 'tecnico', 'odeco'],
  tickets: ['admin', 'jefe', 'operador', 'tecnico', 'usuario', 'odeco'],
  reclamos: ['admin', 'odeco', 'operador', 'jefe'],
  blocks: ['admin', 'operador'],
  auditoria: ['admin'],
  reports: ['admin', 'jefe'],
  users: ['admin'],
  integrations: ['admin'],
  iskratel: ['admin', 'jefe', 'operador', 'tecnico'],
  registro: ['admin', 'jefe', 'operador'],
  trafico: ['admin', 'jefe', 'operador'],
  nortel: ['admin', 'jefe', 'operador'],
  sisatt: ['admin', 'jefe', 'operador'],
  createTicket: ['admin', 'operador'],
  createReclamo: ['admin', 'odeco'],
  reviewReclamo: ['admin', 'operador'],
  assignTech: ['admin', 'jefe'],
  distribucion: ['admin', 'jefe'],
  addEvent: ['admin', 'jefe', 'operador', 'tecnico', 'odeco'],
  closeTicket: ['admin', 'jefe', 'tecnico'],
  printTicket: ['admin', 'jefe', 'operador', 'tecnico', 'usuario', 'odeco'],
  permisos: ['admin'],
  'auditoria-general': ['admin']
}

export const useAuthStore = defineStore('auth', () => {
  const session = ref(null)
  const permissionsMap = ref(null)

  const isLoggedIn = computed(() => !!session.value)
  const role = computed(() => session.value?.role || null)
  const username = computed(() => session.value?.username || '')
  const name = computed(() => session.value?.name || '')
  const roleName = computed(() => session.value?.roleName || '')

  function hasPermission(permission) {
    if (!role.value) return false
    const map = permissionsMap.value || DEFAULT_PERMISSIONS
    return map[permission]?.includes(role.value)
  }

  async function loadPermissions() {
    try {
      const res = await api.get('/permisos')
      const { roles, asignaciones } = res.data
      const map = {}
      for (const r of roles) {
        const rolePerms = asignaciones[r.IdRol] || []
        for (const perm of rolePerms) {
          if (!map[perm]) map[perm] = []
          map[perm].push(r.Codigo)
        }
      }
      permissionsMap.value = map
    } catch {
      permissionsMap.value = null
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) session.value = JSON.parse(raw)
    } catch { session.value = null }
    if (session.value) loadPermissions()
  }

  function saveSession(data) {
    session.value = data
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  async function login(username, password) {
    const res = await api.post('/login', { username, password })
    saveSession(res.data)
    await loadPermissions()
    return res.data
  }

  function logout() {
    session.value = null
    permissionsMap.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  loadSession()

  return { session, isLoggedIn, role, username, name, roleName, hasPermission, login, logout, loadSession, loadPermissions, permissionsMap }
})
