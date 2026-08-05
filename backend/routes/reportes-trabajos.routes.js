const express = require('express')
const { getPool } = require('../db/pool')
const { authenticate, authorize } = require('../middleware/auth')

const router = express.Router()

router.use(authenticate)
router.use(authorize('operador', 'admin', 'jefe'))

router.get('/stats', async (req, res) => {
  try {
    const pool = await getPool()

    const totalResult = await pool.request()
      .query('SELECT COUNT(*) as total FROM trabajos')
    const totalTrabajos = totalResult.recordset[0].total

    const today = new Date().toISOString().split('T')[0]
    const todayResult = await pool.request()
      .input('fecha', today)
      .query('SELECT COUNT(*) as total FROM trabajos WHERE fecha = @fecha')
    const trabajosHoy = todayResult.recordset[0].total

    const weekResult = await pool.request()
      .query(`SELECT COUNT(*) as total FROM trabajos WHERE fecha >= DATEADD(day, -7, GETDATE())`)
    const trabajosSemana = weekResult.recordset[0].total

    res.json({ totalTrabajos, trabajosHoy, trabajosSemana })
  } catch (err) {
    console.error('Error fetching stats:', err)
    res.status(500).json({ message: 'Error al obtener estadísticas' })
  }
})

module.exports = router
