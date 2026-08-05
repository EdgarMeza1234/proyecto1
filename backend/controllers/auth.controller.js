const jwt = require('jsonwebtoken');
const config = require('../config/env');
const userService = require('../services/user.service');

async function login(req, res, next) {
  try {
    const username = String(req.body?.username || '').trim().slice(0, 80);
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contrasena son obligatorios.' });
    }

    const user = await userService.findByUsername(username);
    if (!user || user.Estado !== 'Activo' || !userService.verifyPassword(password, user.PasswordHash)) {
      return res.status(401).json({ message: 'Usuario o contrasena incorrectos.' });
    }

    const payload = {
      id: user.IdUsuario,
      username: user.Usuario,
      name: user.NombreCompleto,
      role: user.RolCodigo,
      roleName: user.RolNombre,
      dn: user.Dn || null
    };

    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    res.json({ token, ...payload });
  } catch (error) {
    next(error);
  }
}

module.exports = { login };
