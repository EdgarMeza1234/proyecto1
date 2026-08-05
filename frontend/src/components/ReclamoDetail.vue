<template>
  <div class="detail">
    <div class="detail-head">
      <div>
        <span class="eyebrow">{{ reclamo.CodigoReclamo }}</span>
        <h2>{{ reclamo.NombreCliente || 'Sin nombre' }}</h2>
        <p>{{ reclamo.Direccion || 'Sin direccion' }}</p>
      </div>
      <span class="badge" :class="statusClass(reclamo.Estado)">{{ statusLabel }}</span>
    </div>

    <div class="info-grid">
      <div class="info"><span>Telefono</span><strong>{{ reclamo.Dn }}</strong></div>
      <div class="info"><span>Tipo de falla</span><strong>{{ reclamo.TipoFalla || '—' }}</strong></div>
      <div class="info"><span>Registrado por</span><strong>{{ reclamo.RegistradoPor }}</strong></div>
      <div class="info"><span>Fecha registro</span><strong>{{ formatDate(reclamo.FechaRegistro) }}</strong></div>
      <div class="info"><span>Tiempo transcurrido</span><strong>{{ elapsed }}</strong></div>
      <div class="info"><span>Revisado por</span><strong>{{ reclamo.RevisadoPor || 'Pendiente' }}</strong></div>
      <div v-if="reclamo.Estado === 'GeneradoBoleta'" class="info">
        <span>Boleta generada</span>
        <strong>{{ reclamo.CodigoBoleta || '—' }}</strong>
      </div>
      <div v-if="reclamo.TecnicoAsignado" class="info">
        <span>Tecnico asignado</span>
        <strong>{{ reclamo.TecnicoAsignado }}</strong>
      </div>
      <div v-if="reclamo.FechaRevision" class="info">
        <span>Fecha revision</span>
        <strong>{{ formatDate(reclamo.FechaRevision) }}</strong>
      </div>
    </div>

    <div class="panel" style="margin-top:12px;padding:12px">
      <h3>Reclamo</h3>
      <p v-if="reclamo.TipoFalla"><strong>Tipo:</strong> {{ reclamo.TipoFalla }}</p>
      <p>{{ reclamo.ReclamoDescripcion || 'Sin descripcion' }}</p>
      <p v-if="reclamo.ResultadoRevision" style="margin-top:8px">
        <strong>Resultado de revision:</strong> {{ reclamo.ResultadoRevision }}
      </p>
    </div>

    <div class="actions" style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">
      <button v-if="canReview" class="primary" @click="$emit('review', reclamo)">Revisar reclamo</button>
      <div v-if="canDistribute" style="display:flex;align-items:center;gap:8px;margin-left:auto">
        <span style="color:var(--muted);font-size:13px">Tecnico:</span>
        <select
          v-model="selectedTech"
          @change="assignTech"
          class="tech-select"
        >
          <option value="">-- Asignar tecnico --</option>
          <option v-for="t in technicians" :key="t.IdUsuario" :value="t.NombreCompleto">{{ t.NombreCompleto }}</option>
        </select>
        <span v-if="assignMsg" :class="assignMsg.includes('Error') ? 'badge error' : 'badge ok'" style="font-size:12px;white-space:nowrap">{{ assignMsg }}</span>
      </div>
    </div>

    <h3>Seguimiento</h3>
    <ol class="timeline">
      <li v-for="(evt, i) in events" :key="evt.FechaHora">
        <time>{{ formatDate(evt.FechaHora) }} <span class="event-elapsed" v-if="evt._elapsed">{{ evt._elapsed }}</span></time>
        <strong>{{ evt.Titulo }}</strong>
        <p>{{ evt.Detalle }}</p>
        <span>{{ evt.Actor }}</span>
      </li>
      <li v-if="!events.length">
        <p class="muted">Sin eventos registrados.</p>
      </li>
    </ol>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useReclamoStore } from '../stores/reclamos'
import { formatElapsed } from '../utils/formatElapsed'
import api from '../services/api'

const props = defineProps({
  reclamo: { type: Object, required: true }
})

defineEmits(['review'])

const auth = useAuthStore()
const reclamoStore = useReclamoStore()

