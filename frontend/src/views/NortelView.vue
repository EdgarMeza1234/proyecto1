<template>
  <section class="panel">
    <div class="panel-head">
      <div>
        <h2>Procesamiento de Trafico Nortel</h2>
        <p class="muted">Consolida archivos crudos de la central Nortel y carga a base de datos</p>
      </div>
    </div>

    <div class="block-toolbar" style="gap:12px;flex-wrap:wrap">
      <select v-model="mes">
        <option disabled value="">Seleccione mes</option>
        <option v-for="(abbr, name) in meses" :key="name" :value="name">{{ name }}</option>
      </select>
      <select v-model="ano">
        <option disabled value="">Seleccione ano</option>
        <option v-for="a in anos" :key="a" :value="a">{{ a }}</option>
      </select>
      <button class="primary" :disabled="!mes || !ano || loading" @click="listarArchivos">
        {{ loading ? 'Cargando...' : 'Listar archivos' }}
      </button>
    </div>

    <div v-if="dirName" class="block-message" style="margin-top:8px">
      Directorio: <code>E:\AMAS\NORTEL\{{ dirName }}\</code> |
      Tabla BD: <code>{{ tableName }}</code>
    </div>
  </section>

  <!-- 1. ARCHIVOS CRUDOS -->
  <section class="panel" v-if="archivos.length">
    <div class="panel-head">
      <h2>1. Archivos crudos encontrados ({{ archivos.length }})</h2>
      <div class="panel-tools">
        <button class="primary" :disabled="!mes || !ano || procesando" @click="consolidarTodo">
          {{ procesando ? 'Consolidando...' : 'Consolidar todo (AMAs)' }}
        </button>
      </div>
    </div>

    <div v-if="procesando" style="padding:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px">
        <span>Archivo {{ convArchivoActual }}/{{ convTotalArchivos }}</span>
        <span>{{ convPct }}%</span>
      </div>
      <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:4px">
        <div style="height:100%;background:var(--accent);transition:width 0.3s" :style="{ width: convPct + '%' }"></div>
      </div>
      <div style="font-size:12px;color:var(--muted)">{{ convLabel }}</div>
    </div>

    <div class="table" style="max-height:300px;overflow-y:auto">
      <div class="table-header" style="display:grid;grid-template-columns:1.3fr 1fr 0.8fr;gap:16px;padding:0 16px;font-weight:600;font-size:13px;color:var(--muted);margin-bottom:4px">
        <span>Archivo</span>
        <span>Tamano</span>
        <span>Accion</span>
      </div>
      <div v-for="f in archivos" :key="f.nombre" class="table-row">
        <span><code>{{ f.nombre }}</code></span>
        <span>{{ (f.tamano / 1024).toFixed(1) }} KB</span>
        <span>
          <button class="secondary small" :disabled="procesando" @click="consolidarUnico(f.nombre)">Consolidar</button>
        </span>
      </div>
    </div>
  </section>

  <!-- 2. SPLIT 2001 -->
  <section class="panel">
    <div class="panel-head">
      <h2>2. Separar registros 2001 (Trafico2001)</h2>
    </div>
    <div class="block-toolbar">
      <button class="secondary" :disabled="!mes || !ano || splitteando" @click="splitAll">
        {{ splitteando ? 'Separando...' : 'Separar todo' }}
      </button>
    </div>
    <div v-if="splitResult" class="block-message success" style="margin-top:8px">
      AMA: {{ splitResult.totalAma }} | 2001: {{ splitResult.total2001 }} | Total: {{ splitResult.totalAma + splitResult.total2001 }}
    </div>
  </section>

  <!-- 3. BASE DE DATOS -->
  <section class="panel">
    <div class="panel-head">
      <h2>3. Base de datos - Tabla {{ tableName }}</h2>
    </div>
    <div class="block-toolbar" style="gap:8px;flex-wrap:wrap">
      <button class="secondary" :disabled="!mes || !ano" @click="crearTabla">Crear tabla</button>
      <button class="secondary" :disabled="!mes || !ano" @click="limpiarTabla">Limpiar registros</button>
      <button class="primary" :disabled="!mes || !ano || insertando" @click="insertarBD">
        {{ insertando ? 'Insertando...' : 'Insertar AMA.EMC en BD' }}
      </button>
    </div>

    <div v-if="insertando" style="padding:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px">
        <span>Archivo {{ insArchivoActual }}/{{ insTotalArchivos }}</span>
        <span>{{ insPctGlobal }}%</span>
      </div>
      <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:8px">
        <div style="height:100%;background:var(--accent);transition:width 0.3s" :style="{ width: insPctGlobal + '%' }"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px;color:var(--muted)">
        <span>{{ insLabel }}</span>
        <span>{{ insPctDetalle }}%</span>
      </div>
      <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
        <div style="height:100%;background:#4caf50;transition:width 0.3s" :style="{ width: insPctDetalle + '%' }"></div>
      </div>
    </div>

    <div v-if="bdResultado" class="block-message success" style="margin-top:8px">
      <pre style="margin:0;white-space:pre-wrap">{{ bdResultado }}</pre>
    </div>
  </section>

  <!-- ERROR GENERAL -->
  <section v-if="error" class="panel">
    <div class="block-message error">{{ error }}</div>
  </section>

  <!-- RESUMEN DETALLE -->
  <section v-if="resumen.length" class="panel">
    <div class="panel-head"><h2>Detalle por archivo</h2></div>
    <div class="table">
      <div class="table-header" style="display:grid;grid-template-columns:1.3fr 1fr 0.8fr auto;gap:16px;padding:0 16px;font-weight:600;font-size:13px;color:var(--muted);margin-bottom:4px">
        <span>Archivo</span>
        <span>Procesados</span>
        <span>Omitidos</span>
        <span>Errores</span>
      </div>
      <div v-for="r in resumen" :key="r.archivo" class="table-row">
        <span><code>{{ r.archivo }}</code></span>
        <span>{{ r.registros ?? r.insertados ?? r.ama ?? '—' }}</span>
        <span>{{ r.omitidos ?? '—' }}</span>
        <span :class="{ 'error-text': r.errores > 0 || r.error }">{{ r.errores ?? '—' }} {{ r.error || '' }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '../services/api'
import { io } from 'socket.io-client'

const meses = {
  ENERO: 'ENE', FEBRERO: 'FEB', MARZO: 'MAR', ABRIL: 'ABR',
  MAYO: 'MAY', JUNIO: 'JUN', JULIO: 'JUL', AGOSTO: 'AGO',
  SEPTIEMBRE: 'SEP', OCTUBRE: 'OCT', NOVIEMBRE: 'NOV', DICIEMBRE: 'DIC'
}

const anos = ['2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027']

const mes = ref('')
const ano = ref('')
const archivos = ref([])
const loading = ref(false)
const procesando = ref(false)
const splitteando = ref(false)
const insertando = ref(false)
const conversionResult = ref('')
const splitResult = ref(null)
const bdResultado = ref('')
const error = ref('')
const resumen = ref([])

const convPct = ref(0)
const convArchivoActual = ref(0)
const convTotalArchivos = ref(0)
const convLabel = ref('')

const insPctGlobal = ref(0)
const insPctDetalle = ref(0)
const insArchivoActual = ref(0)
const insTotalArchivos = ref(0)
const insLabel = ref('')

const dirName = computed(() => {
  if (!mes.value || !ano.value) return ''
  const abbr = meses[mes.value.toUpperCase()]
  return abbr ? abbr + ano.value : ''
})

const tableName = computed(() => dirName.value ? 'CDR' + dirName.value + 'N' : '')

let socket = null

onMounted(() => {
  socket = io({ path: '/socket.io' })
  socket.on('nortel-progress', (data) => {
    if (data.fase === 'iniciando-consolidacion') {
      convTotalArchivos.value = data.totalArchivos || 1
      convArchivoActual.value = 0
      convPct.value = 0
      convLabel.value = 'Iniciando consolidacion...'
    } else if (data.fase === 'consolidando') {
      convArchivoActual.value = data.archivoActual
      convTotalArchivos.value = data.totalArchivos
      convPct.value = data.totalArchivos > 0 ? Math.round((data.archivoActual / data.totalArchivos) * 100) : 0
      convLabel.value = `Consolidando ${data.archivo}...`
    } else if (data.fase === 'consolidacion-completado') {
      convPct.value = data.totalArchivos > 0 ? Math.round((data.archivoActual / data.totalArchivos) * 100) : 0
      convLabel.value = `Completado: ${data.registros} registros`
    } else if (data.fase === 'iniciando-split') {
      // No progress bar for split, but we can log
    } else if (data.fase === 'iniciando-insercion') {
      insTotalArchivos.value = data.totalArchivos || 1
      insArchivoActual.value = 0
      insPctGlobal.value = 0
      insPctDetalle.value = 0
      insLabel.value = 'Iniciando insercion...'
    } else if (data.fase === 'insertar-archivo') {
      insArchivoActual.value = data.archivoActual
      insTotalArchivos.value = data.totalArchivos
      insPctGlobal.value = data.totalArchivos > 0 ? Math.round((data.archivoActual / data.totalArchivos) * 100) : 0
      insLabel.value = `Insertando ${data.archivo}...`
      insPctDetalle.value = 0
    } else if (data.fase === 'insertando') {
      insLabel.value = `[${data.archivoActual}/${data.totalArchivos}] ${data.archivo}: ${data.completado}/${data.total}`
      insPctDetalle.value = data.total > 0 ? Math.round((data.completado / data.total) * 100) : 0
      insArchivoActual.value = data.archivoActual || insArchivoActual.value
      insTotalArchivos.value = data.totalArchivos || insTotalArchivos.value
      insPctGlobal.value = data.archivoActual && data.totalArchivos
        ? Math.round((data.archivoActual / data.totalArchivos) * 100)
        : insPctGlobal.value
    } else if (data.fase === 'completado') {
      insLabel.value = `[${data.archivoActual}/${data.totalArchivos}] ${data.archivo}: ok (ins:${data.insertados} err:${data.errores})`
      insPctDetalle.value = 100
      insPctGlobal.value = data.archivoActual && data.totalArchivos
        ? Math.round((data.archivoActual / data.totalArchivos) * 100)
        : insPctGlobal.value
    } else if (data.fase === 'file-completado') {
      insPctGlobal.value = data.totalArchivos > 0 ? Math.round((data.archivoActual / data.totalArchivos) * 100) : 0
      insArchivoActual.value = data.archivoActual
    }
  })
})

onUnmounted(() => {
  if (socket) socket.disconnect()
})

async function listarArchivos() {
  loading.value = true
  error.value = ''
  conversionResult.value = ''
  bdResultado.value = ''
  resumen.value = []
  splitResult.value = null
  try {
    const res = await api.get('/nortel/archivos', { params: { mes: mes.value, ano: ano.value } })
    archivos.value = res.data.archivos
  } catch (err) {
    error.value = err.message
    archivos.value = []
  } finally {
    loading.value = false
  }
}

async function consolidarUnico(archivo) {
  procesando.value = true
  error.value = ''
  conversionResult.value = ''
  try {
    const res = await api.post('/nortel/consolidar', { mes: mes.value, ano: ano.value, archivo })
    conversionResult.value = `Consolidado: ${res.data.registros} registros`
    await listarArchivos()
  } catch (err) {
    error.value = err.message
  } finally {
    procesando.value = false
  }
}

async function consolidarTodo() {
  procesando.value = true
  error.value = ''
  conversionResult.value = ''
  resumen.value = []
  convPct.value = 0
  convArchivoActual.value = 0
  convTotalArchivos.value = 0
  convLabel.value = ''
  try {
    const res = await api.post('/nortel/consolidar', { mes: mes.value, ano: ano.value })
    const d = res.data
    conversionResult.value = `Archivos: ${d.archivosProcesados} | Registros: ${d.totalRegistros} | Omitidos (otro mes): ${d.totalOmitidos || 0}`
    resumen.value = d.resumen || []
    await listarArchivos()
  } catch (err) {
    error.value = err.message
  } finally {
    procesando.value = false
  }
}

async function splitAll() {
  splitteando.value = true
  error.value = ''
  splitResult.value = null
  try {
    const res = await api.post('/nortel/split', { mes: mes.value, ano: ano.value })
    splitResult.value = res.data
  } catch (err) {
    error.value = err.message
  } finally {
    splitteando.value = false
  }
}

async function crearTabla() {
  error.value = ''
  bdResultado.value = ''
  try {
    const res = await api.post('/nortel/crear-tabla', { mes: mes.value, ano: ano.value })
    bdResultado.value = res.data.creada
      ? `Tabla ${res.data.nombre} creada exitosamente`
      : `Tabla ${res.data.nombre} ya existe`
  } catch (err) {
    error.value = err.message
  }
}

async function limpiarTabla() {
  error.value = ''
  bdResultado.value = ''
  try {
    const res = await api.post('/nortel/limpiar-tabla', { mes: mes.value, ano: ano.value })
    bdResultado.value = res.data.mensaje
  } catch (err) {
    error.value = err.message
  }
}

async function insertarBD() {
  insertando.value = true
  error.value = ''
  bdResultado.value = ''
  insPctGlobal.value = 0
  insPctDetalle.value = 0
  insArchivoActual.value = 0
  insTotalArchivos.value = 0
  insLabel.value = 'Iniciando...'
  try {
    const res = await api.post('/nortel/insertar-bd', { mes: mes.value, ano: ano.value })
    const d = res.data
    bdResultado.value = `Insertados: ${d.insertados} | Errores: ${d.errores} | Total: ${d.total}\nTabla: ${d.tabla}${d.tablaCreada ? ' (creada)' : ''}`
    resumen.value = d.resumen || []
  } catch (err) {
    error.value = err.message
  } finally {
    insertando.value = false
  }
}
</script>
