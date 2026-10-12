<template>
  <section class="panel">
    <div class="panel-head">
      <div>
        <h2>Consulta de bloque primario</h2>
        <p class="muted">Digite la central y el campo ParPriBloq para desplegar y actualizar sus 100 pares.</p>
      </div>
      <button type="button" class="secondary" style="font-size:12px" @click="reloadObservations">Recargar observaciones</button>
    </div>

    <form class="block-toolbar" @submit.prevent="handleSearch">
      <input :value="store.central" @input="store.central = store.normalizeCode($event.target.value)" placeholder="Central" maxlength="50" />
      <input :value="store.block" @input="store.block = store.normalizeCode($event.target.value)" placeholder="Ejemplo: A4, 17, B03" maxlength="10" />
      <button class="primary" :disabled="store.loading">{{ store.loading ? 'Consultando...' : 'Buscar bloque' }}</button>
      <button type="button" class="secondary" @click="createBlank">Crear 100 pares</button>
    </form>

    <p v-if="store.error" class="error-text block-message">{{ store.error }}</p>
    <p v-if="store.message" class="success-text block-message">{{ store.message }}</p>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2>Buscar por teléfono</h2>
    </div>
    <form class="block-toolbar" @submit.prevent="searchDn">
      <input v-model="dnSearch" placeholder="Número telefónico" maxlength="20" />
      <button class="primary" :disabled="dnLoading">{{ dnLoading ? 'Buscando...' : 'Buscar' }}</button>
    </form>
    <p v-if="dnStatus" :class="dnStatusType">{{ dnStatus }}</p>
  </section>

  <section v-if="combinedLoaded" class="panel">
    <div class="panel-head">
      <h2>Resultados (últimos 5 dígitos: {{ combinedUlt5 }})</h2>
    </div>

    <h3 class="result-sub">MDF ({{ combinedMdf.length }})</h3>
    <div v-if="combinedMdf.length" class="block-table-wrap" style="max-height:320px">
      <table class="block-table">
        <thead>
          <tr>
            <th>Dn</th><th>Central</th><th>ParPriBloq</th><th>ParPriPar</th>
            <th>ParSec</th><th style="min-width:160px">Obs</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in combinedMdf" :key="row.ID">
            <td>{{ row.Dn }}</td>
            <td>{{ row.Central || '—' }}</td>
            <td>{{ row.ParPriBloq || '—' }}</td>
            <td>{{ row.ParPriPar || '—' }}</td>
            <td>{{ row.ParSec || '—' }}</td>
            <td>{{ row.Obs || '—' }}</td>
            <td><button type="button" class="secondary" style="font-size:12px" @click="loadMdfBlock(row)">Ver bloque</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="muted">Sin coincidencias en MDF.</p>

    <h3 class="result-sub">Teliskratel ({{ combinedTeliskratel.length }})</h3>
    <div v-if="combinedTeliskratel.length" class="block-table-wrap" style="max-height:320px">
      <table class="block-table">
        <thead>
          <tr>
            <th>DN</th><th>Estado</th><th>IP</th><th>Central</th><th>Puerto</th>
            <th>Abonado</th><th>Servicio compl.</th><th>Origen</th><th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in combinedTeliskratel" :key="row.id">
            <td>{{ row.directory_number || '—' }}</td>
            <td>
              <span class="badge" :class="row.estado_registro === 'REGISTRADO' ? 'ok' : 'error'">
                {{ row.estado_registro || '—' }}
              </span>
            </td>
            <td>{{ row.ip_origen || '—' }}</td>
            <td>{{ row.central || '—' }}</td>
            <td>{{ row.puerto || '—' }}</td>
            <td>{{ row.subscriber_type || '—' }}</td>
            <td>{{ row.supplementary_service_set || '—' }}</td>
            <td>{{ row.origen_archivo || '—' }}</td>
            <td>{{ formatFecha(row.fecha_import) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="muted">Sin coincidencias en Teliskratel.</p>
  </section>

  <section class="panel block-panel">
    <div class="panel-head">
      <h2>{{ rowsLabel }}</h2>
      <button class="primary" :disabled="!store.rows.length || store.saving" @click="handleSave">
        {{ store.saving ? 'Guardando...' : 'Guardar cambios' }}
      </button>
    </div>
    <BlockTable v-if="store.rows.length" :rows="store.rows" :highlightedDn="highlightedDn" />
    <p v-else class="empty">Busque una central y un bloque para ver los pares. Si aun no existe, use Crear 100 pares.</p>
  </section>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { useBlockStore } from '../stores/blocks'
import BlockTable from '../components/BlockTable.vue'
import { lookupDnCombinado } from '../services/api'

const store = useBlockStore()

const dnSearch = ref('')
const dnLoading = ref(false)
const dnStatus = ref('')
const dnStatusType = ref('muted')
const highlightedDn = ref('')

const combinedLoaded = ref(false)
const combinedMdf = ref([])
const combinedTeliskratel = ref([])
const combinedUlt5 = ref('')

const rowsLabel = computed(() => {
  if (!store.rows.length) return 'Pares del bloque'
  return `${store.rows.length} pares de ${store.central}-${store.block}`
})

async function handleSearch() {
  const central = store.normalizeCode(store.central)
  const block = store.normalizeCode(store.block)
  store.central = central
  store.block = block
  if (!central || !block) {
    store.error = 'Digite la central y el bloque primario que desea consultar.'
    return
  }
  return store.fetchBlock(central, block)
}

function createBlank() {
  const central = store.normalizeCode(store.central)
  const block = store.normalizeCode(store.block)
  store.central = central
  store.block = block
  if (!central || !block) {
    store.error = 'Digite la central y el bloque primario antes de crear los 100 pares.'
    return
  }
  store.rows = store.generateRows(central, block)
  store.message = 'Se crearon 100 pares vacios para captura.'
  store.error = ''
}

function handleSave() {
  store.saveBlock()
}

function formatFecha(value) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('es-BO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/La_Paz'
    }).format(new Date(value))
  } catch { return '—' }
}

