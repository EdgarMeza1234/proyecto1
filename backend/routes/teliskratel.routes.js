const express = require('express');
const multer = require('multer');
const teliskratelController = require('../controllers/teliskratel.controller');
const { authenticate, authorizePermiso } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(out|txt)$/i.test(file.originalname) || file.mimetype === 'text/plain';
    if (ok) return cb(null, true);
    cb(new Error('Solo se permiten archivos .out o .txt'));
  }
});

router.use(authenticate);

router.get('/', authorizePermiso('teliskratel', 'iskratel'), teliskratelController.list);
router.get('/importaciones', authorizePermiso('teliskratel', 'iskratel'), teliskratelController.importaciones);
router.get('/archivos', authorizePermiso('teliskratel', 'iskratel'), teliskratelController.archivos);
router.get('/buscar/:numero', authorizePermiso('teliskratel', 'iskratel', 'blocks'), teliskratelController.buscar);
router.post('/importar', authorizePermiso('teliskratel'), upload.array('archivos', 20), teliskratelController.importarUpload);
router.post('/importar-data', authorizePermiso('teliskratel'), teliskratelController.importarData);
router.delete('/importaciones/:lote', authorizePermiso('teliskratel'), teliskratelController.eliminarImportacion);

module.exports = router;
