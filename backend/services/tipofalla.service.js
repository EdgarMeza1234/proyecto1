const { getPool, getSql } = require('../db/pool');

async function listTipos() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT IdTipoFalla, Nombre FROM TiposFallaReclamo WHERE Activo = 1 ORDER BY Nombre
  `);
  return result.recordset;
}

async function createTipo(nombre) {
  const pool = await getPool();
  const sql = await getSql();
  const trimmed = String(nombre || '').trim().slice(0, 200);
  if (!trimmed) {
    throw Object.assign(new Error('El nombre del tipo de falla es obligatorio.'), { status: 400 });
  }

  const exists = await pool.request()
    .input('Nombre', sql.VarChar(200), trimmed)
    .query(`SELECT IdTipoFalla FROM TiposFallaReclamo WHERE Nombre = @Nombre`);

  if (exists.recordset.length > 0) {
    return exists.recordset[0];
  }

  const result = await pool.request()
    .input('Nombre', sql.VarChar(200), trimmed)
    .query(`INSERT INTO TiposFallaReclamo (Nombre) OUTPUT INSERTED.IdTipoFalla VALUES (@Nombre)`);

  return { IdTipoFalla: result.recordset[0].IdTipoFalla, Nombre: trimmed };
}

module.exports = { listTipos, createTipo };
