<template>
  <section class="panel">
    <div class="panel-head">
      <div>
        <h2>Procesamiento de Trafico Iskratel</h2>
        <p class="muted">Convierte archivos .ama de la central a formato legible para facturacion</p>
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
      Directorio: <code>E:\AMAS\2026\{{ dirName }}\</code> |
      Tabla BD: <code>{{ tableName }}</code> |
      Archivo salida: <code>{{ dirName }}.TXT</code>
    </div>
  </section>

  <!-- 1. ARCHIVOS -->
  <section class="panel" v-if="archivos.length">
    <div class="panel-head">
      <h2>1. Archivos .ama encontrados ({{ archivos.length }})</h2>
      <div class="panel-tools">
        <button class="primary" :disabled="procesando" @click="procesarMesCompleto">
          {{ procesando ? 'Convirtiendo...' : 'Convertir todo a TXT' }}
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
        <span><button class="secondary small" :disabled="procesando" @click="convertirArchivo(f.ruta)">Convertir</button></span>
      </div>
    </div>

    <div v-if="conversionResult" class="block-message success" style="margin-top:8px">
      {{ conversionResult }} | Archivo: <code>{{ dirName }}.TXT</code>
    </div>
  </section>

  <!-- 2. BASE DE DATOS -->
  <section class="panel">
    <div class="panel-head">
      <h2>2. Base de datos - Tabla {{ tableName }}</h2>
    </div>
    <div class="block-toolbar" style="gap:8px;flex-wrap:wrap">
      <button class="secondary" :disabled="!mes || !ano" @click="crearTabla">Crear tabla</button>
      <button class="secondary" :disabled="!mes || !ano" @click="limpiarTabla">Limpiar registros</button>
      <button class="primary" :disabled="!mes || !ano || insertando" @click="insertarMes">
        {{ insertando ? 'Insertando...' : 'Insertar .ama en BD' }}
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

  <!-- 3. SPLIT -->
  <section class="panel">
    <div class="panel-head">
      <h2>3. Split - Separar en .SAL / .ENT</h2>
    </div>
    <div class="block-toolbar">
      <button class="secondary" :disabled="!mes || !ano" @click="splitearMes">Split {{ dirName }}.TXT</button>
    </div>
    <div v-if="splitResult" class="block-message success" style="margin-top:8px">
      .SAL: {{ splitResult.sal }} | .ENT: {{ splitResult.ent }} | Total: {{ splitResult.total }}
      <br><code>{{ dirName }}.SAL</code> y <code>{{ dirName }}.ENT</code>
    </div>
  </section>

  <!-- 4. ERRORES -->
  <section class="panel">
    <div class="panel-head">
      <h2>4. Errores de conversion</h2>
      <div class="panel-tools">
        <button class="secondary small" :disabled="!mes || !ano" @click="cargarErrores">Cargar errores</button>
      </div>
    </div>
    <div v-if="errores.length" style="padding:8px">
      <div v-for="e in errores" :key="e.archivo" style="margin-bottom:12px;border:1px solid var(--border);border-radius:4px;padding:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <strong>{{ e.archivo }}</strong>
          <span class="error-text">{{ e.total }} lineas</span>
        </div>
        <div v-if="e.categorias && e.categorias.length">
          <div v-for="cat in e.categorias" :key="cat.tipo" style="margin-bottom:6px">
            <div style="font-size:13px;font-weight:500;margin-bottom:2px">
              {{ cat.tipo }} — <span class="error-text">{{ cat.cantidad }} ocurrencias</span>
            </div>
            <pre style="margin:0;font-size:11px;max-height:120px;overflow-y:auto;background:var(--bg);padding:6px;border-radius:4px;white-space:pre-wrap;word-break:break-all">{{ cat.muestras.slice(0, 5).join('\n') }}</pre>
          </div>
        </div>
        <div v-else style="font-size:12px;color:var(--muted)">(sin clasificacion de errores)</div>
      </div>
    </div>
    <div v-else-if="erroresCargados" class="block-message" style="margin-top:8px">Sin errores registrados</div>
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
        <span>{{ r.convertidos ?? r.insertados ?? '—' }}</span>
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
const insertando = ref(false)
const conversionResult = ref('')
const bdResultado = ref('')
const error = ref('')
const resumen = ref([])
const splitResult = ref(null)
const errores = ref([])
const erroresCargados = ref(false)

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

const tableName = computed(() => dirName.value ? 'CDR' + dirName.value : '')

let socket = null

