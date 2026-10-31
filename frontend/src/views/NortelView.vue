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
      Carpeta de trabajo en el servidor: <code>{{ dirName }}</code> |
      Tabla BD: <code>{{ tableName }}</code>
    </div>
  </section>

  <!-- 0. SUBIR ARCHIVOS -->
  <section class="panel">
    <div class="panel-head">
      <div>
        <h2>0. Subir archivos crudos desde mi PC</h2>
        <p class="muted">
          Los archivos de Nortel se copian al servidor dentro de la carpeta del mes/anio seleccionado.
          Elija primero Mes y Anio, seleccione los archivos y presione Subir.
        </p>
      </div>
    </div>
    <div class="block-toolbar" style="gap:12px;flex-wrap:wrap;align-items:center">
      <input ref="fileInput" type="file" multiple @change="onFilesSelected" />
      <button class="primary" :disabled="uploading || !selectedFiles.length || !mes || !ano" @click="subirArchivos">
        {{ uploading ? 'Subiendo...' : 'Subir archivos' }}
      </button>
      <span v-if="selectedFiles.length" class="muted" style="font-size:13px">
        {{ selectedFiles.length }} archivo(s) - {{ selectedTotalMB }} MB
      </span>
    </div>
    <p v-if="selectedFiles.length && (!mes || !ano)" class="muted" style="margin-top:6px;font-size:12px">
      Seleccione Mes y Anio (arriba) para habilitar el boton "Subir archivos".
    </p>
    <div v-if="uploading" style="padding:12px 0">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px">
        <span>Subiendo archivos al servidor...</span><span>{{ uploadPct }}%</span>
      </div>
      <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden">
        <div style="height:100%;background:var(--accent);transition:width 0.3s" :style="{ width: uploadPct + '%' }"></div>
      </div>
    </div>
    <div v-if="uploadResult" class="block-message success" style="margin-top:8px">{{ uploadResult }}</div>
  </section>

  <!-- 1. ARCHIVOS CRUDOS -->
  <section class="panel">
    <div class="panel-head">
      <h2>1. Archivos crudos encontrados ({{ archivos.length }})</h2>
      <div class="panel-tools">
        <button class="primary" :disabled="!mes || !ano || procesando || !archivos.length" @click="consolidarTodo">
          {{ procesando ? 'Consolidando...' : 'Consolidar todo (AMAs)' }}
        </button>
      </div>
    </div>
    <p v-if="!archivos.length" class="muted" style="padding:8px 16px;font-size:13px">
      {{ carpetaExiste
        ? `La carpeta ${dirName} esta vacia: suba primero los archivos crudos de Nortel.`
        : `La carpeta ${dirName || 'MESANO'} no existe en el servidor todavía. Suba un archivo o revise Mes y Anio.` }}
    </p>

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

    <div v-if="conversionResult" class="block-message success" style="margin-top:8px">{{ conversionResult }}</div>

    <div v-if="archivos.length" class="table" style="max-height:300px;overflow-y:auto">
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

  <!-- 1.1 ARCHIVOS GENERADOS -->
  <section class="panel" v-if="dirName">
    <div class="panel-head">
      <div>
        <h2>Archivos generados en la carpeta (descargar)</h2>
        <p class="muted">
          Quedan en el servidor, en la carpeta <code>{{ dirName }}</code>.
          <code>.emc</code> es la consolidacion, <code>AMA.EMC</code> el trafico normal y <code>2001.EMC</code> los registros separados.
        </p>
      </div>
      <div class="panel-tools">
        <button class="secondary small" :disabled="!mes || !ano" @click="cargarGenerados">Actualizar</button>
      </div>
    </div>
    <div v-if="archivosGenerados.length" class="table" style="max-height:300px;overflow-y:auto">
      <div class="table-header" style="display:grid;grid-template-columns:1.6fr 1fr 0.8fr auto;gap:16px;padding:0 16px;font-weight:600;font-size:13px;color:var(--muted);margin-bottom:4px">
        <span>Archivo</span>
        <span>Tamano</span>
        <span>Modificado</span>
        <span>Accion</span>
      </div>
      <div v-for="f in archivosGenerados" :key="f.nombre" class="table-row">
        <span><code>{{ f.nombre }}</code></span>
        <span>{{ (f.tamano / 1024).toFixed(1) }} KB</span>
        <span>{{ formatoFecha(f.modificado) }}</span>
        <span>
          <button class="secondary small" :disabled="descargando === f.nombre" @click="descargarArchivo(f.nombre)">
            {{ descargando === f.nombre ? 'Descargando...' : 'Descargar' }}
          </button>
        </span>
      </div>
    </div>
    <div v-else class="block-message" style="margin-top:8px">Sin archivos generados todavia.</div>
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
      <span class="muted" style="font-size:12px">Separa de cada <code>.emc</code> los registros con destino 2001.</span>
    </div>
    <div v-if="splitResult" class="block-message success" style="margin-top:8px">
      AMA: {{ splitResult.totalAma }} | 2001: {{ splitResult.total2001 }} | Total: {{ splitResult.totalAma + splitResult.total2001 }}
      <template v-if="splitResult.total2001 === 0"> (este mes no tiene trafico 2001)</template>
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

