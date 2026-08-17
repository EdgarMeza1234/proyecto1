<template>
  <section class="audit-container">
    <div class="page-header">
      <div>
        <h1>Auditoría General</h1>
        <p class="subtitle">Historial de creaciones, modificaciones y eliminaciones del sistema.</p>
      </div>
      <button class="btn btn-secondary" @click="load" :disabled="loading">{{ loading ? 'Cargando...' : 'Recargar' }}</button>
    </div>

    <form class="filters" @submit.prevent="load">
      <input v-model="filters.search" placeholder="Buscar formulario, abonado, usuario..." class="filter-input" />
      <select v-model="filters.modulo" class="filter-select">
        <option value="">Todos los módulos</option>
        <option value="trabajos">Trabajos</option>
      </select>
      <select v-model="filters.accion" class="filter-select">
        <option value="">Todas las acciones</option>
        <option value="CREADO">Creado</option>
        <option value="MODIFICADO">Modificado</option>
        <option value="ELIMINADO">Eliminado</option>
        <option value="RECUPERADO">Recuperado</option>
      </select>
      <input v-model="filters.usuario" placeholder="Usuario" class="filter-input filter-sm" />
      <input v-model="filters.fechaDesde" type="date" class="filter-input filter-sm" title="Desde" />
      <input v-model="filters.fechaHasta" type="date" class="filter-input filter-sm" title="Hasta" />
      <button class="btn btn-primary" type="submit" :disabled="loading">Filtrar</button>
    </form>

    <p v-if="error" class="error-text">{{ error }}</p>
    <p v-if="!loading && !error && !rows.length" class="empty">No hay registros de auditoría.</p>

    <div v-if="rows.length" class="audit-table-wrap">
      <table class="audit-table">
        <thead>
          <tr>
            <th style="width:32px"></th>
            <th>Fecha</th>
            <th>Módulo</th>
            <th>Acción</th>
            <th>Usuario</th>
            <th>Formulario</th>
            <th>Abonado</th>
            <th style="min-width:200px">Detalle</th>
            <th v-if="hasEliminados" style="width:100px"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="r in rows" :key="r.id">
            <tr class="audit-row" :class="{ expanded: expandedId === r.id }" @click="toggleExpand(r)">
              <td class="expand-icon">
                <svg :class="{ rotated: expandedId === r.id }" viewBox="0 0 24 24" width="14" height="14"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
              </td>
              <td>{{ formatDate(r.fecha) }}</td>
              <td><span class="badge badge-module">{{ r.modulo }}</span></td>
              <td><span :class="accionClass(r.accion)">{{ r.accion }}</span></td>
              <td>{{ r.usuario }}</td>
              <td>{{ r.formulario || '—' }}</td>
              <td>{{ r.nombre_abonado || '—' }}</td>
              <td class="detalle-text">{{ r.detalle }}</td>
              <td v-if="hasEliminados">
                <button v-if="r.accion === 'ELIMINADO'" class="btn btn-sm btn-recover" @click.stop="recuperar(r)" :disabled="recovering === r.id">
                  {{ recovering === r.id ? '...' : 'Recuperar' }}
                </button>
              </td>
            </tr>
            <tr v-if="expandedId === r.id" class="detail-row">
              <td colspan="9">
                <div class="detail-panel">
                  <div v-if="r.accion === 'CREADO' || r.accion === 'RECUPERADO'" class="detail-section">
                    <h4>Datos del registro</h4>
                    <div class="detail-grid">
                      <div v-for="(val, key) in parseJson(r.datos_despues)" :key="key" class="detail-field">
                        <span class="field-label">{{ fieldLabel(key) }}</span>
                        <span class="field-value">{{ val || '(vacío)' }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-else-if="r.accion === 'ELIMINADO'" class="detail-section">
                    <h4>Datos eliminados</h4>
                    <div class="detail-grid">
                      <div v-for="(val, key) in parseJson(r.datos_antes)" :key="key" class="detail-field" v-show="isDisplayField(key)">
                        <span class="field-label">{{ fieldLabel(key) }}</span>
                        <span class="field-value deleted">{{ val || '(vacío)' }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-else-if="r.accion === 'MODIFICADO'" class="detail-section">
                    <h4>Cambios realizados</h4>
                    <div class="diff-grid">
                      <template v-for="d in computeDisplayDiff(r)" :key="d.campo">
                        <div class="diff-row">
                          <span class="diff-label">{{ fieldLabel(d.campo) }}</span>
                          <span class="diff-old">{{ d.antes || '(vacío)' }}</span>
                          <span class="diff-arrow">→</span>
                          <span class="diff-new">{{ d.despues || '(vacío)' }}</span>
                        </div>
                      </template>
                    </div>
                    <p v-if="!computeDisplayDiff(r).length" class="muted">Sin cambios de campo detectados.</p>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1" class="pagination">
      <button class="btn btn-sm" :disabled="page <= 1" @click="goPage(page - 1)">← Anterior</button>
      <span class="page-info">Página {{ page }} de {{ totalPages }} ({{ total }} registros)</span>
      <button class="btn btn-sm" :disabled="page >= totalPages" @click="goPage(page + 1)">Siguiente →</button>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '../services/api'

const rows = ref([])
const loading = ref(false)
const error = ref('')
const page = ref(1)
const total = ref(0)
const totalPages = ref(0)
const expandedId = ref(null)
const recovering = ref(null)

const filters = reactive({
  search: '',
  modulo: '',
  accion: '',
  usuario: '',
  fechaDesde: '',
  fechaHasta: ''
})

const hasEliminados = computed(() => rows.value.some(r => r.accion === 'ELIMINADO'))

const FIELD_MAP = {
  id: 'ID', formulario: 'Formulario', numero_telefono: 'Teléfono', nombre_abonado: 'Abonado',
  direccion: 'Dirección', tipo_trabajo: 'Tipo Trabajo', observaciones: 'Observaciones',
  autorizado_nombre: 'Autorizado por', autorizado_apellido: 'Autorizado apellido',
  personal: 'Personal', fecha: 'Fecha', hora: 'Hora', registrado_por: 'Registrado por',
  eliminado: 'Eliminado', eliminado_en: 'Eliminado en', personal_id: 'Personal ID'
}

const DISPLAY_FIELDS = ['formulario', 'numero_telefono', 'nombre_abonado', 'direccion', 'tipo_trabajo', 'observaciones', 'autorizado_nombre', 'personal', 'fecha', 'hora', 'registrado_por']

function fieldLabel(key) {
  return FIELD_MAP[key] || key
}

function isDisplayField(key) {
  return DISPLAY_FIELDS.includes(key)
}

function parseJson(str) {
  if (!str) return {}
  try { return JSON.parse(str) } catch { return {} }
}

function computeDisplayDiff(r) {
  const oldData = parseJson(r.datos_antes)
  const newData = parseJson(r.datos_despues)
  const changes = []
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)])
  for (const key of allKeys) {
    if (key === 'id' || key === 'fecha' || key === 'hora' || key === 'registrado_por' || key === 'eliminado' || key === 'eliminado_en' || key === 'personal_id') continue
    const oldVal = oldData[key] != null ? String(oldData[key]) : ''
    const newVal = newData[key] != null ? String(newData[key]) : ''
    if (oldVal !== newVal) {
      changes.push({ campo: key, antes: oldVal, despues: newVal })
    }
  }
  return changes
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = { page: page.value, limit: 20 }
    if (filters.search) params.search = filters.search
    if (filters.modulo) params.modulo = filters.modulo
    if (filters.accion) params.accion = filters.accion
    if (filters.usuario) params.usuario = filters.usuario
    if (filters.fechaDesde) params.fechaDesde = filters.fechaDesde
    if (filters.fechaHasta) params.fechaHasta = filters.fechaHasta
    const res = await api.get('/trabajos/auditoria', { params })
    rows.value = res.data.data || []
    total.value = res.data.total || 0
    totalPages.value = res.data.totalPages || 0
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function toggleExpand(r) {
  expandedId.value = expandedId.value === r.id ? null : r.id
}

