const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getPool, getSql } = require('../db/pool');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_NAMES = ['teliskratel.out', 'teliskratel6.out'];

const FORMATS = {
  REG_STATUS: {
    header: '|Node|Directory Number|Registration Status|Subscriber Type|Supplementary Service Set',
    columns: ['node', 'directory_number', 'registration_status', 'subscriber_type', 'supplementary_service_set']
  },
  IFACE: {
    header: '|Node|Directory Number|Basic Service|Interface / Access|Subscriber Type|Supplementary Service Set',
    columns: ['node', 'directory_number', 'basic_service', 'interface_access', 'subscriber_type', 'supplementary_service_set']
  }
};

function parseValue(value) {
  if (value == null) return null;
  const v = String(value).trim();
  return v === '' ? null : v;
}

function detectFormat(headerLine) {
  const h = String(headerLine || '').trim();
  for (const [tipoFormato, fmt] of Object.entries(FORMATS)) {
    if (h === fmt.header) return { tipoFormato, columns: fmt.columns };
  }
  return null;
}

function parseLine(line, columns) {
  const parts = line.split('|');
  const row = {};
  columns.forEach((col, i) => { row[col] = parseValue(parts[i + 1]); });
  return row;
}

function normalizarEstado(regStatus) {
  if (!regStatus) return { estado_registro: null, ip_origen: null, registro_detalle: null };
  const s = String(regStatus).trim();
  if (/^not\s+registered/i.test(s)) {
    const det = s.match(/\(on\s+'?([^')]+)'?\)/i);
    return { estado_registro: 'NO_REGISTRADO', ip_origen: null, registro_detalle: det ? det[1].trim() : null };
  }
  if (/^registered/i.test(s)) {
    const fromMatch = s.match(/from\s+(.+)$/i);
    const det = fromMatch ? fromMatch[1].trim() : null;
    const ip = det && /^(?:\d{1,3}\.){3}\d{1,3}$/.test(det) ? det : null;
    return { estado_registro: 'REGISTRADO', ip_origen: ip, registro_detalle: det };
  }
  return { estado_registro: null, ip_origen: null, registro_detalle: s || null };
}

function normalizarInterface(iface) {
  if (!iface) return { central: null, puerto: null };
  const s = String(iface).trim();
  const idx = s.lastIndexOf('/');
  if (idx === -1) return { central: s || null, puerto: null };
  return { central: s.slice(0, idx).trim() || null, puerto: s.slice(idx + 1).trim() || null };
}

function derivarFlags(subscriberType, suppSet) {
  const st = String(subscriberType || '').toLowerCase();
  const ss = String(suppSet || '').toUpperCase();
  let bloqueo = null;
  if (ss.includes('BLOQUEO TOTAL')) bloqueo = 'BLOQUEO TOTAL';
  else if (ss.includes('BLOQUEO LD')) bloqueo = 'BLOQUEO LD';
  return { suspendido: st.includes('suspended') ? 1 : 0, bloqueo };
}

function calcHash(r) {
  const base = [
    r.node, r.directory_number, r.registration_status, r.basic_service,
    r.interface_access, r.subscriber_type, r.supplementary_service_set
  ].map((v) => (v == null ? '' : String(v).trim())).join('|');
  return crypto.createHash('sha256').update(base).digest('hex');
}

function normalizar(base, tipoFormato, origenArchivo, lineaRaw) {
  const dn = base.directory_number || null;
  const dnDigitos = dn ? (dn.replace(/\D/g, '') || null) : null;
  const estado = normalizarEstado(base.registration_status);
  const iface = normalizarInterface(base.interface_access);
  const flags = derivarFlags(base.subscriber_type, base.supplementary_service_set);
  const reg = {
    origen_archivo: origenArchivo,
    tipo_formato: tipoFormato,
    creado_por: null,
    node: base.node || null,
    directory_number: dn,
    dn_digitos: dnDigitos,
    registration_status: base.registration_status || null,
    basic_service: base.basic_service || null,
    interface_access: base.interface_access || null,
    subscriber_type: base.subscriber_type || null,
    supplementary_service_set: base.supplementary_service_set || null,
    estado_registro: estado.estado_registro,
    registro_detalle: estado.registro_detalle,
    ip_origen: estado.ip_origen,
    central: iface.central,
    puerto: iface.puerto,
    suspendido: flags.suspendido,
    bloqueo: flags.bloqueo,
    linea_raw: lineaRaw
  };
  reg.hash_linea = calcHash(reg);
  return reg;
}

