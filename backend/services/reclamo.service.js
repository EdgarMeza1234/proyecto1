const { getPool, getSql } = require('../db/pool');

async function listReclamos() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT TOP (200)
      r.IdReclamo, r.CodigoReclamo, r.Dn, r.NombreCliente,
      r.Direccion, r.TipoFalla, r.ReclamoDescripcion, r.RegistradoPor,
      r.FechaRegistro, r.Estado, r.ResultadoRevision,
      r.RevisadoPor, r.FechaRevision, r.IdBoletaGenerada,
      r.Observaciones,
      b.CodigoBoleta, b.TecnicoAsignado
    FROM ReclamosTelefonia r
    LEFT JOIN BoletasReparacion b ON b.IdBoleta = r.IdBoletaGenerada
    ORDER BY r.FechaRegistro DESC
  `);
  return result.recordset;
}

async function getReclamoById(id) {
  const pool = await getPool();
  const result = await pool.request()
    .input('IdReclamo', (await getSql()).Int, id)
    .query(`
      SELECT r.*, b.CodigoBoleta, b.TecnicoAsignado
      FROM ReclamosTelefonia r
      LEFT JOIN BoletasReparacion b ON b.IdBoleta = r.IdBoletaGenerada
      WHERE r.IdReclamo = @IdReclamo
    `);
  return result.recordset[0] || null;
}

async function getReclamoEvents(id) {
  const pool = await getPool();
  const result = await pool.request()
    .input('IdReclamo', (await getSql()).Int, id)
    .query(`SELECT * FROM ReclamoSeguimiento WHERE IdReclamo = @IdReclamo ORDER BY FechaHora`);
  return result.recordset;
}

async function createReclamo(data, transaction) {
  const sql = await getSql();
  const code = data.CodigoReclamo || await nextReclamoCode(transaction);
  const request = new sql.Request(transaction);
  request.input('CodigoReclamo', sql.VarChar(30), code);
  request.input('Dn', sql.VarChar(20), cleanText(data.Dn, 20));
  request.input('NombreCliente', sql.VarChar(200), cleanText(data.NombreCliente, 200));
  request.input('Direccion', sql.VarChar(300), cleanText(data.Direccion, 300));
  request.input('Referencia', sql.VarChar(300), cleanText(data.Referencia, 300));
  request.input('TipoFalla', sql.VarChar(200), cleanText(data.TipoFalla, 200));
  request.input('ReclamoDescripcion', sql.VarChar(sql.MAX), cleanText(data.ReclamoDescripcion, 8000));
  request.input('RegistradoPor', sql.VarChar(150), cleanText(data.RegistradoPor, 150));
  request.input('Observaciones', sql.VarChar(sql.MAX), cleanText(data.Observaciones, 8000));

  const insert = await request.query(`
    INSERT INTO ReclamosTelefonia
      (CodigoReclamo, Dn, NombreCliente, Direccion, Referencia,
       TipoFalla, ReclamoDescripcion, RegistradoPor, Observaciones)
    OUTPUT INSERTED.IdReclamo
    VALUES
      (@CodigoReclamo, @Dn, @NombreCliente, @Direccion, @Referencia,
       @TipoFalla, @ReclamoDescripcion, @RegistradoPor, @Observaciones)
  `);

  return { id: insert.recordset[0].IdReclamo, CodigoReclamo: code };
}

async function insertReclamoEvent(transaction, id, event) {
  const sql = await getSql();
  await new sql.Request(transaction)
    .input('IdReclamo', sql.Int, id)
    .input('TipoEvento', sql.VarChar(50), cleanText(event.TipoEvento || 'Avance', 50))
    .input('Titulo', sql.VarChar(150), cleanText(event.Titulo || 'Avance registrado', 150))
    .input('Detalle', sql.VarChar(sql.MAX), cleanText(event.Detalle, 8000))
    .input('Actor', sql.VarChar(150), cleanText(event.Actor, 150))
    .input('EstadoResultante', sql.VarChar(30), cleanText(event.EstadoResultante, 30))
    .query(`
      INSERT INTO ReclamoSeguimiento
        (IdReclamo, TipoEvento, Titulo, Detalle, Actor, EstadoResultante)
      VALUES
        (@IdReclamo, @TipoEvento, @Titulo, @Detalle, @Actor, @EstadoResultante)
    `);
}

async function reviewReclamo(id, reviewData, userId) {
  const pool = await getPool();
  const sql = await getSql();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const decision = String(reviewData.Decision || '').trim();
    if (!['CerradoCentral', 'GeneradoBoleta'].includes(decision)) {
      throw Object.assign(new Error('Decision invalida. Use CerradoCentral o GeneradoBoleta.'), { status: 400 });
    }

    const reclamo = await getReclamoById(id);
    if (!reclamo) {
      throw Object.assign(new Error('Reclamo no encontrado.'), { status: 404 });
    }
    if (reclamo.Estado !== 'Pendiente') {
      throw Object.assign(new Error('El reclamo ya fue revisado.'), { status: 400 });
    }

    await new sql.Request(transaction)
      .input('IdReclamo', sql.Int, id)
      .input('Estado', sql.VarChar(30), decision)
      .input('ResultadoRevision', sql.VarChar(sql.MAX), cleanText(reviewData.ResultadoRevision, 8000))
      .input('RevisadoPor', sql.VarChar(150), cleanText(userId, 150))
      .input('FechaRevision', sql.DateTime2, new Date())
      .query(`
        UPDATE ReclamosTelefonia
        SET Estado = @Estado,
            ResultadoRevision = @ResultadoRevision,
            RevisadoPor = @RevisadoPor,
            FechaRevision = @FechaRevision
        WHERE IdReclamo = @IdReclamo
      `);

    let boletaGenerada = null;

    if (decision === 'GeneradoBoleta') {
      const ticketData = {
        Dn: reclamo.Dn,
        NombreCliente: reclamo.NombreCliente,
        Direccion: reclamo.Direccion,
        Referencia: reclamo.Referencia,
        ReclamoAbonado: reviewData.ReclamoAbonado || reclamo.ReclamoDescripcion,
        RecibidoPor: userId,
        TipoFalla: reviewData.TipoFalla || 'Sin tono',
        Prioridad: reviewData.Prioridad || 'Media',
        Central: reviewData.Central || '',
        ParPriBloq: reviewData.ParPriBloq || '',
        ParPriPar: reviewData.ParPriPar || '',
        ParPrimarioCompleto: reviewData.ParPrimarioCompleto || '',
        ParSec: reviewData.ParSec || '',
        Armario: reviewData.Armario || '',
        CajDis: reviewData.CajDis || '',
        PruebaCentral: reviewData.PruebaCentral || '',
        Observaciones: reviewData.Observaciones || ''
      };

      const ticketService = require('./ticket.service');
      const result = await ticketService.createTicket(ticketData, transaction);
      boletaGenerada = result;

      await ticketService.insertTicketEvent(transaction, result.id, {
        TipoEvento: 'Generada',
        Titulo: 'Boleta generada desde reclamo',
        Detalle: `Reclamo ${reclamo.CodigoReclamo} derivado a planta externa. ${reviewData.ResultadoRevision || ''}`,
        Actor: userId,
        EstadoResultante: 'Pendiente'
      });

      await new sql.Request(transaction)
        .input('IdReclamo', sql.Int, id)
        .input('IdBoleta', sql.Int, result.id)
        .query(`UPDATE ReclamosTelefonia SET IdBoletaGenerada = @IdBoleta WHERE IdReclamo = @IdReclamo`);
    }

    await insertReclamoEvent(transaction, id, {
      TipoEvento: 'Revision',
      Titulo: decision === 'CerradoCentral' ? 'Falla en central - Sin boleta' : 'Derivado a planta externa',
      Detalle: reviewData.ResultadoRevision || '',
      Actor: userId,
      EstadoResultante: decision
    });

    await transaction.commit();
    return { estado: decision, boleta: boletaGenerada };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function nextReclamoCode(transaction) {
  const sql = await getSql();
  const result = await new sql.Request(transaction).query(`
    SELECT ISNULL(MAX(IdReclamo), 0) + 1 AS NextNumber FROM ReclamosTelefonia
  `);
  return `RC-${new Date().getFullYear()}-${String(result.recordset[0].NextNumber).padStart(4, '0')}`;
}

function cleanText(value, maxLength) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
}

module.exports = { listReclamos, getReclamoById, getReclamoEvents, createReclamo, insertReclamoEvent, reviewReclamo, nextReclamoCode };
