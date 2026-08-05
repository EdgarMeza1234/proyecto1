<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <section class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div>
          <span class="eyebrow">ODECO - Atencion al cliente</span>
          <h2>Registrar reclamo telefonico</h2>
        </div>
        <button class="icon-button" @click="$emit('close')">x</button>
      </div>

      <form class="repair-form" @submit.prevent="submit">
        <section class="ticket-paper">
          <div class="paper-title">
            <span>ODECO</span>
            <strong>RECLAMO TELEFONICO</strong>
            <span>No. {{ nextId }}</span>
          </div>

          <div class="form-grid customer-grid">
            <label class="field">
              <span>No. Telef.</span>
              <input v-model="form.phone" placeholder="Numero del abonado" required />
            </label>
            <label class="field">
              <span>Nombre</span>
              <input v-model="form.name" placeholder="Nombre del abonado" />
            </label>
            <label class="field">
              <span>Direccion</span>
              <input v-model="form.address" placeholder="Direccion del domicilio" />
            </label>
            <label class="field">
              <span>Referencia</span>
              <input v-model="form.reference" placeholder="Referencia para ubicar" />
            </label>
          </div>

          <div class="lookup-strip">
            <button type="button" class="secondary" :disabled="loading" @click="lookupErp">
              {{ loading ? 'Consultando...' : 'Consultar ERP' }}
            </button>
            <span style="font-size:17px" :class="erpStatus.type">{{ erpStatus.text }}</span>
          </div>

          <h3 class="paper-section">Detalle del reclamo</h3>
          <div class="form-grid" style="grid-template-columns:1fr">
            <label class="field">
              <span>Tipo de falla</span>
              <select :value="form.tipoFalla" @change="onTipoFallaChange($event)" style="width:100%;min-height:44px;border:1px solid var(--line);border-radius:8px;padding:0 12px;background:white;color:var(--ink)">
                <option value="">-- Seleccione tipo de falla --</option>
                <option v-for="t in faultTypes" :key="t.IdTipoFalla" :value="t.Nombre">{{ t.Nombre }}</option>
                <option disabled>──────────</option>
                <option value="__NEW__">+ Agregar nuevo tipo de falla...</option>
              </select>
            </label>
            <label class="field">
              <span>Descripcion detallada</span>
              <textarea v-model="form.description" rows="3" placeholder="Describa el motivo del reclamo reportado por el abonado"></textarea>
            </label>
            <label class="field">
              <span>Observaciones</span>
              <textarea v-model="form.observations" rows="2" placeholder="Informacion adicional"></textarea>
            </label>
          </div>
        </section>

        <div v-if="submitError" class="lookup-strip" style="border:1px solid var(--danger);background:#fef2f2;margin-top:8px">
          <span class="error-text">{{ submitError }}</span>
        </div>

        <div class="modal-actions">
          <button type="button" class="ghost" @click="$emit('close')">Cancelar</button>
          <button class="primary" :disabled="saving">{{ saving ? 'Registrando...' : 'Registrar reclamo' }}</button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useReclamoStore } from '../stores/reclamos'
import { useAuthStore } from '../stores/auth'
import api from '../services/api'

const emit = defineEmits(['close', 'saved'])
const reclamoStore = useReclamoStore()
const auth = useAuthStore()

const FALLBACK_TIPOS = [
  'Sin tono', 'Ruido en linea', 'Cable cortado', 'Cambio de acometida',
  'Intermitencia', 'Linea cruzada', 'No marca', 'Otros'
]

const loading = ref(false)
const saving = ref(false)
const faultTypes = ref([])
const submitError = ref('')
const erpStatus = reactive({ type: 'muted', text: 'Digite el numero y consulte para traer datos del abonado.' })

const form = reactive({
  phone: '', name: '', address: '', reference: '',
  tipoFalla: '', description: '', observations: ''
})

const nextId = computed(() => {
  return `RC-${new Date().getFullYear()}-${String(reclamoStore.reclamos.length + 1).padStart(4, '0')}`
})

async function loadFaultTypes() {
  try {
    const res = await api.get('/tipos-falla')
    faultTypes.value = Array.isArray(res.data) ? res.data : []
  } catch {
    faultTypes.value = FALLBACK_TIPOS.map((n, i) => ({ IdTipoFalla: i + 1, Nombre: n }))
  }
}

async function lookupErp() {
  if (!form.phone.trim()) {
    erpStatus.type = 'error-text'
    erpStatus.text = 'Ingrese el numero telefonico antes de consultar.'
    return
  }
  loading.value = true
  erpStatus.type = 'muted'
  erpStatus.text = 'Consultando...'

  try {
    const erpRes = await api.get(`/erp/personas/${encodeURIComponent(form.phone)}`)
    if (erpRes.data) {
      const source = Array.isArray(erpRes.data) ? erpRes.data[0] : erpRes.data
      if (source && typeof source === 'object') {
        form.name = source.nombreCompleto || source.NombreCompleto || source.nombre || source.Nombre || form.name
        form.address = source.direccion || source.Direccion || form.address
      }
    }
    erpStatus.type = 'success-text'
    erpStatus.text = 'Datos cargados desde ERP.'
  } catch {
    erpStatus.type = 'error-text'
    erpStatus.text = 'No se pudo consultar ERP. Ingrese los datos manualmente.'
  } finally {
    loading.value = false
  }
}

async function onTipoFallaChange(event) {
  const value = event.target.value
  if (value === '__NEW__') {
    const newName = prompt('Ingrese el nuevo tipo de falla:', '')
    if (newName && newName.trim()) {
      try {
        const res = await api.post('/tipos-falla', { nombre: newName.trim() })
        faultTypes.value.push({ IdTipoFalla: res.data.IdTipoFalla, Nombre: res.data.Nombre })
        form.tipoFalla = res.data.Nombre
      } catch {
        form.tipoFalla = ''
      }
    } else {
      form.tipoFalla = ''
    }
  } else {
    form.tipoFalla = value
  }
}

async function submit() {
  submitError.value = ''
  if (!form.phone.trim()) {
    submitError.value = 'El numero telefonico es obligatorio.'
    return
  }
  if (!form.tipoFalla) {
    submitError.value = 'Seleccione el tipo de falla.'
    return
  }
  saving.value = true

  try {
    const res = await api.post('/reclamos', {
      reclamo: {
        Dn: form.phone,
        NombreCliente: form.name,
        Direccion: form.address,
        Referencia: form.reference,
        TipoFalla: form.tipoFalla,
        ReclamoDescripcion: form.description || form.tipoFalla,
        RegistradoPor: auth.name || 'ODECO',
        Observaciones: form.observations
      }
    })
    reclamoStore.addReclamo({
      IdReclamo: res.data.id,
      CodigoReclamo: res.data.CodigoReclamo,
      Dn: form.phone,
      NombreCliente: form.name,
      Direccion: form.address,
      TipoFalla: form.tipoFalla,
      ReclamoDescripcion: form.description || form.tipoFalla,
      RegistradoPor: auth.name,
      Estado: 'Pendiente',
      FechaRegistro: new Date().toISOString()
    })
    emit('saved')
  } catch (err) {
    submitError.value = err.message
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadFaultTypes()
})
</script>
