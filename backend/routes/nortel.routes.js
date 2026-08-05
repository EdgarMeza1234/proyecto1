const { Router } = require('express');
const nortelController = require('../controllers/nortel.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();

router.get('/archivos', authenticate, nortelController.listFiles);
router.post('/consolidar', authenticate, nortelController.consolidar);
router.post('/split', authenticate, nortelController.split);
router.post('/crear-tabla', authenticate, nortelController.crearTabla);
router.post('/limpiar-tabla', authenticate, nortelController.limpiarTabla);
router.post('/insertar-bd', authenticate, nortelController.insertarBD);

module.exports = router;
