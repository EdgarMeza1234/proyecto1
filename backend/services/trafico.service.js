const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const sql = require('mssql');
const config = require('../config/env');
const socketService = require('./socket');

const BASE_DIR = 'E:\\AMAS\\2026';

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

const MONTH_MAP = {
  ENERO: 'ENE', FEBRERO: 'FEB', MARZO: 'MAR', ABRIL: 'ABR',
  MAYO: 'MAY', JUNIO: 'JUN', JULIO: 'JUL', AGOSTO: 'AGO',
  SEPTIEMBRE: 'SEP', OCTUBRE: 'OCT', NOVIEMBRE: 'NOV', DICIEMBRE: 'DIC'
};

const MONTH_NUMBERS = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04',
  MAYO: '05', JUNIO: '06', JULIO: '07', AGOSTO: '08',
  SEPTIEMBRE: '09', OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12'
};

function padWithF(field, targetLen = 16) {
  const len = field.length;
  if (len >= targetLen) return field;
  return 'F'.repeat(targetLen - len) + field;
}

function parseDateField(raw) {
  let val = raw;
  val = val.replace(/-/g, '');
  val = val.replace(/:/g, '');
  val = val.replace(/\|2025-/g, '|4');
  val = val.replace(/\|2026-/g, '|5');
  val = val.replace(/\|2024-/g, '|4');
  return val;
}

