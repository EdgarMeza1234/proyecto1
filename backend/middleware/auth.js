const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { getPool, getSql } = require('../db/pool');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token requerido.' });
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado.' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'No tiene permisos para esta acción.' });
    }
    next();
  };
}

function authorizePermiso(...permisos) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return res.status(403).json({ message: 'No tiene permisos para esta acción.' });
      }
      if (req.user.role === 'admin') return next();
      const pool = await getPool();
      const sql = getSql();
      const result = await pool.request()
        .input('role', sql.VarChar(50), req.user.role)
        .query(`SELECT rp.PermisoCodigo
                FROM RolesSistema rs
                JOIN RolesPermisos rp ON rp.IdRol = rs.IdRol
                WHERE rs.Codigo = @role`);
      const disponibles = new Set(result.recordset.map(r => r.PermisoCodigo));
      if (permisos.some(p => disponibles.has(p))) return next();
      return res.status(403).json({ message: 'No tiene permisos para esta acción.' });
    } catch (err) {
      return res.status(500).json({ message: 'Error al verificar permisos.', detail: err.message });
    }
  };
}

module.exports = { authenticate, authorize, authorizePermiso };
