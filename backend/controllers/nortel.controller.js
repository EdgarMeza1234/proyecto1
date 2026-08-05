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
  consolidar,
  split,
  crearTabla,
  limpiarTabla,
  insertarBD
};