function secondsToMinutesStr(seconds) {
  const s = parseInt(seconds, 10);
  if (isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function padMinute1(m) {
  const len = m.length;
  if (len === 1) return '000000' + m;
  if (len === 2) return '00000' + m;
  if (len === 3) return '0000' + m;
  return m;
}

function padMinute2(m) {
  const len = m.length;
  if (len === 1) return m + '01';
  if (len === 2) return m + '1';
  return m;
}

function getDirName(mes, ano) {
  const monthAbbr = MONTH_MAP[mes.toUpperCase()];
  if (!monthAbbr) throw new Error(`Mes inválido: ${mes}`);
  return monthAbbr + ano;
}

function getDirPath(mes, ano) {
  return path.join(BASE_DIR, getDirName(mes, ano));
}

function getTableName(mes, ano) {
  return 'CDR' + getDirName(mes, ano);
}

const CREATE_TABLE_SQL = `
  CREATE TABLE {TABLE_NAME} (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [un] CHAR(10) NOT NULL,
    [dos] INT NOT NULL,
    [tres] INT NOT NULL,
    [cuatro] CHAR(15) NOT NULL,
    [cinco] CHAR(5) NOT NULL,
    [seis] CHAR(5) NOT NULL,
    [siete] CHAR(5) NOT NULL,
    [ocho] CHAR(25) NOT NULL,
    [nueve] CHAR(25) NOT NULL,
    [dies] CHAR(5) NULL,
    [once] CHAR(5) NULL,
    [doce] DATETIME NOT NULL,
    [trece] CHAR(5) NOT NULL,
    [catorce] DATETIME NOT NULL,
    [quince] CHAR(5) NULL,
    [diesiseis] CHAR(5) NULL,
    [diesisiete] CHAR(5) NULL,
    [diesiocho] CHAR(5) NULL,
    [diesinueve] CHAR(5) NULL,
    [veinte] CHAR(5) NULL,
    [vun] CHAR(5) NULL,
    [vdos] CHAR(5) NULL,
    [vtres] CHAR(5) NULL,
    [vcuatro] CHAR(5) NULL,
    [vcinco] CHAR(5) NULL,
    [vseis] CHAR(5) NULL,
    [vsiete] CHAR(5) NULL,
    [vocho] CHAR(5) NULL,
    [vnueve] CHAR(5) NULL,
    [treinta] CHAR(5) NULL,
    [tun] CHAR(5) NULL,
    [tdos] CHAR(5) NULL,
    [ttres] CHAR(5) NULL,
    [tcuatro] CHAR(5) NULL,
    [tcinco] CHAR(5) NULL,
    [tseis] CHAR(5) NULL,
    [tsiete] CHAR(5) NULL,
    [tocho] CHAR(5) NULL,
    [tnueve] CHAR(5) NULL,
    [cuarenta] CHAR(5) NULL,
    [cun] CHAR(5) NULL,
    [cdos] CHAR(5) NULL,
    [ctres] CHAR(5) NULL,
    [ccuatro] CHAR(15) NULL,
    [ccinco] CHAR(5) NULL,
    [cseis] CHAR(5) NULL,
    [csiete] CHAR(5) NULL,
    [cocho] CHAR(5) NULL,
    [cnueve] CHAR(5) NULL,
    [cincuenta] CHAR(5) NULL,
    [sun] CHAR(5) NULL,
    [sdos] CHAR(5) NULL,
    [stres] CHAR(5) NULL,
    [scuatro] CHAR(5) NULL,
    [scinco] CHAR(15) NULL,
    [sseis] CHAR(15) NULL,
    [ssiete] CHAR(15) NULL,
    [socho] CHAR(15) NULL,
    [snueve] CHAR(15) NULL,
    [sesenta] CHAR(5) NULL,
    [seun] CHAR(5) NULL,
    [sedos] CHAR(5) NULL,
    [setres] CHAR(5) NULL,
    [secuatro] CHAR(5) NULL,
    [secinco] CHAR(5) NULL,
    [seseis] CHAR(5) NULL,
    [sesiete] CHAR(5) NULL,
    [seocho] CHAR(5) NULL,
    [senueve] CHAR(5) NULL,
    [setenta] CHAR(5) NULL,
    [setun] CHAR(5) NULL,
    [setdos] CHAR(5) NULL
  )
`;

const COLUMNS = [
  { name: 'un', type: 'CHAR', len: 10 },
  { name: 'dos', type: 'INT' },
  { name: 'tres', type: 'INT' },
  { name: 'cuatro', type: 'CHAR', len: 15 },
  { name: 'cinco', type: 'CHAR', len: 5 },
  { name: 'seis', type: 'CHAR', len: 5 },
  { name: 'siete', type: 'CHAR', len: 5 },
  { name: 'ocho', type: 'CHAR', len: 25 },
  { name: 'nueve', type: 'CHAR', len: 25 },
  { name: 'dies', type: 'CHAR', len: 5 },
  { name: 'once', type: 'CHAR', len: 5 },
  { name: 'doce', type: 'DATETIME' },
  { name: 'trece', type: 'CHAR', len: 5 },
  { name: 'catorce', type: 'DATETIME' },
  { name: 'quince', type: 'CHAR', len: 5 },
  { name: 'diesiseis', type: 'CHAR', len: 5 },
  { name: 'diesisiete', type: 'CHAR', len: 5 },
  { name: 'diesiocho', type: 'CHAR', len: 5 },
  { name: 'diesinueve', type: 'CHAR', len: 5 },
  { name: 'veinte', type: 'CHAR', len: 5 },
  { name: 'vun', type: 'CHAR', len: 5 },
  { name: 'vdos', type: 'CHAR', len: 5 },
  { name: 'vtres', type: 'CHAR', len: 5 },
  { name: 'vcuatro', type: 'CHAR', len: 5 },
  { name: 'vcinco', type: 'CHAR', len: 5 },
  { name: 'vseis', type: 'CHAR', len: 5 },
  { name: 'vsiete', type: 'CHAR', len: 5 },
  { name: 'vocho', type: 'CHAR', len: 5 },
  { name: 'vnueve', type: 'CHAR', len: 5 },
  { name: 'treinta', type: 'CHAR', len: 5 },
  { name: 'tun', type: 'CHAR', len: 5 },
  { name: 'tdos', type: 'CHAR', len: 5 },
  { name: 'ttres', type: 'CHAR', len: 5 },
  { name: 'tcuatro', type: 'CHAR', len: 5 },
  { name: 'tcinco', type: 'CHAR', len: 5 },
  { name: 'tseis', type: 'CHAR', len: 5 },
  { name: 'tsiete', type: 'CHAR', len: 5 },
  { name: 'tocho', type: 'CHAR', len: 5 },
  { name: 'tnueve', type: 'CHAR', len: 5 },
  { name: 'cuarenta', type: 'CHAR', len: 5 },
  { name: 'cun', type: 'CHAR', len: 5 },
  { name: 'cdos', type: 'CHAR', len: 5 },
  { name: 'ctres', type: 'CHAR', len: 5 },
  { name: 'ccuatro', type: 'CHAR', len: 15 },
  { name: 'ccinco', type: 'CHAR', len: 5 },
  { name: 'cseis', type: 'CHAR', len: 5 },
  { name: 'csiete', type: 'CHAR', len: 5 },
  { name: 'cocho', type: 'CHAR', len: 5 },
  { name: 'cnueve', type: 'CHAR', len: 5 },
  { name: 'cincuenta', type: 'CHAR', len: 5 },
  { name: 'sun', type: 'CHAR', len: 5 },
  { name: 'sdos', type: 'CHAR', len: 5 },
  { name: 'stres', type: 'CHAR', len: 5 },
  { name: 'scuatro', type: 'CHAR', len: 5 },
  { name: 'scinco', type: 'CHAR', len: 15 },
  { name: 'sseis', type: 'CHAR', len: 15 },
  { name: 'ssiete', type: 'CHAR', len: 15 },
  { name: 'socho', type: 'CHAR', len: 15 },
  { name: 'snueve', type: 'CHAR', len: 15 },
  { name: 'sesenta', type: 'CHAR', len: 5 },
  { name: 'seun', type: 'CHAR', len: 5 },
  { name: 'sedos', type: 'CHAR', len: 5 },
  { name: 'setres', type: 'CHAR', len: 5 },
  { name: 'secuatro', type: 'CHAR', len: 5 },
  { name: 'secinco', type: 'CHAR', len: 5 },
  { name: 'seseis', type: 'CHAR', len: 5 },
  { name: 'sesiete', type: 'CHAR', len: 5 },
  { name: 'seocho', type: 'CHAR', len: 5 },
  { name: 'senueve', type: 'CHAR', len: 5 },
  { name: 'setenta', type: 'CHAR', len: 5 },
  { name: 'setun', type: 'CHAR', len: 5 },
  { name: 'setdos', type: 'CHAR', len: 5 }
];

async function asegurarTabla(mes, ano) {
  const pool = await getTraficoPool();
  const tableName = getTableName(mes, ano);
  const result = await pool.request().query(`
    SELECT OBJECT_ID('${tableName}') AS tableId
  `);
  if (result.recordset[0].tableId) {
    const colResult = await pool.request().query(`
      SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${tableName}'
    `);
    if (colResult.recordset[0].cnt >= 72) {
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
    .filter(f => f.toLowerCase().endsWith('.ama'))
    .map(f => ({
      nombre: f,
      ruta: path.join(dirPath, f),
      tamano: fs.statSync(path.join(dirPath, f)).size
    }));
}

async function convertirArchivo(filePath, mes, ano, tipo = 'TXT') {
  const dirName = getDirName(mes, ano);
  const outputDir = getDirPath(mes, ano);
  try {
    await fsPromises.mkdir(outputDir, { recursive: true });
  } catch {}
  const outputPath = path.join(outputDir, `${dirName}.${tipo}`);
  const errorPath = path.join(outputDir, 'ERROR');
  const content = await fsPromises.readFile(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  let outputLines = [];
  let errorLines = [];
  let omitidos = 0;
  for (const line of lines) {
    try {
      const aDatos = line.split('|');
      if (aDatos.length < 38) {
        errorLines.push(`Error: menos de 38 campos (tiene ${aDatos.length}) | ${line}`);
        continue;
      }
      const rawDate = aDatos[12] || '';
      const rawMonth = rawDate.substring(5, 7);
      const rawYear = rawDate.substring(0, 4);
      const targetMonth = MONTH_NUMBERS[mes.toUpperCase()];
      if (rawYear !== ano || rawMonth !== targetMonth) {
        omitidos++;
        continue;
      }
      aDatos[12] = parseDateField(rawDate);
      const fecha1 = (aDatos[12] || '').substring(3, 8);
      const hora1 = (aDatos[12] || '').substring(9, 15);
      const t2 = secondsToMinutesStr(aDatos[37] || '0');
      const [minPart, secPart] = t2.split(':');
      const minuto1 = padMinute1(minPart || '0');
      aDatos[9] = padWithF(aDatos[9] || '', 16);
      const minuto2 = padMinute2(secPart || '0');
      const aux = `AA00500|${fecha1}|000${aDatos[8] || ''}|${aDatos[9]}|${hora1}|${minuto1}|${minuto2}`;
      outputLines.push(aux);
    } catch {
      errorLines.push(`Error: excepcion en conversion | ${line}`);
    }
  }
  await fsPromises.appendFile(outputPath, outputLines.join('\r\n') + '\r\n', 'utf8');
  if (errorLines.length > 0) {
    await fsPromises.appendFile(errorPath, errorLines.join('\r\n') + '\r\n', 'utf8');
  }
  return { convertidos: outputLines.length, errores: errorLines.length, omitidos };
}

async function splitArchivo(archivoPath) {
  const content = await fsPromises.readFile(archivoPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  const salLines = [];
  const entLines = [];
  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length > 2 && (parts[2] || '').trim().length === 10) {
      salLines.push(line);
    } else {
      entLines.push(line);
    }
  }
  const dir = path.dirname(archivoPath);
  const baseName = path.basename(archivoPath).replace(/\.[^.]+$/, '');
  const salPath = path.join(dir, `${baseName}.SAL`);
  const entPath = path.join(dir, `${baseName}.ENT`);
  await fsPromises.writeFile(salPath, salLines.join('\r\n') + '\r\n', 'utf8');
  await fsPromises.writeFile(entPath, entLines.join('\r\n') + '\r\n', 'utf8');
  return { sal: salLines.length, ent: entLines.length, total: lines.length };
}

async function procesarArchivosPorDia(mes, ano, tipo = 'TXT') {
  const dirPath = getDirPath(mes, ano);
  try {
    await fsPromises.access(dirPath);
  } catch {
    throw new Error(`Directorio no encontrado: ${dirPath}`);
  }
  const files = await fsPromises.readdir(dirPath);
  const amaFiles = files.filter(f => f.toLowerCase().endsWith('.ama'));
  const dirName = getDirName(mes, ano);
  const outputPath = path.join(dirPath, `${dirName}.${tipo}`);
  try { await fsPromises.unlink(outputPath); } catch {}
  let totalConvertidos = 0;
  let totalErrores = 0;
  let totalOmitidos = 0;
  let archivosProcesados = 0;
  let resumen = [];
  const totalArchivos = amaFiles.length;
  socketService.emitEvent('trafico-progress', { fase: 'iniciando-conversion', totalArchivos });
  for (let fi = 0; fi < amaFiles.length; fi++) {
    const file = amaFiles[fi];
    const filePath = path.join(dirPath, file);
    socketService.emitEvent('trafico-progress', {
      archivo: file, fase: 'conversion-archivo',
      archivoActual: fi + 1, totalArchivos,
      convertidos: totalConvertidos, errores: totalErrores, omitidos: totalOmitidos
    });
    try {
      const result = await convertirArchivo(filePath, mes, ano, tipo);
      totalConvertidos += result.convertidos;
      totalErrores += result.errores;
      totalOmitidos += result.omitidos || 0;
      archivosProcesados++;
      resumen.push({ archivo: file, ...result });
    } catch (err) {
      totalErrores++;
      resumen.push({ archivo: file, error: err.message });
    }
    socketService.emitEvent('trafico-progress', {
      archivo: file,
      fase: 'conversion-completado',
      archivoActual: fi + 1,
      totalArchivos,
      convertidos: totalConvertidos,
      errores: totalErrores,
      omitidos: totalOmitidos
    });
  }
  return { archivosProcesados, totalConvertidos, totalErrores, totalOmitidos, resumen, archivoSalida: outputPath };
}

async function splitPorDia(mes, ano, tipo = 'TXT') {
  const dirName = getDirName(mes, ano);
  const dirPath = getDirPath(mes, ano);
  const inputPath = path.join(dirPath, `${dirName}.${tipo}`);
  try {
    await fsPromises.access(inputPath);
  } catch {
    throw new Error(`Archivo ${dirName}.${tipo} no encontrado en ${dirPath}`);
  }
  return await splitArchivo(inputPath);
}

async function insertarEnBD(filePath, tableName, mes, ano, archivoLabel, archivoActual = 0, totalArchivos = 1) {
  const content = await fsPromises.readFile(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  const pool = await getTraficoPool();
  let insertados = 0;
  let errores = 0;
  let invalidRecords = [];
  let omitidos = 0;
  const total = lines.length;
  const emitProgress = (socketService && typeof socketService.emitEvent === 'function');
  const PROGRESS_INTERVAL = Math.max(1, Math.floor(total / 100));
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (emitProgress && idx % PROGRESS_INTERVAL === 0) {
      socketService.emitEvent('trafico-progress', {
        archivo: archivoLabel || path.basename(filePath),
        completado: idx,
        total,
        insertados,
        errores,
        omitidos,
        archivoActual,
        totalArchivos,
        fase: 'insertando'
      });
    }
    try {
      const aDatos = line.split('|');
      if (aDatos.length < 73) {
        errores++;
        invalidRecords.push(line + ' | Error: Faltan campos');
        continue;
      }
      if (mes && ano) {
        const rawDate = aDatos[12] || '';
        const rawMonth = rawDate.substring(5, 7);
        const rawYear = rawDate.substring(0, 4);
        const targetMonth = MONTH_NUMBERS[mes.toUpperCase()];
        if (rawYear !== ano || rawMonth !== targetMonth) {
          omitidos++;
          continue;
        }
      }
      const doceVal = (aDatos[12] || '').trim();
      const catorceVal = (aDatos[14] || '').trim();
      const doceDate = new Date(doceVal);
      const catorceDate = new Date(catorceVal);
      if (isNaN(doceDate.getTime()) || isNaN(catorceDate.getTime())) {
        errores++;
        invalidRecords.push(line + ' | Error: Fecha invalida');
        continue;
      }
      const request = pool.request();
      for (let i = 0; i < COLUMNS.length; i++) {
        const idx = i + 1;
        const col = COLUMNS[i];
        const rawValue = aDatos[idx];
        if (col.type === 'DATETIME') {
          const dateVal = col.name === 'doce' ? doceDate : catorceDate;
          request.input(col.name, sql.DateTime, dateVal);
        } else if (col.type === 'INT') {
          request.input(col.name, sql.Int, parseInt(rawValue, 10) || 0);
        } else {
          const strVal = (rawValue || '').toString();
          request.input(col.name, sql.Char(col.len || 5), strVal);
        }
      }
      const sqlCols = COLUMNS.map(c => c.name).join(', ');
      const sqlParams = COLUMNS.map(c => `@${c.name}`).join(', ');
      await request.query(`INSERT INTO ${tableName} (${sqlCols}) VALUES (${sqlParams})`);
      insertados++;
    } catch (err) {
      errores++;
      invalidRecords.push(line + ' | Error: ' + err.message);
    }
  }
  const dir = path.dirname(filePath);
  const invalidPath = path.join(dir, 'InvalidData.txt');
  if (invalidRecords.length > 0) {
    await fsPromises.appendFile(invalidPath, invalidRecords.join('\r\n') + '\r\n', 'utf8');
  }
  if (emitProgress) {
    socketService.emitEvent('trafico-progress', {
      archivo: archivoLabel || path.basename(filePath),
      completado: total,
      total,
      insertados,
      errores,
      omitidos,
      archivoActual,
      totalArchivos,
      fase: 'completado'
    });
  }
  return { insertados, errores, omitidos, total: lines.length };
}

async function procesarEInsertar(mes, ano) {
  const dirName = getDirName(mes, ano);
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
  const amaFiles = files.filter(f => f.toLowerCase().endsWith('.ama'));

  if (amaFiles.length === 0) {
    throw new Error(`No hay archivos .ama en ${dirPath}`);
  }

  let totalInsertados = 0;
  let totalErrores = 0;
  let totalRegistros = 0;
  let totalOmitidos = 0;
  let resumen = [];
  const totalArchivos = amaFiles.length;
  socketService.emitEvent('trafico-progress', { fase: 'iniciando-insercion', totalArchivos });

  for (let fi = 0; fi < amaFiles.length; fi++) {
    const file = amaFiles[fi];
    const filePath = path.join(dirPath, file);
    socketService.emitEvent('trafico-progress', {
      archivo: file,
      fase: 'insertar-archivo',
      archivoActual: fi + 1,
      totalArchivos,
      insertados: totalInsertados,
      errores: totalErrores
    });
    try {
      const result = await insertarEnBD(filePath, tableName, mes, ano, file, fi + 1, totalArchivos);
      totalInsertados += result.insertados;
      totalErrores += result.errores;
      totalRegistros += result.total;
      totalOmitidos += result.omitidos || 0;
      resumen.push({ archivo: file, ...result });
    } catch (err) {
      totalErrores++;
      resumen.push({ archivo: file, error: err.message });
    }
    socketService.emitEvent('trafico-progress', {
      archivo: file, fase: 'file-completado',
      archivoActual: fi + 1, totalArchivos,
      insertados: totalInsertados, errores: totalErrores, omitidos: totalOmitidos
    });
  }

  return {
    insertados: totalInsertados,
    errores: totalErrores,
    total: totalRegistros,
    omitidos: totalOmitidos,
    tabla: tableName,
    tablaCreada: tableInfo.creada,
    archivosProcesados: amaFiles.length,
    resumen
  };
}

async function leerErrores(mes, ano) {
  const dirPath = getDirPath(mes, ano);
  const errores = [];
  for (const name of ['ERROR', 'InvalidData.txt']) {
    const filePath = path.join(dirPath, name);
    try {
      const content = await fsPromises.readFile(filePath, 'utf8');
      const lines = content.split(/\r?\n/).filter(l => l.trim());
      if (lines.length === 0) continue;
      const categorias = {};
      const catCounts = {};
      for (const line of lines) {
        const cat = line.startsWith('Error:') ? line.split('|')[0].trim() : 'Formato desconocido (sin descripcion)';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
        if (!categorias[cat]) categorias[cat] = [];
        if (categorias[cat].length < 5) categorias[cat].push(line);
      }
      errores.push({
        archivo: name,
        total: lines.length,
        categorias: Object.entries(categorias).map(([tipo, muestras]) => ({
          tipo,
          cantidad: catCounts[tipo] || muestras.length,
          muestras
        }))
      });
    } catch {}
  }
  return errores;
}

async function limpiarTabla(mes, ano) {
  const tableName = getTableName(mes, ano);
  const pool = await getTraficoPool();
  await pool.request().query(`IF OBJECT_ID('${tableName}') IS NOT NULL DELETE FROM ${tableName}`);
  return { mensaje: `Registros eliminados de ${tableName}` };
}

module.exports = {
  listFiles,
  convertirArchivo,
  splitArchivo,
  splitPorDia,
  procesarArchivosPorDia,
  insertarEnBD,
  procesarEInsertar,
  asegurarTabla,
  limpiarTabla,
  leerErrores,
  getTableName,
  getDirName,
  MONTH_MAP
};
