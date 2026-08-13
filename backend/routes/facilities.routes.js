const { Router } = require('express');
const facilitiesController = require('../controllers/facilities.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.get('/dn/:dn', authenticate, facilitiesController.lookupDn);
router.get('/bloques/:bloque', authenticate, facilitiesController.lookupBlock);
router.put('/bloques/:bloque', authenticate, facilitiesController.updateBlock);
router.get('/observaciones', authenticate, facilitiesController.getObservations);
router.post('/observaciones', authenticate, facilitiesController.addObservation);
router.get('/auditoria', authenticate, authorize('admin'), facilitiesController.getAuditoria);

module.exports = router;
