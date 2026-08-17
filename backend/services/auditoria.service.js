const { getPool, getSql } = require('../db/pool');

async function ensureAuditTable() {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const pool = await getPool();
      await pool.request().query(`
        IF OBJECT_ID('auditoriaGeneral') IS NULL
        CREATE TABLE auditoriaGeneral (
          id INT IDENTITY(1,1) PRIMARY KEY,
          modulo VARCHAR(30) NOT NULL,
          registro_id INT NULL,
          accion VARCHAR(20) NOT NULL,
          usuario VARCHAR(100) NOT NULL,
          fecha DATETIME NOT NULL DEFAULT GETDATE(),
          datos_antes NVARCHAR(MAX) NULL,
          datos_despues NVARCHAR(MAX) NULL,
          detalle NVARCHAR(MAX) NULL,
          formulario VARCHAR(50) NULL,
          nombre_abonado VARCHAR(200) NULL
        );
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_auditoriaGeneral_modulo' AND object_id = OBJECT_ID('auditoriaGeneral'))
          CREATE INDEX IX_auditoriaGeneral_modulo ON auditoriaGeneral(modulo);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_auditoriaGeneral_usuario' AND object_id = OBJECT_ID('auditoriaGeneral'))
          CREATE INDEX IX_auditoriaGeneral_usuario ON auditoriaGeneral(usuario);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_auditoriaGeneral_fecha' AND object_id = OBJECT_ID('auditoriaGeneral'))
          CREATE INDEX IX_auditoriaGeneral_fecha ON auditoriaGeneral(fecha DESC);
      `);
      console.log('[auditoria] Tabla auditoriaGeneral lista.');
      return;
    } catch (err) {
      console.error('[auditoria] Intento ' + (attempt + 1) + ' fallo:', err.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  console.error('[auditoria] No se pudo inicializar la tabla de auditoria.');
}

async function ensureTrabajosColumns() {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const pool = await getPool();
      await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('trabajos') AND name = 'eliminado')
          ALTER TABLE trabajos ADD eliminado BIT NOT NULL DEFAULT 0;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('trabajos') AND name = 'eliminado_en')
          ALTER TABLE trabajos ADD eliminado_en DATETIME NULL;
      `);
      console.log('[auditoria] Columnas eliminado/eliminado_en en trabajos listas.');
      return;
    } catch (err) {
      console.error('[auditoria] Intento trabajos columnas ' + (attempt + 1) + ' fallo:', err.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  console.error('[auditoria] No se pudieron agregar columnas a trabajos.');
}

async function registrarAuditoria({
  modulo,
  registro_id,
  accion,
  usuario,
  datos_antes,
  datos_despues,
  detalle,
  formulario,
  nombre_abonado
}) {
  const sql = getSql();
  const pool = await getPool();
  const request = pool.request();
  request.input('modulo', sql.VarChar(30), String(modulo || '').slice(0, 30));
  request.input('registro_id', sql.Int, Number(registro_id) || null);
  request.input('accion', sql.VarChar(20), String(accion || ''));
  request.input('usuario', sql.VarChar(100), String(usuario || '').slice(0, 100));
  request.input('datos_antes', sql.NVarChar(sql.MAX), datos_antes || null);
  request.input('datos_despues', sql.NVarChar(sql.MAX), datos_despues || null);
  request.input('detalle', sql.NVarChar(sql.MAX), detalle || null);
  request.input('formulario', sql.VarChar(50), String(formulario || '').slice(0, 50));
  request.input('nombre_abonado', sql.VarChar(200), String(nombre_abonado || '').slice(0, 200));

  await request.query(`
    INSERT INTO auditoriaGeneral (modulo, registro_id, accion, usuario, datos_antes, datos_despues, detalle, formulario, nombre_abonado)
    VALUES (@modulo, @registro_id, @accion, @usuario, @datos_antes, @datos_despues, @detalle, @formulario, @nombre_abonado)
  `);
}

async function listarAuditoria({
  page = 1,
  limit = 20,
  modulo,
  accion,
  usuario,
  search,
  fechaDesde,
  fechaHasta
} = {}) {
  const pool = await getPool();
  const sql = getSql();
  const request = pool.request();
  let where = 'WHERE 1=1';
  const inputs = [];

  if (modulo) {
    where += ' AND modulo = @modulo';
    inputs.push({ name: 'modulo', value: modulo });
  }
  if (accion) {
    where += ' AND accion = @accion';
    inputs.push({ name: 'accion', value: accion });
  }
  if (usuario) {
    where += ' AND usuario LIKE @usuario';
    inputs.push({ name: 'usuario', value: `%${usuario}%` });
  }
  if (search) {
    where += ' AND (formulario LIKE @search OR nombre_abonado LIKE @search OR detalle LIKE @search OR usuario LIKE @search)';
    inputs.push({ name: 'search', value: `%${search}%` });
  }
  if (fechaDesde) {
    where += ' AND fecha >= @fechaDesde';
    inputs.push({ name: 'fechaDesde', value: fechaDesde });
  }
  if (fechaHasta) {
    where += ' AND fecha <= @fechaHasta';
    inputs.push({ name: 'fechaHasta', value: fechaHasta + ' 23:59:59' });
  }

  inputs.forEach(inp => request.input(inp.name, inp.value));

  const countResult = await request.query(`SELECT COUNT(*) as total FROM auditoriaGeneral ${where}`);
  const total = countResult.recordset[0].total;

  const offset = (Math.max(1, Number(page)) - 1) * Math.min(Number(limit) || 20, 100);
  const safeLimit = Math.min(Number(limit) || 20, 100);

  const dataRequest = pool.request();
  inputs.forEach(inp => dataRequest.input(inp.name, inp.value));

  const dataResult = await dataRequest.query(`
    SELECT id, modulo, registro_id, accion, usuario, fecha, datos_antes, datos_despues, detalle, formulario, nombre_abonado
    FROM auditoriaGeneral
    ${where}
    ORDER BY fecha DESC, id DESC
    OFFSET ${offset} ROWS
    FETCH NEXT ${safeLimit} ROWS ONLY
  `);

  return {
    data: dataResult.recordset,
    total,
    page: Math.max(1, Number(page)),
    totalPages: Math.ceil(total / safeLimit)
  };
}

function computeDiff(oldRow, newRow, fields) {
  const changes = [];
  for (const field of fields) {
    const oldVal = oldRow[field] != null ? String(oldRow[field]) : '';
    const newVal = newRow[field] != null ? String(newRow[field]) : '';
    if (oldVal !== newVal) {
      changes.push({ campo: field, antes: oldVal || '(vacío)', despues: newVal || '(vacío)' });
    }
  }
  return changes;
}

function formatDiff(changes) {
  if (!changes.length) return 'Sin cambios detectados';
  return changes.map(c => `${c.campo}: "${c.antes}" → "${c.despues}"`).join('; ');
}

module.exports = { ensureAuditTable, ensureTrabajosColumns, registrarAuditoria, listarAuditoria, computeDiff, formatDiff };
