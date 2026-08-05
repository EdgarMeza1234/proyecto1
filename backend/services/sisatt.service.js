const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const LOG_DIR = 'C:\\DescargarOm';
const PARSE_DIR = 'C:\\parseado';
const PARSE2_DIR = 'C:\\Parseado';
const SISATT_DIR = 'E:\\SISATT\\SISATT\\Datos';

const MONTH_MAP = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04',
  MAYO: '05', JUNIO: '06', JULIO: '07', AGOSTO: '08',
  SEPTIEMBRE: '09', OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12'
};

const MONTH_ABB = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };

const MES_ABR = { ENERO: 'ENE', FEBRERO: 'FEB', MARZO: 'MAR', ABRIL: 'ABR', MAYO: 'MAY', JUNIO: 'JUN', JULIO: 'JUL', AGOSTO: 'AGO', SEPTIEMBRE: 'SEP', OCTUBRE: 'OCT', NOVIEMBRE: 'NOV', DICIEMBRE: 'DIC' };

function mesDir(mes, ano) {
  const m = mes.toUpperCase();
  const abbr = MES_ABR[m] || Object.entries(MES_ABR).find(([k]) => k.startsWith(m.slice(0, 3)))?.[1];
  if (!abbr) throw new Error(`Mes invalido: ${mes}`);
  return `${abbr}-${ano}`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Step 1: List log files for a month/year */
function listarLogs(mes, ano) {
  const dir = path.join(LOG_DIR, mesDir(mes, ano));
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => {
    const st = fs.statSync(path.join(dir, f));
    return st.isFile() && st.size > 0;
  });
}

