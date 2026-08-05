<template>
  <section class="grid two">
    <div class="panel">
      <h2>API de usuarios</h2>
      <p class="muted">El panel consulta nombres y direccion del abonado usando telefono o codigo de cliente.</p>
      <div class="code-block">
        Frontend: GET /api/erp/personas/{numero}<br />
        ERP: ERP_API_URL/{numero}<br />
        Authorization en servidor: Bearer token
      </div>
      <form class="form-inline" @submit.prevent="lookupUser">
        <input v-model="phone" placeholder="Telefono o codigo de usuario" />
        <button class="primary">Consultar ERP</button>
      </form>
      <div class="lookup-result">
        <template v-if="result">
          <strong>{{ result.name }}</strong>
          <span>{{ result.address }}</span>
          <span>Codigo: {{ result.id }}</span>
          <span class="muted">Datos obtenidos desde ERP.</span>
        </template>
        <span v-if="lookupError" class="muted">{{ lookupError }}</span>
      </div>
    </div>
    <div class="panel">
      <h2>Tabla de facilidades</h2>
      <p class="muted">Relaciona usuario, par primario, par secundario, armario y caja de facil acceso.</p>
      <div class="schema">
        <span v-for="field in schemaFields" :key="field">{{ field }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import api from '../services/api'

const phone = ref('')
const result = ref(null)
const lookupError = ref('')

const schemaFields = ['usuario_id', 'telefono', 'par_primario', 'par_secundario', 'caja_facil_acceso', 'armario', 'terminal', 'estado']

async function lookupUser() {
  if (!phone.value.trim()) {
    lookupError.value = 'Ingresa un telefono para consultar.'
    result.value = null
    return
  }
  lookupError.value = ''
  result.value = null

  try {
    const res = await api.get(`/erp/personas/${encodeURIComponent(phone.value)}`)
    const source = Array.isArray(res.data) ? res.data[0] : res.data
    result.value = {
      name: source.nombreCompleto || source.NombreCompleto || source.nombre || source.Nombre || source.razonSocial || 'Nombre no disponible',
      address: source.direccion || source.Direccion || source.domicilio || 'Direccion no disponible',
      id: source.id || source.Id || source.codigo || source.Codigo || phone.value
    }
  } catch (err) {
    lookupError.value = err.message
  }
}
</script>
