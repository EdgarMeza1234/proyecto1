<template>
  <section class="metrics">
    <article class="metric">
      <svg class="metric-icon" viewBox="0 0 24 24" style="position:absolute;right:20px;top:20px;width:38px;height:38px;stroke:rgba(255,255,255,0.06);stroke-width:1.5;fill:none;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
      <span>Reclamos</span>
      <strong>{{ store.stats.total }}</strong>
      <small>Registrados</small>
    </article>
    <article class="metric">
      <svg class="metric-icon" viewBox="0 0 24 24" style="position:absolute;right:20px;top:20px;width:38px;height:38px;stroke:rgba(245,158,11,0.12);stroke-width:1.5;fill:none;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      <span>Pendientes</span>
      <strong>{{ store.stats.pendientes }}</strong>
      <small>Sin revisión</small>
    </article>
    <article class="metric">
      <svg class="metric-icon" viewBox="0 0 24 24" style="position:absolute;right:20px;top:20px;width:38px;height:38px;stroke:rgba(16,185,129,0.12);stroke-width:1.5;fill:none;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
      <span>Cerrados (central)</span>
      <strong>{{ store.stats.cerradosCentral }}</strong>
      <small>Sin boleta</small>
    </article>
    <article class="metric">
      <svg class="metric-icon" viewBox="0 0 24 24" style="position:absolute;right:20px;top:20px;width:38px;height:38px;stroke:rgba(59,130,246,0.12);stroke-width:1.5;fill:none;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
      <span>Con boleta</span>
      <strong>{{ store.stats.conBoleta }}</strong>
      <small>Derivados a externa</small>
    </article>
    <article class="metric">
      <svg class="metric-icon" viewBox="0 0 24 24" style="position:absolute;right:20px;top:20px;width:38px;height:38px;stroke:rgba(139,92,246,0.12);stroke-width:1.5;fill:none;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
      <span>Con tecnico</span>
      <strong>{{ conTecnico }}</strong>
      <small>Asignados a cuadrilla</small>
    </article>
  </section>

    <section class="filters">
    <input v-model="store.search" placeholder="Buscar por codigo, telefono, nombre, reclamo" />
    <select v-model="store.statusFilter">
      <option value="Todos">Todos</option>
      <option value="Pendiente">Pendiente</option>
      <option value="EnRevision">En revisión</option>
      <option value="CerradoCentral">Cerrado (central)</option>
      <option value="GeneradoBoleta">Con boleta</option>
    </select>
  </section>

  <section class="grid tickets-layout">
    <div class="panel">
      <div class="panel-head">
        <h2>{{ store.filteredReclamos.length }} reclamos</h2>
        <button v-if="canCreate" class="primary" @click="showModal = true" style="font-size:21px;padding:8px 24px;min-height:48px">+ Nuevo reclamo</button>
      </div>
      <div class="table">
        <button
          v-for="reclamo in store.filteredReclamos"
          :key="reclamo.IdReclamo"
          class="table-row reclamo-row"
          :class="[timeColorClass(reclamo.FechaRegistro, reclamo.Estado), { selected: store.selectedId === reclamo.IdReclamo }]"
          @click="select(reclamo)"
        >
          <span class="reclamo-main">
            <strong>{{ reclamo.CodigoReclamo }}</strong>
            <small>{{ reclamo.NombreCliente }} - {{ reclamo.Dn }}</small>
          </span>
          <span class="reclamo-fecha">
            <small>{{ formatDate(reclamo.FechaRegistro) }}</small>
          </span>
          <span class="reclamo-horas" :class="timeColorClass(reclamo.FechaRegistro, reclamo.Estado)">
            <strong>{{ elapsedHours(reclamo.FechaRegistro, reclamo.Estado) }}</strong>
          </span>
          <span>{{ reclamo.TipoFalla || '—' }}</span>
          <span v-if="reclamo.TecnicoAsignado" class="badge tech">{{ reclamo.TecnicoAsignado }}</span>
          <span v-else class="badge" :class="statusBadge(reclamo.Estado)">{{ estadoLabel(reclamo.Estado) }}</span>
        </button>
        <p v-if="!store.filteredReclamos.length" class="empty">No hay reclamos para el filtro actual.</p>
      </div>
    </div>
    <div class="panel">
      <ReclamoDetail
        v-if="store.selectedReclamo"
        :reclamo="store.selectedReclamo"
        @review="openReview"
      />
      <p v-else class="empty" style="padding:40px 0;text-align:center">Seleccione un reclamo para ver su detalle.</p>
    </div>
  </section>

  <ReclamoFormModal
    v-if="showModal"
    @close="showModal = false"
    @saved="onSaved"
  />

  <ReclamoReviewModal
    v-if="reviewTarget"
    :reclamo="reviewTarget"
    @close="reviewTarget = null"
    @saved="onReviewed"
  />
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useReclamoStore } from '../stores/reclamos'
import { useAuthStore } from '../stores/auth'
import { useTicketStore } from '../stores/tickets'
import ReclamoDetail from '../components/ReclamoDetail.vue'
import ReclamoFormModal from '../components/ReclamoFormModal.vue'
import ReclamoReviewModal from '../components/ReclamoReviewModal.vue'

const TZ = 'America/La_Paz'

const store = useReclamoStore()
const auth = useAuthStore()
const ticketStore = useTicketStore()
const showModal = ref(false)
const reviewTarget = ref(null)

const canCreate = computed(() => auth.hasPermission('createReclamo'))

const conTecnico = computed(() => store.reclamos.filter((r) => r.TecnicoAsignado).length)

function select(reclamo) {
  store.selectedId = reclamo.IdReclamo
}

function openReview(reclamo) {
  reviewTarget.value = reclamo
}

function estadoLabel(estado) {
  const labels = {
    Pendiente: 'Pendiente',
    EnRevision: 'En revision',
    CerradoCentral: 'Cerrado central',
    GeneradoBoleta: 'Con boleta',
    Cerrado: 'Cerrado'
  }
  return labels[estado] || estado
}

function statusBadge(estado) {
  return String(estado || '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

function timeColorClass(fechaRegistro, estado) {
  if (!fechaRegistro || estado === 'CerradoCentral' || estado === 'Cerrado') return ''
  try {
    const hours = (Date.now() - new Date(fechaRegistro).getTime()) / 36e5
    if (hours < 24) return 'time-ok'
    if (hours < 48) return 'time-warn'
    return 'time-overdue'
  } catch { return '' }
}

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('es-BO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ
    }).format(new Date(value))
  } catch { return '—' }
}

function elapsedHours(fechaRegistro, estado) {
  if (!fechaRegistro) return ''
  if (estado === 'CerradoCentral' || estado === 'Cerrado') return ''
  try {
    const diff = Date.now() - new Date(fechaRegistro).getTime()
    const hours = Math.max(0, Math.round(diff / 36e5 * 10) / 10)
    if (hours < 1) return Math.round(diff / 60000) + ' min'
    if (hours < 24) return hours + ' h'
    const days = Math.floor(hours / 24)
    const remainingHours = Math.round(hours % 24)
    return days + 'd ' + remainingHours + 'h'
  } catch { return '' }
}

function onSaved() {
  showModal.value = false
}

async function onReviewed() {
  reviewTarget.value = null
  await store.fetchReclamos()
  await ticketStore.fetchTickets()
}

onMounted(() => {
  if (!store.reclamos.length) {
    store.fetchReclamos().catch(() => {})
  }
  store.startPolling(30000)
  store.listenCrossTab()
  store.connectSocket()
  ticketStore.connectSocket()
})

onUnmounted(() => {
  store.stopPolling()
})
</script>