/** Step 1a: First pass - clean ANSI codes, join continuation lines */
function parsearPrimeraPasa(archivoEntrada, archivoSalida) {
  const content = fs.readFileSync(archivoEntrada, 'utf8').replace(/\r/g, '');
  const lines = content.split(/\n/);
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    let linea = lines[i];
    const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
    const hasPar = linea.includes('\\par');
    const nextHasColon = nextLine.includes(' : ');

    if (hasPar && nextHasColon) {
      linea = linea + nextLine;
      i++;
      linea = linea.replace(/\\par\s*:\s*/g, '');
    }
    linea = linea.replace(/>\\'1b\[132D\\'1b\[K/g, '');
    linea = linea.replace(/\\par/g, '');
    linea = linea.replace(/>\u001b\[132D\u001b\[K/g, '');
    linea = linea.replace(/\u001b\[132D\u001b\[K/g, '');
    out.push(linea);
  }

  ensureDir(path.dirname(archivoSalida));
  fs.writeFileSync(archivoSalida, out.join('\n'), 'utf8');
}

/** Step 1b: Second pass - extract records (AMAB117, AMAB118, LINE138, LINE108, OMPR214) */
function parsearSegundaPasa(archivoEntrada, archivoSalida, ano, mesNum, dtsrpmPath) {
  const content = fs.readFileSync(archivoEntrada, 'utf8').replace(/\r/g, '');
  const lines = content.split(/\n/);
  const out = [];
  const dtsrpmOut = [];
  let i = 0;

  const RECORD_TYPES = ['AMAB117', 'AMAB118', 'LINE138', 'LINE108', 'OMPR214'];

  function monthAbbToNum(abb) {
    return MONTH_ABB[abb.toUpperCase()] || '??';
  }

  function joinContinuation(startIdx) {
    let joined = [lines[startIdx]];
    let j = startIdx + 1;
    while (j < lines.length) {
      const line = lines[j];
      if (!line || line.trim() === '') { j++; continue; }
      if (RECORD_TYPES.some(t => line.includes(t))) break;
      joined.push(line);
      j++;
    }
    return { data: joined, nextIdx: j };
  }

  while (i < lines.length) {
    let linea = lines[i];
    if (!linea || linea.trim() === '') { i++; continue; }

    const recordType = RECORD_TYPES.find(t => linea.includes(t));
    if (!recordType) { i++; continue; }

    const { data: recordLines, nextIdx } = joinContinuation(i);
    i = nextIdx;

    try {
      let output;

      if (recordType === 'LINE138') {
        const firstLine = recordLines[0];
        const afterPrefix = firstLine.replace(/^COTAP\s+LINE138\s+/, '');
        const firstParts = afterPrefix.trim().split(/\s+/);
        const dateStr = firstParts[0];
        const timeStr = firstParts[1];
        const seq = firstParts[2];
        const monthAbb = dateStr.slice(0, 3);
        const day = dateStr.slice(3);
        const dateFormatted = `${ano}/${monthAbbToNum(monthAbb)}/${day}`;

        let origin = '', ff1 = '', ff2 = '', ff3 = '', ff4 = '', dn = '';
        let treatment = '', calledNo = '', callid = '', callid2 = '';

        if (recordLines.length >= 2) {
          const secondLine = recordLines[1];
          const secondTrimmed = secondLine.trim();
          const originMatch = secondTrimmed.match(/^(\w+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+DN\s+(\S+)/);
          if (originMatch) {
            origin = originMatch[1];
            ff1 = originMatch[2]; ff2 = originMatch[3]; ff3 = originMatch[4]; ff4 = originMatch[5];
            dn = originMatch[6];
          }
        }

        if (recordLines.length >= 3) {
          const thirdLine = recordLines[2];
          const treatMatch = thirdLine.match(/TREATMENT SET\s*=\s*(\S+)/i);
          if (treatMatch) treatment = treatMatch[1];
          const calledMatch = thirdLine.match(/CALLED NO\s*=\s*(\S+)/i);
          if (calledMatch) calledNo = calledMatch[1];
        }

        if (recordLines.length >= 4) {
          const fourthLine = recordLines[3];
          const callidMatch = fourthLine.match(/CALLID=\s*(\S+)\s*(\S+)/i);
          if (callidMatch) { callid = callidMatch[1]; callid2 = callidMatch[2]; }
        }

        output = `COTAP|LINE138|${dateFormatted}|${timeStr}|${seq}|${origin}|${ff1}|${ff2}|${ff3}|${ff4}|${dn}|${treatment}|${calledNo}|${callid}|${callid2}|`;

      } else if (recordType === 'LINE108') {
        const firstLine = recordLines[0];
        const afterPrefix = firstLine.replace(/^COTAP\s+LINE108\s+/, '');
        const firstParts = afterPrefix.trim().split(/\s+/);
        const dateStr = firstParts[0];
        const timeStr = firstParts[1];
        const seq = firstParts[2];
        const monthAbb = dateStr.slice(0, 3);
        const day = dateStr.slice(3);
        const dateFormatted = `${ano}/${monthAbbToNum(monthAbb)}/${day}`;

        let origin = '', ff1 = '', ff2 = '', ff3 = '', ff4 = '', dn = '';
        let troubleCode = '', info = '', digitone = '', calledNumber = '', callid = '';

        if (recordLines.length >= 2) {
          const secondLine = recordLines[1];
          const secondTrimmed = secondLine.trim();
          const originMatch = secondTrimmed.match(/^(\w+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+DN\s+(\S+)/);
          if (originMatch) {
            origin = originMatch[1];
            ff1 = originMatch[2]; ff2 = originMatch[3]; ff3 = originMatch[4]; ff4 = originMatch[5];
            dn = originMatch[6];
          }
        }

        for (const rl of recordLines) {
          const trimmed = rl.trim();
          const tc = trimmed.match(/TROUBLE CODE\s*=\s*(\S+)/i);
          if (tc) troubleCode = tc[1];
          const inf = trimmed.match(/INFO\s*=\s*(\S+)/i);
          if (inf) info = inf[1];
          const dr = trimmed.match(/DIGITONE RECEIVER\s*=\s*(\S+)/i);
          if (dr) digitone = dr[1];
          const cn = trimmed.match(/CALLED NUMBER\s*=\s*(\S+)/i);
          if (cn) calledNumber = cn[1];
          const cid = trimmed.match(/CALLID\s*=\s*(\S+)/i);
          if (cid) callid = cid[1];
        }

        output = `COTAP|LINE108|${dateFormatted}|${timeStr}|${seq}|${origin}|${ff1}|${ff2}|${ff3}|${ff4}|${dn}|${troubleCode}|${info}|${digitone}|${calledNumber}|${callid}|`;

      } else if (recordType === 'AMAB117' || recordType === 'AMAB118') {
        // First line: COTAP     AMAB117 JAN05 08:00:32 6634 INFO AMA RECORD DATA
        const firstLine = recordLines[0];
        const afterPrefix = firstLine.replace(/^COTAP\s+AMAB1(17|18)\s+/, '');
        const firstParts = afterPrefix.trim().split(/\s+/);
        const dateStr = firstParts[0];
        const timeStr = firstParts[1];
        const seq = firstParts[2];

        const monthAbb = dateStr.slice(0, 3);
        const day = dateStr.slice(3);
        const dateFormatted = `${ano}/${monthAbbToNum(monthAbb)}/${day}`;

        // Parse labeled fields
        function extractField(text, label) {
          const re = new RegExp(label + '\\s*=\\s*(\\S+)', 'i');
          const m = text.match(re);
          return m ? m[1] : '';
        }

        function extractFieldWithRest(text, label) {
          const re = new RegExp(label + '\\s*=\\s*(.+?)\\s{3,}', 'i');
          const m = text.match(re);
          if (m) return m[1].trim();
          const re2 = new RegExp(label + '\\s*=\\s*(.+)', 'i');
          const m2 = text.match(re2);
          return m2 ? m2[1].trim() : '';
        }

        // Join all record lines into one string
        const fullText = recordLines.join('\n');

        const structCode = extractField(fullText, 'STRUCTURE CODE');
        const callCode = extractField(fullText, 'CALL CODE');
        const connectDate = extractField(fullText, 'CONNECT DATE');
        const connectTime = extractField(fullText, 'CONNECT TIME');
        const elapsed = extractField(fullText, 'ELAPSED TIME');
        const answered = extractField(fullText, 'ANSWERED');

        // For CALLING DN, ORIG AGENT etc with DN fields
        let callingDn = '';
        let origAgent = '';
        let origDn = '';
        let calledDn = '';
        let termAgent = '';
        let termDn = '';
        let trkFacility = '';

        // Find and extract each by searching in lines
        for (const rl of recordLines) {
          const trimmed = rl.trim();
          if (trimmed.startsWith('CALLING DN')) {
            const m = trimmed.match(/CALLING DN\s*=\s*(\S+)/i);
            if (m) callingDn = m[1];
          }
          if (trimmed.startsWith('ORIG AGENT')) {
            const m = trimmed.match(/ORIG AGENT\s*=\s*(.+?)\s{2,}DN\s+(\S+)/i);
            if (m) { origAgent = m[1].trim(); origDn = m[2]; }
            else {
              const m2 = trimmed.match(/ORIG AGENT\s*=\s*(.+)/i);
              if (m2) origAgent = m2[1].trim();
            }
          }
          if (trimmed.startsWith('CALLED DN')) {
            const m = trimmed.match(/CALLED DN\s*=\s*(\S+)/i);
            if (m) calledDn = m[1];
          }
          if (trimmed.startsWith('TERM AGENT')) {
            const m = trimmed.match(/TERM AGENT\s*=\s*(.+?)\s{2,}DN\s+(\S+)/i);
            if (m) { termAgent = m[1].trim(); termDn = m[2]; }
            else {
              const m2 = trimmed.match(/TERM AGENT\s*=\s*(.+)/i);
              if (m2) termAgent = m2[1].trim();
            }
          }
          if (trimmed.startsWith('TRK FACILITY')) {
            const m = trimmed.match(/TRK FACILITY\s*=\s*(\S+)/i);
            if (m) trkFacility = m[1];
          }
        }

        const extraFields = (recordType === 'AMAB117') ? '|0|0' : '|0|0|0|0|0|0|0';

        // Build output matching reference format
        if (recordType === 'AMAB117') {
          output = `COTAP|AMAB117|${dateFormatted}|${timeStr}|${seq}|${structCode}|${callCode}|${connectDate}|${connectTime}|${elapsed}|${answered}|${callingDn}|${origAgent}|${origDn}|${calledDn}|${termAgent}|${termDn}|0|0`;
        } else {
          output = `COTAP|AMAB118|${dateFormatted}|${timeStr}|${seq}|${structCode}|${callCode}|${connectDate}|${connectTime}|${elapsed}|${answered}|${callingDn}|${origAgent}|${origDn}|${calledDn}|${termAgent}|${termDn}|${trkFacility}|0|0`;
        }
      } else if (recordType === 'OMPR214') {
        const isSimetas = recordLines.some(l => l.includes('CLASS:') && l.includes('SIMETAS'));
        if (isSimetas) {
          const startStopLine = recordLines.find(l => l.includes('START:'));
          if (startStopLine) {
            let aux = startStopLine
              .replace(/START:/g, '').replace(/STOP:/g, '')
              .replace(/MON;/g, '').replace(/TUE;/g, '').replace(/WED;/g, '')
              .replace(/THU;/g, '').replace(/FRI;/g, '').replace(/SAT;/g, '').replace(/SUN;/g, '')
              .replace(/ /g, '|');
            const dtsrpmStartIdx = recordLines.findIndex(l => l.includes('DTSRPM') && !l.includes('DTSR_'));
            if (dtsrpmStartIdx >= 0) {
              const sotsIdx = recordLines.findIndex((l, idx) => idx > dtsrpmStartIdx && l.includes('SOTS'));
              const endIdx = sotsIdx > 0 ? sotsIdx : recordLines.length;
              const dtsrpmLines = recordLines.slice(dtsrpmStartIdx + 1, endIdx);
              let lineIdx = 0;
              while (lineIdx < dtsrpmLines.length) {
                const cl = dtsrpmLines[lineIdx];
                if (!cl || !cl.trim()) { lineIdx++; continue; }
                const hasHost = cl.includes('HOST');
                const hasSat = cl.includes('SAT') && !cl.includes('SOTS');
                const hasSaro = cl.includes('SARO ');
                const hasMira = cl.includes('MIRA');
                if (hasHost || hasSat || hasSaro || hasMira) {
                  const vl = lineIdx + 1 < dtsrpmLines.length ? dtsrpmLines[lineIdx + 1] : '';
                  if (vl && vl.trim()) {
                    let AUX2 = (cl + vl).trim().replace(/ /g, '|');
                    let AUX1 = (aux + AUX2).replace(/\|{2,}/g, '|');
                    const suf = '|' + AUX1[4] + AUX1.slice(6, 8) + AUX1.slice(9, 11) + '|' + AUX1.slice(12, 14);
                    dtsrpmOut.push(AUX1 + suf);
                    lineIdx += 2; continue;
                  }
                }
                lineIdx++;
              }
            }
          }
        }
      }

      if (output) out.push(output);

    } catch (e) {
      console.error('[parsearSegundaPasa] Error parsing record:', e.message);
    }
  }

  ensureDir(path.dirname(archivoSalida));
  fs.writeFileSync(archivoSalida, out.join('\n'), 'utf8');

  if (dtsrpmPath && dtsrpmOut.length > 0) {
    const dtsrpmHeader = '|2010/01/01|0|2010/01/01|0|0|0|0|0|0|0|0|0|0|0|0|0';
    const dtsrpmContent = [dtsrpmHeader, ...dtsrpmOut].join('\n');
    ensureDir(path.dirname(dtsrpmPath));
    fs.writeFileSync(dtsrpmPath, dtsrpmContent, 'utf8');
  }
}

/** Step 1: Parse a single log file */
function parsearArchivo(nombreArchivo, mes, ano) {
  const dir = path.join(LOG_DIR, mesDir(mes, ano));
  const srcPath = path.join(dir, nombreArchivo);
  if (!fs.existsSync(srcPath)) throw new Error(`Archivo no encontrado: ${srcPath}`);

  const mesNum = MONTH_MAP[mes.toUpperCase()];
  const baseName = path.basename(nombreArchivo, path.extname(nombreArchivo));

  const emcPath = path.join(PARSE_DIR, `${baseName}.EMC`);
  const emc2Path = path.join(PARSE2_DIR, `${baseName}.EMC2`);
  const dtsrpmPath = path.join(PROC_DIR, `${baseName}DTSRPM.EMC`);

  parsearPrimeraPasa(srcPath, emcPath);
  parsearSegundaPasa(emcPath, emc2Path, ano, mesNum, dtsrpmPath);

  const stats = fs.statSync(emc2Path);
  return {
    archivo: nombreArchivo,
    emc: emcPath,
    emc2: emc2Path,
    tamano: stats.size,
    lineas: fs.readFileSync(emc2Path, 'utf8').split(/\r?\n/).filter(Boolean).length
  };
}

/** Step 1: Parse all files for a month */
function parsearTodo(mes, ano, onProgress) {
  const archivos = listarLogs(mes, ano);
  const results = [];
  for (let i = 0; i < archivos.length; i++) {
    const archivo = archivos[i];
    let result;
    try {
      const r = parsearArchivo(archivo, mes, ano);
      result = { ...r, estado: 'ok' };
    } catch (err) {
      result = { archivo, estado: 'error', error: err.message };
    }
    results.push(result);
    if (onProgress) onProgress(i + 1, archivos.length, result);
  }
  return results;
}

const PROC_DIR = 'C:\\procesado';

function makeHeader(numFields) {
  const fields = new Array(numFields).fill('0');
  fields[0] = '0';
  fields[2] = '2010/01/01';
  return fields.join('|');
}

function splitAgentField(agent) {
  if (!agent || agent.trim() === '') return [];
  return agent.trim().split(/\s+/);
}

function transformAMAB117Record(record) {
  const parts = record.split('|');
  if (parts.length < 18) return null;
  const out = parts.slice(0, 12);
  const origAgent = parts[12] || '';
  const origDn = parts[13] || '';
  const calledDn = parts[14] || '';
  const termAgent = parts[15] || '';
  const termDn = parts[16] || '';
  const origParts = splitAgentField(origAgent);
  out.push(...origParts);
  while (out.length < 20) out.push('');
  out.push(origDn);
  out.push(calledDn);
  const termParts = splitAgentField(termAgent);
  out.push(...termParts);
  if (termDn) out.push(termDn);
  return out.join('|');
}

function transformAMAB118Record(record) {
  const parts = record.split('|');
  if (parts.length < 18) return null;
  const out = parts.slice(0, 12);
  const origAgent = parts[12] || '';
  const origDn = parts[13] || '';
  const calledDn = parts[14] || '';
  const termAgent = parts[15] || '';
  const termDn = parts[16] || '';
  const trkFac = parts[17] || '';
  const origParts = splitAgentField(origAgent);
  out.push(...origParts);
  while (out.length < 16) out.push('');
  out.push(calledDn);
  const termParts = splitAgentField(termAgent);
  out.push(...termParts);
  if (termDn) out.push(termDn);
  if (trkFac) out.push(trkFac);
  return out.join('|');
}

const HEADER_LEN = { L138: 16, L108: 17, AMAB117: 34, AMAB118: 30, DTSRPM: 17, TRK: 34 };

/** Step 2: Process EMC2 files into separate type-based output files */
function procesarArchivo(nombreArchivo) {
  const baseName = path.basename(nombreArchivo, path.extname(nombreArchivo));
  const emc2Path = path.join(PARSE2_DIR, `${baseName}.EMC2`);
  if (!fs.existsSync(emc2Path)) throw new Error(`EMC2 no encontrado: ${emc2Path}`);

  const content = fs.readFileSync(emc2Path, 'utf8').replace(/\r/g, '');
  const lines = content.split('\n').filter(Boolean);

  const groups = { L138: [], L108: [], AMAB117: [], AMAB118: [] };

  for (const line of lines) {
    if (line.startsWith('COTAP|LINE138|')) groups.L138.push(line);
    else if (line.startsWith('COTAP|LINE108|')) groups.L108.push(line);
    else if (line.startsWith('COTAP|AMAB117|')) groups.AMAB117.push(line);
    else if (line.startsWith('COTAP|AMAB118|')) groups.AMAB118.push(line);
  }

  const typeToFile = {
    L138: { file: 'L138', transform: (r) => r },
    L108: { file: 'L108', transform: (r) => r },
    AMAB117: { file: 'AMAB117', transform: transformAMAB117Record },
    AMAB118: { file: 'AMAB118', transform: transformAMAB118Record }
  };

  const results = [];
  for (const [type, cfg] of Object.entries(typeToFile)) {
    const records = groups[type];
    if (!records.length) continue;
    const outPath = path.join(PROC_DIR, `${baseName}${cfg.file}.EMC`);
    const header = makeHeader(HEADER_LEN[type]);
    const transformed = records.map(cfg.transform).filter(Boolean);
    const finalContent = [header, ...transformed].join('\n');
    ensureDir(path.dirname(outPath));
    fs.writeFileSync(outPath, finalContent, 'utf8');
    results.push({ archivo: path.basename(outPath), lineas: transformed.length, tamano: fs.statSync(outPath).size });
  }

  return results;
}

function procesarTodo(nombreArchivoList) {
  const allResults = [];
  for (const archivo of nombreArchivoList) {
    try {
      const r = procesarArchivo(archivo);
      allResults.push({ archivo, archivos: r, estado: 'ok' });
    } catch (e) {
      allResults.push({ archivo, estado: 'error', error: e.message });
    }
  }
  return allResults;
}

/** Step 3: Generate LLC SQL from template */
function generarSqlLLC(mes, ano) {
  const sqlPath = path.join(SISATT_DIR, 'sql.sql');
  if (!fs.existsSync(sqlPath)) throw new Error(`Template no encontrado: ${sqlPath}`);

  const mesNum = MONTH_MAP[mes.toUpperCase()];
  let sql = fs.readFileSync(sqlPath, 'utf8');
  sql = sql.replace(/#ano#/g, ano);
  sql = sql.replace(/'#\$%&\/\(\)='/g, `'${ano}-${mesNum}%'`);

  const outPath = path.join(SISATT_DIR, `sqlLLC${ano}${mesNum}.sql`);
  fs.writeFileSync(outPath, sql, 'utf8');

  return { sql, archivo: outPath };
}

/** Step 4: Generate ROTID SQL from template */
function generarSqlROTID(mes, ano) {
  const sqlPath = path.join(SISATT_DIR, 'ROTID.sql');
  if (!fs.existsSync(sqlPath)) throw new Error(`Template ROTID no encontrado: ${sqlPath}`);

  const mesNum = MONTH_MAP[mes.toUpperCase()];
  let sql = fs.readFileSync(sqlPath, 'utf8');
  sql = sql.replace(/#ano#/g, ano);
  sql = sql.replace(/'#\$%&\/\(\)='/g, `'${ano}-${mesNum}%'`);

  const outPath = path.join(SISATT_DIR, `ROTID${ano}${mesNum}.sql`);
  fs.writeFileSync(outPath, sql, 'utf8');

  return { sql, archivo: outPath };
}

const MONTH_NUM = { ENERO:'01', FEBRERO:'02', MARZO:'03', ABRIL:'04', MAYO:'05', JUNIO:'06', JULIO:'07', AGOSTO:'08', SEPTIEMBRE:'09', OCTUBRE:'10', NOVIEMBRE:'11', DICIEMBRE:'12' };

function extractDTSRPMDeArchivo(rutaEMC) {
  const dtsrpmOut = [];
  if (!fs.existsSync(rutaEMC)) return dtsrpmOut;
  const content = fs.readFileSync(rutaEMC, 'utf8').replace(/\r/g, '');
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length) {
    const linea = lines[i]; i++;
    if (!linea || linea.trim() === '') continue;
    if (!linea.includes('SIMETAS')) continue;
    const startStopLine = i < lines.length ? lines[i] : ''; i++;
    if (!startStopLine) continue;
    let aux = startStopLine
      .replace(/START:/g, '').replace(/STOP:/g, '')
      .replace(/MON;/g, '').replace(/TUE;/g, '').replace(/WED;/g, '')
      .replace(/THU;/g, '').replace(/FRI;/g, '').replace(/SAT;/g, '').replace(/SUN;/g, '')
      .replace(/ /g, '|');
    const dtsrpmLines = [];
    let inDtsrpm = false;
    while (i < lines.length) {
      const l = lines[i]; i++;
      if (!l) continue;
      if (l.includes('DTSRPM') && !l.includes('DTSR_')) { inDtsrpm = true; continue; }
      if (inDtsrpm && l.includes('SOTS')) break;
      if (inDtsrpm) dtsrpmLines.push(l);
    }
    let lineIdx = 0;
    while (lineIdx < dtsrpmLines.length) {
      const cl = dtsrpmLines[lineIdx];
      if (!cl || !cl.trim()) { lineIdx++; continue; }
      const hasRoute = cl.includes('HOST') || (cl.includes('SAT') && !cl.includes('SOTS')) || cl.includes('SARO ') || cl.includes('MIRA');
      if (hasRoute) {
        const vl = lineIdx + 1 < dtsrpmLines.length ? dtsrpmLines[lineIdx + 1] : '';
        if (vl && vl.trim()) {
          let AUX2 = (cl + vl).trim().replace(/ /g, '|');
          let AUX1 = (aux + AUX2).replace(/\|{2,}/g, '|');
          const suf = '|' + AUX1[4] + AUX1.slice(6, 8) + AUX1.slice(9, 11) + '|' + AUX1.slice(12, 14);
          dtsrpmOut.push(AUX1 + suf);
          lineIdx += 2; continue;
        }
      }
      lineIdx++;
    }
  }
  return dtsrpmOut;
}

function generarDTSRPM() {
  if (!fs.existsSync(PARSE_DIR)) throw new Error(`Directorio no encontrado: ${PARSE_DIR}`);
  const files = fs.readdirSync(PARSE_DIR).filter(f => f.toUpperCase().endsWith('.EMC'));
  const results = [];
  for (const file of files) {
    const ruta = path.join(PARSE_DIR, file);
    const baseName = path.basename(file, '.EMC');
    const data = extractDTSRPMDeArchivo(ruta);
    if (data.length > 0) {
      const dtsrpmPath = path.join(PROC_DIR, `${baseName}DTSRPM.EMC`);
      const header = '|2010/01/01|0|2010/01/01|0|0|0|0|0|0|0|0|0|0|0|0|0';
      ensureDir(PROC_DIR);
      fs.writeFileSync(dtsrpmPath, [header, ...data].join('\n'), 'utf8');
      results.push({ archivo: file, dtsrpm: `${baseName}DTSRPM.EMC`, lineas: data.length });
    }
  }
  return { total: results.length, resultados: results };
}

module.exports = { listarLogs, parsearArchivo, parsearTodo, procesarArchivo, procesarTodo, generarSqlLLC, generarSqlROTID, generarDTSRPM, mesDir, MONTH_MAP, MONTH_ABB };
