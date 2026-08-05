const { getPool, getSql } = require('../db/pool');
const reclamoService = require('../services/reclamo.service');
const { emitEvent } = require('../services/socket');

async function list(req, res, next) {
  try {
    const reclamos = await reclamoService.listReclamos();
    res.json(reclamos);
  } catch (error) {
    next(error);
  }
}

async function detail(req, res, next) {
  try {
    const id = Number(req.params.id);
    const reclamo = await reclamoService.getReclamoById(id);
    if (!reclamo) return res.status(404).json({ message: 'Reclamo no encontrado.' });

    const events = await reclamoService.getReclamoEvents(id);
    res.json({ reclamo, events });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const data = req.body?.reclamo || {};
    if (!data.Dn) {
      return res.status(400).json({ message: 'El numero telefonico es obligatorio.' });
    }

    const pool = await getPool();
    const sql = await getSql();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const result = await reclamoService.createReclamo(data, transaction);
      const tipoFallaText = data.TipoFalla ? `Tipo: ${data.TipoFalla}. ` : '';
      await reclamoService.insertReclamoEvent(transaction, result.id, {
        TipoEvento: 'Registrado',
        Titulo: 'Reclamo registrado',
        Detalle: `${tipoFallaText}${data.ReclamoDescripcion || 'Reclamo registrado por ODECO.'}`,
        Actor: data.RegistradoPor || 'ODECO',
        EstadoResultante: 'Pendiente'
      });
      await transaction.commit();
      emitEvent('reclamo:created', result);
      res.status(201).json(result);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
}

async function addEvent(req, res, next) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const sql = await getSql();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await reclamoService.insertReclamoEvent(transaction, id, req.body || {});
      await transaction.commit();
      emitEvent('reclamo:updated', { id });
      res.status(201).json({ message: 'Seguimiento registrado.' });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
}

async function review(req, res, next) {
  try {
    const id = Number(req.params.id);
    const result = await reclamoService.reviewReclamo(id, req.body || {}, req.user?.name || 'Operador');
    emitEvent('reclamo:reviewed', { id, ...result });
    if (result.boleta) {
      emitEvent('ticket:created', result.boleta);
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = { list, detail, create, addEvent, review };
