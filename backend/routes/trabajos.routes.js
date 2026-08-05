const express = require('express')
const { getPool } = require('../db/pool')
const { authenticate, authorize } = require('../middleware/auth')

const router = express.Router()

router.use(authenticate)
router.use(authorize('operador', 'admin', 'jefe'))

router.get('/', async (req, res) => {
  try {
    const pool = await getPool()
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 15
    const offset = (page - 1) * limit
    const search = req.query.search || ''
    const fecha = req.query.fecha || ''
    const mes = req.query.mes || ''
    const anio = req.query.anio || ''
    const personal_id = req.query.personal_id || ''
    const tipo_trabajo = req.query.tipo_trabajo || ''

    let where = 'WHERE 1=1'
    const inputs = []

    if (search) {
      where += ` AND (t.formulario LIKE @search
                   OR t.numero_telefono LIKE @search
                   OR t.nombre_abonado LIKE @search
                   OR t.registrado_por LIKE @search
                   OR t.autorizado_nombre LIKE @search
                   OR t.autorizado_apellido LIKE @search)`
      inputs.push({ name: 'search', value: `%${search}%` })
    }

    if (fecha) {
      where += ' AND t.fecha = @fecha'
      inputs.push({ name: 'fecha', value: fecha })
    }

    if (mes) {
      where += " AND FORMAT(t.fecha, 'yyyy-MM') = @mes"
      inputs.push({ name: 'mes', value: mes })
    }

    if (anio) {
      where += ' AND YEAR(t.fecha) = @anio'
      inputs.push({ name: 'anio', value: parseInt(anio) })
    }

    if (personal_id) {
      where += ' AND t.personal_id = @personal_id'
      inputs.push({ name: 'personal_id', value: parseInt(personal_id) })
    }

    if (tipo_trabajo) {
      where += ' AND t.tipo_trabajo LIKE @tipo_trabajo'
      inputs.push({ name: 'tipo_trabajo', value: `%${tipo_trabajo}%` })
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM trabajos t
      ${where}`

    const countRequest = pool.request()
    inputs.forEach(inp => { countRequest.input(inp.name, inp.value) })
    const countResult = await countRequest.query(countQuery)
    const total = countResult.recordset[0].total

    const dataQuery = `
      SELECT t.*
      FROM trabajos t
      ${where}
      ORDER BY t.id DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY`

    const dataRequest = pool.request()
    inputs.forEach(inp => { dataRequest.input(inp.name, inp.value) })
    const dataResult = await dataRequest.query(dataQuery)

    const data = dataResult.recordset.map(row => {
      let hora = null
      if (row.hora) {
        if (typeof row.hora === 'string') {
          hora = row.hora.substring(0, 5)
        } else if (row.hora instanceof Date) {
          const hh = String(row.hora.getHours()).padStart(2, '0')
          const mm = String(row.hora.getMinutes()).padStart(2, '0')
          hora = `${hh}:${mm}`
        }
      }
      return { ...row, hora }
    })

    res.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    })
  } catch (err) {
    console.error('Error fetching trabajos:', err)
    res.status(500).json({ message: 'Error al obtener trabajos' })
  }
})

router.get('/verificar-formulario', async (req, res) => {
  try {
    const pool = await getPool()
    const { formulario } = req.query
    if (!formulario) return res.status(400).json({ message: 'Formulario es requerido' })

    const result = await pool.request()
      .input('formulario', formulario)
      .query('SELECT COUNT(*) as count FROM trabajos WHERE formulario = @formulario')

    res.json({ exists: result.recordset[0].count > 0 })
  } catch (err) {
    console.error('Error verifying formulario:', err)
    res.status(500).json({ message: 'Error al verificar formulario' })
  }
})

router.get('/autocomplete-autorizado', async (req, res) => {
  try {
    const pool = await getPool()
    const q = (req.query.q || '').trim()
    const result = await pool.request()
      .input('q', `%${q}%`)
      .query(`SELECT DISTINCT TOP 20 autorizado_nombre
              FROM trabajos
              WHERE autorizado_nombre IS NOT NULL
                AND autorizado_nombre LIKE @q
              ORDER BY autorizado_nombre`)
    res.json(result.recordset.map(r => r.autorizado_nombre))
  } catch (err) {
    console.error('Error autocomplete autorizado:', err)
    res.status(500).json({ message: 'Error al buscar autorizados' })
  }
})

router.post('/', async (req, res) => {
  try {
    const pool = await getPool()
    const { formulario, numero_telefono, nombre_abonado, direccion, tipo_trabajo, observaciones, autorizado_nombre, personal } = req.body

    if (!numero_telefono || !nombre_abonado || !tipo_trabajo) {
      return res.status(400).json({ message: 'Campos requeridos incompletos' })
    }

    const formVal = (formulario || '').trim()
    const authNombre = (autorizado_nombre || personal || '').trim()

    if (!formVal && !authNombre) {
      return res.status(400).json({ message: 'Si no ingresa Formulario, debe especificar quién autoriza' })
    }

    let warning = null
    if (formVal) {
      const dupCheck = await pool.request()
        .input('formulario', formVal)
        .query('SELECT COUNT(*) as count FROM trabajos WHERE formulario = @formulario')

      if (dupCheck.recordset[0].count > 0) {
        warning = 'Este número de formulario ya existe en otro registro'
      }
    }

    const fecha = new Date().toISOString().split('T')[0]
    const hora = new Date().toTimeString().split(' ')[0].substring(0, 8)

    const nextId = await pool.request()
      .query('SELECT ISNULL(MAX(id), 0) + 1 AS nextId FROM trabajos')

    await pool.request()
      .input('id', nextId.recordset[0].nextId)
      .input('formulario', formVal || null)
      .input('numero_telefono', numero_telefono)
      .input('nombre_abonado', nombre_abonado)
      .input('direccion', direccion || '')
      .input('tipo_trabajo', tipo_trabajo)
      .input('observaciones', observaciones || '')
      .input('autorizado_nombre', authNombre || null)
      .input('autorizado_apellido', null)
      .input('personal', authNombre || null)
      .input('fecha', fecha)
      .input('hora', hora)
      .input('registrado_por', req.user.username || req.user.cuenta)
      .query(`INSERT INTO trabajos (id, formulario, numero_telefono, nombre_abonado, direccion, tipo_trabajo, observaciones, autorizado_nombre, autorizado_apellido, personal, fecha, hora, registrado_por)
              VALUES (@id, @formulario, @numero_telefono, @nombre_abonado, @direccion, @tipo_trabajo, @observaciones, @autorizado_nombre, @autorizado_apellido, @personal, @fecha, @hora, @registrado_por)`)

    const response = { message: 'Trabajo registrado correctamente', formulario: formVal }
    if (warning) response.warning = warning
    res.status(201).json(response)
  } catch (err) {
    console.error('Error creating trabajo:', err)
    res.status(500).json({ message: 'Error al registrar trabajo' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const pool = await getPool()
    const { id } = req.params
    const { formulario, numero_telefono, nombre_abonado, direccion, tipo_trabajo, observaciones, autorizado_nombre, personal } = req.body

    if (!numero_telefono || !nombre_abonado || !tipo_trabajo) {
      return res.status(400).json({ message: 'Campos requeridos incompletos' })
    }

    const formVal = (formulario || '').trim()
    const authNombre = (autorizado_nombre || personal || '').trim()

    if (!formVal && !authNombre) {
      return res.status(400).json({ message: 'Si no ingresa Formulario, debe especificar quién autoriza' })
    }

    let warning = null
    if (formVal) {
      const dupCheck = await pool.request()
        .input('formulario', formVal)
        .input('id', parseInt(id))
        .query('SELECT COUNT(*) as count FROM trabajos WHERE formulario = @formulario AND id != @id')

      if (dupCheck.recordset[0].count > 0) {
        warning = 'Este número de formulario ya existe en otro registro'
      }
    }

    const result = await pool.request()
      .input('id', parseInt(id))
      .input('formulario', formVal || null)
      .input('numero_telefono', numero_telefono)
      .input('nombre_abonado', nombre_abonado)
      .input('direccion', direccion || '')
      .input('tipo_trabajo', tipo_trabajo)
      .input('observaciones', observaciones || '')
      .input('autorizado_nombre', authNombre || null)
      .input('autorizado_apellido', null)
      .input('personal', authNombre || null)
      .query(`UPDATE trabajos SET
                formulario = @formulario, numero_telefono = @numero_telefono,
                nombre_abonado = @nombre_abonado, direccion = @direccion,
                tipo_trabajo = @tipo_trabajo, observaciones = @observaciones,
                autorizado_nombre = @autorizado_nombre, autorizado_apellido = @autorizado_apellido,
                personal = @personal
              WHERE id = @id`)

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Trabajo no encontrado' })
    }

    const response = { message: 'Trabajo actualizado correctamente' }
    if (warning) response.warning = warning
    res.json(response)
  } catch (err) {
    console.error('Error updating trabajo:', err)
    res.status(500).json({ message: 'Error al actualizar trabajo' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const pool = await getPool()
    const { id } = req.params

    const result = await pool.request()
      .input('id', parseInt(id))
      .query('DELETE FROM trabajos WHERE id = @id')

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Trabajo no encontrado' })
    }

    res.json({ message: 'Trabajo eliminado correctamente' })
  } catch (err) {
    console.error('Error deleting trabajo:', err)
    res.status(500).json({ message: 'Error al eliminar trabajo' })
  }
})

module.exports = router
