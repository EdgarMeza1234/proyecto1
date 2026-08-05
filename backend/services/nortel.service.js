const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const sql = require('mssql');
const config = require('../config/env');
const socketService = require('./socket');

const BASE_DIR = 'E:\\AMAS\\NORTEL';

const MONTH_MAP = {
  ENERO: 'ENE', FEBRERO: 'FEB', MARZO: 'MAR', ABRIL: 'ABR',
  MAYO: 'MAY', JUNIO: 'JUN', JULIO: 'JUL', AGOSTO: 'AGO',
  SEPTIEMBRE: 'SEP', OCTUBRE: 'OCT', NOVIEMBRE: 'NOV', DICIEMBRE: 'DIC'
};

let traficoPool;

async function getTraficoPool() {
  if (traficoPool) return traficoPool;
  const pool = new sql.ConnectionPool({
    user: config.sql.user,
    password: config.sql.password,
    server: config.sql.server,
    database: config.traficoDb,
    options: {
      encrypt: config.sql.encrypt,
      trustServerCertificate: config.sql.trustServerCertificate,
      useUTC: false
    }
  });
  traficoPool = await pool.connect();
  return traficoPool;
}

function getDirName(mes, ano) {
  const abbr = MONTH_MAP[mes.toUpperCase()];
  if (!abbr) throw new Error(`Mes invalido: ${mes}`);
  return abbr + ano;
}

function getDirPath(mes, ano) {
  return path.join(BASE_DIR, getDirName(mes, ano));
}

function getTableName(mes, ano) {
  return 'CDR' + getDirName(mes, ano) + 'N';
}

const CREATE_TABLE_SQL = `
  CREATE TABLE {TABLE_NAME} (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [Tipo] VARCHAR(10) NOT NULL,
    [C01] VARCHAR(20) NULL,
    [C02] VARCHAR(20) NULL,
    [C03] VARCHAR(20) NULL,
    [C04] VARCHAR(20) NULL,
    [C05] VARCHAR(20) NULL,
    [C06] VARCHAR(20) NULL,
    [Fecha] DATE NULL,
    [C08] VARCHAR(20) NULL,
    [C09] VARCHAR(20) NULL,
    [C10] VARCHAR(20) NULL,
    [AbonadoA] VARCHAR(30) NULL,
    [AbonadoB] VARCHAR(40) NULL,
    [HoraConexion] VARCHAR(12) NULL,
    [Duracion] VARCHAR(15) NULL,
    [C15] VARCHAR(20) NULL,
    [FechaFin] VARCHAR(10) NULL,
    [HoraFin] VARCHAR(20) NULL,
    [C18] VARCHAR(20) NULL
  )
`;

function parseDateField(dateField, ano) {
  if (!dateField || dateField.length < 5) return null;
  const yearDigit = dateField[0];
  const month = dateField.substring(1, 3);
  const day = dateField.substring(3, 5);
  const yearPrefix = ano.substring(0, 3);
  const fullYear = yearPrefix + yearDigit;
  try {
    const d = new Date(`${fullYear}-${month}-${day}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function parseTimeField(timeField) {
  if (!timeField || timeField.length < 6) return null;
  const hour = timeField.substring(0, 2);
  const minute = timeField.substring(2, 4);
  const second = timeField.substring(4, 6);
  const tenth = timeField.length > 6 ? timeField.substring(6, 7) : '0';
  return `${hour}:${minute}:${second}.${tenth}`;
}

async function asegurarTabla(mes, ano) {
  const pool = await getTraficoPool();
  const tableName = getTableName(mes, ano);
  const result = await pool.request().query(`
    SELECT OBJECT_ID('${tableName}') AS tableId
  `);
  if (result.recordset[0].tableId) {
    const colResult = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${tableName}'
    `);
    const cols = colResult.recordset.map(r => r.COLUMN_NAME);
    const hasAbonadoA = cols.includes('AbonadoA');
    if (hasAbonadoA && cols.length >= 20) {
      return { creada: false, nombre: tableName };
    }
    await pool.request().query(`DROP TABLE ${tableName}`);
  }
  const createSql = CREATE_TABLE_SQL.replace(/\{TABLE_NAME\}/g, tableName);
  await pool.request().query(createSql);
  return { creada: true, nombre: tableName };
}

async function listFiles(mes, ano) {
  const dirPath = getDirPath(mes, ano);
  try {
    await fsPromises.access(dirPath);
  } catch {
    return [];
  }
  const files = await fsPromises.readdir(dirPath);
  return files
    .filter(f => !f.toLowerCase().includes('emc'))
    .map(f => ({
      nombre: f,
      ruta: path.join(dirPath, f),
      tamano: fs.statSync(path.join(dirPath, f)).size
    }));
}

