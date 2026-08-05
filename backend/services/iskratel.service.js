const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_NAMES = ['iskratel.out', 'iskratel6.out'];

const FILE_FORMATS = {
  'iskratel.out': {
    header: '|Node|Directory Number|Registration Status|Subscriber Type|Supplementary Service Set',
    columns: ['Node', 'Directory Number', 'Registration Status', 'Subscriber Type', 'Supplementary Service Set']
  },
  'iskratel6.out': {
    header: '|Node|Directory Number|Basic Service|Interface / Access|Subscriber Type|Supplementary Service Set',
    columns: ['Node', 'Directory Number', 'Basic Service', 'Interface / Access', 'Subscriber Type', 'Supplementary Service Set']
  }
};

function detectFormat(headerLine) {
  for (const [fileName, format] of Object.entries(FILE_FORMATS)) {
    if (headerLine.trim() === format.header) {
      return { fileName, format };
    }
  }
  return null;
}

function parseValue(value) {
  if (!value || value.trim() === '') return null;
  return value.trim();
}

function parseLine(line, columns) {
  const parts = line.split('|');
  const row = {};
  columns.forEach((col, i) => {
    const val = parts[i + 1];
    row[col] = parseValue(val);
  });
  return row;
}

function loadFile(filePath, fileName) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Archivo no encontrado: ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim());

  if (lines.length === 0) return [];

  const detected = detectFormat(lines[0]);
  if (!detected) {
    console.warn(`Formato no reconocido en ${fileName}, se omite`);
    return [];
  }

  const format = detected.format;
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('|')) continue;
    const row = parseLine(line, format.columns);
    row._archivo = fileName;
    row._formato = format.header;
    rows.push(row);
  }

  return rows;
}

let cachedData = null;

function loadAll() {
  if (cachedData) return cachedData;

  const all = [];
  for (const fileName of FILE_NAMES) {
    const filePath = path.join(DATA_DIR, fileName);
    const rows = loadFile(filePath, fileName);
    all.push(...rows);
  }

  cachedData = all;
  return cachedData;
}

function getArchivosInfo() {
  const info = [];
  for (const fileName of FILE_NAMES) {
    const filePath = path.join(DATA_DIR, fileName);
    const exists = fs.existsSync(filePath);
    const format = FILE_FORMATS[fileName];
    info.push({
      archivo: fileName,
      existe: exists,
      columnas: exists ? format.columns : [],
      registros: exists ? loadFile(filePath, fileName).length : 0
    });
  }
  return info;
}

function getAll() {
  return loadAll();
}

function getByNumero(numero) {
  if (!numero) return [];
  const cleaned = numero.replace(/[^0-9]/g, '');
  if (!cleaned) return [];
  return loadAll().filter(row => {
    const dn = (row['Directory Number'] || '').replace(/[^0-9]/g, '');
    return dn.includes(cleaned);
  });
}

function invalidateCache() {
  cachedData = null;
}

module.exports = {
  getAll,
  getByNumero,
  getArchivosInfo,
  invalidateCache
};