const events = computed(() => {
  const raw = props.reclamo.events || []
  const sorted = [...raw].sort((a, b) => new Date(a.FechaHora) - new Date(b.FechaHora))
  return sorted.map((evt, i) => {
    const prev = i === 0 ? props.reclamo.FechaRegistro : sorted[i - 1].FechaHora
    return { ...evt, _elapsed: formatElapsed(prev, evt.FechaHora) }
  })
})

const statusLabel = computed(() => {
  const labels = {
    Pendiente: 'Pendiente',
    EnRevision: 'En revision',
    CerradoCentral: 'Cerrado (central)',
    GeneradoBoleta: 'Genero boleta',
    Cerrado: 'Cerrado'
  }
  return labels[props.reclamo.Estado] || props.reclamo.Estado || 'Desconocido'
})

function statusClass(status) {
  return String(status || '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

const elapsed = computed(() => {
  if (!props.reclamo.FechaRegistro) return '—'
  if (props.reclamo.Estado === 'CerradoCentral' || props.reclamo.Estado === 'Cerrado') {
    if (props.reclamo.FechaRevision) {
      const diff = new Date(props.reclamo.FechaRevision) - new Date(props.reclamo.FechaRegistro)
      const hours = Math.max(0, Math.round(diff / 36e5 * 10) / 10)
      return hours + ' h (cerrado)'
    }
    return '—'
  }
  const diff = Date.now() - new Date(props.reclamo.FechaRegistro).getTime()
  const hours = Math.max(0, Math.round(diff / 36e5 * 10) / 10)
  if (hours < 1) return Math.round(diff / 60000) + ' min'
  if (hours < 24) return hours + ' h'
  const days = Math.floor(hours / 24)
  const remainingHours = Math.round(hours % 24)
  return days + 'd ' + remainingHours + 'h'
})

const canReview = computed(() => {
  return props.reclamo.Estado === 'Pendiente' && auth.hasPermission('reviewReclamo')
})

const canDistribute = computed(() => {
  return props.reclamo.IdBoletaGenerada && auth.hasPermission('distribucion')
})

const assignMsg = ref('')
const technicians = ref([])
const selectedTech = ref('')
let assigning = false

async function loadTechnicians() {
  try {
    const res = await api.get('/usuarios')
    technicians.value = (res.data || []).filter((u) => u.RolCodigo === 'tecnico')
    if (props.reclamo.TecnicoAsignado) {
      selectedTech.value = props.reclamo.TecnicoAsignado
    }
  } catch {}
}

async function assignTech() {
  const tech = selectedTech.value
  if (!tech || !props.reclamo.IdBoletaGenerada || assigning) return
  assigning = true
  assignMsg.value = 'Asignando...'
  props.reclamo.TecnicoAsignado = tech
  try {
    const [r1, r2] = await Promise.all([
      api.post(`/boletas/${props.reclamo.IdBoletaGenerada}/seguimiento`, {
        TipoEvento: 'Asignacion',
        Titulo: 'Tecnico asignado',
        Detalle: `Boleta asignada a ${tech}.`,
        Actor: auth.name,
        EstadoResultante: 'En reparacion',
        TecnicoAsignado: tech
      }),
      api.post(`/reclamos/${props.reclamo.IdReclamo}/seguimiento`, {
        TipoEvento: 'Asignacion',
        Titulo: 'Boleta asignada',
        Detalle: `Boleta ${props.reclamo.CodigoBoleta || ''} asignada a ${tech}.`,
        Actor: auth.name,
        EstadoResultante: props.reclamo.Estado
      })
    ])
    assignMsg.value = `Asignado a ${tech}`
    await reclamoStore.fetchReclamoDetail(props.reclamo.IdReclamo)
    setTimeout(() => { assignMsg.value = '' }, 3000)
  } catch (e) {
    assignMsg.value = 'Error al asignar'
    props.reclamo.TecnicoAsignado = ''
    selectedTech.value = ''
    setTimeout(() => { assignMsg.value = '' }, 4000)
  }
  assigning = false
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/La_Paz'
  }).format(new Date(value))
}

watch(() => props.reclamo, (reclamo) => {
  if (reclamo?.IdReclamo) {
    reclamoStore.fetchReclamoDetail(reclamo.IdReclamo).catch(() => {})
  }
  if (reclamo?.IdBoletaGenerada) {
    loadTechnicians()
  }
}, { immediate: true })
</script>
