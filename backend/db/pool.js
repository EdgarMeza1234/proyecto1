const config = require('../config/env');

let sql;
let sqlPool;

async function getPool() {
  if (!sql) {
    sql = require('mssql');
  }
  if (sqlPool) return sqlPool;

  sqlPool = await sql.connect({
    user: config.sql.user,
    password: config.sql.password,
    server: config.sql.server,
    database: config.sql.database,
    options: {
      encrypt: config.sql.encrypt,
      trustServerCertificate: config.sql.trustServerCertificate,
      useUTC: false
    }
  });

  return sqlPool;
}

function getSql() {
  if (!sql) {
    sql = require('mssql');
  }
  return sql;
}

function getFacilidadesTable() {
  return config.sql.facilidadesTable;
}

function safeSqlName(name) {
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error('Nombre de tabla SQL no valido.');
  }
  return `[${name}]`;
}

module.exports = { getPool, getSql, getFacilidadesTable, safeSqlName };