async function searchDn() {
  const phone = dnSearch.value.trim()
  if (!phone) {
    dnStatus.value = 'Ingrese un número telefónico.'
    dnStatusType.value = 'error-text'
    return
  }
  dnLoading.value = true
  dnStatus.value = 'Buscando en MDF y Teliskratel...'
  dnStatusType.value = 'muted'
  highlightedDn.value = ''
  combinedLoaded.value = false
  try {
    const res = await lookupDnCombinado(phone)
    const mdf = res.data?.mdf || []
    const teliskratel = res.data?.teliskratel || []
    combinedMdf.value = mdf
    combinedTeliskratel.value = teliskratel
    combinedUlt5.value = res.data?.ultimos5 || phone.replace(/\D/g, '').slice(-5)
    combinedLoaded.value = true

    if (mdf.length) {
      await loadMdfBlock(mdf[0], phone)
      dnStatus.value = `✅ MDF: ${mdf.length} coincidencia(s) — Teliskratel: ${teliskratel.length}`
      dnStatusType.value = 'success-text'
    } else if (teliskratel.length) {
      dnStatus.value = `ℹ️ Sin coincidencias en MDF — Teliskratel: ${teliskratel.length}`
      dnStatusType.value = 'muted'
    } else {
      dnStatus.value = 'ℹ️ No se encontró el número en MDF ni en Teliskratel'
      dnStatusType.value = 'muted'
    }
  } catch {
    dnStatus.value = '⚠️ Error al consultar MDF/Teliskratel'
    dnStatusType.value = 'error-text'
  } finally {
    dnLoading.value = false
  }
}

async function loadMdfBlock(row, phone) {
  store.central = store.normalizeCode(row.Central || '')
  store.block = store.normalizeCode(row.ParPriBloq || row.ParPriPar || '')
  store.error = ''
  store.message = ''
  if (!store.central || !store.block) {
    dnStatus.value = 'ℹ️ El registro MDF no tiene central/bloque definidos.'
    dnStatusType.value = 'muted'
    return
  }
  await handleSearch()
  highlightedDn.value = phone || row.Dn || ''
}

async function reloadObservations() {
  await nextTick()
  window.dispatchEvent(new CustomEvent('reload-observations'))
}
</script>
