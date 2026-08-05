<template>
  <div>
    <div v-if="globalSuccess" class="alert-success"><i class="bi bi-check-circle-fill"></i> {{ globalSuccess }}</div>
    <div v-if="globalWarning" class="alert-warning"><i class="bi bi-exclamation-triangle-fill"></i> {{ globalWarning }}</div>
    <div v-if="globalError" class="alert-error"><i class="bi bi-exclamation-triangle-fill"></i> {{ globalError }}</div>

    <section class="metrics metrics-sm">
      <article class="metric metric-row">
        <i class="bi bi-clipboard-data metric-icon"></i>
        <div class="metric-body">
          <span>Total Trabajos</span>
          <strong>{{ stats.totalTrabajos }}</strong>
          <small>Registrados</small>
        </div>
      </article>
      <article class="metric metric-row">
        <i class="bi bi-calendar-range metric-icon"></i>
        <div class="metric-body">
          <span>Esta Semana</span>
          <strong>{{ stats.trabajosSemana }}</strong>
          <small>Últimos 7 días</small>
        </div>
      </article>
      <article class="metric metric-row">
        <i class="bi bi-calendar-check metric-icon"></i>
        <div class="metric-body">
          <span>Trabajos Hoy</span>
          <strong>{{ stats.trabajosHoy }}</strong>
          <small>{{ new Date().toLocaleDateString('es-BO', { day: 'numeric', month: 'short' }) }}</small>
        </div>
      </article>
    </section>

    <div class="panel" style="margin-bottom:1rem;">
      <div class="filters" style="flex-wrap:wrap;">
        <input v-model="searchQuery" type="text" placeholder="Buscar por Formulario, Teléfono, Abonado..." @input="onSearchInput" style="flex:1;min-width:180px;" />
        <button class="primary" @click="openAdd"><i class="bi bi-plus-lg"></i> Nuevo Trabajo</button>
        <button class="ghost" @click="showFilters = !showFilters"><i class="bi bi-funnel"></i> Filtros</button>
        <button class="secondary" @click="exportCSV" :disabled="trabajos.length === 0"><i class="bi bi-file-earmark-spreadsheet"></i> CSV</button>
        <button class="ghost" @click="printReport" :disabled="trabajos.length === 0"><i class="bi bi-printer"></i> Imprimir</button>
      </div>

      <div v-if="showFilters" class="filters" style="margin-top:0.75rem;flex-wrap:wrap;">
        <input v-model="filters.fecha" type="date" style="max-width:160px;" @change="onFilterChange" />
        <input v-model="filters.mes" type="month" style="max-width:160px;" @change="onFilterChange" />
        <input v-model="filters.anio" type="number" placeholder="Año" style="max-width:100px;" @input="onFilterChange" />
        <select v-model="filters.tipo_trabajo" style="max-width:180px;" @change="onFilterChange">
          <option value="">— Tipo Trabajo —</option>
          <option v-for="t in tipoTrabajoOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </div>
    </div>

    <div class="panel">
      <div v-if="loading" style="text-align:center;padding:3rem;color:var(--muted);">
        <i class="bi bi-arrow-clockwise animate-spin" style="font-size:1.5rem;"></i>
        <p style="margin-top:0.5rem;">Cargando...</p>
      </div>
      <div v-else>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
          <span style="color:var(--muted);font-size:0.9rem;">
            <strong style="color:var(--ink);">{{ totalItems }}</strong> registros encontrados
          </span>
        </div>
        <div class="table-wrapper">
          <table class="registro-table">
            <thead>
              <tr>
                <th style="width:100px;">Formulario</th>
                <th style="width:120px;">Teléfono</th>
                <th>Abonado</th>
                <th>Dirección</th>
                <th style="width:160px;">Tipo Trabajo</th>
                <th>Fecha</th>
                <th>Hora</th>
                <th style="width:85px;">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="job in trabajos" :key="job.id">
                <td class="cell-formulario">{{ job.formulario || '—' }}</td>
                <td class="cell-telefono">{{ job.numero_telefono }}</td>
                <td class="cell-abonado" :title="job.nombre_abonado">{{ job.nombre_abonado || 'N/A' }}</td>
                <td class="cell-dir" :title="job.direccion">{{ job.direccion || 'N/A' }}</td>
                <td class="cell-tipo"><div class="badge-group"><span v-for="t in formatTypes(job.tipo_trabajo)" :key="t" class="badge">{{ t }}</span></div></td>
                <td class="cell-fecha">{{ formatDate(job.fecha) }}</td>
                <td class="cell-hora">{{ formatTime(job.hora) }}</td>
                <td>
                  <div style="display:flex;gap:4px;">
                    <button @click="openEdit(job)" class="icon-button" style="width:32px;height:32px;" title="Editar"><i class="bi bi-pencil"></i></button>
                    <button @click="confirmDelete(job)" class="icon-button" style="width:32px;height:32px;color:var(--danger);" title="Eliminar"><i class="bi bi-trash"></i></button>
                  </div>
                </td>
              </tr>
              <tr v-if="trabajos.length === 0">
                <td colspan="8" style="text-align:center;color:var(--dimmed);padding:2rem;">No se encontraron trabajos.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="totalPages > 1" class="pagination-bar">
          <span style="color:var(--muted);font-size:0.85rem;">Pág. <strong>{{ currentPage }}</strong> de <strong>{{ totalPages }}</strong></span>
          <div style="display:flex;gap:8px;">
            <button @click="fetchTrabajos(currentPage-1)" class="ghost" :disabled="currentPage===1||loading"><i class="bi bi-chevron-left"></i> Anterior</button>
            <button @click="fetchTrabajos(currentPage+1)" class="ghost" :disabled="currentPage===totalPages||loading">Siguiente <i class="bi bi-chevron-right"></i></button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal" style="max-width:640px;">
        <div class="modal-head">
          <h3 style="margin:0;display:flex;align-items:center;gap:8px;font-size:1.1rem;">
            <i class="bi" :class="isEditing ? 'bi-pencil-square' : 'bi-plus-circle'"></i>
            {{ isEditing ? 'Editar Trabajo' : 'Nuevo Trabajo' }}
          </h3>
          <button @click="closeModal" class="icon-button" style="width:36px;height:36px;">&times;</button>
        </div>
        <div v-if="modalError" class="alert-error" style="margin:1rem;"><i class="bi bi-exclamation-triangle-fill"></i> {{ modalError }}</div>
        <form @submit.prevent="submitModal" style="padding:1.5rem;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
            <div class="field">
              <span>ID Formulario <span class="text-muted">(opcional si hay autorización)</span></span>
              <input v-model="modalForm.formulario" type="text" @blur="!isEditing && checkFormulario()" />
              <div v-if="!isEditing && formIdStatus" :class="['text-xs', formIdExists ? 'text-warn' : 'text-success']" style="margin-top:4px;">
                <i :class="['bi', formIdExists ? 'bi-exclamation-triangle' : 'bi-check-circle']"></i> {{ formIdExists ? '⚠️ Ya existe — puede guardar si es intencional' : formIdStatus }}
              </div>
            </div>
            <div class="field">
              <span>Teléfono</span>
              <div style="display:flex;gap:6px;">
                <input v-model="modalForm.numero_telefono" type="text" required style="flex:1;" />
                <button type="button" class="secondary" style="white-space:nowrap;min-height:42px;" @click="fetchAbonadoInfo"><i class="bi bi-search"></i> Buscar</button>
              </div>
              <div v-if="abonadoStatus" class="text-xs" style="margin-top:4px;color:var(--ok);">
                <i class="bi bi-check-circle"></i> {{ abonadoStatus }}
              </div>
            </div>
            <div class="field"><span>Abonado</span><input v-model="modalForm.nombre_abonado" type="text" required /></div>
            <div class="field"><span>Dirección</span><input v-model="modalForm.direccion" type="text" /></div>
            <div class="field" style="grid-column:span 2;position:relative;">
              <span>Autorizado por (Nombre completo)</span>
              <div class="autocomplete-wrap">
                <input v-model="modalForm.autorizado_nombre" type="text" placeholder="Ej: OMA, Luisa Chumacero" @input="onAutorizadoInput" @keydown="onAutorizadoKeydown" @blur="onAutorizadoBlur" @focus="onAutorizadoFocus" />
                <ul v-if="showAutorizadoSuggestions && autorizadoSuggestions.length > 0" class="autocomplete-list">
                  <li v-for="(s, i) in autorizadoSuggestions" :key="i" :class="{ active: autorizadoHighlightIndex === i }" @mousedown.prevent="selectAutorizadoSuggestion(s)" @mouseenter="autorizadoHighlightIndex = i">
                    {{ s }}
                  </li>
                </ul>
              </div>
            </div>
            <div class="field" style="grid-column:span 2;"><span>Observaciones</span><input v-model="modalForm.observaciones" type="text" /></div>
          </div>
          <div v-if="!modalForm.formulario && !modalForm.autorizado_nombre" class="text-xs" style="color:var(--warn);margin-top:4px;">
            <i class="bi bi-info-circle"></i> Si no ingresa Formulario, debe especificar quién autoriza
          </div>
          <div class="field" style="margin-top:1rem;">
            <span>Tipo de Trabajo (Ctrl+Click para múltiples)</span>
            <select v-model="modalForm.tipo_trabajo" multiple required>
              <option v-for="t in tipoTrabajoOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </div>
          <div class="modal-actions" style="margin-top:1.5rem;padding:0;">
            <button type="button" @click="closeModal" class="ghost">Cancelar</button>
            <button type="submit" class="primary" :disabled="modalSubmitting">
              <span v-if="modalSubmitting"><i class="bi bi-arrow-clockwise animate-spin"></i> Guardando...</span>
              <span v-else><i class="bi bi-check-lg"></i> {{ isEditing ? 'Guardar Cambios' : 'Registrar Trabajo' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="showDeleteConfirm" class="modal-backdrop" @click.self="showDeleteConfirm = false">
      <div class="modal" style="max-width:400px;text-align:center;">
        <div class="modal-head" style="justify-content:center;">
          <h3 style="margin:0;color:var(--danger);"><i class="bi bi-exclamation-triangle-fill"></i> ¿Eliminar trabajo?</h3>
        </div>
        <div style="padding:1.5rem;">
          <p style="color:var(--muted);margin:0 0 1.5rem;">
            Formulario: <strong>{{ deleteTarget?.formulario }}</strong><br/>
            Abonado: {{ deleteTarget?.nombre_abonado }}<br/>
            Esta acción no se puede deshacer.
          </p>
          <div class="modal-actions" style="padding:0;justify-content:center;">
            <button @click="showDeleteConfirm=false" class="ghost">Cancelar</button>
            <button @click="doDelete" class="primary" style="background:var(--danger);color:white;box-shadow:none;" :disabled="deleteSubmitting">
              <span v-if="deleteSubmitting"><i class="bi bi-arrow-clockwise animate-spin"></i> Eliminando...</span>
              <span v-else><i class="bi bi-trash"></i> Eliminar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'

const tipoTrabajoOptions = [
  { value: 'regularizacion', label: 'Regularización' },
  { value: 'retiro_linea_socio', label: 'Retiro de Línea Socio' },
  { value: 'retiro_gem_trill_alq', label: 'Retiro Gem. Trill. o Alq.' },
  { value: 'servicios_agregados', label: 'Servicios Agregados' },
  { value: 'retiro_servicios_agregados', label: 'Retiro de Servicios Agregados' },
  { value: 'habilitacion_larga_distancia', label: 'Habilitación Larga Distancia' },
  { value: 'en_custodia', label: 'Custodia' },
  { value: 'restringido', label: 'Restringido' }
]

const globalSuccess = ref('')
const globalWarning = ref('')
const globalError = ref('')

const searchQuery = ref('')
const showFilters = ref(false)
const filters = ref({ fecha: '', mes: '', anio: '', tipo_trabajo: '' })

const stats = ref({ totalTrabajos: 0, trabajosHoy: 0, trabajosSemana: 0 })

const trabajos = ref([])
const loading = ref(true)
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const itemsPerPage = 10

let debounceTimer = null
let autorizadoDebounce = null
const autorizadoSuggestions = ref([])
const showAutorizadoSuggestions = ref(false)
const autorizadoHighlightIndex = ref(-1)

async function fetchAutorizadoSuggestions(q) {
  if (!q.trim()) { autorizadoSuggestions.value = []; showAutorizadoSuggestions.value = false; return }
  try {
    const res = await api.get('/trabajos/autocomplete-autorizado', { params: { q } })
    autorizadoSuggestions.value = res.data || []
    showAutorizadoSuggestions.value = autorizadoSuggestions.value.length > 0
    autorizadoHighlightIndex.value = -1
  } catch { autorizadoSuggestions.value = []; showAutorizadoSuggestions.value = false }
}

function onAutorizadoInput() {
  clearTimeout(autorizadoDebounce)
  autorizadoDebounce = setTimeout(() => fetchAutorizadoSuggestions(modalForm.value.autorizado_nombre), 200)
}

function onAutorizadoKeydown(e) {
  if (!showAutorizadoSuggestions.value || autorizadoSuggestions.value.length === 0) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    autorizadoHighlightIndex.value = Math.min(autorizadoHighlightIndex.value + 1, autorizadoSuggestions.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    autorizadoHighlightIndex.value = Math.max(autorizadoHighlightIndex.value - 1, 0)
  } else if (e.key === 'Enter' && autorizadoHighlightIndex.value >= 0) {
    e.preventDefault()
    selectAutorizadoSuggestion(autorizadoSuggestions.value[autorizadoHighlightIndex.value])
  } else if (e.key === 'Escape') {
    showAutorizadoSuggestions.value = false
  }
}

function selectAutorizadoSuggestion(val) {
  modalForm.value.autorizado_nombre = val
  showAutorizadoSuggestions.value = false
  autorizadoSuggestions.value = []
}

function onAutorizadoBlur() {
  setTimeout(() => { showAutorizadoSuggestions.value = false }, 150)
}

function onAutorizadoFocus() {
  if (autorizadoSuggestions.value.length > 0) {
    showAutorizadoSuggestions.value = true
  }
}

function formatAutorizado(job) {
  if (job.personal) return job.personal
  const n = (job.autorizado_nombre || '').trim()
  const a = (job.autorizado_apellido || '').trim()
  return n || a ? `${n} ${a}` : '—'
}
function formatTypes(typesStr) {
  if (!typesStr) return []
  return typesStr.split(',').map(t => t.trim().replace(/_/g, ' '))
}
function formatDate(dateStr) {
  if (!dateStr) return ''
  const clean = dateStr.split('T')[0]
  const parts = clean.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return clean
}
function formatTime(val) {
  if (!val) return ''
  const str = String(val)
  if (/^\d{2}:\d{2}/.test(str)) return str.substring(0, 5)
  const m = str.match(/(\d{2}:\d{2})/)
  return m ? m[1] : ''
}
function onSearchInput() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => fetchTrabajos(1), 400)
}
function onFilterChange() { fetchTrabajos(1) }

