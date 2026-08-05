<template>
  <section class="grid two">
    <div class="panel">
      <h2>Reparaciones por tipo de falla</h2>
      <div class="bars">
        <div v-for="(value, label) in byFault" :key="label" class="bar-row">
          <span>{{ label }}</span>
          <div class="bar-track"><div class="bar-fill" :style="{ width: (value / maxValue) * 100 + '%' }"></div></div>
          <strong>{{ value }}</strong>
        </div>
      </div>
    </div>
    <div class="panel">
      <h2>Boletas por dia</h2>
      <div class="bars">
        <div v-for="(value, label) in byDay" :key="label" class="bar-row">
          <span>{{ label }}</span>
          <div class="bar-track"><div class="bar-fill" :style="{ width: (value / maxValue) * 100 + '%' }"></div></div>
          <strong>{{ value }}</strong>
        </div>
      </div>
    </div>
    <div class="panel">
      <h2>Boletas por mes</h2>
      <div class="bars">
        <div v-for="(value, label) in byMonth" :key="label" class="bar-row">
          <span>{{ label }}</span>
          <div class="bar-track"><div class="bar-fill" :style="{ width: (value / monthMax) * 100 + '%' }"></div></div>
          <strong>{{ value }}</strong>
        </div>
      </div>
    </div>
    <div class="panel">
      <h2>Indicadores para supervision</h2>
      <div class="report-list">
        <div v-for="ticket in store.tickets" :key="ticket.id">
          <strong>{{ ticket.id }}</strong>
          <span>{{ ticket.faultType }}</span>
          <span>{{ hoursBetween(ticket.createdAt, ticket.closedAt) }} h</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useTicketStore } from '../stores/tickets'

const store = useTicketStore()

function formatShortDate(value) {
  return new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'short' }).format(new Date(value))
}

function hoursBetween(start, end) {
  const diff = new Date(end || Date.now()) - new Date(start)
  return Math.max(0, Math.round(diff / 36e5 * 10) / 10)
}

function groupCount(keyFactory) {
  return store.tickets.reduce((acc, t) => {
    const key = keyFactory(t)
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

const byFault = computed(() => groupCount((t) => t.faultType))
const byDay = computed(() => groupCount((t) => formatShortDate(t.createdAt)))
const byMonth = computed(() => groupCount((t) => new Intl.DateTimeFormat('es-BO', { month: 'long', year: 'numeric' }).format(new Date(t.createdAt))))

const maxValue = computed(() => Math.max(...Object.values(byFault.value), ...Object.values(byDay.value), 1))
const monthMax = computed(() => Math.max(...Object.values(byMonth.value), 1))
</script>
