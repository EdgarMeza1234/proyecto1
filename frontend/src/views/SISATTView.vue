<template>
  <div class="sisatt-container">
    <div class="page-header">
      <h1>Tráfico SISATT</h1>
      <p class="subtitle">Procesamiento de tráfico telefónico - 1er Semestre 2026</p>
    </div>

    <div class="sisatt-controls">
      <div class="control-group">
        <label>Mes</label>
        <select v-model="mes">
          <option v-for="m in meses" :key="m.val" :value="m.val">{{ m.label }}</option>
        </select>
      </div>
      <div class="control-group">
        <label>Año</label>
        <select v-model="ano">
          <option>2026</option>
        </select>
      </div>
    </div>

    <div class="steps-grid">
      <div class="step-card" :class="{ active: step === 1 }">
        <div class="step-header">
          <span class="step-num">1</span>
          <h3>Parsear Logs</h3>
        </div>
        <p class="step-desc">Lee archivos de C:\DescargarOm\ y genera archivos .EMC2</p>
        <div class="step-actions">
          <button class="btn btn-primary" @click="listarLogs" :disabled="loading && progreso.total === 0">{{ loading && progreso.total === 0 ? 'Cargando...' : 'Listar archivos' }}</button>
          <button class="btn btn-primary" @click="parsearTodo" :disabled="loading || !archivos.length">{{ progreso.total > 0 && !procesando ? progreso.actual + '/' + progreso.total : 'Parsear todo' }}</button>
          <button class="btn btn-secondary" @click="procesarTodo" :disabled="loading || !archivos.length" v-if="archivos.length">Procesar</button>
        </div>
        <div v-if="progreso.total > 0" class="progress-bar">
          <div class="progress-fill" :style="{ width: progreso.pct + '%' }"></div>
          <span class="progress-label">{{ progreso.actual }}/{{ progreso.total }}{{ progreso.archivo ? ' - ' + progreso.archivo : '' }}</span>
        </div>
        <div v-if="procesarResultados.length" class="file-list">
          <div v-for="r in procesarResultados" :key="r.archivo" class="file-row">
            <span>{{ r.archivo }}</span>
            <span :class="r.estado === 'ok' ? 'tag-ok' : 'tag-err'">{{ r.estado }} ({{ r.archivos ? r.archivos.length + ' archivos' : '' }})</span>
          </div>
        </div>
        <div v-if="archivos.length" class="file-list">
          <div v-for="a in archivos" :key="a" class="file-row">
            <span>{{ a }}</span>
            <span v-if="resultados[a]" :class="resultados[a].estado === 'ok' ? 'tag-ok' : 'tag-err'">{{ resultados[a].estado }}</span>
          </div>
        </div>
      </div>

      <div class="step-card" :class="{ active: step === 2 }">
        <div class="step-header">
          <span class="step-num">2</span>
          <h3>Reporte LLC</h3>
        </div>
        <p class="step-desc">Genera PDF de Llamadas Completadas (LLC)</p>
        <div class="step-actions">
          <button class="btn btn-primary" @click="reporteLLC" :disabled="loadingSql">Reporte LLC PDF</button>
        </div>
      </div>

      <div class="step-card" :class="{ active: step === 3 }">
        <div class="step-header">
          <span class="step-num">3</span>
          <h3>Reporte ROTID</h3>
        </div>
        <p class="step-desc">Genera PDF de retardos (ROTID)</p>
        <div class="step-actions">
          <button class="btn btn-primary" @click="reporteROTID" :disabled="loadingSql">Reporte ROTID PDF</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'

const meses = [
  { label: 'Enero', val: 'ENERO' }, { label: 'Febrero', val: 'FEBRERO' },
  { label: 'Marzo', val: 'MARZO' }, { label: 'Abril', val: 'ABRIL' },
  { label: 'Mayo', val: 'MAYO' }, { label: 'Junio', val: 'JUNIO' }
]

const mes = ref('ENERO')
const ano = ref('2026')
const step = ref(0)
const loading = ref(false)
const loadingSql = ref(false)
const archivos = ref([])
const resultados = ref({})
const progreso = ref({ actual: 0, total: 0, pct: 0, archivo: '' })
const procesarResultados = ref([])
const procesando = ref(false)
const MES_NUM = { ENERO:'01', FEBRERO:'02', MARZO:'03', ABRIL:'04', MAYO:'05', JUNIO:'06' }

async function listarLogs() {
  loading.value = true
  step.value = 0
  try {
    const res = await api.get('/sisatt/logs', { params: { mes: mes.value, ano: ano.value } })
    archivos.value = res.data
    resultados.value = {}
  } catch (e) {
    alert(e.message)
  } finally {
    loading.value = false
  }
}

async function parsearTodo() {
  loading.value = true
  step.value = 1
  resultados.value = {}
  progreso.value = { actual: 0, total: 0, pct: 0, archivo: '' }

  const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${wsProto}//${location.hostname}:4001`
  const ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    ws.send(JSON.stringify({ tipo: 'parsear', mes: mes.value, ano: ano.value, archivos: archivos.value }))
  }

  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data)
    if (msg.tipo === 'progreso') {
      progreso.value = { actual: msg.actual, total: msg.total, pct: Math.round((msg.actual / msg.total) * 100), archivo: msg.archivo }
      resultados.value[msg.archivo] = { archivo: msg.archivo, estado: msg.estado }
    } else if (msg.tipo === 'completado') {
      ws.close()
      loading.value = false
    } else if (msg.tipo === 'error') {
      alert(msg.message)
      ws.close()
      loading.value = false
    }
  }

  ws.onerror = () => {
    alert('Error de conexión WebSocket')
    loading.value = false
  }

  ws.onclose = () => { loading.value = false }
}

