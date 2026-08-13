const { getPool, getSql } = require('../db/pool');

async function ensureAuditTable() {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const pool = await getPool();
      await pool.request().query(`
        IF OBJECT_ID('mdfAuditoria') IS NULL
        CREATE TABLE mdfAuditoria (
          Id INT IDENTITY(1,1) PRIMARY KEY,
          Fecha DATETIME NOT NULL DEFAULT GETDATE(),
          Usuario VARCHAR(80) NOT NULL,
          NombreCompleto VARCHAR(180) NULL,
          Accion VARCHAR(20) NOT NULL,
          IdRegistro INT NULL,
          Central VARCHAR(50) NULL,
          ParPriBloq VARCHAR(10) NULL,
          ParPriPar VARCHAR(10) NULL,
          Dn VARCHAR(20) NULL,
          DatosAntes NVARCHAR(MAX) NULL,
          DatosDespues NVARCHAR(MAX) NULL,
          Detalle NVARCHAR(MAX) NULL
        )
      `);
      console.log('[facilidades-audit] Tabla mdfAuditoria lista.');
      return;
    } catch (err) {
      console.error('[facilidades-audit] Intento ' + (attempt + 1) + ' fallo:', err.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  console.error('[facilidades-audit] No se pudo inicializar la tabla de auditoria.');
}

async function registrarAuditoria({
  accion,
  idRegistro,
  central,
  parPriBloq,
  parPriPar,
  dn,
  datosAntes,
  datosDespues,
  detalle,
  usuario,
  nombreCompleto,
  transaction
}) {
  const sql = await getSql();
  const pool = await getPool();
  const request = transaction ? new sql.Request(transaction) : pool.request();
  request.input('Usuario', sql.VarChar(80), String(usuario || '').slice(0, 80));
  request.input('NombreCompleto', sql.VarChar(180), String(nombreCompleto || '').slice(0, 180));
  request.input('Accion', sql.VarChar(20), String(accion || ''));
  request.input('IdRegistro', sql.Int, Number(idRegistro) || null);
  request.input('Central', sql.VarChar(50), String(central || '').slice(0, 50));
  request.input('ParPriBloq', sql.VarChar(10), String(parPriBloq || '').slice(0, 10));
  request.input('ParPriPar', sql.VarChar(10), String(parPriPar || '').slice(0, 10));
  request.input('Dn', sql.VarChar(20), String(dn || '').slice(0, 20));
  request.input('DatosAntes', sql.NVarChar(sql.MAX), datosAntes || null);
  request.input('DatosDespues', sql.NVarChar(sql.MAX), datosDespues || null);
  request.input('Detalle', sql.NVarChar(sql.MAX), detalle || null);

  await request.query(`
    INSERT INTO mdfAuditoria (Usuario, NombreCompleto, Accion, IdRegistro, Central, ParPriBloq, ParPriPar, Dn, DatosAntes, DatosDespues, Detalle)
    VALUES (@Usuario, @NombreCompleto, @Accion, @IdRegistro, @Central, @ParPriBloq, @ParPriPar, @Dn, @DatosAntes, @DatosDespues, @Detalle)
  `);
}

async function listarAuditoria({ limit = 500, usuario } = {}) {
  const pool = await getPool();
  const sql = await getSql();
  const request = pool.request();
  let where = '';
  if (usuario) {
    where = ' WHERE Usuario = @Usuario';
    request.input('Usuario', sql.VarChar(80), String(usuario).slice(0, 80));
  }
  const result = await request.query(`
    SELECT TOP (${Math.min(Number(limit) || 500, 2000)})
      Id, Fecha, Usuario, NombreCompleto, Accion, IdRegistro, Central, ParPriBloq, ParPriPar, Dn, DatosAntes, DatosDespues, Detalle
    FROM mdfAuditoria${where}
    ORDER BY Fecha DESC, Id DESC
  `);
  return result.recordset;
}

module.exports = { ensureAuditTable, registrarAuditoria, listarAuditoria };