async function fetchStats() {
  try {
    const res = await api.get('/reportes-trabajos/stats')
    stats.value = res.data
  } catch {}
}

async function fetchTrabajos(page = 1) {
  loading.value = true; currentPage.value = page
  try {
    const params = {
      page, limit: itemsPerPage, search: searchQuery.value.trim(),
      fecha: filters.value.fecha, mes: filters.value.mes, anio: filters.value.anio,
      tipo_trabajo: filters.value.tipo_trabajo
    }
    const res = await api.get('/trabajos', { params })
    trabajos.value = res.data.data || []; totalPages.value = res.data.totalPages || 1; totalItems.value = res.data.total || 0
  } catch (err) { console.error(err) } finally { loading.value = false }
}

function exportCSV() {
  const headers = ['Formulario', 'Teléfono', 'Abonado', 'Dirección', 'Tipo Trabajo', 'Fecha', 'Hora']
  const rows = trabajos.value.map(j => [j.formulario || '', j.numero_telefono, j.nombre_abonado, j.direccion, formatTypes(j.tipo_trabajo).join(', '), j.fecha, formatTime(j.hora)].map(v => `"${(v||'').replace(/"/g,'""')}"`))
  const csv = '\uFEFF' + [headers.join(','), ...rows.join('\r\n')].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  a.download = 'trabajos-cotap.csv'; a.click()
}
function printReport() { window.print() }

