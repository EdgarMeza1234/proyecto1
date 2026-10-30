const { Router } = require('express');
const os = require('os');
const path = require('path');
const multer = require('multer');
const nortelController = require('../controllers/nortel.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();

const upload = multer({
  storage: multer.diskStorage({ destination: os.tmpdir() }),
  limits: { fileSize: 500 * 1024 * 1024, files: 40 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const ok = !ext || ['.txt', '.log', '.ama', '.dat', '.cdr'].includes(ext);
    if (ok) return cb(null, true);
    cb(new Error('Solo se permiten archivos crudos de Nortel (.txt, .log, .ama, .dat, .cdr o sin extension)'));
  }
});

router.get('/archivos', authenticate, nortelController.listFiles);
router.get('/generados', authenticate, nortelController.listarGenerados);
router.get('/descargar', authenticate, nortelController.descargar);
router.post('/subir', authenticate, upload.array('archivos', 40), nortelController.subirArchivos);
router.post('/consolidar', authenticate, nortelController.consolidar);
router.post('/split', authenticate, nortelController.split);
router.post('/crear-tabla', authenticate, nortelController.crearTabla);
router.post('/limpiar-tabla', authenticate, nortelController.limpiarTabla);
router.post('/insertar-bd', authenticate, nortelController.insertarBD);

module.exports = router;
