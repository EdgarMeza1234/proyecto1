const crypto = require('crypto');
const { getPool, getSql } = require('../db/pool');

async function findByUsername(username) {
  const pool = await getPool();
  const result = await pool.request()
    .input('Usuario', (await getSql()).VarChar(80), username)
    .query(`
      SELECT TOP (1)
        u.IdUsuario, u.Usuario, u.PasswordHash, u.NombreCompleto, u.Dn, u.Estado,
        r.Codigo AS RolCodigo, r.Nombre AS RolNombre
      FROM UsuariosSistema u
      INNER JOIN RolesSistema r ON r.IdRol = u.IdRol
      WHERE u.Usuario = @Usuario
    `);
  return result.recordset[0] || null;
}

async function listUsers() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      u.IdUsuario, u.Usuario, u.NombreCompleto, u.Dn, u.Estado, u.FechaCreacion,
      r.IdRol, r.Codigo AS RolCodigo, r.Nombre AS RolNombre
    FROM UsuariosSistema u
    INNER JOIN RolesSistema r ON r.IdRol = u.IdRol
    ORDER BY u.NombreCompleto
  `);
  return result.recordset;
}

async function listRoles() {
  const pool = await getPool();
  const result = await pool.request().query(`SELECT IdRol, Codigo, Nombre FROM RolesSistema ORDER BY IdRol`);
  return result.recordset;
}

async function createUser(data) {
  const sql = await getSql();
  const pool = await getPool();
  await pool.request()
    .input('IdRol', sql.Int, Number(data.IdRol))
    .input('Usuario', sql.VarChar(80), cleanText(data.Usuario, 80))
    .input('PasswordHash', sql.VarChar(300), hashPassword(data.Password))
    .input('NombreCompleto', sql.VarChar(180), cleanText(data.NombreCompleto, 180))
    .input('Dn', sql.VarChar(20), cleanText(data.Dn, 20))
    .input('Estado', sql.VarChar(20), cleanText(data.Estado, 20) || 'Activo')
    .query(`
      INSERT INTO UsuariosSistema (IdRol, Usuario, PasswordHash, NombreCompleto, Dn, Estado)
      VALUES (@IdRol, @Usuario, @PasswordHash, @NombreCompleto, @Dn, @Estado)
    `);
}

async function updateUser(id, data) {
  const sql = await getSql();
  const pool = await getPool();
  await pool.request()
    .input('IdUsuario', sql.Int, id)
    .input('IdRol', sql.Int, Number(data.IdRol))
    .input('NombreCompleto', sql.VarChar(180), cleanText(data.NombreCompleto, 180))
    .input('Dn', sql.VarChar(20), cleanText(data.Dn, 20))
    .input('Estado', sql.VarChar(20), cleanText(data.Estado, 20) || 'Activo')
    .query(`
      UPDATE UsuariosSistema
      SET IdRol = @IdRol, NombreCompleto = @NombreCompleto, Dn = @Dn, Estado = @Estado
      WHERE IdUsuario = @IdUsuario
    `);

  if (data.Password) {
    await pool.request()
      .input('IdUsuario', sql.Int, id)
      .input('PasswordHash', sql.VarChar(300), hashPassword(data.Password))
      .query(`UPDATE UsuariosSistema SET PasswordHash = @PasswordHash WHERE IdUsuario = @IdUsuario`);
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('hex');
  return `pbkdf2$${salt}$${hash}`;
}

function verifyPassword(password, storedValue) {
  const stored = String(storedValue || '');
  if (stored.startsWith('pbkdf2$')) {
    const [, salt, hash] = stored.split('$');
    if (!salt || !hash) return false;
    const calculated = crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256');
    const expected = Buffer.from(hash, 'hex');
    return expected.length === calculated.length && crypto.timingSafeEqual(expected, calculated);
  }
  return stored === String(password);
}

function cleanText(value, maxLength) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
}

async function changePassword(userId, currentPassword, newPassword) {
  const sql = await getSql();
  const pool = await getPool();
  const result = await pool.request()
    .input('IdUsuario', sql.Int, userId)
    .query('SELECT PasswordHash FROM UsuariosSistema WHERE IdUsuario = @IdUsuario');
  const user = result.recordset[0];
  if (!user) throw new Error('Usuario no encontrado');
  if (!verifyPassword(currentPassword, user.PasswordHash)) throw new Error('La contrasena actual es incorrecta');
  await pool.request()
    .input('IdUsuario', sql.Int, userId)
    .input('PasswordHash', sql.VarChar(300), hashPassword(newPassword))
    .query('UPDATE UsuariosSistema SET PasswordHash = @PasswordHash WHERE IdUsuario = @IdUsuario');
}

module.exports = { findByUsername, listUsers, listRoles, createUser, updateUser, verifyPassword, hashPassword, changePassword };
