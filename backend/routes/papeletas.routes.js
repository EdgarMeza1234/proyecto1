const express = require('express')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const { getPool } = require('../db/pool')
const { authenticate, authorizePermiso } = require('../middleware/auth')
const papeletaService = require('../services/papeleta.service')

const router = express.Router()

const MIMES_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

function sanitizarNombre(name) {
  let decoded = name
  try { decoded = Buffer.from(name, 'latin1').toString('utf8') } catch {}
  return decoded.replace(/[^\w.\-]+/g, '_').slice(-120)
}

const uploadPapeletas = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      try { cb(null, papeletaService.ensureUploadDir()) } catch (e) { cb(e) }
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}_${sanitizarNombre(file.originalname)}`)
    }
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    const permitido = MIMES_PERMITIDOS.includes(file.mimetype) || /\.(pdf|jpe?g|png|webp)$/i.test(file.originalname)
    if (permitido) return cb(null, true)
    cb(new Error('Formato no permitido: solo PDF o imágenes (jpg, png, webp)'))
  }
})

function userInfo(req) {
  return req.user.username || req.user.cuenta || 'desconocido'
}

router.use(authenticate)

router.post('/', authorizePermiso('suscripciones'), (req, res) => {
  uploadPapeletas.array('archivos', 10)(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ message: uploadErr.message })
    }
    const files = req.files || []
    if (!files.length) {
      return res.status(400).json({ message: 'No se recibieron archivos' })
    }
    try {
      const pool = await getPool()
      const resultados = []
      for (const file of files) {
        let campos = null
        let advertencias = []
        try {
          if (file.mimetype === 'application/pdf') {
            const parsed = await papeletaService.procesarPDF(fs.readFileSync(file.path))
            campos = parsed.campos
            advertencias = parsed.advertencias
          } else {
            advertencias = ['Imagen sin lectura automática (solo PDF): complete los datos manualmente']
          }
        } catch (parseErr) {
          console.error('Error parseando papeleta:', parseErr.message)
          advertencias = ['No se pudo leer el archivo: ' + parseErr.message]
        }

        const nombreOriginal = (() => {
          try { return Buffer.from(file.originalname, 'latin1').toString('utf8') } catch { return file.originalname }
        })()

        const inserted = await pool.request()
          .input('nombre_original', nombreOriginal)
          .input('ruta', file.path)
          .input('mime', file.mimetype)
          .input('tamano', file.size)
          .input('campos', campos ? JSON.stringify(campos) : null)
          .input('creado_por', userInfo(req))
          .query(`INSERT INTO trabajos_papeletas (nombre_original, ruta, mime, tamano, campos, creado_por)
                  OUTPUT INSERTED.id
                  VALUES (@nombre_original, @ruta, @mime, @tamano, @campos, @creado_por)`)

        resultados.push({
          id: inserted.recordset[0].id,
          nombre: nombreOriginal,
          mime: file.mimetype,
          tamano: file.size,
          campos,
          advertencias
        })
      }
      res.status(201).json(resultados)
    } catch (err) {
      console.error('Error subiendo papeletas:', err)
      res.status(500).json({ message: 'Error al procesar las papeletas' })
    }
  })
})

router.get('/', authorizePermiso('suscripciones', 'registro1'), async (req, res) => {
  try {
    const soloPendientes = req.query.pendientes === '1' || req.query.pendientes === 'true'
    const papeletas = await papeletaService.listarPapeletas({ soloPendientes })
    res.json(papeletas)
  } catch (err) {
    console.error('Error listando papeletas:', err)
    res.status(500).json({ message: 'Error al listar las papeletas' })
  }
})

router.get('/:id/archivo', authorizePermiso('suscripciones', 'registro1'), async (req, res) => {
  try {
    const pool = await getPool()
    const id = parseInt(req.params.id)
    if (!id) return res.status(400).json({ message: 'ID inválido' })

    const result = await pool.request()
      .input('id', id)
      .query('SELECT ruta, nombre_original, mime FROM trabajos_papeletas WHERE id = @id')

    if (!result.recordset.length) {
      return res.status(404).json({ message: 'Papeleta no encontrada' })
    }

    const row = result.recordset[0]
    const baseDir = papeletaService.ensureUploadDir()
    const rutaAbs = path.resolve(row.ruta)
    if (!rutaAbs.startsWith(path.resolve(baseDir))) {
      return res.status(400).json({ message: 'Ruta inválida' })
    }
    if (!fs.existsSync(rutaAbs)) {
      return res.status(404).json({ message: 'El archivo no existe en el servidor' })
    }

    res.setHeader('Content-Type', row.mime || 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename="${row.nombre_original || 'papeleta'}"`)
    fs.createReadStream(rutaAbs).pipe(res)
  } catch (err) {
    console.error('Error sirviendo papeleta:', err)
    res.status(500).json({ message: 'Error al obtener la papeleta' })
  }
})

module.exports = router
