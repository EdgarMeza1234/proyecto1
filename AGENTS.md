# AGENTS.md — Guía de continuación del proyecto

Documento de traspaso para continuar el desarrollo del **Sistema de Reparación Telefónica (SISATT / COMACOTA)**.
Última actualización: 2026-10-10.

---

## 1. Descripción general

Sistema interno para gestionar boletas de reparación, reclamos (ODECO), facilidades de red (bloques MDF),
registro de trabajos, módulos de centrales (Iskratel, Nortel, SISATT, Tráfico, Teliskratel) y administración.

- **Backend:** Node.js + Express 4 + SQL Server (`mssql`) + JWT.
- **Frontend:** Vue 3 + Vite + Pinia + Vue Router (hash history).
- **DB:** SQL Server `192.168.1.151` / base `telefono`. Tabla de facilidades configurable (`SQLSERVER_FACILIDADES_TABLE`, actual: `mdf`).
- **Deploy:** Docker Compose en `/opt/empresa/apps/edgar/proyecto1`.
  - `sisatt-backend-edgar` → `3001:4001`
  - `sisatt-frontend-edgar` → `3002:80`
  - Funnel público: `https://comacotap.tail1188d3.ts.net/`

---

## 2. Estructura

```
proyecto1/
├── .env                     # NO se versiona (gitignore)
├── docker-compose.yml       # servicios backend + frontend
├── AGENTS.md                # este documento
├── backend/
│   ├── server.js            # monta rutas + ensure*Tables()
│   ├── config/env.js        # carga .env
│   ├── db/pool.js           # pool mssql singleton
│   ├── middleware/auth.js   # authenticate, authorize(roles), authorizePermiso(permisos)
│   ├── routes/  controllers/  services/
│   └── data/                # archivos .out de centrales (gitignore)
└── frontend/
    └── src/
        ├── services/api.js  # axios + APIs exportadas
        ├── stores/          # Pinia (auth, blocks, reclamos, tickets...)
        ├── views/           # vistas por módulo
        ├── components/      # AppSidebar, BlockTable, modales...
        └── router/index.js
```

---

## 3. Comandos habituales

```bash
# Backend (desarrollo local)
cd backend && npm run dev        # node --watch
cd backend && npm start          # producción

# Frontend
cd frontend && npm run dev
cd frontend && npm run build     # salida en frontend/dist

# Deploy en servidor
cd /opt/empresa/apps/edgar/proyecto1
docker compose build --no-cache frontend
docker compose build backend
docker compose up -d
docker compose ps
```

> Si hay caché de assets en producción (`index.html`/CSS viejo), forzar
> `docker compose build --no-cache frontend && docker compose up -d frontend`
> y recargar con `Ctrl+F5`.

---

## 4. Autenticación y permisos

- `authenticate`: valida JWT (`Authorization: Bearer <token>`).
- `authorize('admin')`: restringe por rol.
- `authorizePermiso('x', 'y')`: verifica permiso en `RolesPermisos` vía `RolesSistema.Codigo`.
  **Admin hace bypass.** Devuelve 403 si no tiene ninguno.

Payload JWT: `{ id, username, name, role, roleName, dn }`.

- Permisos en `backend/routes/permisos.routes.js` (`PERMISSION_LIST`, `DEFAULT_PERMISOS`).
- `seedPermisos()` corre al arranque: crea `RolesPermisos`, asigna faltantes al rol admin (IdRol 1)
  y aplica espejos (`registro`→`registro1`, `iskratel`→`teliskratel`).
- Frontend: `stores/auth.js` (`DEFAULT_PERMISSIONS` como fallback + `hasPermission`).
- Menú: `components/AppSidebar.vue` (`permMap`, `all`, `groups`).

**Asignar un permiso nuevo a un rol existente:** pantalla Permisos (admin) o editar `DEFAULT_PERMISOS` + recrear fila.

---

## 5. Módulos y estado

| Módulo | Ruta front | Permiso | Estado |
|---|---|---|---|
| Tablero | `/` | `dashboard` | estable |
| Boletas | `/tickets` | `tickets` | estable |
| Reclamos | `/reclamos` | `reclamos` | estable (ver §5.1) |
| Bloques (MDF) | `/blocks` | `blocks` | estable + **búsqueda combinada** (§5.3) |
| Central Iskratel | `/iskratel` | `iskratel` | lee `.out` en disco |
| **Registro Teliskratel** | `/teliskratel` | `teliskratel` | **nuevo** (§5.3) |
| Suscripciones | `/suscripciones` | `suscripciones` | estable (§5.2) |
| Registro de Trabajo 1 | `/registro1` | `registro1` | estable (§5.2) |
| Registro de Trabajos | `/registro` | `registro` | **NO tocar** |
| Tráfico | `/trafico` | `trafico` | estable + **subida .ama por navegador** (§5.4) |
| Nortel / SISATT | `/nortel` `/sisatt` | varios | estable |
| Permisos / Auditoría | `/permisos` `/auditoria-general` | admin | estable |

