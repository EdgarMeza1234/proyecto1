import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'

export const useBlockStore = defineStore('blocks', () => {
  const central = ref('')
  const block = ref('')
  const rows = ref([])
  const loading = ref(false)
  const saving = ref(false)
  const message = ref('')
  const error = ref('')

  function normalizeCode(value) {
    return String(value || '').trim().toUpperCase()
  }

  function generateRows(centralVal, blockVal) {
    return Array.from({ length: 100 }, (_, i) => ({
      ID: null,
      Dn: '',
      Central: centralVal,
      ParPriBloq: blockVal,
      ParPriPar: String(i + 1),
      ParSec: '',
      ParSecCentral: '',
      ParSecBloq: '',
      ParSecPar: '',
      Obs: ''
    }))
  }

  function normalizeRows(centralVal, blockVal, data) {
    const byPair = new Map(data.map((r) => [String(r.ParPriPar || '').trim(), r]))
    return Array.from({ length: 100 }, (_, i) => {
      const pairNum = String(i + 1)
      const existing = byPair.get(pairNum) || {}
      return {
        ID: existing.ID || null,
        Dn: existing.Dn || '',
        Central: existing.Central || centralVal,
        ParPriBloq: existing.ParPriBloq || blockVal,
        ParPriPar: existing.ParPriPar || pairNum,
        ParSec: existing.ParSec || '',
        ParSecCentral: existing.ParSecCentral || '',
        ParSecBloq: existing.ParSecBloq || '',
        ParSecPar: existing.ParSecPar || '',
        Obs: existing.Obs || ''
      }
    })
  }

  async function fetchBlock(centralVal, blockVal) {
    loading.value = true
    error.value = ''
    message.value = ''

    try {
      const params = new URLSearchParams({ central: centralVal })
      const res = await api.get(`/facilidades/bloques/${encodeURIComponent(blockVal)}?${params}`)
      const data = Array.isArray(res.data) ? res.data : []
      rows.value = normalizeRows(centralVal, blockVal, data)
      message.value = data.length ? 'Datos cargados desde SQL Server.' : 'No habia registros. Se generaron 100 pares vacios.'
    } catch (err) {
      rows.value = generateRows(centralVal, blockVal)
      error.value = `${err.message} Se muestran pares vacios.`
    } finally {
      loading.value = false
    }
  }

  async function saveBlock() {
    if (!central.value || !block.value || !rows.value.length) {
      error.value = 'No hay datos para guardar.'
      return
    }

    saving.value = true
    error.value = ''
    message.value = ''

    const rowsToSave = rows.value.map((r) => ({
      ID: r.ID || null,
      Dn: r.Dn || '',
      Central: central.value,
      ParPriBloq: block.value,
      ParPriPar: r.ParPriPar || '',
      ParSec: r.ParSec || '',
      ParSecCentral: r.ParSecCentral || '',
      ParSecBloq: r.ParSecBloq || '',
      ParSecPar: r.ParSecPar || '',
      Obs: r.Obs || ''
    }))

    try {
      const params = new URLSearchParams({ central: central.value })
      await api.put(`/facilidades/bloques/${encodeURIComponent(block.value)}?${params}`, { rows: rowsToSave })
      message.value = 'Bloque guardado correctamente en SQL Server.'
      await fetchBlock(central.value, block.value)
    } catch (err) {
      error.value = `${err.message} No se pudo guardar.`
    } finally {
      saving.value = false
    }
  }

  async function fetchObservations() {
    try {
      const res = await api.get('/facilidades/observaciones', {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      })
      const data = Array.isArray(res.data) ? res.data : []
      return ['', ...data.map((item) => item.Observacion || item).filter(Boolean).sort()]
    } catch {
      return ['']
    }
  }

  async function addObservation(obs) {
    await api.post('/facilidades/observaciones', { observacion: obs })
  }

  return {
    central, block, rows, loading, saving, message, error,
    normalizeCode, generateRows, normalizeRows,
    fetchBlock, saveBlock, fetchObservations, addObservation
  }
})
