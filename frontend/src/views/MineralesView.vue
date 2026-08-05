<template>
  <div class="minerales-container">
    <div class="page-header">
      <h1>Liquidación de Mineral</h1>
      <p class="subtitle">Sistema de cálculo de pagos por compra de mineral</p>
    </div>

    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'form' }" @click="tab = 'form'">Nueva Liquidación</button>
      <button class="tab" :class="{ active: tab === 'history' }" @click="tab = 'history'">Historial</button>
      <button class="tab" :class="{ active: tab === 'precios' }" @click="tab = 'precios'">Precios Base</button>
    </div>

    <div v-if="tab === 'precios'" class="tab-content">
      <div class="card">
        <h3>Precios Base por Mineral</h3>
        <p class="desc">Estos precios se usan como valor predeterminado al crear una nueva liquidación.</p>
        <table class="table">
          <thead>
            <tr><th>Mineral</th><th>Precio P/Ley ($us)</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="p in precios" :key="p.mineral">
              <td><strong>{{ p.mineral }}</strong></td>
              <td>
                <input type="number" step="0.01" v-model.number="p.precio_edit" class="input" />
              </td>
              <td>
                <button class="btn btn-primary btn-sm" @click="guardarPrecio(p)" :disabled="p.precio_edit === p.precio">Guardar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="tab === 'history'" class="tab-content">
      <div class="card">
        <div class="card-header">
          <h3>Historial de Liquidaciones</h3>
          <button class="btn btn-secondary" @click="cargarHistorial">Actualizar</button>
        </div>
        <div v-if="loading">Cargando...</div>
        <div v-else-if="compras.length === 0" class="empty">No hay liquidaciones registradas.</div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Lote</th><th>Productor</th><th>Fecha</th><th>Peso Neto</th><th>Zn (Ley/Precio)</th><th>Líquido Bs</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in compras" :key="c.id">
              <td>{{ c.nro_lote }}</td>
              <td>{{ c.nombre_productor }}</td>
              <td>{{ c.fecha_liquidacion }}</td>
              <td>{{ c.peso_neto.toLocaleString() }} kg</td>
              <td>{{ c.ley_zn }}% / ${{ c.precio_zn }}</td>
              <td><strong>{{ c.liquido_pagable_bs.toFixed(2) }}</strong></td>
              <td>
                <button class="btn btn-sm btn-primary" @click="verDetalle(c)">Ver</button>
                <button class="btn btn-sm btn-warning" @click="eliminar(c)">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="detalle" class="card detalle-card">
        <div class="card-header">
          <h3>Detalle de Liquidación</h3>
          <button class="btn btn-secondary" @click="detalle = null">Cerrar</button>
          <button class="btn btn-primary" @click="imprimirDetalle">Imprimir</button>
        </div>
        <div id="detalle-print" class="detalle-content">
          <div class="detalle-header">
            <h2>POTOSÍ - BOLIVIA</h2>
            <h3>LIQUIDACIÓN DE COMPLEJO DE MINERAL</h3>
            <p><strong>LOTE:</strong> {{ detalle.nro_lote }}</p>
          </div>
          <div class="detalle-grid">
            <div><strong>Productor:</strong> {{ detalle.nombre_productor }}</div>
            <div><strong>Cooperativa:</strong> {{ detalle.cooperativa || 'Particular' }}</div>
            <div><strong>Fecha de entrega:</strong> {{ detalle.fecha_entrega }}</div>
            <div><strong>Fecha de liquidación:</strong> {{ detalle.fecha_liquidacion }}</div>
            <div><strong>TC/Oficial:</strong> {{ detalle.tc_oficial }}</div>
            <div><strong>Tipo cambio:</strong> {{ detalle.tipo_cambio }}</div>
            <div><strong>Ley [Pb]:</strong> {{ detalle.ley_pb }}</div>
            <div><strong>Ley [Ag]:</strong> {{ detalle.ley_ag }}</div>
            <div><strong>Ley [Zn]:</strong> {{ detalle.ley_zn }}</div>
          </div>
          <table class="table detalle-table">
            <thead>
              <tr>
                <th>TMB</th><th>TARA</th><th>TMNB</th><th>H2O(%)</th><th>TMNS</th><th>LEY(%)</th>
                <th>KLS FINOS</th><th>LB FINAS</th><th>$US/TMN</th><th>VAL MIN $US</th><th>VAL MIN BS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{{ detalle.peso_bruto }}</td>
                <td>{{ detalle.tara }}</td>
                <td>{{ detalle.peso_neto }}</td>
                <td>{{ detalle.h2o }}</td>
                <td>{{ detalle.tmns.toFixed(2) }}</td>
                <td>{{ detalle.ley_porcentaje }}</td>
                <td>{{ detalle.kl_finos.toFixed(4) }}</td>
                <td>{{ detalle.lb_finas.toFixed(4) }}</td>
                <td>{{ detalle.precio_por_tn }}</td>
                <td>{{ detalle.val_min_usd.toFixed(2) }}</td>
                <td>{{ detalle.val_min_bs.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
          <h4>Retenciones</h4>
          <table class="table detalle-table">
            <thead><tr><th>Concepto</th><th>Tasa</th><th>Monto Bs</th></tr></thead>
            <tbody>
              <tr><td>CAJA</td><td>{{ detalle.caja }}%</td><td>{{ (detalle.val_min_bs * detalle.caja / 100).toFixed(2) }}</td></tr>
              <tr><td>COMIBOL</td><td>{{ detalle.comibol }}%</td><td>{{ (detalle.val_min_bs * detalle.comibol / 100).toFixed(2) }}</td></tr>
              <tr><td>FEDECOMIN</td><td>{{ detalle.fedecomin }}%</td><td>{{ (detalle.val_min_bs * detalle.fedecomin / 100).toFixed(2) }}</td></tr>
              <tr><td>WISTERMAN</td><td>{{ detalle.wisterman }}%</td><td>{{ (detalle.val_min_bs * detalle.wisterman / 100).toFixed(2) }}</td></tr>
              <tr><td>FENCOMIN</td><td>{{ detalle.fencomin }}%</td><td>{{ (detalle.val_min_bs * detalle.fencomin / 100).toFixed(2) }}</td></tr>
              <tr><td>REGALÍA Zn-Ag</td><td>{{ detalle.regalia_zn_ag }}%</td><td>{{ (detalle.val_min_bs * detalle.regalia_zn_ag / 100).toFixed(2) }}</td></tr>
              <tr class="total-row"><td>TOTAL RETENCIONES</td><td></td><td>{{ detalle.total_retenciones.toFixed(2) }}</td></tr>
              <tr class="total-row"><td>SUB TOTAL Bs.</td><td></td><td>{{ detalle.sub_total_bs.toFixed(2) }}</td></tr>
            </tbody>
          </table>
          <h4>Descuentos</h4>
          <table class="table detalle-table">
            <thead><tr><th>Concepto</th><th>Monto Bs</th></tr></thead>
            <tbody>
              <tr><td>ANTICIPOS</td><td>{{ detalle.anticipos.toFixed(2) }}</td></tr>
              <tr><td>TRANSPORTE</td><td>{{ detalle.transporte.toFixed(2) }}</td></tr>
              <tr><td>PORCENTAJE</td><td>{{ detalle.porcentaje_bs.toFixed(2) }}</td></tr>
              <tr><td>DIESEL Y TOPES</td><td>{{ detalle.diesel_topes.toFixed(2) }}</td></tr>
              <tr class="final-row"><td>LÍQUIDO PAGABLE Bs.</td><td><strong>{{ detalle.liquido_pagable_bs.toFixed(2) }}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="tab === 'form'" class="tab-content">
      <form @submit.prevent="guardar" class="form">
        <div class="card">
          <h3>Datos Generales</h3>
          <div class="form-grid">
            <div class="field">
              <label>Nro de Lote</label>
              <input type="text" v-model="f.nro_lote" class="input" placeholder="Ej: CA - 11" required />
            </div>
            <div class="field">
              <label>Fecha de Entrega</label>
              <input type="date" v-model="f.fecha_entrega" class="input" required />
            </div>
            <div class="field">
              <label>Fecha de Liquidación</label>
              <input type="date" v-model="f.fecha_liquidacion" class="input" required />
            </div>
            <div class="field">
              <label>Nombre y Apellido</label>
              <input type="text" v-model="f.nombre_productor" class="input" placeholder="Nombre del productor" required />
            </div>
            <div class="field">
              <label>Cooperativa</label>
              <input type="text" v-model="f.cooperativa" class="input" placeholder="Ej: Ckori Mayo" />
            </div>
            <div class="field">
              <label>TC/Oficial</label>
              <input type="number" step="0.01" v-model.number="f.tc_oficial" class="input" />
            </div>
            <div class="field">
              <label>Tipo de Cambio</label>
              <input type="number" step="0.01" v-model.number="f.tipo_cambio" class="input" />
            </div>
          </div>
        </div>

        <div class="card">
          <h3>Pesos y Humedad</h3>
          <div class="form-grid grid-3">
            <div class="field">
              <label>Peso Bruto (kg)</label>
              <input type="number" step="0.01" v-model.number="f.peso_bruto" class="input" required />
            </div>
            <div class="field">
              <label>Tara (kg)</label>
              <input type="number" step="0.01" v-model.number="f.tara" class="input" required />
            </div>
            <div class="field">
              <label>H2O (%)</label>
              <input type="number" step="0.01" v-model.number="f.h2o" class="input" />
            </div>
          </div>
          <div class="calc-result">Peso Neto: <strong>{{ res.peso_neto }} kg</strong> | TMNS: <strong>{{ res.tmns }} kg</strong></div>
        </div>

        <div class="card">
          <h3>Leyes y Precios de Mineral</h3>
          <table class="table">
            <thead>
              <tr><th>Mineral</th><th>Precio P/Ley ($us)</th><th>Ley (%)</th><th>Aporte $us/Tn</th></tr>
            </thead>
            <tbody>
              <tr><td>Pb</td>
                <td><input type="number" step="0.01" v-model.number="f.precio_pb" class="input" /></td>
                <td><input type="number" step="0.01" v-model.number="f.ley_pb" class="input" /></td>
                <td>{{ (f.precio_pb * f.ley_pb).toFixed(2) }}</td>
              </tr>
              <tr><td>Ag</td>
                <td><input type="number" step="0.01" v-model.number="f.precio_ag" class="input" /></td>
                <td><input type="number" step="0.01" v-model.number="f.ley_ag" class="input" /></td>
                <td>{{ (f.precio_ag * f.ley_ag).toFixed(2) }}</td>
              </tr>
              <tr><td>Zn</td>
                <td><input type="number" step="0.01" v-model.number="f.precio_zn" class="input" /></td>
                <td><input type="number" step="0.01" v-model.number="f.ley_zn" class="input" /></td>
                <td>{{ (f.precio_zn * f.ley_zn).toFixed(2) }}</td>
              </tr>
              <tr class="total-row"><td colspan="3"><strong>PRECIO P/Tn ($us)</strong></td>
                <td><strong>{{ res.precio_por_tn }}</strong></td>
              </tr>
            </tbody>
          </table>
          <div class="field" style="margin-top:12px">
            <label>Factor LEY (%) para cálculo de finos</label>
            <input type="number" step="0.001" v-model.number="f.ley_porcentaje" class="input" style="width:120px" />
            <small class="hint">Valor usado en KLS FINOS = TMNS × Factor (Ej: 0.07)</small>
          </div>
        </div>

        <div class="card">
          <h3>Retenciones (%)</h3>
          <div class="form-grid grid-3">
            <div class="field"><label>CAJA (%)</label><input type="number" step="0.01" v-model.number="f.caja" class="input" /></div>
            <div class="field"><label>COMIBOL (%)</label><input type="number" step="0.01" v-model.number="f.comibol" class="input" /></div>
            <div class="field"><label>FEDECOMIN (%)</label><input type="number" step="0.01" v-model.number="f.fedecomin" class="input" /></div>
            <div class="field"><label>WISTERMAN (%)</label><input type="number" step="0.01" v-model.number="f.wisterman" class="input" /></div>
            <div class="field"><label>FENCOMIN (%)</label><input type="number" step="0.01" v-model.number="f.fencomin" class="input" /></div>
            <div class="field"><label>REGALÍA Zn-Ag (%)</label><input type="number" step="0.01" v-model.number="f.regalia_zn_ag" class="input" /></div>
          </div>
        </div>

        <div class="card">
          <h3>Otros Descuentos (Bs)</h3>
          <div class="form-grid grid-4">
            <div class="field"><label>Anticipos</label><input type="number" step="0.01" v-model.number="f.anticipos" class="input" /></div>
            <div class="field"><label>Transporte</label><input type="number" step="0.01" v-model.number="f.transporte" class="input" /></div>
            <div class="field"><label>Porcentaje</label><input type="number" step="0.01" v-model.number="f.porcentaje_bs" class="input" /></div>
            <div class="field"><label>Diesel y Topes</label><input type="number" step="0.01" v-model.number="f.diesel_topes" class="input" /></div>
          </div>
        </div>

        <div class="card result-card">
          <h3>Resultado de Liquidación</h3>
          <div class="result-grid">
            <div><span>VAL MIN $US:</span> <strong>{{ res.val_min_usd.toFixed(2) }}</strong></div>
            <div><span>VAL MIN Bs:</span> <strong>{{ res.val_min_bs.toFixed(2) }}</strong></div>
            <div><span>Total Retenciones:</span> <strong class="text-red">{{ res.total_retenciones.toFixed(2) }}</strong></div>
            <div><span>Sub Total Bs:</span> <strong>{{ res.sub_total_bs.toFixed(2) }}</strong></div>
            <div class="result-total">
              <span>LÍQUIDO PAGABLE Bs:</span>
              <strong>{{ res.liquido_pagable_bs.toFixed(2) }}</strong>
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Guardando...' : 'Guardar Liquidación' }}
            </button>
            <button type="button" class="btn btn-secondary" @click="limpiarForm">Limpiar</button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { mineralesApi } from '../services/api'

const tab = ref('form')
const precios = ref([])
const compras = ref([])
const detalle = ref(null)
const loading = ref(false)
const saving = ref(false)

const f = reactive({
  nro_lote: '', fecha_entrega: '', fecha_liquidacion: '', nombre_productor: '', cooperativa: '',
  tc_oficial: 6.96, tipo_cambio: 8.5,
  peso_bruto: 0, tara: 0, h2o: 0,
  ley_pb: 0, ley_ag: 0, ley_zn: 0, precio_pb: 0, precio_ag: 0, precio_zn: 0,
  ley_porcentaje: 0.07,
  caja: 1.8, comibol: 1, fedecomin: 0.7, wisterman: 0.3, fencomin: 0.4, regalia_zn_ag: 6,
  anticipos: 0, transporte: 0, porcentaje_bs: 0, diesel_topes: 0
})

const res = computed(() => {
  const pesoNeto = Math.max(0, f.peso_bruto - f.tara)
  const tmns = pesoNeto * (1 - f.h2o)
  const precioPorTn = (f.ley_pb * f.precio_pb) + (f.ley_ag * f.precio_ag) + (f.ley_zn * f.precio_zn)
  const klFinos = tmns * f.ley_porcentaje
  const valMinUsd = (precioPorTn * tmns) / 1000
  const valMinBs = valMinUsd * f.tipo_cambio
  const totalRet = valMinBs * (f.caja + f.comibol + f.fedecomin + f.wisterman + f.fencomin + f.regalia_zn_ag) / 100
  const subTotal = valMinBs - totalRet
  const liquido = subTotal - f.anticipos - f.transporte - f.porcentaje_bs - f.diesel_topes
  return {
    peso_neto: Math.round(pesoNeto * 100) / 100,
    tmns: Math.round(tmns * 100) / 100,
    precio_por_tn: Math.round(precioPorTn * 100) / 100,
    kl_finos: Math.round(klFinos * 100) / 100,
    val_min_usd: Math.round(valMinUsd * 100) / 100,
    val_min_bs: Math.round(valMinBs * 100) / 100,
    total_retenciones: Math.round(totalRet * 100) / 100,
    sub_total_bs: Math.round(subTotal * 100) / 100,
    liquido_pagable_bs: Math.round(liquido * 100) / 100
  }
})

function limpiarForm() {
  Object.assign(f, {
    nro_lote: '', fecha_entrega: '', fecha_liquidacion: '', nombre_productor: '', cooperativa: '',
    tc_oficial: 6.96, tipo_cambio: 8.5,
    peso_bruto: 0, tara: 0, h2o: 0,
    ley_pb: 0, ley_ag: 0, ley_zn: 0, precio_pb: 0, precio_ag: 0, precio_zn: 0,
    ley_porcentaje: 0.07,
    caja: 1.8, comibol: 1, fedecomin: 0.7, wisterman: 0.3, fencomin: 0.4, regalia_zn_ag: 6,
    anticipos: 0, transporte: 0, porcentaje_bs: 0, diesel_topes: 0
  })
}

function cargarPrecios() {
  mineralesApi.getPrecios().then(res => {
    precios.value = res.data.map(p => ({ ...p, precio_edit: p.precio }))
    const map = {}
    res.data.forEach(p => { map[p.mineral] = p.precio })
    f.precio_pb = map.PB || 0
    f.precio_ag = map.AG || 0
    f.precio_zn = map.ZN || 0
  })
}

function guardarPrecio(p) {
  mineralesApi.updatePrecio(p.mineral, p.precio_edit).then(() => {
    p.precio = p.precio_edit
  })
}

function cargarHistorial() {
  loading.value = true
  mineralesApi.getCompras().then(res => {
    compras.value = res.data
  }).finally(() => { loading.value = false })
}

function verDetalle(c) {
  detalle.value = c
}

function eliminar(c) {
  if (!confirm(`Eliminar liquidación ${c.nro_lote} de ${c.nombre_productor}?`)) return
  mineralesApi.eliminarCompra(c.id).then(() => {
    compras.value = compras.value.filter(x => x.id !== c.id)
    if (detalle.value?.id === c.id) detalle.value = null
  })
}

function imprimirDetalle() {
  const printWindow = window.open('', '_blank')
  printWindow.document.write(`
    <html><head><title>Liquidación ${detalle.value.nro_lote}</title>
    <style>
      body { font-family: monospace; padding: 40px; }
      h2, h3 { text-align: center; margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid #000; padding: 6px 10px; text-align: center; font-size: 12px; }
      th { background: #eee; }
      .total-row td { font-weight: bold; background: #f5f5f5; }
      .final-row td { font-weight: bold; background: #d4edda; font-size: 14px; }
      .detalle-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 12px 0; font-size: 12px; }
      h4 { margin: 16px 0 4px; }
    </style></head><body>
    ${document.getElementById('detalle-print').innerHTML}
    <div style="display:flex;justify-content:space-between;margin-top:60px;font-size:12px">
      <div style="text-align:center"><hr style="width:200px">INTERESADO</div>
      <div style="text-align:center"><hr style="width:200px">GERENTE</div>
      <div style="text-align:center"><hr style="width:200px">CAJERO</div>
    </div>
    </body></html>
  `)
  printWindow.document.close()
  setTimeout(() => printWindow.print(), 300)
}

async function guardar() {
  if (!f.nro_lote || !f.fecha_entrega || !f.fecha_liquidacion || !f.nombre_productor) {
    alert('Complete los campos obligatorios: Lote, Fechas y Nombre')
    return
  }
  saving.value = true
  try {
    await mineralesApi.crearCompra({ ...f })
    alert('Liquidación guardada correctamente')
    limpiarForm()
  } catch (e) {
    alert('Error al guardar: ' + e.message)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  cargarPrecios()
})
</script>

<style scoped>
.minerales-container { padding: 24px; }
.page-header { margin-bottom: 8px; }
.page-header h1 { margin: 0 0 4px; font-size: 1.5rem; }
.subtitle { margin: 0 0 16px; font-size: 0.9rem; color: #94a3b8; }

.tabs { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid var(--border); }
.tab {
  padding: 10px 20px; border: none; background: transparent; color: #94a3b8;
  cursor: pointer; font-size: 0.9rem; border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.tab:hover { color: #e2e8f0; }
.tab.active { color: #3b82f6; border-bottom-color: #3b82f6; }
.tab-content { display: flex; flex-direction: column; gap: 20px; }

.card {
  background: #0f172a; border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px; padding: 20px;
}
.card h3 { margin: 0 0 8px; color: #f1f5f9; font-size: 1.05rem; }
.card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.card-header h3 { margin: 0; flex: 1; }
.desc { color: #94a3b8; font-size: 0.85rem; margin-bottom: 16px; }

.form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.grid-3 { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
.grid-4 { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }

.field { display: flex; flex-direction: column; gap: 4px; }
.field label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; }
.hint { color: #64748b; font-size: 0.7rem; margin-top: 2px; }

.input {
  padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);
  background: #1e293b; color: #e2e8f0; font-size: 0.85rem; width: 100%; box-sizing: border-box;
}
.input:focus { outline: none; border-color: #3b82f6; }

.table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.table th, .table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); }
.table th { color: #94a3b8; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; }
.table td { color: #e2e8f0; }
.table .input { min-width: 80px; }

.total-row td { font-weight: 700; color: #fbbf24; border-top: 2px solid rgba(255,255,255,0.1); }
.final-row td { font-weight: 700; color: #22c55e; font-size: 1rem; }

.calc-result { margin-top: 12px; font-size: 0.9rem; color: #94a3b8; }
.calc-result strong { color: #e2e8f0; }

.result-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.result-grid div { padding: 10px 14px; background: #1e293b; border-radius: 8px; }
.result-grid span { color: #94a3b8; font-size: 0.8rem; }
.result-grid strong { color: #e2e8f0; font-size: 1.1rem; display: block; margin-top: 2px; }
.text-red { color: #ef4444 !important; }
.result-total { grid-column: 1 / -1; background: #1e3a5f !important; }
.result-total strong { color: #22c55e !important; font-size: 1.4rem !important; }

.form-actions { display: flex; gap: 12px; margin-top: 20px; }

.btn {
  padding: 8px 16px; border: none; border-radius: 6px; font-size: 0.85rem;
  cursor: pointer; font-weight: 500; transition: all 0.2s;
}
.btn-primary { background: #2563eb; color: #fff; }
.btn-primary:hover { background: #1d4ed8; }
.btn-primary:disabled { background: #1e3a5f; cursor: not-allowed; }
.btn-secondary { background: #1e293b; color: #94a3b8; border: 1px solid rgba(255,255,255,0.08); }
.btn-secondary:hover { background: #334155; color: #e2e8f0; }
.btn-warning { background: #d97706; color: #fff; }
.btn-warning:hover { background: #b45309; }
.btn-sm { padding: 5px 10px; font-size: 0.75rem; }

.empty { color: #64748b; text-align: center; padding: 40px; font-size: 0.9rem; }

.detalle-card { margin-top: 8px; }
.detalle-content { font-family: monospace; }
.detalle-header { text-align: center; margin-bottom: 20px; }
.detalle-header h2 { margin: 0; color: #f1f5f9; font-size: 1.2rem; }
.detalle-header h3 { margin: 4px 0; color: #94a3b8; font-size: 0.95rem; }
.detalle-header p { margin: 8px 0; color: #e2e8f0; font-size: 0.9rem; }
.detalle-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin: 12px 0; font-size: 0.85rem; }
.detalle-grid div { color: #e2e8f0; }
.detalle-table { margin: 8px 0; }
.detalle-table th, .detalle-table td { font-size: 0.75rem; padding: 4px 6px; }
.detalle-content h4 { color: #f1f5f9; margin: 16px 0 4px; font-size: 0.9rem; }
</style>
