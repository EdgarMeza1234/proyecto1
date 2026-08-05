# Sistema de Reparación Telefónica — Frontend

Aplicación web de panel administrativo para la gestión de reparaciones telefónicas. Permite crear y dar seguimiento a boletas de reparación, administrar bloques de pares telefónicos, consultar personas desde un ERP externo, registrar reclamos telefónicos (ODECO) y generar reportes operativos. Construida con **Vue 3 + Vite + Pinia + Vue Router + Axios**.

---

## Tecnologías

- **Framework:** Vue 3 (Composition API, `<script setup>`)
- **Bundler:** Vite 8
- **Estado:** Pinia 3
- **Router:** Vue Router 4 (hash history)
- **HTTP Client:** Axios
- **Lenguaje:** JavaScript (con TypeScript para build)
- **Estilos:** CSS personalizado con propiedades CSS (tema claro/oscuro)

---

## Estructura del proyecto

```
frontend/
├── index.html                 # HTML de entrada
├── vite.config.js             # Configuración de Vite (proxy a backend)
├── package.json
├── public/
│   ├── favicon.svg            # Favicon
│   ├── icons.svg              # Sprites de iconos sociales
│   └── assets/
│       └── coma-logo.png      # Logo corporativo COM&A
└── src/
    ├── main.js                # Punto de entrada — monta la app Vue
    ├── App.vue                # Componente raíz (layout con sidebar/topbar)
    ├── assets/
    │   └── styles.css         # Hoja de estilos principal (1288 líneas)
    ├── router/
    │   └── index.js           # Configuración de rutas y guardia de autenticación
    ├── stores/
    │   ├── auth.js            # Store de autenticación (login, logout, permisos)
    │   ├── tickets.js         # Store de boletas (listado, filtros, stats)
    │   └── blocks.js          # Store de bloques de pares (carga, edición, guardado)
    ├── services/
    │   └── api.js             # Cliente Axios con interceptores (JWT + 401)
    ├── components/
    │   ├── AppTopbar.vue      # Barra superior con logo, título, usuario y botón "Nueva boleta"
    │   ├── AppSidebar.vue     # Menú lateral colapsable con navegación por roles
    │   ├── TicketFormModal.vue # Modal para crear boleta con búsqueda ERP
    │   ├── TicketDetail.vue   # Panel de detalle de boleta con timeline y acciones
    │   └── BlockTable.vue     # Tabla editable de 100 pares con combo de observaciones
    └── views/
        ├── LoginView.vue      # Pantalla de login con animación Matrix
        ├── DashboardView.vue  # Tablero con métricas y boletas activas
        ├── ReclamosView.vue   # Dashboard ODECO para reclamos telefónicos
        ├── TicketsView.vue    # Gestión de boletas con filtros y detalle
        ├── BlocksView.vue     # Administración de bloques de pares
        ├── ReportsView.vue    # Reportes gráficos (fallas, días, meses)
        ├── UsersView.vue      # CRUD de usuarios del sistema
        └── IntegrationsView.vue # Consulta a ERP y esquema de base de datos
```

---

## Requisitos

- **Node.js** v18 o superior
- El backend debe estar corriendo (ver `backend/README.md`)

---

## Instalación y ejecución

```bash
# Instalar dependencias
cd frontend
npm install

# Iniciar en modo desarrollo
npm run dev
```

La aplicación se abrirá en `http://localhost:5173`. Las peticiones a `/api/*` se redirigen automáticamente al backend en `http://127.0.0.1:4001` gracias al proxy configurado en `vite.config.js`.

### Build para producción

```bash
npm run build
```

Esto genera los archivos estáticos en la carpeta `dist/`, listos para servir desde un servidor web (Nginx, Apache, o el propio Express del backend).

### Vista previa del build

```bash
npm run preview
```

---

## Rutas

| Ruta           | Vista              | Permisos                                   |
|----------------|--------------------|--------------------------------------------|
| `/login`       | LoginView          | público (redirige a `/` si ya autenticado) |
| `/`            | DashboardView      | admin, jefe, operador, tecnico             |
| `/reclamos`    | ReclamosView       | admin, odeco, operador, jefe               |
| `/tickets`     | TicketsView        | admin, jefe, operador, tecnico, usuario    |
| `/blocks`      | BlocksView         | admin, operador                            |
| `/reports`     | ReportsView        | admin, jefe                                |
| `/users`       | UsersView          | admin                                      |
| `/integrations`| IntegrationsView   | admin                                      |

