<template>
  <section class="panel">
    <div class="panel-head">
      <div>
        <h2>Consulta central Iskratel</h2>
        <p class="muted">Busque por numero telefonico en los archivos {{ archivosInfo.map(a => a.archivo).join(', ') }}</p>
      </div>
      <div class="panel-tools">
        <span v-if="archivosInfo.length" class="badge" style="font-size:12px;margin-right:8px">
          {{ totalRegistros }} registros
        </span>
        <button class="secondary" @click="refresh">Recargar</button>
      </div>
    </div>

    <form class="block-toolbar" @submit.prevent="handleSearch">
      <input
        v-model="searchInput"
        placeholder="Buscar por numero telefonico"
        @input="onSearchInput"
      />
      <button class="primary" :disabled="loading">{{ loading ? 'Buscando...' : 'Buscar' }}</button>
      <button type="button" class="secondary" @click="clearSearch">Limpiar</button>
    </form>

    <p v-if="error" class="error-text block-message">{{ error }}</p>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2>{{ results.length }} resultado{{ results.length !== 1 ? 's' : '' }}</h2>
      <div class="panel-tools">
        <select v-model="filterArchivo" class="table-filter" @change="applyFilter">
          <option value="">Todos los archivos</option>
          <option v-for="a in archivosInfo" :key="a.archivo" :value="a.archivo">{{ a.archivo }}</option>
        </select>
      </div>
    </div>

    <div v-if="results.length" style="display:flex;flex-direction:column;gap:8px;padding:12px">
      <div
        v-for="(row, i) in results"
        :key="i"
        style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--bg);box-shadow:var(--shadow)"
      >
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong style="font-size:15px">{{ row['Directory Number'] || '—' }}</strong>
          <code class="badge" style="font-size:11px">{{ row._archivo }}</code>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;font-size:13px">
          <span v-if="row['Registration Status']"><strong style="color:var(--text)">Estado:</strong> {{ row['Registration Status'] }}</span>
          <span v-if="row['Basic Service']"><strong style="color:var(--text)">Servicio base:</strong> {{ row['Basic Service'] }}</span>
          <span v-if="row['Interface / Access']"><strong style="color:var(--text)">Interface / Acceso:</strong> {{ row['Interface / Access'] }}</span>
          <span><strong style="color:var(--text)">Tipo suscriptor:</strong> {{ row['Subscriber Type'] || '—' }}</span>
          <span><strong style="color:var(--text)">Serv. suplementario:</strong> {{ row['Supplementary Service Set'] || '—' }}</span>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="empty" style="padding:40px 0;text-align:center">
      <p v-if="searched">No se encontraron resultados para esa busqueda.</p>
      <p v-else>Ingrese un numero telefonico para buscar en los archivos Iskratel.</p>
    </div>
  </section>

  <section class="panel" v-if="archivosInfo.length">
    <div class="panel-head">
      <h2>Archivos cargados</h2>
    </div>
    <div class="table">
      <div class="table-header">
        <span>Archivo</span>
        <span>Registros</span>
        <span>Columnas</span>
      </div>
      <div v-for="a in archivosInfo" :key="a.archivo" class="table-row" style="cursor:default">
        <span><code>{{ a.archivo }}</code></span>
        <span>{{ a.registros }}</span>
        <span style="font-size:12px;color:var(--muted)">{{ a.columnas.join(', ') }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { iskratelApi } from '../services/api'

const searchInput = ref('')
const loading = ref(false)
const error = ref('')
const searched = ref(false)
const filterArchivo = ref('')
const allResults = ref([])
const archivosInfo = ref([])
const selected = ref(null)

const results = ref([])

const totalRegistros = ref(0)

function applyFilter() {
  if (!filterArchivo.value) {
    results.value = allResults.value
  } else {
    results.value = allResults.value.filter(r => r._archivo === filterArchivo.value)
  }
}

let searchTimer = null
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (searchInput.value.length >= 3) {
      handleSearch()
    }
  }, 400)
}

async function handleSearch() {
  const q = searchInput.value.trim()
  if (!q) {
    clearSearch()
    return
  }

  loading.value = true
  error.value = ''
  searched.value = true

  try {
    const res = await iskratelApi.getByNumero(q)
    const data = res.data
    allResults.value = data.results || []
    results.value = [...allResults.value]
    applyFilter()
  } catch (err) {
    error.value = err.message || 'Error al buscar en archivos Iskratel'
    allResults.value = []
    results.value = []
  } finally {
    loading.value = false
  }
}

function clearSearch() {
  searchInput.value = ''
  searched.value = false
  allResults.value = []
  results.value = []
  filterArchivo.value = ''
  error.value = ''
}

function selectRow(row) {
  selected.value = row
}

async function loadArchivos() {
  try {
    const res = await iskratelApi.getArchivos()
    archivosInfo.value = res.data
    totalRegistros.value = res.data.reduce((sum, a) => sum + (a.registros || 0), 0)
  } catch (err) {
    console.error('Error al cargar info de archivos Iskratel:', err)
  }
}

async function refresh() {
  await Promise.all([loadArchivos(), clearSearch()])
}

onMounted(() => {
  loadArchivos()
})
</script>