function parseContent(content, origenArchivo) {
  const lines = String(content || '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { registros: [], tipoFormato: null, errores: 0 };
  const detected = detectFormat(lines[0]);
  if (!detected) return { registros: [], tipoFormato: null, errores: lines.length };

  const registros = [];
  let errores = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    if (/^\[End of Document\]/i.test(trimmed)) continue;
    try {
      const base = parseLine(trimmed, detected.columns);
      registros.push(normalizar(base, detected.tipoFormato, origenArchivo, trimmed.slice(0, 400)));
    } catch {
      errores++;
    }
  }
  return { registros, tipoFormato: detected.tipoFormato, errores };
}

function listarArchivosData() {
  const info = [];
  for (const fileName of FILE_NAMES) {
    const filePath = path.join(DATA_DIR, fileName);
    const exists = fs.existsSync(filePath);
    let filas = 0;
    let tipoFormato = null;
    let tamano = 0;
    if (exists) {
      tamano = fs.statSync(filePath).size;
      const parsed = parseContent(fs.readFileSync(filePath, 'utf8'), fileName);
      filas = parsed.registros.length;
      tipoFormato = parsed.tipoFormato;
    }
    info.push({ archivo: fileName, existe: exists, filas, tipoFormato, tamano });
  }
  return info;
}

function genLote() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function buildBulkTable(sql) {
  const table = new sql.Table('teliskratel');
  table.create = false;
  table.columns.add('lote_import', sql.VarChar(20), { nullable: false });
  table.columns.add('origen_archivo', sql.NVarChar(200), { nullable: false });
  table.columns.add('tipo_formato', sql.VarChar(20), { nullable: false });
  table.columns.add('creado_por', sql.NVarChar(100), { nullable: true });
  table.columns.add('node', sql.NVarChar(20), { nullable: true });
  table.columns.add('directory_number', sql.NVarChar(50), { nullable: true });
  table.columns.add('dn_digitos', sql.NVarChar(40), { nullable: true });
  table.columns.add('registration_status', sql.NVarChar(120), { nullable: true });
  table.columns.add('basic_service', sql.NVarChar(120), { nullable: true });
  table.columns.add('interface_access', sql.NVarChar(120), { nullable: true });
  table.columns.add('subscriber_type', sql.NVarChar(80), { nullable: true });
  table.columns.add('supplementary_service_set', sql.NVarChar(120), { nullable: true });
  table.columns.add('estado_registro', sql.VarChar(20), { nullable: true });
  table.columns.add('registro_detalle', sql.NVarChar(120), { nullable: true });
  table.columns.add('ip_origen', sql.VarChar(45), { nullable: true });
  table.columns.add('central', sql.NVarChar(60), { nullable: true });
  table.columns.add('puerto', sql.NVarChar(20), { nullable: true });
  table.columns.add('suspendido', sql.Bit, { nullable: false });
  table.columns.add('bloqueo', sql.NVarChar(30), { nullable: true });
  table.columns.add('linea_raw', sql.NVarChar(400), { nullable: true });
  table.columns.add('hash_linea', sql.Char(64), { nullable: false });
  return table;
}

async function importar(registros, { origenArchivo, tipoFormato, usuario = null } = {}) {
  const pool = await getPool();
  const sql = getSql();
  const lote = genLote();

  const seen = new Set();
  const unicos = [];
  let duplicados = 0;
  for (const r of registros) {
    if (seen.has(r.hash_linea)) { duplicados++; continue; }
    seen.add(r.hash_linea);
    unicos.push(r);
  }

  await pool.request()
    .input('lote', sql.VarChar(20), lote)
    .input('origen', sql.NVarChar(200), origenArchivo)
    .input('tipo', sql.VarChar(20), tipoFormato || 'DESCONOCIDO')
    .input('leidas', sql.Int, registros.length)
    .input('ins', sql.Int, unicos.length)
    .input('dup', sql.Int, duplicados)
    .input('usr', sql.NVarChar(100), usuario)
    .query(`
      INSERT INTO teliskratel_import
        (lote_import, origen_archivo, tipo_formato, filas_leidas, insertados, duplicados, errores, creado_por)
      VALUES (@lote, @origen, @tipo, @leidas, @ins, @dup, 0, @usr)
    `);

  if (unicos.length) {
    const table = buildBulkTable(sql);
    for (const r of unicos) {
      table.rows.add(
        lote, r.origen_archivo, r.tipo_formato, usuario,
        r.node, r.directory_number, r.dn_digitos, r.registration_status,
        r.basic_service, r.interface_access, r.subscriber_type, r.supplementary_service_set,
        r.estado_registro, r.registro_detalle, r.ip_origen, r.central, r.puerto,
        !!r.suspendido, r.bloqueo, r.linea_raw, r.hash_linea
      );
    }
    await pool.request().bulk(table);
  }

  return { lote, filasLeidas: registros.length, insertados: unicos.length, duplicados, errores: 0 };
}