const fileInput = ref(null)
const uploading = ref(false)
const uploadResult = ref('')
const uploadPct = ref(0)
const selectedFiles = ref([])

const archivosGenerados = ref([])
const carpetaExiste = ref(false)
const descargando = ref('')

const selectedTotalMB = computed(() => {
  const bytes = selectedFiles.value.reduce((sum, f) => sum + (f.size || 0), 0)
  return (bytes / (1024 * 1024)).toFixed(1)
})

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

async function cargarArchivos() {
  const res = await api.get('/nortel/archivos', { params: { mes: mes.value, ano: ano.value } })
  archivos.value = (res.data.archivos || []).filter(f => f.categoria === 'crudo')
  await cargarGenerados()
}

async function cargarGenerados() {
  try {
    const res = await api.get('/nortel/generados', { params: { mes: mes.value, ano: ano.value } })
    archivosGenerados.value = res.data.archivos || []
    carpetaExiste.value = !!res.data.existe
  } catch {
    archivosGenerados.value = []
    carpetaExiste.value = false
  }
}

function formatoFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-BO', { hour12: false })
}

async function descargarArchivo(nombre) {
  descargando.value = nombre
  error.value = ''
  try {
    const res = await api.get('/nortel/descargar', {
      params: { mes: mes.value, ano: ano.value, archivo: nombre },
      responseType: 'blob'
    })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (err) {
    error.value = `No se pudo descargar ${nombre}.`
  } finally {
    descargando.value = ''
  }
}

async function listarArchivos() {
  loading.value = true
  error.value = ''
  conversionResult.value = ''
  bdResultado.value = ''
  resumen.value = []
  splitResult.value = null
  try {
    await cargarArchivos()
  } catch (err) {
    error.value = err.message
    archivos.value = []
  } finally {
    loading.value = false
  }
}

function onFilesSelected(e) {
  selectedFiles.value = Array.from(e.target.files || [])
  uploadResult.value = ''
  error.value = ''
}

async function subirArchivos() {
  if (!selectedFiles.value.length) {
    error.value = 'Seleccione al menos un archivo crudo de Nortel para subir'
    return
  }
  if (!mes.value || !ano.value) {
    error.value = 'Seleccione Mes y Anio antes de subir archivos'
    return
  }
  uploading.value = true
  error.value = ''
  uploadResult.value = ''
  uploadPct.value = 0
  try {
    const formData = new FormData()
    for (const f of selectedFiles.value) formData.append('archivos', f)
    formData.append('mes', mes.value)
    formData.append('ano', ano.value)
    const res = await api.post('/nortel/subir', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (e.total) uploadPct.value = Math.round((e.loaded / e.total) * 100)
      }
    })
    uploadResult.value = `${res.data.total} archivo(s) subido(s) a la carpeta ${dirName.value}`
    selectedFiles.value = []
    if (fileInput.value) fileInput.value.value = ''
    await cargarArchivos()
  } catch (err) {
    error.value = err.message
  } finally {
    uploading.value = false
  }
}

async function consolidarUnico(archivo) {
  procesando.value = true
  error.value = ''
  conversionResult.value = ''
  try {
    const res = await api.post('/nortel/consolidar', { mes: mes.value, ano: ano.value, archivo })
    const d = res.data
    conversionResult.value = `${d.archivoSalida} generado con ${d.registros} registros (${d.omitidos} de otro mes omitidos).`
      + avisoPegados(d.lineasPegadas)
      + ' Descarguelo en "Archivos generados" para revisarlo.'
    await cargarArchivos()
  } catch (err) {
    error.value = err.message
  } finally {
    procesando.value = false
  }
}

function avisoPegados(total) {
  if (!total) return ''
  return ` ${total} linea(s) del crudo traian mas de un registro y se cortaron por separado.`
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
    const pegados = (d.resumen || []).reduce((sum, r) => sum + (r.lineasPegadas || 0), 0)
    conversionResult.value = `Archivos: ${d.archivosProcesados} | Registros: ${d.totalRegistros} | Omitidos (otro mes): ${d.totalOmitidos || 0}.`
      + avisoPegados(pegados)
      + ' Descargue el .emc desde "Archivos generados" para revisarlo.'
    resumen.value = d.resumen || []
    await cargarArchivos()
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
    await cargarArchivos()
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
