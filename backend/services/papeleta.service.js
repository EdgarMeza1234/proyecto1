const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { getPool } = require('../db/pool');

function uploadDir() {
  return process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads', 'papeletas');
}

function ensureUploadDir() {
  const dir = uploadDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function ensurePapeletasTable() {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const pool = await getPool();
      await pool.request().query(`
        IF OBJECT_ID('trabajos_papeletas') IS NULL
        CREATE TABLE trabajos_papeletas (
          id INT IDENTITY(1,1) PRIMARY KEY,
          nombre_original NVARCHAR(260) NULL,
          ruta NVARCHAR(500) NOT NULL,
          mime NVARCHAR(100) NULL,
          tamano INT NULL,
          campos NVARCHAR(MAX) NULL,
          creado_en DATETIME NOT NULL DEFAULT GETDATE(),
          creado_por NVARCHAR(100) NULL
        );
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('trabajos') AND name = 'papeleta_id')
          ALTER TABLE trabajos ADD papeleta_id INT NULL;
      `);
      ensureUploadDir();
      console.log('[papeletas] Tabla trabajos_papeletas y columna papeleta_id listas.');
      return;
    } catch (err) {
      console.error('[papeletas] Intento ' + (attempt + 1) + ' fallo:', err.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  console.error('[papeletas] No se pudo inicializar la tabla de papeletas.');
}

const MESES = {
  enero: '01', febrero: '02', marzo: '03', abril: '04',
  mayo: '05', junio: '06', julio: '07', agosto: '08',
  septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'
};

const TIPOS_TRABAJO = [
  { slug: 'retiro_servicios_agregados', palabras: ['retiro de servicios agregados', 'retiro servicios agregados'] },
  { slug: 'servicios_agregados', palabras: ['servicios agregados'] },
  { slug: 'retiro_linea_socio', palabras: ['retiro de linea socio', 'retiro linea socio'] },
  { slug: 'retiro_gem_trill_alq', palabras: ['retiro gem', 'gemelas', 'trill', 'alquiler', 'alquileres'] },
  { slug: 'habilitacion_larga_distancia', palabras: ['habilitacion larga distancia', 'larga distancia'] },
  { slug: 'en_custodia', palabras: ['custodia'] },
  { slug: 'regularizacion', palabras: ['regularizacion'] },
  { slug: 'restringido', palabras: ['restringido'] }
];

function normalizar(texto) {
  return String(texto || '').replace(/\s+/g, ' ').trim();
}

function quitarAcentos(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function mapearTipoTrabajo(tipoServicio) {
  if (!tipoServicio) return null;
  const limpio = quitarAcentos(tipoServicio);
  for (const tipo of TIPOS_TRABAJO) {
    if (tipo.palabras.some(p => limpio.includes(p))) return tipo.slug;
  }
  return null;
}

async function procesarPDF(buffer) {
  const data = await pdfParse(buffer);
  const texto = normalizar(data.text);
  const advertencias = [];

  const formulario = texto.match(/SOLICITUD DE TRABAJO T.?CNICO\s+(\d+)/i)?.[1] || null;
  const numero_telefono = texto.match(/No\. Telef\. o C.digo:\s*(\d+)/i)?.[1] || null;
  const nombre_abonado = texto.match(/Nombre del Socio o\s+Usuario:\s*([^\n]+?)\s*C\.I\./)?.[1]?.trim() || null;
  const ci = texto.match(/C\.I\.:\s*(\d+)/)?.[1] || null;
  const celular = texto.match(/Celular:\s*(\d+)/)?.[1] || null;
  const direccion = texto.match(/Direcci.n actual:\s*([^\n]+?)\s*Municipio:/i)?.[1]?.trim() || null;

  let estado_cuenta = texto.match(/Estado de Cuenta:\s*([\s\S]+?20[1-2][0-9])/i)?.[1]?.trim() || null;
  if (estado_cuenta) estado_cuenta = normalizar(estado_cuenta);

  let tipoServicio = null;
  const tablaMatch = texto.match(/\|\s*LINEA\s*\|([^|]+?)\|\s*Nueva Direcci/i);
  if (tablaMatch) tipoServicio = tablaMatch[1].trim();
  if (!tipoServicio) {
    const pegadoMatch = texto.match(/LINEA\s*([A-Za-z\u00f1\u00e1\u00e9\u00ed\u00f3\u00fa\u00d1\u00c1\u00c9\u00cd\u00d3\u00da]+(?:\s+[A-Za-z\u00f1\u00e1\u00e9\u00ed\u00f3\u00fa\u00d1\u00c1\u00c9\u00cd\u00d3\u00da]+)*)\s*Nueva Direcci/i);
    if (pegadoMatch) tipoServicio = pegadoMatch[1].trim();
  }
  if (!tipoServicio) {
    const separadoMatch = texto.match(/LINEA\s+([A-Za-z\u00f1\u00e1\u00e9\u00ed\u00f3\u00fa\u00d1\u00c1\u00c9\u00cd\u00d3\u00da]+(?:\s+[A-Za-z\u00f1\u00e1\u00e9\u00ed\u00f3\u00fa\u00d1\u00c1\u00c9\u00cd\u00d3\u00da]+)*)/);
    if (separadoMatch) tipoServicio = separadoMatch[1].trim();
  }
  if (tipoServicio) tipoServicio = normalizar(tipoServicio);
  const tipo_trabajo = mapearTipoTrabajo(tipoServicio);

  let fecha = null;
  let hora = null;
  let fecha_solicitud = null;
  const fechaMatch = texto.match(
    /Fecha y hora de solicitud\.?\s*Potos[i\u00ed]\s*,\s*[a-zA-Z\u00e1\u00e9\u00ed\u00f3\u00fa]+\s*,\s*(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})\s+(\d{1,2}:\d{2}:\d{2})/i
  );
  if (fechaMatch) {
    const dia = fechaMatch[1].padStart(2, '0');
    const mes = MESES[fechaMatch[2].toLowerCase()];
    const anio = fechaMatch[3];
    const horaRaw = fechaMatch[4].padStart(5, '0');
    if (mes) {
      fecha = `${anio}-${mes}-${dia}`;
      hora = horaRaw.substring(0, 5);
      fecha_solicitud = `${fecha} ${horaRaw}`;
    } else {
      advertencias.push(`Mes no reconocido en la fecha: ${fechaMatch[2]}`);
    }
  }

  let observaciones = null;
  const obsMatch = texto.match(/OBS:\s*([\s\S]+)$/i);
  if (obsMatch) {
    observaciones = normalizar(obsMatch[1]).split(/\s+(?=Firma del Socio|Atenci.n al Abonado|Estado de Cuenta:)/i)[0].trim();
    if (!observaciones) observaciones = null;
  }

  if (!formulario) advertencias.push('No se encontró el número de formulario en el PDF');
  if (!numero_telefono) advertencias.push('No se encontró el número telefónico');
  if (tipoServicio && !tipo_trabajo) advertencias.push(`Tipo de trabajo no reconocido: "${tipoServicio}" — selecciónnelo manualmente`);

  const campos = {
    formulario,
    numero_telefono,
    nombre_abonado,
    direccion,
    tipo_trabajo,
    tipo_servicio: tipoServicio,
    fecha,
    hora,
    observaciones,
    ci,
    celular,
    estado_cuenta,
    fecha_solicitud
  };

  return { campos, advertencias };
}

module.exports = { uploadDir, ensureUploadDir, ensurePapeletasTable, procesarPDF };
