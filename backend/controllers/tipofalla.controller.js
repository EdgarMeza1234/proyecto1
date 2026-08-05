const tipoFallaService = require('../services/tipofalla.service');

async function list(req, res, next) {
  try {
    const tipos = await tipoFallaService.listTipos();
    res.json(tipos);
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const nombre = req.body?.nombre || '';
    const result = await tipoFallaService.createTipo(nombre);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = { list, create };
