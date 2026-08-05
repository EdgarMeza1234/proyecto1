const { getPool, getSql } = require('../db/pool');

async function listTickets() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT TOP (200)
      IdBoleta, CodigoBoleta, Dn, NombreCliente, Direccion, Central,
      ParPrimarioCompleto, ParSec, Armario, CajDis, TipoFalla, Prioridad,
      Estado, TecnicoAsignado, FechaCreacion, FechaCierre
    FROM BoletasReparacion
    ORDER BY FechaCreacion DESC
  `);
  return result.recordset;
}

async function getTicketById(id) {
  const pool = await getPool();
  const result = await pool.request()
    .input('IdBoleta', (await getSql()).Int, id)
    .query(`SELECT TOP (1) * FROM BoletasReparacion WHERE IdBoleta = @IdBoleta`);
  return result.recordset[0] || null;
}

async function getTicketEvents(id) {
  const pool = await getPool();
  const result = await pool.request()
    .input('IdBoleta', (await getSql()).Int, id)
    .query(`SELECT * FROM BoletaSeguimiento WHERE IdBoleta = @IdBoleta ORDER BY FechaHora`);
  return result.recordset;
}

async function createTicket(ticket, transaction) {
  const sql = await getSql();
  const code = ticket.CodigoBoleta || await nextTicketCode(transaction);
  const request = new sql.Request(transaction);
  request.input('CodigoBoleta', sql.VarChar(30), code);
  request.input('Dn', sql.VarChar(20), cleanText(ticket.Dn, 20));
  request.input('NombreCliente', sql.VarChar(200), cleanText(ticket.NombreCliente, 200));
  request.input('Direccion', sql.VarChar(300), cleanText(ticket.Direccion, 300));
  request.input('Referencia', sql.VarChar(300), cleanText(ticket.Referencia, 300));
  request.input('Central', sql.VarChar(50), cleanCode(ticket.Central, 50));
  request.input('ParPriBloq', sql.VarChar(10), cleanCode(ticket.ParPriBloq, 10));
  request.input('ParPriPar', sql.VarChar(10), cleanText(ticket.ParPriPar, 10));
  request.input('ParPrimarioCompleto', sql.VarChar(50), cleanText(ticket.ParPrimarioCompleto, 50));
  request.input('ParSec', sql.VarChar(10), cleanText(ticket.ParSec, 10));
  request.input('Armario', sql.VarChar(10), cleanText(ticket.Armario, 10));
  request.input('CajDis', sql.VarChar(50), cleanText(ticket.CajDis, 50));
  request.input('TipoFalla', sql.VarChar(100), cleanText(ticket.TipoFalla, 100));
  request.input('Prioridad', sql.VarChar(30), cleanText(ticket.Prioridad, 30) || 'Media');
  request.input('ReclamoAbonado', sql.VarChar(sql.MAX), cleanText(ticket.ReclamoAbonado, 8000));
  request.input('PruebaCentral', sql.VarChar(300), cleanText(ticket.PruebaCentral, 300));
  request.input('Observaciones', sql.VarChar(sql.MAX), cleanText(ticket.Observaciones, 8000));
  request.input('RecibidoPor', sql.VarChar(150), cleanText(ticket.RecibidoPor, 150));

  const insert = await request.query(`
    INSERT INTO BoletasReparacion (
      CodigoBoleta, Dn, NombreCliente, Direccion, Referencia, Central,
      ParPriBloq, ParPriPar, ParPrimarioCompleto, ParSec, Armario, CajDis,
      TipoFalla, Prioridad, Estado, ReclamoAbonado, PruebaCentral,
      Observaciones, RecibidoPor
    )
    OUTPUT INSERTED.IdBoleta
    VALUES (
      @CodigoBoleta, @Dn, @NombreCliente, @Direccion, @Referencia, @Central,
      @ParPriBloq, @ParPriPar, @ParPrimarioCompleto, @ParSec, @Armario, @CajDis,
      @TipoFalla, @Prioridad, 'Pendiente', @ReclamoAbonado, @PruebaCentral,
      @Observaciones, @RecibidoPor
    )
  `);

  return { id: insert.recordset[0].IdBoleta, CodigoBoleta: code };
}

async function insertTicketEvent(transaction, id, event) {
  const sql = await getSql();
  await new sql.Request(transaction)
    .input('IdBoleta', sql.Int, id)
    .input('TipoEvento', sql.VarChar(50), cleanText(event.TipoEvento || 'Avance', 50))
    .input('Titulo', sql.VarChar(150), cleanText(event.Titulo || 'Avance tecnico', 150))
    .input('Detalle', sql.VarChar(sql.MAX), cleanText(event.Detalle, 8000))
    .input('Actor', sql.VarChar(150), cleanText(event.Actor, 150))
    .input('EstadoResultante', sql.VarChar(30), cleanText(event.EstadoResultante, 30))
    .query(`
      INSERT INTO BoletaSeguimiento
        (IdBoleta, TipoEvento, Titulo, Detalle, Actor, EstadoResultante)
      VALUES
        (@IdBoleta, @TipoEvento, @Titulo, @Detalle, @Actor, @EstadoResultante)
    `);
}

async function nextTicketCode(transaction) {
  const sql = await getSql();
  const result = await new sql.Request(transaction).query(`
    SELECT ISNULL(MAX(IdBoleta), 0) + 1 AS NextNumber FROM BoletasReparacion
  `);
  return `BR-${new Date().getFullYear()}-${String(result.recordset[0].NextNumber).padStart(4, '0')}`;
}

function cleanText(value, maxLength) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
}

function cleanCode(value, maxLength) {
  const text = cleanText(value, maxLength);
  return text ? text.toUpperCase() : null;
}

module.exports = { listTickets, getTicketById, getTicketEvents, createTicket, insertTicketEvent, nextTicketCode };
