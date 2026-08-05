const express = require('express')
const { getPool, getSql } = require('../db/pool')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

router.use(authenticate)

const PERMISSION_LIST = [
  { codigo: 'dashboard', nombre: 'Tablero', modulo: 'General' },
  { codigo: 'tickets', nombre: 'Boletas', modulo: 'General' },
  { codigo: 'reclamos', nombre: 'Reclamos', modulo: 'General' },
  { codigo: 'blocks', nombre: 'Bloques', modulo: 'Facilidades' },
  { codigo: 'reports', nombre: 'Reportes', modulo: 'General' },
  { codigo: 'users', nombre: 'Usuarios', modulo: 'Admin' },
  { codigo: 'integrations', nombre: 'Integraciones', modulo: 'Admin' },
  { codigo: 'iskratel', nombre: 'Central Iskratel', modulo: 'Centrales' },
  { codigo: 'trafico', nombre: 'Trafico Iskratel', modulo: 'Centrales' },
  { codigo: 'nortel', nombre: 'Trafico Nortel', modulo: 'Centrales' },
  { codigo: 'sisatt', nombre: 'Trafico SISATT', modulo: 'Centrales' },
  { codigo: 'registro', nombre: 'Registro de Trabajos', modulo: 'General' },
  { codigo: 'permisos', nombre: 'Permisos', modulo: 'Admin' },
  { codigo: 'createTicket', nombre: 'Crear Boleta', modulo: 'Acciones' },
  { codigo: 'createReclamo', nombre: 'Crear Reclamo', modulo: 'Acciones' },
  { codigo: 'reviewReclamo', nombre: 'Revisar Reclamo', modulo: 'Acciones' },
  { codigo: 'assignTech', nombre: 'Asignar Tecnico', modulo: 'Acciones' },
  { codigo: 'distribucion', nombre: 'Distribucion', modulo: 'Acciones' },
  { codigo: 'addEvent', nombre: 'Agregar Evento', modulo: 'Acciones' },
  { codigo: 'closeTicket', nombre: 'Cerrar Boleta', modulo: 'Acciones' },
  { codigo: 'printTicket', nombre: 'Imprimir Boleta', modulo: 'Acciones' }
]

const DEFAULT_PERMISOS = {
  admin: PERMISSION_LIST.map(p => p.codigo),
  jefe: ['dashboard', 'tickets', 'reclamos', 'reports', 'iskratel', 'registro', 'trafico', 'nortel', 'sisatt', 'assignTech', 'distribucion', 'addEvent', 'closeTicket', 'printTicket'],
  operador: ['dashboard', 'tickets', 'reclamos', 'blocks', 'iskratel', 'registro', 'trafico', 'nortel', 'createTicket', 'reviewReclamo', 'addEvent', 'printTicket'],
  odeco: ['dashboard', 'tickets', 'reclamos', 'iskratel', 'createReclamo', 'addEvent', 'printTicket'],
  tecnico: ['dashboard', 'tickets', 'iskratel', 'addEvent', 'closeTicket', 'printTicket'],
  usuario: ['tickets', 'printTicket']
}

router.get('/', async (req, res) => {
  try {
    const pool = await getPool()
    const roles = await pool.request().query('SELECT IdRol, Codigo, Nombre FROM RolesSistema ORDER BY IdRol')
    const asignaciones = await pool.request().query('SELECT IdRol, PermisoCodigo FROM RolesPermisos ORDER BY IdRol, PermisoCodigo')
    const permisosPorRol = {}
    for (const row of asignaciones.recordset) {
      if (!permisosPorRol[row.IdRol]) permisosPorRol[row.IdRol] = []
      permisosPorRol[row.IdRol].push(row.PermisoCodigo)
    }
    res.json({ roles: roles.recordset, permisos: PERMISSION_LIST, asignaciones: permisosPorRol })
  } catch (err) {
    console.error('Error GET /permisos:', err)
    res.status(500).json({ message: 'Error al obtener permisos.', detail: err.message })
  }
})

router.put('/', async (req, res) => {
  try {
    const { IdRol, permisos } = req.body
    if (!IdRol || !Array.isArray(permisos)) {
      return res.status(400).json({ message: 'Se requieren IdRol y un arreglo de permisos.' })
    }
    const pool = await getPool()
    const sql = getSql()
    await pool.request()
      .input('IdRol', sql.Int, IdRol)
      .query('DELETE FROM RolesPermisos WHERE IdRol = @IdRol')
    for (const permiso of permisos) {
      await pool.request()
        .input('IdRol', sql.Int, IdRol)
        .input('PermisoCodigo', sql.VarChar(50), permiso)
        .query('INSERT INTO RolesPermisos (IdRol, PermisoCodigo) VALUES (@IdRol, @PermisoCodigo)')
    }
    res.json({ message: 'Permisos actualizados correctamente.' })
  } catch (err) {
    console.error('Error PUT /permisos:', err)
    res.status(500).json({ message: 'Error al actualizar permisos.', detail: err.message })
  }
})

async function seedPermisos() {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const pool = await getPool()
      const sql = getSql()
      await pool.request().query(`
        IF OBJECT_ID('RolesPermisos') IS NULL
        CREATE TABLE RolesPermisos (
          IdRol INT NOT NULL,
          PermisoCodigo VARCHAR(50) NOT NULL,
          CONSTRAINT PK_RolesPermisos PRIMARY KEY (IdRol, PermisoCodigo)
        )
      `)
      const countResult = await pool.request().query('SELECT COUNT(*) AS cnt FROM RolesPermisos')
      const roles = await pool.request().query('SELECT IdRol, Codigo FROM RolesSistema')

      if (countResult.recordset[0].cnt === 0) {
        for (const role of roles.recordset) {
          const permisos = DEFAULT_PERMISOS[role.Codigo] || []
          for (const permiso of permisos) {
            await pool.request()
              .input('IdRol', sql.Int, role.IdRol)
              .input('PermisoCodigo', sql.VarChar(50), permiso)
              .query('INSERT INTO RolesPermisos (IdRol, PermisoCodigo) VALUES (@IdRol, @PermisoCodigo)')
          }
        }
        console.log('[permisos] Tabla creada y permisos inicializados.')
        return
      }

      const existingPerms = await pool.request().query('SELECT PermisoCodigo FROM RolesPermisos WHERE IdRol = 1')
      const existingSet = new Set(existingPerms.recordset.map(r => r.PermisoCodigo))
      for (const perm of PERMISSION_LIST) {
        if (!existingSet.has(perm.codigo)) {
          await pool.request()
            .input('IdRol', sql.Int, 1)
            .input('PermisoCodigo', sql.VarChar(50), perm.codigo)
            .query('INSERT INTO RolesPermisos (IdRol, PermisoCodigo) VALUES (@IdRol, @PermisoCodigo)')
          console.log('[permisos] Agregado permiso faltante:', perm.codigo)
        }
      }
      console.log('[permisos] Ya inicializados.')
      return
    } catch (err) {
      console.error('[permisos] Intento ' + (attempt + 1) + ' fallo:', err.message)
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  console.error('[permisos] No se pudo inicializar tras 10 intentos.')
}

module.exports = router
module.exports.seedPermisos = seedPermisos
