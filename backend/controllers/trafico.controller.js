const path = require('path');
const traficoService = require('../services/trafico.service');

async function listFiles(req, res) {
  try {
    const { mes, ano } = req.query;
    if (!mes || !ano) return res.status(400).json({ message: 'Se requieren mes y ano' });
    const files = await traficoService.listFiles(mes, ano);
    res.json({ archivos: files, cantidad: files.length });
  } catch (error) {
    console.error('Error listFiles:', error);
    res.status(500).json({ message: 'Error al listar archivos: ' + error.message });
  }
}

async function subirArchivos(req, res) {
  try {
    const { mes, ano } = req.body;
    if (!mes || !ano) return res.status(400).json({ message: 'Se requieren mes y ano' });
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ message: 'Debe adjuntar al menos un archivo .ama' });
    const result = await traficoService.guardarArchivosSubidos(mes, ano, files);
    res.json(result);
  } catch (error) {
    console.error('Error subirArchivos:', error);
    res.status(500).json({ message: 'Error al subir archivos: ' + error.message });
  }
}

async function listarGenerados(req, res) {
  try {
    const { mes, ano } = req.query;
    if (!mes || !ano) return res.status(400).json({ message: 'Se requieren mes y ano' });
    const result = await traficoService.listarArchivosGenerados(mes, ano);
    res.json(result);
  } catch (error) {
    console.error('Error listarGenerados:', error);
    res.status(500).json({ message: 'Error al listar archivos generados: ' + error.message });
  }
}

async function descargar(req, res) {
  try {
    const { mes, ano, archivo } = req.query;
    if (!mes || !ano || !archivo) return res.status(400).json({ message: 'Se requieren mes, ano y archivo' });
    const fullPath = traficoService.rutaArchivoGenerado(mes, ano, archivo);
    const nombre = path.basename(archivo);
    res.download(fullPath, nombre, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ message: 'Archivo no encontrado: ' + nombre });
      }
    });
  } catch (error) {
    console.error('Error descargar:', error);
    res.status(500).json({ message: 'Error al descargar archivo: ' + error.message });
  }
}

async function convertirArchivo(req, res) {
  try {
    const { ruta, mes, ano, tipo } = req.body;
    if (!ruta || !mes || !ano) return res.status(400).json({ message: 'Se requieren ruta, mes y ano' });
    const result = await traficoService.convertirArchivo(ruta, mes, ano, tipo || 'TXT');
    res.json(result);
  } catch (error) {
    console.error('Error convertirArchivo:', error);
    res.status(500).json({ message: 'Error al convertir archivo: ' + error.message });
  }
}

async function procesarMes(req, res) {
  try {
    const { mes, ano, tipo } = req.body;
    if (!mes || !ano) return res.status(400).json({ message: 'Se requieren mes y ano' });
    const result = await traficoService.procesarArchivosPorDia(mes, ano, tipo || 'TXT');
    res.json(result);
  } catch (error) {
    console.error('Error procesarMes:', error);
    res.status(500).json({ message: 'Error al procesar mes: ' + error.message });
  }
}

async function splitMes(req, res) {
  try {
    const { mes, ano, tipo } = req.body;
    if (!mes || !ano) return res.status(400).json({ message: 'Se requieren mes y ano' });
    const result = await traficoService.splitPorDia(mes, ano, tipo || 'TXT');
    res.json(result);
  } catch (error) {
    console.error('Error splitMes:', error);
    res.status(500).json({ message: 'Error al splitear mes: ' + error.message });
  }
}

async function crearTabla(req, res) {
  try {
    const { mes, ano } = req.body;
    if (!mes || !ano) return res.status(400).json({ message: 'Se requieren mes y ano' });
    const result = await traficoService.asegurarTabla(mes, ano);
    res.json(result);
  } catch (error) {
    console.error('Error crearTabla:', error);
    res.status(500).json({ message: 'Error al crear tabla: ' + error.message });
  }
}

async function limpiarTabla(req, res) {
  try {
    const { mes, ano } = req.body;
    if (!mes || !ano) return res.status(400).json({ message: 'Se requieren mes y ano' });
    const result = await traficoService.limpiarTabla(mes, ano);
    res.json(result);
  } catch (error) {
    console.error('Error limpiarTabla:', error);
    res.status(500).json({ message: 'Error al limpiar tabla: ' + error.message });
  }
}

async function insertarBD(req, res) {
  try {
    const { mes, ano } = req.body;
    if (!mes || !ano) return res.status(400).json({ message: 'Se requieren mes y ano' });
    const result = await traficoService.procesarEInsertar(mes, ano);
    res.json(result);
  } catch (error) {
    console.error('Error insertarBD:', error);
    res.status(500).json({ message: 'Error al insertar en BD: ' + error.message });
  }
}

async function leerErrores(req, res) {
  try {
    const { mes, ano } = req.query;
    if (!mes || !ano) return res.status(400).json({ message: 'Se requieren mes y ano' });
    const result = await traficoService.leerErrores(mes, ano);
    res.json(result);
  } catch (error) {
    console.error('Error leerErrores:', error);
    res.status(500).json({ message: 'Error al leer errores: ' + error.message });
  }
}

module.exports = {
  listFiles,
  subirArchivos,
  listarGenerados,
  descargar,
  convertirArchivo,
  procesarMes,
  splitMes,
  crearTabla,
  limpiarTabla,
  insertarBD,
  leerErrores
};
