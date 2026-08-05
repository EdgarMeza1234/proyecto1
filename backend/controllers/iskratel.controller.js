const iskratelService = require('../services/iskratel.service');

function getAll(req, res) {
  try {
    const data = iskratelService.getAll();
    res.json(data);
  } catch (error) {
    console.error('Error en iskratel getAll:', error);
    res.status(500).json({ message: 'Error al leer archivos Iskratel', detail: error.message });
  }
}

function getByNumero(req, res) {
  try {
    const { numero } = req.params;
    const results = iskratelService.getByNumero(numero);

    if (results.length === 0) {
      res.json({ message: 'No se encontraron resultados', results: [] });
      return;
    }

    res.json({ results });
  } catch (error) {
    console.error('Error en iskratel getByNumero:', error);
    res.status(500).json({ message: 'Error al buscar numero en archivos Iskratel', detail: error.message });
  }
}

function getArchivos(req, res) {
  try {
    const info = iskratelService.getArchivosInfo();
    res.json(info);
  } catch (error) {
    console.error('Error en iskratel getArchivos:', error);
    res.status(500).json({ message: 'Error al obtener info de archivos Iskratel', detail: error.message });
  }
}

module.exports = {
  getAll,
  getByNumero,
  getArchivos
};
