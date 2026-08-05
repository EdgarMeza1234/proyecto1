const { Router } = require('express');
const tipoFallaController = require('../controllers/tipofalla.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();

router.get('/', authenticate, tipoFallaController.list);
router.post('/', authenticate, tipoFallaController.create);

module.exports = router;
