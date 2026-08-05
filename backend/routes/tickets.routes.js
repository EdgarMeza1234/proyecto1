const { Router } = require('express');
const ticketsController = require('../controllers/tickets.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();

router.get('/', authenticate, ticketsController.list);
router.get('/:id', authenticate, ticketsController.detail);
router.post('/', authenticate, ticketsController.create);
router.post('/:id/seguimiento', authenticate, ticketsController.addEvent);
router.put('/:id', authenticate, ticketsController.update);
router.get('/:id/formulario', authenticate, ticketsController.printForm);

module.exports = router;
