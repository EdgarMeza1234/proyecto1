# Sistema de Reparación Telefónica — Backend

API REST diseñada para gestionar boletas de reparación telefónica, reclamos registrados por ODECO, administración de facilidades de red (bloques de pares primarios), consultas a un ERP externo de personas y autenticación de usuarios con roles. Construida con **Node.js + Express + MSSQL + JWT**.

---

## Tecnologías

- **Runtime:** Node.js 18+
- **Framework:** Express 4
- **Base de datos:** Microsoft SQL Server (mssql)
- **Autenticación:** JSON Web Tokens (JWT)
- **Seguridad:** Helmet, CORS, Rate limiting, PBKDF2 para contraseñas
- **Logging:** Morgan

---

## Estructura del proyecto

```
backend/
├── server.js                 # Punto de entrada — configura Express y monta rutas
├── package.json
├── config/
│   └── env.js                # Carga variables de entorno (.env) y exporta configuración
├── db/
│   └── pool.js               # Pool de conexiones a SQL Server (singleton lazy)
├── middleware/
│   ├── auth.js               # authenticate (JWT) y authorize (roles)
│   ├── errorHandler.js       # Manejador global de errores
│   └── logger.js             # Morgan logger
├── routes/
│   ├── auth.routes.js        # POST /api/login (con rate limiting)
│   ├── tickets.routes.js     # CRUD boletas + seguimiento + formulario imprimible
│   ├── users.routes.js       # CRUD usuarios + roles
│   ├── facilities.routes.js  # Consulta/actualización de bloques de pares
│   ├── erp.routes.js         # Consulta de personas en ERP externo
│   └── reclamos.routes.js    # CRUD reclamos ODECO + revisión operador
├── controllers/
│   ├── auth.controller.js    # Lógica de login
│   ├── tickets.controller.js # Lógica de boletas
│   ├── users.controller.js   # Lógica de usuarios
│   ├── facilities.controller.js # Lógica de facilidades
│   ├── erp.controller.js     # Lógica de consulta ERP
│   └── reclamos.controller.js # Lógica de reclamos ODECO
└── services/
    ├── user.service.js       # Usuarios: CRUD, hash/verificación PBKDF2
    ├── ticket.service.js     # Boletas: CRUD, eventos, generación de códigos
    ├── erp.service.js        # Cliente HTTP para API externa de ERP
    └── reclamo.service.js    # Reclamos: CRUD, revisión, generación de boleta desde reclamo
```

---

## Requisitos

- **Node.js** v18 o superior
- **Microsoft SQL Server** accesible (local o remoto)
- Archivo `.env` en la raíz del proyecto (junto a la carpeta `backend/`)

---

## Variables de entorno (`.env`)

```env
# Puerto y host del servidor
PORT=4001
HOST=127.0.0.1

# JWT
JWT_SECRET=telefonia-reparaciones-secret-key
JWT_EXPIRES_IN=24h

# SQL Server
SQLSERVER_USER=sa
SQLSERVER_PASSWORD=tu_password
SQLSERVER_SERVER=localhost
SQLSERVER_DATABASE=Telefonia
SQLSERVER_ENCRYPT=false
SQLSERVER_TRUST_CERT=true
SQLSERVER_FACILIDADES_TABLE=FacilidadesLinea

# ERP externo (opcional)
ERP_API_URL=https://api.erp.cotapnet.com.bo/API/PersonasErp
ERP_TOKEN=tu_token
ERP_TLS_REJECT_UNAUTHORIZED=false
```

---

## Instalación y ejecución

```bash
# Instalar dependencias
cd backend
npm install

# Iniciar en producción
npm start

# Iniciar en desarrollo con recarga automática (Node --watch)
npm run dev
```

El servidor se iniciará en `http://{HOST}:{PORT}` (por defecto `http://127.0.0.1:4001`).

---

## Endpoints de la API

### Autenticación

| Método | Ruta          | Descripción                    |
|--------|---------------|--------------------------------|
| POST   | `/api/login`  | Inicia sesión y devuelve JWT   |

- **Rate limit:** 20 intentos por ventana de 15 minutos.
- **Body:** `{ "username": "...", "password": "..." }`
- **Respuesta:** `{ "token", "id", "username", "name", "role", "roleName", "dn" }`

### Boletas de reparación

Todas requieren autenticación (`Authorization: Bearer <token>`).

| Método | Ruta                            | Descripción                         |
|--------|---------------------------------|-------------------------------------|
| GET    | `/api/boletas`                  | Lista las últimas 200 boletas       |
| GET    | `/api/boletas/:id`              | Detalle de boleta + eventos         |
| POST   | `/api/boletas`                  | Crea una nueva boleta               |
| POST   | `/api/boletas/:id/seguimiento`  | Agrega un evento a la boleta        |
| GET    | `/api/boletas/:id/formulario`   | HTML imprimible de la boleta        |

### Usuarios

