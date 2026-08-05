const erpService = require('../services/erp.service');

async function lookup(req, res, next) {
  try {
    const numero = decodeURIComponent(req.params.numero || '').trim();
    const data = await erpService.lookupPerson(numero);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

module.exports = { lookup };
