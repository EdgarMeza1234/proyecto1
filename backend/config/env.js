const path = require('path');
const fs = require('fs');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) return;

  const rows = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const row of rows) {
    const line = row.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnv();

module.exports = {
  port: Number(process.env.PORT || 4001),
  host: process.env.HOST || '127.0.0.1',
  jwtSecret: process.env.JWT_SECRET || 'telefonia-reparaciones-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  erp: {
    apiUrl: process.env.ERP_API_URL || 'https://api.erp.cotapnet.com.bo/API/PersonasErp',
    token: process.env.ERP_TOKEN || '',
    tlsRejectUnauthorized: process.env.ERP_TLS_REJECT_UNAUTHORIZED === 'false'
  },
  sql: {
    user: process.env.SQLSERVER_USER || 'sa',
    password: process.env.SQLSERVER_PASSWORD || '',
    server: process.env.SQLSERVER_SERVER || 'localhost',
    database: process.env.SQLSERVER_DATABASE || 'Telefonia',
    encrypt: process.env.SQLSERVER_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQLSERVER_TRUST_CERT !== 'false',
    facilidadesTable: process.env.SQLSERVER_FACILIDADES_TABLE || 'FacilidadesLinea'
  },
  traficoDb: process.env.SQLSERVER_TRAFICO_DATABASE || 'trafico'
};
