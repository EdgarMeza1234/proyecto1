const path = require('path');
const nortelService = require('../services/nortel.service');

async function listFiles(req, res) {
  try {
    const { mes, ano } = req.query;
    if (!mes || !ano) return res.status(400).json({ message: 'Se requieren mes y ano' });
    const files = await nortelService.listAllFiles(mes, ano);
    res.json({ archivos: files, cantidad: files.length });
  } catch (error) {
    console.error('Error listFiles:', error);
    res.status(500).json({ message: 'Error al listar archivos: ' + error.message });
  }
}

async function listarGenerados(req, res) {
  try {
    const { mes, ano } = req.query;
    if (!mes || !ano) return res.status(400).json({ message: 'Se requieren mes y ano' });
    const result = await nortelService.listarArchivosGenerados(mes, ano);
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
    const fullPath = nortelService.rutaArchivoGenerado(mes, ano, archivo);
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

async function subirArchivos(req, res) {
  try {
    const { mes, ano } = req.body;
    if (!mes || !ano) return res.status(400).json({ message: 'Se requieren mes y ano' });
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ message: 'Debe adjuntar al menos un archivo crudo de Nortel' });
    const result = await nortelService.guardarArchivosSubidos(mes, ano, files);
    res.json(result);
  } catch (error) {
    console.error('Error subirArchivos:', error);
    res.status(500).json({ message: 'Error al subir archivos: ' + error.message });
  }
}

async function consolidar(req, res) {
  try {
    const { mes, ano, archivo } = req.body;
    if (!mes || !ano) return res.status(400).json({ message: 'Se requieren mes y ano' });
    if (archivo) {
      const result = await nortelService.consolidar(mes, ano, archivo);
      res.json(result);
    } else {
      const result = await nortelService.consolidarTodo(mes, ano);
      res.json(result);
    }
  } catch (error) {
    console.error('Error consolidar:', error);
    res.status(500).json({ message: 'Error al consolidar archivos: ' + error.message });
  }
}

async function split(req, res) {
  try {
    const { mes, ano, archivo } = req.body;
    if (!mes || !ano) return res.status(400).json({ message: 'Se requieren mes y ano' });
    if (archivo) {
      const result = await nortelService.splitArchivo(mes, ano, archivo);
      res.json(result);
    } else {
      const result = await nortelService.splitAll(mes, ano);
      res.json(result);
    }
  } catch (error) {
    console.error('Error split:', error);
    res.status(500).json({ message: 'Error al dividir archivos: ' + error.message });
  }
}

async function crearTabla(req, res) {
  try {
    const { mes, ano } = req.body;
    if (!mes || !ano) return res.status(400).json({ message: 'Se requieren mes y ano' });
    const result = await nortelService.asegurarTabla(mes, ano);
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
    const result = await nortelService.limpiarTabla(mes, ano);
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
    const result = await nortelService.procesarEInsertar(mes, ano);
    res.json(result);
  } catch (error) {
    console.error('Error insertarBD:', error);
    res.status(500).json({ message: 'Error al insertar en BD: ' + error.message });
  }
}

module.exports = {
  listFiles,
  listarGenerados,
  descargar,
  subirArchivos,
  consolidar,
  split,
  crearTabla,
  limpiarTabla,
  insertarBD
};
