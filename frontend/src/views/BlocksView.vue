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
import api from '../services/api'

const store = useBlockStore()

const dnSearch = ref('')
const dnLoading = ref(false)
const dnStatus = ref('')
const dnStatusType = ref('muted')
const highlightedDn = ref('')

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

async function searchDn() {
  const phone = dnSearch.value.trim()
  if (!phone) {
    dnStatus.value = 'Ingrese un número telefónico.'
    dnStatusType.value = 'error-text'
    return
  }
  dnLoading.value = true
  dnStatus.value = 'Buscando en MDF...'
  dnStatusType.value = 'muted'
  highlightedDn.value = ''
  try {
    const res = await api.get(`/facilidades/dn/${encodeURIComponent(phone)}`)
    if (!res.data) {
      dnStatus.value = 'ℹ️ No se encontró el número en MDF'
      dnStatusType.value = 'muted'
      return
    }
    const data = res.data
    store.central = store.normalizeCode(data.Central || '')
    store.block = store.normalizeCode(data.ParPriBloq || data.ParPriPar || '')
    store.error = ''
    store.message = ''
    dnStatus.value = `✅ ${data.Central}-${data.ParPriBloq} par ${data.ParPriPar} — cargando bloque...`
    await handleSearch()
    highlightedDn.value = phone
    dnStatus.value = `✅ ${data.Central}-${data.ParPriBloq} par ${data.ParPriPar} — encontrado`
    dnStatusType.value = 'success-text'
  } catch {
    dnStatus.value = '⚠️ Error al consultar MDF'
    dnStatusType.value = 'error-text'
  } finally {
    dnLoading.value = false
  }
}

async function reloadObservations() {
  await nextTick()
  window.dispatchEvent(new CustomEvent('reload-observations'))
}
</script>
