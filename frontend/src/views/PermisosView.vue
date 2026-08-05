<template>
  <div class="permisos-container">
    <div class="page-header">
      <h1>Gestión de Permisos</h1>
      <p class="subtitle">Asigne los permisos de acceso a cada rol del sistema</p>
    </div>

    <div v-if="loading" class="loading">Cargando...</div>

    <div v-else class="permisos-table-wrapper">
      <table class="permisos-table">
        <thead>
          <tr>
            <th class="perm-header">Permiso</th>
            <th class="mod-header">Módulo</th>
            <th v-for="rol in roles" :key="rol.IdRol" class="rol-header">
              {{ rol.Nombre }}
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in groupedPermisos" :key="group.modulo">
            <tr>
              <td :colspan="roles.length + 2" class="modulo-separator">
                {{ group.modulo }}
              </td>
            </tr>
            <tr v-for="perm in group.permisos" :key="perm.codigo">
              <td class="perm-cell">{{ perm.nombre }}</td>
              <td class="mod-cell">{{ perm.modulo }}</td>
              <td v-for="rol in roles" :key="rol.IdRol" class="check-cell">
                <input
                  type="checkbox"
                  :checked="hasPerm(rol.IdRol, perm.codigo)"
                  :disabled="!canEdit"
                  @change="togglePerm(rol.IdRol, perm.codigo)"
                />
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <div v-if="canEdit && changed" class="save-bar">
        <span class="changed-badge">Hay cambios sin guardar</span>
        <button class="btn btn-primary" @click="savePermisos" :disabled="saving">
          {{ saving ? 'Guardando...' : 'Guardar Cambios' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

const roles = ref([])
const permisos = ref([])
const asignaciones = ref({})
const loading = ref(true)
const saving = ref(false)
const changed = ref(false)

const canEdit = computed(() => auth.hasPermission('users'))

const groupedPermisos = computed(() => {
  const modulos = [...new Set(permisos.value.map(p => p.modulo))]
  return modulos.map(m => ({
    modulo: m,
    permisos: permisos.value.filter(p => p.modulo === m)
  }))
})

function hasPerm(idRol, codigo) {
  return asignaciones.value[idRol]?.includes(codigo)
}

function togglePerm(idRol, codigo) {
  if (!asignaciones.value[idRol]) asignaciones.value[idRol] = []
  const idx = asignaciones.value[idRol].indexOf(codigo)
  if (idx === -1) {
    asignaciones.value[idRol].push(codigo)
  } else {
    asignaciones.value[idRol].splice(idx, 1)
  }
  changed.value = true
}

async function loadPermisos() {
  loading.value = true
  try {
    const res = await api.get('/permisos')
    roles.value = res.data.roles
    permisos.value = res.data.permisos
    asignaciones.value = JSON.parse(JSON.stringify(res.data.asignaciones))
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function savePermisos() {
  saving.value = true
  try {
    for (const rol of roles.value) {
      await api.put('/permisos', {
        IdRol: rol.IdRol,
        permisos: asignaciones.value[rol.IdRol] || []
      })
    }
    changed.value = false
    await auth.loadPermissions()
  } catch (err) {
    console.error(err)
  } finally {
    saving.value = false
  }
}

onMounted(loadPermisos)
</script>

<style scoped>
.permisos-container {
  padding: 24px;
}
.page-header { margin-bottom: 24px; }
.page-header h1 { margin: 0 0 4px; font-size: 1.5rem; }
.subtitle { color: #666; margin: 0; font-size: 0.9rem; }
.loading { padding: 40px; text-align: center; color: #888; }

.permisos-table-wrapper {
  overflow-x: auto;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,.1);
}

.permisos-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;
}

.permisos-table th,
.permisos-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
  font-size: 0.85rem;
}

.permisos-table th {
  background: #f5f7fa;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
}

.perm-header { min-width: 160px; }
.mod-header { min-width: 100px; }
.rol-header { text-align: center; min-width: 90px; }

.modulo-separator {
  background: #eef2f7;
  font-weight: 700;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #555;
  padding: 6px 12px;
}

.perm-cell { font-weight: 500; }
.mod-cell { color: #888; font-size: 0.8rem; }
.check-cell { text-align: center; }

.check-cell input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #4a90d9;
}

.check-cell input[type="checkbox"]:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.save-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fff8e1;
  border-top: 2px solid #ffc107;
}

.changed-badge {
  font-size: 0.85rem;
  color: #e6a800;
}

.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  font-weight: 500;
}

.btn-primary {
  background: #4a90d9;
  color: #fff;
}

.btn-primary:hover { background: #357abd; }
.btn-primary:disabled { background: #a0c4e8; cursor: not-allowed; }

[data-theme="dark"] .permisos-table-wrapper {
  background: #0f172a;
  box-shadow: 0 1px 3px rgba(0,0,0,.3);
}
[data-theme="dark"] .permisos-table th,
[data-theme="dark"] .permisos-table td {
  border-bottom-color: rgba(255,255,255,0.08);
}
[data-theme="dark"] .permisos-table th {
  background: #141c2f;
  color: #94a3b8;
}
[data-theme="dark"] .permisos-table td {
  color: #e2e8f0;
}
[data-theme="dark"] .modulo-separator {
  background: rgba(59,130,246,0.12);
  color: #60a5fa;
}
[data-theme="dark"] .perm-cell { color: #f1f5f9; }
[data-theme="dark"] .mod-cell { color: #64748b; }
[data-theme="dark"] .page-header h1 { color: #f1f5f9; }
[data-theme="dark"] .subtitle { color: #94a3b8; }
[data-theme="dark"] .save-bar {
  background: rgba(245,158,11,0.12);
  border-top-color: #f59e0b;
}
[data-theme="dark"] .changed-badge { color: #fbbf24; }
</style>