const showModal = ref(false)
const isEditing = ref(false)
const modalSubmitting = ref(false)
const modalError = ref('')
const formIdStatus = ref('')
const formIdExists = ref(false)
const abonadoStatus = ref('')
const modalForm = ref({ id: null, formulario: '', numero_telefono: '', nombre_abonado: '', direccion: '', tipo_trabajo: [], observaciones: '', autorizado_nombre: '' })

function resetModalForm() {
  modalForm.value = { id: null, formulario: '', numero_telefono: '', nombre_abonado: '', direccion: '', tipo_trabajo: [], observaciones: '', autorizado_nombre: '' }
  formIdStatus.value = ''; formIdExists.value = false; abonadoStatus.value = ''; modalError.value = ''
}

function openAdd() {
  isEditing.value = false; resetModalForm(); showModal.value = true
}

function openEdit(job) {
  isEditing.value = true; modalError.value = ''
  modalForm.value = {
    id: job.id, formulario: job.formulario || '', numero_telefono: job.numero_telefono,
    nombre_abonado: job.nombre_abonado, direccion: job.direccion || '',
    tipo_trabajo: job.tipo_trabajo ? job.tipo_trabajo.split(',').map(t => t.trim()) : [],
    observaciones: job.observaciones || '',
    autorizado_nombre: job.personal || job.autorizado_nombre || '',
    autorizado_apellido: ''
  }
  formIdStatus.value = ''; formIdExists.value = false; abonadoStatus.value = ''
  showModal.value = true
}

