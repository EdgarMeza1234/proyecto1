process.env.TZ = 'America/La_Paz';

const http = require('http');
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const config = require('./config/env');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const sisattService = require('./services/sisatt.service');

const authRoutes = require('./routes/auth.routes');
const ticketsRoutes = require('./routes/tickets.routes');
const usersRoutes = require('./routes/users.routes');
const facilitiesRoutes = require('./routes/facilities.routes');
const erpRoutes = require('./routes/erp.routes');
const reclamosRoutes = require('./routes/reclamos.routes');
const tipofallaRoutes = require('./routes/tipofalla.routes');
const iskratelRoutes = require('./routes/iskratel.routes');
const trabajosRoutes = require('./routes/trabajos.routes');
const abonadosRoutes = require('./routes/abonados.routes');
const reportesTrabajosRoutes = require('./routes/reportes-trabajos.routes');
const personalRoutes = require('./routes/personal.routes');
const permisosRoutes = require('./routes/permisos.routes');
const traficoRoutes = require('./routes/trafico.routes');
const nortelRoutes = require('./routes/nortel.routes');
const mineralesRoutes = require('./routes/minerales.routes');

const app = express();
const server = http.createServer(app);

const socketService = require('./services/socket');
socketService.init(server);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(logger);
app.use(express.json({ limit: '5mb' }));

app.use('/api', authRoutes);
app.use('/api', usersRoutes);
app.use('/api/boletas', ticketsRoutes);
app.use('/api/facilidades', facilitiesRoutes);
app.use('/api/erp', erpRoutes);
app.use('/api/reclamos', reclamosRoutes);
app.use('/api/tipos-falla', tipofallaRoutes);
app.use('/api/iskratel', iskratelRoutes);
app.use('/api/trabajos', trabajosRoutes);
app.use('/api/abonados', abonadosRoutes);
app.use('/api/reportes-trabajos', reportesTrabajosRoutes);
app.use('/api/personal', personalRoutes);
app.use('/api/permisos', permisosRoutes);
app.use('/api/trafico', traficoRoutes);
app.use('/api/nortel', nortelRoutes);
app.use('/api/minerales', mineralesRoutes);

// === SISATT REST routes ===
app.get('/api/sisatt/logs', (req, res) => {
  const mes = req.query.mes;
  const ano = req.query.ano;
  if (!mes || !ano) return res.status(400).json({ message: 'mes y ano requeridos' });
  try {
    const archivos = sisattService.listarLogs(mes, ano);
    res.json(archivos);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

app.get('/api/sisatt/reporte/llc', (req, res) => {
  const mes = req.query.mes;
  const ano = req.query.ano;
  if (!mes || !ano) return res.status(400).json({ message: 'mes y ano requeridos' });
  try {
    const result = sisattService.generarSqlLLC(mes, ano);
    res.json(result);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

app.get('/api/sisatt/reporte/rotid', (req, res) => {
  const mes = req.query.mes;
  const ano = req.query.ano;
  if (!mes || !ano) return res.status(400).json({ message: 'mes y ano requeridos' });
  try {
    const result = sisattService.generarSqlROTID(mes, ano);
    res.json(result);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

app.use(errorHandler);

// === Raw WebSocket for SISATT (parsear, procesar) ===
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/ws/sisatt') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});
wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    try {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }

      if (msg.tipo === 'parsear') {
        const archivos = msg.archivos && msg.archivos.length ? msg.archivos : null;
        const list = archivos || sisattService.listarLogs(msg.mes, msg.ano);
        const total = list.length;
        for (let i = 0; i < total; i++) {
          let result;
          try {
            result = { ...sisattService.parsearArchivo(list[i], msg.mes, msg.ano), estado: 'ok' };
          } catch (e) {
            result = { archivo: list[i], estado: 'error', error: e.message };
          }
          ws.send(JSON.stringify({ tipo: 'progreso', actual: i + 1, total, archivo: result.archivo, estado: result.estado }));
        }
        ws.send(JSON.stringify({ tipo: 'completado' }));
      }

      if (msg.tipo === 'procesar') {
        const archivos = msg.archivos && msg.archivos.length ? msg.archivos : null;
        const list = archivos || sisattService.listarLogs(msg.mes, msg.ano);
        const total = list.length;
        for (let i = 0; i < total; i++) {
          let result;
          try {
            const r = sisattService.procesarArchivo(list[i]);
            result = { archivo: list[i], estado: 'ok', archivos: r };
          } catch (e) {
            result = { archivo: list[i], estado: 'error', error: e.message };
          }
          ws.send(JSON.stringify({ tipo: 'progreso', actual: i + 1, total, archivo: result.archivo, estado: result.estado }));
        }
        ws.send(JSON.stringify({ tipo: 'completado' }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ tipo: 'error', message: e.message }));
    }
  });
});

permisosRoutes.seedPermisos().then(() => {
  console.log('[permisos] Listo.');
}).catch(err => console.error('[permisos] Error fatal:', err.message))

const { ensureAuditTable } = require('./services/facilities-audit.service');
ensureAuditTable().catch(err => console.error('[facilidades-audit] Error fatal:', err.message))

server.listen(config.port, config.host, () => {
  const displayHost = config.host === '0.0.0.0' ? 'TU_IP_LOCAL' : config.host;
  console.log(`Backend disponible en http://${displayHost}:${config.port}`);
});