async function listAllFiles(mes, ano) {
  const dirPath = getDirPath(mes, ano);
  try {
    await fsPromises.access(dirPath);
  } catch {
    return [];
  }
  const files = await fsPromises.readdir(dirPath);
  return files.map(f => ({
    nombre: f,
    ruta: path.join(dirPath, f),
    tamano: fs.statSync(path.join(dirPath, f)).size,
    extension: path.extname(f).toLowerCase()
  }));
}

const MONTH_NUMBERS = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04',
  MAYO: '05', JUNIO: '06', JULIO: '07', AGOSTO: '08',
  SEPTIEMBRE: '09', OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12'
};

async function consolidar(mes, ano, fileName) {
  const dirPath = getDirPath(mes, ano);
  const inputPath = path.join(dirPath, fileName);
  const baseName = path.basename(fileName, path.extname(fileName));
  const outputPath = path.join(dirPath, baseName + '.emc');
  const content = await fsPromises.readFile(inputPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const targetMonth = MONTH_NUMBERS[mes.toUpperCase()];
  const targetYearDigit = ano.slice(-1);
  let count = 0;
  let omitidos = 0;
  const outputLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r/g, '');
    if (line.includes('AA')) {
      const nextLine = (i + 1 < lines.length) ? lines[i + 1].replace(/\r/g, '') : '';
      const concatenated = line + nextLine;
      const result = concatenated.replace(/ /g, '');
      const trimmed = result.endsWith('C') ? result.slice(0, -1) : result;
      const parts = trimmed.split('C');
      const dateField = parts[6] || '';
      const recordMonth = dateField.substring(1, 3);
      const recordYear = dateField.substring(0, 1);
      if (recordMonth === targetMonth && recordYear === targetYearDigit) {
        count++;
        outputLines.push(result);
      } else {
        omitidos++;
      }
    }
  }
  outputLines.push(count.toString());
  await fsPromises.writeFile(outputPath, outputLines.join('\r\n') + '\r\n', 'utf8');
  return { archivoSalida: outputPath, registros: count, omitidos, archivo: fileName };
}

async function consolidarTodo(mes, ano) {
  const dirPath = getDirPath(mes, ano);
  try {
    await fsPromises.access(dirPath);
  } catch {
    throw new Error(`Directorio no encontrado: ${dirPath}`);
  }
  const files = await fsPromises.readdir(dirPath);
  const rawFiles = files.filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.txt', '.log', ''].includes(ext) || (!f.includes('.') && !f.toLowerCase().includes('emc'));
  });
  if (rawFiles.length === 0) {
    throw new Error(`No hay archivos crudos en ${dirPath}`);
  }
  let totalRegistros = 0;
  let totalOmitidos = 0;
  let archivosProcesados = 0;
  let resumen = [];
  const totalArchivos = rawFiles.length;
  socketService.emitEvent('nortel-progress', { fase: 'iniciando-consolidacion', totalArchivos });
  for (let fi = 0; fi < rawFiles.length; fi++) {
    const file = rawFiles[fi];
    const filePath = path.join(dirPath, file);
    socketService.emitEvent('nortel-progress', {
      archivo: file, fase: 'consolidando',
      archivoActual: fi + 1, totalArchivos,
      registros: totalRegistros
    });
    try {
      const result = await consolidar(mes, ano, file);
      totalRegistros += result.registros;
      totalOmitidos += result.omitidos || 0;
      archivosProcesados++;
      resumen.push(result);
    } catch (err) {
      resumen.push({ archivo: file, error: err.message });
    }
    socketService.emitEvent('nortel-progress', {
      archivo: file, fase: 'consolidacion-completado',
      archivoActual: fi + 1, totalArchivos,
      registros: totalRegistros
    });
  }
  return { archivosProcesados, totalRegistros, totalOmitidos, resumen };
}