async function procesarTodo() {
  loading.value = true
  procesando.value = true
  step.value = 1
  resultados.value = {}
  progreso.value = { actual: 0, total: 0, pct: 0, archivo: '' }

  const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${wsProto}//${location.hostname}:4001`
  const ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    ws.send(JSON.stringify({ tipo: 'procesar', mes: mes.value, ano: ano.value, archivos: archivos.value }))
  }

  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data)
    if (msg.tipo === 'progreso') {
      progreso.value = { actual: msg.actual, total: msg.total, pct: Math.round((msg.actual / msg.total) * 100), archivo: msg.archivo }
      resultados.value[msg.archivo] = { archivo: msg.archivo, estado: msg.estado }
    } else if (msg.tipo === 'completado') {
      ws.close()
      loading.value = false
      procesando.value = false
    } else if (msg.tipo === 'error') {
      alert(msg.message)
      ws.close()
      loading.value = false
      procesando.value = false
    }
  }

  ws.onerror = () => {
    alert('Error de conexión WebSocket')
    loading.value = false
    procesando.value = false
  }

  ws.onclose = () => { loading.value = false; procesando.value = false }
}

async function reporteLLC() {
  loadingSql.value = true
  step.value = 2
  try {
    const mesNum = MES_NUM[mes.value] || '01'
    const url = `/api/sisatt/reporte/llc?ano=${ano.value}&mes=${mesNum}`
    window.open(url, '_blank')
  } catch (e) {
    alert(e.message)
  } finally {
    loadingSql.value = false
  }
}

async function reporteROTID() {
  loadingSql.value = true
  step.value = 3
  try {
    const mesNum = MES_NUM[mes.value] || '01'
    const url = `/api/sisatt/reporte/rotid?ano=${ano.value}&mes=${mesNum}`
    window.open(url, '_blank')
  } catch (e) {
    alert(e.message)
  } finally {
    loadingSql.value = false
  }
}

onMounted(() => { listarLogs() })
</script>

<style scoped>
.sisatt-container { padding: 24px; }
.page-header { margin-bottom: 24px; }
.page-header h1 { margin: 0 0 4px; font-size: 1.5rem; }
.subtitle { margin: 0; font-size: 0.9rem; color: #94a3b8; }

.sisatt-controls {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.control-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.control-group label { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; color: #94a3b8; }
.control-group select {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.1);
  background: #0f172a;
  color: #e2e8f0;
  font-size: 0.9rem;
  min-width: 140px;
}

.steps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 20px;
}

.step-card {
  background: #0f172a;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 20px;
  transition: all 0.2s;
}
.step-card.active { border-color: #3b82f6; box-shadow: 0 0 20px rgba(59,130,246,0.1); }

.step-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.step-num {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: #1e293b;
  color: #60a5fa;
  font-weight: 700;
  font-size: 0.9rem;
}
.step-header h3 { margin: 0; color: #f1f5f9; }
.step-desc { color: #94a3b8; font-size: 0.85rem; margin: 0 0 16px; }

.step-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  font-weight: 500;
}
.btn-primary { background: #2563eb; color: #fff; }
.btn-primary:hover { background: #1d4ed8; }
.btn-primary:disabled { background: #1e3a5f; cursor: not-allowed; }
.btn-secondary { background: #1e293b; color: #94a3b8; border: 1px solid rgba(255,255,255,0.08); }
.btn-secondary:hover { background: #334155; color: #e2e8f0; }
.btn-warning { background: #d97706; color: #fff; }
.btn-warning:hover { background: #b45309; }
.btn-warning:disabled { background: #78350f; cursor: not-allowed; }

.result-card {
  margin-top: 16px; padding: 16px;
  background: #0f172a; border: 1px solid #d97706; border-radius: 10px;
}
.result-card h3 { margin: 0 0 8px; color: #fbbf24; font-size: 1rem; }
.result-card p { margin: 4px 0; font-size: 0.85rem; color: #94a3b8; }
.result-card strong { color: #e2e8f0; }

.file-list { margin-top: 12px; max-height: 200px; overflow-y: auto; }
.file-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 4px 0; font-size: 0.8rem; color: #94a3b8;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.tag-ok { color: #22c55e; font-weight: 600; }
.tag-err { color: #ef4444; font-weight: 600; }

.progress-bar {
  margin-top: 12px;
  height: 24px;
  background: #1e293b;
  border-radius: 12px;
  position: relative;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2563eb, #3b82f6);
  border-radius: 12px;
  transition: width 0.3s ease;
}
.progress-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: #e2e8f0;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.sql-box {
  margin-top: 12px;
  background: #060913;
  border-radius: 8px;
  padding: 12px;
  max-height: 200px;
  overflow: auto;
}
.sql-box pre { margin: 0; font-size: 0.75rem; color: #22c55e; white-space: pre-wrap; }
</style>