### 5.1 Reclamos — resaltado por tiempo
- Umbral único **>= 24h sin cerrar** → rojo + parpadeo. `< 24h` verde. Estados `CerradoCentral`/`Cerrado` sin color.
- Lógica: `views/ReclamosView.vue` (`timeColorClass`, `timePulse`).
- Estilos: `assets/styles.css` (`@keyframes row-pulse-danger` con `box-shadow: inset` sobre `td`; **no** pintar la fila completa).

### 5.2 Suscripciones / Registro 1
- Separación: **Suscripciones** (`/suscripciones`) solo sube PDFs; **Registro de Trabajo 1** (`/registro1`) procesa formularios pendientes.
- Backend: `routes/papeletas.routes.js` → `/api/papeletas` (subir/listar/ver archivo) con `authorizePermiso('suscripciones','registro1')`.
- Servicio: `services/papeleta.service.js` (`procesarPDF`, `listarPapeletas`, `ensurePapeletasTable`).
- Al crear trabajo con `papeleta_id`, la papeleta sale de pendientes (`procesado = true`).
- **Pendiente:** integración con **ERP/API del otro sistema** (generará el formulario en otro lado).
  Cuando llegue el endpoint, reemplazar el parseo PDF por la llamada a su API, conservando la tabla de pendientes y la vista Registro de Trabajo 1. **No** eliminar el módulo actual.

### 5.3 Teliskratel (nuevo) — registro de abonados de la central
Persiste los archivos `.out` de la central y permite consultarlos, además de integrarse en Bloques.

- **Archivos fuente:** `backend/data/teliskratel.out` (formato `REG_STATUS`) y `backend/data/teliskratel6.out` (formato `IFACE`).
  - `REG_STATUS`: `|Node|Directory Number|Registration Status|Subscriber Type|Supplementary Service Set`
  - `IFACE`: `|Node|Directory Number|Basic Service|Interface / Access|Subscriber Type|Supplementary Service Set`
  - Ignorar cabecera y `[End of Document]`; solo procesar líneas que empiezan con `|`.
- **Normalización:** `dn_digitos` (solo dígitos), `estado_registro` (`REGISTRADO`/`NO_REGISTRADO`), `ip_origen`,
  `central`/`puerto` desde `Interface / Access` (`San Roque / 990`), `suspendido`, `bloqueo` (`BLOQUEO LD`/`BLOQUEO TOTAL`).
- **Tablas:**
  - `teliskratel` — un registro por línea + `lote_import`, `fecha_import`, `origen_archivo`, `tipo_formato`, `hash_linea`.
  - `teliskratel_import` — metadatos de cada importación (conteos).
  - Único `(lote_import, hash_linea)`. Índices por `dn_digitos`, `estado_registro`, `central`, `(origen_archivo, fecha_import)`.
  - `ensureTeliskratelTable()` crea tablas y, si `teliskratel` está vacía, **autocarga** los dos `.out`.
- **Servicio:** `backend/services/teliskratel.service.js`.
- **Migración manual (opcional):** `database/migrations/002_teliskratel.sql` (idempotente; crea tablas + índices igual que `ensureTeliskratelTable`, para servidores donde no arranque el backend). La 001 es `001_reclamos_direccion1_celulares.sql`.
- **Endpoints** (`/api/teliskratel`, ver §6).

### 5.4 Tráfico — carga de `.ama` por navegador
El backend corre en el servidor (Tailscale/Docker) y **no** puede leer `E:\AMAS\2026` de la PC del usuario.
Por eso los `.ama` se **suben desde el navegador** y se materializan en una carpeta de trabajo del servidor.

- **Carpeta base configurable:** `TRAFICO_BASE_DIR` (en `config/env.js` → `traficoBaseDir`).
  - Local (Windows): default `E:\AMAS\2026`.
  - Servidor (compose): `TRAFICO_BASE_DIR=/app/trafico-data` + volumen `./backend/trafico-data:/app/trafico-data`.
