import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api'
import { io } from 'socket.io-client'

const SYNC_KEY = 'telefonia-reclamos-sync'
let socket = null

export const useReclamoStore = defineStore('reclamos', () => {
  const reclamos = ref([])
  const search = ref('')
  const statusFilter = ref('Todos')
  const selectedId = ref(null)
  let pollTimer = null

  const filteredReclamos = computed(() => {
    const text = search.value.trim().toLowerCase()
    return reclamos.value.filter((r) => {
      const matchesStatus = statusFilter.value === 'Todos' || r.Estado === statusFilter.value
      const haystack = [r.CodigoReclamo, r.Dn, r.NombreCliente, r.ReclamoDescripcion].join(' ').toLowerCase()
      return matchesStatus && (!text || haystack.includes(text))
    })
  })

  const selectedReclamo = computed(() => {
    return filteredReclamos.value.find((r) => r.IdReclamo === selectedId.value) || filteredReclamos.value[0] || null
  })

  const stats = computed(() => {
    const total = reclamos.value.length
    const pendientes = reclamos.value.filter((r) => r.Estado === 'Pendiente').length
    const enRevision = reclamos.value.filter((r) => r.Estado === 'EnRevision').length
    const cerradosCentral = reclamos.value.filter((r) => r.Estado === 'CerradoCentral').length
    const conBoleta = reclamos.value.filter((r) => r.Estado === 'GeneradoBoleta').length
    return { total, pendientes, enRevision, cerradosCentral, conBoleta }
  })

  function notifySync() {
    localStorage.setItem(SYNC_KEY, Date.now().toString())
  }

  function setReclamos(data) {
    reclamos.value = data
  }

  function addReclamo(reclamo) {
    reclamos.value.unshift(reclamo)
    notifySync()
  }

  function updateReclamo(id, data) {
    const idx = reclamos.value.findIndex((r) => r.IdReclamo === id || r.IdReclamo === id)
    if (idx !== -1) Object.assign(reclamos.value[idx], data)
  }

  async function fetchReclamos() {
    const res = await api.get('/reclamos')
    setReclamos(res.data)
  }

  async function fetchReclamoDetail(id) {
    const res = await api.get(`/reclamos/${id}`)
    const reclamo = reclamos.value.find((r) => r.IdReclamo === id)
    if (reclamo) {
      Object.assign(reclamo, res.data.reclamo)
      reclamo.events = res.data.events || []
    }
  }

  async function reviewReclamo(id, reviewData) {
    const res = await api.put(`/reclamos/${id}/revisar`, reviewData)
    notifySync()
    return res.data
  }

  function startPolling(intervalMs = 30000) {
    stopPolling()
    pollTimer = setInterval(() => { fetchReclamos().catch(() => {}) }, intervalMs)
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }

  function listenCrossTab() {
    window.addEventListener('storage', (e) => {
      if (e.key === SYNC_KEY && e.newValue !== e.oldValue) {
        fetchReclamos().catch(() => {})
      }
    })
  }

  function connectSocket() {
    if (socket && socket.connected) return
    socket = io(window.location.origin, { transports: ['websocket', 'polling'] })
    socket.on('reclamo:created', () => fetchReclamos().catch(() => {}))
    socket.on('reclamo:reviewed', () => fetchReclamos().catch(() => {}))
    socket.on('reclamo:updated', () => fetchReclamos().catch(() => {}))
    socket.on('ticket:updated', () => fetchReclamos().catch(() => {}))
  }

  return {
    reclamos, search, statusFilter, selectedId,
    filteredReclamos, selectedReclamo, stats,
    setReclamos, addReclamo, updateReclamo,
    fetchReclamos, fetchReclamoDetail, reviewReclamo,
    startPolling, stopPolling, listenCrossTab, connectSocket
  }
})
