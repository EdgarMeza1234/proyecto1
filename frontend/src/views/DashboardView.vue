<template>
  <section class="metrics">
    <article class="metric">
      <svg class="metric-icon" viewBox="0 0 24 24" style="position:absolute;right:20px;top:20px;width:38px;height:38px;stroke:rgba(255,255,255,0.06);stroke-width:1.5;fill:none;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
      <span>Boletas</span>
      <strong>{{ store.stats.total }}</strong>
      <small>Registradas</small>
    </article>
    <article class="metric">
      <svg class="metric-icon" viewBox="0 0 24 24" style="position:absolute;right:20px;top:20px;width:38px;height:38px;stroke:rgba(59,130,246,0.12);stroke-width:1.5;fill:none;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
      <span>Activas</span>
      <strong>{{ store.stats.active }}</strong>
      <small>Pendientes o en reparación</small>
    </article>
    <article class="metric">
      <svg class="metric-icon" viewBox="0 0 24 24" style="position:absolute;right:20px;top:20px;width:38px;height:38px;stroke:rgba(244,63,94,0.12);stroke-width:1.5;fill:none;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      <span>Urgentes</span>
      <strong>{{ store.stats.urgent }}</strong>
      <small>Prioridad crítica</small>
    </article>
    <article class="metric">
      <svg class="metric-icon" viewBox="0 0 24 24" style="position:absolute;right:20px;top:20px;width:38px;height:38px;stroke:rgba(16,185,129,0.12);stroke-width:1.5;fill:none;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
      <span>Promedio cierre</span>
      <strong>{{ store.stats.avgHours }} h</strong>
      <small>Boletas cerradas</small>
    </article>
  </section>

  <section class="grid two">
    <div class="panel">
      <div class="panel-head">
        <h2>Trabajo en curso</h2>
        <button class="ghost" @click="$router.push('/tickets')">Ver boletas</button>
      </div>
      <div class="work-list">
        <button
          v-for="ticket in activeTickets"
          :key="ticket.id"
          class="ticket-row"
          :class="[ticketTimeClass(ticket.createdAt, ticket.status), { selected: store.selectedId === ticket.id, 'pulse-glow-urgent': ticket.priority === 'Urgente' && ticket.status !== 'Cerrada' }]"
          @click="selectTicket(ticket)"
        >
          <div>
            <strong>{{ ticket.id }}</strong>
            <span>{{ ticket.user?.name }}</span>
          </div>
          <span class="ticket-time" :class="ticketTimeClass(ticket.createdAt, ticket.status)"><strong>{{ elapsedTicket(ticket.createdAt, ticket.status) }}</strong></span>
          <span class="badge" :class="statusClass(ticket.status)">{{ ticket.status }}</span>
        </button>
      </div>
    </div>
    <div class="panel">
      <TicketDetail v-if="detailTicket" :ticket="detailTicket" />
      <p v-else>No hay boletas activas.</p>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTicketStore } from '../stores/tickets'
import TicketDetail from '../components/TicketDetail.vue'

const router = useRouter()
const store = useTicketStore()

const activeTickets = computed(() => {
  return store.tickets.filter((t) => t.status !== 'Cerrada').slice(0, 10)
})

const detailTicket = computed(() => {
  return store.selectedTicket
})

function selectTicket(ticket) {
  store.selectedId = ticket.id
}

function statusClass(status) {
  return String(status || '').toLowerCase().replace(/\s+/g, '-')
}

function elapsedTicket(createdAt, status) {
  if (!createdAt || status === 'Cerrada') return ''
  try {
    const diff = Date.now() - new Date(createdAt).getTime()
    const hours = Math.max(0, Math.round(diff / 36e5 * 10) / 10)
    if (hours < 1) return Math.round(diff / 60000) + ' min'
    if (hours < 24) return hours + ' h'
    const days = Math.floor(hours / 24)
    return days + 'd ' + Math.round(hours % 24) + 'h'
  } catch { return '' }
}

function ticketTimeClass(createdAt, status) {
  if (!createdAt || status === 'Cerrada') return ''
  try {
    const hours = (Date.now() - new Date(createdAt).getTime()) / 36e5
    if (hours < 24) return 'time-ok'
    if (hours < 48) return 'time-warn'
    return 'time-overdue'
  } catch { return '' }
}

onMounted(() => {
  store.fetchTickets().catch(() => {})
  store.startPolling(30000)
  store.listenCrossTab()
  store.connectSocket()
})

onUnmounted(() => {
  store.stopPolling()
})
</script>