Las rutas protegidas redirigen a `/login` si no hay sesión activa.

---

## Autenticación

- El login envía `username` + `password` a `POST /api/login`.
- El token JWT recibido se almacena en `localStorage` bajo la clave `telefonia-session-v2`.
- Cada petición al backend incluye automáticamente el header `Authorization: Bearer <token>`.
- Si el backend responde con 401, se limpia la sesión y redirige al login.
- Los permisos por ruta y acción se verifican desde el store `auth` según el rol del usuario.

---

## Stores (Pinia)

### `auth`

- **Estado:** sesión del usuario (token, username, name, role, roleName)
- **Acciones:** `login()`, `logout()`, `loadSession()`
- **Helpers:** `isLoggedIn`, `hasPermission(permiso)`
- **Permisos agregados para ODECO:** `reclamos`, `createReclamo`, `reviewReclamo`

### `reclamos`

- **Estado:** lista de reclamos, filtros de búsqueda y estado, reclamo seleccionado
- **Acciones:** `fetchReclamos()`, `fetchReclamoDetail(id)`, `reviewReclamo(id, data)`
- **Derivados:** `filteredReclamos`, `selectedReclamo`, `stats` (totales, pendientes, en revisión, cerrados central, con boleta)

### `tickets`

- **Estado:** lista de boletas, filtros de búsqueda y estado, boleta seleccionada
- **Acciones:** `fetchTickets()`, `fetchTicketDetail(id)`
- **Derivados:** `filteredTickets`, `selectedTicket`, `stats` (totales, activas, urgentes, promedio horas)

### `blocks`

- **Estado:** central, bloque, filas (100 pares), loading/saving/error/message
- **Acciones:** `fetchBlock()`, `saveBlock()`, `fetchObservations()`, `addObservation()`
- **Helpers:** `generateRows()`, `normalizeRows()`

---

## Proxy de desarrollo

El archivo `vite.config.js` configura un proxy para que durante el desarrollo todas las peticiones a `/api/*` se redirijan al backend:

```js
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:4001',
      changeOrigin: true
    }
  }
}
```

Para producción, los archivos estáticos deben servirse desde el backend o desde un servidor web que apunte al mismo origen del backend.

---

## Flujo ODECO → Operador → Boleta

1. **ODECO** registra un reclamo telefónico desde la vista `ReclamosView` con datos del abonado y descripción de la falla.
2. El reclamo queda en estado `Pendiente`.
3. **Operador** (o admin) revisa el reclamo pendiente, evaluando si la falla corresponde a **central** o **planta externa**.
4. Si la falla es en **central** → el reclamo se cierra como `CerradoCentral`.
5. Si la falla es en **planta externa** → el sistema genera automáticamente una boleta de reparación vinculada al reclamo (estado `GeneradoBoleta`).
6. **ODECO** puede dar seguimiento desde su dashboard hasta que el reclamo concluya.

## Componentes destacados

- **`TicketFormModal`** — Modal que integra búsqueda por DN en la tabla de facilidades y consulta de persona en ERP para precargar datos del cliente.
- **`TicketDetail`** — Muestra información completa de la boleta, timeline de eventos, horas transcurridas y botones contextuales según permisos (asignar técnico, agregar evento, cerrar, imprimir).
- **`BlockTable`** — Tabla de 100 filas editables para administrar un bloque de pares telefónicos. Incluye combo de observaciones con opción de agregar nuevas observaciones al vuelo.
- **`LoginView`** — Pantalla de inicio con animación Matrix sobre canvas + logo corporativo.
- **`ReclamosView`** — Dashboard ODECO con métricas, listado de reclamos, filtros y panel de detalle con timeline.
- **`ReclamoFormModal`** — Modal para registrar un reclamo telefónico con consulta a ERP.
- **`ReclamoDetail`** — Panel de detalle del reclamo con datos del abonado, estado, resultado de revisión y timeline de seguimiento.
- **`ReclamoReviewModal`** — Modal para que el operador revise el reclamo, decida si es falla de central o externa y, en su caso, genere la boleta técnica.