async function splitArchivo(mes, ano, fileName) {
  const dirPath = getDirPath(mes, ano);
  const baseName = path.basename(fileName, path.extname(fileName));
  const inputPath = path.join(dirPath, fileName);
  try {
    await fsPromises.access(inputPath);
  } catch {
    throw new Error(`Archivo no encontrado: ${inputPath}`);
  }
  const content = await fsPromises.readFile(inputPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  const amaLines = [];
  const dosmilLines = [];
  for (const line of lines) {
    if (line.includes('FFFFFFFFFFF2001')) {
      dosmilLines.push(line);
    } else {
      amaLines.push(line);
    }
  }
  const amaPath = path.join(dirPath, baseName + 'AMA.EMC');
  const dosmilPath = path.join(dirPath, baseName + '2001.EMC');
  await fsPromises.writeFile(amaPath, amaLines.join('\r\n') + '\r\n', 'utf8');
  await fsPromises.writeFile(dosmilPath, dosmilLines.join('\r\n') + '\r\n', 'utf8');
  return {
    ama: amaLines.length,
    dosmil: dosmilLines.length,
    total: lines.length,
    archivoAMA: amaPath,
    archivo2001: dosmilPath
  };
}

async function splitAll(mes, ano) {
  const dirPath = getDirPath(mes, ano);
  try {
    await fsPromises.access(dirPath);
  } catch {
    throw new Error(`Directorio no encontrado: ${dirPath}`);
  }
  const files = await fsPromises.readdir(dirPath);
  const emcFiles = files.filter(f => f.toLowerCase().endsWith('.emc') && !f.toLowerCase().includes('ama.') && !f.toLowerCase().includes('2001.'));
  if (emcFiles.length === 0) {
    throw new Error(`No hay archivos .emc en ${dirPath}`);
  }
  let totalAma = 0;
  let total2001 = 0;
  let resumen = [];
  const totalArchivos = emcFiles.length;
  socketService.emitEvent('nortel-progress', { fase: 'iniciando-split', totalArchivos });
  for (let fi = 0; fi < emcFiles.length; fi++) {
    const file = emcFiles[fi];
    socketService.emitEvent('nortel-progress', {
      archivo: file, fase: 'split',
      archivoActual: fi + 1, totalArchivos
    });
    try {
      const result = await splitArchivo(mes, ano, file);
      totalAma += result.ama;
      total2001 += result.dosmil;
      resumen.push({ archivo: file, ...result });
    } catch (err) {
      resumen.push({ archivo: file, error: err.message });
    }
    socketService.emitEvent('nortel-progress', {
      archivo: file, fase: 'split-completado',
      archivoActual: fi + 1, totalArchivos
    });
  }
  return { totalAma, total2001, resumen };
}

const COLUMN_MAP = [
  { name: 'Tipo', index: 0, type: 'VARCHAR', len: 10 },
  { name: 'C01', index: 1, type: 'VARCHAR', len: 20 },
  { name: 'C02', index: 2, type: 'VARCHAR', len: 20 },
  { name: 'C03', index: 3, type: 'VARCHAR', len: 20 },
  { name: 'C04', index: 4, type: 'VARCHAR', len: 20 },
  { name: 'C05', index: 5, type: 'VARCHAR', len: 20 },
  { name: 'C06', index: 6, type: 'VARCHAR', len: 20 },
  { name: 'Fecha', index: 6, type: 'DATE', raw: true },
  { name: 'C08', index: 7, type: 'VARCHAR', len: 20 },
  { name: 'C09', index: 8, type: 'VARCHAR', len: 20 },
  { name: 'C10', index: 9, type: 'VARCHAR', len: 20 },
  { name: 'AbonadoA', index: 10, type: 'VARCHAR', len: 30 },
  { name: 'AbonadoB', index: 11, type: 'VARCHAR', len: 40 },
  { name: 'HoraConexion', index: 12, type: 'VARCHAR', len: 12, raw: true },
  { name: 'Duracion', index: 13, type: 'VARCHAR', len: 15 },
  { name: 'C15', index: 14, type: 'VARCHAR', len: 20 },
  { name: 'FechaFin', index: 15, type: 'VARCHAR', len: 10 },
  { name: 'HoraFin', index: 16, type: 'VARCHAR', len: 20 },
  { name: 'C18', index: 17, type: 'VARCHAR', len: 20 }
];

function parseLine(line) {
  const trimmed = line.endsWith('C') ? line.slice(0, -1) : line;
  const parts = trimmed.split('C');
  return parts;
}

function getSqlType(col) {
  if (col.type === 'DATE') return sql.Date;
  return sql.VarChar(col.len || 50);
}

function getColumnValue(parts, col, ano) {
  const raw = parts[col.index] || null;
  if (raw === null) return null;
  if (!col.raw) return raw.substring(0, col.len || 50);
  if (col.name === 'Fecha') {
    return parseDateField(raw, ano);
  }
  if (col.name === 'HoraConexion') {
    return parseTimeField(raw);
  }
  return raw.substring(0, col.len || 50);
}

async function insertarEnBD(mes, ano, fileName) {
  const dirPath = getDirPath(mes, ano);
  const inputPath = path.join(dirPath, fileName);
  try {
    await fsPromises.access(inputPath);
  } catch {
    throw new Error(`Archivo no encontrado: ${inputPath}`);
  }
  const content = await fsPromises.readFile(inputPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  const lastLine = lines[lines.length - 1];
  const dataLines = /^\d+$/.test(lastLine) ? lines.slice(0, -1) : lines;
  const tableName = getTableName(mes, ano);
  const pool = await getTraficoPool();
  let insertados = 0;
  let errores = 0;
  let invalidRecords = [];
  const total = dataLines.length;
  const emitProgress = true;
  const PROGRESS_INTERVAL = Math.max(1, Math.floor(total / 100));
  for (let idx = 0; idx < dataLines.length; idx++) {
    const line = dataLines[idx];
    if (emitProgress && idx % PROGRESS_INTERVAL === 0) {
      socketService.emitEvent('nortel-progress', {
        archivo: fileName,
        completado: idx,
        total,
        insertados,
        errores,
        fase: 'insertando'
      });
    }
    try {
      const parts = parseLine(line);
      const sqlCols = COLUMN_MAP.map(c => `[${c.name}]`).join(', ');
      const sqlParams = COLUMN_MAP.map(c => `@${c.name}`).join(', ');
      const request = pool.request();
      for (const col of COLUMN_MAP) {
        const val = getColumnValue(parts, col, ano);
        if (val === null || val === undefined) {
          request.input(col.name, getSqlType(col), null);
        } else if (col.type === 'DATE') {
          request.input(col.name, sql.Date, val);
        } else {
          request.input(col.name, sql.VarChar(col.len || 50), val);
        }
      }
      await request.query(`INSERT INTO ${tableName} (${sqlCols}) VALUES (${sqlParams})`);
      insertados++;
    } catch (err) {
      errores++;
      invalidRecords.push((line || '').substring(0, 200) + ' | Error: ' + err.message);
    }
  }
  const invalidPath = path.join(dirPath, 'InvalidData.txt');
  if (invalidRecords.length > 0) {
    await fsPromises.appendFile(invalidPath, invalidRecords.join('\r\n') + '\r\n', 'utf8');
  }
  if (emitProgress) {
    socketService.emitEvent('nortel-progress', {
      archivo: fileName,
      completado: total,
      total,
      insertados,
      errores,
      fase: 'completado'
    });
  }
  return { insertados, errores, total: dataLines.length };
}

async function procesarEInsertar(mes, ano) {
  const dirPath = getDirPath(mes, ano);
  try {
    await fsPromises.access(dirPath);
  } catch {
    throw new Error(`Directorio no encontrado: ${dirPath}`);
  }
  const tableName = getTableName(mes, ano);
  const tableInfo = await asegurarTabla(mes, ano);
  const pool = await getTraficoPool();
  await pool.request().query(`DELETE FROM ${tableName}`);
  const files = await fsPromises.readdir(dirPath);
  const amaFiles = files.filter(f => f.toUpperCase().endsWith('AMA.EMC'));
  if (amaFiles.length === 0) {
    throw new Error(`No hay archivos *AMA.EMC en ${dirPath}`);
  }
  let totalInsertados = 0;
  let totalErrores = 0;
  let totalRegistros = 0;
  let resumen = [];
  const totalArchivos = amaFiles.length;
  socketService.emitEvent('nortel-progress', { fase: 'iniciando-insercion', totalArchivos });
  for (let fi = 0; fi < amaFiles.length; fi++) {
    const file = amaFiles[fi];
    socketService.emitEvent('nortel-progress', {
      archivo: file, fase: 'insertar-archivo',
      archivoActual: fi + 1, totalArchivos,
      insertados: totalInsertados, errores: totalErrores
    });
    try {
      const result = await insertarEnBD(mes, ano, file);
      totalInsertados += result.insertados;
      totalErrores += result.errores;
      totalRegistros += result.total;
      resumen.push({ archivo: file, ...result });
    } catch (err) {
      totalErrores++;
      resumen.push({ archivo: file, error: err.message });
    }
    socketService.emitEvent('nortel-progress', {
      archivo: file, fase: 'file-completado',
      archivoActual: fi + 1, totalArchivos,
      insertados: totalInsertados, errores: totalErrores
    });
  }
  return {
    insertados: totalInsertados,
    errores: totalErrores,
    total: totalRegistros,
    tabla: tableName,
    tablaCreada: tableInfo.creada,
    archivosProcesados: amaFiles.length,
    resumen
  };
}

async function limpiarTabla(mes, ano) {
  const tableName = getTableName(mes, ano);
  const pool = await getTraficoPool();
  await pool.request().query(`IF OBJECT_ID('${tableName}') IS NOT NULL DELETE FROM ${tableName}`);
  return { mensaje: `Registros eliminados de ${tableName}` };
}

module.exports = {
  listFiles,
  listAllFiles,
  consolidar,
  consolidarTodo,
  splitArchivo,
  splitAll,
  asegurarTabla,
  insertarEnBD,
  procesarEInsertar,
  limpiarTabla,
  getTableName,
  getDirName,
  MONTH_MAP
};