async function importarDesdeData(archivos = FILE_NAMES, usuario = null) {
  const pool = await getPool();
  const sql = getSql();
  const resultados = [];
  for (const fileName of archivos) {
    if (!FILE_NAMES.includes(fileName)) continue;
    const filePath = path.join(DATA_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      resultados.push({ archivo: fileName, error: 'Archivo no encontrado' });
      continue;
    }
    const parsed = parseContent(fs.readFileSync(filePath, 'utf8'), fileName);
    if (!parsed.registros.length) {
      resultados.push({ archivo: fileName, error: 'Formato no reconocido o sin registros' });
      continue;
    }
    const res = await importar(parsed.registros, { origenArchivo: fileName, tipoFormato: parsed.tipoFormato, usuario });
    resultados.push({ archivo: fileName, ...res });
  }
  return resultados;
}

async function buscarPorUltimos5(digitos) {
  const ult5 = String(digitos || '').replace(/\D/g, '').slice(-5);
  if (!ult5) return [];
  const pool = await getPool();
  const sql = getSql();
  const result = await pool.request()
    .input('ult5', sql.VarChar(5), ult5)
    .query(`
      SELECT TOP (200)
        id, lote_import, fecha_import, origen_archivo, node, directory_number,
        estado_registro, registro_detalle, ip_origen, central, puerto,
        subscriber_type, supplementary_service_set, bloqueo, suspendido
      FROM teliskratel
      WHERE dn_digitos IS NOT NULL AND RIGHT(dn_digitos, 5) = @ult5
      ORDER BY fecha_import DESC, id DESC
    `);
  return result.recordset;
}

