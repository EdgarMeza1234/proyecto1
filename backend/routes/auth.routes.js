const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Demasiados intentos de inicio de sesion. Intente nuevamente en 15 minutos.' }
});

router.post('/login', loginLimiter, authController.login);

module.exports = router;
