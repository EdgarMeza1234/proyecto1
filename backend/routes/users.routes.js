const { Router } = require('express');
const usersController = require('../controllers/users.controller');
const { authenticate, authorize } = require('../middleware/auth');
const userService = require('../services/user.service');

const router = Router();

router.get('/roles', authenticate, usersController.listRoles);
router.get('/usuarios', authenticate, usersController.list);
router.post('/usuarios', authenticate, authorize('admin'), usersController.create);
router.put('/usuarios/:id', authenticate, authorize('admin'), usersController.update);

router.put('/cambiar-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Contrasena actual y nueva contrasena son requeridas.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'La nueva contrasena debe tener al menos 6 caracteres.' });
    }
    await userService.changePassword(req.user.id, currentPassword, newPassword);
    res.json({ message: 'Contrasena actualizada correctamente.' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
