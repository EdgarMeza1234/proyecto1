const { Router } = require('express');
const mineralesService = require('../services/minerales.service');

const router = Router();

router.get('/precios', (req, res) => {
  res.json(mineralesService.listarPrecios());
});

router.put('/precios/:mineral', (req, res) => {
  const { precio } = req.body;
  if (precio === undefined || precio === null) return res.status(400).json({ message: 'precio requerido' });
  res.json(mineralesService.actualizarPrecio(req.params.mineral.toUpperCase(), Number(precio)));
});

router.get('/compras', (req, res) => {
  res.json(mineralesService.listarCompras());
});

router.get('/compras/:id', (req, res) => {
  const compra = mineralesService.obtenerCompra(Number(req.params.id));
  if (!compra) return res.status(404).json({ message: 'Compra no encontrada' });
  res.json(compra);
});

router.post('/calcular', (req, res) => {
  const calc = mineralesService.calcular(req.body);
  const pesoNeto = req.body.peso_bruto - req.body.tara;
  res.json({ peso_neto: Math.round(pesoNeto * 100) / 100, ...calc });
});

router.post('/compras', (req, res) => {
  const result = mineralesService.crearCompra(req.body);
  res.status(201).json(result);
});

router.delete('/compras/:id', (req, res) => {
  mineralesService.eliminarCompra(Number(req.params.id));
  res.json({ message: 'Compra eliminada' });
});

module.exports = router;
