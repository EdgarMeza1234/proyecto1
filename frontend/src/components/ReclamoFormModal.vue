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
              <input v-model="form.phone" placeholder="Numero del abonado" required @keydown.enter.prevent="lookupErp" />
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
            <span style="font-size:17px" :class="erpStatus.type">{{ erpStatus.text }}</span>
          </div>

          <div v-if="historialActivo.length" class="historial-warn">
            <strong>Este abonado tiene registros activos:</strong>
            <ul>
              <li v-for="item in historialActivo" :key="item.tipo + item.codigo">
                <span :class="badgeClass(item.tipo)">{{ item.tipo }}</span>
                <strong>{{ item.codigo }}</strong>
                <span>— {{ item.estado }}</span>
                <small class="muted" v-if="item.tipo === 'Boleta' && item.tecnico">Tecnico: {{ item.tecnico }}</small>
                <small class="muted" v-if="item.tipo === 'Reclamo'">{{ item.descripcion }}</small>
              </li>
            </ul>
          </div>

          <div v-if="historialCerrado.length" class="historial-info">
            <strong>Historial previo ({{ historialCerrado.length }}):</strong>
            <ul>
              <li v-for="item in historialCerrado" :key="item.tipo + item.codigo">
                <span :class="badgeClass(item.tipo)">{{ item.tipo }}</span>
                <strong>{{ item.codigo }}</strong>
                <span>— {{ item.estado }}</span>
                <small class="muted" v-if="item.tipo === 'Boleta' && item.tecnico">Tecnico: {{ item.tecnico }}</small>
              </li>
            </ul>
          </div>

          <h3 class="paper-section">Detalle del reclamo</h3>
          <div class="form-grid" style="grid-template-columns:1fr">
            <label class="field">
              <span>Tipo de falla</span>
              <select :value="form.tipoFalla" @change="onTipoFallaChange($event)" style="width:100%;min-height:44px">
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
const erpStatus = reactive({ type: 'muted', text: 'Digite el numero (minimo 5 digitos) y presione Enter para consultar el ERP.' })
const historial = ref({ reclamos: [], boletas: [] })

const ESTADOS_RECLAMO_ACTIVOS = ['Pendiente', 'EnRevision']
const ESTADOS_BOLETA_ACTIVOS = ['Pendiente', 'Asignada', 'EnProceso', 'EnRevision']

const historialActivo = computed(() => {
  const items = []
  for (const r of historial.value.reclamos || []) {
    if (ESTADOS_RECLAMO_ACTIVOS.includes(r.Estado)) {
      items.push({ tipo: 'Reclamo', codigo: r.CodigoReclamo, estado: r.Estado, descripcion: r.ReclamoDescripcion || r.TipoFalla })
    }
  }
  for (const b of historial.value.boletas || []) {
    if (ESTADOS_BOLETA_ACTIVOS.includes(b.Estado)) {
      items.push({ tipo: 'Boleta', codigo: b.CodigoBoleta, estado: b.Estado, tecnico: b.TecnicoAsignado })
    }
  }
  return items
})

const historialCerrado = computed(() => {
  const items = []
  for (const r of historial.value.reclamos || []) {
    if (!ESTADOS_RECLAMO_ACTIVOS.includes(r.Estado)) {
      items.push({ tipo: 'Reclamo', codigo: r.CodigoReclamo, estado: r.Estado, descripcion: r.ReclamoDescripcion || r.TipoFalla })
    }
  }
  for (const b of historial.value.boletas || []) {
    if (!ESTADOS_BOLETA_ACTIVOS.includes(b.Estado)) {
      items.push({ tipo: 'Boleta', codigo: b.CodigoBoleta, estado: b.Estado, tecnico: b.TecnicoAsignado })
    }
  }
  return items.slice(0, 10)
})

function badgeClass(tipo) {
  return tipo === 'Boleta' ? 'badge-boleta' : 'badge-reclamo'
}

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
  const numero = form.phone.replace(/\D/g, '')
  if (numero.length < 5) {
    erpStatus.type = 'error-text'
    erpStatus.text = 'Ingrese al menos 5 digitos del numero antes de consultar.'
    return
  }
  loading.value = true
  erpStatus.type = 'muted'
  erpStatus.text = 'Consultando...'

  const [erpRes, histRes] = await Promise.allSettled([
    api.get(`/erp/personas/${encodeURIComponent(form.phone)}`),
    api.get(`/reclamos/abonado/${encodeURIComponent(form.phone)}`)
  ])

  if (histRes.status === 'fulfilled' && histRes.value.data) {
    const data = histRes.value.data
    historial.value = {
      reclamos: Array.isArray(data.reclamos) ? data.reclamos : [],
      boletas: Array.isArray(data.boletas) ? data.boletas : []
    }
  } else {
    historial.value = { reclamos: [], boletas: [] }
  }

  try {
    if (erpRes.status !== 'fulfilled') throw erpRes.reason
    const erpData = erpRes.value.data
    if (erpData) {
      const source = Array.isArray(erpData) ? erpData[0] : erpData
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

<style scoped>
.historial-warn,
.historial-info {
  border-radius: 10px;
  padding: 10px 14px;
  margin: 10px 0;
  font-size: 13px;
}
.historial-warn {
  border: 1px solid var(--danger);
  background: rgba(239, 68, 68, 0.12);
}
.historial-info {
  border: 1px solid var(--border);
  background: var(--surface-card);
}
.historial-warn ul,
.historial-info ul {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.historial-warn li,
.historial-info li {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.badge-boleta,
.badge-reclamo {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}
.badge-boleta {
  background: rgba(6, 182, 212, 0.2);
  color: var(--accent);
}
.badge-reclamo {
  background: rgba(234, 179, 8, 0.2);
  color: #eab308;
}
</style>
