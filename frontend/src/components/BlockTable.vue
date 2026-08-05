<template>
  <div class="block-table-wrap">
    <table class="block-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Dn</th>
          <th>Central</th>
          <th>ParPriBloq</th>
          <th>ParPriPar</th>
          <th>ParSec</th>
          <th>Pots</th>
          <th>Armario</th>
          <th>CajDis</th>
          <th style="min-width:220px">Obs</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="index" :class="{ highlighted: highlightedDn && row.Dn && String(row.Dn).trim() === String(highlightedDn).trim() }">
          <td>{{ index + 1 }}</td>
          <td><input v-model="row.Dn" maxlength="20" /></td>
          <td><input v-model="row.Central" maxlength="50" /></td>
          <td><input v-model="row.ParPriBloq" maxlength="10" /></td>
          <td><input v-model="row.ParPriPar" maxlength="10" /></td>
          <td><input v-model="row.ParSec" maxlength="10" /></td>
          <td><input v-model="row.Pots" maxlength="10" /></td>
          <td><input v-model="row.Armario" maxlength="10" /></td>
          <td><input v-model="row.CajDis" maxlength="50" /></td>
          <td class="obs-cell">
            <select :value="row.Obs" @change="onObsChange($event, row, index)" class="obs-combo">
              <option value="">── Sin observacion ──</option>
              <option v-for="obs in observations" :key="obs" :value="obs">{{ obs }}</option>
              <option disabled>──────────</option>
              <option value="__NEW__">+ Agregar nueva...</option>
            </select>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useBlockStore } from '../stores/blocks'

defineProps({
  rows: { type: Array, required: true },
  highlightedDn: { type: String, default: '' }
})

const store = useBlockStore()
const observations = ref([''])

async function loadObservations() {
  observations.value = await store.fetchObservations()
}

async function onObsChange(event, row, index) {
  const value = event.target.value
  if (value === '__NEW__') {
    const newObs = prompt('Ingrese nueva observacion:', '')
    if (newObs && newObs.trim()) {
      try {
        await store.addObservation(newObs.trim())
        observations.value = await store.fetchObservations()
        row.Obs = newObs.trim()
      } catch {
        row.Obs = ''
      }
    } else {
      row.Obs = ''
    }
    event.target.value = row.Obs
  } else {
    row.Obs = value
  }
}

function handleReload() {
  loadObservations()
}

onMounted(() => {
  loadObservations()
  window.addEventListener('reload-observations', handleReload)
})

onUnmounted(() => {
  window.removeEventListener('reload-observations', handleReload)
})
</script>

<style scoped>
.highlighted {
  background: #2a5a2a !important;
  outline: 2px solid #4caf50;
}
.highlighted td {
  background: inherit;
}
</style>