function closeModal() { showModal.value = false; resetModalForm() }

async function checkFormulario() {
  const val = modalForm.value.formulario.trim()
  if (!val) { formIdStatus.value = ''; formIdExists.value = false; return }
  try {
    const res = await api.get('/trabajos/verificar-formulario', { params: { formulario: val } })
    formIdExists.value = res.data.exists
    formIdStatus.value = res.data.exists ? '⚠️ Ya existe' : '✅ Disponible'
  } catch (err) { console.error(err) }
}

async function fetchAbonadoInfo() {
  const phone = modalForm.value.numero_telefono.trim()
  if (!phone) { abonadoStatus.value = ''; return }
  abonadoStatus.value = 'Consultando ERP...'
  try {
    const res = await api.get(`/erp/personas/${encodeURIComponent(phone)}`)
    const source = Array.isArray(res.data) ? res.data[0] : res.data
    if (source && typeof source === 'object') {
      const name = source.nombreCompleto || source.NombreCompleto || source.nombre || source.Nombre || source.razonSocial || ''
      const addr = source.direccion || source.Direccion || source.domicilio || source.Domicilio || ''
      if (name) {
        modalForm.value.nombre_abonado = name
        modalForm.value.direccion = addr
        abonadoStatus.value = '✅ Datos cargados desde ERP'
        return
      }
    }
    abonadoStatus.value = '⚠️ No se encontraron datos en ERP'
  } catch {
    abonadoStatus.value = '⚠️ Error al consultar ERP'
  }
}

