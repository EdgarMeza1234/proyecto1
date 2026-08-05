<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <section class="modal" role="dialog" aria-modal="true" style="width:min(700px,100%)">
      <div class="modal-head">
        <div>
          <span class="eyebrow">Revision tecnica</span>
          <h2>Revisar reclamo {{ reclamo.CodigoReclamo }}</h2>
        </div>
        <button class="icon-button" @click="$emit('close')">x</button>
      </div>

      <form class="repair-form" @submit.prevent="submit">
        <section class="ticket-paper">
          <div class="paper-title" style="grid-template-columns:1fr 2fr 1fr">
            <span>ODECO</span>
            <strong>REVISION DE RECLAMO</strong>
            <span>{{ reclamo.CodigoReclamo }}</span>
          </div>

          <div style="padding:12px;border-bottom:1px solid #98a7ad">
            <p><strong>Abonado:</strong> {{ reclamo.NombreCliente }} — {{ reclamo.Dn }}</p>
            <p><strong>Reclamo:</strong> {{ reclamo.ReclamoDescripcion }}</p>
          </div>

          <div v-if="iskratelLoading" style="padding:12px;color:#666;font-size:13px">
            Consultando central Iskratel...
          </div>
          <div v-else-if="iskratelData.length" style="padding:8px 12px;border-bottom:1px solid #98a7ad">
            <h4 style="margin:4px 0 8px;font-size:13px;color:var(--primary)">Datos central Iskratel</h4>
            <div
              v-for="(row, i) in iskratelData"
              :key="i"
              style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;background:var(--bg);box-shadow:var(--shadow);margin-bottom:6px"
            >
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <strong style="font-size:14px">{{ row['Directory Number'] || '—' }}</strong>
                <code class="badge" style="font-size:10px">{{ row._archivo }}</code>
              </div>
              <div style="display:flex;flex-direction:column;gap:3px;font-size:12px">
                <span v-if="row['Registration Status']"><strong style="color:var(--text)">Estado registro:</strong> {{ row['Registration Status'] }}</span>
                <span v-if="row['Basic Service']"><strong style="color:var(--text)">Servicio base:</strong> {{ row['Basic Service'] }}</span>
                <span v-if="row['Interface / Access']"><strong style="color:var(--text)">Interface / Acceso:</strong> {{ row['Interface / Access'] }}</span>
                <span><strong style="color:var(--text)">Tipo suscriptor:</strong> {{ row['Subscriber Type'] || '—' }}</span>
                <span><strong style="color:var(--text)">Serv. suplementario:</strong> {{ row['Supplementary Service Set'] || '—' }}</span>
              </div>
            </div>
          </div>

          <h3 class="paper-section">Resultado de la revision</h3>
          <div class="form-grid" style="grid-template-columns:1fr">
            <label class="field">
              <span>Decision</span>
              <div style="display:flex;gap:12px;padding:8px 0">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                  <input type="radio" v-model="decision" value="CerradoCentral" />
                  <span style="font-weight:400;color:var(--ink)">Falla en central — no genera boleta</span>
                </label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                  <input type="radio" v-model="decision" value="GeneradoBoleta" />
                  <span style="font-weight:400;color:var(--ink)">Falla en planta externa — generar boleta</span>
                </label>
              </div>
            </label>
            <label class="field">
              <span>Resultado / diagnostico</span>
              <textarea v-model="resultado" rows="3" placeholder="Describa el resultado de la revision tecnica" required></textarea>
            </label>
          </div>

          <div v-if="decision === 'GeneradoBoleta'">
            <h3 class="paper-section">Datos para la boleta tecnica</h3>

            <div v-if="facilitiesLoading" style="padding:12px;color:#666">Buscando datos de facilidades...</div>
            <div v-else-if="facilitiesNotFound" style="padding:12px;color:#b91c1c;font-size:13px">No se encontraron datos en la tabla MDF para el DN {{ reclamo.Dn }}. Complete los campos manualmente.</div>

            <div class="form-grid technical-grid" style="grid-template-columns:repeat(4,1fr)">
              <label class="field"><span>Central</span><input v-model="form.central" /></label>
              <label class="field"><span>Par primario</span><input v-model="form.primaryPair" placeholder="Central-Bloq-Par" /></label>
              <label class="field"><span>Par secundario</span><input v-model="form.secondaryPair" /></label>
              <label class="field"><span>Armario</span><input v-model="form.cabinet" /></label>
              <label class="field"><span>Caja dist.</span><input v-model="form.accessBox" /></label>
              <label class="field"><span>Tipo falla</span>
                <select v-model="form.faultType">
                  <option v-for="t in faultTypes" :key="t" :value="t">{{ t }}</option>
                </select>
              </label>
              <label class="field"><span>Prioridad</span>
                <select v-model="form.priority">
                  <option>Media</option><option>Urgente</option><option>Alta</option><option>Baja</option>
                </select>
              </label>
              <label class="field"><span>Prueba central</span><input v-model="form.centralTest" /></label>
            </div>
            <div class="form-grid" style="grid-template-columns:1fr">
              <label class="field"><span>Observaciones</span><textarea v-model="form.observations" rows="2"></textarea></label>
            </div>
          </div>
        </section>

        <div class="modal-actions">
          <button type="button" class="ghost" @click="$emit('close')">Cancelar</button>
          <button class="primary" :disabled="saving">{{ saving ? 'Guardando...' : 'Guardar revision' }}</button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { useReclamoStore } from '../stores/reclamos'
