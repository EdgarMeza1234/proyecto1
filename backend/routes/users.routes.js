const { Router } = require('express');
const usersController = require('../controllers/users.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.get('/roles', authenticate, usersController.listRoles);
router.get('/usuarios', authenticate, usersController.list);
router.post('/usuarios', authenticate, authorize('admin'), usersController.create);
router.put('/usuarios/:id', authenticate, authorize('admin'), usersController.update);

module.exports = router;
