<template>
  <section class="filters">
    <input v-model="store.search" placeholder="Buscar por boleta, cliente, telefono, falla" />
    <select v-model="store.statusFilter">
      <option>Todos</option>
      <option>Pendiente</option>
      <option>En reparacion</option>
      <option>Cerrada</option>
    </select>
  </section>

  <section class="grid tickets-layout">
    <div class="panel">
      <div class="panel-head">
        <h2>{{ store.filteredTickets.length }} boletas</h2>
        <span class="muted">Seguimiento tecnico</span>
      </div>
      <div class="table">
        <button
          v-for="ticket in store.filteredTickets"
          :key="ticket.id"
          class="table-row"
          :class="{ selected: store.selectedId === ticket.id, 'pulse-glow-urgent': ticket.priority === 'Urgente' && ticket.status !== 'Cerrada' }"
          @click="store.selectedId = ticket.id"
        >
          <span>
            <strong>{{ ticket.id }}</strong>
            <small>{{ ticket.user?.name }} - {{ ticket.user?.phone }}</small>
          </span>
          <span>{{ ticket.faultType }}</span>
          <span>{{ ticket.network?.accessBox }}</span>
          <span class="badge" :class="statusClass(ticket.status)">{{ ticket.status }}</span>
        </button>
        <p v-if="!store.filteredTickets.length" class="empty">No hay resultados para el filtro actual.</p>
      </div>
    </div>
    <div class="panel">
      <TicketDetail
        v-if="store.selectedTicket"
        :ticket="store.selectedTicket"
        @event-added="saveTickets"
        @ticket-closed="saveTickets"
      />
      <p v-else>Selecciona una boleta.</p>
    </div>
  </section>

  <TicketFormModal
    v-if="showModal"
    @close="showModal = false"
    @saved="onTicketSaved"
  />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useTicketStore } from '../stores/tickets'
import TicketDetail from '../components/TicketDetail.vue'
import TicketFormModal from '../components/TicketFormModal.vue'

const store = useTicketStore()
const showModal = ref(false)

function statusClass(status) {
  return String(status || '').toLowerCase().replace(/\s+/g, '-')
}

function saveTickets() {
  localStorage.setItem('telefonia-reparaciones-v1', JSON.stringify(store.tickets))
}

function onTicketSaved() {
  showModal.value = false
}

function handleOpenNewTicket() {
  showModal.value = true
}

onMounted(() => {
  window.addEventListener('open-new-ticket', handleOpenNewTicket)
  if (!store.tickets.length) {
    store.fetchTickets().catch(() => {})
  }
  store.startPolling(30000)
  store.listenCrossTab()
  store.connectSocket()
})

onUnmounted(() => {
  window.removeEventListener('open-new-ticket', handleOpenNewTicket)
  store.stopPolling()
})
</script>