- Dentro de la base, los archivos viven en `<MES_ABBR><ANO>/` (ej. `AGO2026\`). Tabla de salida `CDR<MES_ABBR><ANO>`.
- **Flujo:** elegir Mes/Año → `POST /api/trafico/subir` (multipart, campo `archivos`) → se guardan los `.ama` →
  `listar archivos` → `Convertir todo a TXT` → `Insertar .ama en BD` → `Split` / `Errores`. El resto del pipeline quedó intacto.
- **Servicio:** `trafico.service.js` (`guardarArchivosSubidos` escribe en `getDirPath(mes,ano)`).
  Toda la lógica (parseo de fechas, `padWithF`, minutos, columnas `un..setdos`, `InvalidData.txt`) se conserva.
- `backend/trafico-data/` está en `.gitignore` (datos subidos, no se versiona).

---

## 6. Endpoints relevantes (nuevos)

### Teliskratel — `/api/teliskratel`
| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/` | `teliskratel`/`iskratel` | Lista paginada (`q, estado, central, origen, lote, page, limit`) |
| GET | `/importaciones` | `teliskratel`/`iskratel` | Lotes importados |
| GET | `/archivos` | `teliskratel`/`iskratel` | Archivos `.out` detectados en `data/` |
| GET | `/buscar/:numero` | `teliskratel`/`iskratel`/`blocks` | Match por **últimos 5 dígitos** |
| POST | `/importar` | `teliskratel` | Subir `.out/.txt` (multipart, campo `archivos`) |
| POST | `/importar-data` | `teliskratel` | Importar desde `backend/data/` (`{ archivos:[...] }`) |
| DELETE | `/importaciones/:lote` | `teliskratel` | Elimina lote y sus registros |

### Tráfico — `/api/trafico`
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/subir` | Sube `.ama` (multipart, campo `archivos` + `mes`,`ano`); los guarda en `<TRAFICO_BASE_DIR>/<MES><ANO>/` |
| GET | `/archivos` | Lista `.ama` de la carpeta del mes/año (`mes`, `ano`) |
| POST | `/convertir` | Convierte un `.ama` a `.TXT` (`ruta, mes, ano`) |
| POST | `/procesar-mes` | Convierte todos los `.ama` del mes a `<MES><ANO>.TXT` (progreso por socket `trafico-progress`) |
| POST | `/split-mes` | Divide `<MES><ANO>.TXT` en `.SAL`/`.ENT` |
| POST | `/crear-tabla` | Crea/valida la tabla `CDR<MES><ANO>` |
| POST | `/limpiar-tabla` | Vacía la tabla del mes |
| POST | `/insertar-bd` | Inserta los `.ama` en la tabla `CDR<MES><ANO>` |
| GET | `/errores` | Lee `ERROR`/`InvalidData.txt` de la carpeta del mes |

### Búsqueda combinada (usada por el módulo Bloques)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/facilidades/dn-combinado/:dn` | Devuelve `{ ultimos5, mdf:[...], teliskratel:[...] }` buscando por **últimos 5 dígitos** en MDF y en Teliskratel |

- `GET /api/facilidades/dn/:dn` **se conserva** (match exacto) para `TicketFormModal` y `ReclamoReviewModal`. No romper.

---

## 7. Módulo Bloques — búsqueda por teléfono

- Vista: `frontend/src/views/BlocksView.vue`.
- "Buscar por teléfono" llama **una sola vez** a `/api/facilidades/dn-combinado/:dn`.
- Muestra panel **Resultados** con:
  - Tabla **MDF** (Dn, Central, ParPriBloq, ParPriPar, ParSec, Obs). Botón "Ver bloque" carga los 100 pares de un registro.
  - Tabla **Teliskratel** (DN, estado, IP, central, puerto, abonado, servicio, origen, fecha).
- Si hay match MDF, se cargan los 100 pares y se resalta el DN (`highlightedDn`); se conserva el flujo original.
- Endpoint clásico MDF: `GET /api/facilidades/dn/:dn` → `views/...`; pares del bloque `GET /api/facilidades/bloques/:bloque?central=`.

---

## 8. Frontend — servicios expuestos (`services/api.js`)

- `api` (default): instancia axios `baseURL: /api` + interceptor de token y 401.
- `openTicketFormulario(id)`: abre el formulario de boleta en nueva ventana con token (evita `{"message":"Token requerido."}`).
- `iskratelApi`, `teliskratelApi`, `nortelApi`, `mineralesApi`, `lookupDnCombinado`.

---

## 9. Convenciones y avisos

- **NO tocar ni versionar:** `frontend/src/views/SISATTView.vue`, `frontend/src/views/RegistroTrabajosView.vue` (producción).
- **NO versionar:** `.env`, `/*.pdf`, `backend/uploads/`, `backend/data/`, `backend/trafico-data/`, `*.out` (ver `.gitignore`).
- Estilo: no agregar comentarios salvo necesidad; seguir patrones existentes (`ensureXTable`, `authorizePermiso`).
- PowerShell remoto: para comandos con comillas complejas usar `-C`/base64; `rg` no está disponible (usar `grep`/`Select-String`).
- Colores/estilos globales en `frontend/src/assets/styles.css`.

---

## 10. Pendientes / próximos pasos

1. **ERP/API formularios:** esperar endpoint del sistema externo y migrar Suscripciones (parseo PDF → API).
2. **Teliskratel:** desplegar y asignar permiso `teliskratel` a los roles que lo necesiten.
3. **Teliskratel:** programar/definir carga semanal de `.out` (hoy: botón en `/teliskratel` o autocarga si la tabla está vacía).
4. Verificar en producción la búsqueda combinada en `/#/blocks` y el pulso de Reclamos.
5. (Opcional) añadir paginación/export en `/teliskratel`.

---

## 11. Historial reciente (referencia)

- `bce1f5f` Separación Suscripciones / Registro de Trabajo 1.
- `ffae40a`, `64568e8`, `3a1c3d0`, `023c5f6`, `aa99ddf` Reclamos: umbral >=24h y parpadeo por borde.
- Formulario boleta con token (`openTicketFormulario`).
- **Sin commitear (trabajo local de esta sesión):** módulo Teliskratel (backend + frontend) y ajustes de Bloques.
- Tráfico: carga de `.ama` por navegador (`POST /api/trafico/subir`) + `TRAFICO_BASE_DIR` configurable y volumen `backend/trafico-data`.
