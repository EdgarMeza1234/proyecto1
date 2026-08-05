<template>
  <section class="grid users-layout">
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Nuevo usuario</h2>
          <p class="muted">Crea cuentas para administradores, jefes, operadores, tecnicos y usuarios.</p>
        </div>
      </div>
      <form class="admin-form" @submit.prevent="createUser">
        <label>
          <span>Usuario</span>
          <input v-model="newUser.Usuario" required maxlength="80" placeholder="usuario.login" />
        </label>
        <label>
          <span>Nombre completo</span>
          <input v-model="newUser.NombreCompleto" required maxlength="180" placeholder="Nombre del funcionario" />
        </label>
        <label>
          <span>Rol</span>
          <select v-model="newUser.IdRol" required>
            <option value="">Seleccione...</option>
            <option v-for="role in roles" :key="role.IdRol" :value="role.IdRol">{{ role.Nombre }}</option>
          </select>
        </label>
        <label>
          <span>DN asociado</span>
          <input v-model="newUser.Dn" maxlength="20" placeholder="Solo para usuarios abonados" />
        </label>
        <label>
          <span>Estado</span>
          <select v-model="newUser.Estado">
            <option>Activo</option>
            <option>Inactivo</option>
          </select>
        </label>
        <label>
          <span>Contrasena</span>
          <input v-model="newUser.Password" type="password" required minlength="6" placeholder="Minimo 6 caracteres" />
        </label>
        <button class="primary" :disabled="saving">{{ saving ? 'Guardando...' : 'Crear usuario' }}</button>
      </form>
      <p v-if="error" class="error-text block-message">{{ error }}</p>
      <p v-if="successMsg" class="success-text block-message">{{ successMsg }}</p>
    </div>

    <div class="panel">
      <div class="panel-head">
        <h2>Usuarios registrados</h2>
        <button class="secondary" :disabled="loading" @click="loadData">{{ loading ? 'Cargando...' : 'Actualizar' }}</button>
      </div>
      <div v-if="users.length" class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Rol</th>
              <th>DN</th>
              <th>Estado</th>
              <th>Clave nueva</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.IdUsuario">
              <td>{{ user.Usuario }}</td>
              <td><input v-model="user.NombreCompleto" /></td>
              <td>
                <select v-model="user.IdRol">
                  <option v-for="role in roles" :key="role.IdRol" :value="role.IdRol">{{ role.Nombre }}</option>
                </select>
              </td>
              <td><input v-model="user.Dn" /></td>
              <td>
                <select v-model="user.Estado">
                  <option>Activo</option>
                  <option>Inactivo</option>
                </select>
              </td>
              <td><input v-model="user.Password" type="password" placeholder="Opcional" /></td>
              <td><button class="secondary" @click="updateUser(user)">Guardar</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="empty">No hay usuarios cargados.</p>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '../services/api'

const roles = ref([])
const users = ref([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const successMsg = ref('')

const newUser = reactive({
  Usuario: '', NombreCompleto: '', IdRol: '', Dn: '', Estado: 'Activo', Password: ''
})

async function loadData() {
  loading.value = true
  try {
    const [rolesRes, usersRes] = await Promise.all([
      api.get('/roles'),
      api.get('/usuarios')
    ])
    roles.value = rolesRes.data
    users.value = usersRes.data.map((u) => ({ ...u, Password: '' }))
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function createUser() {
  saving.value = true
  error.value = ''
  successMsg.value = ''
  try {
    await api.post('/usuarios', { ...newUser })
    successMsg.value = 'Usuario creado correctamente.'
    Object.assign(newUser, { Usuario: '', NombreCompleto: '', IdRol: '', Dn: '', Password: '' })
    await loadData()
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}

async function updateUser(user) {
  try {
    await api.put(`/usuarios/${user.IdUsuario}`, user)
    successMsg.value = 'Usuario actualizado correctamente.'
    await loadData()
  } catch (err) {
    error.value = err.message
  }
}

onMounted(loadData)
</script>
