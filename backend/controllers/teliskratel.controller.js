const teliskratelService = require('../services/teliskratel.service');

async function list(req, res, next) {
  try {
    const { q, estado, central, origen, lote, page, limit } = req.query;
    const data = await teliskratelService.listar({ q, estado, central, origen, lote, page, limit });
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function importaciones(req, res, next) {
  try {
    const data = await teliskratelService.listarImportaciones();
    res.json(data);
  } catch (error) {
    next(error);
  }
}

function archivos(req, res, next) {
  try {
    res.json(teliskratelService.listarArchivosData());
  } catch (error) {
    next(error);
  }
}

async function buscar(req, res, next) {
  try {
    const numero = decodeURIComponent(req.params.numero || '').trim();
    if (!numero) return res.status(400).json({ message: 'Debe enviar un numero telefonico.' });
    const results = await teliskratelService.buscarPorUltimos5(numero);
    res.json({ ultimos5: numero.replace(/\D/g, '').slice(-5), results });
  } catch (error) {
    next(error);
  }
}

async function importarUpload(req, res, next) {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ message: 'Debe adjuntar al menos un archivo .out o .txt.' });
    const usuario = req.user?.username || req.user?.name || null;
    const resultados = [];
    for (const file of files) {
      const parsed = teliskratelService.parseContent(file.buffer.toString('utf8'), file.originalname);
      if (!parsed.registros.length) {
        resultados.push({ archivo: file.originalname, error: 'Formato no reconocido o sin registros' });
        continue;
      }
      const resumen = await teliskratelService.importar(parsed.registros, {
        origenArchivo: file.originalname,
        tipoFormato: parsed.tipoFormato,
        usuario
      });
      resultados.push({ archivo: file.originalname, ...resumen });
    }
    res.json({ resultados });
  } catch (error) {
    next(error);
  }
}

async function importarData(req, res, next) {
  try {
    const archivos = Array.isArray(req.body?.archivos) ? req.body.archivos : undefined;
    const usuario = req.user?.username || req.user?.name || null;
    const resultados = await teliskratelService.importarDesdeData(archivos, usuario);
    res.json({ resultados });
  } catch (error) {
    next(error);
  }
}

async function eliminarImportacion(req, res, next) {
  try {
    const lote = decodeURIComponent(req.params.lote || '').trim();
    if (!lote) return res.status(400).json({ message: 'Debe enviar el lote.' });
    await teliskratelService.eliminarImportacion(lote);
    res.json({ message: 'Importacion eliminada.', lote });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  importaciones,
  archivos,
  buscar,
  importarUpload,
  importarData,
  eliminarImportacion
};
