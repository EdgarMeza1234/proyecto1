const { Router } = require('express');
const os = require('os');
const multer = require('multer');
const traficoController = require('../controllers/trafico.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();

const upload = multer({
  storage: multer.diskStorage({ destination: os.tmpdir() }),
  limits: { fileSize: 500 * 1024 * 1024, files: 40 },
  fileFilter: (req, file, cb) => {
    const ok = /\.ama$/i.test(file.originalname) || file.mimetype === 'application/octet-stream' || file.mimetype === 'text/plain';
    if (ok) return cb(null, true);
    cb(new Error('Solo se permiten archivos .ama'));
  }
});

router.get('/archivos', authenticate, traficoController.listFiles);
router.post('/subir', authenticate, upload.array('archivos', 40), traficoController.subirArchivos);
router.post('/convertir', authenticate, traficoController.convertirArchivo);
router.post('/procesar-mes', authenticate, traficoController.procesarMes);
router.post('/split-mes', authenticate, traficoController.splitMes);
router.post('/crear-tabla', authenticate, traficoController.crearTabla);
router.post('/limpiar-tabla', authenticate, traficoController.limpiarTabla);
router.post('/insertar-bd', authenticate, traficoController.insertarBD);
router.get('/errores', authenticate, traficoController.leerErrores);

module.exports = router;
