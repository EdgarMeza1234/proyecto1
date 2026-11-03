const ExcelJS = require('exceljs');
const { getPool, getSql } = require('../db/pool');
const reclamoService = require('../services/reclamo.service');
const ticketService = require('../services/ticket.service');
const { emitEvent } = require('../services/socket');

const TZ = 'America/La_Paz';

function isoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = {};
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  return `${values.year}-${values.month}-${values.day}`;
}

function addDaysIso(iso, days) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && isoDate(date) === value;
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function getDateRange(query) {
  const today = isoDate();
  let desde = String(query.desde || '').trim();
  let hasta = String(query.hasta || '').trim();

  if (desde && !validIsoDate(desde)) throw badRequest('Fecha desde invalida.');
  if (hasta && !validIsoDate(hasta)) throw badRequest('Fecha hasta invalida.');

  if (!desde && !hasta) {
    hasta = today;
    desde = addDaysIso(today, -4);
  } else if (!desde) {
    desde = addDaysIso(hasta, -4);
  } else if (!hasta) {
    hasta = today;
  }

  if (desde > hasta) throw badRequest('La fecha desde no puede ser mayor que la fecha hasta.');
  return { desde, hasta };
}

async function historial(req, res, next) {
  try {
    const dn = decodeURIComponent(req.params.dn || '').trim();
    if (!dn) return res.status(400).json({ message: 'Debe enviar el numero telefonico.' });

    const historial = await reclamoService.getAbonadoHistorial(dn);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(historial);
  } catch (error) {
    next(error);
  }
}

function rangoDeBusqueda(query) {
  const q = String(query.q || '').trim() || undefined;
  // Con busqueda el rango no se aplica, y tampoco se valida: una fecha a medio escribir
  // no puede responder 400 a quien solo quiere ver un registro viejo.
  return { q, ...(q ? {} : getDateRange(query)) };
}

async function list(req, res, next) {
  try {
    const filtros = rangoDeBusqueda(req.query);
    const reclamos = await reclamoService.listReclamos({ ...filtros, limit: 1000 });
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(reclamos);
  } catch (error) {
    next(error);
  }
}

async function exportExcel(req, res, next) {
  try {
    const { q, desde, hasta } = rangoDeBusqueda(req.query);
    const estado = String(req.query.estado || '').trim() || undefined;
    const reclamos = await reclamoService.listReclamos({ desde, hasta, limit: null, estado, q });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SISATT';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Reclamos');
    worksheet.columns = [
      { header: 'Código reclamo', key: 'CodigoReclamo', width: 18 },
      { header: 'Teléfono', key: 'Dn', width: 14 },
      { header: 'Celulares', key: 'Celulares', width: 16 },
      { header: 'Cliente', key: 'NombreCliente', width: 28 },
      { header: 'Dirección', key: 'Direccion', width: 30 },
      { header: 'Dirección 1', key: 'Direccion1', width: 30 },
      { header: 'Tipo de falla', key: 'TipoFalla', width: 22 },
      { header: 'Descripción', key: 'ReclamoDescripcion', width: 40 },
      { header: 'Registrado por', key: 'RegistradoPor', width: 18 },
      { header: 'Fecha registro', key: 'FechaRegistro', width: 20 },
      { header: 'Estado', key: 'Estado', width: 16 },
      { header: 'Resultado revisión', key: 'ResultadoRevision', width: 35 },
      { header: 'Revisado por', key: 'RevisadoPor', width: 18 },
      { header: 'Fecha revisión', key: 'FechaRevision', width: 20 },
      { header: 'Código boleta', key: 'CodigoBoleta', width: 16 },
      { header: 'N° boleta', key: 'NumBoleta', width: 12 },
      { header: 'Técnico', key: 'TecnicoAsignado', width: 20 },
      { header: 'Central', key: 'Central', width: 16 },
      { header: 'Par primario', key: 'ParPrimarioCompleto', width: 20 },
      { header: 'Observaciones', key: 'Observaciones', width: 35 }
    ];

    worksheet.addRows(reclamos);
    worksheet.getColumn('FechaRegistro').numFmt = 'dd/mm/yyyy hh:mm';
    worksheet.getColumn('FechaRevision').numFmt = 'dd/mm/yyyy hh:mm';
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const header = worksheet.getRow(1);
    header.height = 24;
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B5ED7' } };
    header.alignment = { vertical: 'middle', horizontal: 'center' };

    const lastColumn = worksheet.getColumn(worksheet.columns.length).letter;
    const lastRow = Math.max(1, reclamos.length + 1);
    worksheet.autoFilter = `A1:${lastColumn}${lastRow}`;

    const buffer = await workbook.xlsx.writeBuffer();
    const nombreBusqueda = String(q || '').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 40);
    const filename = nombreBusqueda
      ? `reclamos_busqueda_${nombreBusqueda}.xlsx`
      : `reclamos_${desde}_${hasta}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
}

async function detail(req, res, next) {
  try {
    const id = Number(req.params.id);
    const reclamo = await reclamoService.getReclamoById(id);
    if (!reclamo) return res.status(404).json({ message: 'Reclamo no encontrado.' });

    const [events, boletaEvents] = await Promise.all([
      reclamoService.getReclamoEvents(id),
      reclamo.IdBoletaGenerada
        ? ticketService.getTicketEvents(reclamo.IdBoletaGenerada).catch(() => [])
        : Promise.resolve([])
    ]);
    res.json({ reclamo, events, boletaEvents });
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
      if (req.body?.EstadoResultante) {
        await new sql.Request(transaction)
          .input('IdReclamo', sql.Int, id)
          .input('Estado', sql.VarChar(30), String(req.body.EstadoResultante).trim().slice(0, 30))
          .query(`UPDATE ReclamosTelefonia SET Estado = @Estado WHERE IdReclamo = @IdReclamo`);
      }
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

module.exports = { list, exportExcel, historial, detail, create, addEvent, review };
