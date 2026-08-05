<template>
  <div class="detail">
    <div class="detail-head">
      <div>
        <span class="eyebrow">{{ ticket.id }}</span>
        <h2>{{ ticket.user?.name }}</h2>
        <p>{{ ticket.user?.address }}</p>
      </div>
      <span class="badge" :class="statusClass(ticket.status)">{{ ticket.status }}</span>
    </div>

    <div class="info-grid">
      <div class="info"><span>Telefono</span><strong>{{ ticket.user?.phone }}</strong></div>
      <div class="info"><span>Tipo de falla</span><strong>{{ ticket.faultType }}</strong></div>
      <div class="info"><span>Prioridad</span><strong>{{ ticket.priority }}</strong></div>
      <div class="info"><span>Tecnico</span><strong>{{ ticket.technician }}</strong></div>
      <div class="info"><span>Par primario</span><strong>{{ ticket.network?.primaryPair }}</strong></div>
      <div class="info"><span>Par secundario</span><strong>{{ ticket.network?.secondaryPair }}</strong></div>
      <div class="info"><span>Caja facil acceso</span><strong>{{ ticket.network?.accessBox }}</strong></div>
      <div class="info"><span>Tiempo transcurrido</span><strong>{{ hours }} h</strong></div>
    </div>

    <div class="actions">
      <button v-if="can('addEvent')" class="secondary" @click="addEvent">Agregar avance</button>
      <button v-if="can('assignTech')" class="secondary" @click="assignTech">Asignar tecnico</button>
      <button v-if="ticket.dbId && can('printTicket')" class="secondary" @click="printTicket">Imprimir formulario</button>
      <button v-if="ticket.status !== 'Cerrada' && can('closeTicket')" class="primary" @click="closeTicket">Cerrar boleta</button>
    </div>

    <h3>Linea de tiempo</h3>
    <ol class="timeline">
      <li v-for="(evt, i) in eventsWithElapsed" :key="evt.at">
        <time>{{ formatDate(evt.at) }} <span class="event-elapsed" v-if="evt._elapsed">{{ evt._elapsed }}</span></time>
        <strong>{{ evt.title }}</strong>
        <p>{{ evt.note }}</p>
        <span>{{ evt.actor }}</span>
      </li>
    </ol>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useTicketStore } from '../stores/tickets'
import { formatElapsed } from '../utils/formatElapsed'

const props = defineProps({
  ticket: { type: Object, required: true }
})

const emit = defineEmits(['event-added', 'ticket-closed'])
const auth = useAuthStore()
const ticketStore = useTicketStore()

const eventsWithElapsed = computed(() => {
  const raw = props.ticket.events || []
  const sorted = [...raw].sort((a, b) => new Date(a.at) - new Date(b.at))
  return sorted.map((evt, i) => {
    const prev = i === 0 ? props.ticket.createdAt : sorted[i - 1].at
    return { ...evt, _elapsed: formatElapsed(prev, evt.at) }
  })
})

watch(() => props.ticket, (ticket) => {
  if (ticket?.dbId) {
    ticketStore.fetchTicketDetail(ticket.dbId).catch(() => {})
  }
}, { immediate: true })

function statusClass(status) {
  return String(status || '').toLowerCase().replace(/\s+/g, '-')
}

function can(perm) {
  return auth.hasPermission(perm)
}

const hours = computed(() => {
  const diff = new Date(props.ticket.closedAt || Date.now()) - new Date(props.ticket.createdAt)
  return Math.max(0, Math.round(diff / 36e5 * 10) / 10)
})

function formatDate(value) {
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/La_Paz'
  }).format(new Date(value))
}

function addEvent() {
  const note = prompt('Detalle del avance realizado:')
  if (!note) return
  const estadoResultante = props.ticket.status === 'Pendiente' ? 'En reparacion' : undefined
  ticketStore.addTicketEvent(props.ticket.dbId, {
    TipoEvento: 'Avance',
    Titulo: 'Avance tecnico',
    Detalle: note,
    Actor: auth.name,
    EstadoResultante: estadoResultante
  }).then(() => emit('event-added')).catch(() => {})
}

function assignTech() {
  const technician = prompt('Nombre del tecnico asignado:', props.ticket.technician === 'Sin asignar' ? '' : props.ticket.technician)
  if (!technician) return
  ticketStore.addTicketEvent(props.ticket.dbId, {
    TipoEvento: 'Asignacion',
    Titulo: 'Tecnico asignado',
    Detalle: `Boleta asignada a ${technician}.`,
    Actor: auth.name,
    EstadoResultante: 'En reparacion',
    TecnicoAsignado: technician
  }).then(() => emit('event-added')).catch(() => {})
}

function closeTicket() {
  if (!confirm('Confirmar cierre de la boleta?')) return
  ticketStore.addTicketEvent(props.ticket.dbId, {
    TipoEvento: 'Cierre',
    Titulo: 'Boleta cerrada',
    Detalle: 'Servicio validado y boleta culminada.',
    Actor: auth.name,
    EstadoResultante: 'Cerrada'
  }).then(() => emit('ticket-closed')).catch(() => {})
}

function printTicket() {
  window.open(`/api/boletas/${props.ticket.dbId}/formulario`, '_blank')
}
</script>
