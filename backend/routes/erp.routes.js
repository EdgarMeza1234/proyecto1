const { Router } = require('express');
const erpController = require('../controllers/erp.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();

router.get('/personas/:numero', authenticate, erpController.lookup);

module.exports = router;