onMounted(() => {
  socket = io({ path: '/socket.io' })
  socket.on('trafico-progress', (data) => {
    if (data.fase === 'iniciando-conversion') {
      convTotalArchivos.value = data.totalArchivos || 1
      convArchivoActual.value = 0
      convPct.value = 0
      convLabel.value = 'Iniciando conversion...'
    } else if (data.fase === 'conversion-archivo') {
      convArchivoActual.value = data.archivoActual
      convTotalArchivos.value = data.totalArchivos
      convPct.value = data.totalArchivos > 0 ? Math.round((data.archivoActual / data.totalArchivos) * 100) : 0
      convLabel.value = `Procesando ${data.archivo}...`
    } else if (data.fase === 'conversion-completado') {
      convArchivoActual.value = data.archivoActual
      convPct.value = data.totalArchivos > 0 ? Math.round((data.archivoActual / data.totalArchivos) * 100) : 0
      convLabel.value = `conv:${data.convertidos} err:${data.errores} omit:${data.omitidos}`
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
      insLabel.value = `[G:${data.archivoActual}/${data.totalArchivos}] ${data.archivo}: ${data.completado}/${data.total}`
      insPctDetalle.value = data.total > 0 ? Math.round((data.completado / data.total) * 100) : 0
      insArchivoActual.value = data.archivoActual || insArchivoActual.value
      insTotalArchivos.value = data.totalArchivos || insTotalArchivos.value
      insPctGlobal.value = data.archivoActual && data.totalArchivos
        ? Math.round((data.archivoActual / data.totalArchivos) * 100)
        : insPctGlobal.value
    } else if (data.fase === 'completado') {
      insLabel.value = `[G:${data.archivoActual}/${data.totalArchivos}] ${data.archivo}: ok (ins:${data.insertados} err:${data.errores})`
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
  errores.value = []
  erroresCargados.value = false
  try {
    const res = await api.get('/trafico/archivos', { params: { mes: mes.value, ano: ano.value } })
    archivos.value = res.data.archivos
  } catch (err) {
    error.value = err.message
    archivos.value = []
  } finally {
    loading.value = false
  }
}

async function convertirArchivo(ruta) {
  try {
    const res = await api.post('/trafico/convertir', { ruta, mes: mes.value, ano: ano.value })
    conversionResult.value = `Convertido: ${res.data.convertidos} reg, Errores: ${res.data.errores}, Omitidos: ${res.data.omitidos || 0}`
  } catch (err) {
    error.value = err.message
  }
}

async function procesarMesCompleto() {
  procesando.value = true
  error.value = ''
  conversionResult.value = ''
  resumen.value = []
  convPct.value = 0
  convArchivoActual.value = 0
  convTotalArchivos.value = 0
  convLabel.value = ''
  try {
    const res = await api.post('/trafico/procesar-mes', { mes: mes.value, ano: ano.value })
    const d = res.data
    conversionResult.value = `Archivos: ${d.archivosProcesados} | Convertidos: ${d.totalConvertidos} | Omitidos: ${d.totalOmitidos || 0} | Errores: ${d.totalErrores}`
    resumen.value = d.resumen || []
  } catch (err) {
    error.value = err.message
  } finally {
    procesando.value = false
  }
}

async function crearTabla() {
  error.value = ''
  bdResultado.value = ''
  try {
    const res = await api.post('/trafico/crear-tabla', { mes: mes.value, ano: ano.value })
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
    const res = await api.post('/trafico/limpiar-tabla', { mes: mes.value, ano: ano.value })
    bdResultado.value = res.data.mensaje
  } catch (err) {
    error.value = err.message
  }
}

async function insertarMes() {
  insertando.value = true
  error.value = ''
  bdResultado.value = ''
  insPctGlobal.value = 0
  insPctDetalle.value = 0
  insArchivoActual.value = 0
  insTotalArchivos.value = 0
  insLabel.value = 'Iniciando...'
  try {
    const res = await api.post('/trafico/insertar-bd', { mes: mes.value, ano: ano.value })
    const d = res.data
    bdResultado.value = `Insertados: ${d.insertados} | Errores: ${d.errores} | Omitidos: ${d.omitidos || 0} | Total: ${d.total}\nTabla: ${d.tabla}${d.tablaCreada ? ' (creada)' : ''}`
    resumen.value = d.resumen || []
  } catch (err) {
    error.value = err.message
  } finally {
    insertando.value = false
  }
}

async function splitearMes() {
  error.value = ''
  splitResult.value = null
  try {
    const res = await api.post('/trafico/split-mes', { mes: mes.value, ano: ano.value })
    splitResult.value = res.data
  } catch (err) {
    error.value = err.message
  }
}

async function cargarErrores() {
  errores.value = []
  erroresCargados.value = false
  try {
    const res = await api.get('/trafico/errores', { params: { mes: mes.value, ano: ano.value } })
    errores.value = res.data
    erroresCargados.value = true
  } catch (err) {
    error.value = err.message
  }
}
</script>
