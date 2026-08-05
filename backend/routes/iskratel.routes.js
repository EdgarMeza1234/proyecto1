const { Router } = require('express');
const iskratelController = require('../controllers/iskratel.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();

router.get('/', authenticate, iskratelController.getAll);
router.get('/archivos', authenticate, iskratelController.getArchivos);
router.get('/:numero', authenticate, iskratelController.getByNumero);

module.exports = router;
