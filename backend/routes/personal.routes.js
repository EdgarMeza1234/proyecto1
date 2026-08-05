const express = require('express')
const { getPool } = require('../db/pool')
const { authenticate, authorize } = require('../middleware/auth')

const router = express.Router()

router.use(authenticate)
router.use(authorize('operador', 'admin', 'jefe'))

router.get('/', async (req, res) => {
  try {
    const pool = await getPool()
    const result = await pool.request()
      .query(`SELECT DISTINCT t.personal_id as id, u.cuenta as nombre
              FROM trabajos t
              LEFT JOIN usuarios u ON t.personal_id = u.id
              WHERE t.personal_id IS NOT NULL
              UNION
              SELECT id, cuenta FROM usuarios WHERE administrador = 1
              ORDER BY nombre`)
    res.json(result.recordset)
  } catch (err) {
    console.error('Error fetching personal:', err)
    res.status(500).json({ message: 'Error al obtener personal' })
  }
})

module.exports = router