async function submitModal() {
  modalError.value = ''; modalSubmitting.value = true
  try {
    if (modalForm.value.tipo_trabajo.length === 0) throw new Error('Selecciona al menos un Tipo de Trabajo')
    const f = modalForm.value.formulario.trim()
    const an = modalForm.value.autorizado_nombre.trim()
    if (!f && !an) throw new Error('Si no ingresa Formulario, debe especificar quién autoriza')
    const payload = { ...modalForm.value, id: undefined, formulario: f || '', autorizado_nombre: an || '', autorizado_apellido: '', personal: an || '', tipo_trabajo: modalForm.value.tipo_trabajo.join(',') }

    if (isEditing.value) {
      const res = await api.put(`/trabajos/${modalForm.value.id}`, payload)
      globalSuccess.value = 'Trabajo actualizado correctamente'
      if (res.data.warning) {
        setTimeout(() => globalWarning.value = res.data.warning, 100)
      }
    } else {
      const res = await api.post('/trabajos', payload)
      globalSuccess.value = `Trabajo ${res.data.formulario} registrado correctamente`
      if (res.data.warning) {
        setTimeout(() => globalWarning.value = res.data.warning, 100)
      }
    }
    closeModal()
    fetchTrabajos(currentPage.value)
    setTimeout(() => { globalSuccess.value = ''; globalWarning.value = '' }, 5000)
  } catch (err) {
    modalError.value = err.message
    setTimeout(() => modalError.value = '', 5000)
  } finally { modalSubmitting.value = false }
}

const showDeleteConfirm = ref(false)
const deleteTarget = ref(null)
const deleteSubmitting = ref(false)