| Método | Ruta                  | Roles requeridos | Descripción                  |
|--------|-----------------------|------------------|------------------------------|
| GET    | `/api/roles`          | autenticado      | Lista roles disponibles      |
| GET    | `/api/usuarios`       | autenticado      | Lista usuarios del sistema   |
| POST   | `/api/usuarios`       | admin            | Crea un nuevo usuario        |
| PUT    | `/api/usuarios/:id`   | admin            | Actualiza un usuario         |

### Facilidades (bloques de pares)

| Método | Ruta                                        | Descripción                                 |
|--------|---------------------------------------------|---------------------------------------------|
| GET    | `/api/facilidades/dn/:dn`                   | Busca un DN en la tabla de facilidades      |
| GET    | `/api/facilidades/bloques/:bloque?central=` | Lista los 100 pares de un bloque            |
| PUT    | `/api/facilidades/bloques/:bloque?central=` | Actualiza o inserta pares del bloque        |
| GET    | `/api/facilidades/observaciones`            | Lista observaciones disponibles             |
| POST   | `/api/facilidades/observaciones`            | Agrega una nueva observación                |

### Reclamos telefónicos (ODECO)

| Método | Ruta                              | Roles requeridos      | Descripción                                     |
|--------|-----------------------------------|----------------------|-------------------------------------------------|
| GET    | `/api/reclamos`                   | autenticado          | Lista los últimos 200 reclamos                  |
| GET    | `/api/reclamos/:id`               | autenticado          | Detalle del reclamo + eventos                   |
| POST   | `/api/reclamos`                   | odeco, admin, operador | Crea un nuevo reclamo                         |
| POST   | `/api/reclamos/:id/seguimiento`   | autenticado          | Agrega un evento al reclamo                     |
| PUT    | `/api/reclamos/:id/revisar`       | operador, admin      | Revisa un reclamo (CerradoCentral o GeneradoBoleta) |

**Flujo de revisión:**
- El operador revisa el reclamo y decide si la falla es en **central** o en **planta externa**.
- Si es **falla en central** → el reclamo se cierra como `CerradoCentral` (no genera boleta).
- Si es **falla en planta externa** → el sistema genera automáticamente una boleta de reparación vinculada al reclamo, el estado pasa a `GeneradoBoleta`.
- ODECO puede dar seguimiento al reclamo hasta su conclusión.

### ERP externo

| Método | Ruta                          | Descripción                        |
|--------|-------------------------------|------------------------------------|
| GET    | `/api/erp/personas/:numero`   | Consulta persona por teléfono/código en ERP |

### Tipos de falla

| Método | Ruta                    | Descripción                        |
|--------|-------------------------|------------------------------------|
| GET    | `/api/tipos-falla`      | Lista los tipos de falla activos   |
| POST   | `/api/tipos-falla`      | Crea un nuevo tipo de falla        |

## Autenticación y roles

El middleware `authenticate` valida el token JWT del header `Authorization: Bearer <token>`. El middleware `authorize('admin')` restringe el acceso por rol.

Roles del sistema:
- **admin** — acceso total
- **jefe** — asigna boletas, revisa reportes, seguimiento
- **operador** — genera boletas, administra bloques, seguimiento, revisa reclamos
- **tecnico** — registra avances, cierre técnico
- **odeco** — registra reclamos telefónicos y da seguimiento hasta su conclusión
- **usuario** — consulta su atención

---

## Base de datos

Las tablas esperadas en SQL Server son:

- **`UsuariosSistema`** — usuarios del sistema (`IdUsuario`, `Usuario`, `PasswordHash`, `NombreCompleto`, `Dn`, `Estado`, `IdRol`)
- **`RolesSistema`** — roles (`IdRol`, `Codigo`, `Nombre`)
- **`BoletasReparacion`** — boletas de reparación (`IdBoleta`, `CodigoBoleta`, `Dn`, `NombreCliente`, ...)
- **`BoletaSeguimiento`** — eventos/historial de cada boleta (`IdBoleta`, `TipoEvento`, `Titulo`, `Detalle`, ...)
- **`FacilidadesLinea`** (configurable) — tabla de pares telefónicos (`ID`, `Dn`, `Central`, `ParPriBloq`, `ParPriPar`, ...)
- **`ReclamosTelefonia`** — reclamos registrados por ODECO (`IdReclamo`, `CodigoReclamo`, `Dn`, `TipoFalla`, `Estado`, `IdBoletaGenerada`, ...)
- **`ReclamoSeguimiento`** — eventos/historial de cada reclamo (`IdReclamo`, `TipoEvento`, `Titulo`, `Detalle`, ...)
- **`TiposFallaReclamo`** — catálogo de tipos de falla para reclamos (`IdTipoFalla`, `Nombre`, `Activo`)

Las contraseñas se almacenan con hash **PBKDF2** (120000 iteraciones, SHA-256, salt de 16 bytes).

---

## Seguridad

- Helmet para headers HTTP seguros
- CORS configurado
- Rate limiting en login (20 intentos / 15 min)
- JWT con expiración configurable (24h por defecto)
- Hash de contraseñas PBKDF2 con `timingSafeEqual`
- Validación y sanitización de inputs
- Transacciones SQL para operaciones críticas (creación de boletas, actualización de bloques)
