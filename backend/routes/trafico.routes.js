const { Router } = require('express');
const traficoController = require('../controllers/trafico.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();

router.get('/archivos', authenticate, traficoController.listFiles);
router.post('/convertir', authenticate, traficoController.convertirArchivo);
router.post('/procesar-mes', authenticate, traficoController.procesarMes);
router.post('/split-mes', authenticate, traficoController.splitMes);
router.post('/crear-tabla', authenticate, traficoController.crearTabla);
router.post('/limpiar-tabla', authenticate, traficoController.limpiarTabla);
router.post('/insertar-bd', authenticate, traficoController.insertarBD);
router.get('/errores', authenticate, traficoController.leerErrores);

module.exports = router;
