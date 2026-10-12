<template>
  <section class="panel">
    <div class="panel-head">
      <div>
        <h2>Registro Teliskratel</h2>
        <p class="muted">Suba los archivos .out de la central (teliskratel.out / teliskratel6.out) para consultarlos por número.</p>
      </div>
      <button type="button" class="secondary" style="font-size:12px" @click="loadAll" :disabled="loading">Recargar</button>
    </div>

    <div class="block-toolbar">
      <input ref="fileInput" type="file" multiple accept=".out,.txt" @change="onFilesSelected" />
      <button class="primary" :disabled="!selectedFiles.length || uploading" @click="upload">
        {{ uploading ? 'Importando...' : `Importar ${selectedFiles.length || ''} archivo(s)` }}
      </button>
      <button type="button" class="secondary" :disabled="importingData" @click="importarDesdeServidor">
        {{ importingData ? 'Importando...' : 'Importar desde servidor (data/)' }}
      </button>
    </div>

    <p v-if="message" class="success-text block-message">{{ message }}</p>
    <p v-if="error" class="error-text block-message">{{ error }}</p>

    <div v-if="archivosServidor.length" class="server-files">
      <strong>Archivos detectados en el servidor:</strong>
      <ul>
        <li v-for="a in archivosServidor" :key="a.archivo">
          {{ a.archivo }}
          <span v-if="a.existe" class="badge ok">{{ a.filas }} filas</span>
          <span v-else class="badge error">no existe</span>
        </li>
      </ul>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2>Importaciones ({{ importaciones.length }})</h2>
    </div>
    <div class="block-table-wrap" style="max-height:280px">
      <table class="block-table">
        <thead>
          <tr>
            <th>Fecha</th><th>Lote</th><th>Archivo</th><th>Formato</th>
            <th>Leídas</th><th>Insertadas</th><th>Duplicadas</th><th>Errores</th><th>Usuario</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="imp in importaciones" :key="imp.id">
            <td>{{ formatFecha(imp.fecha_import) }}</td>
            <td>{{ imp.lote_import }}</td>
            <td>{{ imp.origen_archivo }}</td>
            <td>{{ imp.tipo_formato }}</td>
            <td>{{ imp.filas_leidas }}</td>
            <td>{{ imp.insertados }}</td>
            <td>{{ imp.duplicados }}</td>
            <td>{{ imp.errores }}</td>
            <td>{{ imp.creado_por || '—' }}</td>
            <td>
              <button v-if="canManage" type="button" class="secondary" style="font-size:12px" @click="eliminar(imp.lote_import)">Eliminar</button>
            </td>
          </tr>
          <tr v-if="!importaciones.length">
            <td colspan="10" class="empty">No hay importaciones registradas.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2>Consulta de registros</h2>
    </div>
    <form class="block-toolbar" @submit.prevent="buscar">
      <input v-model="q" placeholder="Número, IP o DN" maxlength="30" />
      <select v-model="estado">
        <option value="">Todos</option>
        <option value="REGISTRADO">Registrado</option>
        <option value="NO_REGISTRADO">No registrado</option>
      </select>
      <button class="primary" :disabled="buscando">{{ buscando ? 'Buscando...' : 'Buscar' }}</button>
    </form>
    <div v-if="registros.length" class="block-table-wrap" style="max-height:420px">
      <table class="block-table">
        <thead>
          <tr>
            <th>DN</th><th>Estado</th><th>IP</th><th>Central</th><th>Puerto</th>
            <th>Abonado</th><th>Servicio compl.</th><th>Origen</th><th>Lote</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in registros" :key="r.id">
            <td>{{ r.directory_number || '—' }}</td>
            <td>
              <span class="badge" :class="r.estado_registro === 'REGISTRADO' ? 'ok' : (r.estado_registro ? 'error' : '')">
                {{ r.estado_registro || '—' }}
              </span>
            </td>
            <td>{{ r.ip_origen || '—' }}</td>
            <td>{{ r.central || '—' }}</td>
            <td>{{ r.puerto || '—' }}</td>
            <td>{{ r.subscriber_type || '—' }}</td>
            <td>{{ r.supplementary_service_set || '—' }}</td>
            <td>{{ r.origen_archivo || '—' }}</td>
            <td>{{ r.lote_import }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else-if="consultado" class="empty">Sin resultados.</p>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { teliskratelApi } from '../services/api'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const canManage = computed(() => auth.hasPermission('teliskratel') && auth.role === 'admin')

const fileInput = ref(null)
const selectedFiles = ref([])
const archivosServidor = ref([])
const importaciones = ref([])
const registros = ref([])
const q = ref('')
const estado = ref('')
const loading = ref(false)
const uploading = ref(false)
const importingData = ref(false)
const buscando = ref(false)
const consultado = ref(false)
const message = ref('')
const error = ref('')

function formatFecha(value) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('es-BO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/La_Paz'
    }).format(new Date(value))
  } catch { return '—' }
}

function onFilesSelected(event) {
  selectedFiles.value = Array.from(event.target.files || [])
}

async function loadArchivos() {
  try {
    const res = await teliskratelApi.archivos()
    archivosServidor.value = Array.isArray(res.data) ? res.data : []
  } catch { archivosServidor.value = [] }
}

async function loadImportaciones() {
  try {
    const res = await teliskratelApi.importaciones()
    importaciones.value = Array.isArray(res.data) ? res.data : []
  } catch { importaciones.value = [] }
}

async function loadAll() {
  loading.value = true
  await Promise.all([loadArchivos(), loadImportaciones()])
  loading.value = false
}

async function upload() {
  if (!selectedFiles.value.length) return
  uploading.value = true
  message.value = ''
  error.value = ''
  try {
    const fd = new FormData()
    for (const f of selectedFiles.value) fd.append('archivos', f)
    const res = await teliskratelApi.importar(fd)
    const partes = (res.data?.resultados || []).map(r => r.error ? `${r.archivo}: ${r.error}` : `${r.archivo}: ${r.insertados} insertadas`)
    message.value = partes.join(' | ')
    selectedFiles.value = []
    if (fileInput.value) fileInput.value.value = ''
    await loadAll()
  } catch (err) {
    error.value = err.message
  } finally {
    uploading.value = false
  }
}

async function importarDesdeServidor() {
  importingData.value = true
  message.value = ''
  error.value = ''
  try {
    const res = await teliskratelApi.importarData(['teliskratel.out', 'teliskratel6.out'])
    const partes = (res.data?.resultados || []).map(r => r.error ? `${r.archivo}: ${r.error}` : `${r.archivo}: ${r.insertados} insertadas`)
    message.value = partes.join(' | ')
    await loadAll()
  } catch (err) {
    error.value = err.message
  } finally {
    importingData.value = false
  }
}

async function eliminar(lote) {
  if (!window.confirm(`¿Eliminar la importación ${lote} y sus registros?`)) return
  try {
    await teliskratelApi.eliminarImportacion(lote)
    message.value = `Importación ${lote} eliminada.`
    await loadAll()
  } catch (err) {
    error.value = err.message
  }
}

async function buscar() {
  buscando.value = true
  error.value = ''
  try {
    const res = await teliskratelApi.list({ q: q.value || undefined, estado: estado.value || undefined, limit: 200 })
    registros.value = Array.isArray(res.data) ? res.data : []
    consultado.value = true
  } catch (err) {
    error.value = err.message
  } finally {
    buscando.value = false
  }
}

onMounted(() => {
  loadAll()
})
</script>

<style scoped>
.server-files {
  margin-top: 16px;
  font-size: 13px;
  color: var(--muted);
}
.server-files ul {
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
