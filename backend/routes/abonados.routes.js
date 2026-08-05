const express = require('express')
const { getPool } = require('../db/pool')
const { authenticate, authorize } = require('../middleware/auth')

const router = express.Router()

router.use(authenticate)
router.use(authorize('operador', 'admin', 'jefe'))

router.get('/buscar', async (req, res) => {
  try {
    const pool = await getPool()
    const { telefono } = req.query

    if (!telefono) {
      return res.status(400).json({ message: 'Teléfono es requerido' })
    }

    const result = await pool.request()
      .input('telefono', telefono)
      .query(`SELECT TOP 1 nombre_abonado, direccion
              FROM trabajos
              WHERE numero_telefono = @telefono AND nombre_abonado IS NOT NULL
              ORDER BY id DESC`)

    if (result.recordset.length > 0) {
      return res.json(result.recordset[0])
    }

    res.json(null)
  } catch (err) {
    console.error('Error searching abonado:', err)
    res.status(500).json({ message: 'Error al buscar abonado' })
  }
})

module.exports = router
