<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <section class="modal repair-modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div>
          <span class="eyebrow">Reparacion de fallas</span>
          <h2>Nueva boleta tecnica</h2>
        </div>
        <button class="icon-button" @click="$emit('close')">x</button>
      </div>

      <form class="repair-form" @submit.prevent="createTicket">
        <section class="ticket-paper">
          <div class="paper-title">
            <span>Departamento tecnico</span>
            <strong>REPARACION DE FALLAS</strong>
            <span>No. {{ nextId }}</span>
          </div>

          <div class="form-grid customer-grid">
            <label class="field">
              <span>No. Telef.</span>
              <input v-model="form.phone" name="phone" placeholder="Numero del abonado" />
            </label>
            <label class="field">
              <span>Nombre</span>
              <input v-model="form.name" name="name" placeholder="Nombre desde ERP" />
            </label>
            <label class="field">
              <span>Lugar de instalacion</span>
              <input v-model="form.address" name="address" placeholder="Direccion desde ERP" />
            </label>
            <label class="field">
              <span>Referencias complementarias</span>
              <input v-model="form.reference" name="reference" placeholder="Referencia para ubicar domicilio" />
            </label>
          </div>

          <div class="lookup-strip">
            <button type="button" class="secondary" :disabled="loading" @click="lookupErp">
              {{ loading ? 'Consultando...' : 'Consultar ERP' }}
            </button>
            <span :class="error ? 'error-text' : 'muted'">{{ error || 'Digite el numero y consulte para traer nombre y direccion.' }}</span>
          </div>

          <h3 class="paper-section">Datos tecnicos</h3>
          <div class="form-grid technical-grid">
            <label class="field"><span>Cable primario</span><input v-model="form.primaryCable" /></label>
            <label class="field"><span>Par primario</span><input v-model="form.primaryPair" /></label>
            <label class="field"><span>No. de ADM</span><input v-model="form.admNumber" /></label>
            <label class="field"><span>Cable secundario</span><input v-model="form.secondaryCable" /></label>
            <label class="field"><span>Par secundario</span><input v-model="form.secondaryPair" /></label>
            <label class="field"><span>Zona</span><input v-model="form.zone" /></label>
            <label class="field"><span>Central</span><input v-model="form.central" /></label>
            <label class="field"><span>Caja facil acceso</span><input v-model="form.accessBox" /></label>
            <label class="field"><span>Terminal</span><input v-model="form.terminal" /></label>
            <label class="field"><span>Armario</span><input v-model="form.cabinet" /></label>
          </div>

          <h3 class="paper-section">Atencion</h3>
          <div class="form-grid service-grid">
            <label class="field">
              <span>Reclamo / falla</span>
              <select v-model="form.faultType">
                <option>Sin tono</option><option>Ruido en linea</option><option>Cable cortado</option>
                <option>Cambio de acometida</option><option>Intermitencia</option><option>Otros</option>
              </select>
            </label>
            <label class="field">
              <span>Prioridad</span>
              <select v-model="form.priority">
                <option>Media</option><option>Urgente</option><option>Alta</option><option>Baja</option>
              </select>
            </label>
            <label class="field"><span>Recibido por</span><input v-model="form.receivedBy" /></label>
            <label class="field"><span>Prueba en central</span><input v-model="form.centralTest" /></label>
            <label class="field field-wide"><span>Reclamo del abonado</span><textarea v-model="form.claim" placeholder="Detalle indicado por el usuario"></textarea></label>
            <label class="field field-wide"><span>Observaciones</span><textarea v-model="form.observations" placeholder="Trabajo inicial, observaciones o material requerido"></textarea></label>
          </div>
        </section>

        <div class="modal-actions">
          <button type="button" class="ghost" @click="$emit('close')">Cancelar</button>
          <button class="primary" :disabled="saving">{{ saving ? 'Generando...' : 'Generar boleta' }}</button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useTicketStore } from '../stores/tickets'
import { useAuthStore } from '../stores/auth'
import api from '../services/api'

