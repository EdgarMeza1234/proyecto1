<template>
  <div>
    <div v-if="globalSuccess" class="alert-success"><i class="bi bi-check-circle-fill"></i> {{ globalSuccess }}</div>
    <div v-if="globalError" class="alert-error"><i class="bi bi-exclamation-triangle-fill"></i> {{ globalError }}</div>

    <div class="panel" style="margin-bottom:1rem;">
      <div class="panel-head-row">
        <h3 class="panel-title"><i class="bi bi-send-plus"></i> Enviar formularios</h3>
      </div>
      <p class="panel-hint">Sube las solicitudes de trabajo (papeletas) generadas en tu unidad. Los datos se leen automáticamente y quedarán disponibles para Registro de Trabajo 1.</p>

      <div v-if="uploadError" class="alert-error" style="margin-bottom:1rem;"><i class="bi bi-exclamation-triangle-fill"></i> {{ uploadError }}</div>

      <div class="dropzone" @click="fileInput?.click()" @dragover.prevent @drop.prevent="onDrop">
        <i class="bi bi-cloud-arrow-up"></i>
        <p>Arrastra las papeletas aquí o haz clic para seleccionar</p>
        <small>PDF, JPG, PNG o WEBP · hasta 15MB cada una · máximo 10 por vez</small>
      </div>
      <input ref="fileInput" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" style="display:none" @change="onFileInput" />

      <div v-if="uploading" style="text-align:center;padding:1rem;color:var(--muted);">
        <i class="bi bi-arrow-clockwise animate-spin"></i> Subiendo y leyendo las papeletas...
      </div>

      <div v-for="item in uploadItems" :key="item.uid" class="papeleta-item">
        <div class="pi-head">
          <i class="bi" :class="item.mime === 'application/pdf' ? 'bi-file-earmark-pdf' : 'bi-file-earmark-image'" style="font-size:1.3rem;color:var(--accent);"></i>
          <span class="pi-name" :title="item.nombre">{{ item.nombre }}</span>
          <span :class="badgeClass(item)">{{ badgeText(item) }}</span>
        </div>
        <div v-if="item.campos" class="pi-grid">
          <div><span>Formulario</span><strong>{{ item.campos.formulario || '—' }}</strong></div>
          <div><span>Teléfono</span><strong>{{ item.campos.numero_telefono || '—' }}</strong></div>
          <div><span>Abonado</span><strong>{{ item.campos.nombre_abonado || '—' }}</strong></div>
          <div><span>Tipo de trabajo</span><strong>{{ tipoLabel(item.campos.tipo_trabajo) || item.campos.tipo_servicio || '—' }}</strong></div>
        </div>
        <div v-if="item.advertencias && item.advertencias.length" class="pi-warn">
          <div v-for="(a, i) in item.advertencias" :key="i"><i class="bi bi-exclamation-triangle"></i> {{ a }}</div>
        </div>
        <div class="pi-actions">
          <button class="secondary" @click="loadPapeleta(item.id)"><i class="bi bi-eye"></i> Ver PDF</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head-row">
        <h3 class="panel-title"><i class="bi bi-inbox"></i> Formularios enviados</h3>
        <input v-model="searchQuery" type="text" placeholder="Buscar por Formulario, Teléfono, Abonado..." style="max-width:280px;" />
      </div>

      <div v-if="loading" style="text-align:center;padding:3rem;color:var(--muted);">
        <i class="bi bi-arrow-clockwise animate-spin" style="font-size:1.5rem;"></i>
        <p style="margin-top:0.5rem;">Cargando...</p>
      </div>
      <div v-else>
        <div class="table-wrapper">
          <table class="registro-table">
            <thead>
              <tr>
                <th style="width:100px;">Formulario</th>
                <th style="width:120px;">Teléfono</th>
                <th>Abonado</th>
                <th style="width:160px;">Tipo Trabajo</th>
                <th style="width:120px;">Fecha solicitud</th>
                <th style="width:120px;">Estado</th>
                <th style="width:150px;">Enviado por</th>
                <th style="width:110px;">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filtered" :key="item.id">
                <td class="cell-formulario">{{ item.campos?.formulario || '—' }}</td>
                <td class="cell-telefono">{{ item.campos?.numero_telefono || '—' }}</td>
                <td class="cell-abonado" :title="item.campos?.nombre_abonado">{{ item.campos?.nombre_abonado || item.nombre }}</td>
                <td class="cell-tipo">{{ tipoLabel(item.campos?.tipo_trabajo) || item.campos?.tipo_servicio || '—' }}</td>
                <td class="cell-fecha">{{ formatDate(item.campos?.fecha) }}</td>
                <td>
                  <span :class="item.procesado ? 'papeleta-badge badge-ok' : 'papeleta-badge badge-warn'">
                    {{ item.procesado ? 'Procesado' : 'Pendiente' }}
                  </span>
                </td>
                <td class="cell-fecha">{{ item.creado_por || '—' }}</td>
                <td>
                  <button @click="loadPapeleta(item.id)" class="icon-button" style="width:32px;height:32px;color:var(--accent);" title="Ver papeleta"><i class="bi bi-paperclip"></i></button>
                </td>
              </tr>
              <tr v-if="filtered.length === 0">
                <td colspan="8" style="text-align:center;color:var(--dimmed);padding:2rem;">No hay formularios enviados.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="viewerOpen" class="modal-backdrop" @click.self="closeViewer" style="z-index:200;">
      <div class="modal viewer-modal">
        <div class="modal-head">
          <h3 style="margin:0;display:flex;align-items:center;gap:8px;font-size:1.1rem;">
            <i class="bi bi-paperclip"></i> Papeleta
          </h3>
          <button @click="closeViewer" class="icon-button" style="width:36px;height:36px;">&times;</button>
        </div>
        <iframe v-if="viewerUrl" :src="viewerUrl" title="Papeleta"></iframe>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
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