import { useAuthStore } from '../stores/auth'
import api, { iskratelApi } from '../services/api'

const props = defineProps({
  reclamo: { type: Object, required: true }
})

const emit = defineEmits(['close', 'saved'])
const reclamoStore = useReclamoStore()
const auth = useAuthStore()

const saving = ref(false)
const decision = ref('CerradoCentral')
const resultado = ref('')
const faultTypes = ref(['Sin tono', 'Ruido en linea', 'Cable cortado', 'Cambio de acometida', 'Intermitencia', 'Otros'])
const facilitiesLoading = ref(false)
const facilitiesNotFound = ref(false)
const iskratelLoading = ref(true)
const iskratelData = ref([])

const form = reactive({
  central: '', primaryPair: '', secondaryPair: '', cabinet: '', accessBox: '',
  faultType: 'Sin tono', priority: 'Media', centralTest: '', observations: ''
})

function buildIskratelSearchKey(dn) {
  if (!dn) return ''
  const digits = dn.replace(/[^0-9]/g, '')
  if (digits.length < 5) return digits
  const last5 = digits.slice(-5)
  return '62' + last5
}

async function loadIskratelData() {
  const dn = props.reclamo?.Dn
  if (!dn) {
    iskratelLoading.value = false
    return
  }
  iskratelLoading.value = true
  iskratelData.value = []
  try {
    const searchKey = buildIskratelSearchKey(dn)
    if (searchKey) {
      const res = await iskratelApi.getByNumero(searchKey)
      iskratelData.value = res.data?.results || []
    }
  } catch {
    console.warn('No se pudo consultar central Iskratel')
  } finally {
    iskratelLoading.value = false
  }
}

function fillFacilities(data) {
  if (!data) return
  form.central = (data.Central || '').trim()
  const parts = []
  const central = (data.Central || '').trim()
  const bloq = (data.ParPriBloq || '').trim()
  const par = (data.ParPriPar || '').trim()
  if (central) parts.push(central)
  if (bloq) parts.push(bloq)
  if (par) parts.push(par)
  form.primaryPair = parts.join('-')
  form.secondaryPair = (data.ParSec || '').trim()
  form.cabinet = (data.Armario || '').trim()
  form.accessBox = (data.CajDis || '').trim()
}

async function loadFacilities() {
  if (!props.reclamo.Dn) return
  facilitiesLoading.value = true
  facilitiesNotFound.value = false
  try {
    const res = await api.get('/facilidades/dn/' + encodeURIComponent(props.reclamo.Dn))
    if (res.data) {
      fillFacilities(res.data)
    } else {
      facilitiesNotFound.value = true
    }
  } catch {
    facilitiesNotFound.value = true
  } finally {
    facilitiesLoading.value = false
  }
}

async function loadFaultTypes() {
  try {
    const res = await api.get('/tipos-falla')
    const types = (res.data || []).map(t => t.Nombre || t.nombre || t.TipoFalla).filter(Boolean)
    if (types.length) faultTypes.value = types
  } catch {}
}

watch(decision, (val) => {
  if (val === 'GeneradoBoleta') {
    form.centralTest = 'Si'
    loadFacilities()
  } else {
    form.centralTest = ''
  }
})

onMounted(() => {
  loadFaultTypes()
  loadIskratelData()
})

async function submit() {
  if (!resultado.value.trim()) {
    alert('Debe ingresar el resultado de la revision.')
    return
  }
  saving.value = true

  try {
    const reviewData = {
      Decision: decision.value,
      ResultadoRevision: resultado.value,
      TipoFalla: form.faultType,
      Prioridad: form.priority,
      Central: form.central,
      ParPriBloq: form.primaryPair ? form.primaryPair.split('-')[1] || '' : '',
      ParPriPar: form.primaryPair ? form.primaryPair.split('-')[2] || '' : '',
      ParPrimarioCompleto: form.primaryPair,
      ParSec: form.secondaryPair,
      Armario: form.cabinet,
      CajDis: form.accessBox,
      PruebaCentral: form.centralTest,
      Observaciones: form.observations
    }

    await reclamoStore.reviewReclamo(props.reclamo.IdReclamo, reviewData)
    alert(`Reclamo ${decision.value === 'CerradoCentral' ? 'cerrado (falla en central)' : 'derivado a boleta tecnica'} correctamente.`)
    emit('saved', decision.value)
  } catch (err) {
    alert('Error: ' + err.message)
  } finally {
    saving.value = false
  }
}
</script>
