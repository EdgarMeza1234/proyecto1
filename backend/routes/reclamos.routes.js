const { Router } = require('express');
const reclamosController = require('../controllers/reclamos.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.get('/', authenticate, reclamosController.list);
router.get('/:id', authenticate, reclamosController.detail);
router.post('/', authenticate, authorize('odeco', 'admin', 'operador'), reclamosController.create);
router.post('/:id/seguimiento', authenticate, reclamosController.addEvent);
router.put('/:id/revisar', authenticate, authorize('operador', 'admin'), reclamosController.review);

module.exports = router;