function tipoLabel(slug) {
  if (!slug) return ''
  return tipoTrabajoOptions.find(t => t.value === slug)?.label || String(slug).replace(/_/g, ' ')
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const clean = String(dateStr).split('T')[0]
  const parts = clean.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return clean
}

const globalSuccess = ref('')
const globalError = ref('')

const showUploadModal = ref(false)
const uploading = ref(false)
const uploadError = ref('')
const uploadItems = ref([])
const fileInput = ref(null)
let uploadUid = 0

const lista = ref([])
const loading = ref(true)
const searchQuery = ref('')

const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return lista.value
  return lista.value.filter(item => {
    const c = item.campos || {}
    return [c.formulario, c.numero_telefono, c.nombre_abonado, item.nombre]
      .some(v => String(v || '').toLowerCase().includes(q))
  })
})

function onDrop(e) { subirArchivos(e.dataTransfer?.files) }
function onFileInput(e) { subirArchivos(e.target.files); e.target.value = '' }

async function subirArchivos(fileList) {
  const files = Array.from(fileList || [])
  if (!files.length) return
  uploading.value = true; uploadError.value = ''
  try {
    const fd = new FormData()
    files.forEach(f => fd.append('archivos', f))
    const res = await api.post('/papeletas', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    const nuevos = (res.data || []).map(item => ({ ...item, uid: ++uploadUid, dup: null }))
    uploadItems.value = [...nuevos, ...uploadItems.value]
    for (const item of nuevos) {
      if (item.campos?.formulario) {
        try {
          const v = await api.get('/trabajos/verificar-formulario', { params: { formulario: item.campos.formulario } })
          item.dup = v.data.exists
        } catch { item.dup = null }
      }
    }
    globalSuccess.value = `${nuevos.length} formulario(s) enviado(s) correctamente`
    setTimeout(() => globalSuccess.value = '', 4000)
    fetchLista()
  } catch (err) {
    uploadError.value = err.message
  } finally {
    uploading.value = false
  }
}

function badgeText(item) {
  if (item.dup) return '⚠️ Formulario ya registrado'
  if (item.campos) return '✅ Leído'
  return '✏️ Lectura manual'
}
function badgeClass(item) {
  if (item.dup) return 'papeleta-badge badge-warn'
  if (item.campos) return 'papeleta-badge badge-ok'
  return 'papeleta-badge badge-muted'
}

async function fetchLista() {
  loading.value = true
  try {
    const res = await api.get('/papeletas')
    lista.value = res.data || []
  } catch (err) {
    globalError.value = err.message
    setTimeout(() => globalError.value = '', 5000)
  } finally { loading.value = false }
}

const viewerOpen = ref(false)
const viewerUrl = ref('')

async function loadPapeleta(archivoId) {
  try {
    const res = await api.get(`/papeletas/${archivoId}/archivo`, { responseType: 'blob' })
    revokeViewer()
    viewerUrl.value = URL.createObjectURL(res.data)
    viewerOpen.value = true
  } catch {
    globalError.value = 'No se pudo abrir la papeleta'
    setTimeout(() => globalError.value = '', 5000)
  }
}
function closeViewer() { viewerOpen.value = false; revokeViewer() }
function revokeViewer() {
  if (viewerUrl.value) { URL.revokeObjectURL(viewerUrl.value); viewerUrl.value = '' }
}

onMounted(() => { fetchLista() })
</script>

<style scoped>
.animate-spin { display: inline-block; animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.panel-head-row {
  display: flex; justify-content: space-between; align-items: center;
  gap: 12px; flex-wrap: wrap; margin-bottom: 0.75rem;
}
.panel-title { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 1.05rem; }
.panel-hint { margin: 0 0 1rem; color: var(--muted); font-size: 13px; }

.table-wrapper { overflow-x: auto; }
.registro-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.registro-table thead th {
  text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted);
  border-bottom: 1px solid var(--border); background: var(--table-header-bg); white-space: nowrap;
}
.registro-table tbody td { padding: 10px 12px; border-bottom: 1px solid var(--border); color: var(--ink); vertical-align: middle; }
.registro-table tbody tr:hover { background: var(--ticket-row-hover); }
.cell-formulario { font-weight: 700; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-telefono { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-abonado { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-tipo { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-fecha { font-size: 13px; white-space: nowrap; }

.alert-success, .alert-error {
  padding: 12px 16px; border-radius: 10px; margin-bottom: 1rem;
  font-size: 14px; display: flex; align-items: center; gap: 8px;
}
.alert-success { background: rgba(16,185,129,0.1); color: var(--ok); border: 1px solid rgba(16,185,129,0.2); }
.alert-error { background: rgba(244,63,94,0.1); color: var(--danger); border: 1px solid rgba(244,63,94,0.2); }

.dropzone {
  border: 2px dashed var(--border); border-radius: 12px; padding: 2rem;
  text-align: center; cursor: pointer; color: var(--muted);
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.dropzone:hover { border-color: var(--accent); background: rgba(6,182,212,0.04); color: var(--accent); }
.dropzone i { font-size: 2rem; display: block; margin-bottom: 0.5rem; }
.dropzone p { margin: 0 0 0.25rem; font-weight: 600; color: var(--ink); }
.dropzone small { font-size: 12px; }

.papeleta-item { border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin-top: 12px; }
.pi-head { display: flex; align-items: center; gap: 8px; }
.pi-name { font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.papeleta-badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.badge-ok { background: rgba(16,185,129,0.12); color: var(--ok); }
.badge-warn { background: rgba(245,158,11,0.12); color: var(--warn); }
.badge-muted { background: var(--table-header-bg); color: var(--muted); }
.pi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 16px; margin-top: 12px; font-size: 13px; }
.pi-grid span { display: block; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.3px; }
.pi-grid strong { color: var(--ink); font-weight: 600; }
.pi-warn { margin-top: 8px; font-size: 12px; color: var(--warn); }
.pi-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }

.viewer-modal { max-width: 900px; width: 94vw; height: 88vh; display: flex; flex-direction: column; }
.viewer-modal iframe { flex: 1; width: 100%; border: 0; border-radius: 0 0 14px 14px; background: #fff; }

@media (max-width: 640px) { .pi-grid { grid-template-columns: 1fr; } }
</style>