function confirmDelete(job) { deleteTarget.value = job; showDeleteConfirm.value = true }

async function doDelete() {
  deleteSubmitting.value = true
  try {
    await api.delete(`/trabajos/${deleteTarget.value.id}`)
    showDeleteConfirm.value = false; deleteTarget.value = null
    globalSuccess.value = 'Trabajo eliminado correctamente'
    fetchTrabajos(currentPage.value)
    setTimeout(() => globalSuccess.value = '', 4000)
  } catch (err) {
    globalError.value = err.message
    setTimeout(() => globalError.value = '', 5000)
  } finally { deleteSubmitting.value = false }
}

onMounted(() => {
  fetchTrabajos()
  fetchStats()
})
</script>

<style scoped>
.animate-spin { display: inline-block; animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.table-wrapper { overflow-x: auto; }

.registro-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.registro-table thead th {
  text-align: left;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
  background: var(--table-header-bg);
  white-space: nowrap;
}

.registro-table tbody td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--ink);
  vertical-align: middle;
}

.registro-table tbody tr:hover {
  background: var(--ticket-row-hover);
}

.cell-formulario { font-weight: 700; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-telefono { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-abonado { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-dir { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--muted); }
.cell-fecha { font-size: 13px; white-space: nowrap; }
.cell-hora { font-size: 13px; color: var(--muted); white-space: nowrap; }
.cell-op { font-size: 13px; }
.cell-tipo { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.metrics-sm {
  grid-template-columns: repeat(3, 1fr) !important;
  gap: 14px !important;
  margin-bottom: 1rem !important;
}
.metrics-sm .metric {
  min-height: 60px !important;
  padding: 14px 18px !important;
  border-radius: 10px !important;
}
.metrics-sm .metric::before { width: 3px !important; }
.metrics-sm .metric span {
  font-size: 12px !important;
  letter-spacing: 0.3px !important;
}
.metrics-sm .metric strong {
  font-size: 28px !important;
  margin: 4px 0 !important;
}
.metrics-sm .metric small {
  font-size: 12px !important;
}
.metric-row {
  flex-direction: row !important;
  align-items: center !important;
  gap: 14px !important;
}
.metric-row .metric-icon {
  position: static !important;
  font-size: 32px !important;
  color: var(--accent);
  opacity: 0.85;
}
.metric-row .metric-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.metric-row .metric-body span {
  text-transform: none !important;
  letter-spacing: 0 !important;
}

.badge-group { display: flex; flex-wrap: wrap; gap: 3px; }
.badge { 
  display: inline-block; padding: 2px 6px; border-radius: 4px; 
  font-size: 11px; font-weight: 600; background: rgba(6,182,212,0.1); color: var(--accent);
}
.badge-warn { background: rgba(245,158,11,0.1); color: var(--warn); }

.pagination-bar {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);
}

.alert-success, .alert-warning, .alert-error {
  padding: 12px 16px; border-radius: 10px; margin-bottom: 1rem;
  font-size: 14px; display: flex; align-items: center; gap: 8px;
}
.alert-success { background: rgba(16,185,129,0.1); color: var(--ok); border: 1px solid rgba(16,185,129,0.2); }
.alert-warning { background: rgba(245,158,11,0.1); color: var(--warn); border: 1px solid rgba(245,158,11,0.2); }
.alert-error { background: rgba(244,63,94,0.1); color: var(--danger); border: 1px solid rgba(244,63,94,0.2); }

.text-xs { font-size: 11px; }
.text-success { color: var(--ok); }
.text-warn { color: var(--warn); }
.text-danger { color: var(--danger); }

.autocomplete-wrap { position: relative; }
.autocomplete-list {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 100;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; max-height: 200px; overflow-y: auto;
  list-style: none; margin: 4px 0 0; padding: 4px; box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}
.autocomplete-list li {
  padding: 8px 12px; cursor: pointer; border-radius: 6px;
  font-size: 13px; color: var(--ink);
}
.autocomplete-list li:hover,
.autocomplete-list li.active { background: rgba(6,182,212,0.08); color: var(--accent); }

@media print {
  .filters, .pagination-bar, .icon-button, .primary, .ghost, .secondary,
  .alert-success, .alert-warning, .alert-error, .modal-backdrop, .metrics { display: none !important; }
}
</style>
