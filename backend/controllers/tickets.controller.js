const { getPool, getSql } = require('../db/pool');
const ticketService = require('../services/ticket.service');
const { emitEvent } = require('../services/socket');

async function list(req, res, next) {
  try {
    const tickets = await ticketService.listTickets();
    res.json(tickets);
  } catch (error) {
    next(error);
  }
}

async function detail(req, res, next) {
  try {
    const id = Number(req.params.id);
    const ticket = await ticketService.getTicketById(id);
    if (!ticket) return res.status(404).json({ message: 'Boleta no encontrada.' });

    const events = await ticketService.getTicketEvents(id);
    res.json({ ticket, events });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const ticketData = req.body?.ticket || {};
    if (!ticketData.Dn) {
      return res.status(400).json({ message: 'El DN es obligatorio para crear la boleta.' });
    }

    const pool = await getPool();
    const sql = await getSql();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const result = await ticketService.createTicket(ticketData, transaction);
      await ticketService.insertTicketEvent(transaction, result.id, {
        TipoEvento: 'Generada',
        Titulo: 'Boleta generada',
        Detalle: ticketData.ReclamoAbonado || 'Boleta creada desde el panel administrativo.',
        Actor: ticketData.RecibidoPor || 'Administrador',
        EstadoResultante: 'Pendiente'
      });
      await transaction.commit();
      emitEvent('ticket:created', result);
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
      await ticketService.insertTicketEvent(transaction, id, req.body || {});
      if (req.body?.EstadoResultante) {
        const sqlLocal = await getSql();
        await new sqlLocal.Request(transaction)
          .input('IdBoleta', sqlLocal.Int, id)
          .input('Estado', sqlLocal.VarChar(30), String(req.body.EstadoResultante).trim().slice(0, 30))
          .query(`
            UPDATE BoletasReparacion
            SET Estado = @Estado,
                FechaCierre = CASE WHEN @Estado = 'Cerrada' THEN GETUTCDATE() ELSE FechaCierre END
            WHERE IdBoleta = @IdBoleta
          `);
      }
      if (req.body?.TecnicoAsignado) {
        const sqlLocal = await getSql();
        await new sqlLocal.Request(transaction)
          .input('IdBoleta', sqlLocal.Int, id)
          .input('TecnicoAsignado', sqlLocal.VarChar(150), String(req.body.TecnicoAsignado).trim().slice(0, 150))
          .query(`UPDATE BoletasReparacion SET TecnicoAsignado = @TecnicoAsignado WHERE IdBoleta = @IdBoleta`);
      }
      await transaction.commit();
      emitEvent('ticket:updated', { id });
      res.status(201).json({ message: 'Seguimiento registrado.' });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const sql = await getSql();
    const fields = [];
    const request = new sql.Request(pool);
    request.input('IdBoleta', sql.Int, id);

    if (req.body?.TecnicoAsignado !== undefined) {
      fields.push('TecnicoAsignado = @TecnicoAsignado');
      request.input('TecnicoAsignado', sql.VarChar(150), String(req.body.TecnicoAsignado).trim().slice(0, 150));
    }
    if (req.body?.Estado !== undefined) {
      fields.push('Estado = @Estado');
      request.input('Estado', sql.VarChar(30), String(req.body.Estado).trim().slice(0, 30));
    }

    if (fields.length > 0) {
      await request.query(`UPDATE BoletasReparacion SET ${fields.join(', ')} WHERE IdBoleta = @IdBoleta`);
    }

    emitEvent('ticket:updated', { id });
    res.json({ message: 'Boleta actualizada.' });
  } catch (error) {
    next(error);
  }
}

async function printForm(req, res, next) {
  try {
    const id = Number(req.params.id);
    const ticket = await ticketService.getTicketById(id);
    if (!ticket) return res.status(404).send('Boleta no encontrada.');

    res.send(renderTicketPrintableHtml(ticket));
  } catch (error) {
    next(error);
  }
}

function renderTicketPrintableHtml(ticket) {
  const value = (text) => String(text ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${value(ticket.CodigoBoleta)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
    .sheet { border: 1px solid #333; max-width: 980px; margin: 0 auto; }
    .title { display: grid; grid-template-columns: 1fr 2fr 1fr; border-bottom: 1px solid #333; text-align: center; }
    .title div { padding: 10px; }
    .title strong { font-size: 22px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); }
    .cell { min-height: 54px; border-right: 1px solid #333; border-bottom: 1px solid #333; padding: 8px; }
    .cell span { display: block; font-size: 11px; font-weight: bold; color: #333; margin-bottom: 6px; }
    .wide { grid-column: span 2; }
    .full { grid-column: span 4; min-height: 78px; }
    h2 { font-size: 15px; text-align: center; margin: 0; padding: 8px; border-bottom: 1px solid #333; background: #eee; }
    .actions { margin: 18px auto; max-width: 980px; text-align: right; }
    button { padding: 10px 14px; font-weight: bold; }
    @media print { .actions { display: none; } body { margin: 0; } }
  </style>
</head>
<body>
  <div class="actions"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>
  <main class="sheet">
    <section class="title">
      <div>Departamento tecnico</div>
      <div><strong>REPARACION DE FALLAS</strong></div>
      <div>No. ${value(ticket.CodigoBoleta)}</div>
    </section>
    <section class="grid">
      <div class="cell"><span>No. Telef.</span>${value(ticket.Dn)}</div>
      <div class="cell wide"><span>Nombre</span>${value(ticket.NombreCliente)}</div>
      <div class="cell"><span>Fecha</span>${value(new Date(ticket.FechaCreacion).toLocaleString('es-BO'))}</div>
      <div class="cell full"><span>Lugar de instalacion</span>${value(ticket.Direccion)}</div>
      <div class="cell full"><span>Referencias complementarias</span>${value(ticket.Referencia)}</div>
    </section>
    <h2>Datos tecnicos</h2>
    <section class="grid">
      <div class="cell"><span>Central</span>${value(ticket.Central)}</div>
      <div class="cell"><span>Par primario</span>${value(ticket.ParPrimarioCompleto)}</div>
      <div class="cell"><span>Par secundario</span>${value(ticket.ParSec)}</div>
      <div class="cell"><span>Armario</span>${value(ticket.Armario)}</div>
      <div class="cell"><span>Caja distribucion</span>${value(ticket.CajDis)}</div>
      <div class="cell"><span>Falla</span>${value(ticket.TipoFalla)}</div>
      <div class="cell"><span>Prioridad</span>${value(ticket.Prioridad)}</div>
      <div class="cell"><span>Recibido por</span>${value(ticket.RecibidoPor)}</div>
      <div class="cell full"><span>Reclamo del abonado</span>${value(ticket.ReclamoAbonado)}</div>
      <div class="cell wide"><span>Prueba en central</span>${value(ticket.PruebaCentral)}</div>
      <div class="cell wide"><span>Observaciones</span>${value(ticket.Observaciones)}</div>
    </section>
  </main>
</body>
</html>`;
}

module.exports = { list, detail, create, addEvent, update, printForm };