async function listar({ q, estado, central, origen, lote, page = 1, limit = 100 } = {}) {
  const pool = await getPool();
  const sql = getSql();
  const req = pool.request();
  const conds = [];
  if (q) {
    const d = String(q).replace(/\D/g, '');
    req.input('q', sql.NVarChar(100), `%${q}%`);
    req.input('qd', sql.NVarChar(100), `%${d}%`);
    conds.push('(directory_number LIKE @q OR dn_digitos LIKE @qd OR ip_origen LIKE @q)');
  }
  if (estado) { req.input('estado', sql.VarChar(20), estado); conds.push('estado_registro = @estado'); }
  if (central) { req.input('central', sql.NVarChar(60), central); conds.push('central = @central'); }
  if (origen) { req.input('origen', sql.NVarChar(200), origen); conds.push('origen_archivo = @origen'); }
  if (lote) { req.input('lote', sql.VarChar(20), lote); conds.push('lote_import = @lote'); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(500, Math.max(1, Number(limit) || 100));
  req.input('offset', sql.Int, (p - 1) * l);
  req.input('limit', sql.Int, l);

  const result = await req.query(`
    SELECT id, lote_import, fecha_import, origen_archivo, node, directory_number,
           estado_registro, registro_detalle, ip_origen, central, puerto,
           subscriber_type, supplementary_service_set, bloqueo, suspendido
    FROM teliskratel
    ${where}
    ORDER BY fecha_import DESC, id DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);
  return result.recordset;
}

async function listarImportaciones() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT id, lote_import, fecha_import, origen_archivo, tipo_formato,
           filas_leidas, insertados, duplicados, errores, creado_por
    FROM teliskratel_import
    ORDER BY fecha_import DESC, id DESC
  `);
  return result.recordset;
}

async function eliminarImportacion(lote) {
  const pool = await getPool();
  const sql = getSql();
  await pool.request().input('lote', sql.VarChar(20), lote)
    .query('DELETE FROM teliskratel WHERE lote_import = @lote; DELETE FROM teliskratel_import WHERE lote_import = @lote;');
  return { lote };
}

async function ensureTeliskratelTable() {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const pool = await getPool();
      await pool.request().query(`
        IF OBJECT_ID('teliskratel') IS NULL
        CREATE TABLE teliskratel (
          id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_teliskratel PRIMARY KEY,
          lote_import VARCHAR(20) NOT NULL,
          fecha_import DATETIME NOT NULL DEFAULT GETDATE(),
          origen_archivo NVARCHAR(200) NOT NULL,
          tipo_formato VARCHAR(20) NOT NULL,
          creado_por NVARCHAR(100) NULL,
          node NVARCHAR(20) NULL,
          directory_number NVARCHAR(50) NULL,
          dn_digitos NVARCHAR(40) NULL,
          registration_status NVARCHAR(120) NULL,
          basic_service NVARCHAR(120) NULL,
          interface_access NVARCHAR(120) NULL,
          subscriber_type NVARCHAR(80) NULL,
          supplementary_service_set NVARCHAR(120) NULL,
          estado_registro VARCHAR(20) NULL,
          registro_detalle NVARCHAR(120) NULL,
          ip_origen VARCHAR(45) NULL,
          central NVARCHAR(60) NULL,
          puerto NVARCHAR(20) NULL,
          suspendido BIT NOT NULL DEFAULT 0,
          bloqueo NVARCHAR(30) NULL,
          linea_raw NVARCHAR(400) NULL,
          hash_linea CHAR(64) NOT NULL
        );

        IF OBJECT_ID('teliskratel_import') IS NULL
        CREATE TABLE teliskratel_import (
          id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_teliskratel_import PRIMARY KEY,
          lote_import VARCHAR(20) NOT NULL,
          fecha_import DATETIME NOT NULL DEFAULT GETDATE(),
          origen_archivo NVARCHAR(200) NOT NULL,
          tipo_formato VARCHAR(20) NOT NULL,
          filas_leidas INT NOT NULL DEFAULT 0,
          insertados INT NOT NULL DEFAULT 0,
          duplicados INT NOT NULL DEFAULT 0,
          errores INT NOT NULL DEFAULT 0,
          creado_por NVARCHAR(100) NULL
        );

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teliskratel_dn' AND object_id = OBJECT_ID('teliskratel'))
          CREATE INDEX IX_teliskratel_dn ON teliskratel (dn_digitos);

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teliskratel_archivo' AND object_id = OBJECT_ID('teliskratel'))
          CREATE INDEX IX_teliskratel_archivo ON teliskratel (origen_archivo, fecha_import);

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teliskratel_estado' AND object_id = OBJECT_ID('teliskratel'))
          CREATE INDEX IX_teliskratel_estado ON teliskratel (estado_registro);

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teliskratel_central' AND object_id = OBJECT_ID('teliskratel'))
          CREATE INDEX IX_teliskratel_central ON teliskratel (central);

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_teliskratel_lote_hash' AND object_id = OBJECT_ID('teliskratel'))
          CREATE UNIQUE INDEX UX_teliskratel_lote_hash ON teliskratel (lote_import, hash_linea);
      `);

      console.log('[teliskratel] Tablas listas.');

      const cnt = await pool.request().query('SELECT COUNT(*) AS c FROM teliskratel');
      if (cnt.recordset[0].c === 0) {
        const res = await importarDesdeData(FILE_NAMES, 'sistema');
        for (const r of res) {
          if (r.insertados != null) console.log(`[teliskratel] Import inicial ${r.archivo}: ${r.insertados} registros.`);
        }
      }
      return;
    } catch (err) {
      console.error('[teliskratel] Intento ' + (attempt + 1) + ' fallo:', err.message);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  console.error('[teliskratel] No se pudo inicializar la tabla.');
}

module.exports = {
  ensureTeliskratelTable,
  parseContent,
  listarArchivosData,
  importar,
  importarDesdeData,
  buscarPorUltimos5,
  listar,
  listarImportaciones,
  eliminarImportacion
};
