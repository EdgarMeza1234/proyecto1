import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use((config) => {
  const session = localStorage.getItem('telefonia-session-v2')
  if (session) {
    const { token } = JSON.parse(session)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('telefonia-session-v2')
      window.location.hash = '#/login'
    }
    const message = error.response?.data?.message || error.message || 'Error de conexion'
    return Promise.reject(new Error(message))
  }
)

export async function openTicketFormulario(id) {
  const win = window.open('', '_blank')
  try {
    const res = await api.get(`/boletas/${id}/formulario`, { responseType: 'text' })
    if (win) {
      win.document.open()
      win.document.write(res.data)
      win.document.close()
    } else {
      const blob = new Blob([res.data], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    }
  } catch (err) {
    if (win) win.close()
    throw err
  }
}

export const iskratelApi = {
  getAll: () => api.get('/iskratel'),
  getByNumero: (numero) => api.get(`/iskratel/${encodeURIComponent(numero)}`),
  getArchivos: () => api.get('/iskratel/archivos')
}

export const nortelApi = {
  listFiles: (mes, ano) => api.get('/nortel/archivos', { params: { mes, ano } }),
  consolidar: (data) => api.post('/nortel/consolidar', data),
  split: (data) => api.post('/nortel/split', data),
  crearTabla: (data) => api.post('/nortel/crear-tabla', data),
  limpiarTabla: (data) => api.post('/nortel/limpiar-tabla', data),
  insertarBD: (data) => api.post('/nortel/insertar-bd', data)
}

export const mineralesApi = {
  getPrecios: () => api.get('/minerales/precios'),
  updatePrecio: (mineral, precio) => api.put(`/minerales/precios/${mineral}`, { precio }),
  getCompras: () => api.get('/minerales/compras'),
  getCompra: (id) => api.get(`/minerales/compras/${id}`),
  calcular: (data) => api.post('/minerales/calcular', data),
  crearCompra: (data) => api.post('/minerales/compras', data),
  eliminarCompra: (id) => api.delete(`/minerales/compras/${id}`)
}

export default api