const emit = defineEmits(['close', 'saved'])
const ticketStore = useTicketStore()
const auth = useAuthStore()

const loading = ref(false)
const saving = ref(false)
const error = ref('')

const form = reactive({
  phone: '', userId: '', name: '', address: '', reference: '',
  faultType: 'Sin tono', priority: 'Media', claim: '', receivedBy: auth.name || 'Administrador',
  primaryCable: '', primaryPair: '', admNumber: '', secondaryCable: '', secondaryPair: '',
  zone: '', central: '', accessBox: '', terminal: '', cabinet: '',
  centralTest: '', observations: ''
})

const nextId = computed(() => {
  return `BR-${new Date().getFullYear()}-${String(ticketStore.tickets.length + 1).padStart(4, '0')}`
})

async function lookupErp() {
  if (!form.phone.trim()) {
    error.value = 'Ingrese el numero telefonico antes de consultar.'
    return
  }
  loading.value = true
  error.value = ''

  try {
    const [erpRes, facRes] = await Promise.allSettled([
      api.get(`/erp/personas/${encodeURIComponent(form.phone)}`),
      api.get(`/facilidades/dn/${encodeURIComponent(form.phone)}`)
    ])

    if (erpRes.status === 'fulfilled') {
      const source = Array.isArray(erpRes.value.data) ? erpRes.value.data[0] : erpRes.value.data
      if (source && typeof source === 'object') {
        form.name = source.nombreCompleto || source.NombreCompleto || source.nombre || source.Nombre || source.razonSocial || form.name
        form.address = source.direccion || source.Direccion || source.domicilio || form.address
        form.zone = source.zona || source.Zona || ''
      }
    }

    if (facRes.status === 'fulfilled' && facRes.value.data) {
      const f = facRes.value.data
      const central = String(f.Central || '').trim() || String(f.ParPriBloq || '').trim()
      const primaryBlock = String(f.Central || '').trim() ? String(f.ParPriBloq || '').trim() : String(f.ParPriPar || '').trim()
      const primaryPair = String(f.Central || '').trim() ? String(f.ParPriPar || '').trim() : String(f.NumeroParCalculado || '').trim()
      form.primaryPair = [central, primaryBlock, primaryPair].filter(Boolean).join('-') || form.primaryPair
      form.central = central || form.central
      form.secondaryPair = f.ParSec || form.secondaryPair
      form.cabinet = f.Armario || form.cabinet
      form.accessBox = f.CajDis || form.accessBox
      form.observations = f.Obs || form.observations
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function createTicket() {
  if (!form.phone.trim()) {
    error.value = 'El numero telefonico es obligatorio.'
    return
  }
  saving.value = true
  error.value = ''

  const parts = String(form.primaryPair || '').split('-').map((p) => p.trim()).filter(Boolean)
  const serverTicket = {
    Dn: form.phone,
    NombreCliente: form.name,
    Direccion: form.address,
    Referencia: form.reference,
    Central: form.central || parts[0] || '',
    ParPriBloq: parts[1] || '',
    ParPriPar: parts[2] || '',
    ParPrimarioCompleto: form.primaryPair,
    ParSec: form.secondaryPair,
    Armario: form.cabinet,
    CajDis: form.accessBox,
    TipoFalla: form.faultType,
    Prioridad: form.priority,
    ReclamoAbonado: form.claim,
    PruebaCentral: form.centralTest,
    Observaciones: form.observations,
    RecibidoPor: form.receivedBy
  }

  try {
    const res = await api.post('/boletas', { ticket: serverTicket })
    ticketStore.addTicket({
      ...res.data,
      ...serverTicket,
      id: res.data.CodigoBoleta,
      dbId: res.data.id,
      status: 'Pendiente',
      createdAt: new Date().toISOString(),
      user: { name: form.name, phone: form.phone, address: form.address },
      events: [{ at: new Date().toISOString(), title: 'Boleta generada', note: form.claim || 'Creada desde el panel.', actor: form.receivedBy }]
    })
    emit('saved')
    window.open(`/api/boletas/${res.data.id}/formulario`, '_blank')
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}
</script>