function goPage(p) {
  page.value = p
  load()
}

async function recuperar(r) {
  if (!confirm('¿Recuperar este registro eliminado?')) return
  recovering.value = r.id
  try {
    await api.put(`/trabajos/${r.registro_id}/recuperar`)
    r.accion = 'RECUPERADO'
    r.detalle = `Recuperado por ${r.usuario}`
  } catch (err) {
    alert(err.message)
  } finally {
    recovering.value = null
  }
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleString('es-BO')
}

function accionClass(accion) {
  const map = { CREADO: 'badge-created', MODIFICADO: 'badge-modified', ELIMINADO: 'badge-deleted', RECUPERADO: 'badge-recovered' }
  return map[accion] || 'badge-module'
}

onMounted(load)
</script>

<style scoped>
.audit-container { padding: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.page-header h1 { margin: 0 0 4px; font-size: 1.5rem; }
.subtitle { margin: 0; font-size: 0.9rem; color: var(--muted); }

.filters {
  display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;
  padding: 12px; background: var(--surface-card); border-radius: 10px;
  border: 1px solid var(--border);
}
.filter-input { flex: 1 1 200px; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: 0.85rem; }
.filter-input::placeholder { color: var(--muted); }
.filter-select { padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: 0.85rem; }
.filter-sm { flex: 0 1 140px; }

.audit-table-wrap { overflow-x: auto; }
.audit-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.audit-table th { text-align: left; padding: 8px 10px; font-size: 0.75rem; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--border); }
.audit-table td { padding: 8px 10px; border-bottom: 1px solid var(--border); }

