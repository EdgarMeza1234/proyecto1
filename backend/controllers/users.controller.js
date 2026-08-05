const userService = require('../services/user.service');

async function list(req, res, next) {
  try {
    const users = await userService.listUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
}

async function listRoles(req, res, next) {
  try {
    const roles = await userService.listRoles();
    res.json(roles);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const { Usuario, Password, NombreCompleto, IdRol } = req.body || {};
    if (!Usuario || !Password || !NombreCompleto || !IdRol) {
      return res.status(400).json({ message: 'Usuario, contrasena, nombre completo y rol son obligatorios.' });
    }
    await userService.createUser(req.body);
    res.status(201).json({ message: 'Usuario creado correctamente.' });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    await userService.updateUser(id, req.body);
    res.json({ message: 'Usuario actualizado correctamente.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, listRoles, create, update };
