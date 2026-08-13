<template>
  <section class="panel">
    <div class="panel-head">
      <div>
        <h2>Auditoria del modulo de bloques</h2>
        <p class="muted">Historial de creaciones y modificaciones de pares en la tabla MDF.</p>
      </div>
      <button type="button" class="secondary" style="font-size:12px" @click="load">Recargar</button>
    </div>

    <form class="block-toolbar" @submit.prevent="load">
      <input v-model="filtroUsuario" placeholder="Filtrar por usuario" maxlength="80" />
      <button class="primary" :disabled="loading">{{ loading ? 'Cargando...' : 'Consultar' }}</button>
    </form>

    <p v-if="error" class="error-text block-message">{{ error }}</p>
    <p v-if="!loading && !error && !auditRows.length" class="empty">No hay registros de auditoria.</p>
  </section>

  <section v-if="auditRows.length" class="panel block-panel">
    <div class="panel-head">
      <h2>{{ auditRows.length }} registros</h2>
    </div>
    <div class="table-scroll">
      <table class="registro-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Usuario</th>
            <th>Accion</th>
            <th>Central</th>
            <th>Bloq</th>
            <th>Par</th>
            <th>Dn</th>
            <th style="min-width:220px">Detalle</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in auditRows" :key="r.Id">
            <td>{{ formatDate(r.Fecha) }}</td>
            <td>{{ r.NombreCompleto || r.Usuario }} <small class="muted">({{ r.Usuario }})</small></td>
            <td><span :class="accionClass(r.Accion)">{{ r.Accion }}</span></td>
            <td>{{ r.Central }}</td>
            <td>{{ r.ParPriBloq }}</td>
            <td>{{ r.ParPriPar }}</td>
            <td>{{ r.Dn }}</td>
            <td class="muted" style="font-size:12px">{{ r.Detalle }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'

const auditRows = ref([])
const loading = ref(false)
const error = ref('')
const filtroUsuario = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = {}
    if (filtroUsuario.value.trim()) params.usuario = filtroUsuario.value.trim()
    const res = await api.get('/facilidades/auditoria', { params })
    auditRows.value = Array.isArray(res.data) ? res.data : []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleString('es-BO')
}

function accionClass(accion) {
  return accion === 'CREAR' ? 'success-text' : 'warning-text'
}

onMounted(load)
</script>

<style scoped>
.table-scroll {
  overflow-x: auto;
}
.warning-text {
  color: #eab308;
  font-weight: 600;
}
</style>