.audit-row { cursor: pointer; transition: background 0.15s; }
.audit-row:hover { background: rgba(59,130,246,0.06); }
.audit-row.expanded { background: rgba(59,130,246,0.1); }

.expand-icon { color: var(--muted); transition: transform 0.2s; }
.expand-icon svg { transition: transform 0.2s; }
.expand-icon svg.rotated { transform: rotate(90deg); }

.detalle-text { font-size: 0.8rem; color: var(--muted); max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.detail-row td { padding: 0; background: var(--surface-card); }
.detail-panel { padding: 16px 20px; border-top: 2px solid var(--accent); }
.detail-section h4 { margin: 0 0 10px; font-size: 0.85rem; color: var(--text); }
.detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
.detail-field { display: flex; flex-direction: column; gap: 2px; padding: 6px 10px; background: var(--bg); border-radius: 6px; }
.field-label { font-size: 0.7rem; text-transform: uppercase; color: var(--muted); font-weight: 600; }
.field-value { font-size: 0.85rem; color: var(--text); }
.field-value.deleted { color: var(--danger); text-decoration: line-through; }

.diff-grid { display: flex; flex-direction: column; gap: 6px; }
.diff-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 6px 10px; background: var(--bg); border-radius: 6px; }
.diff-label { font-size: 0.75rem; font-weight: 600; color: var(--muted); min-width: 100px; }
.diff-old { font-size: 0.85rem; color: var(--danger); text-decoration: line-through; opacity: 0.8; }
.diff-arrow { color: var(--muted); font-weight: 700; }
.diff-new { font-size: 0.85rem; color: var(--success); font-weight: 500; }

.badge { font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 999px; display: inline-block; }
.badge-module { background: rgba(99,102,241,0.15); color: #818cf8; }
.badge-created { background: rgba(34,197,94,0.15); color: #22c55e; }
.badge-modified { background: rgba(234,179,8,0.15); color: #eab308; }
.badge-deleted { background: rgba(239,68,68,0.15); color: #ef4444; }
.badge-recovered { background: rgba(6,182,212,0.15); color: #06b6d4; }

.btn-recover { background: var(--accent); color: #fff; padding: 4px 10px; font-size: 0.75rem; border-radius: 4px; border: none; cursor: pointer; }
.btn-recover:disabled { opacity: 0.5; }

.pagination { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 16px; padding: 12px; }
.page-info { font-size: 0.85rem; color: var(--muted); }

@media (max-width: 768px) {
  .filters { flex-direction: column; }
  .filter-sm { flex: 1 1 100%; }
  .diff-row { flex-direction: column; align-items: flex-start; gap: 4px; }
  .detail-grid { grid-template-columns: 1fr; }
}
</style>
