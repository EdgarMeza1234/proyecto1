import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api'
import { io } from 'socket.io-client'

const SYNC_KEY = 'telefonia-tickets-sync'
let socket = null

export const useTicketStore = defineStore('tickets', () => {
  const tickets = ref([])
  const search = ref('')
  const statusFilter = ref('Todos')
  const selectedId = ref(null)
  let pollTimer = null

  const filteredTickets = computed(() => {
    const text = search.value.trim().toLowerCase()
    return tickets.value.filter((t) => {
      const matchesStatus = statusFilter.value === 'Todos' || t.status === statusFilter.value
      const haystack = [t.id, t.user?.name, t.user?.phone, t.faultType].join(' ').toLowerCase()
      return matchesStatus && (!text || haystack.includes(text))
    })
  })

  const selectedTicket = computed(() => {
    return filteredTickets.value.find((t) => t.id === selectedId.value) || filteredTickets.value[0] || null
  })

  const stats = computed(() => {
    const total = tickets.value.length
    const closed = tickets.value.filter((t) => t.status === 'Cerrada').length
    const active = total - closed
    const urgent = tickets.value.filter((t) => t.priority === 'Urgente').length
    const avgHours = closed
      ? Math.round(tickets.value.filter((t) => t.status === 'Cerrada').reduce((sum, t) => {
          const diff = new Date(t.closedAt || Date.now()) - new Date(t.createdAt)
          return sum + Math.max(0, Math.round(diff / 36e5 * 10) / 10)
        }, 0) / closed)
      : 0
    return { total, closed, active, urgent, avgHours }
  })

  function notifySync() {
    localStorage.setItem(SYNC_KEY, Date.now().toString())
  }

  function setTickets(data) {
    tickets.value = data.map(normalizeTicket)
  }

  function addTicket(ticket) {
    tickets.value.unshift(normalizeTicket(ticket))
    notifySync()
  }

  function updateTicket(id, data) {
    const idx = tickets.value.findIndex((t) => t.id === id)
    if (idx !== -1) Object.assign(tickets.value[idx], data)
  }

  function normalizeTicket(t) {
    return {
      id: t.CodigoBoleta || t.id,
      dbId: t.IdBoleta || t.dbId,
      status: t.Estado || t.status || 'Pendiente',
      priority: t.Prioridad || t.priority || 'Media',
      faultType: t.TipoFalla || t.faultType || '',
      createdAt: t.FechaCreacion || t.createdAt || new Date().toISOString(),
      closedAt: t.FechaCierre || t.closedAt || null,
      technician: t.TecnicoAsignado || t.technician || 'Sin asignar',
      user: {
        name: t.NombreCliente || t.user?.name || '',
        phone: t.Dn || t.user?.phone || '',
        address: t.Direccion || t.user?.address || ''
      },
      network: {
        primaryPair: t.ParPrimarioCompleto || t.network?.primaryPair || '',
        secondaryPair: t.ParSec || t.network?.secondaryPair || '',
        accessBox: t.CajDis || t.network?.accessBox || '',
        cabinet: t.Armario || t.network?.cabinet || '',
        central: t.Central || ''
      },
      events: t.events || []
    }
  }

  async function fetchTickets() {
    const res = await api.get('/boletas')
    setTickets(res.data)
  }

  async function fetchTicketDetail(id) {
    const res = await api.get(`/boletas/${id}`)
    const ticket = tickets.value.find((t) => t.dbId === id || t.id === id)
    if (ticket) {
      Object.assign(ticket, normalizeTicket(res.data.ticket))
      ticket.events = (res.data.events || []).map((e) => ({
        at: e.FechaHora || e.at,
        title: e.Titulo || e.title,
        note: e.Detalle || e.note,
        actor: e.Actor || e.actor
      }))
    }
  }

  async function addTicketEvent(id, data) {
    await api.post(`/boletas/${id}/seguimiento`, data)
    const ticket = tickets.value.find((t) => t.dbId === id || t.id === id)
    if (ticket) {
      ticket.events.push({
        at: new Date().toISOString(),
        title: data.Titulo || 'Avance',
        note: data.Detalle || '',
        actor: data.Actor || ''
      })
      if (data.EstadoResultante) ticket.status = data.EstadoResultante
      if (data.TecnicoAsignado) ticket.technician = data.TecnicoAsignado
    }
    notifySync()
  }

  async function updateTicketBackend(id, data) {
    await api.put(`/boletas/${id}`, data)
    const ticket = tickets.value.find((t) => t.dbId === id || t.id === id)
    if (ticket) {
      if (data.TecnicoAsignado) ticket.technician = data.TecnicoAsignado
      if (data.Estado) ticket.status = data.Estado
    }
    notifySync()
  }

  function hoursBetween(start, end) {
    const diff = new Date(end || Date.now()) - new Date(start)
    return Math.max(0, Math.round(diff / 36e5 * 10) / 10)
  }

  function startPolling(intervalMs = 30000) {
    stopPolling()
    pollTimer = setInterval(() => { fetchTickets().catch(() => {}) }, intervalMs)
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }

  function listenCrossTab() {
    window.addEventListener('storage', (e) => {
      if (e.key === SYNC_KEY && e.newValue !== e.oldValue) {
        fetchTickets().catch(() => {})
      }
    })
  }

  function connectSocket() {
    if (socket && socket.connected) return
    socket = io(window.location.origin, { transports: ['websocket', 'polling'] })
    socket.on('ticket:created', () => fetchTickets().catch(() => {}))
    socket.on('ticket:updated', () => fetchTickets().catch(() => {}))
  }

  return {
    tickets, search, statusFilter, selectedId,
    filteredTickets, selectedTicket, stats,
    setTickets, addTicket, updateTicket,
    fetchTickets, fetchTicketDetail, addTicketEvent, updateTicketBackend, hoursBetween,
    startPolling, stopPolling, listenCrossTab, connectSocket
  }
})
